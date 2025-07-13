from __future__ import annotations
import asyncio
import logging
import numpy as np
from typing import List
from sqlalchemy.orm import Session
from pkg.rag.knowledge.services.base_service import BaseService
from pkg.rag.knowledge.services.database import Chunk, SessionLocal
from pkg.rag.knowledge.services.chroma_manager import ChromaIndexManager
from sqlalchemy.orm import declarative_base, sessionmaker
from ....core import app
from ....entity.persistence import model as persistence_model
import sqlalchemy
from ....provider.modelmgr.requester import RuntimeEmbeddingModel


base = declarative_base()
logger = logging.getLogger(__name__)

class Embedder(BaseService):
    def __init__(self, ap: app.Application, chroma_manager: ChromaIndexManager = None) -> None:
        super().__init__()
        self.logger = logging.getLogger(self.__class__.__name__)
        self.chroma_manager = chroma_manager
        self.ap = ap

    def _db_save_chunks_sync(self, session: Session, file_id: int, chunks_texts: List[str]):
        """
        Saves chunks to the relational database and returns the created Chunk objects.
        This function assumes it's called within a context where the session
        will be committed/rolled back and closed by the caller.
        """
        self.logger.debug(f"Saving {len(chunks_texts)} chunks for file_id {file_id} to DB (sync).")
        chunk_objects = []
        for text in chunks_texts:
            chunk = Chunk(file_id=file_id, text=text)
            session.add(chunk)
            chunk_objects.append(chunk)
        session.flush() # This populates the .id attribute for each new chunk object
        self.logger.debug(f"Successfully added {len(chunk_objects)} chunk entries to DB.")
        return chunk_objects

    async def embed_and_store(self, file_id: int, chunks: List[str], embedding_model: RuntimeEmbeddingModel) -> List[Chunk]:
        if not embedding_model:
            raise RuntimeError("Embedding model not loaded. Please check Embedder initialization.")

        session = SessionLocal() # Start a session that will live for the whole operation
        chunk_objects = []
        try:
            # 1. Save chunks to the relational database first to get their IDs
            #    We call _db_save_chunks_sync directly without _run_sync's session management
            #    because we manage the session here across multiple async calls.
            chunk_objects = await asyncio.to_thread(self._db_save_chunks_sync, session, file_id, chunks)
            session.commit() # Commit chunks to make their IDs permanent and accessible

            if not chunk_objects:
                self.logger.warning(f"No chunk objects created for file_id {file_id}. Skipping embedding and Chroma storage.")
                return []
            
            # get the embeddings for the chunks
            embeddings = []
            i = 0
            while i <len(chunks):
                chunk = chunks[i]
                result = await embedding_model.requester.invoke_embedding(
                    model=embedding_model,
                    input_text=chunk,
                )
                embeddings.append(result)
                i += 1
            
            embeddings_np = np.array(embeddings, dtype=np.float32)

            self.logger.info("Saving embeddings to Chroma...")
            chunk_ids = [c.id for c in chunk_objects] 
            file_ids_for_chroma = [file_id] * len(chunk_ids)

            await self._run_sync( # Use _run_sync for the Chroma operation, as it's a sync call
                self.chroma_manager.add_embeddings_sync,
                file_ids_for_chroma, chunk_ids, embeddings_np, chunks # Pass original chunks texts for documents
            )
            self.logger.info(f"Successfully saved {len(chunk_objects)} embeddings to Chroma.")
            return chunk_objects

        except Exception as e:
            session.rollback() # Rollback on any error
            self.logger.error(f"Failed to process and store data for file_id {file_id}: {e}", exc_info=True)
            raise # Re-raise the exception to propagate it
        finally:
            session.close() # Ensure the session is always closed