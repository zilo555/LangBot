"""Real scoped database checks against the reviewed LocalAgent descriptor."""

import copy
import json
from pathlib import Path
from types import SimpleNamespace as NS
from unittest.mock import AsyncMock, Mock

import pytest
import sqlalchemy as sa

from langbot.pkg.agent.runner.descriptor import RunnerDescriptor
from langbot.pkg.api.http.context import ExecutionContext
from langbot.pkg.entity.persistence.model import ModelProvider, LLMModel
from langbot.pkg.entity.persistence.rag import KnowledgeBase
from langbot.pkg.entity.persistence.mcp import MCPServer
from tests.unit_tests.api.service import test_pipeline_migration as base
from tests.unit_tests.api.service.test_pipeline_migration import context, WS, OTHER

env = base.env


@pytest.fixture
async def local(env):
    spec = json.loads((Path(__file__).parent / 'fixtures/pipeline_migration_local_schema.json').read_text())
    rid = 'plugin:langbot-team/LocalAgent/default'
    descriptor = RunnerDescriptor(
        id=rid,
        source='plugin',
        label={},
        plugin_author='langbot-team',
        plugin_name='LocalAgent',
        runner_name='default',
        plugin_version='reviewed',
        usages=['agent'],
        config_schema=spec['config'],
        capabilities=spec['capabilities'],
        permissions=spec['permissions'],
    )
    env.ap.runner_registry.list_runners.return_value = [descriptor]
    env.ap.logger = Mock()
    env.ap.tool_mgr = NS(
        get_resolved_tool_catalog=AsyncMock(
            return_value=[{'name': 'scoped_tool', 'source': 'mcp', 'source_id': 'mcp'}]
        ),
        get_tool_schema=AsyncMock(return_value=('', {})),
    )
    async with env.engine.begin() as conn:
        await conn.run_sync(
            lambda c: ModelProvider.metadata.create_all(
                c, tables=[ModelProvider.__table__, LLMModel.__table__, KnowledgeBase.__table__, MCPServer.__table__]
            )
        )
        for ws, suffix in [(WS, ''), (OTHER, '_foreign')]:
            await conn.execute(
                sa.insert(ModelProvider).values(
                    uuid='provider' + suffix,
                    workspace_uuid=ws,
                    name='provider',
                    requester='test',
                    base_url='https://synthetic.invalid',
                )
            )
            await conn.execute(
                sa.insert(LLMModel).values(
                    uuid='model' + suffix, workspace_uuid=ws, name='model', provider_uuid='provider' + suffix
                )
            )
            await conn.execute(sa.insert(KnowledgeBase).values(uuid='kb' + suffix, workspace_uuid=ws, name='kb'))
            await conn.execute(
                sa.insert(MCPServer).values(
                    uuid='mcp' + suffix, workspace_uuid=ws, name='mcp' + suffix, mode='remote', enable=True
                )
            )
    config = {item['name']: copy.deepcopy(item['default']) for item in spec['config'] if 'default' in item}
    config.update(
        {
            'model': {'primary': 'model', 'fallbacks': [], 'reasoning': {}},
            'knowledge-bases': ['kb'],
            'tools': ['scoped_tool'],
            'enable-all-tools': False,
            'mcp-resources': [{'server_uuid': 'mcp', 'uri': 'test://document', 'enabled': True}],
            'mcp-resource-agent-read-enabled': True,
        }
    )
    plan = {
        'target_runner_id': rid,
        'target_plugin': {'version': 'reviewed'},
        'config': {'ai': {'runner': {'id': rid}, 'runner_config': {rid: config}}},
    }
    return env, descriptor, config, plan


@pytest.mark.asyncio
async def test_valid_local_resources_and_real_descriptor_options(local):
    env, _, _, plan = local
    async with env.pm.tenant_scope(WS):
        await env.svc._verify_runtime(ExecutionContext.from_request(context()), plan)
    env.ap.tool_mgr.get_resolved_tool_catalog.assert_awaited_once()
    ctx = env.ap.tool_mgr.get_resolved_tool_catalog.call_args.args[0]
    assert ctx.workspace_uuid == WS
    assert env.pm.current_session() is None


@pytest.mark.asyncio
@pytest.mark.parametrize('resource', ['model', 'kb', 'mcp', 'tool'])
async def test_foreign_or_unresolved_resource_is_denied(local, resource):
    env, _, config, plan = local
    if resource == 'model':
        config['model']['primary'] = 'model_foreign'
    elif resource == 'kb':
        config['knowledge-bases'] = ['kb_foreign']
    elif resource == 'mcp':
        config['mcp-resources'][0]['server_uuid'] = 'mcp_foreign'
    else:
        config['tools'] = ['foreign_tool']
    async with env.pm.tenant_scope(WS):
        with pytest.raises(env.m.MigrationError, match='runner_resource_unavailable'):
            await env.svc._verify_runtime(ExecutionContext.from_request(context()), plan)


@pytest.mark.asyncio
@pytest.mark.parametrize('declared', [False, True])
async def test_null_requires_explicit_descriptor_nullable(local, declared):
    env, descriptor, config, plan = local
    config['timeout'] = None
    field = next(f for f in descriptor.config_schema if f['name'] == 'timeout')
    field['nullable'] = declared
    async with env.pm.tenant_scope(WS):
        if declared:
            await env.svc._verify_runtime(ExecutionContext.from_request(context()), plan)
        else:
            with pytest.raises(env.m.MigrationError, match='runner_schema_incompatible'):
                await env.svc._verify_runtime(ExecutionContext.from_request(context()), plan)


@pytest.mark.asyncio
async def test_old_plugin_version_is_rejected_before_resource_resolution(local):
    env, descriptor, _, plan = local
    descriptor.plugin_version = 'old'
    async with env.pm.tenant_scope(WS):
        with pytest.raises(env.m.MigrationError, match='plugin_version_incompatible'):
            await env.svc._verify_runtime(ExecutionContext.from_request(context()), plan)
    env.ap.tool_mgr.get_resolved_tool_catalog.assert_not_awaited()


@pytest.mark.asyncio
async def test_local_descriptor_migrates_through_detached_task(local, monkeypatch):
    env, _, _, plan = local

    def planner(config, extensions_preferences=None):
        result = base.planner(config, extensions_preferences)
        if result['state'] == 'ready':
            result.update(copy.deepcopy(plan))
            result['target_plugin'].update(author='langbot-team', name='LocalAgent')
        return result

    monkeypatch.setattr(env.m, 'plan_legacy_pipeline', planner)
    async with env.engine.begin() as conn:
        await conn.execute(
            sa.insert(base.PluginSetting).values(
                workspace_uuid=WS, plugin_author='langbot-team', plugin_name='LocalAgent', enabled=True
            )
        )
    task = await base.execute(env)
    assert task.task_context.metadata['results'][0]['state'] == 'migrated'
    configs, snapshots = await base.rows(env)
    assert configs['one'] == plan['config']
    assert len(snapshots) == 1 and snapshots[0]['source_snapshot']['config'] == base.SOURCE
    env.ap.pipeline_mgr.publish_pipeline.assert_called_once()
