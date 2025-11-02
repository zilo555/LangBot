from __future__ import annotations

import sqlalchemy
import uuid

from ....core import app
from ....entity.persistence import mcp as persistence_mcp


class MCPService:
    ap: app.Application

    def __init__(self, ap: app.Application) -> None:
        self.ap = ap

    async def get_mcp_servers(self) -> list[dict]:
        result = await self.ap.persistence_mgr.execute_async(sqlalchemy.select(persistence_mcp.MCPServer))

        servers = result.all()
        return [self.ap.persistence_mgr.serialize_model(persistence_mcp.MCPServer, server) for server in servers]

    async def create_mcp_server(self, server_data: dict) -> str:
        server_data['uuid'] = str(uuid.uuid4())
        await self.ap.persistence_mgr.execute_async(sqlalchemy.insert(persistence_mcp.MCPServer).values(server_data))
        server = await self.get_mcp_server(server_data['uuid'])

        # TODO: load runtime mcp server session

        return server['uuid']

    async def get_mcp_server(self, server_uuid: str) -> dict | None:
        result = await self.ap.persistence_mgr.execute_async(
            sqlalchemy.select(persistence_mcp.MCPServer).where(persistence_mcp.MCPServer.uuid == server_uuid)
        )
        server = result.first()
        if server is None:
            return None
        return self.ap.persistence_mgr.serialize_model(persistence_mcp.MCPServer, server)

    async def get_mcp_server_by_name(self, server_name: str) -> dict | None:
        result = await self.ap.persistence_mgr.execute_async(
            sqlalchemy.select(persistence_mcp.MCPServer).where(persistence_mcp.MCPServer.name == server_name)
        )
        server = result.first()
        if server is None:
            return None
        return self.ap.persistence_mgr.serialize_model(persistence_mcp.MCPServer, server)

    async def update_mcp_server(self, server_uuid: str, server_data: dict) -> None:
        await self.ap.persistence_mgr.execute_async(
            sqlalchemy.update(persistence_mcp.MCPServer)
            .where(persistence_mcp.MCPServer.uuid == server_uuid)
            .values(server_data)
        )

        # TODO: reload runtime mcp server session

    async def delete_mcp_server(self, server_uuid: str) -> None:
        await self.ap.persistence_mgr.execute_async(
            sqlalchemy.delete(persistence_mcp.MCPServer).where(persistence_mcp.MCPServer.uuid == server_uuid)
        )

        # TODO: remove runtime mcp server session
