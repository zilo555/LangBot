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

                uuid = await self.ap.mcp_service.create_mcp_server(data)

                return self.success(data={'uuid': uuid})

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
                await self.ap.mcp_service.update_mcp_server(server_data['uuid'], data)
                return self.success()

            elif quart.request.method == 'DELETE':
                await self.ap.mcp_service.delete_mcp_server(server_data['uuid'])
                return self.success()

        @self.route('/servers/<server_name>/test', methods=['POST'], auth_type=group.AuthType.USER_TOKEN)
        async def _(server_name: str) -> str:
            """测试MCP服务器连接"""

            server_data = await self.ap.mcp_service.get_mcp_server_by_name(server_name)
            if server_data is None:
                return self.http_status(404, -1, 'Server not found')


# TODO 这里移到service去
# # 创建测试任务
# ctx = taskmgr.TaskContext.new()
# wrapper = self.ap.task_mgr.create_user_task(
#     self._test_mcp_server(server, ctx),
#     kind='mcp-operation',
#     name=f'mcp-test-{server_name}',
#     label=f'Testing MCP server {server_name}',
#     context=ctx,
# )
# return self.success(data={'task_id': wrapper.id})

# async def _test_mcp_server(self, server: persistence_mcp.MCPServer, ctx: taskmgr.TaskContext):
#     """测试MCP服务器连接"""
#     try:

#         ctx.current_action = f'Testing connection to {server.name}'
#         # 创建临时会话进行测试
#         session = RuntimeMCPSession(server.name, {
#         'name': server.name,
#         'mode': server.mode,
#         'enable': server.enable,
#         'url': server.extra_args.get('url',''),
#         'headers': server.extra_args.get('headers',{}),
#         'timeout': server.extra_args.get('timeout',60),
#         },enable=True, ap=self.ap)
#         await session.start()

#         # 获取工具列表作为测试
#         tools_count = len(session.functions)

#         tool_name_list = []
#         for function in session.functions:
#             tool_name_list.append(function.name)
#         ctx.current_action = f'Successfully connected. Found {tools_count} tools.'

#         # 关闭测试会话
#         await session.shutdown()

#         return {'status': 'success', 'tools_count': tools_count,'tools_names_lists':tool_name_list}

#     except Exception as e:
#         print(traceback.format_exc())
#         ctx.current_action = f'Connection test failed: {str(e)}'
#         raise e
