from __future__ import annotations

import sqlalchemy
import uuid
import traceback
import asyncio

from ....core import app
from ....entity.persistence import mcp as persistence_mcp
from ....core import taskmgr
from ....provider.tools.loaders.mcp import RuntimeMCPSession


class RuntimeMCPServer:
    """Runtime MCP Server representation"""

    ap: app.Application

    mcp_server_entity: persistence_mcp.MCPServer

    session: RuntimeMCPSession | None = None

    def __init__(self, ap: app.Application, mcp_server_entity: persistence_mcp.MCPServer):
        self.ap = ap
        self.mcp_server_entity = mcp_server_entity
        self.session = None

    async def initialize(self):
        """初始化 MCP Server"""
        if not self.mcp_server_entity.enable:
            return

        # 构建配置字典
        mixed_config = {
            'name': self.mcp_server_entity.name,
            'mode': self.mcp_server_entity.mode,
            'enable': self.mcp_server_entity.enable,
            **self.mcp_server_entity.extra_args,
        }

        self.session = RuntimeMCPSession(
            self.mcp_server_entity.name, mixed_config, self.mcp_server_entity.enable, self.ap
        )
        await self.session.start()

    async def _test_mcp_server_task(self, task_context: taskmgr.TaskContext):
        """测试MCP服务器连接"""
        try:
            task_context.set_current_action(f'Testing connection to {self.mcp_server_entity.name}')

            # 创建临时会话进行测试
            mixed_config = {
                'name': self.mcp_server_entity.name,
                'mode': self.mcp_server_entity.mode,
                'enable': True,  # 测试时强制启用
                **self.mcp_server_entity.extra_args,
            }

            test_session = RuntimeMCPSession(self.mcp_server_entity.name, mixed_config, enable=True, ap=self.ap)
            await test_session.start()

            # 获取工具列表作为测试
            tools_count = len(test_session.functions)

            tool_name_list = []
            for function in test_session.functions:
                tool_name_list.append(function.name)

            task_context.set_current_action(f'Successfully connected. Found {tools_count} tools.')

            # 关闭测试会话
            await test_session.shutdown()

            return {'status': 'success', 'tools_count': tools_count, 'tools_names_lists': tool_name_list}

        except Exception as e:
            self.ap.logger.error(f'Connection test failed: {str(e)}\n{traceback.format_exc()}')
            task_context.set_current_action(f'Connection test failed: {str(e)}')
            raise e

    async def test_connection(self) -> str:
        """测试 MCP 服务器连接并返回任务 ID"""
        ctx = taskmgr.TaskContext.new()
        wrapper = self.ap.task_mgr.create_user_task(
            self._test_mcp_server_task(task_context=ctx),
            kind='mcp-operation',
            name=f'mcp-test-{self.mcp_server_entity.name}',
            label=f'Testing MCP server {self.mcp_server_entity.name}',
            context=ctx,
        )
        return wrapper.id

    async def dispose(self):
        """清理资源"""
        if self.session:
            await self.session.shutdown()


