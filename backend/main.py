import os
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

load_dotenv()

BASE_DIR = Path(__file__).parent
DATABASE_URL = f"sqlite:///{BASE_DIR}/english_learn.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

from models import Base
Base.metadata.create_all(bind=engine)

app = FastAPI(title="English Wrong-Question Manager")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.on_event("startup")
async def register_routers():
    from routers import questions, quiz, analysis, similar, tags
    app.include_router(questions.router, prefix="/api/questions", tags=["questions"])
    app.include_router(quiz.router, prefix="/api/quiz", tags=["quiz"])
    app.include_router(analysis.router, prefix="/api/analysis", tags=["analysis"])
    app.include_router(similar.router, prefix="/api/similar", tags=["similar"])
    app.include_router(tags.router, prefix="/api/tags", tags=["tags"])
