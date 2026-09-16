"""Host-only, descriptor-driven Runner reasoning policy and durable snapshot tests."""

from __future__ import annotations

import importlib
from types import SimpleNamespace

import pytest

from langbot.pkg.agent.runner.session_registry import AgentRunSessionRegistry
from langbot.pkg.provider.modelmgr import errors, reasoning
from tests.unit_tests.provider.test_reasoning_control import _requester, _runtime_model


PRIMARY = '00000000-0000-4000-8000-000000000011'
FALLBACK = '00000000-0000-4000-8000-000000000012'
OTHER = '00000000-0000-4000-8000-000000000013'


def policy():
    return importlib.import_module('langbot.pkg.agent.runner.model_reasoning')


def descriptor(*names):
    return SimpleNamespace(config_schema=[{'name': name, 'type': 'model-fallback-selector'} for name in names])


def resources(*ids):
    return {'models': [{'model_id': model_id} for model_id in ids]}


def selection(level='high'):
    return {'primary': PRIMARY, 'fallbacks': [FALLBACK], 'reasoning': {PRIMARY: level, FALLBACK: 'low'}}


def test_generic_descriptor_extracts_only_selected_authorized_models():
    value = selection()
    value['reasoning'][OTHER] = 'max'
    result = policy().extract_model_reasoning_overrides(
        descriptor('arbitrary'), {'arbitrary': value}, resources(PRIMARY, FALLBACK, OTHER)
    )
    assert result == {PRIMARY: {'level': 'high'}, FALLBACK: {'level': 'low'}}
    assert policy().extract_model_reasoning_overrides(
        descriptor('arbitrary'), {'arbitrary': value}, resources(FALLBACK)
    ) == {FALLBACK: {'level': 'low'}}
    value['reasoning'][PRIMARY] = 'disabled'
    assert result[PRIMARY] == {'level': 'high'}


@pytest.mark.parametrize('level', reasoning.REASONING_LEVELS)
def test_all_canonical_levels_use_core_normalization(level):
    result = policy().extract_model_reasoning_overrides(
        descriptor('models'), {'models': selection(level)}, resources(PRIMARY)
    )
    assert result == {PRIMARY: reasoning.normalize_reasoning_config({'level': level})}


@pytest.mark.parametrize('value', ['plain-model', {}, {'primary': PRIMARY}, {'primary': PRIMARY, 'reasoning': {}}])
def test_absent_map_does_not_create_default_override(value):
    assert policy().extract_model_reasoning_overrides(descriptor('models'), {'models': value}, resources(PRIMARY)) == {}


def test_undeclared_fields_and_descriptor_defaults_do_not_supply_overrides():
    desc = descriptor('declared')
    desc.config_schema[0]['default'] = selection()
    assert policy().extract_model_reasoning_overrides(desc, {'model': selection()}, resources(PRIMARY)) == {}


@pytest.mark.parametrize(
    'value', [None, [], 'high', {PRIMARY: None}, {PRIMARY: {}}, {PRIMARY: 'secret-invalid-level'}, {PRIMARY: ['high']}]
)
def test_invalid_explicit_maps_fail_with_safe_error(value):
    with pytest.raises(ValueError, match='Invalid runner model reasoning configuration') as exc:
        policy().extract_model_reasoning_overrides(
            descriptor('models'), {'models': {'primary': PRIMARY, 'reasoning': value}}, resources(PRIMARY)
        )
    assert 'secret-invalid-level' not in str(exc.value)
    assert PRIMARY not in str(exc.value)


@pytest.mark.parametrize('reverse', [False, True])
def test_multiple_selectors_reject_conflicting_overrides_deterministically(reverse):
    names = ['one', 'two']
    if reverse:
        names.reverse()
    config = {'one': selection('high'), 'two': selection('provider_default')}
    with pytest.raises(ValueError, match='Conflicting runner model reasoning overrides'):
        policy().extract_model_reasoning_overrides(descriptor(*names), config, resources(PRIMARY))
    config['two'] = selection('high')
    assert policy().extract_model_reasoning_overrides(descriptor(*names), config, resources(PRIMARY)) == {
        PRIMARY: {'level': 'high'}
    }


