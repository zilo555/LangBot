import quart

from .. import group


DEFAULT_SPACE_URL = 'https://space.langbot.app'


@group.group_class('space', '/api/v1/space')
class SpaceRouterGroup(group.RouterGroup):
    async def initialize(self) -> None:
        @self.route('/models/sync', methods=['POST'], auth_type=group.AuthType.USER_TOKEN)
        async def _(user_email: str) -> str:
            """Sync models from Space MaaS to local database"""
            json_data = await quart.request.json or {}
            space_url = json_data.get('space_url', DEFAULT_SPACE_URL)

            try:
                stats = await self.ap.space_models_service.sync_models_from_space(user_email, space_url)
                return self.success(data=stats)
            except ValueError as e:
                return self.fail(1, str(e))
            except Exception as e:
                return self.fail(2, f'Failed to sync models: {str(e)}')

        @self.route('/models', methods=['GET'], auth_type=group.AuthType.USER_TOKEN)
        async def _(user_email: str) -> str:
            """Get all synced Space models"""
            if quart.request.method == 'GET':
                try:
                    models = await self.ap.space_models_service.get_space_models()
                    return self.success(data=models)
                except Exception as e:
                    return self.fail(1, f'Failed to get Space models: {str(e)}')
            elif quart.request.method == 'DELETE':
                try:
                    stats = await self.ap.space_models_service.delete_space_models()
                    return self.success(data=stats)
                except Exception as e:
                    return self.fail(1, f'Failed to delete Space models: {str(e)}')

        @self.route('/models/available', methods=['GET'], auth_type=group.AuthType.USER_TOKEN)
        async def _(user_email: str) -> str:
            """Get available models from Space (preview before sync)"""
            try:
                space_url = quart.request.args.get('space_url', DEFAULT_SPACE_URL)
                models_data = await self.ap.space_models_service.fetch_space_models(space_url)
                return self.success(data=models_data)
            except ValueError as e:
                return self.fail(1, str(e))
            except Exception as e:
                return self.fail(2, f'Failed to fetch available models: {str(e)}')
