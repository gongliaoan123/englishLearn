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
