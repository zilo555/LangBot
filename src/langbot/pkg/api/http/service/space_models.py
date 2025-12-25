from __future__ import annotations

import typing
import uuid as uuid_lib
import aiohttp
import sqlalchemy

from ....core import app
from ....entity.persistence import model as persistence_model
from ....entity.persistence import user as persistence_user


DEFAULT_SPACE_URL = 'http://localhost:8383'

# Space's base URL for model API requests (used for requester_config)
SPACE_API_BASE_URL = 'http://localhost:8383'


class SpaceModelsService:
    """Service for syncing models from Space MaaS"""

    ap: app.Application

    def __init__(self, ap: app.Application) -> None:
        self.ap = ap

    async def get_space_user_info(self, user_email: str) -> persistence_user.User | None:
        """Get Space user info for sync operations"""
        result = await self.ap.persistence_mgr.execute_async(
            sqlalchemy.select(persistence_user.User).where(persistence_user.User.user == user_email)
        )
        result_list = result.all()
        return result_list[0] if result_list else None

    async def fetch_space_models(self, space_url: str = DEFAULT_SPACE_URL) -> typing.Dict:
        """Fetch available models from Space API"""
        async with aiohttp.ClientSession() as session:
            async with session.get(f'{space_url}/api/v1/models', params={'page_size': 100}) as response:
                if response.status != 200:
                    raise ValueError(f'Failed to fetch models from Space: {await response.text()}')
                data = await response.json()
                if data.get('code') != 0:
                    raise ValueError(f'Failed to fetch models from Space: {data.get("msg")}')
                return data.get('data', {})

    async def sync_models_from_space(
        self, user_email: str, space_url: str = DEFAULT_SPACE_URL
    ) -> typing.Dict[str, typing.Any]:
        """
        Sync models from Space to local database.
        Returns statistics about the sync operation.
        """
        # Get user info for API key
        user_obj = await self.get_space_user_info(user_email)
        if user_obj is None:
            raise ValueError('User not found')

        if user_obj.account_type != 'space':
            raise ValueError('User is not a Space account')

        if not user_obj.space_api_key:
            raise ValueError('User does not have a Space API key configured')

        # Fetch models from Space
        models_data = await self.fetch_space_models(space_url)
        space_models = models_data.get('models', [])

        # Get existing Space models in local database
        result = await self.ap.persistence_mgr.execute_async(
            sqlalchemy.select(persistence_model.LLMModel).where(persistence_model.LLMModel.source == 'space')
        )
        existing_space_models = {m.space_model_id: m for m in result.all()}

        result = await self.ap.persistence_mgr.execute_async(
            sqlalchemy.select(persistence_model.EmbeddingModel).where(
                persistence_model.EmbeddingModel.source == 'space'
            )
        )
        existing_space_embedding_models = {m.space_model_id: m for m in result.all()}

        stats = {'created_llm': 0, 'updated_llm': 0, 'created_embedding': 0, 'updated_embedding': 0, 'skipped': 0}

        for model in space_models:
            model_id = model.get('model_id')
            category = model.get('category', '')

            if not model_id:
                stats['skipped'] += 1
                continue

            if category == 'embedding':
                # Handle embedding model
                await self._sync_embedding_model(model, user_obj.space_api_key, existing_space_embedding_models, stats)
            else:
                # Handle LLM model (chat, completion, etc.)
                await self._sync_llm_model(model, user_obj.space_api_key, existing_space_models, stats)

        return stats

    async def _sync_llm_model(
        self,
        model: typing.Dict,
        api_key: str,
        existing_models: typing.Dict[str, persistence_model.LLMModel],
        stats: typing.Dict,
    ) -> None:
        """Sync a single LLM model from Space"""
        model_id = model.get('model_id')
        display_name = model.get('display_name', {})
        name = display_name.get('zh_Hans', display_name.get('en_US', model_id))
        description_obj = model.get('description', {})
        description = description_obj.get('zh_Hans', description_obj.get('en_US', '')) if description_obj else ''

        # Infer abilities from model capabilities
        abilities = []
        supported_endpoints = model.get('supported_endpoints', [])
        if 'vision' in str(supported_endpoints).lower() or 'vision' in model_id.lower():
            abilities.append('vision')
        if 'function' in str(supported_endpoints).lower() or 'tool' in str(supported_endpoints).lower():
            abilities.append('function_call')

        model_data = {
            'name': name,
            'description': description[:255] if description else 'Model from Space MaaS',
            'requester': 'openai-chat-completions',  # Space uses OpenAI-compatible API
            'requester_config': {
                'base-url': SPACE_API_BASE_URL,
                'args': {},
                'timeout': 120,
            },
            'api_keys': [api_key],
            'abilities': abilities,
            'extra_args': {'model': model_id},
            'source': 'space',
            'space_model_id': model_id,
        }

        if model_id in existing_models:
            # Update existing model
            await self.ap.persistence_mgr.execute_async(
                sqlalchemy.update(persistence_model.LLMModel)
                .where(persistence_model.LLMModel.space_model_id == model_id)
                .values(**model_data)
            )
            stats['updated_llm'] += 1
        else:
            # Create new model
            model_data['uuid'] = str(uuid_lib.uuid4())
            await self.ap.persistence_mgr.execute_async(
                sqlalchemy.insert(persistence_model.LLMModel).values(**model_data)
            )
            stats['created_llm'] += 1

    async def _sync_embedding_model(
        self,
        model: typing.Dict,
        api_key: str,
        existing_models: typing.Dict[str, persistence_model.EmbeddingModel],
        stats: typing.Dict,
    ) -> None:
        """Sync a single embedding model from Space"""
        model_id = model.get('model_id')
        display_name = model.get('display_name', {})
        name = display_name.get('zh_Hans', display_name.get('en_US', model_id))
        description_obj = model.get('description', {})
        description = description_obj.get('zh_Hans', description_obj.get('en_US', '')) if description_obj else ''

        model_data = {
            'name': name,
            'description': description[:255] if description else 'Embedding model from Space MaaS',
            'requester': 'openai-embedding',  # Space uses OpenAI-compatible API
            'requester_config': {
                'base-url': SPACE_API_BASE_URL,
                'args': {},
                'timeout': 120,
            },
            'api_keys': [api_key],
            'extra_args': {'model': model_id},
            'source': 'space',
            'space_model_id': model_id,
        }

        if model_id in existing_models:
            # Update existing model
            await self.ap.persistence_mgr.execute_async(
                sqlalchemy.update(persistence_model.EmbeddingModel)
                .where(persistence_model.EmbeddingModel.space_model_id == model_id)
                .values(**model_data)
            )
            stats['updated_embedding'] += 1
        else:
            # Create new model
            model_data['uuid'] = str(uuid_lib.uuid4())
            await self.ap.persistence_mgr.execute_async(
                sqlalchemy.insert(persistence_model.EmbeddingModel).values(**model_data)
            )
            stats['created_embedding'] += 1

    async def get_space_models(self) -> typing.Dict[str, typing.List]:
        """Get all synced Space models"""
        llm_result = await self.ap.persistence_mgr.execute_async(
            sqlalchemy.select(persistence_model.LLMModel).where(persistence_model.LLMModel.source == 'space')
        )
        embedding_result = await self.ap.persistence_mgr.execute_async(
            sqlalchemy.select(persistence_model.EmbeddingModel).where(
                persistence_model.EmbeddingModel.source == 'space'
            )
        )

        return {
            'llm_models': [
                self.ap.persistence_mgr.serialize_model(persistence_model.LLMModel, m) for m in llm_result.all()
            ],
            'embedding_models': [
                self.ap.persistence_mgr.serialize_model(persistence_model.EmbeddingModel, m)
                for m in embedding_result.all()
            ],
        }

    async def delete_space_models(self) -> typing.Dict[str, int]:
        """Delete all synced Space models"""
        # Remove from model manager first
        llm_result = await self.ap.persistence_mgr.execute_async(
            sqlalchemy.select(persistence_model.LLMModel).where(persistence_model.LLMModel.source == 'space')
        )
        for model in llm_result.all():
            await self.ap.model_mgr.remove_llm_model(model.uuid)

        embedding_result = await self.ap.persistence_mgr.execute_async(
            sqlalchemy.select(persistence_model.EmbeddingModel).where(
                persistence_model.EmbeddingModel.source == 'space'
            )
        )
        for model in embedding_result.all():
            await self.ap.model_mgr.remove_embedding_model(model.uuid)

        # Delete from database
        llm_delete = await self.ap.persistence_mgr.execute_async(
            sqlalchemy.delete(persistence_model.LLMModel).where(persistence_model.LLMModel.source == 'space')
        )
        embedding_delete = await self.ap.persistence_mgr.execute_async(
            sqlalchemy.delete(persistence_model.EmbeddingModel).where(
                persistence_model.EmbeddingModel.source == 'space'
            )
        )

        return {'deleted_llm': llm_delete.rowcount, 'deleted_embedding': embedding_delete.rowcount}
