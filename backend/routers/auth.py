from datetime import datetime, timedelta
from jose import jwt
import bcrypt
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import SessionLocal
from models import User
from middleware.auth import SECRET_KEY, ALGORITHM, require_current_user_id, get_current_user_id

router = APIRouter()

TOKEN_EXPIRE_HOURS = 7 * 24  # 7 days


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode('utf-8'), hashed.encode('utf-8'))


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def create_token(user_id: int) -> str:
    expire = datetime.utcnow() + timedelta(hours=TOKEN_EXPIRE_HOURS)
    payload = {"sub": str(user_id), "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


class RegisterRequest(BaseModel):
    username: str
    password: str


class LoginRequest(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    id: int
    username: str
    is_admin: bool

    class Config:
        from_attributes = True


@router.post("/register")
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    if len(body.username) < 3 or len(body.password) < 6:
        raise HTTPException(status_code=400, detail="用户名至少3位，密码至少6位")
    existing = db.query(User).filter(User.username == body.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="用户名已存在")
    # 第一个注册的用户自动成为管理员
    is_first = db.query(User).count() == 0
    user = User(username=body.username, password_hash=hash_password(body.password), is_admin=is_first)
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"user": {"id": user.id, "username": user.username, "is_admin": user.is_admin}}


@router.post("/login")
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == body.username).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    token = create_token(user.id)
    return {"token": token, "user": {"id": user.id, "username": user.username, "is_admin": user.is_admin}}


@router.get("/me", response_model=UserResponse)
def get_me(user_id: int = Depends(require_current_user_id), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    return UserResponse(id=user.id, username=user.username, is_admin=user.is_admin)


@router.post("/logout")
def logout(user_id: int = Depends(require_current_user_id)):
    return {"ok": True}


@router.post("/admin/promote/{target_user_id}")
def promote_to_admin(target_user_id: int, request: Request, db: Session = Depends(get_db)):
    user_id = require_current_user_id(request)
    admin = db.query(User).filter(User.id == user_id).first()
    if not admin or not admin.is_admin:
        raise HTTPException(status_code=403, detail="仅管理员可执行此操作")
    target = db.query(User).filter(User.id == target_user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="用户不存在")
    target.is_admin = True
    db.commit()
    return {"ok": True}
