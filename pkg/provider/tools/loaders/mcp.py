from __future__ import annotations

import typing
from contextlib import AsyncExitStack
import traceback
import sqlalchemy
import asyncio

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
from mcp.client.sse import sse_client

from .. import loader
from ....core import app
import langbot_plugin.api.entities.builtin.resource.tool as resource_tool
from ....entity.persistence import mcp as persistence_mcp


class RuntimeMCPSession:
    """运行时 MCP 会话"""

    ap: app.Application

    server_name: str

    server_config: dict

    session: ClientSession

    exit_stack: AsyncExitStack

    functions: list[resource_tool.LLMTool] = []

    enable: bool

    def __init__(self, server_name: str, server_config: dict, enable: bool, ap: app.Application):
        self.server_name = server_name
        self.server_config = server_config
        self.ap = ap
        self.enable = enable
        self.session = None

        self.exit_stack = AsyncExitStack()
        self.functions = []

    async def _init_stdio_python_server(self):
        server_params = StdioServerParameters(
            command=self.server_config['command'],
            args=self.server_config['args'],
            env=self.server_config['env'],
        )

        stdio_transport = await self.exit_stack.enter_async_context(stdio_client(server_params))

        stdio, write = stdio_transport

        self.session = await self.exit_stack.enter_async_context(ClientSession(stdio, write))

        await self.session.initialize()

    async def _init_sse_server(self):
        sse_transport = await self.exit_stack.enter_async_context(
            sse_client(
                self.server_config['url'],
                headers=self.server_config.get('headers', {}),
                timeout=self.server_config.get('timeout', 10),
            )
        )

        sseio, write = sse_transport

        self.session = await self.exit_stack.enter_async_context(ClientSession(sseio, write))

        await self.session.initialize()

    async def initialize(self):
        pass

    async def start(self):
        if not self.enable:
            return

        if self.server_config['mode'] == 'stdio':
            await self._init_stdio_python_server()
        elif self.server_config['mode'] == 'sse':
            await self._init_sse_server()
        else:
            raise ValueError(f'无法识别 MCP 服务器类型: {self.server_name}: {self.server_config}')

        tools = await self.session.list_tools()

        self.ap.logger.debug(f'获取 MCP 工具: {tools}')

        for tool in tools.tools:

            async def func(*, _tool=tool, **kwargs):
                result = await self.session.call_tool(_tool.name, kwargs)
                if result.isError:
                    raise Exception(result.content[0].text)
                return result.content[0].text

            func.__name__ = tool.name

            self.functions.append(
                resource_tool.LLMTool(
                    name=tool.name,
                    human_desc=tool.description,
                    description=tool.description,
                    parameters=tool.inputSchema,
                    func=func,
                )
            )

    def get_tools(self) -> list[resource_tool.LLMTool]:
        return self.functions

    async def shutdown(self):
        """关闭会话并清理资源"""
        try:
            if self.exit_stack:
                await self.exit_stack.aclose()
            self.functions.clear()
            self.session = None
        except Exception as e:
            self.ap.logger.error(f'Error shutting down MCP session {self.server_name}: {e}\n{traceback.format_exc()}')


