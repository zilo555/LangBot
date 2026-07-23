# For connect to plugin runtime.
from __future__ import annotations

import asyncio
import contextlib
import io
import time
import zipfile
from typing import Any
import typing
import os
import sys
import httpx
import sqlalchemy
import yaml
from async_lru import alru_cache
from langbot_plugin.api.entities.builtin.pipeline.query import provider_session

from ..core import app
from . import handler
from ..utils import platform
from ..utils.managed_runtime import ManagedRuntimeConnector
from langbot_plugin.runtime.io.controllers.stdio import (
    client as stdio_client_controller,
)
from langbot_plugin.runtime.io.controllers.ws import client as ws_client_controller
from langbot_plugin.api.entities import events
from langbot_plugin.api.entities import context
import langbot_plugin.runtime.io.connection as base_connection
from langbot_plugin.api.definition.components.manifest import ComponentManifest
from langbot_plugin.api.entities.builtin.command import (
    context as command_context,
    errors as command_errors,
)
from langbot_plugin.runtime.plugin.mgr import PluginInstallSource
from ..core import taskmgr
from ..entity.persistence import plugin as persistence_plugin


_CONNECT_TIMEOUT_SEC = 30.0
_HEARTBEAT_INTERVAL_SEC = 20.0
_HEARTBEAT_FAILURE_THRESHOLD = 3
_RECONNECT_MAX_DELAY_SEC = 60.0


class PluginRuntimeNotConnectedError(RuntimeError):
    """Raised when plugin runtime operations are requested before connection."""


