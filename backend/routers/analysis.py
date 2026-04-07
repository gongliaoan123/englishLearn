from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from database import SessionLocal
from models import WrongQuestion, AIAnalysis, Question
from schemas import AIAnalysisResponse, AnalysisConfirmRequest, SimilarQuestionsResponse, QuestionResponse
from services.analysis_service import analyze_wrong_answer
from services.tag_service import get_or_create_tags
from middleware.auth import get_current_user_id

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _wq_query(user_id, db):
    """Base query for WrongQuestion filtered by user_id."""
    q = db.query(WrongQuestion)
    if user_id:
        q = q.filter(WrongQuestion.user_id == user_id)
    else:
        q = q.filter(WrongQuestion.user_id == None)
    return q


@router.get("/{wrong_question_id}", response_model=AIAnalysisResponse)
def get_analysis(request: Request, wrong_question_id: int, db: Session = Depends(get_db)):
    user_id = get_current_user_id(request)
    wq = db.query(WrongQuestion).filter(WrongQuestion.id == wrong_question_id).first()
    if not wq or (user_id is not None and wq.user_id != user_id):
        raise HTTPException(status_code=404, detail="错题不存在")

    analysis = db.query(AIAnalysis).filter(AIAnalysis.wrong_question_id == wrong_question_id).first()
    if not analysis:
        q = wq.question
        result = analyze_wrong_answer(q.content, q.answer, wq.wrong_answer or q.answer, q.options)
        analysis = AIAnalysis(
            wrong_question_id=wq.id,
            analysis=result["analysis"],
            suggested_tags=result["suggested_tags"],
            confirmed=False,
        )
        db.add(analysis)
        try:
            db.commit()
        except Exception:
            db.rollback()
            analysis = db.query(AIAnalysis).filter(
                AIAnalysis.wrong_question_id == wrong_question_id
            ).first()
        if analysis:
            db.refresh(analysis)

    return AIAnalysisResponse(
        id=analysis.id,
        analysis=analysis.analysis,
        suggested_tags=analysis.suggested_tags,
        confirmed=analysis.confirmed,
    )


@router.post("/{wrong_question_id}/confirm", response_model=SimilarQuestionsResponse)
def confirm_analysis(
    request: Request,
    wrong_question_id: int,
    body: AnalysisConfirmRequest,
    db: Session = Depends(get_db),
):
    user_id = get_current_user_id(request)
    wq = db.query(WrongQuestion).filter(WrongQuestion.id == wrong_question_id).first()
    if not wq or (user_id is not None and wq.user_id != user_id):
        raise HTTPException(status_code=404, detail="错题不存在")

    analysis = db.query(AIAnalysis).filter(AIAnalysis.wrong_question_id == wrong_question_id).first()
    if not analysis:
        raise HTTPException(status_code=400, detail="No analysis found for this wrong question")

    analysis.confirmed = True
    tags_to_apply = body.tags if body.tags is not None else analysis.suggested_tags
    get_or_create_tags(db, wq.question, tags_to_apply)
    wq.status = "confirmed"
    db.commit()

    return SimilarQuestionsResponse(questions=[], generated_count=0)


@router.post("/{wrong_question_id}/reject")
def reject_analysis(request: Request, wrong_question_id: int, db: Session = Depends(get_db)):
    user_id = get_current_user_id(request)
    wq = db.query(WrongQuestion).filter(WrongQuestion.id == wrong_question_id).first()
    if not wq or (user_id is not None and wq.user_id != user_id):
        raise HTTPException(status_code=404, detail="错题不存在")
    wq.status = "confirmed"
    db.commit()
    return {"ok": True}


@router.delete("/{wrong_question_id}")
def delete_wrong_question(request: Request, wrong_question_id: int, db: Session = Depends(get_db)):
    user_id = get_current_user_id(request)
    wq = db.query(WrongQuestion).filter(WrongQuestion.id == wrong_question_id).first()
    if not wq or (user_id is not None and wq.user_id != user_id):
        raise HTTPException(status_code=404, detail="错题不存在")
    db.query(AIAnalysis).filter(AIAnalysis.wrong_question_id == wrong_question_id).delete(synchronize_session=False)
    db.query(WrongQuestion).filter(WrongQuestion.id == wrong_question_id).delete()
    db.commit()
    return {"ok": True}


@router.post("/clear")
def clear_all_wrong_questions(request: Request, db: Session = Depends(get_db)):
    user_id = get_current_user_id(request)
    wqs = _wq_query(user_id, db).all()
    wq_ids = [wq.id for wq in wqs]
    if wq_ids:
        db.query(AIAnalysis).filter(AIAnalysis.wrong_question_id.in_(wq_ids)).delete(synchronize_session=False)
    _wq_query(user_id, db).delete()
    db.commit()
    return {"ok": True}


@router.get("")
def list_wrong_questions(request: Request, page: int = 1, page_size: int = 20, db: Session = Depends(get_db)):
    user_id = get_current_user_id(request)
    query = _wq_query(user_id, db)
    total = query.count()
    wqs = query.order_by(WrongQuestion.last_wrong_at.desc()) \
        .offset((page - 1) * page_size).limit(page_size).all()
    return {
        "items": [
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
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }
