from __future__ import annotations
import asyncio
import numpy as np
from typing import List
from sqlalchemy.orm import Session
from pkg.rag.knowledge.services.base_service import BaseService
from pkg.rag.knowledge.services.database import Chunk, SessionLocal
from ....core import app
from ....provider.modelmgr.requester import RuntimeEmbeddingModel


class Embedder(BaseService):
    def __init__(self, ap: app.Application) -> None:
        super().__init__()
        self.ap = ap

    def _db_save_chunks_sync(self, session: Session, file_id: int, chunks_texts: List[str]):
        """
        Saves chunks to the relational database and returns the created Chunk objects.
        This function assumes it's called within a context where the session
        will be committed/rolled back and closed by the caller.
        """
        self.ap.logger.debug(f'Saving {len(chunks_texts)} chunks for file_id {file_id} to DB (sync).')
        chunk_objects = []
        for text in chunks_texts:
            chunk = Chunk(file_id=file_id, text=text)
            session.add(chunk)
            chunk_objects.append(chunk)
        session.flush()  # This populates the .id attribute for each new chunk object
        self.ap.logger.debug(f'Successfully added {len(chunk_objects)} chunk entries to DB.')
        return chunk_objects

    async def embed_and_store(
        self, file_id: int, chunks: List[str], embedding_model: RuntimeEmbeddingModel
    ) -> List[Chunk]:
        session = SessionLocal()  # Start a session that will live for the whole operation
        chunk_objects = []
        try:
            # 1. Save chunks to the relational database first to get their IDs
            #    We call _db_save_chunks_sync directly without _run_sync's session management
            #    because we manage the session here across multiple async calls.
            chunk_objects = await asyncio.to_thread(self._db_save_chunks_sync, session, file_id, chunks)
            session.commit()  # Commit chunks to make their IDs permanent and accessible

            if not chunk_objects:
                self.ap.logger.warning(
                    f'No chunk objects created for file_id {file_id}. Skipping embedding and Chroma storage.'
                )
                return []

            # get the embeddings for the chunks
            embeddings: list[list[float]] = []

            for chunk in chunks:
                result = await embedding_model.requester.invoke_embedding(
                    model=embedding_model,
                    input_text=chunk,
                )
                embeddings.append(result)

            embeddings_np = np.array(embeddings, dtype=np.float32)

            chunk_ids = [c.id for c in chunk_objects]
            # collection名用kb_id（file对象有kb_id字段）
            kb_id = session.query(Chunk).filter_by(id=chunk_ids[0]).first().file.kb_id if chunk_ids else None
            if not kb_id:
                self.ap.logger.warning('无法获取kb_id，向量存储失败')
                return chunk_objects
            chroma_ids = [f'{file_id}_{cid}' for cid in chunk_ids]
            metadatas = [{'file_id': file_id, 'chunk_id': cid} for cid in chunk_ids]
            await self._run_sync(
                self.ap.vector_db_mgr.vector_db.add_embeddings,
                kb_id,
                chroma_ids,
                embeddings_np,
                metadatas,
                chunks,
            )
            self.ap.logger.info(f'Successfully saved {len(chunk_objects)} embeddings to VectorDB.')
            return chunk_objects

        except Exception as e:
            session.rollback()  # Rollback on any error
            self.ap.logger.error(f'Failed to process and store data for file_id {file_id}: {e}', exc_info=True)
            raise  # Re-raise the exception to propagate it
        finally:
            session.close()  # Ensure the session is always closed
