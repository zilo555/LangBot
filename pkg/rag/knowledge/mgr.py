from __future__ import annotations
import os
import asyncio
import traceback
import uuid
from pkg.rag.knowledge.services.parser import FileParser
from pkg.rag.knowledge.services.chunker import Chunker
from pkg.rag.knowledge.services.database import (
    KnowledgeBase,
    File,
    Chunk,
)
from pkg.core import app
from pkg.rag.knowledge.services.embedder import Embedder
from pkg.rag.knowledge.services.retriever import Retriever
import sqlalchemy
from ...entity.persistence import rag as persistence_rag
from pkg.core import taskmgr


class RuntimeKnowledgeBase:
    ap: app.Application

    knowledge_base_entity: persistence_rag.KnowledgeBase

    parser: FileParser

    chunker: Chunker

    embedder: Embedder

    retriever: Retriever

    def __init__(self, ap: app.Application, knowledge_base_entity: persistence_rag.KnowledgeBase):
        self.ap = ap
        self.knowledge_base_entity = knowledge_base_entity
        self.parser = FileParser(ap=self.ap)
        self.chunker = Chunker(ap=self.ap)
        self.embedder = Embedder(ap=self.ap)
        self.retriever = Retriever(ap=self.ap)
        # 传递kb_id给retriever
        self.retriever.kb_id = knowledge_base_entity.uuid

    async def initialize(self):
        pass

    async def _store_file_task(self, file: persistence_rag.File, task_context: taskmgr.TaskContext):
        try:
            # set file status to processing
            await self.ap.persistence_mgr.execute_async(
                sqlalchemy.update(persistence_rag.File)
                .where(persistence_rag.File.uuid == file.uuid)
                .values(status='processing')
            )

            task_context.set_current_action('Parsing file')
            # parse file
            text = await self.parser.parse(file.file_name, file.extension)
            if not text:
                raise Exception(f'No text extracted from file {file.file_name}')

            task_context.set_current_action('Chunking file')
            # chunk file
            chunks_texts = await self.chunker.chunk(text)
            if not chunks_texts:
                raise Exception(f'No chunks extracted from file {file.file_name}')

            task_context.set_current_action('Embedding chunks')
            # embed chunks
            await self.embedder.embed_and_store(
                file_id=file.uuid, chunks=chunks_texts, embedding_model=self.knowledge_base_entity.embedding_model_uuid
            )

            # set file status to completed
            await self.ap.persistence_mgr.execute_async(
                sqlalchemy.update(persistence_rag.File)
                .where(persistence_rag.File.uuid == file.uuid)
                .values(status='completed')
            )

        except Exception as e:
            self.ap.logger.error(f'Error storing file {file.file_id}: {e}')
            # set file status to failed
            await self.ap.persistence_mgr.execute_async(
                sqlalchemy.update(persistence_rag.File)
                .where(persistence_rag.File.uuid == file.uuid)
                .values(status='failed')
            )

            raise

    async def store_file(self, file_id: str) -> int:
        # pre checking
        if not await self.ap.storage_mgr.storage_provider.exists(file_id):
            raise Exception(f'File {file_id} not found')

        file_uuid = str(uuid.uuid4())
        kb_id = self.knowledge_base_entity.uuid
        file_name = file_id
        extension = os.path.splitext(file_id)[1].lstrip('.')

        file = persistence_rag.File(
            uuid=file_uuid,
            kb_id=kb_id,
            file_name=file_name,
            extension=extension,
            status='pending',
        )

        await self.ap.persistence_mgr.execute_async(sqlalchemy.insert(persistence_rag.File).values(**file.to_dict()))

        # run background task asynchronously
        ctx = taskmgr.TaskContext.new()
        wrapper = self.ap.task_mgr.create_user_task(
            self._store_file_task(file, task_context=ctx),
            kind='knowledge-operation',
            name=f'knowledge-store-file-{file_id}',
            label=f'Store file {file_id}',
            context=ctx,
        )
        return wrapper.id

    async def dispose(self):
        pass


