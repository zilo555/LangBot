from sqlalchemy import create_engine, Column, String, Text, DateTime, LargeBinary, Integer
from sqlalchemy.orm import declarative_base, sessionmaker
from datetime import datetime
import os

Base = declarative_base()
DATABASE_URL = os.getenv('DATABASE_URL', 'sqlite:///./rag_knowledge.db')
print("Using database URL:", DATABASE_URL)


engine = create_engine(DATABASE_URL, connect_args={'check_same_thread': False})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def create_db_and_tables():
    """Creates all database tables defined in the Base."""
    Base.metadata.create_all(bind=engine)
    print('Database tables created or already exist.')


class KnowledgeBase(Base):
    __tablename__ = 'kb'
    id = Column(String, primary_key=True, index=True)
    name = Column(String, index=True)
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    embedding_model_uuid = Column(String, default='')
    top_k = Column(Integer, default=5)

class File(Base):
    __tablename__ = 'file'
    id = Column(String, primary_key=True, index=True)
    kb_id = Column(String, nullable=True)  
    file_name = Column(String)
    path = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    file_type = Column(String)
    status = Column(String, default='0')

class Chunk(Base):
    __tablename__ = 'chunks'
    id = Column(String, primary_key=True, index=True)
    file_id = Column(String, nullable=True)
    text = Column(Text)

class Vector(Base):
    __tablename__ = 'vectors'
    id = Column(String, primary_key=True, index=True)
    chunk_id = Column(String, nullable=True)
    embedding = Column(LargeBinary)
