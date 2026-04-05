from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import SessionLocal
from models import Tag, QuestionTag

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


@router.get("/search")
def search_tags(q: str = "", db: Session = Depends(get_db)):
    if not q.strip():
        return []
    tags = (
        db.query(Tag)
        .filter(Tag.name.contains(q.strip()))
        .order_by(Tag.name)
        .limit(10)
        .all()
    )
    return [{"id": t.id, "name": t.name} for t in tags]


@router.delete("/{tag_id}")
def delete_tag(tag_id: int, db: Session = Depends(get_db)):
    db.query(QuestionTag).filter(QuestionTag.tag_id == tag_id).delete()
    db.query(Tag).filter(Tag.id == tag_id).delete()
    db.commit()
    return {"ok": True}