class PluginRuntimeConnector(ManagedRuntimeConnector):
    """Plugin runtime connector"""

    handler: handler.RuntimeConnectionHandler

    handler_task: asyncio.Task

    heartbeat_task: asyncio.Task | None = None

    stdio_client_controller: stdio_client_controller.StdioClientController

    ctrl: stdio_client_controller.StdioClientController | ws_client_controller.WebSocketClientController

    runtime_disconnect_callback: typing.Callable[
        [PluginRuntimeConnector], typing.Coroutine[typing.Any, typing.Any, None]
    ]

    is_enable_plugin: bool = True
    """Mark if the plugin system is enabled"""

    def __init__(
        self,
        ap: app.Application,
        runtime_disconnect_callback: typing.Callable[
            [PluginRuntimeConnector], typing.Coroutine[typing.Any, typing.Any, None]
        ],
    ):
        super().__init__(ap)
        self.runtime_disconnect_callback = runtime_disconnect_callback
        self.is_enable_plugin = self.ap.instance_config.data.get('plugin', {}).get('enable', True)
        self._transport_task: asyncio.Task | None = None
        self._reconnect_task: asyncio.Task | None = None
        self._generation = 0
        self._connected = asyncio.Event()

    def _runtime_handler(self) -> handler.RuntimeConnectionHandler:
        runtime_handler = getattr(self, 'handler', None)
        if runtime_handler is None:
            raise PluginRuntimeNotConnectedError('Plugin runtime is not connected')
        return runtime_handler

    def _runtime_available(self) -> bool:
        runtime_handler = getattr(self, 'handler', None)
        if runtime_handler is None:
            return False
        # Unit-level and explicitly injected handlers don't own a transport.
        # A managed transport must also have completed its handshake.
        return self._transport_task is None or self._connected.is_set()

    async def heartbeat_loop(self):
        failures = 0
        while not self._closing:
            await asyncio.sleep(_HEARTBEAT_INTERVAL_SEC)
            try:
                await self.ping_plugin_runtime()
                failures = 0
                self.ap.logger.debug('Heartbeat to plugin runtime success.')
            except Exception as e:
                failures += 1
                self.ap.logger.warning(
                    f'Plugin runtime heartbeat failed ({failures}/{_HEARTBEAT_FAILURE_THRESHOLD}): {e}'
                )
                if failures >= _HEARTBEAT_FAILURE_THRESHOLD:
                    self._connected.clear()
                    self.schedule_reconnect()
                    failures = 0

    async def initialize(self):
        if not self.is_enable_plugin:
            self.ap.logger.info('Plugin system is disabled.')
            return

        async with self._lifecycle_lock:
            if self._closing:
                raise PluginRuntimeNotConnectedError('Plugin runtime connector is shutting down')
            if self._connected.is_set() and hasattr(self, 'handler'):
                return

            self._generation += 1
            generation = self._generation
            await self._stop_transport()
            self._connected = asyncio.Event()
            connect_errors: list[Exception] = []

            async def new_connection_callback(
                connection: base_connection.Connection,
            ):
                if generation != self._generation or self._closing:
                    await connection.close()
                    return
                connection_ready = False
                disconnect_notified = False

                async def notify_disconnect() -> None:
                    nonlocal disconnect_notified
                    if (
                        connection_ready
                        and not disconnect_notified
                        and generation == self._generation
                        and not self._closing
                    ):
                        disconnect_notified = True
                        self._connected.clear()
                        await self.runtime_disconnect_callback(self)

                async def disconnect_callback(
                    rchandler: handler.RuntimeConnectionHandler,
                ) -> bool:
                    await notify_disconnect()
                    return False

                runtime_handler = handler.RuntimeConnectionHandler(connection, disconnect_callback, self.ap)
                self.handler = runtime_handler
                self.handler_task = asyncio.create_task(runtime_handler.run())
                try:
                    await runtime_handler.ping()
                    space_url = self.ap.instance_config.data.get('space', {}).get('url', '').rstrip('/')
                    if space_url:
                        await runtime_handler.set_runtime_config(cloud_service_url=space_url)
                    if generation == self._generation and not self._closing:
                        connection_ready = True
                        self._connected.set()
                        self.ap.logger.info('Connected to plugin runtime.')
                    await self.handler_task
                except asyncio.CancelledError:
                    raise
                except Exception as exc:
                    if not self._connected.is_set():
                        connect_errors.append(exc)
                        self._connected.set()
                finally:
                    if generation == self._generation and not self._closing:
                        self._connected.clear()
                        if getattr(self, 'handler', None) is runtime_handler:
                            del self.handler
                        await notify_disconnect()

            task_coro: typing.Coroutine
            if platform.get_platform() == 'docker' or platform.use_websocket_to_connect_plugin_runtime():
                ws_url = self.ap.instance_config.data.get('plugin', {}).get(
                    'runtime_ws_url',
                    'ws://langbot_plugin_runtime:5400/control/ws',
                )

                async def connection_failed(ctrl, exc=None):
                    error = exc or RuntimeError('WebSocket connection failed')
                    connect_errors.append(error)
                    self._connected.set()

                self.ctrl = ws_client_controller.WebSocketClientController(
                    ws_url=ws_url,
                    make_connection_failed_callback=connection_failed,
                )
                task_coro = self.ctrl.run(new_connection_callback)
            elif platform.get_platform() == 'win32':
                await self._start_runtime_subprocess('-m', 'langbot_plugin.cli.__init__', 'rt')
                ws_url = 'ws://localhost:5400/control/ws'

                async def connection_failed(ctrl, exc=None):
                    error = exc or RuntimeError('WebSocket connection failed')
                    connect_errors.append(error)
                    self._connected.set()

                self.ctrl = ws_client_controller.WebSocketClientController(
                    ws_url=ws_url,
                    make_connection_failed_callback=connection_failed,
                )
                task_coro = self.ctrl.run(new_connection_callback)
            else:
                self.ctrl = stdio_client_controller.StdioClientController(
                    command=sys.executable,
                    args=['-m', 'langbot_plugin.cli.__init__', 'rt', '-s'],
                    env=os.environ.copy(),
                    capture_stderr=False,
                )
                task_coro = self.ctrl.run(new_connection_callback)

            self._transport_task = asyncio.create_task(task_coro)
            try:
                await asyncio.wait_for(self._connected.wait(), timeout=_CONNECT_TIMEOUT_SEC)
            except asyncio.TimeoutError as exc:
                await self._stop_transport()
                raise PluginRuntimeNotConnectedError('Plugin runtime did not become ready within 30 seconds') from exc
            if connect_errors:
                await self._stop_transport()
                raise PluginRuntimeNotConnectedError(f'Plugin runtime connection failed: {connect_errors[-1]}')

            if self.heartbeat_task is None or self.heartbeat_task.done():
                self.heartbeat_task = asyncio.create_task(self.heartbeat_loop())

    def schedule_reconnect(self) -> None:
        if self._closing or not self.is_enable_plugin:
            return
        if self._reconnect_task is not None and not self._reconnect_task.done():
            return
        self._reconnect_task = asyncio.create_task(self._reconnect_loop())

    async def _reconnect_loop(self) -> None:
        delay = 1.0
        try:
            while not self._closing:
                try:
                    await self.initialize()
                    return
                except Exception as exc:
                    self.ap.logger.warning(f'Plugin runtime reconnection failed: {exc}; retrying in {delay:.0f}s')
                    await asyncio.sleep(delay)
                    delay = min(delay * 2, _RECONNECT_MAX_DELAY_SEC)
        finally:
            self._reconnect_task = None

    async def _stop_transport(self) -> None:
        self._connected.clear()
        runtime_handler = getattr(self, 'handler', None)
        if runtime_handler is not None:
            with contextlib.suppress(Exception):
                await runtime_handler.close()
            if getattr(self, 'handler', None) is runtime_handler:
                del self.handler
        tasks = [
            task
            for task in (
                getattr(self, 'handler_task', None),
                self._transport_task,
            )
            if task is not None and task is not asyncio.current_task()
        ]
        for task in tasks:
            task.cancel()
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
        self._transport_task = None
        if hasattr(self, 'handler_task'):
            del self.handler_task
        close_ctrl = getattr(getattr(self, 'ctrl', None), 'close', None)
        if close_ctrl is not None:
            with contextlib.suppress(Exception):
                await close_ctrl()

    async def aclose(self) -> None:
        self._closing = True
        self._generation += 1
        reconnect_task = self._reconnect_task
        self._reconnect_task = None
        if reconnect_task is not None and reconnect_task is not asyncio.current_task():
            reconnect_task.cancel()
            await asyncio.gather(reconnect_task, return_exceptions=True)
        if self.heartbeat_task is not None:
            self.heartbeat_task.cancel()
            await asyncio.gather(self.heartbeat_task, return_exceptions=True)
            self.heartbeat_task = None
        await self._stop_transport()
        await self._close_managed_subprocess()

    async def initialize_plugins(self):
        pass

    async def ping_plugin_runtime(self):
        return await self._runtime_handler().ping()

    def _inspect_plugin_package(
        self,
        file_bytes: bytes,
        task_context: taskmgr.TaskContext | None,
    ) -> tuple[str | None, str | None]:
        """Extract plugin identity and dependency metadata from a plugin package."""
        plugin_author = None
        plugin_name = None

        try:
            with zipfile.ZipFile(io.BytesIO(file_bytes)) as zf:
                try:
                    manifest = yaml.safe_load(zf.read('manifest.yaml').decode('utf-8', errors='ignore')) or {}
                    metadata = manifest.get('metadata', {})
                    plugin_author = metadata.get('author')
                    plugin_name = metadata.get('name')
                except Exception:
                    pass

                if task_context is not None:
                    for name in zf.namelist():
                        if name.endswith('requirements.txt'):
                            content = zf.read(name).decode('utf-8', errors='ignore')
                            deps = [
                                line.strip()
                                for line in content.splitlines()
                                if line.strip() and not line.strip().startswith('#')
                            ]
                            task_context.metadata['deps_total'] = len(deps)
                            task_context.metadata['deps_list'] = deps
                            break
        except Exception:
            pass

        return plugin_author, plugin_name

    async def _install_mcp_from_marketplace(
        self,
        mcp_data: dict[str, Any],
        task_context: taskmgr.TaskContext | None = None,
    ):
        """Install an MCP server from marketplace data.

        Marketplace MCP records carry the runtime-ready ``mode`` and
        ``extra_args`` directly (the same shape LangBot stores in
        ``mcp_servers``), so they are used as-is rather than reconstructed.
        For ``stdio`` this preserves ``command``/``args``/``env``/``box``;
        for ``http``/``sse`` it preserves ``url``/``headers``/``timeout``/
        ``ssereadtimeout``.
        """
        from ..entity.persistence import mcp as persistence_mcp
        import uuid

        mode = mcp_data.get('mode') or 'stdio'
        extra_args = mcp_data.get('extra_args') or {}
        # The MCP transport selection was simplified to two modes: 'stdio'
        # (local, Box-sandboxed) and 'remote' (the runtime auto-detects
        # Streamable HTTP vs. legacy SSE from the URL). Marketplace records may
        # still carry the older 'http'/'sse' modes — normalize them to 'remote'
        # so the installed server shows up correctly in the two-option UI. The
        # connection args (url/headers/timeout/ssereadtimeout) are preserved and
        # consumed by the auto-detecting remote transport regardless.
        if mode in ('http', 'sse'):
            mode = 'remote'
        # Marketplace records carry the rendered README markdown; persist it so
        # the detail page Docs tab works offline and without a marketplace round-trip.
        readme = mcp_data.get('readme') or ''
        # Use __ instead of / to avoid URL routing issues with slashes
        name = f'{mcp_data.get("author", "")}__{mcp_data.get("name", "")}'

        # Check if MCP server already exists
        existing = await self.ap.persistence_mgr.execute_async(
            sqlalchemy.select(persistence_mcp.MCPServer).where(persistence_mcp.MCPServer.name == name)
        )
        if existing.scalar_one_or_none():
            self.ap.logger.info(f'MCP server {name} already exists, skipping installation')
            return

        # Create MCP server record
        server_uuid = str(uuid.uuid4())
        server_data = {
            'uuid': server_uuid,
            'name': name,
            'enable': True,
            'mode': mode,
            'extra_args': extra_args,
            'readme': readme,
        }

        await self.ap.persistence_mgr.execute_async(sqlalchemy.insert(persistence_mcp.MCPServer).values(server_data))

        # Start the MCP server
        result = await self.ap.persistence_mgr.execute_async(
            sqlalchemy.select(persistence_mcp.MCPServer).where(persistence_mcp.MCPServer.uuid == server_uuid)
        )
        server_entity = result.first()
        if server_entity:
            server_config = self.ap.persistence_mgr.serialize_model(persistence_mcp.MCPServer, server_entity)
            if self.ap.tool_mgr.mcp_tool_loader:
                mcp_task = asyncio.create_task(self.ap.tool_mgr.mcp_tool_loader.host_mcp_server(server_config))
                self.ap.tool_mgr.mcp_tool_loader._hosted_mcp_tasks.append(mcp_task)

        self.ap.logger.info(f'Installed MCP server {name} from marketplace')

    async def _install_skill_from_zip(
        self,
        file_bytes: bytes,
        filename: str,
        task_context: taskmgr.TaskContext | None = None,
    ):
        """Install a skill from marketplace ZIP data."""
        from ..api.http.service.skill import SkillService

        skill_service = SkillService(self.ap)

        self.ap.logger.info(f'Installing skill from marketplace ZIP ({len(file_bytes)} bytes)')

        # Install from ZIP using skill service
        result = await skill_service.install_from_zip_upload(
            file_bytes=file_bytes,
            filename=filename + '.zip',
        )
        self.ap.logger.info(f'Skill installed successfully: {result}')

    def _build_plugin_startup_failure_message(
        self,
        plugin_author: str,
        plugin_name: str,
        task_context: taskmgr.TaskContext | None,
    ) -> str:
        dep_hint = ''
        if task_context is not None:
            current_dep = task_context.metadata.get('current_dep')
            if current_dep:
                dep_hint = f' Last dependency: {current_dep}.'

        return (
            f'Plugin {plugin_author}/{plugin_name} failed to start after installation. '
            f'Dependency installation or plugin initialization may have failed.{dep_hint} '
            f'Please check the plugin requirements and runtime logs.'
        )

    async def _wait_for_installed_plugin_ready(
        self,
        plugin_author: str | None,
        plugin_name: str | None,
        task_context: taskmgr.TaskContext | None,
        timeout: float = 30,
    ):
        """Wait until the installed plugin is registered by the runtime.

        The plugin runtime launches plugins asynchronously. If dependency installation
        fails, the plugin process exits before registration; without this check the
        install task can incorrectly finish successfully.
        """
        if not plugin_author or not plugin_name:
            return

        deadline = time.time() + timeout
        last_error: Exception | None = None
        while time.time() < deadline:
            try:
                plugin = await self.get_plugin_info(plugin_author, plugin_name)
                if plugin is not None:
                    status = plugin.get('status')
                    if status == 'initialized':
                        return
            except Exception as e:
                last_error = e

            await asyncio.sleep(0.5)

        message = self._build_plugin_startup_failure_message(plugin_author, plugin_name, task_context)
        if last_error is not None:
            message = f'{message} Last runtime error: {last_error}'
        raise RuntimeError(message)

    async def install_plugin(
        self,
        install_source: PluginInstallSource,
        install_info: dict[str, Any],
        task_context: taskmgr.TaskContext | None = None,
    ):
        plugin_author = install_info.get('plugin_author')
        plugin_name = install_info.get('plugin_name')

        if install_source == PluginInstallSource.MARKETPLACE:
            # Handle marketplace plugin/mcp/skill installation
            plugin_author = install_info.get('plugin_author', '')
            plugin_name = install_info.get('plugin_name', '')
            space_url = (
                self.ap.instance_config.data.get('space', {}).get('url', 'https://space.langbot.app').rstrip('/')
            )

            # Try MCP endpoint first
            async with httpx.AsyncClient(trust_env=True, timeout=15) as client:
                mcp_resp = await client.get(f'{space_url}/api/v1/marketplace/mcps/{plugin_author}/{plugin_name}')
                if mcp_resp.status_code == 200:
                    mcp_data = mcp_resp.json().get('data', {}).get('mcp', {})
                    if mcp_data.get('mode'):
                        # It's an MCP - create server locally
                        self.ap.logger.info(f'Installing MCP from marketplace: {plugin_author}/{plugin_name}')
                        if task_context:
                            task_context.set_current_action('installing mcp server')
                        await self._install_mcp_from_marketplace(mcp_data, task_context)
                        # Best-effort install report (bumps marketplace install_count).
                        try:
                            await client.post(
                                f'{space_url}/api/v1/marketplace/mcps/{plugin_author}/{plugin_name}/install'
                            )
                        except Exception as report_err:
                            self.ap.logger.debug(f'Failed to report MCP install: {report_err}')
                        return
                    else:
                        raise Exception(f'MCP {plugin_author}/{plugin_name} has no mode')
                elif mcp_resp.status_code == 404:
                    # Try skill endpoint - download ZIP and install
                    self.ap.logger.info(f'Trying skill endpoint for: {plugin_author}/{plugin_name}')
                    if task_context:
                        task_context.set_current_action('checking skill marketplace')

                    # Get skill detail to find version
                    skill_resp = await client.get(
                        f'{space_url}/api/v1/marketplace/skills/{plugin_author}/{plugin_name}'
                    )
                    if skill_resp.status_code == 200:
                        self.ap.logger.info(f'Installing skill from marketplace: {plugin_author}/{plugin_name}')
                        if task_context:
                            task_context.set_current_action('installing skill from marketplace')

                        # Download the skill ZIP (no version needed - uses latest)
                        if task_context:
                            task_context.set_current_action('downloading skill package')

                        download_resp = await client.get(
                            f'{space_url}/api/v1/marketplace/skills/download/{plugin_author}/{plugin_name}'
                        )
                        if download_resp.status_code != 200:
                            raise Exception(
                                f'Failed to download skill {plugin_author}/{plugin_name}: {download_resp.status_code}'
                            )

                        file_bytes = download_resp.content
                        file_size = len(file_bytes)
                        self.ap.logger.info(f'Downloaded skill ZIP ({file_size} bytes)')

                        # Install skill from ZIP using skill service
                        await self._install_skill_from_zip(file_bytes, f'{plugin_author}-{plugin_name}', task_context)
                        return
                    elif skill_resp.status_code == 404:
                        # Try plugin endpoint - get versions and download
                        self.ap.logger.info(f'Trying plugin endpoint for: {plugin_author}/{plugin_name}')
                        if task_context:
                            task_context.set_current_action('checking plugin marketplace')

                        # Get plugin versions to find latest
                        versions_resp = await client.get(
                            f'{space_url}/api/v1/marketplace/plugins/{plugin_author}/{plugin_name}/versions'
                        )
                        if versions_resp.status_code == 200:
                            versions_data = versions_resp.json().get('data', {}).get('versions', [])
                            if versions_data:
                                latest_version = versions_data[0].get('version', '')
                                if latest_version:
                                    self.ap.logger.info(
                                        f'Installing plugin from marketplace: {plugin_author}/{plugin_name} v{latest_version}'
                                    )
                                    if task_context:
                                        task_context.set_current_action('downloading plugin package')

                                    download_resp = await client.get(
                                        f'{space_url}/api/v1/marketplace/plugins/download/{plugin_author}/{plugin_name}/{latest_version}'
                                    )
                                    if download_resp.status_code != 200:
                                        raise Exception(
                                            f'Failed to download plugin {plugin_author}/{plugin_name}: {download_resp.status_code}'
                                        )

                                    file_bytes = download_resp.content
                                    self._inspect_plugin_package(file_bytes, task_context)
                                    file_key = await self._runtime_handler().send_file(file_bytes, 'lbpkg')
                                    install_info['plugin_file_key'] = file_key
                                    self.ap.logger.info(f'Transfered file {file_key} to plugin runtime')
                                    # Continue to install via runtime
                                else:
                                    raise Exception(f'No version found for plugin {plugin_author}/{plugin_name}')
                            else:
                                raise Exception(f'Plugin {plugin_author}/{plugin_name} has no versions')
                        else:
                            raise Exception(f'Plugin {plugin_author}/{plugin_name} not found in marketplace')
                    else:
                        skill_resp.raise_for_status()
                        raise Exception(f'Failed to get skill {plugin_author}/{plugin_name}')
                else:
                    mcp_resp.raise_for_status()
                    raise Exception(f'Failed to get MCP {plugin_author}/{plugin_name}')

        if install_source == PluginInstallSource.LOCAL:
            # transfer file before install
            file_bytes = install_info['plugin_file']
            plugin_author, plugin_name = self._inspect_plugin_package(file_bytes, task_context)
            if task_context is not None and plugin_author and plugin_name:
                task_context.metadata['plugin_name'] = f'{plugin_author}/{plugin_name}'
            file_key = await self._runtime_handler().send_file(file_bytes, 'lbpkg')
            install_info['plugin_file_key'] = file_key
            del install_info['plugin_file']
            self.ap.logger.info(f'Transfered file {file_key} to plugin runtime')
        elif install_source == PluginInstallSource.GITHUB:
            # download and transfer file with streaming progress
            try:
                async with httpx.AsyncClient(
                    trust_env=True,
                    follow_redirects=True,
                    timeout=60,
                ) as client:
                    async with client.stream('GET', install_info['asset_url']) as response:
                        response.raise_for_status()
                        total = int(response.headers.get('content-length', 0))
                        downloaded = 0
                        chunks: list[bytes] = []
                        start_time = time.time()

                        if task_context is not None:
                            task_context.set_current_action('downloading plugin package')
                            task_context.metadata['download_total'] = total
                            task_context.metadata['download_current'] = 0
                            task_context.metadata['download_speed'] = 0

                        async for chunk in response.aiter_bytes(chunk_size=8192):
                            chunks.append(chunk)
                            downloaded += len(chunk)

                            if task_context is not None:
                                elapsed = time.time() - start_time
                                task_context.metadata['download_current'] = downloaded
                                task_context.metadata['download_total'] = total
                                task_context.metadata['download_speed'] = downloaded / elapsed if elapsed > 0 else 0

                    file_bytes = b''.join(chunks)
                    plugin_author, plugin_name = self._inspect_plugin_package(file_bytes, task_context)
                    if task_context is not None and plugin_author and plugin_name:
                        task_context.metadata['plugin_name'] = f'{plugin_author}/{plugin_name}'
                    file_key = await self._runtime_handler().send_file(file_bytes, 'lbpkg')
                    install_info['plugin_file_key'] = file_key
                    self.ap.logger.info(f'Transfered file {file_key} to plugin runtime')
            except Exception as e:
                self.ap.logger.error(f'Failed to download file from GitHub: {e}')
                raise Exception(f'Failed to download file from GitHub: {e}')

        async for ret in self._runtime_handler().install_plugin(install_source.value, install_info):
            current_action = ret.get('current_action', None)
            if current_action is not None:
                if task_context is not None:
                    task_context.set_current_action(current_action)

            trace = ret.get('trace', None)
            if trace is not None:
                if task_context is not None:
                    task_context.trace(trace)

            # Forward structured metadata from runtime
            metadata = ret.get('metadata', None)
            if metadata is not None and task_context is not None:
                task_context.metadata.update(metadata)

        await self._wait_for_installed_plugin_ready(plugin_author, plugin_name, task_context)

    async def upgrade_plugin(
        self,
        plugin_author: str,
        plugin_name: str,
        task_context: taskmgr.TaskContext | None = None,
    ) -> dict[str, Any]:
        async for ret in self._runtime_handler().upgrade_plugin(plugin_author, plugin_name):
            current_action = ret.get('current_action', None)
            if current_action is not None:
                if task_context is not None:
                    task_context.set_current_action(current_action)

            trace = ret.get('trace', None)
            if trace is not None:
                if task_context is not None:
                    task_context.trace(trace)

    async def delete_plugin(
        self,
        plugin_author: str,
        plugin_name: str,
        delete_data: bool = False,
        task_context: taskmgr.TaskContext | None = None,
    ) -> dict[str, Any]:
        async for ret in self._runtime_handler().delete_plugin(plugin_author, plugin_name):
            current_action = ret.get('current_action', None)
            if current_action is not None:
                if task_context is not None:
                    task_context.set_current_action(current_action)

            trace = ret.get('trace', None)
            if trace is not None:
                if task_context is not None:
                    task_context.trace(trace)

        # Clean up plugin settings and binary storage if requested
        if delete_data:
            if task_context is not None:
                task_context.trace('Cleaning up plugin configuration and storage...')
            await self._runtime_handler().cleanup_plugin_data(plugin_author, plugin_name)

    async def list_plugins(self, component_kinds: list[str] | None = None) -> list[dict[str, Any]]:
        """List plugins, optionally filtered by component kinds.

        Args:
            component_kinds: Optional list of component kinds to filter by.
                           If provided, only plugins that contain at least one
                           component of the specified kinds will be returned.
                           E.g., ['Command', 'EventListener', 'Tool'] for pipeline-related plugins.
        """
        if not self.is_enable_plugin or not self._runtime_available():
            return []

        plugins = await self._runtime_handler().list_plugins()

        # Filter plugins by component kinds if specified
        if component_kinds is not None:
            filtered_plugins = []
            for plugin in plugins:
                components = plugin.get('components', [])
                has_matching_component = False
                for component in components:
                    component_kind = component.get('manifest', {}).get('manifest', {}).get('kind', '')
                    if component_kind in component_kinds:
                        has_matching_component = True
                        break
                if has_matching_component:
                    filtered_plugins.append(plugin)
            plugins = filtered_plugins

        # Sort plugins: debug plugins first, then by installation time (newest first)
        # Get installation timestamps from database in a single query
        plugin_timestamps = {}

        if plugins:
            # Build list of (author, name) tuples for all plugins
            plugin_ids = []
            for plugin in plugins:
                author = plugin.get('manifest', {}).get('manifest', {}).get('metadata', {}).get('author', '')
                name = plugin.get('manifest', {}).get('manifest', {}).get('metadata', {}).get('name', '')
                if author and name:
                    plugin_ids.append((author, name))

            # Fetch all timestamps in a single query using OR conditions
            if plugin_ids:
                conditions = [
                    sqlalchemy.and_(
                        persistence_plugin.PluginSetting.plugin_author == author,
                        persistence_plugin.PluginSetting.plugin_name == name,
                    )
                    for author, name in plugin_ids
                ]

                result = await self.ap.persistence_mgr.execute_async(
                    sqlalchemy.select(
                        persistence_plugin.PluginSetting.plugin_author,
                        persistence_plugin.PluginSetting.plugin_name,
                        persistence_plugin.PluginSetting.created_at,
                    ).where(sqlalchemy.or_(*conditions))
                )

                for row in result:
                    plugin_id = f'{row.plugin_author}/{row.plugin_name}'
                    plugin_timestamps[plugin_id] = row.created_at

        # Sort: debug plugins first (descending), then by created_at (descending)
        def sort_key(plugin):
            author = plugin.get('manifest', {}).get('manifest', {}).get('metadata', {}).get('author', '')
            name = plugin.get('manifest', {}).get('manifest', {}).get('metadata', {}).get('name', '')
            plugin_id = f'{author}/{name}'

            is_debug = plugin.get('debug', False)
            created_at = plugin_timestamps.get(plugin_id)

            # Return tuple: (not is_debug, -timestamp)
            # not is_debug: False (0) for debug plugins, True (1) for non-debug
            # -timestamp: to sort newest first (will be None for plugins without timestamp)
            timestamp_value = -created_at.timestamp() if created_at else 0
            return (not is_debug, timestamp_value)

        plugins.sort(key=sort_key)

        return plugins

    async def get_plugin_info(self, author: str, plugin_name: str) -> dict[str, Any]:
        return await self._runtime_handler().get_plugin_info(author, plugin_name)

    async def set_plugin_config(self, plugin_author: str, plugin_name: str, config: dict[str, Any]) -> dict[str, Any]:
        return await self._runtime_handler().set_plugin_config(plugin_author, plugin_name, config)

    @alru_cache(ttl=5 * 60)  # 5 minutes
    async def get_plugin_icon(self, plugin_author: str, plugin_name: str) -> dict[str, Any]:
        return await self._runtime_handler().get_plugin_icon(plugin_author, plugin_name)

    @alru_cache(ttl=5 * 60)  # 5 minutes
    async def get_plugin_readme(self, plugin_author: str, plugin_name: str, language: str = 'en') -> str:
        return await self._runtime_handler().get_plugin_readme(plugin_author, plugin_name, language)

    async def get_plugin_logs(
        self,
        plugin_author: str,
        plugin_name: str,
        limit: int = 200,
        level: str | None = None,
    ) -> list[dict[str, Any]]:
        # Not cached: logs are live and change constantly.
        return await self._runtime_handler().get_plugin_logs(plugin_author, plugin_name, limit, level)

    @alru_cache(ttl=5 * 60)
    async def get_plugin_assets(self, plugin_author: str, plugin_name: str, filepath: str) -> dict[str, Any]:
        return await self._runtime_handler().get_plugin_assets(plugin_author, plugin_name, filepath)

    async def handle_page_api(
        self,
        plugin_author: str,
        plugin_name: str,
        page_id: str,
        endpoint: str,
        method: str,
        body: Any = None,
    ) -> dict[str, Any]:
        return await self._runtime_handler().handle_page_api(
            plugin_author, plugin_name, page_id, endpoint, method, body
        )

    async def get_debug_info(self) -> dict[str, Any]:
        """Get debug information including debug key and WS URL"""
        if not self.is_enable_plugin or not self._runtime_available():
            return {}
        return await self._runtime_handler().get_debug_info()

    async def emit_event(
        self,
        event: events.BaseEventModel,
        bound_plugins: list[str] | None = None,
    ) -> context.EventContext:
        event_ctx = context.EventContext.from_event(event)

        if not self.is_enable_plugin or not self._runtime_available():
            event_ctx._emitted_plugins = []
            event_ctx._response_sources = []
            return event_ctx

        # Pass include_plugins to runtime for filtering
        event_ctx_result = await self._runtime_handler().emit_event(
            event_ctx.model_dump(serialize_as_any=False), include_plugins=bound_plugins
        )

        event_ctx = context.EventContext.model_validate(event_ctx_result['event_context'])
        event_ctx._emitted_plugins = event_ctx_result.get('emitted_plugins', [])
        if 'response_sources' in event_ctx_result:
            event_ctx._response_sources = event_ctx_result['response_sources']

        return event_ctx

    async def notify_plugin_diagnostic(self, diagnostic: dict[str, Any]) -> None:
        """Best-effort diagnostic forwarding to the plugin runtime."""
        if not self.is_enable_plugin or not self._runtime_available():
            return
        try:
            await self._runtime_handler().notify_plugin_diagnostic(diagnostic)
        except Exception as e:
            self.ap.logger.debug(f'Plugin diagnostic forwarding skipped: {e}')

    async def list_tools(self, bound_plugins: list[str] | None = None) -> list[ComponentManifest]:
        if not self.is_enable_plugin or not self._runtime_available():
            return []

        # Pass include_plugins to runtime for filtering
        list_tools_data = await self._runtime_handler().list_tools(include_plugins=bound_plugins)

        tools = [ComponentManifest.model_validate(tool) for tool in list_tools_data]

        return tools

    async def call_tool(
        self,
        tool_name: str,
        parameters: dict[str, Any],
        session: provider_session.Session,
        query_id: int,
        bound_plugins: list[str] | None = None,
    ) -> dict[str, Any]:
        if not self.is_enable_plugin:
            return {'error': 'Tool not found: plugin system is disabled'}

        # Pass include_plugins to runtime for validation
        if not self._runtime_available():
            return {'error': 'Plugin runtime is temporarily unavailable'}

        return await self._runtime_handler().call_tool(
            tool_name, parameters, session.model_dump(serialize_as_any=True), query_id, include_plugins=bound_plugins
        )

    async def list_commands(self, bound_plugins: list[str] | None = None) -> list[ComponentManifest]:
        if not self.is_enable_plugin or not self._runtime_available():
            return []

        # Pass include_plugins to runtime for filtering
        list_commands_data = await self._runtime_handler().list_commands(include_plugins=bound_plugins)

        commands = [ComponentManifest.model_validate(command) for command in list_commands_data]

        return commands

    async def execute_command(
        self, command_ctx: command_context.ExecuteContext, bound_plugins: list[str] | None = None
    ) -> typing.AsyncGenerator[command_context.CommandReturn, None]:
        if not self.is_enable_plugin or not self._runtime_available():
            yield command_context.CommandReturn(error=command_errors.CommandNotFoundError(command_ctx.command))
            return

        # Pass include_plugins to runtime for validation
        gen = self._runtime_handler().execute_command(
            command_ctx.model_dump(serialize_as_any=True),
            include_plugins=bound_plugins,
        )

        async for ret in gen:
            cmd_ret = command_context.CommandReturn.model_validate(ret)

            yield cmd_ret

    async def retrieve_knowledge(
        self,
        plugin_author: str,
        plugin_name: str,
        retriever_name: str,
        retrieval_context: dict[str, Any],
    ) -> dict[str, Any]:
        """Retrieve knowledge using a KnowledgeEngine instance."""
        if not self.is_enable_plugin or not self._runtime_available():
            return {'results': []}

        return await self._runtime_handler().retrieve_knowledge(
            plugin_author, plugin_name, retriever_name, retrieval_context
        )

    def dispose(self):
        """Best-effort synchronous compatibility wrapper; prefer ``aclose``."""
        self._closing = True
        if self.heartbeat_task is not None:
            self.heartbeat_task.cancel()
            self.heartbeat_task = None
        if self._reconnect_task is not None:
            self._reconnect_task.cancel()
            self._reconnect_task = None
        for task in (
            getattr(self, 'handler_task', None),
            self._transport_task,
        ):
            if task is not None:
                task.cancel()
        ctrl = getattr(self, 'ctrl', None)
        process = getattr(ctrl, 'process', None)
        if process is not None and process.returncode is None:
            process.terminate()
        self._dispose_subprocess()

    @staticmethod
    def _parse_plugin_id(plugin_id: str) -> tuple[str, str]:
        """Parse a plugin ID string into (author, name).

        Args:
            plugin_id: Plugin ID in 'author/name' format.

        Returns:
            Tuple of (plugin_author, plugin_name).

        Raises:
            ValueError: If plugin_id is not in the expected 'author/name' format.
        """
        segments = plugin_id.split('/')
        if len(segments) != 2 or not all(segments):
            raise ValueError(
                f"Invalid plugin_id format: '{plugin_id}'. Expected 'author/name' format (e.g. 'langbot/rag-engine')."
            )
        return segments[0], segments[1]

    async def call_rag_ingest(self, plugin_id: str, context_data: dict[str, Any]) -> dict[str, Any]:
        """Call plugin to ingest document.

        Args:
            plugin_id: Target plugin ID (author/name).
            context_data: IngestionContext data.
        """
        plugin_author, plugin_name = self._parse_plugin_id(plugin_id)
        return await self._runtime_handler().rag_ingest_document(plugin_author, plugin_name, context_data)

    async def call_rag_delete_document(self, plugin_id: str, document_id: str, kb_id: str) -> bool:
        plugin_author, plugin_name = self._parse_plugin_id(plugin_id)
        return await self._runtime_handler().rag_delete_document(plugin_author, plugin_name, document_id, kb_id)

    async def get_rag_creation_schema(self, plugin_id: str) -> dict[str, Any]:
        plugin_author, plugin_name = self._parse_plugin_id(plugin_id)
        return await self._runtime_handler().get_rag_creation_schema(plugin_author, plugin_name)

    async def get_rag_retrieval_schema(self, plugin_id: str) -> dict[str, Any]:
        plugin_author, plugin_name = self._parse_plugin_id(plugin_id)
        return await self._runtime_handler().get_rag_retrieval_schema(plugin_author, plugin_name)

    async def rag_on_kb_create(self, plugin_id: str, kb_id: str, config: dict[str, Any]) -> dict[str, Any]:
        """Notify plugin about KB creation."""
        plugin_author, plugin_name = self._parse_plugin_id(plugin_id)
        return await self._runtime_handler().rag_on_kb_create(plugin_author, plugin_name, kb_id, config)

    async def rag_on_kb_delete(self, plugin_id: str, kb_id: str) -> dict[str, Any]:
        """Notify plugin about KB deletion."""
        plugin_author, plugin_name = self._parse_plugin_id(plugin_id)
        return await self._runtime_handler().rag_on_kb_delete(plugin_author, plugin_name, kb_id)

    async def call_rag_retrieve(self, plugin_id: str, retrieval_context: dict[str, Any]) -> dict[str, Any]:
        """Call plugin to retrieve knowledge.

        Args:
            plugin_id: Target plugin ID (author/name).
            retrieval_context: RetrievalContext data.
        """
        plugin_author, plugin_name = self._parse_plugin_id(plugin_id)
        return await self._runtime_handler().retrieve_knowledge(plugin_author, plugin_name, '', retrieval_context)

    async def list_knowledge_engines(self) -> list[dict[str, Any]]:
        """List all available Knowledge Engines from plugins.

        Returns a list of Knowledge Engines with their capabilities and configuration schemas.
        """
        if not self.is_enable_plugin or not self._runtime_available():
            return []

        return await self._runtime_handler().list_knowledge_engines()

    async def list_parsers(self) -> list[dict[str, Any]]:
        """List all available parsers from plugins."""
        if not self.is_enable_plugin or not self._runtime_available():
            return []
        return await self._runtime_handler().list_parsers()

    async def call_parser(self, plugin_id: str, context_data: dict[str, Any], file_bytes: bytes) -> dict[str, Any]:
        """Call plugin to parse a document."""
        plugin_author, plugin_name = self._parse_plugin_id(plugin_id)
        return await self._runtime_handler().parse_document(plugin_author, plugin_name, context_data, file_bytes)
