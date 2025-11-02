from __future__ import annotations

import quart


from ... import group


@group.group_class('mcp', '/api/v1/mcp')
class MCPRouterGroup(group.RouterGroup):
    async def initialize(self) -> None:
        @self.route('/servers', methods=['GET', 'POST'], auth_type=group.AuthType.USER_TOKEN)
        async def _() -> str:
            """获取MCP服务器列表"""
            if quart.request.method == 'GET':
                servers = await self.ap.mcp_service.get_mcp_servers()

                servers_with_status = []
                # 获取MCP工具加载器
                mcp_loader = self.ap.tool_mgr.mcp_tool_loader

                for server in servers:
                    # 从运行中的会话获取工具数量
                    tools_count = 0
                    if mcp_loader:
                        session = mcp_loader.sessions.get(server['name'])
                        if session:
                            tools_count = len(session.functions)

                    server_info = {
                        **server,
                        'tools': tools_count,
                    }
                    servers_with_status.append(server_info)

                return self.success(data={'servers': servers_with_status})

            elif quart.request.method == 'POST':
                data = await quart.request.json
                data = data['source']

                try:
                    uuid = await self.ap.mcp_service.create_mcp_server(data)
                    return self.success(data={'uuid': uuid})
                except Exception as e:
                    return self.http_status(500, -1, f'Failed to create MCP server: {str(e)}')

        @self.route('/servers/<server_name>', methods=['GET', 'PUT', 'DELETE'], auth_type=group.AuthType.USER_TOKEN)
        async def _(server_name: str) -> str:
            """获取、更新或删除MCP服务器配置"""

            server_data = await self.ap.mcp_service.get_mcp_server_by_name(server_name)
            if server_data is None:
                return self.http_status(404, -1, 'Server not found')

            if quart.request.method == 'GET':
                return self.success(data={'server': server_data})

            elif quart.request.method == 'PUT':
                data = await quart.request.json
                try:
                    await self.ap.mcp_service.update_mcp_server(server_data['uuid'], data)
                    return self.success()
                except Exception as e:
                    return self.http_status(500, -1, f'Failed to update MCP server: {str(e)}')

            elif quart.request.method == 'DELETE':
                try:
                    await self.ap.mcp_service.delete_mcp_server(server_data['uuid'])
                    return self.success()
                except Exception as e:
                    return self.http_status(500, -1, f'Failed to delete MCP server: {str(e)}')

        @self.route('/servers/<server_name>/test', methods=['POST'], auth_type=group.AuthType.USER_TOKEN)
        async def _(server_name: str) -> str:
            """测试MCP服务器连接"""

            server_data = await self.ap.mcp_service.get_mcp_server_by_name(server_name)
            if server_data is None:
                return self.http_status(404, -1, 'Server not found')

            
            task_id = await self.ap.mcp_service.test_mcp_server(server_data['uuid'])
            return self.success(data={'task_id': task_id})
