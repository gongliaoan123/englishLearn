import os
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
load_dotenv()

from database import engine, SessionLocal, get_db
from models import Base
Base.metadata.create_all(bind=engine)

# Auto-add missing columns (for SQLite — does not auto ALTER existing tables)
with engine.connect() as conn:
    from sqlalchemy import text
    for col_def in [
        "ALTER TABLE questions ADD COLUMN explanation TEXT",
        "ALTER TABLE wrong_questions ADD COLUMN wrong_answer VARCHAR(1)",
        "ALTER TABLE questions ADD COLUMN user_id INTEGER",
        "ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT 0",
    ]:
        try:
            conn.execute(text(col_def))
            conn.commit()
        except Exception:
            pass

app = FastAPI(title="English Wrong-Question Manager")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def register_routers():
    from routers import questions, quiz, analysis, similar, tags, auth, admin
    app.include_router(questions.router, prefix="/api/questions", tags=["questions"])
    app.include_router(quiz.router, prefix="/api/quiz", tags=["quiz"])
    app.include_router(analysis.router, prefix="/api/analysis", tags=["analysis"])
    app.include_router(similar.router, prefix="/api/similar", tags=["similar"])
    app.include_router(tags.router, prefix="/api/tags", tags=["tags"])
    app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
    app.include_router(admin.router, prefix="/api", tags=["admin"])
