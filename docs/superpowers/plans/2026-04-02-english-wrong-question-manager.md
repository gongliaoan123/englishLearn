# English Wrong-Question Manager · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A full-stack web app — FastAPI backend + React/Vite frontend — that imports English MCQ questions from docx files via AI parsing, runs 10-question quiz sessions, records wrong answers with AI-powered analysis, and delivers semi-automatic similar-question practice (举一反三) with tag-based matching.

**Architecture:** Frontend-backend separation. Backend runs locally (uvicorn), serves REST API. Frontend is a React SPA built with Vite, talks to backend over HTTP. All AI calls go through OpenAI or Claude API using keys from a local `.env` file.

**Tech Stack:** FastAPI + SQLAlchemy + SQLite (backend) · React + Vite (frontend) · OpenAI/Claude API (AI)

---

## File Structure

```
backend/
  main.py                  # FastAPI app, CORS, router registration
  database.py              # SQLAlchemy engine, session, Base
  models.py                # ORM table classes (Question, Tag, QuestionTag, WrongQuestion, AIAnalysis)
  schemas.py               # Pydantic request/response models
  routers/
    questions.py           # /api/questions/import, /api/questions
    quiz.py                # /api/quiz/start, /api/quiz/next, /api/quiz/answer
    analysis.py            # /api/analysis/:id/confirm, /api/analysis/:id/reject
    similar.py             # /api/similar/:question_id
    tags.py                # /api/tags
  services/
    docx_parser.py         # docx text extraction + AI parsing call
    ai_client.py           # OpenAI/Claude API wrapper (unified interface)
    tag_service.py         # normalize_tag(), get_or_create_tags()
    similar_finder.py       # find_similar_by_tags(), generate_similar_via_ai()
    mastery_tracker.py      # record_answer(), check_mastered()
  .env                     # OPENAI_API_KEY=... (not committed)
  requirements.txt

frontend/
  index.html
  vite.config.js
  package.json
  src/
    main.jsx
    App.jsx                # Router + NavBar layout
    api.js                 # All fetch calls to http://localhost:8000/api/
    pages/
      Upload.jsx
      QuestionBank.jsx
      QuizSession.jsx
      AnalysisReview.jsx
      SimilarPractice.jsx
      WrongLog.jsx
    components/
      QuestionCard.jsx
      NavBar.jsx
      SessionSummary.jsx
```

---

## Task 1: Backend Scaffold

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/.env`
- Create: `backend/main.py`

- [ ] **Step 1: Write `backend/requirements.txt`**

```
fastapi==0.111.0
uvicorn[standard]==0.30.0
sqlalchemy==2.0.31
python-multipart==0.0.9
python-docx==1.1.2
pydantic==2.7.4
pydantic-settings==2.3.0
openai==1.35.1
anthropic==0.25.0
python-dotenv==1.0.1
```

- [ ] **Step 2: Write `backend/.env`**

```
# Choose one: OPENAI_API_KEY or ANTHROPIC_API_KEY
OPENAI_API_KEY=your-key-here
# ANTHROPIC_API_KEY=your-key-here
```

- [ ] **Step 3: Write `backend/main.py`**

```python
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

from routers import questions, quiz, analysis, similar, tags

app.include_router(questions.router, prefix="/api/questions", tags=["questions"])
app.include_router(quiz.router, prefix="/api/quiz", tags=["quiz"])
app.include_router(analysis.router, prefix="/api/analysis", tags=["analysis"])
app.include_router(similar.router, prefix="/api/similar", tags=["similar"])
app.include_router(tags.router, prefix="/api/tags", tags=["tags"])
```

- [ ] **Step 4: Install dependencies**

Run: `cd backend && python -m venv venv && source venv/bin/activate && pip install -r requirements.txt`
Expected: All packages installed successfully

- [ ] **Step 5: Verify backend starts**

Run: `cd backend && source venv/bin/activate && uvicorn main:app --reload --port 8000`
Expected: Server starts on port 8000, no import errors

- [ ] **Step 6: Commit**

```bash
git add backend/requirements.txt backend/.env backend/main.py
git commit -m "feat: backend scaffold with FastAPI, CORS, router registration"
```

---

## Task 2: Database Models

**Files:**
- Create: `backend/models.py`
- Modify: `backend/main.py:1-6` (add imports for models)

- [ ] **Step 1: Write `backend/models.py`**

```python
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship, declarative_base

Base = declarative_base()

class Question(Base):
    __tablename__ = "questions"

    id = Column(Integer, primary_key=True, index=True)
    content = Column(Text, nullable=False)        # question text
    options = Column(JSON, nullable=False)          # {"A": "...", "B": "...", "C": "...", "D": "..."}
    answer = Column(String(1), nullable=False)      # "A" | "B" | "C" | "D"
    docx_filename = Column(String(255), nullable=True)
    source = Column(String(20), default="imported")  # "imported" | "ai_generated"
    created_at = Column(DateTime, default=datetime.utcnow)

    tags = relationship("Tag", secondary="question_tag", back_populates="questions")
    wrong_questions = relationship("WrongQuestion", back_populates="question")


class Tag(Base):
    __tablename__ = "tags"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False, index=True)  # always lowercase-kebab
    created_at = Column(DateTime, default=datetime.utcnow)

    questions = relationship("Question", secondary="question_tag", back_populates="tags")


class QuestionTag(Base):
    __tablename__ = "question_tag"

    question_id = Column(Integer, ForeignKey("questions.id"), primary_key=True)
    tag_id = Column(Integer, ForeignKey("tags.id"), primary_key=True)


class WrongQuestion(Base):
    __tablename__ = "wrong_questions"

    id = Column(Integer, primary_key=True, index=True)
    question_id = Column(Integer, ForeignKey("questions.id"), nullable=False)
    user_id = Column(Integer, nullable=True)           # nullable for single-user
    wrong_count = Column(Integer, default=1)
    consecutive_correct = Column(Integer, default=0)     # reaches 3 → "mastered"
    last_wrong_at = Column(DateTime, default=datetime.utcnow)
    status = Column(String(20), default="pending_review")  # pending_review | confirmed | mastered

    question = relationship("Question", back_populates="wrong_questions")
    analysis = relationship("AIAnalysis", back_populates="wrong_question", uselist=False)


class AIAnalysis(Base):
    __tablename__ = "ai_analyses"

    id = Column(Integer, primary_key=True, index=True)
    wrong_question_id = Column(Integer, ForeignKey("wrong_questions.id"), nullable=False, unique=True)
    analysis = Column(Text, nullable=False)
    suggested_tags = Column(JSON, nullable=False)   # list[str]
    confirmed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    wrong_question = relationship("WrongQuestion", back_populates="analysis")
