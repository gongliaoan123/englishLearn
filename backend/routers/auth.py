from datetime import datetime, timedelta
from jose import jwt
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from database import SessionLocal
from models import User
from middleware.auth import SECRET_KEY, ALGORITHM, require_current_user_id, get_current_user_id

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

TOKEN_EXPIRE_HOURS = 7 * 24  # 7 days


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


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

    class Config:
        from_attributes = True


@router.post("/register")
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    if len(body.username) < 3 or len(body.password) < 6:
        raise HTTPException(status_code=400, detail="用户名至少3位，密码至少6位")
    existing = db.query(User).filter(User.username == body.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="用户名已存在")
    user = User(username=body.username, password_hash=hash_password(body.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"user": {"id": user.id, "username": user.username}}


@router.post("/login")
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == body.username).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    token = create_token(user.id)
    return {"token": token, "user": {"id": user.id, "username": user.username}}


@router.get("/me", response_model=UserResponse)
def get_me(user_id: int = Depends(require_current_user_id), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    return UserResponse(id=user.id, username=user.username)


@router.post("/logout")
def logout(user_id: int = Depends(require_current_user_id)):
    return {"ok": True}
