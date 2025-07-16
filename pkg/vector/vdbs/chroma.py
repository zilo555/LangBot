from __future__ import annotations
import chromadb
from typing import Any
from chromadb import PersistentClient
from pkg.vector.vdb import VectorDatabase
from pkg.core import app


class ChromaVectorDatabase(VectorDatabase):
    def __init__(self, ap: app.Application, base_path: str = './data/chroma'):
        self.ap = ap
        self.client = PersistentClient(path=base_path)
        self._collections = {}

    def get_or_create_collection(self, collection: str) -> chromadb.Collection:
        if collection not in self._collections:
            self._collections[collection] = self.client.get_or_create_collection(name=collection)
            self.ap.logger.info(f"Chroma collection '{collection}' accessed/created.")
        return self._collections[collection]

    def add_embeddings(
        self,
        collection: str,
        ids: list[str],
        embeddings_list: list[list[float]],
        metadatas: list[dict[str, Any]],
    ) -> None:
        col = self.get_or_create_collection(collection)
        col.add(embeddings=embeddings_list, ids=ids, metadatas=metadatas)
        self.ap.logger.info(f"Added {len(ids)} embeddings to Chroma collection '{collection}'.")

    def search(self, collection: str, query_embedding: list[float], k: int = 5) -> dict[str, Any]:
        col = self.get_or_create_collection(collection)
        results = col.query(
            query_embeddings=query_embedding,
            n_results=k,
            include=['metadatas', 'distances', 'documents'],
        )
        self.ap.logger.info(f"Chroma search in '{collection}' returned {len(results.get('ids', [[]])[0])} results.")
        return results

    def delete_by_metadata(self, collection: str, where: dict[str, Any]) -> None:
        col = self.get_or_create_collection(collection)
        col.delete(where=where)
        self.ap.logger.info(f"Deleted embeddings from Chroma collection '{collection}' with filter: {where}")
