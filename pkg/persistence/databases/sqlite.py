from __future__ import annotations

import sqlalchemy.ext.asyncio as sqlalchemy_asyncio

from .. import database


@database.manager_class('sqlite')
class SQLiteDatabaseManager(database.BaseDatabaseManager):
    """SQLite database manager"""

    async def initialize(self) -> None:
        engine_url = self.ap.instance_config.data['system'].get('database', {}).get('engine_url', 'sqlite+aiosqlite:///data/langbot.db')
        self.engine = sqlalchemy_asyncio.create_async_engine(engine_url)