class RAGManager:
    ap: app.Application

    knowledge_bases: list[RuntimeKnowledgeBase]

    def __init__(self, ap: app.Application):
        self.ap = ap
        self.knowledge_bases = []

    async def initialize(self):
        pass

    async def load_knowledge_bases_from_db(self):
        self.ap.logger.info('Loading knowledge bases from db...')

        self.knowledge_bases = []

        result = await self.ap.persistence_mgr.execute_async(sqlalchemy.select(persistence_rag.KnowledgeBase))

        knowledge_bases = result.all()

        for knowledge_base in knowledge_bases:
            try:
                await self.load_knowledge_base(knowledge_base)
            except Exception as e:
                self.ap.logger.error(
                    f'Error loading knowledge base {knowledge_base.uuid}: {e}\n{traceback.format_exc()}'
                )

    async def load_knowledge_base(
        self,
        knowledge_base_entity: persistence_rag.KnowledgeBase | sqlalchemy.Row | dict,
    ) -> RuntimeKnowledgeBase:
        if isinstance(knowledge_base_entity, sqlalchemy.Row):
            knowledge_base_entity = persistence_rag.KnowledgeBase(**knowledge_base_entity._mapping)
        elif isinstance(knowledge_base_entity, dict):
            knowledge_base_entity = persistence_rag.KnowledgeBase(**knowledge_base_entity)

        runtime_knowledge_base = RuntimeKnowledgeBase(ap=self.ap, knowledge_base_entity=knowledge_base_entity)

        await runtime_knowledge_base.initialize()

        self.knowledge_bases.append(runtime_knowledge_base)

        return runtime_knowledge_base

    async def get_knowledge_base_by_uuid(self, kb_uuid: str) -> RuntimeKnowledgeBase | None:
        for kb in self.knowledge_bases:
            if kb.knowledge_base_entity.uuid == kb_uuid:
                return kb
        return None

    async def remove_knowledge_base(self, kb_uuid: str):
        for kb in self.knowledge_bases:
            if kb.knowledge_base_entity.uuid == kb_uuid:
                await kb.dispose()
                self.knowledge_bases.remove(kb)
                return

    async def store_data(self, file_path: str, kb_id: str, file_type: str, file_id: str = None):
        """
        Parses, chunks, embeds, and stores data from a given file into the RAG system.
        Associates the file with a knowledge base using kb_id in the File table.
        """
        self.ap.logger.info(f'Starting data storage process for file: {file_path}')
        session = SessionLocal()
        file_obj = None

        try:
            kb = session.query(KnowledgeBase).filter_by(id=kb_id).first()
            if not kb:
                self.ap.logger.info(f'Knowledge Base "{kb_id}" does not exist. ')
                return
            # get embedding model
            embedding_model = await self.ap.model_mgr.get_embedding_model_by_uuid(kb.embedding_model_uuid)
            file_name = os.path.basename(file_path)
            text = await self.parser.parse(file_path)
            if not text:
                self.ap.logger.warning(f'No text extracted from file {file_path}. ')
                return

            chunks_texts = await self.chunker.chunk(text)
            self.ap.logger.info(f"Chunked file '{file_name}' into {len(chunks_texts)} chunks.")
            await self.embedder.embed_and_store(file_id=file_id, chunks=chunks_texts, embedding_model=embedding_model)
            self.ap.logger.info(f'Data storage process completed for file: {file_path}')

        except Exception as e:
            session.rollback()
            self.ap.logger.error(f'Error in store_data for file {file_path}: {str(e)}', exc_info=True)
            raise
        finally:
            if file_id:
                file_obj = session.query(File).filter_by(id=file_id).first()
            if file_obj:
                file_obj.status = 1
            session.close()

    async def retrieve_data(self, query: str):
        """
        Retrieves relevant data chunks based on a given query using the configured retriever.
        """
        self.ap.logger.info(f"Starting data retrieval process for query: '{query}'")
        try:
            retrieved_chunks = await self.retriever.retrieve(query)
            self.ap.logger.info(f'Successfully retrieved {len(retrieved_chunks)} chunks for query.')
            return retrieved_chunks
        except Exception as e:
            self.ap.logger.error(f"Error in retrieve_data for query '{query}': {str(e)}", exc_info=True)
            return []

    async def delete_data_by_file_id(self, file_id: str):
        """
        Deletes all data associated with a specific file ID, including its chunks and vectors,
        and the file record itself.
        """
        self.ap.logger.info(f'Starting data deletion process for file_id: {file_id}')
        session = SessionLocal()
        try:
            # delete vectors
            await asyncio.to_thread(self.chroma_manager.delete_by_file_id_sync, file_id)
            self.ap.logger.info(f'Deleted embeddings from ChromaDB for file_id: {file_id}')

            chunks_to_delete = session.query(Chunk).filter_by(file_id=file_id).all()
            for chunk in chunks_to_delete:
                session.delete(chunk)
            self.ap.logger.info(f'Deleted {len(chunks_to_delete)} chunk records for file_id: {file_id}')

            file_to_delete = session.query(File).filter_by(id=file_id).first()
            if file_to_delete:
                session.delete(file_to_delete)
                try:
                    await self.ap.storage_mgr.storage_provider.delete(file_id)
                except Exception as e:
                    self.ap.logger.error(
                        f'Error deleting file from storage for file_id {file_id}: {str(e)}',
                        exc_info=True,
                    )
                self.ap.logger.info(f'Deleted file record for file_id: {file_id}')
            else:
                self.ap.logger.warning(
                    f'File with ID {file_id} not found in database. Skipping deletion of file record.'
                )
            session.commit()
            self.ap.logger.info(f'Successfully completed data deletion for file_id: {file_id}')
        except Exception as e:
            session.rollback()
            self.ap.logger.error(f'Error deleting data for file_id {file_id}: {str(e)}', exc_info=True)
            raise
        finally:
            session.close()

    async def delete_kb_by_id(self, kb_id: str):
        """
        Deletes a knowledge base and all associated files, chunks, and vectors.
        This involves querying for associated files and then deleting them.
        """
        self.ap.logger.info(f'Starting deletion of knowledge base with ID: {kb_id}')
        session = SessionLocal()

        try:
            kb_to_delete = session.query(KnowledgeBase).filter_by(id=kb_id).first()
            if not kb_to_delete:
                self.ap.logger.warning(f'Knowledge Base with ID {kb_id} not found.')
                return

            files_to_delete = session.query(File).filter_by(kb_id=kb_id).all()

            session.close()

            for file_obj in files_to_delete:
                try:
                    await self.delete_data_by_file_id(file_obj.id)
                except Exception as file_del_e:
                    self.ap.logger.error(f'Failed to delete file ID {file_obj.id} during KB deletion: {file_del_e}')

            session = SessionLocal()
            try:
                kb_final_delete = session.query(KnowledgeBase).filter_by(id=kb_id).first()
                if kb_final_delete:
                    session.delete(kb_final_delete)
                    session.commit()
                    self.ap.logger.info(f'Successfully deleted knowledge base with ID: {kb_id}')
                else:
                    self.ap.logger.warning(
                        f'Knowledge Base with ID {kb_id} not found after file deletion, skipping KB deletion.'
                    )
            except Exception as kb_del_e:
                session.rollback()
                self.ap.logger.error(
                    f'Error deleting KnowledgeBase record for ID {kb_id}: {kb_del_e}',
                    exc_info=True,
                )
                raise
            finally:
                session.close()

        except Exception as e:
            # 如果在最初获取 KB 或文件列表时出错
            if session.is_active:
                session.rollback()
            self.ap.logger.error(
                f'Error during overall knowledge base deletion for ID {kb_id}: {str(e)}',
                exc_info=True,
            )
            raise
        finally:
            if session.is_active:
                session.close()

    async def get_file_content_by_file_id(self, file_id: str) -> str:
        file_bytes = await self.ap.storage_mgr.storage_provider.load(file_id)

        _, ext = os.path.splitext(file_id.lower())
        ext = ext.lstrip('.')

        try:
            text = file_bytes.decode('utf-8')
        except UnicodeDecodeError:
            return '[非文本文件或编码无法识别]'

        if ext in ['txt', 'md', 'csv', 'log', 'py', 'html']:
            return text
        else:
            return f'[未知类型: .{ext}]'

    async def relate_file_id_with_kb(self, knowledge_base_uuid: str, file_id: str) -> None:
        """
        Associates a file with a knowledge base by updating the kb_id in the File table.
        """
        self.ap.logger.info(f'Associating file ID {file_id} with knowledge base UUID {knowledge_base_uuid}')
        session = SessionLocal()
        try:
            # 查询知识库是否存在
            kb = session.query(KnowledgeBase).filter_by(id=knowledge_base_uuid).first()
            if not kb:
                self.ap.logger.error(f'Knowledge Base with UUID {knowledge_base_uuid} not found.')
                return

            if not await self.ap.storage_mgr.storage_provider.exists(file_id):
                self.ap.logger.error(f'File with ID {file_id} does not exist.')
                return
            self.ap.logger.info(f'File with ID {file_id} exists, proceeding with association.')
            # add new file record
            file_to_update = File(
                id=file_id,
                kb_id=kb.id,
                file_name=file_id,
                path=os.path.join('data', 'storage', file_id),
                file_type=os.path.splitext(file_id)[1].lstrip('.'),
                status=0,
            )
            session.add(file_to_update)
            session.commit()
            self.ap.logger.info(
                f'Successfully associated file ID {file_id} with knowledge base UUID {knowledge_base_uuid}'
            )
        except Exception as e:
            session.rollback()
            self.ap.logger.error(
                f'Error associating file ID {file_id} with knowledge base UUID {knowledge_base_uuid}: {str(e)}',
                exc_info=True,
            )
        finally:
            # 进行文件解析
            try:
                await self.store_data(
                    file_path=os.path.join('data', 'storage', file_id),
                    kb_id=knowledge_base_uuid,
                    file_type=os.path.splitext(file_id)[1].lstrip('.'),
                    file_id=file_id,
                )
            except Exception:
                # 如果存储数据时出错，更新文件状态为失败
                file_obj = session.query(File).filter_by(id=file_id).first()
                if file_obj:
                    file_obj.status = 2
                session.commit()
                self.ap.logger.error(f'Error storing data for file ID {file_id}', exc_info=True)

            session.close()
