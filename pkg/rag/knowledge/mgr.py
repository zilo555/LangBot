# rag_manager.py
from __future__ import annotations
import logging
import os
import asyncio
import uuid
from pkg.rag.knowledge.services.parser import FileParser
from pkg.rag.knowledge.services.chunker import Chunker
from pkg.rag.knowledge.services.database import create_db_and_tables, SessionLocal, KnowledgeBase, File, Chunk
from pkg.core import app


class RAGManager:
    ap: app.Application

    def __init__(self, ap: app.Application, logger: logging.Logger = None):
        self.ap = ap
        self.logger = logger or logging.getLogger(__name__)
        self.chroma_manager = None
        self.parser = FileParser()
        self.chunker = Chunker()
        self.embedder = None
        self.retriever = None

    async def initialize_rag_system(self):
        """Initializes the RAG system by creating database tables."""
        await asyncio.to_thread(create_db_and_tables)

    async def create_knowledge_base(
        self, kb_name: str, kb_description: str, embedding_model_uuid: str = '', top_k: int = 5
    ):
        """
        Creates a new knowledge base if it doesn't already exist.
        """
        try:
            if not kb_name:
                raise ValueError('Knowledge base name must be set while creating.')

            def _create_kb_sync():
                session = SessionLocal()
                try:
                    kb = session.query(KnowledgeBase).filter_by(name=kb_name).first()
                    if not kb:
                        id = uuid.uuid4().int
                        new_kb = KnowledgeBase(
                            name=kb_name,
                            description=kb_description,
                            embedding_model_uuid=embedding_model_uuid,
                            top_k=top_k,
                            id=id,
                        )
                        session.add(new_kb)
                        session.commit()
                        session.refresh(new_kb)
                        self.logger.info(f"Knowledge Base '{kb_name}' created.")
                        return new_kb.id
                    else:
                        self.logger.info(f"Knowledge Base '{kb_name}' already exists.")
                except Exception as e:
                    session.rollback()
                    self.logger.error(f"Error in _create_kb_sync for '{kb_name}': {str(e)}", exc_info=True)
                    raise
                finally:
                    session.close()

            return await asyncio.to_thread(_create_kb_sync)
        except Exception as e:
            self.logger.error(f"Error creating knowledge base '{kb_name}': {str(e)}", exc_info=True)
            raise

    async def get_all_knowledge_bases(self):
        """
        Retrieves all knowledge bases from the database.
        """
        try:

            def _get_all_kbs_sync():
                session = SessionLocal()
                try:
                    return session.query(KnowledgeBase).all()
                finally:
                    session.close()

            return await asyncio.to_thread(_get_all_kbs_sync)
        except Exception as e:
            self.logger.error(f'Error retrieving knowledge bases: {str(e)}', exc_info=True)
            return []

    async def get_knowledge_base_by_id(self, kb_id: int):
        """
        Retrieves a specific knowledge base by its ID.
        """
        try:

            def _get_kb_sync(kb_id_param):
                session = SessionLocal()
                try:
                    return session.query(KnowledgeBase).filter_by(id=kb_id_param).first()
                finally:
                    session.close()

            return await asyncio.to_thread(_get_kb_sync, kb_id)
        except Exception as e:
            self.logger.error(f'Error retrieving knowledge base with ID {kb_id}: {str(e)}', exc_info=True)
            return None

    async def get_files_by_knowledge_base(self, kb_id: int):
        """
        Retrieves files associated with a specific knowledge base by querying the File table directly.
        """
        try:

            def _get_files_sync(kb_id_param):
                session = SessionLocal()
                try:
                    return session.query(File).filter_by(kb_id=kb_id_param).all()
                finally:
                    session.close()

            return await asyncio.to_thread(_get_files_sync, kb_id)
        except Exception as e:
            self.logger.error(f'Error retrieving files for knowledge base ID {kb_id}: {str(e)}', exc_info=True)
            return []

    async def get_all_files(self):
        """
        Retrieves all files stored in the database, regardless of their association
        with any specific knowledge base.
        """
        try:

            def _get_all_files_sync():
                session = SessionLocal()
                try:
                    return session.query(File).all()
                finally:
                    session.close()

            return await asyncio.to_thread(_get_all_files_sync)
        except Exception as e:
            self.logger.error(f'Error retrieving all files: {str(e)}', exc_info=True)
            return []

    async def store_data(
        self, file_path: str, kb_name: str, file_type: str, kb_description: str = 'Default knowledge base'
    ):
        """
        Parses, chunks, embeds, and stores data from a given file into the RAG system.
        Associates the file with a knowledge base using kb_id in the File table.
        """
        self.logger.info(f'Starting data storage process for file: {file_path}')
        session = SessionLocal()
        file_obj = None

        try:
            # 1. 确保知识库存在或创建它
            kb = session.query(KnowledgeBase).filter_by(name=kb_name).first()
            if not kb:
                kb = KnowledgeBase(name=kb_name, description=kb_description)
                session.add(kb)
                session.commit()
                session.refresh(kb)
                self.logger.info(f"Knowledge Base '{kb_name}' created during store_data.")
            else:
                self.logger.info(f"Knowledge Base '{kb_name}' already exists.")

            # 2. 添加文件记录到数据库，并直接关联 kb_id
            file_name = os.path.basename(file_path)
            existing_file = session.query(File).filter_by(kb_id=kb.id, file_name=file_name).first()
            if existing_file:
                self.logger.warning(
                    f"File '{file_name}' already exists in knowledge base '{kb_name}'. Skipping storage."
                )
                return

            file_obj = File(kb_id=kb.id, file_name=file_name, path=file_path, file_type=file_type)
            session.add(file_obj)
            session.commit()
            session.refresh(file_obj)
            self.logger.info(
                f"File record '{file_name}' added to database with ID: {file_obj.id}, associated with KB ID: {kb.id}"
            )

            # 3. 解析文件内容
            text = await self.parser.parse(file_path)
            if not text:
                self.logger.warning(f'No text extracted from file {file_path}. Deleting file record ID: {file_obj.id}.')
                session.delete(file_obj)
                session.commit()  # 提交删除操作
                return

            # 4. 分块并嵌入/存储块
            chunks_texts = await self.chunker.chunk(text)
            self.logger.info(f"Chunked file '{file_name}' into {len(chunks_texts)} chunks.")
            await self.embedder.embed_and_store(file_id=file_obj.id, chunks=chunks_texts)
            self.logger.info(f'Data storage process completed for file: {file_path}')

        except Exception as e:
            session.rollback()
            self.logger.error(f'Error in store_data for file {file_path}: {str(e)}', exc_info=True)
            if file_obj and file_obj.id:
                try:
                    await asyncio.to_thread(self.chroma_manager.delete_by_file_id_sync, file_obj.id)
                except Exception as chroma_e:
                    self.logger.warning(
                        f'Could not clean up ChromaDB entries for file_id {file_obj.id} after store_data failure: {chroma_e}'
                    )
            raise
        finally:
            session.close()

    async def retrieve_data(self, query: str):
        """
        Retrieves relevant data chunks based on a given query using the configured retriever.
        """
        self.logger.info(f"Starting data retrieval process for query: '{query}'")
        try:
            retrieved_chunks = await self.retriever.retrieve(query)
            self.logger.info(f'Successfully retrieved {len(retrieved_chunks)} chunks for query.')
            return retrieved_chunks
        except Exception as e:
            self.logger.error(f"Error in retrieve_data for query '{query}': {str(e)}", exc_info=True)
            return []

    async def delete_data_by_file_id(self, file_id: int):
        """
        Deletes all data associated with a specific file ID, including its chunks and vectors,
        and the file record itself.
        """
        self.logger.info(f'Starting data deletion process for file_id: {file_id}')
        session = SessionLocal()
        try:
            # 1. 从 ChromaDB 删除 embeddings
            await asyncio.to_thread(self.chroma_manager.delete_by_file_id_sync, file_id)
            self.logger.info(f'Deleted embeddings from ChromaDB for file_id: {file_id}')

            # 2. 删除与文件关联的 chunks 记录
            chunks_to_delete = session.query(Chunk).filter_by(file_id=file_id).all()
            for chunk in chunks_to_delete:
                session.delete(chunk)
            self.logger.info(f'Deleted {len(chunks_to_delete)} chunk records for file_id: {file_id}')

            # 3. 删除文件记录本身
            file_to_delete = session.query(File).filter_by(id=file_id).first()
            if file_to_delete:
                session.delete(file_to_delete)
                self.logger.info(f'Deleted file record for file_id: {file_id}')
            else:
                self.logger.warning(f'File with ID {file_id} not found in database. Skipping deletion of file record.')

            session.commit()
            self.logger.info(f'Successfully completed data deletion for file_id: {file_id}')
        except Exception as e:
            session.rollback()
            self.logger.error(f'Error deleting data for file_id {file_id}: {str(e)}', exc_info=True)
            raise
        finally:
            session.close()

    async def delete_kb_by_id(self, kb_id: int):
        """
        Deletes a knowledge base and all associated files, chunks, and vectors.
        This involves querying for associated files and then deleting them.
        """
        self.logger.info(f'Starting deletion of knowledge base with ID: {kb_id}')
        session = SessionLocal()  # 使用新的会话来获取 KB 和关联文件

        try:
            kb_to_delete = session.query(KnowledgeBase).filter_by(id=kb_id).first()
            if not kb_to_delete:
                self.logger.warning(f'Knowledge Base with ID {kb_id} not found.')
                return

            # 获取所有关联的文件，通过 File 表的 kb_id 字段查询
            files_to_delete = session.query(File).filter_by(kb_id=kb_id).all()

            # 关闭当前会话，因为 delete_data_by_file_id 会创建自己的会话
            session.close()

            # 遍历删除每个关联文件及其数据
            for file_obj in files_to_delete:
                try:
                    await self.delete_data_by_file_id(file_obj.id)
                except Exception as file_del_e:
                    self.logger.error(f'Failed to delete file ID {file_obj.id} during KB deletion: {file_del_e}')
                    # 记录错误但继续，尝试删除其他文件

            # 所有文件删除完毕后，重新打开会话来删除 KnowledgeBase 本身
            session = SessionLocal()
            try:
                # 重新查询，确保对象是当前会话的一部分
                kb_final_delete = session.query(KnowledgeBase).filter_by(id=kb_id).first()
                if kb_final_delete:
                    session.delete(kb_final_delete)
                    session.commit()
                    self.logger.info(f'Successfully deleted knowledge base with ID: {kb_id}')
                else:
                    self.logger.warning(
                        f'Knowledge Base with ID {kb_id} not found after file deletion, skipping KB deletion.'
                    )
            except Exception as kb_del_e:
                session.rollback()
                self.logger.error(f'Error deleting KnowledgeBase record for ID {kb_id}: {kb_del_e}', exc_info=True)
                raise
            finally:
                session.close()

        except Exception as e:
            # 如果在最初获取 KB 或文件列表时出错
            if session.is_active:
                session.rollback()
            self.logger.error(f'Error during overall knowledge base deletion for ID {kb_id}: {str(e)}', exc_info=True)
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
        self.logger.info(f'Associating file ID {file_id} with knowledge base UUID {knowledge_base_uuid}')
        session = SessionLocal()
        try:
            # 查询知识库是否存在
            kb = session.query(KnowledgeBase).filter_by(id=knowledge_base_uuid).first()
            if not kb:
                self.logger.error(f'Knowledge Base with UUID {knowledge_base_uuid} not found.')
                return

            # 更新文件的 kb_id
            file_to_update = session.query(File).filter_by(id=file_id).first()
            if not file_to_update:
                self.logger.error(f'File with ID {file_id} not found.')
                return

            file_to_update.kb_id = kb.id
            session.commit()
            self.logger.info(
                f'Successfully associated file ID {file_id} with knowledge base UUID {knowledge_base_uuid}'
            )
        except Exception as e:
            session.rollback()
            self.logger.error(
                f'Error associating file ID {file_id} with knowledge base UUID {knowledge_base_uuid}: {str(e)}',
                exc_info=True,
            )
        finally:
            session.close()