@pytest.mark.asyncio
async def test_session_deepcopies_reasoning_without_granting_models():
    registry = AgentRunSessionRegistry()
    overrides = {PRIMARY: {'level': 'high'}, OTHER: {'level': 'max'}}
    await registry.register(
        run_id='frozen',
        runner_id='plugin:test/runner/main',
        query_id=None,
        plugin_identity='test/runner',
        resources=resources(PRIMARY),
        model_reasoning_overrides=overrides,
    )
    overrides[PRIMARY]['level'] = 'low'
    session = await registry.get('frozen')
    assert session['authorization']['model_reasoning_overrides'][PRIMARY] == {'level': 'high'}
    assert not registry.is_resource_allowed(session, 'model', OTHER, 'invoke')


def test_request_local_clone_preserves_shared_model_and_absent_default():
    model = _runtime_model(_requester('openai'), 'high', name='gpt-5')
    assert policy().model_with_reasoning_override(model, PRIMARY, None) is model
    assert policy().model_with_reasoning_override(model, PRIMARY, {'authorization': {}}) is model
    overrides = {PRIMARY: {'level': 'provider_default'}}
    clone = policy().model_with_reasoning_override(
        model, PRIMARY, {'authorization': {'model_reasoning_overrides': overrides}}
    )
    assert clone is not model
    assert clone.provider is model.provider
    assert clone.model_entity is model.model_entity
    assert clone.reasoning_config_override == {'level': 'provider_default'}
    clone.reasoning_config_override['level'] = 'disabled'
    assert overrides[PRIMARY]['level'] == 'provider_default'
    assert model.reasoning_config_override is None
    assert model.model_entity.reasoning_config == {'level': 'high'}


@pytest.mark.parametrize(
    ('provider', 'name', 'expected'),
    [
        ('openai', 'gpt-5', {'reasoning_effort': 'high'}),
        ('anthropic', 'claude-sonnet-4-6', {'reasoning_effort': 'high'}),
        ('gemini', 'gemini-3-pro', {'reasoning_effort': 'high'}),
    ],
)
def test_real_requester_reasoning_boundary(provider, name, expected, monkeypatch):
    request = _requester(provider)
    monkeypatch.setattr(request, '_supports_reasoning', lambda _: True)
    monkeypatch.setattr(request, '_safe_model_info', lambda _: {})
    model = _runtime_model(request, 'low', name=name)
    clone = policy().model_with_reasoning_override(
        model, PRIMARY, {'authorization': {'model_reasoning_overrides': {PRIMARY: {'level': 'high'}}}}
    )
    assert request._build_reasoning_args(clone) == expected
    clone.reasoning_config_override = {'level': 'provider_default'}
    assert request._build_reasoning_args(clone) == {}
    assert model.model_entity.reasoning_config == {'level': 'low'}


@pytest.mark.parametrize(
    ('name', 'abilities', 'level'), [('gpt-5', [], 'high'), ('gemini-3-pro', ['reasoning'], 'disabled')]
)
def test_real_requester_still_rejects_ability_and_capability_mismatches(name, abilities, level, monkeypatch):
    request = _requester('gemini' if name.startswith('gemini') else 'openai')
    monkeypatch.setattr(request, '_supports_reasoning', lambda _: True)
    monkeypatch.setattr(request, '_safe_model_info', lambda _: {})
    model = _runtime_model(request, name=name, abilities=abilities)
    session = {'authorization': {'model_reasoning_overrides': {PRIMARY: {'level': level}}}}
    if not abilities:
        with pytest.raises(ValueError, match='reasoning ability'):
            policy().model_with_reasoning_override(model, PRIMARY, session)
    else:
        clone = policy().model_with_reasoning_override(model, PRIMARY, session)
        with pytest.raises(errors.RequesterError):
            request._build_reasoning_args(clone)


