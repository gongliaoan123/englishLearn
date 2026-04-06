"""
Simple in-memory session manager for quiz sessions.
Key: session_id (UUID string)
Value: dict { "used_ids": list[int], "correct_count": int }
"""
import uuid

_sessions: dict[str, dict] = {}


def start_session(tags: list[str] | None = None, total: int = 10) -> str:
    sid = str(uuid.uuid4())
    _sessions[sid] = {"used_ids": [], "correct_count": 0, "tags": tags or [], "wrong_ids": [], "total": total}
    return sid


def start_session_from_wrong(wrong_ids: list[int], total: int = 10) -> str:
    """Start a session that only uses questions from the wrong question bank."""
    sid = str(uuid.uuid4())
    _sessions[sid] = {"used_ids": [], "correct_count": 0, "tags": [], "wrong_ids": wrong_ids, "total": total}
    return sid


def get_session_total(sid: str) -> int:
    return _sessions.get(sid, {}).get("total", 10)


def get_session_wrong_ids(sid: str) -> list[int]:
    return _sessions.get(sid, {}).get("wrong_ids", [])


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


def get_session_tags(sid: str) -> list[str]:
    return _sessions.get(sid, {}).get("tags", [])
