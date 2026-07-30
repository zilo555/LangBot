from __future__ import annotations

import asyncio
from collections import defaultdict
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
import sqlalchemy

from langbot.pkg.api.http.service.bot import BotService
from langbot.pkg.cloud.entitlements import EntitlementResolver, EntitlementSnapshot


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
            limits={'bots.max': 2},
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
        if isinstance(statement, sqlalchemy.sql.dml.Insert):
            assert statement.table.name == 'bots'
            self.manager.bots[self.workspace_uuid].append(statement.compile().params)
            return _Result()
        if 'FROM workspaces' in sql:
            assert statement._for_update_arg is not None
            self.manager.workspace_locks_seen += 1
            return _Result(first=(self.workspace_uuid,))
        if 'count(' in sql.lower() and 'FROM bots' in sql:
            return _Result(scalar=len(self.manager.bots[self.workspace_uuid]))
        if 'FROM legacy_pipelines' in sql:
            return _Result(first=None)
        raise AssertionError(f'unexpected statement: {sql}')


class _Persistence:
    def __init__(self) -> None:
        self.locks = defaultdict(asyncio.Lock)
        self.bots = defaultdict(list)
        self.workspace_locks_seen = 0

    def tenant_uow(self, workspace_uuid: str) -> _TenantUow:
        return _TenantUow(self, workspace_uuid)

    async def execute_async(self, statement):
        assert 'FROM legacy_pipelines' in str(statement)
        return _Result(first=None)


async def _service(manager: _Persistence) -> BotService:
    resolver = EntitlementResolver(INSTANCE_UUID, _Provider())
    await resolver.reconcile_active_workspaces({WORKSPACE_A, WORKSPACE_B})
    ap = SimpleNamespace(
        entitlement_resolver=resolver,
        persistence_mgr=manager,
        instance_config=SimpleNamespace(data={'system': {'limitation': {'max_bots': 99}}}),
        platform_mgr=SimpleNamespace(load_bot=AsyncMock()),
    )
    service = BotService(ap)
    service.get_bot = AsyncMock(return_value={'uuid': 'created'})
    return service


@pytest.mark.asyncio
async def test_cloud_bot_quota_is_atomic_isolated_and_persists_across_service_restart() -> None:
    manager = _Persistence()
    service = await _service(manager)

    async def create(workspace_uuid: str, index: int):
        return await service.create_bot(workspace_uuid, {'name': f'bot-{index}'})

    results = await asyncio.gather(
        *(create(WORKSPACE_A, index) for index in range(8)),
        *(create(WORKSPACE_B, index) for index in range(8)),
        return_exceptions=True,
    )

    successes = [result for result in results if isinstance(result, str)]
    failures = [result for result in results if isinstance(result, ValueError)]
    assert len(successes) == 4
    assert len(failures) == 12
    assert len(manager.bots[WORKSPACE_A]) == 2
    assert len(manager.bots[WORKSPACE_B]) == 2
    assert manager.workspace_locks_seen == 16

    restarted_service = await _service(manager)
    with pytest.raises(ValueError, match=r'Maximum number of bots \(2\) reached'):
        await restarted_service.create_bot(WORKSPACE_A, {'name': 'after-restart'})
    assert len(manager.bots[WORKSPACE_A]) == 2
