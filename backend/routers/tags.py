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
