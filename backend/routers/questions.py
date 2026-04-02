import os
import shutil
import tempfile
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy.orm import Session

from database import SessionLocal
from models import Question, Tag, QuestionTag, WrongQuestion, AIAnalysis
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
        paragraphs = extract_text_from_docx(tmp_path)
        parsed = parse_docx_via_ai(paragraphs)
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


@router.delete("")
def clear_all_questions(db: Session = Depends(get_db)):
    """清空所有题目及相关数据（错题记录、标签、AI分析）。"""
    db.query(AIAnalysis).delete()
    db.query(WrongQuestion).delete()
    db.query(QuestionTag).delete()
    db.query(Question).delete()
    db.query(Tag).delete()
    db.commit()
    return {"ok": True, "message": "题库已清空"}
