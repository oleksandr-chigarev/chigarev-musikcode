import datetime
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text, Table
from sqlalchemy.orm import relationship
from database import Base

# Допоміжна таблиця для зв'язку "Багато-до-багатьох" (один проєкт може мати багато тегів, і навпаки) [cite: 38]
score_tags = Table(
    'score_tags', 
    Base.metadata,
    Column('score_id', Integer, ForeignKey('scores.id', ondelete="CASCADE")),
    Column('tag_id', Integer, ForeignKey('tags.id', ondelete="CASCADE"))
)

class Folder(Base):
    __tablename__ = "folders"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False) # Назва папки [cite: 38]
    
    # Зв'язок: в одній папці може бути багато партитур
    scores = relationship("Score", back_populates="folder")

class Tag(Base):
    __tablename__ = "tags"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False) # Назва тегу [cite: 38]

class Score(Base):
    __tablename__ = "scores"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False) # Назва музичного твору
    content_xml = Column(Text, nullable=True) # Тут буде зберігатися нотний текст у форматі MusicXML [cite: 20]
    
    # Поля для автоматичного збереження часу створення/редагування [cite: 37]
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
    # Зв'язок з папкою (якщо папка видаляється, проєкт залишається без папки — SET NULL) [cite: 38]
    folder_id = Column(Integer, ForeignKey('folders.id', ondelete="SET NULL"), nullable=True)
    folder = relationship("Folder", back_populates="scores")
    
    # Зв'язок з тегами [cite: 38]
    tags = relationship("Tag", secondary=score_tags)