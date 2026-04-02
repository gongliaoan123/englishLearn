import json
import random
import re
from sqlalchemy.orm import Session
from models import Question, Tag, QuestionTag

DEFAULT_SIMILAR_COUNT = 3

GENERATE_SIMILAR_SYSTEM = """You are an expert English MCQ generator. Generate {count} new multiple-choice questions that test the same knowledge points.
Return a JSON array of {count} question objects. Each has:
- content: str
- options: dict ({"A": "...", "B": "...", "C": "...", "D": "..."})
- answer: str ("A" | "B" | "C" | "D")
- explanation: str
Do not repeat the original question exactly. Vary the wording and scenarios.
Return ONLY the JSON array."""


def find_similar_by_tags(db: Session, question_id: int, tags: list[str], count: int = DEFAULT_SIMILAR_COUNT) -> tuple[list[Question], int]:
    """Find existing questions sharing at least one tag. Returns (questions, generated_count=0)."""
    if not tags:
        return [], 0

    tag_ids = [db.query(Tag).filter(Tag.name == t).first() for t in tags]
    tag_ids = [t.id for t in tag_ids if t]

    if not tag_ids:
        return [], 0

    candidate_ids = (
        db.query(QuestionTag.question_id)
        .filter(QuestionTag.tag_id.in_(tag_ids), QuestionTag.question_id != question_id)
        .distinct()
        .all()
    )
    candidate_ids = [cid[0] for cid in candidate_ids]
    random.shuffle(candidate_ids)

    selected = candidate_ids[:count]
    questions = db.query(Question).filter(Question.id.in_(selected)).all()
    return questions, 0


def generate_similar_via_ai(tags: list[str], count: int = DEFAULT_SIMILAR_COUNT) -> list[dict]:
    from services.ai_client import AIClient
    prompt = GENERATE_SIMILAR_SYSTEM.format(count=count) + f"\n\nKnowledge points: {', '.join(tags)}"
    ai = AIClient()
    response = ai.chat(prompt, "")
    response = re.sub(r"^```json\s*", "", response.strip())
    response = re.sub(r"\s*```$", "", response.strip())
    result = json.loads(response)
    if isinstance(result, dict) and "questions" in result:
        return result["questions"]
    return result if isinstance(result, list) else []
