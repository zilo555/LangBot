import sqlalchemy

from .base import Base


class LLMModel(Base):
    """LLM model"""

    __tablename__ = 'llm_models'

    uuid = sqlalchemy.Column(sqlalchemy.String(255), primary_key=True, unique=True)
    name = sqlalchemy.Column(sqlalchemy.String(255), nullable=False)
    description = sqlalchemy.Column(sqlalchemy.String(255), nullable=False)
    requester = sqlalchemy.Column(sqlalchemy.String(255), nullable=False)
    requester_config = sqlalchemy.Column(sqlalchemy.JSON, nullable=False, default={})
    api_keys = sqlalchemy.Column(sqlalchemy.JSON, nullable=False)
    abilities = sqlalchemy.Column(sqlalchemy.JSON, nullable=False, default=[])
    extra_args = sqlalchemy.Column(sqlalchemy.JSON, nullable=False, default={})
    # Source tracking for Space integration: 'local' or 'space'
    source = sqlalchemy.Column(sqlalchemy.String(32), nullable=False, server_default='local')
    # Space model ID for synced models (used to track and update synced models)
    space_model_id = sqlalchemy.Column(sqlalchemy.String(255), nullable=True)
    created_at = sqlalchemy.Column(sqlalchemy.DateTime, nullable=False, server_default=sqlalchemy.func.now())
    updated_at = sqlalchemy.Column(
        sqlalchemy.DateTime,
        nullable=False,
        server_default=sqlalchemy.func.now(),
        onupdate=sqlalchemy.func.now(),
    )


class EmbeddingModel(Base):
    """Embedding 模型"""

    __tablename__ = 'embedding_models'

    uuid = sqlalchemy.Column(sqlalchemy.String(255), primary_key=True, unique=True)
    name = sqlalchemy.Column(sqlalchemy.String(255), nullable=False)
    description = sqlalchemy.Column(sqlalchemy.String(255), nullable=False)
    requester = sqlalchemy.Column(sqlalchemy.String(255), nullable=False)
    requester_config = sqlalchemy.Column(sqlalchemy.JSON, nullable=False, default={})
    api_keys = sqlalchemy.Column(sqlalchemy.JSON, nullable=False)
    extra_args = sqlalchemy.Column(sqlalchemy.JSON, nullable=False, default={})
    # Source tracking for Space integration: 'local' or 'space'
    source = sqlalchemy.Column(sqlalchemy.String(32), nullable=False, server_default='local')
    # Space model ID for synced models (used to track and update synced models)
    space_model_id = sqlalchemy.Column(sqlalchemy.String(255), nullable=True)
    created_at = sqlalchemy.Column(sqlalchemy.DateTime, nullable=False, server_default=sqlalchemy.func.now())
    updated_at = sqlalchemy.Column(
        sqlalchemy.DateTime,
        nullable=False,
        server_default=sqlalchemy.func.now(),
        onupdate=sqlalchemy.func.now(),
    )
