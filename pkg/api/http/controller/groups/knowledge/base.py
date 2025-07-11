import quart
from ... import group


@group.group_class('knowledge_base', '/api/v1/knowledge/bases')
class KnowledgeBaseRouterGroup(group.RouterGroup):
    async def initialize(self) -> None:
        @self.route('', methods=['POST', 'GET'], endpoint='handle_knowledge_bases')
        async def handle_knowledge_bases() -> str:
            if quart.request.method == 'GET':
                knowledge_bases = await self.ap.knowledge_base_service.get_all_knowledge_bases()
                bases_list = [
                    {
                        'uuid': kb.id,
                        'name': kb.name,
                        'description': kb.description,
                        'embedding_model_uuid': kb.embedding_model_uuid,
                        'top_k': kb.top_k,
                    }
                    for kb in knowledge_bases
                ]
                return self.success(data={'bases': bases_list})

            elif quart.request.method == 'POST':
                json_data = await quart.request.json
                knowledge_base_uuid = await self.ap.knowledge_base_service.create_knowledge_base(
                    json_data.get('name'),
                    json_data.get('description'),
                    json_data.get('embedding_model_uuid'),
                )
                return self.success(data={'uuid': knowledge_base_uuid})

        @self.route(
            '/<knowledge_base_uuid>',
            methods=['GET', 'DELETE'],
            endpoint='handle_specific_knowledge_base',
        )
        async def handle_specific_knowledge_base(knowledge_base_uuid: str) -> str:
            if quart.request.method == 'GET':
                knowledge_base = await self.ap.knowledge_base_service.get_knowledge_base_by_id(knowledge_base_uuid)

                if knowledge_base is None:
                    return self.http_status(404, -1, 'knowledge base not found')

                return self.success(
                    data={
                        'base': {
                            'name': knowledge_base.name,
                            'description': knowledge_base.description,
                            'uuid': knowledge_base.id,
                        },
                    }
                )
            elif quart.request.method == 'DELETE':
                await self.ap.knowledge_base_service.delete_kb_by_id(knowledge_base_uuid)
                return self.success({})

        @self.route(
            '/<knowledge_base_uuid>/files',
            methods=['GET'],
            endpoint='get_knowledge_base_files',
        )
        async def get_knowledge_base_files(knowledge_base_uuid: str) -> str:
            files = await self.ap.knowledge_base_service.get_files_by_knowledge_base(knowledge_base_uuid)
            return self.success(
                data={
                    'files': [
                        {
                            'id': file.id,
                            'file_name': file.file_name,
                            'status': file.status,
                        }
                        for file in files
                    ],
                }
            )

        @self.route(
            '/<knowledge_base_uuid>/files/<file_id>',
            methods=['DELETE'],
            endpoint='delete_specific_file_in_kb',
        )
        async def delete_specific_file_in_kb(file_id: str) -> str:
            await self.ap.knowledge_base_service.delete_data_by_file_id(file_id)
            return self.success({})

        @self.route(
            '/<knowledge_base_uuid>/files',
            methods=['POST'],
            endpoint='relate_file_with_kb',
        )
        async def relate_file_id_with_kb(knowledge_base_uuid: str, file_id: str) -> str:
            if 'file' not in quart.request.files:
                return self.http_status(400, -1, 'No file part in the request')

            json_data = await quart.request.json
            file_id = json_data.get('file_id')
            if not file_id:
                return self.http_status(400, -1, 'File ID is required')

            # 调用服务层方法将文件与知识库关联
            await self.ap.knowledge_base_service.relate_file_id_with_kb(knowledge_base_uuid, file_id)
            return self.success({})
