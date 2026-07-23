from __future__ import annotations

import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest

from langbot.pkg.plugin import connector as connector_module
from langbot.pkg.plugin.connector import PluginRuntimeConnector, PluginRuntimeNotConnectedError


def make_connector() -> PluginRuntimeConnector:
    app = SimpleNamespace(
        logger=Mock(),
        instance_config=SimpleNamespace(data={'plugin': {'enable': True}, 'space': {'url': ''}}),
    )
    return PluginRuntimeConnector(app, AsyncMock())


@pytest.mark.asyncio
async def test_ping_plugin_runtime_raises_specific_error_when_not_connected():
    connector = make_connector()

    with pytest.raises(PluginRuntimeNotConnectedError, match='Plugin runtime is not connected'):
        await connector.ping_plugin_runtime()


@pytest.mark.asyncio
async def test_ping_plugin_runtime_delegates_to_connected_handler():
    connector = make_connector()
    connector.handler = SimpleNamespace(ping=AsyncMock(return_value='pong'))

    result = await connector.ping_plugin_runtime()

    assert result == 'pong'
    connector.handler.ping.assert_awaited_once()


@pytest.mark.asyncio
async def test_stop_transport_tolerates_handler_callback_removing_attribute():
    connector = make_connector()

    class Handler:
        async def close(self):
            del connector.handler

    connector.handler = Handler()

    await connector._stop_transport()

    assert not hasattr(connector, 'handler')


@pytest.mark.asyncio
async def test_stdio_runtime_connection_does_not_capture_unconsumed_stderr(
    monkeypatch: pytest.MonkeyPatch,
):
    connector = make_connector()
    created = {}

    class FakeRuntimeHandler:
        def __init__(self, connection, disconnect_callback, ap):
            self.release = asyncio.Event()

        async def ping(self):
            return None

        async def set_runtime_config(self, **kwargs):
            return None

        async def run(self):
            await self.release.wait()

        async def close(self):
            self.release.set()

    class FakeController:
        def __init__(self, **kwargs):
            created.update(kwargs)

        async def run(self, callback):
            await callback(object())

        async def close(self):
            return None

    monkeypatch.setattr(connector_module.platform, 'get_platform', lambda: 'linux')
    monkeypatch.setattr(
        connector_module.platform,
        'use_websocket_to_connect_plugin_runtime',
        lambda: False,
    )
    monkeypatch.setattr(
        connector_module.handler,
        'RuntimeConnectionHandler',
        FakeRuntimeHandler,
    )
    monkeypatch.setattr(
        connector_module.stdio_client_controller,
        'StdioClientController',
        FakeController,
    )

    await connector.initialize()

    assert created['capture_stderr'] is False
    assert connector._connected.is_set()
    await connector.aclose()


@pytest.mark.asyncio
async def test_runtime_disconnect_notifies_once_and_clears_handler(
    monkeypatch: pytest.MonkeyPatch,
):
    disconnect = AsyncMock()
    connector = PluginRuntimeConnector(make_connector().ap, disconnect)

    class FakeRuntimeHandler:
        def __init__(self, connection, disconnect_callback, ap):
            self.disconnect_callback = disconnect_callback

        async def ping(self):
            return None

        async def set_runtime_config(self, **kwargs):
            return None

        async def run(self):
            await self.disconnect_callback(self)

        async def close(self):
            return None

    class FakeController:
        def __init__(self, **kwargs):
            pass

        async def run(self, callback):
            await callback(object())

        async def close(self):
            return None

    monkeypatch.setattr(connector_module.platform, 'get_platform', lambda: 'linux')
    monkeypatch.setattr(
        connector_module.platform,
        'use_websocket_to_connect_plugin_runtime',
        lambda: False,
    )
    monkeypatch.setattr(
        connector_module.handler,
        'RuntimeConnectionHandler',
        FakeRuntimeHandler,
    )
    monkeypatch.setattr(
        connector_module.stdio_client_controller,
        'StdioClientController',
        FakeController,
    )

    await connector.initialize()
    await asyncio.sleep(0)

    disconnect.assert_awaited_once_with(connector)
    assert not hasattr(connector, 'handler')
    await connector.aclose()
