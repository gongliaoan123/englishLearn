import os
import json
import shutil
import tempfile
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from database import SessionLocal
from models import Question, Tag, QuestionTag, WrongQuestion, AIAnalysis
from schemas import QuestionImportResponse, QuestionListResponse, QuestionResponse
from services.docx_parser import extract_text_from_docx, parse_docx_stream
from services.tag_service import get_or_create_tags

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _sse_event(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"


async def import_docx_stream(file: UploadFile, db: Session):
    """Parse docx and yield SSE progress events, then final result."""
    if not file.filename.endswith(".docx"):
        yield _sse_event({"type": "error", "message": "Only .docx files are supported"})
        return

    with tempfile.NamedTemporaryFile(suffix=".docx", delete=False) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        paragraphs = extract_text_from_docx(tmp_path)

        all_questions = []
        total_chunks = (len(paragraphs) + 39) // 40  # paragraphs_per_chunk=40

        def on_progress(chunk_idx, total):
            all_questions.extend([])  # placeholder, actual questions collected below

        # We need to collect questions during streaming
        # Rewrite: iterate manually and yield progress
        from services.docx_parser import _parse_chunk
        paragraphs_per_chunk = 40
        all_questions = []
        total_chunks = (len(paragraphs) + paragraphs_per_chunk - 1) // paragraphs_per_chunk
        i = 0
        chunk_idx = 0

        while i < len(paragraphs):
            chunk = paragraphs[i:i + paragraphs_per_chunk]
            chunk_idx += 1
            chunk_questions = _parse_chunk(chunk)
            if chunk_questions:
                all_questions.extend(chunk_questions)
            yield _sse_event({
                "type": "progress",
                "current": chunk_idx,
                "total": total_chunks,
                "found": len(all_questions),
            })
            i += paragraphs_per_chunk

        # Save to DB
        imported = 0
        skipped = 0
        errors = []
        for item in all_questions:
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
        yield _sse_event({
            "type": "done",
            "imported": imported,
            "skipped": skipped,
            "errors": errors,
        })

    except Exception as e:
        yield _sse_event({"type": "error", "message": str(e)})
    finally:
        os.unlink(tmp_path)


@router.post("/import")
async def import_docx(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Import docx — streams progress via SSE. Frontend should use EventSource."""
    return StreamingResponse(
        import_docx_stream(file, db),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


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
