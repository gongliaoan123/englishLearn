import os
import tempfile
from fastapi import APIRouter, UploadFile, File, Depends, Request
from sqlalchemy.orm import Session

from database import SessionLocal
from models import Question, Tag, QuestionTag, WrongQuestion, AIAnalysis, User
from schemas import QuestionImportResponse, QuestionListResponse, QuestionResponse, QuestionCreate, QuestionUpdate
from services.docx_parser import extract_text_from_docx, parse_docx_stream as parse_docx_via_ai
from services.tag_service import get_or_create_tags
from middleware.auth import get_current_user_id

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/import", response_model=QuestionImportResponse)
async def import_docx(request: Request, file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith(".docx"):
        raise Exception("只支持 .docx 文件")
    user_id = get_current_user_id(request)
    if user_id is None:
        raise Exception("请先登录")

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
                user_id=user_id,
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
def list_questions(request: Request, db: Session = Depends(get_db), page: int = 1, page_size: int = 50, tag: str | None = None, tags: str | None = None, scope: str = "all"):
    from models import QuestionTag
    user_id = get_current_user_id(request)
    query = db.query(Question)

    # scope 过滤：public / mine / all
    if scope == "public":
        query = query.filter(Question.user_id == None)
    elif scope == "mine":
        query = query.filter(Question.user_id == user_id)
    # all: 不过滤，返回全部（公共+自己的）

    # 标签过滤（兼容 tag 和 tags）
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
                user_id=q.user_id,
            )
            for q in questions
        ],
        total=total,
    )


@router.delete("/{question_id}")
def delete_question(request: Request, question_id: int, db: Session = Depends(get_db)):
    user_id = get_current_user_id(request)
    if user_id is None:
        raise Exception("请先登录")
    admin = db.query(User).filter(User.id == user_id).first()
    q = db.query(Question).filter(Question.id == question_id).first()
    if not q:
        raise Exception("题目不存在")
    # 只能删自己创建的，或者管理员
    if q.user_id != user_id and (not admin or not admin.is_admin):
        raise Exception("无权删除此题目")
    db.query(QuestionTag).filter(QuestionTag.question_id == question_id).delete()
    wq_ids = db.query(WrongQuestion.id).filter(WrongQuestion.question_id == question_id).all()
    if wq_ids:
        db.query(AIAnalysis).filter(AIAnalysis.wrong_question_id.in_([wq.id for wq in wq_ids])).delete(synchronize_session=False)
    db.query(WrongQuestion).filter(WrongQuestion.question_id == question_id).delete()
    db.delete(q)
    db.commit()
    return {"ok": True}


@router.post("", response_model=QuestionResponse)
def create_question(request: Request, body: QuestionCreate, db: Session = Depends(get_db)):
    user_id = get_current_user_id(request)
    if user_id is None:
        raise Exception("请先登录")
    q = Question(
        content=body.content,
        options=body.options,
        answer=body.answer,
        explanation=body.explanation,
        source="manual",
        user_id=user_id,
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
        user_id=q.user_id,
    )


@router.put("/{question_id}", response_model=QuestionResponse)
def update_question(request: Request, question_id: int, body: QuestionUpdate, db: Session = Depends(get_db)):
    user_id = get_current_user_id(request)
    if user_id is None:
        raise Exception("请先登录")
    admin = db.query(User).filter(User.id == user_id).first()
    q = db.query(Question).filter(Question.id == question_id).first()
    if not q:
        raise Exception("题目不存在")
    # 只能改自己创建的，或者管理员
    if q.user_id != user_id and (not admin or not admin.is_admin):
        raise Exception("无权修改此题目")
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
        user_id=q.user_id,
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
