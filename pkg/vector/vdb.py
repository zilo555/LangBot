from __future__ import annotations
import abc
from typing import Any, Dict
import numpy as np


class VectorDatabase(abc.ABC):
    @abc.abstractmethod
    def add_embeddings(
        self,
        collection: str,
        ids: list[str],
        embeddings_list: list[list[float]],
        metadatas: list[dict[str, Any]],
        documents: list[str],
    ) -> None:
        """向指定 collection 添加向量数据。"""
        pass

    @abc.abstractmethod
    def search(self, collection: str, query_embedding: np.ndarray, k: int = 5) -> Dict[str, Any]:
        """在指定 collection 中检索最相似的向量。"""
        pass

    @abc.abstractmethod
    def delete_by_metadata(self, collection: str, where: Dict[str, Any]) -> None:
        """根据元数据删除指定 collection 中的向量。"""
        pass

    @abc.abstractmethod
    def get_or_create_collection(self, collection: str):
        """获取或创建 collection。"""
        pass
