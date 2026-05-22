from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

# Схеми для Тегів
class TagBase(BaseModel):
    name: str

class TagCreate(TagBase):
    pass

class TagResponse(TagBase):
    id: int
    
    class Config:
        from_attributes = True

# Схеми для Партитур (Нотних проєктів)
class ScoreBase(BaseModel):
    title: str
    content_xml: Optional[str] = None
    folder_id: Optional[int] = None

class ScoreCreate(ScoreBase):
    pass

class ScoreResponse(ScoreBase):
    id: int
    created_at: datetime
    updated_at: datetime
    tags: List[TagResponse] = []

    class Config:
        from_attributes = True

# Схеми для Папок
class FolderBase(BaseModel):
    name: str

class FolderCreate(FolderBase):
    pass

class FolderResponse(FolderBase):
    id: int
    scores: List[ScoreResponse] = []

    class Config:
        from_attributes = True