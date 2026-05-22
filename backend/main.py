from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List

import models
import schemas
from database import engine, get_db

# Створюємо таблиці
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Нотний Редактор API", version="1.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# === МАРШРУТИ ДЛЯ ПАПОК (Каталогізація) ===

@app.post("/folders/", response_model=schemas.FolderResponse, status_code=201)
def create_folder(folder: schemas.FolderCreate, db: Session = Depends(get_db)):
    db_folder = models.Folder(name=folder.name)
    db.add(db_folder)
    db.commit()
    db.refresh(db_folder)
    return db_folder

@app.get("/folders/", response_model=List[schemas.FolderResponse])
def read_folders(db: Session = Depends(get_db)):
    return db.query(models.Folder).all()

@app.delete("/folders/{folder_id}", status_code=204)
def delete_folder(folder_id: int, db: Session = Depends(get_db)):
    folder = db.query(models.Folder).filter(models.Folder.id == folder_id).first()
    if not folder:
        raise HTTPException(status_code=404, detail="Папку не знайдено")
    
    # Перед видаленням папки, відв'язуємо всі її партитури (переносимо в корінь)
    db.query(models.Score).filter(models.Score.folder_id == folder_id).update({models.Score.folder_id: None})
    
    db.delete(folder)
    db.commit()
    return None

# === МАРШРУТИ ДЛЯ ПАРТИТУР (Нотних проєктів) ===

@app.post("/scores/", response_model=schemas.ScoreResponse, status_code=201)
def create_score(score: schemas.ScoreCreate, db: Session = Depends(get_db)):
    # Перевіряємо, чи існує папка, якщо її вказали
    if score.folder_id:
        folder = db.query(models.Folder).filter(models.Folder.id == score.folder_id).first()
        if not folder:
            raise HTTPException(status_code=404, detail="Вказану папку не знайдено")
            
    db_score = models.Score(
        title=score.title,
        content_xml=score.content_xml,
        folder_id=score.folder_id
    )
    db.add(db_score)
    db.commit()
    db.refresh(db_score)
    return db_score

@app.get("/scores/", response_model=List[schemas.ScoreResponse])
def read_scores(db: Session = Depends(get_db)):
    return db.query(models.Score).all()

@app.get("/")
def root():
    return {"message": "API готове до роботи з даними!"}

@app.delete("/scores/{score_id}", status_code=204)
def delete_score(score_id: int, db: Session = Depends(get_db)):
    score = db.query(models.Score).filter(models.Score.id == score_id).first()
    if not score:
        raise HTTPException(status_code=404, detail="Партитуру не знайдено")
    db.delete(score)
    db.commit()
    return None