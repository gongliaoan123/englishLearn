import os
import tempfile
from fastapi import APIRouter, UploadFile, File, Depends
from sqlalchemy.orm import Session

from database import SessionLocal
from models import Question, Tag, QuestionTag, WrongQuestion, AIAnalysis
from schemas import QuestionImportResponse, QuestionListResponse, QuestionResponse, QuestionCreate, QuestionUpdate
from services.docx_parser import extract_text_from_docx, parse_docx_stream as parse_docx_via_ai
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
        raise Exception("只支持 .docx 文件")

    contents = await file.read()

    with tempfile.NamedTemporaryFile(suffix=".docx", delete=False) as tmp:
        tmp.write(contents)
        tmp_path = tmp.name

    try:
        paragraphs = extract_text_from_docx(tmp_path)
        parsed = parse_docx_via_ai(paragraphs)
    finally:
        os.unlink(tmp_path)

    imported = skipped = 0
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
                explanation=item.get("explanation") or None,
                docx_filename=file.filename,
                source="imported",
            )
            db.add(q)
            db.flush()
            get_or_create_tags(db, q, item.get("tags", []))
            imported += 1
        except Exception as e:
            errors.append(str(e))

    db.commit()
    return QuestionImportResponse(imported=imported, skipped=skipped, errors=errors)


@router.get("", response_model=QuestionListResponse)
def list_questions(db: Session = Depends(get_db), page: int = 1, page_size: int = 50, tag: str | None = None, tags: str | None = None):
    from models import QuestionTag
    query = db.query(Question)
    # 兼容 tag（单）和 tags（多）两种参数名
    tag_str = tags if tags else tag
    if tag_str:
        tag_names = [t.strip() for t in tag_str.split(',') if t.strip()]
        if tag_names:
            tag_objs = db.query(Tag).filter(Tag.name.in_(tag_names)).all()
            if tag_objs:
                tag_ids = [t.id for t in tag_objs]
                qids = db.query(QuestionTag.question_id).filter(QuestionTag.tag_id.in_(tag_ids)).subquery()
                query = query.filter(Question.id.in_(qids))
    total = query.count()
    questions = (
        query
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
                explanation=q.explanation,
                docx_filename=q.docx_filename,
                tags=[t.name for t in q.tags],
                source=q.source,
            )
            for q in questions
        ],
        total=total,
    )


@router.delete("/{question_id}")
def delete_question(question_id: int, db: Session = Depends(get_db)):
    q = db.query(Question).filter(Question.id == question_id).first()
    if not q:
        raise Exception("题目不存在")
    db.query(QuestionTag).filter(QuestionTag.question_id == question_id).delete()
    # AIAnalysis 通过 wrong_question → wrong_question_id 关联
    wq_ids = db.query(WrongQuestion.id).filter(WrongQuestion.question_id == question_id).all()
    if wq_ids:
        db.query(AIAnalysis).filter(AIAnalysis.wrong_question_id.in_([wq.id for wq in wq_ids])).delete(synchronize_session=False)
    db.query(WrongQuestion).filter(WrongQuestion.question_id == question_id).delete()
    db.delete(q)
    db.commit()
    return {"ok": True}


@router.post("", response_model=QuestionResponse)
def create_question(body: QuestionCreate, db: Session = Depends(get_db)):
    q = Question(
        content=body.content,
        options=body.options,
        answer=body.answer,
        explanation=body.explanation,
        source="manual",
    )
    db.add(q)
    db.flush()
    get_or_create_tags(db, q, body.tags)
    db.commit()
    db.refresh(q)
    return QuestionResponse(
        id=q.id,
        content=q.content,
        options=q.options,
        answer=q.answer,
        explanation=q.explanation,
        docx_filename=q.docx_filename,
        tags=[t.name for t in q.tags],
        source=q.source,
    )


@router.put("/{question_id}", response_model=QuestionResponse)
def update_question(question_id: int, body: QuestionUpdate, db: Session = Depends(get_db)):
    q = db.query(Question).filter(Question.id == question_id).first()
    if not q:
        raise Exception("题目不存在")
    if body.content is not None:
        q.content = body.content
    if body.options is not None:
        q.options = body.options
    if body.answer is not None:
        q.answer = body.answer
    if body.explanation is not None:
        q.explanation = body.explanation
    if body.tags is not None:
        get_or_create_tags(db, q, body.tags)
    db.commit()
    db.refresh(q)
    return QuestionResponse(
        id=q.id,
        content=q.content,
        options=q.options,
        answer=q.answer,
        explanation=q.explanation,
        docx_filename=q.docx_filename,
        tags=[t.name for t in q.tags],
        source=q.source,
    )


@router.delete("")
def clear_all_questions(db: Session = Depends(get_db)):
    db.query(AIAnalysis).delete()
    db.query(WrongQuestion).delete()
    db.query(QuestionTag).delete()
    db.query(Question).delete()
    db.query(Tag).delete()
    db.commit()
    return {"ok": True, "message": "题库已清空"}
