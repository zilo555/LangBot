"""Finite adapter acceptance evidence, without message contents or target IDs."""

from __future__ import annotations

from .diagnostic_catalog import catalog


def boundary_fields(module, kind, operation, bound, parent):
    """Only the actual adapter API / EBA conversion boundary counts as a test."""
    entry = next((v for k, v in catalog().items() if k in module.split('.')), None)
    if entry is None or '.platform.adapters.' not in module:
        return {}
    evidence = kind == 'event' and operation == 'platform.target2yiri'
    resolved = operation
    if kind == 'api':
        evidence = True
        if operation == 'call_platform_api':
            action = bound.get('action')
            if isinstance(action, str) and 'platform_api.' + action in entry['specific_apis']:
                resolved = 'platform_api.' + action
            elif action in entry['apis'] and action != 'call_platform_api':
                resolved = action
            else:
                # Keep the generic boundary for investigation, not a false named test.
                evidence = False
        # A forwarding API may call another decorated method. Count the outer call.
        if parent and parent.adapter_api_active:
            evidence = False
    if not evidence:
        return {'_adapter_api_active': kind == 'api'}
    return {
        '_adapter_api_active': kind == 'api',
        'operation': resolved,
        'attributes': {'adapter_evidence': True, **message_scenario(bound)},
    }


def message_scenario(bound):
    """Read typed routing/media categories only; never serialize a payload."""
    from langbot_plugin.api.entities.builtin.platform.events import MessageReceivedEvent
    from langbot_plugin.api.entities.builtin.platform.message import MessageChain

    event = bound.get('event') or bound.get('message_source')
    target = bound.get('target_type') or bound.get('chat_type')
    message = bound.get('message') or bound.get('new_content')
    if isinstance(event, MessageReceivedEvent):
        target = event.chat_type
        message = event.message_chain
    result = {}
    if target is not None:
        target = getattr(target, 'value', target)
        if target == 'private':
            target = 'person'
        result['chat_type'] = target if target in ('person', 'group') else 'unknown'
    if isinstance(message, MessageChain):
        types = set()
        for item in message:
            name = type(item).__name__
            types.add(
                {
                    'Plain': 'text',
                    'Image': 'image',
                    'Voice': 'audio',
                    'Audio': 'audio',
                    'Video': 'video',
                    'File': 'file',
                }.get(name, 'other')
            )
        result['content_type'] = next(iter(types)) if len(types) == 1 else 'mixed' if types else 'unknown'
    return result
