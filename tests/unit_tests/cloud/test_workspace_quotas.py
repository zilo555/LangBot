from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest
import sqlalchemy

from langbot.pkg.cloud.entitlements import EntitlementResolver, EntitlementSnapshot
from langbot.pkg.cloud.quotas import (
    WorkspaceQuota,
    require_resource_capacity,
    resolve_workspace_quota,
)
from langbot.pkg.entity.persistence.bot import Bot


WORKSPACE_UUID = '11111111-1111-1111-1111-111111111111'
INSTANCE_UUID = 'cloud-instance'


class _Provider:
    def __init__(self, limits: dict[str, int]) -> None:
        self.limits = limits

    async def get_workspace_entitlement(self, workspace_uuid: str) -> EntitlementSnapshot:
        return EntitlementSnapshot(
            instance_uuid=INSTANCE_UUID,
            workspace_uuid=workspace_uuid,
            entitlement_revision=1,
            status='active',
            not_before=0,
            expires_at=4_102_444_800,
            features={},
            limits=self.limits,
            plan_name='test',
        )


async def _resolver(limits: dict[str, int]) -> EntitlementResolver:
    resolver = EntitlementResolver(INSTANCE_UUID, _Provider(limits))
    await resolver.reconcile_active_workspaces({WORKSPACE_UUID})
    return resolver


@pytest.mark.asyncio
async def test_resolve_workspace_quota_uses_signed_cloud_limit() -> None:
    ap = SimpleNamespace(entitlement_resolver=await _resolver({'bots.max': 2}))

    quota = await resolve_workspace_quota(ap, WORKSPACE_UUID, 'bots.max', fallback=99)

    assert quota == WorkspaceQuota(limit=2, requires_transaction_lock=True)


@pytest.mark.asyncio
async def test_resolve_workspace_quota_preserves_oss_fallback() -> None:
    quota = await resolve_workspace_quota(SimpleNamespace(), WORKSPACE_UUID, 'bots.max', fallback=7)

    assert quota == WorkspaceQuota(limit=7, requires_transaction_lock=False)


@pytest.mark.asyncio
async def test_require_resource_capacity_locks_workspace_before_counting() -> None:
    statements: list[object] = []
    lock_result = Mock()
    lock_result.first.return_value = (WORKSPACE_UUID,)
    count_result = Mock()
    count_result.scalar_one.return_value = 1
    execute = AsyncMock(side_effect=[lock_result, count_result])

    await require_resource_capacity(
        execute,
        workspace_uuid=WORKSPACE_UUID,
        model=Bot,
        quota=WorkspaceQuota(limit=2, requires_transaction_lock=True),
        resource_name='bots',
    )

    statements.extend(call.args[0] for call in execute.await_args_list)
    assert len(statements) == 2
    assert isinstance(statements[0], sqlalchemy.sql.Select)
    assert statements[0]._for_update_arg is not None
    assert 'workspaces' in str(statements[0])
    assert 'count' in str(statements[1]).lower()


@pytest.mark.asyncio
async def test_require_resource_capacity_rejects_at_boundary() -> None:
    lock_result = Mock()
    lock_result.first.return_value = (WORKSPACE_UUID,)
    count_result = Mock()
    count_result.scalar_one.return_value = 2
    execute = AsyncMock(side_effect=[lock_result, count_result])

    with pytest.raises(ValueError, match=r'Maximum number of bots \(2\) reached'):
        await require_resource_capacity(
            execute,
            workspace_uuid=WORKSPACE_UUID,
            model=Bot,
            quota=WorkspaceQuota(limit=2, requires_transaction_lock=True),
            resource_name='bots',
        )