@pytest.mark.asyncio
async def test_orchestrator_freezes_host_policy_and_persistent_reload(tmp_path):
    from sqlalchemy.ext.asyncio import create_async_engine
    from langbot.pkg.agent.runner.orchestrator import AgentRunOrchestrator
    from langbot.pkg.entity.persistence.base import Base
    from langbot.pkg.plugin.agent_run_support import _load_persistent_agent_run_session
    from tests.unit_tests.agent.test_orchestrator_integration import (
        FakeApplication,
        FakePluginConnector,
        FakeRegistry,
        make_descriptor,
        make_query,
    )

    engine = create_async_engine(f'sqlite+aiosqlite:///{tmp_path / "reasoning.db"}')
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    connector = FakePluginConnector(results=[{'type': 'run.completed', 'data': {}}])
    ap = FakeApplication(connector, engine)
    desc = make_descriptor()
    query = make_query()
    query.pipeline_config['ai']['runner_config'][desc.id]['model']['reasoning'] = {
        'model_primary': 'high',
        'model_fallback': 'low',
    }
    expected = {'model_primary': {'level': 'high'}, 'model_fallback': {'level': 'low'}}
    try:
        orchestrator = AgentRunOrchestrator(ap, FakeRegistry(desc))
        _ = [value async for value in orchestrator.run_from_query(query)]
        session = connector.sessions_during_run[0]
        assert session['authorization']['model_reasoning_overrides'] == expected
        wire = connector.contexts[0]
        assert 'model_reasoning_overrides' not in wire
        assert 'model_reasoning_overrides' not in wire['resources']
        query.pipeline_config['ai']['runner_config'][desc.id]['model']['reasoning']['model_primary'] = 'disabled'
        assert session['authorization']['model_reasoning_overrides'] == expected
        restored = await _load_persistent_agent_run_session(wire['run_id'], ap, 'test')
        assert restored['authorization']['model_reasoning_overrides'] == expected
    finally:
        await engine.dispose()


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ('provider', 'name', 'level', 'expected'),
    [
        ('openai', 'gpt-5', 'high', {'reasoning_effort': 'high'}),
        ('anthropic', 'claude-sonnet-4-6', 'disabled', {'thinking': {'type': 'disabled'}}),
        ('gemini', 'gemini-3-pro', 'low', {'reasoning_effort': 'low'}),
    ],
)
async def test_real_completion_and_count_tokens_build_boundary(provider, name, level, expected, monkeypatch):
    from unittest.mock import AsyncMock
    from langbot_plugin.api.entities.builtin.provider import message as provider_message
    from langbot.pkg.provider.modelmgr.requesters import litellmchat

    request = _requester(provider)
    monkeypatch.setattr(request, '_supports_reasoning', lambda _: True)
    monkeypatch.setattr(request, '_safe_model_info', lambda _: {})
    model = _runtime_model(request, name=name)
    model.provider.token_mgr.get_token = lambda: 'test-only-not-a-secret'
    clone = policy().model_with_reasoning_override(
        model, PRIMARY, {'authorization': {'model_reasoning_overrides': {PRIMARY: {'level': level}}}}
    )
    messages = [provider_message.Message(role='user', content='hello')]
    for stream in (False, True):
        built = await request._build_completion_args(clone, messages, extra_args={'temperature': 0.7}, stream=stream)
        for key, value in expected.items():
            assert built[key] == value
        assert 'model_reasoning_overrides' not in built
        assert 'reasoning_config_override' not in built
        assert built['temperature'] == 0.7
        assert built.get('stream', False) is stream
    build = AsyncMock(wraps=request._build_completion_args)
    monkeypatch.setattr(request, '_build_completion_args', build)
    # Only the tokenizer is stubbed; count_tokens and completion construction are real.
    monkeypatch.setattr(litellmchat.litellm, 'token_counter', lambda **kwargs: 37)
    assert await request.count_tokens(clone, messages) == 37
    assert build.await_args.args[0] is clone
    assert model.reasoning_config_override is None


@pytest.mark.asyncio
async def test_real_requester_rejects_caller_reasoning_conflicts(monkeypatch):
    from langbot_plugin.api.entities.builtin.provider import message as provider_message

    request = _requester('openai')
    monkeypatch.setattr(request, '_supports_reasoning', lambda _: True)
    monkeypatch.setattr(request, '_safe_model_info', lambda _: {})
    model = _runtime_model(request, name='gpt-5')
    model.provider.token_mgr.get_token = lambda: 'test-only-not-a-secret'
    clone = policy().model_with_reasoning_override(
        model, PRIMARY, {'authorization': {'model_reasoning_overrides': {PRIMARY: {'level': 'high'}}}}
    )
    with pytest.raises(errors.RequesterError, match='conflicts with advanced parameters'):
        await request._build_completion_args(
            clone, [provider_message.Message(role='user', content='hello')], extra_args={'reasoning_effort': 'low'}
        )
