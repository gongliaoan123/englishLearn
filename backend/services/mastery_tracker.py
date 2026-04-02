from datetime import datetime
from sqlalchemy.orm import Session
from models import WrongQuestion

MASTERY_THRESHOLD = 3  # consecutive correct answers to reach "mastered"


def record_answer(db: Session, question_id: int, correct: bool, user_id: int | None = None) -> WrongQuestion | None:
    """
    Called after each answer. Updates wrong_count and consecutive_correct.
    Returns the WrongQuestion record if this was a wrong answer.
    """
    wq = db.query(WrongQuestion).filter(
        WrongQuestion.question_id == question_id,
        WrongQuestion.user_id == user_id,
    ).order_by(WrongQuestion.id.desc()).first()

    if correct:
        if wq:
            wq.consecutive_correct += 1
            if wq.consecutive_correct >= MASTERY_THRESHOLD:
                wq.status = "mastered"
        return None  # no WrongQuestion record needed for correct answers
    else:
        # wrong answer
        if wq:
            wq.wrong_count += 1
            wq.consecutive_correct = 0
            wq.last_wrong_at = datetime.utcnow()
            if wq.status == "mastered":
                wq.status = "confirmed"  # re-break through
        else:
            wq = WrongQuestion(
                question_id=question_id,
                user_id=user_id,
                wrong_count=1,
                consecutive_correct=0,
                status="pending_review",
            )
            db.add(wq)
        return wq
