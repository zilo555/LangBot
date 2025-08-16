import sqlalchemy
from .. import migration


@migration.migration_class(5)
class DBMigratePluginInstallSource(migration.DBMigration):
    """插件安装来源"""

    async def upgrade(self):
        """升级"""
        # add new column install_source, use default value 'github', via alter table
        await self.ap.persistence_mgr.execute_async(
            sqlalchemy.text(
                "ALTER TABLE plugin_settings ADD COLUMN install_source VARCHAR(255) NOT NULL DEFAULT 'github'"
            )
        )

        # add new column install_info, use default value {}, via alter table
        await self.ap.persistence_mgr.execute_async(
            sqlalchemy.text("ALTER TABLE plugin_settings ADD COLUMN install_info JSON NOT NULL DEFAULT '{}'")
        )

    async def downgrade(self):
        """降级"""
        pass
