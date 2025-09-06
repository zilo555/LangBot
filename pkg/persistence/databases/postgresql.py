from __future__ import annotations

import pip
import sqlalchemy.ext.asyncio as sqlalchemy_asyncio
import sys

from .. import database


@database.manager_class('postgresql')
class PostgreSQLDatabaseManager(database.BaseDatabaseManager):
    """PostgreSQL database manager"""

    async def initialize(self) -> None:

        # default to PostgreSQL with asyncpg driver
        try:
            __import__("asyncpg")
        except ImportError:
            print('以下依赖包未安装，将自动安装，请完成后重启程序：')
            print(
                'The dependence package asyncpg is missing, it will be installed automatically, please restart the program after completion:'
            )
            pip.main(['install', "asyncpg"])
            print('已自动安装缺失的依赖包 asyncpg ，请重启程序。')
            print('The missing dependence asyncpg have been installed automatically, please restart the program.')
            sys.exit(0)

        engine_url = self.ap.instance_config.data['system'].get('database', {}).get('engine_url', 'postgresql+asyncpg://root:***@127.0.0.1:5432/postgres')
        self.engine = sqlalchemy_asyncio.create_async_engine(engine_url)
