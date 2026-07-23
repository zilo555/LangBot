from __future__ import annotations

import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest

from langbot_plugin.box.client import ActionRPCBoxClient
from langbot.pkg.box import connector as connector_module
from langbot.pkg.box.connector import BoxRuntimeConnector


def make_app(logger: Mock, runtime_endpoint: str = ''):
    return SimpleNamespace(
        logger=logger,
        instance_config=SimpleNamespace(
            data={
                'box': {
                    'backend': 'local',
                    'runtime': {'endpoint': runtime_endpoint},
                    'local': {
                        'profile': 'default',
                        'allowed_mount_roots': [],
                        'default_workspace': '',
                    },
                    'e2b': {'api_key': '', 'api_url': '', 'template': ''},
                }
            }
        ),
    )


def test_box_runtime_connector_stdio_when_no_url(monkeypatch: pytest.MonkeyPatch):
    """Without runtime.endpoint, on a non-Docker Unix platform, use stdio."""
    monkeypatch.setattr('langbot.pkg.utils.platform.get_platform', lambda: 'linux')
    monkeypatch.setattr('langbot.pkg.utils.platform.standalone_box', False)
    connector = BoxRuntimeConnector(make_app(Mock()))

    assert connector._uses_websocket() is False
    assert isinstance(connector.client, ActionRPCBoxClient)


def test_box_runtime_connector_ws_when_url_configured(monkeypatch: pytest.MonkeyPatch):
    """With an explicit runtime.endpoint, always use WebSocket."""
    monkeypatch.setattr('langbot.pkg.utils.platform.get_platform', lambda: 'linux')
    monkeypatch.setattr('langbot.pkg.utils.platform.standalone_box', False)
    logger = Mock()
    connector = BoxRuntimeConnector(make_app(logger, runtime_endpoint='http://box-runtime:5410'))

    assert connector._uses_websocket() is True
    assert isinstance(connector.client, ActionRPCBoxClient)


def test_box_runtime_connector_ws_in_docker(monkeypatch: pytest.MonkeyPatch):
    """Inside Docker (no explicit URL), use WebSocket to reach a sibling container."""
    monkeypatch.setattr('langbot.pkg.utils.platform.get_platform', lambda: 'docker')
    monkeypatch.setattr('langbot.pkg.utils.platform.standalone_box', False)
    connector = BoxRuntimeConnector(make_app(Mock()))

    assert connector._uses_websocket() is True
    assert connector.ws_relay_base_url == 'http://langbot_box:5410'


def test_box_runtime_connector_ws_with_standalone_flag(monkeypatch: pytest.MonkeyPatch):
    """With --standalone-box flag, use WebSocket even on a local Unix platform."""
    monkeypatch.setattr('langbot.pkg.utils.platform.get_platform', lambda: 'linux')
    monkeypatch.setattr('langbot.pkg.utils.platform.standalone_box', True)
    connector = BoxRuntimeConnector(make_app(Mock()))

    assert connector._uses_websocket() is True