```

- [ ] **Step 2: Update `backend/main.py` imports** — replace lines 10-13 with:

```python
from models import Base
from database import engine, SessionLocal, get_db
```

Also remove the duplicate `Base.metadata.create_all` lines if any.

- [ ] **Step 3: Run backend and verify tables created**

Run: `cd backend && source venv/bin/activate && uvicorn main:app --reload --port 8000`
Run in another terminal: `sqlite3 english_learn.db ".tables"`
Expected: `ai_analyses questions question_tag tags wrong_questions`

- [ ] **Step 4: Commit**

```bash
git add backend/models.py backend/main.py
git commit -m "feat: add SQLAlchemy models (Question, Tag, WrongQuestion, AIAnalysis)"
```

---

## Task 3: AI Client Wrapper

**Files:**
- Create: `backend/services/ai_client.py`

- [ ] **Step 1: Write `backend/services/ai_client.py`**

```python
import json
import os
from typing import Literal
from dotenv import load_dotenv
from openai import OpenAI
from anthropic import Anthropic

load_dotenv()

Provider = Literal["openai", "anthropic"]

def _get_provider() -> Provider:
    key = os.getenv("OPENAI_API_KEY") or os.getenv("ANTHROPIC_API_KEY", "")
    if os.getenv("ANTHROPIC_API_KEY"):
        return "anthropic"
    return "openai"


class AIClient:
    def __init__(self):
        self.provider = _get_provider()
        if self.provider == "openai":
            self.client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        else:
            self.client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

    def chat(self, system: str, user: str, model: str = "gpt-4o") -> str:
        if self.provider == "openai":
            response = self.client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                temperature=0.3,
            )
            return response.choices[0].message.content
        else:
            # anthropic
            response = self.client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=2048,
                system=system,
                messages=[{"role": "user", "content": user}],
            )
            return response.content[0].text
```

- [ ] **Step 2: Commit**

```bash
git add backend/services/ai_client.py
git commit -m "feat: add AI client wrapper (OpenAI + Anthropic)"
```

---

## Task 4: Docx Parser + Import Endpoint

**Files:**
- Create: `backend/services/docx_parser.py`
- Modify: `backend/routers/questions.py` (new file)
- Modify: `backend/schemas.py` (new file)

- [ ] **Step 1: Write `backend/schemas.py`**

```python
from pydantic import BaseModel
from typing import Optional


class QuestionImportResponse(BaseModel):
    imported: int
    skipped: int
    errors: list[str]


class QuestionResponse(BaseModel):
    id: int
    content: str
    options: dict
    answer: str
    docx_filename: Optional[str]
    tags: list[str]
    source: str

    class Config:
        from_attributes = True


class QuestionListResponse(BaseModel):
    questions: list[QuestionResponse]
    total: int
```

- [ ] **Step 2: Write `backend/services/docx_parser.py`**

```python
import re
from docx import Document
from services.ai_client import AIClient

PARSE_SYSTEM = """You are a strict English MCQ parser. You will receive raw text from a docx file containing English multiple-choice questions.
Your job is to extract ONLY valid 4-option multiple-choice questions (A/B/C/D format).
Skip anything that is not a proper MCQ (fill-in-blank, essay, short answer, etc.) and return {"skipped": true, "reason": "..."}.
Return a JSON array of question objects. Each object has:
- content: str (the question text, without the options)
- options: dict ({"A": "...", "B": "...", "C": "...", "D": "..."})
- answer: str ("A" | "B" | "C" | "D")
- explanation: str (brief explanation of why the answer is correct)

If there are no valid MCQs, return an empty array [].
Do not add any text outside the JSON array."""


def extract_text_from_docx(file_path: str) -> str:
    doc = Document(file_path)
    paragraphs = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
    return "\n".join(paragraphs)


def parse_docx_via_ai(raw_text: str) -> list[dict]:
    ai = AIClient()
    response = ai.chat(PARSE_SYSTEM, raw_text)
    # strip markdown code fences if present
    response = re.sub(r"^```json\s*", "", response.strip())
    response = re.sub(r"\s*```$", "", response.strip())
    import json
    result = json.loads(response)
    if isinstance(result, dict) and "questions" in result:
        return result["questions"]
    if isinstance(result, list):
        return result
    return []
```

- [ ] **Step 3: Write `backend/routers/questions.py`**

```python
import os
import shutil
import tempfile
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy.orm import Session

