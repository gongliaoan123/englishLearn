"""
Simple in-memory session manager for quiz sessions.
Key: session_id (UUID string)
Value: dict { "used_ids": list[int], "correct_count": int }
"""
import uuid

_sessions: dict[str, dict] = {}


def start_session(question_pool: list[int], total: int = 10, user_id: int | None = None) -> str:
    """Start a session from a pre-computed question pool (by sources/tags)."""
    sid = str(uuid.uuid4())
    _sessions[sid] = {
        "used_ids": [],
        "correct_count": 0,
        "question_pool": question_pool,
        "total": total,
        "user_id": user_id,
    }
    return sid


def start_session_from_wrong(wrong_ids: list[int], total: int = 10, user_id: int | None = None) -> str:
    """Start a session that only uses questions from the wrong question bank."""
    sid = str(uuid.uuid4())
    _sessions[sid] = {
        "used_ids": [],
        "correct_count": 0,
        "question_pool": wrong_ids,
        "total": total,
        "user_id": user_id,
    }
    return sid


def get_session_user_id(sid: str) -> int | None:
    return _sessions.get(sid, {}).get("user_id")


def get_session_total(sid: str) -> int:
    return _sessions.get(sid, {}).get("total", 10)


def get_session_pool(sid: str) -> list[int]:
    return _sessions.get(sid, {}).get("question_pool", [])


def mark_used(sid: str, question_id: int):
    if sid in _sessions:
        _sessions[sid]["used_ids"].append(question_id)


def get_used_ids(sid: str) -> list[int]:
    return _sessions.get(sid, {}).get("used_ids", [])


def record_correct(sid: str):
    if sid in _sessions:
        _sessions[sid]["correct_count"] += 1


def get_correct_count(sid: str) -> int:
    return _sessions.get(sid, {}).get("correct_count", 0)


def end_session(sid: str):
    _sessions.pop(sid, None)
