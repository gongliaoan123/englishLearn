import random
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import SessionLocal
from models import Question
from schemas import (
    QuizStartResponse, QuizNextResponse, QuizAnswerResponse, SessionSummaryResponse, QuizAnswerRequest
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
        answer=q.answer,
        explanation=q.explanation,
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
    wrong_ans = None if correct else body.selected_answer.strip().upper()
    wq = record_answer(db, body.question_id, correct, wrong_answer=wrong_ans)
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
