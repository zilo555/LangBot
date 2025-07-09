from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, LargeBinary
from sqlalchemy.orm import declarative_base, sessionmaker
from datetime import datetime
import os


Base = declarative_base()
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./rag_knowledge.db")


engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} 
)


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def create_db_and_tables():
    """Creates all database tables defined in the Base."""
    Base.metadata.create_all(bind=engine)
    print("Database tables created or already exist.")

class KnowledgeBase(Base):
    __tablename__ = 'kb'
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    embedding_model = Column(String, default='')
    top_k = Column(Integer, default=5)


class File(Base):
    __tablename__ = 'file'
    id = Column(Integer, primary_key=True, index=True)
    kb_id = Column(Integer, nullable=True)
    file_name = Column(String)
    path = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    file_type = Column(String)
    status = Column(Integer, default=0)


class Chunk(Base):
    __tablename__ = 'chunks'
    id = Column(Integer, primary_key=True, index=True)
    file_id = Column(Integer, nullable=True)

    text = Column(Text)


class Vector(Base):
    __tablename__ = 'vectors'
    id = Column(Integer, primary_key=True, index=True)
    chunk_id = Column(Integer, nullable=True)
    embedding = Column(LargeBinary)
