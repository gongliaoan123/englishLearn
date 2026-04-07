import random
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from database import SessionLocal
from models import Question, Tag, QuestionTag, WrongQuestion
from schemas import (
    QuizStartRequest, QuizStartResponse, QuizNextResponse, QuizAnswerResponse, SessionSummaryResponse, QuizAnswerRequest
)
from services.mastery_tracker import record_answer
from services.session_manager import (
    start_session, start_session_from_wrong, mark_used, get_used_ids,
    record_correct, get_correct_count, end_session, get_session_tags, get_session_wrong_ids,
    get_session_total, get_session_user_id,
)
from middleware.auth import get_current_user_id

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/start", response_model=QuizStartResponse)
def start_quiz(request: Request, body: QuizStartRequest | None = None, db: Session = Depends(get_db)):
    user_id = get_current_user_id(request)
    tags = body.tags if body else []
    total = (body.total if body and body.total is not None else 10)
    query = db.query(Question)
    if tags:
        tag_ids = db.query(Tag.id).filter(Tag.name.in_(tags)).subquery()
        qids = db.query(QuestionTag.question_id).filter(QuestionTag.tag_id.in_(tag_ids)).subquery()
        query = query.filter(Question.id.in_(qids))
    available = query.count()
    if available == 0:
        raise HTTPException(status_code=400, detail="No questions in database. Import questions first.")
    session_id = start_session(tags, total, user_id)
    return QuizStartResponse(session_id=session_id, total=total)


@router.post("/next", response_model=QuizNextResponse)
def next_question(session_id: str, current: int = 1, db: Session = Depends(get_db)):
    used_ids = get_used_ids(session_id)
    tags = get_session_tags(session_id)
    wrong_ids = get_session_wrong_ids(session_id)
    query = db.query(Question).filter(Question.id.notin_(used_ids))
    if wrong_ids:
        # 错题本出题模式：只从错题本中选
        query = query.filter(Question.id.in_(wrong_ids))
    elif tags:
        tag_objs = db.query(Tag).filter(Tag.name.in_(tags)).all()
        if tag_objs:
            tag_id_list = [t.id for t in tag_objs]
            qids = db.query(QuestionTag.question_id).filter(QuestionTag.tag_id.in_(tag_id_list)).subquery()
            query = query.filter(Question.id.in_(qids))
    candidates = query.all()
    if not candidates:
        raise HTTPException(status_code=400, detail="No more questions available")
    q = random.choice(candidates)
    mark_used(session_id, q.id)
    session_total = get_session_total(session_id)
    return QuizNextResponse(
        question_id=q.id,
        content=q.content,
        options=q.options,
        answer=q.answer,
        explanation=q.explanation,
        current=current,
        total=session_total,
    )


@router.post("/start-from-wrong", response_model=QuizStartResponse)
def start_from_wrong(request: Request, body: QuizStartRequest | None = None, db: Session = Depends(get_db)):
    user_id = get_current_user_id(request)
    query = db.query(WrongQuestion.question_id)
    if user_id:
        query = query.filter(WrongQuestion.user_id == user_id)
    else:
        query = query.filter(WrongQuestion.user_id == None)
    wq_rows = query.all()
    if not wq_rows:
        raise HTTPException(status_code=400, detail="错题本为空，请先完成测试积累错题")
    all_wrong_ids = [wq.question_id for wq in wq_rows]
    total = (body.total if body and body.total is not None else 10) if body else 10
    count = min(total, len(all_wrong_ids))
    selected_ids = random.sample(all_wrong_ids, count)
    session_id = start_session_from_wrong(selected_ids, count, user_id)
    return QuizStartResponse(session_id=session_id, total=count)


@router.post("/answer", response_model=QuizAnswerResponse | SessionSummaryResponse)
def submit_answer(request: Request, body: QuizAnswerRequest, db: Session = Depends(get_db)):
    user_id = get_session_user_id(body.session_id)
    q = db.query(Question).filter(Question.id == body.question_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")

    correct = body.selected_answer.strip().upper() == q.answer.strip().upper()
    if correct:
        record_correct(body.session_id)
    wrong_ans = None if correct else body.selected_answer.strip().upper()
    wq = record_answer(db, body.question_id, correct, wrong_answer=wrong_ans, user_id=user_id)
    db.commit()

    used_ids = get_used_ids(body.session_id)
    session_total = get_session_total(body.session_id)
    answered = len(used_ids)
    is_over = answered >= session_total

    if is_over:
        correct_count = get_correct_count(body.session_id)
        end_session(body.session_id)
        return SessionSummaryResponse(
            session_id=body.session_id,
            total=session_total,
            correct=correct,
            correct_count=correct_count,
            wrong=session_total - correct_count,
            wrong_question_ids=[],
        )

    return QuizAnswerResponse(
        correct=correct,
        correct_answer=q.answer,
        wrong_question_id=wq.id if wq else None,
        is_session_over=False,
    )
