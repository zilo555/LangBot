from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Awaitable, Callable

import sqlalchemy

from ..entity.persistence import workspace as persistence_workspace
from .entitlements import EntitlementResolver


Execute = Callable[[Any], Awaitable[Any]]


class WorkspaceQuotaExceededError(ValueError):
    """A stable business error raised when a workspace has no free slots."""

    error_code = 'workspace_quota_exceeded'

    def __init__(self, resource_name: str, limit: int) -> None:
        self.resource_name = resource_name
        self.limit = limit
        super().__init__(f'Maximum number of {resource_name} ({limit}) reached')


@dataclass(frozen=True, slots=True)
class WorkspaceQuota:
    limit: int
    requires_transaction_lock: bool


async def resolve_workspace_quota(
    ap: Any,
    workspace_uuid: str,
    limit_name: str,
    *,
    fallback: int = -1,
) -> WorkspaceQuota:
    """Resolve a plan-agnostic Cloud limit while preserving OSS configuration."""

    resolver = getattr(ap, 'entitlement_resolver', None)
    if isinstance(resolver, EntitlementResolver):
        snapshot = await resolver.resolve(workspace_uuid)
        return WorkspaceQuota(
            limit=snapshot.limit(limit_name),
            requires_transaction_lock=True,
        )
    return WorkspaceQuota(limit=fallback, requires_transaction_lock=False)


async def lock_workspace_for_quota(execute: Execute, workspace_uuid: str) -> None:
    """Serialize quota checks on the durable Workspace row within one transaction."""

    result = await execute(
        sqlalchemy.select(persistence_workspace.Workspace.uuid)
        .where(persistence_workspace.Workspace.uuid == workspace_uuid)
        .with_for_update()
    )
    if result.first() is None:
        raise ValueError('Workspace does not exist')


async def require_resource_capacity(
    execute: Execute,
    *,
    workspace_uuid: str,
    model: type,
    quota: WorkspaceQuota,
    resource_name: str,
    workspace_locked: bool = False,
) -> None:
    if quota.limit < 0:
        return
    if quota.requires_transaction_lock and not workspace_locked:
        await lock_workspace_for_quota(execute, workspace_uuid)
    result = await execute(
        sqlalchemy.select(sqlalchemy.func.count())
        .select_from(model)
        .where(model.workspace_uuid == workspace_uuid)
    )
    if int(result.scalar_one()) >= quota.limit:
        raise WorkspaceQuotaExceededError(resource_name, quota.limit)