def test_box_runtime_connector_ws_relay_url_default(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr('langbot.pkg.utils.platform.get_platform', lambda: 'linux')
    monkeypatch.setattr('langbot.pkg.utils.platform.standalone_box', False)
    connector = BoxRuntimeConnector(make_app(Mock()))

    assert connector.ws_relay_base_url == 'http://127.0.0.1:5410'


def test_box_runtime_connector_ws_relay_url_explicit(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr('langbot.pkg.utils.platform.get_platform', lambda: 'linux')
    monkeypatch.setattr('langbot.pkg.utils.platform.standalone_box', False)
    connector = BoxRuntimeConnector(make_app(Mock(), runtime_endpoint='http://box-runtime:5410'))
    assert connector.ws_relay_base_url == 'http://box-runtime:5410'


def test_box_runtime_connector_dispose_terminates_subprocess(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr('langbot.pkg.utils.platform.get_platform', lambda: 'linux')
    monkeypatch.setattr('langbot.pkg.utils.platform.standalone_box', False)
    logger = Mock()
    connector = BoxRuntimeConnector(make_app(logger))
    subprocess = Mock()
    subprocess.returncode = None
    handler_task = Mock()
    ctrl_task = Mock()
    connector._subprocess = subprocess
    connector._handler_task = handler_task
    connector._ctrl_task = ctrl_task

    connector.dispose()

    subprocess.terminate.assert_called_once()
    handler_task.cancel.assert_called_once()
    ctrl_task.cancel.assert_called_once()
    assert connector._handler_task is None
    assert connector._ctrl_task is None


@pytest.mark.asyncio
async def test_box_runtime_connector_cleans_partial_transport_on_connect_failure(
    monkeypatch: pytest.MonkeyPatch,
):
    monkeypatch.setattr('langbot.pkg.utils.platform.get_platform', lambda: 'linux')
    monkeypatch.setattr('langbot.pkg.utils.platform.standalone_box', False)
    connector = BoxRuntimeConnector(make_app(Mock()))
    connector._start_local_stdio = AsyncMock(side_effect=RuntimeError('bind failed'))
    connector._stop_transport = AsyncMock()
    connector._close_managed_subprocess = AsyncMock()

    with pytest.raises(RuntimeError, match='bind failed'):
        await connector.initialize()

    assert connector._stop_transport.await_count == 2
    connector._close_managed_subprocess.assert_awaited_once()


@pytest.mark.asyncio
async def test_box_stdio_connection_does_not_capture_unconsumed_stderr(
    monkeypatch: pytest.MonkeyPatch,
):
    monkeypatch.setattr('langbot.pkg.utils.platform.get_platform', lambda: 'linux')
    monkeypatch.setattr('langbot.pkg.utils.platform.standalone_box', False)
    created = {}

    class FakeHandler:
        def __init__(self, connection):
            self.release = asyncio.Event()

        async def call_action(self, action, data):
            return None

        async def run(self):
            await self.release.wait()

        async def close(self):
            self.release.set()

    class FakeController:
        def __init__(self, **kwargs):
            created.update(kwargs)
            self.process = SimpleNamespace(returncode=0)

        async def run(self, callback):
            await callback(object())

        async def close(self):
            return None

    monkeypatch.setattr(connector_module, 'Handler', FakeHandler)
    monkeypatch.setattr(
        'langbot_plugin.runtime.io.controllers.stdio.client.StdioClientController',
        FakeController,
    )
    connector = BoxRuntimeConnector(make_app(Mock()))

    await connector.initialize()

    assert created['capture_stderr'] is False
    assert connector._handler is not None
    await connector.aclose()


@pytest.mark.asyncio
async def test_box_disconnect_notifies_once_and_clears_handler(
    monkeypatch: pytest.MonkeyPatch,
):
    monkeypatch.setattr('langbot.pkg.utils.platform.get_platform', lambda: 'linux')
    monkeypatch.setattr('langbot.pkg.utils.platform.standalone_box', False)
    disconnect = AsyncMock()

    class FakeHandler:
        def __init__(self, connection):
            pass

        async def call_action(self, action, data):
            return None

        async def run(self):
            return None

        async def close(self):
            return None

    class FakeController:
        def __init__(self, **kwargs):
            self.process = SimpleNamespace(returncode=0)

        async def run(self, callback):
            await callback(object())

        async def close(self):
            return None

    monkeypatch.setattr(connector_module, 'Handler', FakeHandler)
    monkeypatch.setattr(
        'langbot_plugin.runtime.io.controllers.stdio.client.StdioClientController',
        FakeController,
    )
    connector = BoxRuntimeConnector(make_app(Mock()), runtime_disconnect_callback=disconnect)

    await connector.initialize()
    await asyncio.sleep(0)

    disconnect.assert_awaited_once_with(connector)
    assert connector._handler is None
    await connector.aclose()
