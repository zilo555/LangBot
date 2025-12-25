from __future__ import annotations

import sqlalchemy
import argon2
import jwt
import datetime
import aiohttp
import typing

from ....core import app
from ....entity.persistence import user
from ....utils import constants


class UserService:
    ap: app.Application

    def __init__(self, ap: app.Application) -> None:
        self.ap = ap

    def _get_space_config(self) -> typing.Dict[str, str]:
        """Get Space configuration from config file"""
        space_config = self.ap.instance_config.data.get('space', {})
        return {
            'url': space_config.get('url', 'https://space.langbot.app'),
            'api_url': space_config.get('api_url', 'https://api.langbot.app'),
            'oauth_authorize_url': space_config.get('oauth_authorize_url', 'https://space.langbot.app/auth/authorize'),
        }

    async def is_initialized(self) -> bool:
        result = await self.ap.persistence_mgr.execute_async(sqlalchemy.select(user.User).limit(1))

        result_list = result.all()
        return result_list is not None and len(result_list) > 0

    async def create_user(self, user_email: str, password: str) -> None:
        ph = argon2.PasswordHasher()

        hashed_password = ph.hash(password)

        await self.ap.persistence_mgr.execute_async(
            sqlalchemy.insert(user.User).values(user=user_email, password=hashed_password, account_type='local')
        )

    async def get_user_by_email(self, user_email: str) -> user.User | None:
        result = await self.ap.persistence_mgr.execute_async(
            sqlalchemy.select(user.User).where(user.User.user == user_email)
        )

        result_list = result.all()
        return result_list[0] if result_list is not None and len(result_list) > 0 else None

    async def get_user_by_space_account_uuid(self, space_account_uuid: str) -> user.User | None:
        """Get user by Space account UUID"""
        result = await self.ap.persistence_mgr.execute_async(
            sqlalchemy.select(user.User).where(user.User.space_account_uuid == space_account_uuid)
        )

        result_list = result.all()
        return result_list[0] if result_list is not None and len(result_list) > 0 else None

    async def authenticate(self, user_email: str, password: str) -> str | None:
        result = await self.ap.persistence_mgr.execute_async(
            sqlalchemy.select(user.User).where(user.User.user == user_email)
        )

        result_list = result.all()

        if result_list is None or len(result_list) == 0:
            raise ValueError('用户不存在')

        user_obj = result_list[0]

        # Check if this is a Space account
        if user_obj.account_type == 'space':
            raise ValueError('请使用 Space 账户登录')

        ph = argon2.PasswordHasher()

        ph.verify(user_obj.password, password)

        return await self.generate_jwt_token(user_email)

    async def generate_jwt_token(self, user_email: str) -> str:
        jwt_secret = self.ap.instance_config.data['system']['jwt']['secret']
        jwt_expire = self.ap.instance_config.data['system']['jwt']['expire']

        payload = {
            'user': user_email,
            'iss': 'LangBot-' + constants.edition,
            'exp': datetime.datetime.now() + datetime.timedelta(seconds=jwt_expire),
        }

        return jwt.encode(payload, jwt_secret, algorithm='HS256')

    async def verify_jwt_token(self, token: str) -> str:
        jwt_secret = self.ap.instance_config.data['system']['jwt']['secret']

        return jwt.decode(token, jwt_secret, algorithms=['HS256'])['user']

    async def reset_password(self, user_email: str, new_password: str) -> None:
        ph = argon2.PasswordHasher()

        hashed_password = ph.hash(new_password)

        await self.ap.persistence_mgr.execute_async(
            sqlalchemy.update(user.User).where(user.User.user == user_email).values(password=hashed_password)
        )

    async def change_password(self, user_email: str, current_password: str, new_password: str) -> None:
        ph = argon2.PasswordHasher()

        user_obj = await self.get_user_by_email(user_email)
        if user_obj is None:
            raise ValueError('User not found')

        # Space accounts cannot change password locally
        if user_obj.account_type == 'space':
            raise ValueError('Space account cannot change password locally')

        ph.verify(user_obj.password, current_password)

        hashed_password = ph.hash(new_password)

        await self.ap.persistence_mgr.execute_async(
            sqlalchemy.update(user.User).where(user.User.user == user_email).values(password=hashed_password)
        )

    # Space OAuth methods (redirect flow)

    def get_space_oauth_authorize_url(self, redirect_uri: str, state: str = '') -> str:
        """Get the Space OAuth authorization URL for redirect"""
        space_config = self._get_space_config()
        authorize_url = space_config['oauth_authorize_url']

        # Build the authorization URL with redirect_uri
        params = f'redirect_uri={redirect_uri}'
        if state:
            params += f'&state={state}'

        return f'{authorize_url}?{params}'

    async def exchange_space_oauth_code(self, code: str) -> typing.Dict:
        """Exchange OAuth authorization code for tokens"""
        space_config = self._get_space_config()
        space_url = space_config['url']

        async with aiohttp.ClientSession() as session:
            async with session.post(
                f'{space_url}/api/v1/accounts/oauth/token',
                json={'code': code},
            ) as response:
                if response.status != 200:
                    raise ValueError(f'Failed to exchange OAuth code: {await response.text()}')
                data = await response.json()
                if data.get('code') != 0:
                    raise ValueError(f'Failed to exchange OAuth code: {data.get("msg")}')
                return data.get('data', {})

    async def get_space_user_info(self, access_token: str) -> typing.Dict:
        """Get user info from Space using access token"""
        space_config = self._get_space_config()
        space_url = space_config['url']

        async with aiohttp.ClientSession() as session:
            async with session.get(
                f'{space_url}/api/v1/accounts/me', headers={'Authorization': f'Bearer {access_token}'}
            ) as response:
                if response.status != 200:
                    raise ValueError(f'Failed to get user info: {await response.text()}')
                data = await response.json()
                if data.get('code') != 0:
                    raise ValueError(f'Failed to get user info: {data.get("msg")}')
                return data.get('data', {})

    async def refresh_space_token(self, refresh_token: str) -> typing.Dict:
        """Refresh Space access token"""
        space_config = self._get_space_config()
        space_url = space_config['url']

        async with aiohttp.ClientSession() as session:
            async with session.post(
                f'{space_url}/api/v1/accounts/token/refresh', json={'refresh_token': refresh_token}
            ) as response:
                if response.status != 200:
                    raise ValueError(f'Failed to refresh token: {await response.text()}')
                data = await response.json()
                if data.get('code') != 0:
                    raise ValueError(f'Failed to refresh token: {data.get("msg")}')
                return data.get('data', {})

    async def create_or_update_space_user(
        self,
        space_account_uuid: str,
        email: str,
        access_token: str,
        refresh_token: str,
        api_key: str,
    ) -> user.User:
        """Create or update a Space user account"""
        # Check if user with this Space UUID already exists
        existing_user = await self.get_user_by_space_account_uuid(space_account_uuid)

        if existing_user:
            # Update existing user's tokens
            await self.ap.persistence_mgr.execute_async(
                sqlalchemy.update(user.User)
                .where(user.User.space_account_uuid == space_account_uuid)
                .values(
                    space_access_token=access_token,
                    space_refresh_token=refresh_token,
                    space_api_key=api_key,
                )
            )
            return await self.get_user_by_space_account_uuid(space_account_uuid)

        # Check if user with same email exists as local account
        existing_email_user = await self.get_user_by_email(email)
        if existing_email_user and existing_email_user.account_type == 'local':
            raise ValueError('A local account with this email already exists. Please use a different email.')

        # Create new Space user
        await self.ap.persistence_mgr.execute_async(
            sqlalchemy.insert(user.User).values(
                user=email,
                password='',  # Space users don't have local password
                account_type='space',
                space_account_uuid=space_account_uuid,
                space_access_token=access_token,
                space_refresh_token=refresh_token,
                space_api_key=api_key,
            )
        )

        return await self.get_user_by_space_account_uuid(space_account_uuid)

    async def authenticate_space_user(self, access_token: str, refresh_token: str) -> typing.Tuple[str, user.User]:
        """Authenticate with Space and return JWT token"""
        # Get user info from Space
        user_info = await self.get_space_user_info(access_token)

        account = user_info.get('account', {})
        api_key = user_info.get('api_key', '')

        space_account_uuid = account.get('uuid')
        email = account.get('email')

        if not space_account_uuid or not email:
            raise ValueError('Invalid Space user info')

        # Create or update Space user in local database
        user_obj = await self.create_or_update_space_user(
            space_account_uuid=space_account_uuid,
            email=email,
            access_token=access_token,
            refresh_token=refresh_token,
            api_key=api_key,
        )

        # Generate JWT token
        jwt_token = await self.generate_jwt_token(email)

        return jwt_token, user_obj
