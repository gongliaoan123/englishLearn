from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

BASE_DIR = Path(__file__).parent
DATABASE_URL = f"sqlite:///{BASE_DIR}/english_learn.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
