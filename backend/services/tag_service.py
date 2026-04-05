import re
from sqlalchemy.orm import Session
from models import Question, Tag, QuestionTag


def normalize_tag(name: str) -> str:
    """Normalize tag: Chinese tags preserved, English tags lowercased to kebab-case."""
    name = name.strip()
    if not name:
        return ""
    # If contains non-ASCII (Chinese/Japanese/Korean), preserve as-is
    if re.search(r'[^\x00-\x7F]', name):
        return name
    # English: lowercase, replace spaces/underscores with hyphens
    name = name.lower()
    name = re.sub(r"[_\s]+", "-", name)
    # strip non-alphanumeric except hyphen
    name = re.sub(r"[^a-z0-9-]", "", name)
    # collapse multiple hyphens
    name = re.sub(r"-+", "-", name)
    return name.strip("-")


def get_or_create_tags(db: Session, question: Question, tag_names: list[str]) -> list[Tag]:
    """Normalize and attach tags to a question. Creates missing tags."""
    tags = []
    for raw_name in tag_names:
        normalized = normalize_tag(raw_name)
        if not normalized:
            continue
        tag = db.query(Tag).filter(Tag.name == normalized).first()
        if not tag:
            tag = Tag(name=normalized)
            db.add(tag)
            db.flush()
        tags.append(tag)

    # Replace all tags on this question
    db.query(QuestionTag).filter(QuestionTag.question_id == question.id).delete()
    for tag in tags:
        db.add(QuestionTag(question_id=question.id, tag_id=tag.id))
    return tags