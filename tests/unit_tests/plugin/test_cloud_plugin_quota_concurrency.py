from __future__ import annotations

import asyncio
from collections import defaultdict
from types import SimpleNamespace

import pytest
import sqlalchemy

from langbot.pkg.api.http.context import ExecutionContext
from langbot.pkg.cloud.entitlements import EntitlementResolver, EntitlementSnapshot
from langbot.pkg.cloud.quotas import WorkspaceQuotaExceededError
from langbot.pkg.plugin.connector import PluginRuntimeConnector
from langbot_plugin.runtime.plugin.mgr import PluginInstallSource


INSTANCE_UUID = 'cloud-instance'
WORKSPACE_A = '11111111-1111-1111-1111-111111111111'
WORKSPACE_B = '22222222-2222-2222-2222-222222222222'


class _Provider:
    async def get_workspace_entitlement(self, workspace_uuid: str) -> EntitlementSnapshot:
        return EntitlementSnapshot(
            instance_uuid=INSTANCE_UUID,
            workspace_uuid=workspace_uuid,
            entitlement_revision=1,
            status='active',
            not_before=0,
            expires_at=4_102_444_800,
            features={},
            limits={'plugins.max': 3},
        )


class _Result:
    def __init__(self, *, first=None, scalar=None) -> None:
        self._first = first
        self._scalar = scalar

    def first(self):
        return self._first

    def scalar_one(self):
        return self._scalar


class _TenantUow:
    def __init__(self, manager: '_Persistence', workspace_uuid: str) -> None:
        self.manager = manager
        self.workspace_uuid = workspace_uuid
        self.lock = manager.locks[workspace_uuid]

    async def __aenter__(self):
        await self.lock.acquire()
        return self

    async def __aexit__(self, exc_type, exc, tb):
        self.lock.release()

    async def execute(self, statement):
        sql = str(statement)
        params = statement.compile().params
        if isinstance(statement, sqlalchemy.sql.dml.Insert):
            assert statement.table.name == 'plugin_settings'
            key = (params['plugin_author'], params['plugin_name'])
            self.manager.plugins[self.workspace_uuid][key] = dict(params)
            return _Result()
        if isinstance(statement, sqlalchemy.sql.dml.Update):
            return _Result()
        if 'FROM workspaces' in sql:
            assert statement._for_update_arg is not None
            self.manager.workspace_locks_seen += 1
            return _Result(first=(self.workspace_uuid,))
        if 'count(' in sql.lower() and 'FROM plugin_settings' in sql:
            return _Result(scalar=len(self.manager.plugins[self.workspace_uuid]))
        if 'FROM plugin_settings' in sql:
            author = next(value for name, value in params.items() if 'plugin_author' in name)
            name = next(value for param, value in params.items() if 'plugin_name' in param)
            row = self.manager.plugins[self.workspace_uuid].get((author, name))
            if row is None:
                return _Result(first=None)
            return _Result(
                first=SimpleNamespace(
                    installation_uuid=row['installation_uuid'],
                    runtime_revision=row['runtime_revision'],
                    artifact_digest=row['artifact_digest'],
                    install_info=row['install_info'],
                )
            )
        raise AssertionError(f'unexpected statement: {sql}')


class _Persistence:
    def __init__(self) -> None:
        self.locks = defaultdict(asyncio.Lock)
        self.plugins = defaultdict(dict)
        self.workspace_locks_seen = 0

    def tenant_uow(self, workspace_uuid: str) -> _TenantUow:
        return _TenantUow(self, workspace_uuid)


async def _connector(manager: _Persistence) -> PluginRuntimeConnector:
    resolver = EntitlementResolver(INSTANCE_UUID, _Provider())
    await resolver.reconcile_active_workspaces({WORKSPACE_A, WORKSPACE_B})
    connector = object.__new__(PluginRuntimeConnector)
    connector.ap = SimpleNamespace(entitlement_resolver=resolver, persistence_mgr=manager)
    return connector


def _context(workspace_uuid: str) -> ExecutionContext:
    return ExecutionContext(
        instance_uuid=INSTANCE_UUID,
        workspace_uuid=workspace_uuid,
        placement_generation=1,
        entitlement_revision=1,
    )


@pytest.mark.asyncio
async def test_cloud_plugin_quota_is_atomic_isolated_and_persists_across_connector_restart() -> None:
    manager = _Persistence()
    connector = await _connector(manager)

    async def install(workspace_uuid: str, index: int):
        return await connector._persist_installation_package(
            _context(workspace_uuid),
            plugin_author='test-author',
            plugin_name=f'plugin-{index}',
            install_source=PluginInstallSource.MARKETPLACE,
            install_info={'author': 'test-author', 'name': f'plugin-{index}'},
            artifact_digest=f'{index:064x}',
        )

    results = await asyncio.gather(
        *(install(WORKSPACE_A, index) for index in range(10)),
        *(install(WORKSPACE_B, index) for index in range(10)),
        return_exceptions=True,
    )

    successes = [result for result in results if isinstance(result, tuple)]
    failures = [result for result in results if isinstance(result, WorkspaceQuotaExceededError)]
    assert len(successes) == 6
    assert len(failures) == 14
    assert len(manager.plugins[WORKSPACE_A]) == 3
    assert len(manager.plugins[WORKSPACE_B]) == 3
    assert manager.workspace_locks_seen == 20

    restarted_connector = await _connector(manager)
    with pytest.raises(WorkspaceQuotaExceededError, match=r'Maximum number of plugins \(3\) reached'):
        await restarted_connector._persist_installation_package(
            _context(WORKSPACE_A),
            plugin_author='test-author',
            plugin_name='after-restart',
            install_source=PluginInstallSource.MARKETPLACE,
            install_info={},
            artifact_digest='f' * 64,
        )
    assert len(manager.plugins[WORKSPACE_A]) == 3

    installed_name = next(iter(manager.plugins[WORKSPACE_A]))[1]

    async def reinstall():
        return await restarted_connector._persist_installation_package(
            _context(WORKSPACE_A),
            plugin_author='test-author',
            plugin_name=installed_name,
            install_source=PluginInstallSource.MARKETPLACE,
            install_info={'author': 'test-author', 'name': installed_name, 'revision': 2},
            artifact_digest='e' * 64,
        )

    reinstall_results = await asyncio.gather(reinstall(), reinstall())
    assert all(result[2] is True for result in reinstall_results)

    mixed_results = await asyncio.gather(
        reinstall(),
        restarted_connector._persist_installation_package(
            _context(WORKSPACE_A),
            plugin_author='test-author',
            plugin_name='new-at-capacity',
            install_source=PluginInstallSource.MARKETPLACE,
            install_info={},
            artifact_digest='d' * 64,
        ),
        return_exceptions=True,
    )
    assert isinstance(mixed_results[0], tuple)
    assert isinstance(mixed_results[1], WorkspaceQuotaExceededError)
    assert len(manager.plugins[WORKSPACE_A]) == 3