class MCPService:
    ap: app.Application

    def __init__(self, ap: app.Application) -> None:
        self.ap = ap

    async def get_runtime_info(self, server_name: str) -> dict | None:
        session = self.ap.tool_mgr.mcp_tool_loader.get_session(server_name)
        if session:
            return session.get_runtime_info_dict()
        return None

    async def get_mcp_servers(self, contain_runtime_info: bool = False) -> list[dict]:
        result = await self.ap.persistence_mgr.execute_async(sqlalchemy.select(persistence_mcp.MCPServer))

        servers = result.all()
        serialized_servers = [
            self.ap.persistence_mgr.serialize_model(persistence_mcp.MCPServer, server) for server in servers
        ]
        if contain_runtime_info:
            for server in serialized_servers:
                runtime_info = await self.get_runtime_info(server['name'])

                server['runtime_info'] = runtime_info if runtime_info else None

        return serialized_servers

    async def create_mcp_server(self, server_data: dict) -> str:
        server_data['uuid'] = str(uuid.uuid4())
        await self.ap.persistence_mgr.execute_async(sqlalchemy.insert(persistence_mcp.MCPServer).values(server_data))

        result = await self.ap.persistence_mgr.execute_async(
            sqlalchemy.select(persistence_mcp.MCPServer).where(persistence_mcp.MCPServer.uuid == server_data['uuid'])
        )
        server_entity = result.first()
        if server_entity:
            server_config = self.ap.persistence_mgr.serialize_model(persistence_mcp.MCPServer, server_entity)
            if self.ap.tool_mgr.mcp_tool_loader:
                task = asyncio.create_task(self.ap.tool_mgr.mcp_tool_loader.host_mcp_server(server_config))
                self.ap.tool_mgr.mcp_tool_loader._hosted_mcp_tasks.append(task)

        return server_data['uuid']

    async def get_mcp_server_by_name(self, server_name: str) -> dict | None:
        result = await self.ap.persistence_mgr.execute_async(
            sqlalchemy.select(persistence_mcp.MCPServer).where(persistence_mcp.MCPServer.name == server_name)
        )
        server = result.first()
        if server is None:
            return None

        runtime_info = await self.get_runtime_info(server.name)
        server_data = self.ap.persistence_mgr.serialize_model(persistence_mcp.MCPServer, server)
        server_data['runtime_info'] = runtime_info if runtime_info else None
        return server_data

    async def update_mcp_server(self, server_uuid: str, server_data: dict) -> None:
        result = await self.ap.persistence_mgr.execute_async(
            sqlalchemy.select(persistence_mcp.MCPServer).where(persistence_mcp.MCPServer.uuid == server_uuid)
        )
        old_server = result.first()
        old_server_name = old_server.name if old_server else None

        await self.ap.persistence_mgr.execute_async(
            sqlalchemy.update(persistence_mcp.MCPServer)
            .where(persistence_mcp.MCPServer.uuid == server_uuid)
            .values(server_data)
        )

        if self.ap.tool_mgr.mcp_tool_loader:
            if old_server_name and old_server_name in self.ap.tool_mgr.mcp_tool_loader.sessions:
                await self.ap.tool_mgr.mcp_tool_loader.remove_mcp_server(old_server_name)

            result = await self.ap.persistence_mgr.execute_async(
                sqlalchemy.select(persistence_mcp.MCPServer).where(persistence_mcp.MCPServer.uuid == server_uuid)
            )
            updated_server = result.first()
            if updated_server:
                # convert entity to config dict
                server_config = self.ap.persistence_mgr.serialize_model(persistence_mcp.MCPServer, updated_server)
                # await self.ap.tool_mgr.mcp_tool_loader.host_mcp_server(server_config)
                task = asyncio.create_task(self.ap.tool_mgr.mcp_tool_loader.host_mcp_server(server_config))
                self.ap.tool_mgr.mcp_tool_loader._hosted_mcp_tasks.append(task)

    async def delete_mcp_server(self, server_uuid: str) -> None:
        result = await self.ap.persistence_mgr.execute_async(
            sqlalchemy.select(persistence_mcp.MCPServer).where(persistence_mcp.MCPServer.uuid == server_uuid)
        )
        server = result.first()
        server_name = server.name if server else None

        await self.ap.persistence_mgr.execute_async(
            sqlalchemy.delete(persistence_mcp.MCPServer).where(persistence_mcp.MCPServer.uuid == server_uuid)
        )

        if server_name and self.ap.tool_mgr.mcp_tool_loader:
            if server_name in self.ap.tool_mgr.mcp_tool_loader.sessions:
                await self.ap.tool_mgr.mcp_tool_loader.remove_mcp_server(server_name)

    async def test_mcp_server(self, server_uuid: str) -> str:
        """测试 MCP 服务器连接并返回任务 ID"""

        result = await self.ap.persistence_mgr.execute_async(
            sqlalchemy.select(persistence_mcp.MCPServer).where(persistence_mcp.MCPServer.uuid == server_uuid)
        )
        server = result.first()
        if server is None:
            raise ValueError(f'Server not found: {server_uuid}')

        if isinstance(server, sqlalchemy.Row):
            server_entity = persistence_mcp.MCPServer(**server._mapping)
        else:
            server_entity = server

        runtime_server = RuntimeMCPServer(ap=self.ap, mcp_server_entity=server_entity)

        return await runtime_server.test_connection()