# @loader.loader_class('mcp')
class MCPLoader(loader.ToolLoader):
    """MCP 工具加载器。

    在此加载器中管理所有与 MCP Server 的连接。
    """

    sessions: dict[str, RuntimeMCPSession]

    _last_listed_functions: list[resource_tool.LLMTool]

    _startup_load_tasks: list[asyncio.Task]

    def __init__(self, ap: app.Application):
        super().__init__(ap)
        self.sessions = {}
        self._last_listed_functions = []
        self._startup_load_tasks = []

    async def initialize(self):
        await self.load_mcp_servers_from_db()

    async def load_mcp_servers_from_db(self):
        self.ap.logger.info('Loading MCP servers from db...')

        self.sessions = {}

        result = await self.ap.persistence_mgr.execute_async(sqlalchemy.select(persistence_mcp.MCPServer))
        servers = result.all()

        for server in servers:
            server_config = self.ap.persistence_mgr.serialize_model(persistence_mcp.MCPServer, server)

            async def load_mcp_server_task():
                self.ap.logger.debug(f'Loading MCP server {server_config}')
                try:
                    session = await self.load_mcp_server(server_config)
                    self.sessions[server_config['name']] = session
                except Exception as e:
                    self.ap.logger.error(
                        f'Failed to load MCP server from db: {server_config["name"]}({server_config["uuid"]}): {e}\n{traceback.format_exc()}'
                    )
                    return

                self.ap.logger.debug(f'Starting MCP server {server_config["name"]}({server_config["uuid"]})')
                try:
                    await session.start()
                except Exception as e:
                    self.ap.logger.error(
                        f'Failed to start MCP server {server_config["name"]}({server_config["uuid"]}): {e}\n{traceback.format_exc()}'
                    )
                    return

                self.ap.logger.debug(f'Started MCP server {server_config["name"]}({server_config["uuid"]})')

            task = asyncio.create_task(load_mcp_server_task())
            self._startup_load_tasks.append(task)

    async def load_mcp_server(self, server_config: dict) -> RuntimeMCPSession:
        """加载 MCP 服务器到运行时

        Args:
            server_config: 服务器配置字典，必须包含:
                - name: 服务器名称
                - mode: 连接模式 (stdio/sse)
                - enable: 是否启用
                - extra_args: 额外的配置参数 (可选)
        """

        name = server_config['name']
        mode = server_config['mode']
        enable = server_config['enable']
        extra_args = server_config.get('extra_args', {})

        mixed_config = {
            'name': name,
            'mode': mode,
            'enable': enable,
            **extra_args,
        }

        session = RuntimeMCPSession(name, mixed_config, enable, self.ap)
        await session.initialize()

        return session

    async def get_tools(self) -> list[resource_tool.LLMTool]:
        all_functions = []

        for session in self.sessions.values():
            all_functions.extend(session.get_tools())

        self._last_listed_functions = all_functions

        return all_functions

    async def has_tool(self, name: str) -> bool:
        """检查工具是否存在"""
        for session in self.sessions.values():
            for function in session.get_tools():
                if function.name == name:
                    return True
        return False

    async def invoke_tool(self, name: str, parameters: dict) -> typing.Any:
        """执行工具调用"""
        for session in self.sessions.values():
            for function in session.get_tools():
                if function.name == name:
                    self.ap.logger.debug(f'Invoking MCP tool: {name} with parameters: {parameters}')
                    try:
                        result = await function.func(**parameters)
                        self.ap.logger.debug(f'MCP tool {name} executed successfully')
                        return result
                    except Exception as e:
                        self.ap.logger.error(f'Error invoking MCP tool {name}: {e}\n{traceback.format_exc()}')
                        raise

        raise ValueError(f'Tool not found: {name}')

    async def reload_mcp_server(self, server_config: dict):
        """重新加载 MCP 服务器（先移除再加载）

        Args:
            server_config: 服务器配置字典，必须包含 name 字段
        """
        server_name = server_config['name']

        if server_name in self.sessions:
            await self.remove_mcp_server(server_name)

        # 重新加载
        await self.load_mcp_server(server_config)

    async def remove_mcp_server(self, server_name: str):
        """移除 MCP 服务器"""
        if server_name not in self.sessions:
            self.ap.logger.warning(f'MCP server {server_name} not found in sessions, skipping removal')
            return

        session = self.sessions.pop(server_name)
        await session.shutdown()
        self.ap.logger.info(f'Removed MCP server: {server_name}')

    def get_session(self, server_name: str) -> RuntimeMCPSession | None:
        """获取指定名称的 MCP 会话"""
        return self.sessions.get(server_name)

    def has_session(self, server_name: str) -> bool:
        """检查是否存在指定名称的 MCP 会话"""
        return server_name in self.sessions

    def get_all_server_names(self) -> list[str]:
        """获取所有已加载的 MCP 服务器名称"""
        return list(self.sessions.keys())

    def get_server_tool_count(self, server_name: str) -> int:
        """获取指定服务器的工具数量"""
        session = self.get_session(server_name)
        return len(session.get_tools()) if session else 0

    def get_all_servers_info(self) -> dict[str, dict]:
        """获取所有服务器的信息"""
        info = {}
        for server_name, session in self.sessions.items():
            info[server_name] = {
                'name': server_name,
                'mode': session.server_config.get('mode'),
                'enable': session.enable,
                'tools_count': len(session.get_tools()),
                'tool_names': [f.name for f in session.get_tools()],
            }
        return info

    async def shutdown(self):
        """关闭所有工具"""
        self.ap.logger.info('Shutting down all MCP sessions...')
        for server_name, session in list(self.sessions.items()):
            try:
                await session.shutdown()
                self.ap.logger.debug(f'Shutdown MCP session: {server_name}')
            except Exception as e:
                self.ap.logger.error(f'Error shutting down MCP session {server_name}: {e}\n{traceback.format_exc()}')
        self.sessions.clear()
        self.ap.logger.info('All MCP sessions shutdown complete')