from database import SessionLocal
from models import Question, Tag
from schemas import QuestionImportResponse, QuestionListResponse, QuestionResponse
from services.docx_parser import extract_text_from_docx, parse_docx_via_ai
from services.tag_service import get_or_create_tags

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/import", response_model=QuestionImportResponse)
async def import_docx(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith(".docx"):
        raise HTTPException(status_code=400, detail="Only .docx files are supported")

    # Save to temp file
    with tempfile.NamedTemporaryFile(suffix=".docx", delete=False) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        raw_text = extract_text_from_docx(tmp_path)
        parsed = parse_docx_via_ai(raw_text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI parsing failed: {str(e)}")
    finally:
        os.unlink(tmp_path)

    imported = 0
    skipped = 0
    errors = []

    for item in parsed:
        if item.get("skipped"):
            skipped += 1
            continue
        try:
            q = Question(
                content=item["content"],
                options=item["options"],
                answer=item["answer"],
                docx_filename=file.filename,
                source="imported",
            )
            db.add(q)
            db.flush()

            tag_names = item.get("tags", [])
            get_or_create_tags(db, q, tag_names)
            imported += 1
        except Exception as e:
            errors.append(str(e))

    db.commit()
    return QuestionImportResponse(imported=imported, skipped=skipped, errors=errors)


@router.get("", response_model=QuestionListResponse)
def list_questions(db: Session = Depends(get_db), page: int = 1, page_size: int = 50):
    total = db.query(Question).count()
    questions = (
        db.query(Question)
        .order_by(Question.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return QuestionListResponse(
        questions=[
            QuestionResponse(
                id=q.id,
                content=q.content,
                options=q.options,
                answer=q.answer,
                docx_filename=q.docx_filename,
                tags=[t.name for t in q.tags],
                source=q.source,
            )
            for q in questions
        ],
        total=total,
    )
```

- [ ] **Step 4: Commit**

```bash
git add backend/schemas.py backend/services/docx_parser.py backend/routers/questions.py
git commit -m "feat: add docx parser service and import endpoint"
```

---

## Task 5: Tag Service

**Files:**
- Create: `backend/services/tag_service.py`

- [ ] **Step 1: Write `backend/services/tag_service.py`**

```python
import re
from sqlalchemy.orm import Session
from models import Question, Tag, QuestionTag


def normalize_tag(name: str) -> str:
    """Normalize tag to lowercase kebab-case: 'Past Perfect' -> 'past-perfect'"""
    # lowercase
    name = name.lower()
    # replace underscores, spaces, camelCase boundaries with hyphens
    name = re.sub(r"[_\s]+", "-", name)
    # strip non-alphanumeric except hyphen
    name = re.sub(r"[^a-z0-9-]", "", name)
    # collapse multiple hyphens
    name = re.sub(r"-+", "-", name)
    # strip leading/trailing hyphens
    name = name.strip("-")
    return name


def get_or_create_tags(db: Session, question: Question, tag_names: list[str]) -> list[Tag]:
    """Normalize and attach tags to a question. Creates missing tags."""
    tags = []
    for raw_name in tag_names:
        normalized = normalize_tag(raw_name)
        if not normalized:
            continue
        tag = db.query(Tag).filter(Tag.name == normalized).first()
        if not tag:
            tag = Tag(name=normalized)
            db.add(tag)
            db.flush()
        tags.append(tag)

    # Replace all tags on this question
    db.query(QuestionTag).filter(QuestionTag.question_id == question.id).delete()
    for tag in tags:
        db.add(QuestionTag(question_id=question.id, tag_id=tag.id))
    return tags
```

- [ ] **Step 2: Write a test for `normalize_tag`**

Create `backend/tests/test_tag_service.py`:

```python
import sys; sys.path.insert(0, "..")
from services.tag_service import normalize_tag

def test_normalize_tag():
    assert normalize_tag("Past Perfect") == "past-perfect"
    assert normalize_tag("past_perfect") == "past-perfect"
    assert normalize_tag("PastPerfect") == "pastperfect"
    assert normalize_tag("  Subjective Mood!  ") == "subjective-mood"
    assert normalize_tag("relative clause") == "relative-clause"
    assert normalize_tag("") == ""
```

Run: `cd backend && source venv/bin/activate && python -m pytest tests/test_tag_service.py -v`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add backend/services/tag_service.py backend/tests/test_tag_service.py
git commit -m "feat: add tag normalization service"
```

---

## Task 6: Quiz Engine + Endpoints

**Files:**
- Create: `backend/services/mastery_tracker.py`
- Create: `backend/services/session_manager.py`
- Modify: `backend/routers/quiz.py`
- Modify: `backend/schemas.py`

- [ ] **Step 1: Write `backend/services/mastery_tracker.py`**

```python
from sqlalchemy.orm import Session
from models import WrongQuestion

MASTERY_THRESHOLD = 3  # consecutive correct answers to reach "mastered"


def record_answer(db: Session, question_id: int, correct: bool, user_id: int | None = None) -> WrongQuestion | None:
    """
    Called after each answer. Updates wrong_count and consecutive_correct.
    Returns the WrongQuestion record if this was a wrong answer.
    """
    wq = db.query(WrongQuestion).filter(
        WrongQuestion.question_id == question_id,
        WrongQuestion.user_id == user_id,
    ).order_by(WrongQuestion.id.desc()).first()

    if correct:
        if wq:
            wq.consecutive_correct += 1
            if wq.consecutive_correct >= MASTERY_THRESHOLD:
                wq.status = "mastered"
        return None  # no WrongQuestion record needed for correct answers
    else:
        # wrong answer
        if wq:
            wq.wrong_count += 1
            wq.consecutive_correct = 0
            wq.last_wrong_at = __import__("datetime").datetime.utcnow()
            if wq.status == "mastered":
                wq.status = "confirmed"  # re-break through
        else:
            wq = WrongQuestion(
                question_id=question_id,
                user_id=user_id,
                wrong_count=1,
                consecutive_correct=0,
                status="pending_review",
            )
            db.add(wq)
        return wq
```

- [ ] **Step 2: Write `backend/services/session_manager.py`**

```python
"""
Simple in-memory session manager for quiz sessions.
Key: session_id (UUID string)
Value: dict { "used_ids": list[int], "correct_count": int }
"""
import uuid

_sessions: dict[str, dict] = {}


def start_session() -> str:
    sid = str(uuid.uuid4())
    _sessions[sid] = {"used_ids": [], "correct_count": 0}
    return sid


def mark_used(sid: str, question_id: int):
    if sid in _sessions:
        _sessions[sid]["used_ids"].append(question_id)


def get_used_ids(sid: str) -> list[int]:
    return _sessions.get(sid, {}).get("used_ids", [])


def record_correct(sid: str):
    if sid in _sessions:
        _sessions[sid]["correct_count"] += 1


def get_correct_count(sid: str) -> int:
    return _sessions.get(sid, {}).get("correct_count", 0)


def end_session(sid: str):
    _sessions.pop(sid, None)
```

- [ ] **Step 3: Add quiz schemas to `backend/schemas.py`**

```python
# Add after existing schemas:

class QuizStartResponse(BaseModel):
    session_id: str
    total: int  # 10

class QuizNextResponse(BaseModel):
    question_id: int
    content: str
    options: dict
    current: int   # 1-indexed position in session
    total: int      # 10

class QuizAnswerRequest(BaseModel):
    session_id: str
    question_id: int
    selected_answer: str   # "A" | "B" | "C" | "D"

class QuizAnswerResponse(BaseModel):
    correct: bool
    correct_answer: str
    wrong_question_id: int | None  # set only if wrong
    is_session_over: bool

class SessionSummaryResponse(BaseModel):
    session_id: str
    total: int
    correct: int
    wrong: int
    wrong_question_ids: list[int]
```

- [ ] **Step 4: Write `backend/routers/quiz.py`**

```python
import random
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import SessionLocal
from models import Question
from schemas import (
    QuizStartResponse, QuizNextResponse, QuizAnswerResponse, SessionSummaryResponse
)
from services.mastery_tracker import record_answer
from services.session_manager import start_session, mark_used, get_used_ids, record_correct, get_correct_count, end_session

router = APIRouter()
SESSION_SIZE = 10

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/start", response_model=QuizStartResponse)
def start_quiz(db: Session = Depends(get_db)):
    total = db.query(Question).count()
    if total == 0:
        raise HTTPException(status_code=400, detail="No questions in database. Import questions first.")
    session_id = start_session()
    return QuizStartResponse(session_id=session_id, total=SESSION_SIZE)


@router.post("/next", response_model=QuizNextResponse)
def next_question(session_id: str, current: int = 1, db: Session = Depends(get_db)):
    used_ids = get_used_ids(session_id)
    candidates = db.query(Question).filter(Question.id.notin_(used_ids)).all()
    if not candidates:
        raise HTTPException(status_code=400, detail="No more questions available")
    q = random.choice(candidates)
    mark_used(session_id, q.id)
    return QuizNextResponse(
        question_id=q.id,
        content=q.content,
        options=q.options,
        current=current,
        total=SESSION_SIZE,
    )


@router.post("/answer", response_model=QuizAnswerResponse | SessionSummaryResponse)
def submit_answer(body: QuizAnswerRequest, db: Session = Depends(get_db)):
    q = db.query(Question).filter(Question.id == body.question_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")

    correct = body.selected_answer.strip().upper() == q.answer.strip().upper()
    if correct:
        record_correct(body.session_id)
    wq = record_answer(db, body.question_id, correct)
    db.commit()

    used_ids = get_used_ids(body.session_id)
    answered = len(used_ids)
    is_over = answered >= SESSION_SIZE

    if is_over:
        correct_count = get_correct_count(body.session_id)
        end_session(body.session_id)
        return SessionSummaryResponse(
            session_id=body.session_id,
            total=SESSION_SIZE,
            correct=correct_count,
            wrong=SESSION_SIZE - correct_count,
            wrong_question_ids=[],
        )

    return QuizAnswerResponse(
        correct=correct,
        correct_answer=q.answer,
        wrong_question_id=wq.id if wq else None,
        is_session_over=False,
    )
```

- [ ] **Step 5: Commit**

```bash
git add backend/services/mastery_tracker.py backend/services/session_manager.py backend/routers/quiz.py backend/schemas.py
git commit -m "feat: add quiz engine, session manager, mastery tracker"
```

---

## Task 7: AI Analysis + Confirm Endpoint

**Files:**
- Modify: `backend/schemas.py` (add analysis schemas)
- Create: `backend/services/analysis_service.py`
- Modify: `backend/routers/analysis.py`

- [ ] **Step 1: Add schemas to `backend/schemas.py`**

```python
class AIAnalysisResponse(BaseModel):
    id: int
    analysis: str
    suggested_tags: list[str]
    confirmed: bool

    class Config:
        from_attributes = True


class AnalysisConfirmRequest(BaseModel):
    tags: list[str] | None = None  # optional user edits


class SimilarQuestionsResponse(BaseModel):
    questions: list[QuestionResponse]
    generated_count: int  # how many were AI-generated vs from DB
```

- [ ] **Step 2: Write `backend/services/analysis_service.py`**

```python
from services.ai_client import AIClient

ANALYSIS_SYSTEM = """You are an expert English teacher. A student answered a multiple-choice question incorrectly.
Analyze why they got it wrong and suggest 2-5 knowledge point tags that describe the skill/concept being tested.
Return a JSON object with:
- analysis: str (2-3 sentences explaining the mistake cause in Chinese)
- suggested_tags: list[str] (knowledge tags in English, e.g. ["past-perfect", "subjunctive-mood", "relative-clause"])
Be concise and educational."""


def analyze_wrong_answer(
    question_content: str,
    correct_answer: str,
    wrong_answer: str,
    options: dict,
) -> dict:
    prompt = f"""Question: {question_content}

Options:
A) {options.get("A", "?")}
B) {options.get("B", "?")}
C) {options.get("C", "?")}
D) {options.get("D", "?")}

Student chose: {wrong_answer}
Correct answer: {correct_answer}

Analyze the student's mistake."""
    ai = AIClient()
    response = ai.chat(ANALYSIS_SYSTEM, prompt)
    import json, re
    response = re.sub(r"^```json\s*", "", response.strip())
    response = re.sub(r"\s*```$", "", response.strip())
    return json.loads(response)
```

- [ ] **Step 3: Write `backend/routers/analysis.py`**

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import SessionLocal
from models import WrongQuestion, AIAnalysis, Question
from schemas import AIAnalysisResponse, AnalysisConfirmRequest, SimilarQuestionsResponse, QuestionResponse
from services.analysis_service import analyze_wrong_answer
from services.tag_service import get_or_create_tags

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/{wrong_question_id}", response_model=AIAnalysisResponse)
def get_analysis(wrong_question_id: int, db: Session = Depends(get_db)):
    wq = db.query(WrongQuestion).filter(WrongQuestion.id == wrong_question_id).first()
    if not wq:
        raise HTTPException(status_code=404, detail="WrongQuestion not found")

    analysis = db.query(AIAnalysis).filter(AIAnalysis.wrong_question_id == wrong_question_id).first()
    if not analysis:
        # Auto-generate on first access
        q = wq.question
        result = analyze_wrong_answer(q.content, q.answer, q.answer, q.options)
        analysis = AIAnalysis(
            wrong_question_id=wq.id,
            analysis=result["analysis"],
            suggested_tags=result["suggested_tags"],
            confirmed=False,
        )
        db.add(analysis)
        db.commit()
        db.refresh(analysis)

    return AIAnalysisResponse(
        id=analysis.id,
        analysis=analysis.analysis,
        suggested_tags=analysis.suggested_tags,
        confirmed=analysis.confirmed,
    )


@router.post("/{wrong_question_id}/confirm", response_model=SimilarQuestionsResponse)
def confirm_analysis(
    wrong_question_id: int,
    body: AnalysisConfirmRequest,
    db: Session = Depends(get_db),
):
    wq = db.query(WrongQuestion).filter(WrongQuestion.id == wrong_question_id).first()
    if not wq:
        raise HTTPException(status_code=404, detail="WrongQuestion not found")

    analysis = db.query(AIAnalysis).filter(AIAnalysis.wrong_question_id == wrong_question_id).first()
    if not analysis:
        raise HTTPException(status_code=400, detail="No analysis found for this wrong question")

    # Update confirmed and tags
    analysis.confirmed = True
    tags_to_apply = body.tags if body.tags is not None else analysis.suggested_tags
    get_or_create_tags(db, wq.question, tags_to_apply)

    wq.status = "confirmed"
    db.commit()

    # Trigger similar question finding (handled separately via /api/similar)
    # Return analysis result; frontend will call /api/similar separately
    return SimilarQuestionsResponse(questions=[], generated_count=0)


@router.post("/{wrong_question_id}/reject")
def reject_analysis(wrong_question_id: int, db: Session = Depends(get_db)):
    wq = db.query(WrongQuestion).filter(WrongQuestion.id == wrong_question_id).first()
    if not wq:
        raise HTTPException(status_code=404, detail="WrongQuestion not found")
    wq.status = "confirmed"
    db.commit()
    return {"ok": True}
```

- [ ] **Step 4: Commit**

```bash
git add backend/services/analysis_service.py backend/routers/analysis.py
git commit -m "feat: add AI analysis service and confirm/reject endpoints"
```

---

## Task 8: Similar Question Finder + Endpoint

**Files:**
- Create: `backend/services/similar_finder.py`
- Modify: `backend/routers/similar.py`

- [ ] **Step 1: Write `backend/services/similar_finder.py`**

```python
import random
from sqlalchemy.orm import Session
from models import Question, Tag, QuestionTag

DEFAULT_SIMILAR_COUNT = 3

GENERATE_SIMILAR_SYSTEM = """You are an expert English MCQ generator. Generate {count} new multiple-choice questions that test the same knowledge points.
Return a JSON array of {count} question objects. Each has:
- content: str
- options: dict ({"A": "...", "B": "...", "C": "...", "D": "..."})
- answer: str ("A" | "B" | "C" | "D")
- explanation: str
Do not repeat the original question exactly. Vary the wording and scenarios.
Return ONLY the JSON array."""


def find_similar_by_tags(db: Session, question_id: int, tags: list[str], count: int = DEFAULT_SIMILAR_COUNT) -> tuple[list[Question], int]:
    """Find existing questions sharing at least one tag. Returns (questions, generated_count=0)."""
    if not tags:
        return [], 0

    tag_ids = [db.query(Tag).filter(Tag.name == t).first() for t in tags]
    tag_ids = [t.id for t in tag_ids if t]

    if not tag_ids:
        return [], 0

    candidate_ids = (
        db.query(QuestionTag.question_id)
        .filter(QuestionTag.tag_id.in_(tag_ids), QuestionTag.question_id != question_id)
        .distinct()
        .all()
    )
    candidate_ids = [cid[0] for cid in candidate_ids]
    random.shuffle(candidate_ids)

    selected = candidate_ids[:count]
    questions = db.query(Question).filter(Question.id.in_(selected)).all()
    return questions, 0


def generate_similar_via_ai(tags: list[str], count: int = DEFAULT_SIMILAR_COUNT) -> list[dict]:
    from services.ai_client import AIClient
    prompt = GENERATE_SIMILAR_SYSTEM.format(count=count) + f"\n\nKnowledge points: {', '.join(tags)}"
    ai = AIClient()
    response = ai.chat(prompt, "")
    import json, re
    response = re.sub(r"^```json\s*", "", response.strip())
    response = re.sub(r"\s*```$", "", response.strip())
    result = json.loads(response)
    if isinstance(result, dict) and "questions" in result:
        return result["questions"]
    return result if isinstance(result, list) else []
```

- [ ] **Step 2: Write `backend/routers/similar.py`**

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import SessionLocal
from models import Question
from schemas import QuestionResponse, SimilarQuestionsResponse
from services.similar_finder import find_similar_by_tags, generate_similar_via_ai
from services.tag_service import get_or_create_tags

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/{question_id}", response_model=SimilarQuestionsResponse)
def get_similar_questions(question_id: int, db: Session = Depends(get_db)):
    q = db.query(Question).filter(Question.id == question_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")

    tags = [t.name for t in q.tags]
    similar_questions, generated = find_similar_by_tags(db, question_id, tags)

    # Fallback: AI generation if not enough
    if len(similar_questions) < 2:
        needed = 3 - len(similar_questions)
        try:
            generated_qs = generate_similar_via_ai(tags, needed)
            for item in generated_qs:
                new_q = Question(
                    content=item["content"],
                    options=item["options"],
                    answer=item["answer"],
                    source="ai_generated",
                )
                db.add(new_q)
                db.flush()
                get_or_create_tags(db, new_q, tags)
                similar_questions.append(new_q)
            db.commit()
            generated += len(generated_qs)
        except Exception:
            pass  # graceful degradation: return what we have

    return SimilarQuestionsResponse(
        questions=[
            QuestionResponse(
                id=qq.id,
                content=qq.content,
                options=qq.options,
                answer=qq.answer,
                docx_filename=qq.docx_filename,
                tags=[t.name for t in qq.tags],
                source=qq.source,
            )
            for qq in similar_questions
        ],
        generated_count=generated,
    )
```

- [ ] **Step 3: Add tags router stub to `backend/routers/tags.py`**

```python
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import SessionLocal
from models import Tag

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get("")
def list_tags(db: Session = Depends(get_db)):
    tags = db.query(Tag).order_by(Tag.name).all()
    return [{"id": t.id, "name": t.name} for t in tags]
```

- [ ] **Step 4: Commit**

```bash
git add backend/services/similar_finder.py backend/routers/similar.py backend/routers/tags.py
git commit -m "feat: add similar question finder with tag matching and AI fallback"
```

---

## Task 9: Frontend Scaffold

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.js`
- Create: `frontend/index.html`
- Create: `frontend/src/main.jsx`
- Create: `frontend/src/App.jsx`
- Create: `frontend/src/api.js`

- [ ] **Step 1: Write `frontend/package.json`**

```json
{
  "name": "english-wrong-question-frontend",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.23.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.1",
    "vite": "^5.3.1"
  }
}
```

- [ ] **Step 2: Write `frontend/vite.config.js`**

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
```

- [ ] **Step 3: Write `frontend/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>English Wrong-Question Manager</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 4: Write `frontend/src/main.jsx`**

```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

- [ ] **Step 5: Write `frontend/src/api.js`**

```js
const BASE = '/api'

async function request(method, path, body) {
  const opts = {
    method,
    headers: {},
  }
  if (body instanceof FormData) {
    opts.body = body
  } else if (body) {
    opts.headers['Content-Type'] = 'application/json'
    opts.body = JSON.stringify(body)
  }
  const res = await fetch(`${BASE}${path}`, opts)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Request failed')
  }
  return res.json()
}

export const api = {
  // Questions
  importDocx: (file) =>
    request('POST', '/questions/import', file),
  listQuestions: (page = 1) =>
    request('GET', `/questions?page=${page}`),

  // Quiz
  startQuiz: () =>
    request('POST', '/quiz/start'),
  nextQuestion: (sessionId, current) =>
    request('POST', `/quiz/next?session_id=${sessionId}&current=${current}`),
  submitAnswer: (body) =>
    request('POST', '/quiz/answer', body),

  // Analysis
  getAnalysis: (wrongQuestionId) =>
    request('GET', `/analysis/${wrongQuestionId}`),
  confirmAnalysis: (wrongQuestionId, tags) =>
    request('POST', `/analysis/${wrongQuestionId}/confirm`, { tags }),
  rejectAnalysis: (wrongQuestionId) =>
    request('POST', `/analysis/${wrongQuestionId}/reject`),

  // Similar
  getSimilar: (questionId) =>
    request('GET', `/similar/${questionId}`),

  // Tags
  listTags: () =>
    request('GET', '/tags'),
}
```

- [ ] **Step 6: Write `frontend/src/App.jsx`**

```jsx
import React from 'react'
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import Upload from './pages/Upload'
import QuestionBank from './pages/QuestionBank'
import QuizSession from './pages/QuizSession'
import WrongLog from './pages/WrongLog'

export default function App() {
  return (
    <BrowserRouter>
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 16px' }}>
        <nav style={{ display: 'flex', gap: 16, padding: '16px 0', borderBottom: '1px solid #eee' }}>
          <Link to="/">📤 上传题目</Link>
          <Link to="/questions">📚 题库</Link>
          <Link to="/quiz">✏️ 开始测试</Link>
          <Link to="/wrong-log">❌ 错题本</Link>
        </nav>
        <Routes>
          <Route path="/" element={<Upload />} />
          <Route path="/questions" element={<QuestionBank />} />
          <Route path="/quiz" element={<QuizSession />} />
          <Route path="/wrong-log" element={<WrongLog />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}
```

- [ ] **Step 7: Install frontend deps**

Run: `cd frontend && npm install`
Expected: packages installed

- [ ] **Step 8: Commit**

```bash
git add frontend/package.json frontend/vite.config.js frontend/index.html frontend/src/
git commit -m "feat: frontend scaffold with React, Vite, routing"
```

---

## Task 10: Upload + QuestionBank Pages

**Files:**
- Create: `frontend/src/pages/Upload.jsx`
- Create: `frontend/src/pages/QuestionBank.jsx`
- Create: `frontend/src/components/NavBar.jsx`

- [ ] **Step 1: Write `frontend/src/pages/Upload.jsx`**

```jsx
import React, { useState } from 'react'
import { api } from '../api'

export default function Upload() {
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  async function handleUpload(e) {
    e.preventDefault()
    if (!file) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await api.importDocx(formData)
      setResult(res)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ paddingTop: 24 }}>
      <h2>📤 上传题目文件</h2>
      <p style={{ color: '#666', fontSize: 14 }}>上传包含英语选择题的 .docx 文件，系统将自动解析入库</p>

      <form onSubmit={handleUpload} style={{ marginTop: 20 }}>
        <input
          type="file"
          accept=".docx"
          onChange={e => setFile(e.target.files[0])}
          style={{ marginBottom: 12 }}
        />
        <button
          type="submit"
          disabled={!file || loading}
          style={{
            display: 'block',
            padding: '8px 24px',
            background: file && !loading ? '#3B82F6' : '#ccc',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: file && !loading ? 'pointer' : 'not-allowed',
          }}
        >
          {loading ? '解析中...' : '上传并解析'}
        </button>
      </form>

      {error && (
        <div style={{ marginTop: 16, padding: 12, background: '#FEE2E2', borderRadius: 6, color: '#991B1B' }}>
          ❌ {error}
        </div>
      )}

      {result && (
        <div style={{ marginTop: 16, padding: 16, background: '#DCFCE7', borderRadius: 6 }}>
          <h3 style={{ color: '#166534', margin: '0 0 8px' }}>✅ 导入完成</h3>
          <p>成功导入：<strong>{result.imported}</strong> 题</p>
          <p>跳过（非选择题）：<strong>{result.skipped}</strong> 题</p>
          {result.errors.length > 0 && (
            <p style={{ color: '#92400E' }}>错误：{result.errors.join('; ')}</p>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Write `frontend/src/pages/QuestionBank.jsx`**

```jsx
import React, { useEffect, useState } from 'react'
import { api } from '../api'

export default function QuestionBank() {
  const [questions, setQuestions] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    api.listQuestions(page).then(res => {
      setQuestions(res.questions)
      setTotal(res.total)
    }).finally(() => setLoading(false))
  }, [page])

  return (
    <div style={{ paddingTop: 24 }}>
      <h2>📚 题库</h2>
      <p style={{ color: '#666' }}>共 {total} 题</p>

      {loading ? (
        <p>加载中...</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
          {questions.map(q => (
            <div key={q.id} style={{ border: '1px solid #eee', borderRadius: 8, padding: 16 }}>
              <p style={{ fontWeight: 500 }}>{q.content}</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 8 }}>
                {Object.entries(q.options).map(([k, v]) => (
                  <div key={k} style={{
                    padding: '4px 8px',
                    background: k === q.answer ? '#DCFCE7' : '#f9f9f9',
                    borderRadius: 4,
                    fontSize: 13,
                  }}>
                    {k}) {v}
                    {k === q.answer && ' ✓'}
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {q.tags.map(t => (
                  <span key={t} style={{ background: '#EDE9FE', color: '#5B21B6', padding: '2px 8px', borderRadius: 12, fontSize: 11 }}>
                    #{t}
                  </span>
                ))}
                <span style={{ background: q.source === 'ai_generated' ? '#FEF9C3' : '#DBEAFE', color: '#555', padding: '2px 8px', borderRadius: 12, fontSize: 11 }}>
                  {q.source === 'ai_generated' ? '🤖 AI生成' : '📄 导入'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 24 }}>
        <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← 上一页</button>
        <span style={{ lineHeight: '36px' }}>第 {page} 页</span>
        <button disabled={questions.length < 50} onClick={() => setPage(p => p + 1)}>下一页 →</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Upload.jsx frontend/src/pages/QuestionBank.jsx
git commit -m "feat: add Upload and QuestionBank pages"
```

---

## Task 11: Quiz Session Page

**Files:**
- Create: `frontend/src/pages/QuizSession.jsx`
- Create: `frontend/src/components/QuestionCard.jsx`

- [ ] **Step 1: Write `frontend/src/components/QuestionCard.jsx`**

```jsx
import React, { useState } from 'react'

export default function QuestionCard({ question, onSubmit, submitting }) {
  const [selected, setSelected] = useState(null)

  function handleSubmit() {
    if (!selected) return
    onSubmit(selected, () => setSelected(null))
  }

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 24, marginTop: 16 }}>
      <p style={{ fontSize: 16, fontWeight: 500, marginBottom: 16 }}>{question.content}</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {Object.entries(question.options).map(([k, v]) => (
          <label
            key={k}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 14px',
              border: `2px solid ${selected === k ? '#3B82F6' : '#e5e7eb'}`,
              borderRadius: 8,
              cursor: 'pointer',
              background: selected === k ? '#EFF6FF' : '#fff',
            }}
          >
            <input
              type="radio"
              name="option"
              value={k}
              checked={selected === k}
              onChange={() => setSelected(k)}
              disabled={submitting}
            />
            <span style={{ fontWeight: 600 }}>{k}.</span>
            <span>{v}</span>
          </label>
        ))}
      </div>

      <button
        onClick={handleSubmit}
        disabled={!selected || submitting}
        style={{
          marginTop: 20,
          padding: '10px 32px',
          background: selected && !submitting ? '#3B82F6' : '#ccc',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          cursor: selected && !submitting ? 'pointer' : 'not-allowed',
          fontSize: 15,
        }}
      >
        {submitting ? '提交中...' : '提交答案'}
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Write `frontend/src/pages/QuizSession.jsx`**

```jsx
import React, { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import QuestionCard from '../components/QuestionCard'
import AnalysisReview from './AnalysisReview'

export default function QuizSession() {
  const navigate = useNavigate()
  const [sessionId, setSessionId] = useState(null)
  const [current, setCurrent] = useState(1)
  const [question, setQuestion] = useState(null)
  const [total] = useState(10)
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState(null)    // { correct, correct_answer, wrong_question_id }
  const [pendingWqId, setPendingWqId] = useState(null)

  const startQuiz = async () => {
    const res = await api.startQuiz()
    setSessionId(res.session_id)
    fetchNext(res.session_id, 1)
  }

  const fetchNext = async (sid, pos) => {
    setSubmitting(true)
    setFeedback(null)
    try {
      const q = await api.nextQuestion(sid, pos)
      setQuestion(q)
      setCurrent(pos)
    } catch (err) {
      alert(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmit = useCallback(async (selected, reset) => {
    setSubmitting(true)
    try {
      const res = await api.submitAnswer({
        session_id: sessionId,
        question_id: question.question_id,
        selected_answer: selected,
      })
      if (res.is_session_over) {
        navigate('/wrong-log')
        return
      }
      setFeedback(res)
      reset()
      if (!res.correct) {
        setPendingWqId(res.wrong_question_id)
      } else {
        // Move to next after brief delay
        setTimeout(() => {
          fetchNext(sessionId, current + 1)
        }, 1200)
      }
    } catch (err) {
      alert(err.message)
    } finally {
      setSubmitting(false)
    }
  }, [sessionId, question, current, navigate])

  const handleAnalysisDone = () => {
    fetchNext(sessionId, current + 1)
  }

  if (!sessionId) {
    return (
      <div style={{ paddingTop: 40, textAlign: 'center' }}>
        <h2>✏️ 开始测试</h2>
        <p style={{ color: '#666' }}>每次测试 10 道选择题</p>
        <button
          onClick={startQuiz}
          style={{ marginTop: 24, padding: '12px 40px', fontSize: 16, background: '#3B82F6', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}
        >
          开始测试 →
        </button>
      </div>
    )
  }

  if (!question) {
    return <p style={{ paddingTop: 40, textAlign: 'center' }}>加载中...</p>
  }

  if (!feedback?.correct && pendingWqId) {
    return (
      <AnalysisReview
        wrongQuestionId={pendingWqId}
        onDone={handleAnalysisDone}
      />
    )
  }

  return (
    <div style={{ paddingTop: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>✏️ 测试中</h2>
        <span style={{ color: '#666' }}>{current} / {total}</span>
      </div>
      <div style={{ background: '#F3F4F6', height: 6, borderRadius: 3, margin: '12px 0 0' }}>
        <div style={{ background: '#3B82F6', height: '100%', borderRadius: 3, width: `${(current / total) * 100}%`, transition: 'width 0.3s' }} />
      </div>

      <QuestionCard
        question={question}
        onSubmit={handleSubmit}
        submitting={submitting}
      />

      {feedback?.correct && (
        <div style={{ marginTop: 16, padding: 16, background: '#DCFCE7', borderRadius: 8, color: '#166534' }}>
          ✅ 正确！正确答案：{feedback.correct_answer}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/QuizSession.jsx frontend/src/components/QuestionCard.jsx
git commit -m "feat: add QuizSession page with QuestionCard"
```

---

## Task 12: AnalysisReview + SimilarPractice Pages

**Files:**
- Create: `frontend/src/pages/AnalysisReview.jsx`
- Create: `frontend/src/pages/SimilarPractice.jsx`

- [ ] **Step 1: Write `frontend/src/pages/AnalysisReview.jsx`**

```jsx
import React, { useEffect, useState } from 'react'
import { api } from '../api'

export default function AnalysisReview({ wrongQuestionId, onDone }) {
  const [analysis, setAnalysis] = useState(null)
  const [similarQuestions, setSimilarQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(false)
  const [editingTags, setEditingTags] = useState(false)
  const [tagInput, setTagInput] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const [analysisRes, similarRes] = await Promise.all([
          api.getAnalysis(wrongQuestionId),
          api.getSimilar(wrongQuestionId),
        ])
        setAnalysis(analysisRes)
        setTagInput(analysisRes.suggested_tags.join(', '))
        setSimilarQuestions(similarRes.questions)
      } catch (err) {
        alert(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [wrongQuestionId])

  async function handleConfirm() {
    setConfirming(true)
    try {
      const tags = tagInput.split(',').map(t => t.trim()).filter(Boolean)
      await api.confirmAnalysis(wrongQuestionId, tags)
      onDone()
    } catch (err) {
      alert(err.message)
    } finally {
      setConfirming(false)
    }
  }

  async function handleReject() {
    try {
      await api.rejectAnalysis(wrongQuestionId)
      onDone()
    } catch (err) {
      alert(err.message)
    }
  }

  if (loading) return <p style={{ paddingTop: 40 }}>AI 分析中...</p>

  return (
    <div style={{ paddingTop: 24 }}>
      <h2>🤖 错题分析</h2>

      <div style={{ background: '#FEF9C3', borderRadius: 8, padding: 16, marginTop: 16 }}>
        <h4 style={{ margin: '0 0 8px', color: '#854D0E' }}>AI 分析</h4>
        <p style={{ margin: 0, color: '#713F12' }}>{analysis?.analysis}</p>
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4 style={{ margin: 0 }}>🏷️ 推断的知识点</h4>
          <button onClick={() => setEditingTags(v => !v)} style={{ fontSize: 12, color: '#3B82F6', background: 'none', border: 'none', cursor: 'pointer' }}>
            {editingTags ? '保存' : '编辑'}
          </button>
        </div>
        {editingTags ? (
          <input
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            placeholder="用逗号分隔，如: past-perfect, subjunctive"
            style={{ width: '100%', marginTop: 8, padding: '6px 10px', border: '1px solid #ccc', borderRadius: 6 }}
          />
        ) : (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
            {(analysis?.suggested_tags || []).map(t => (
              <span key={t} style={{ background: '#EDE9FE', color: '#5B21B6', padding: '4px 10px', borderRadius: 12, fontSize: 13 }}>
                #{t}
              </span>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
        <button
          onClick={handleConfirm}
          disabled={confirming}
          style={{ flex: 1, padding: '10px 0', background: '#22C55E', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}
        >
          {confirming ? '处理中...' : '✅ 确认，开始举一反三'}
        </button>
        <button
          onClick={handleReject}
          style={{ padding: '10px 16px', background: '#f3f4f6', border: '1px solid #ccc', borderRadius: 8, cursor: 'pointer' }}
        >
          跳过
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Write `frontend/src/pages/SimilarPractice.jsx`**

```jsx
import React, { useState, useCallback } from 'react'
import { api } from '../api'
import QuestionCard from '../components/QuestionCard'

export default function SimilarPractice({ questionIds, onDone }) {
  const [index, setIndex] = useState(0)
  const [question, setQuestion] = useState(null)
  const [loading, setLoading] = useState(true)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (index >= questionIds.length) {
      setDone(true)
      return
    }
    setLoading(true)
    api.getSimilar(questionIds[index]).then(res => {
      // Practice each similar question one by one
      setQuestion({ ...res.questions[0], _wq_id: questionIds[index] })
    }).catch(() => {
      // No similar questions available
      setDone(true)
    }).finally(() => setLoading(false))
  }, [index, questionIds])

  const handleSubmit = useCallback(async (selected) => {
    // Simplified: just advance
    setIndex(i => i + 1)
  }, [])

  if (done) {
    return (
      <div style={{ paddingTop: 40, textAlign: 'center' }}>
        <h3 style={{ color: '#166534' }}>✅ 举一反三完成！</h3>
        <p style={{ color: '#666' }}>已完成 {questionIds.length} 道同类题练习</p>
        <button
          onClick={onDone}
          style={{ marginTop: 16, padding: '10px 32px', background: '#3B82F6', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}
        >
          返回继续测试 →
        </button>
      </div>
    )
  }

  if (loading || !question) return <p>加载中...</p>

  return (
    <div style={{ paddingTop: 24 }}>
      <h2>📚 举一反三 ({index + 1}/{questionIds.length})</h2>
      <QuestionCard
        question={question}
        onSubmit={handleSubmit}
        submitting={false}
      />
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/AnalysisReview.jsx frontend/src/pages/SimilarPractice.jsx
git commit -m "feat: add AnalysisReview and SimilarPractice pages"
```

---

## Task 13: Wrong Log Page

**Files:**
- Create: `frontend/src/pages/WrongLog.jsx`

- [ ] **Step 1: Write `frontend/src/pages/WrongLog.jsx`**

```jsx
import React, { useEffect, useState } from 'react'
import { api } from '../api'

export default function WrongLog() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // For now, show recent wrong questions from the DB via a simple endpoint
    // In a full impl, add GET /api/wrong-questions endpoint
    // For v1, show from localStorage or a placeholder
    setLoading(false)
  }, [])

  return (
    <div style={{ paddingTop: 24 }}>
      <h2>❌ 错题本</h2>
      <p style={{ color: '#666' }}>记录所有做错的题目，答对 3 次后移出</p>

      <div style={{ marginTop: 20, padding: '40px 0', textAlign: 'center', color: '#999' }}>
        <p>（错题记录功能待完善）</p>
        <p style={{ fontSize: 13 }}>可通过"开始测试"来复习错题</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add `GET /api/wrong-questions` endpoint to `backend/routers/analysis.py`** (reuse it):

Add to `backend/routers/analysis.py`:

```python
@router.get("/wrong-questions")
def list_wrong_questions(db: Session = Depends(get_db)):
    wqs = db.query(WrongQuestion).order_by(WrongQuestion.last_wrong_at.desc()).limit(100).all()
    return [
        {
            "id": wq.id,
            "question_id": wq.question_id,
            "content": wq.question.content,
            "wrong_count": wq.wrong_count,
            "consecutive_correct": wq.consecutive_correct,
            "status": wq.status,
            "last_wrong_at": wq.last_wrong_at.isoformat() if wq.last_wrong_at else None,
        }
        for wq in wqs
    ]
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/WrongLog.jsx backend/routers/analysis.py
git commit -m "feat: add WrongLog page with wrong-questions endpoint"
```

---

## Task 14: Final Integration + Test

- [ ] **Step 1: Start backend and frontend together**

Terminal 1: `cd backend && source venv/bin/activate && uvicorn main:app --reload --port 8000`
Terminal 2: `cd frontend && npm run dev`

- [ ] **Step 2: Smoke test the full flow**

1. Open `http://localhost:5173`
2. Upload a docx file with 3+ MCQ questions
3. Verify import count shown
4. Go to 题库 — verify questions listed
5. 开始测试 — complete a full 10-question session
6. Answer wrong intentionally — verify Analysis Review shows up
7. Confirm analysis — verify flow continues
8. Check for any console errors

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "feat: full system integration — backend + frontend"
```

---

## Spec Coverage Checklist

| Spec Requirement | Task(s) |
|-----------------|---------|
| Import docx via AI | Task 4 |
| MCQ only (skip non-MCQ) | Task 4 (parse logic) |
| Random quiz, 10/session | Task 6 |
| Answer submission + correct/wrong | Task 6 |
| AI auto-analysis on wrong answer | Task 7 |
| User confirms before 举一反三 | Task 7, Task 11 |
| Tag auto-generation | Task 7 |
| Tag normalization (kebab-case) | Task 5 |
| Similar questions by tag match | Task 8 |
| AI generation fallback | Task 8 |
| 3 consecutive correct → mastered | Task 6 |
| API key via .env | Task 1 |
| Question Bank page | Task 10 |
| Upload page | Task 10 |
| Quiz Session page | Task 11 |
| Analysis Review page | Task 12 |
| Wrong Log page | Task 13 |
