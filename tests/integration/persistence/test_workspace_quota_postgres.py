"""PostgreSQL integration coverage for durable workspace quota locking.

Run with TEST_POSTGRES_URL=postgresql+asyncpg://... pytest ...
"""

from __future__ import annotations

import asyncio
import os
import uuid

import pytest
import sqlalchemy as sa
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from langbot.pkg.cloud import quotas as quota_module
from langbot.pkg.cloud.quotas import WorkspaceQuota, WorkspaceQuotaExceededError, require_resource_capacity


pytestmark = [pytest.mark.integration, pytest.mark.slow, pytest.mark.asyncio]


class _Base(DeclarativeBase):
    pass


class _Workspace(_Base):
    __tablename__ = 'quota_integration_workspaces'

    uuid: Mapped[str] = mapped_column(sa.String(36), primary_key=True)


class _Resource(_Base):
    __tablename__ = 'quota_integration_resources'

    uuid: Mapped[str] = mapped_column(sa.String(36), primary_key=True)
    workspace_uuid: Mapped[str] = mapped_column(
        sa.String(36),
        sa.ForeignKey('quota_integration_workspaces.uuid', ondelete='CASCADE'),
        nullable=False,
        index=True,
    )


@pytest.fixture
async def quota_postgres(monkeypatch):
    url = os.environ.get('TEST_POSTGRES_URL')
    if not url:
        pytest.skip('TEST_POSTGRES_URL not set')
    if url.startswith('postgresql://'):
        url = url.replace('postgresql://', 'postgresql+asyncpg://', 1)

    engine = create_async_engine(url, pool_size=5, max_overflow=0)
    monkeypatch.setattr(quota_module.persistence_workspace, 'Workspace', _Workspace)
    async with engine.begin() as connection:
        await connection.run_sync(_Base.metadata.drop_all)
        await connection.run_sync(_Base.metadata.create_all)
    try:
        yield url, engine
    finally:
        async with engine.begin() as connection:
            await connection.run_sync(_Base.metadata.drop_all)
        await engine.dispose()


async def test_workspace_row_lock_is_atomic_isolated_and_survives_pool_restart(quota_postgres) -> None:
    url, engine = quota_postgres
    workspace_a = str(uuid.uuid4())
    workspace_b = str(uuid.uuid4())
    quota = WorkspaceQuota(limit=1, requires_transaction_lock=True)
    sessions = async_sessionmaker(engine, expire_on_commit=False)

    async with engine.begin() as connection:
        await connection.execute(sa.insert(_Workspace), [{'uuid': workspace_a}, {'uuid': workspace_b}])

    lock_acquired = asyncio.Event()
    release_first = asyncio.Event()

    async def admit(workspace_uuid: str, *, hold: bool = False) -> None:
        async with sessions() as session:
            async with session.begin():
                await require_resource_capacity(
                    session.execute,
                    workspace_uuid=workspace_uuid,
                    model=_Resource,
                    quota=quota,
                    resource_name='resources',
                )
                if hold:
                    lock_acquired.set()
                    await release_first.wait()
                await session.execute(
                    sa.insert(_Resource).values(uuid=str(uuid.uuid4()), workspace_uuid=workspace_uuid)
                )

    first = asyncio.create_task(admit(workspace_a, hold=True))
    await asyncio.wait_for(lock_acquired.wait(), timeout=2)
    same_workspace = asyncio.create_task(admit(workspace_a))
    other_workspace = asyncio.create_task(admit(workspace_b))

    await asyncio.wait_for(other_workspace, timeout=2)
    assert not same_workspace.done(), 'same-workspace transaction bypassed SELECT FOR UPDATE'

    release_first.set()
    await first
    with pytest.raises(WorkspaceQuotaExceededError, match=r'Maximum number of resources \(1\) reached'):
        await same_workspace

    async with sessions() as session:
        counts = dict(
            (
                await session.execute(
                    sa.select(_Resource.workspace_uuid, sa.func.count())
                    .group_by(_Resource.workspace_uuid)
                    .order_by(_Resource.workspace_uuid)
                )
            ).all()
        )
    assert counts == {workspace_a: 1, workspace_b: 1}

    await engine.dispose()
    restarted_engine = create_async_engine(url, pool_size=2, max_overflow=0)
    restarted_sessions = async_sessionmaker(restarted_engine, expire_on_commit=False)
    try:
        async with restarted_sessions() as session:
            async with session.begin():
                with pytest.raises(WorkspaceQuotaExceededError):
                    await require_resource_capacity(
                        session.execute,
                        workspace_uuid=workspace_a,
                        model=_Resource,
                        quota=quota,
                        resource_name='resources',
                    )
    finally:
        await restarted_engine.dispose()
