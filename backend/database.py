from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# ⚠️ ВАЖЛИВО: Заміни 'твій_пароль' на той пароль, який ти вводив при встановленні PostgreSQL!
# Ми підключимося до стандартної бази даних 'postgres', яка створюється автоматично.
DATABASE_URL = "postgresql://postgres:Ss122333444@localhost:5432/postgres"

# Створюємо рушій для роботи з БД
engine = create_engine(DATABASE_URL)

# Створюємо фабрику сесій для виконання запитів
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Базовий клас для створення моделей таблиць
Base = declarative_base()

# Функція (генератор) для отримання доступу до БД у маршрутах FastAPI
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()