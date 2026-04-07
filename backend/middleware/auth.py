"""
JWT authentication middleware.
Extracts user_id from Authorization: Bearer <token> header.
"""
import os
from jose import jwt, JWTError
from fastapi import Request, HTTPException, Depends
from functools import lru_cache

SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-in-production")
ALGORITHM = "HS256"


def decode_token(token: str) -> int | None:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        uid = payload.get("sub")
        return int(uid) if uid is not None else None
    except (JWTError, ValueError, TypeError):
        return None


def get_user_id_from_token(token: str) -> int | None:
    """Extract user_id from JWT token string. Returns None if invalid."""
    return decode_token(token)


def get_user_id_from_request(request: Request) -> int | None:
    """Extract user_id from Authorization: Bearer <token> header. Returns None if not authenticated."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    return decode_token(auth_header[7:])


def require_user_id(request: Request) -> int:
    """Like get_user_id, but raises 401 if not authenticated."""
    user_id = get_user_id_from_request(request)
    if user_id is None:
        raise HTTPException(status_code=401, detail="请先登录")
    return user_id


# FastAPI dependency — use this in route handlers
def get_current_user_id(request: Request) -> int | None:
    """Dependency: returns user_id or None if not authenticated."""
    return get_user_id_from_request(request)


def require_current_user_id(request: Request) -> int:
    """Dependency: returns user_id, raises 401 if not authenticated."""
    return require_user_id(request)
