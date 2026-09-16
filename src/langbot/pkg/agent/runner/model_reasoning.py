"""Host-owned, run-scoped reasoning policy for schema-declared model selectors.

This policy is not an SDK resource or a provider kwarg. Only the Host binding
assembler supplies it; model actions consult it after resource authorization.
"""

from __future__ import annotations

import copy
import typing

from ...provider.modelmgr.reasoning import normalize_reasoning_config, validate_reasoning_config
from .config_schema import NONE_SENTINELS, iter_schema_items
from .descriptor import RunnerDescriptor

if typing.TYPE_CHECKING:
    from ...provider.modelmgr.requester import RuntimeLLMModel


ModelReasoningOverrides = dict[str, dict[str, str]]


def extract_model_reasoning_overrides(
    descriptor: RunnerDescriptor,
    runner_config: dict[str, typing.Any],
    resources: typing.Mapping[str, typing.Any],
) -> ModelReasoningOverrides:
    """Normalize explicit UUID-to-level mappings, intersecting selection and grants.

    An absent entry preserves persisted model defaults. Explicit provider_default
    overrides them using the native requester's semantics. Descriptor defaults and
    undeclared config fields cannot silently introduce reasoning overrides.
    """
    authorized = {model.get('model_id') for model in resources.get('models', [])}
    overrides: ModelReasoningOverrides = {}
    for item in iter_schema_items(descriptor, {'model-fallback-selector'}):
        field_name = item.get('name')
        if not isinstance(field_name, str):
            continue
        selection = runner_config.get(field_name)
        if not isinstance(selection, dict) or 'reasoning' not in selection:
            continue
        configured = selection['reasoning']
        if not isinstance(configured, dict):
            raise ValueError('Invalid runner model reasoning configuration')
        candidates = [selection.get('primary')]
        fallbacks = selection.get('fallbacks')
        if isinstance(fallbacks, list):
            candidates.extend(fallbacks)
        selected = {value for value in candidates if isinstance(value, str) and value not in NONE_SENTINELS}
        for model_id, level in configured.items():
            # Validate with Core, but do not echo arbitrary config/secret values.
            try:
                if not isinstance(model_id, str) or not isinstance(level, str):
                    raise ValueError
                config = normalize_reasoning_config({'level': level})
            except (TypeError, ValueError):
                raise ValueError('Invalid runner model reasoning configuration') from None
            if model_id not in selected or model_id not in authorized:
                continue
            if model_id in overrides and overrides[model_id] != config:
                raise ValueError('Conflicting runner model reasoning overrides')
            overrides[model_id] = config
    return overrides


def model_with_reasoning_override(
    model: RuntimeLLMModel,
    model_id: str,
    session: typing.Mapping[str, typing.Any] | None,
) -> RuntimeLLMModel:
    """Clone only the runtime wrapper, after the caller has authorized the model.

    Do not mutate shared model entities or providers. Requesters retain ownership
    of ability/capability validation and provider-specific argument translation.
    """
    if session is None:
        return model
    overrides = session.get('authorization', {}).get('model_reasoning_overrides', {})
    if model_id not in overrides:
        return model
    config = validate_reasoning_config(overrides[model_id], model.model_entity.abilities, model.model_entity.extra_args)
    scoped_model = copy.copy(model)
    scoped_model.reasoning_config_override = copy.deepcopy(config)
    return scoped_model
