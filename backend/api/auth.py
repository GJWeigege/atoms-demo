from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth.jwt import (
    clear_session_cookie,
    create_token,
    get_current_user,
    hash_password,
    set_session_cookie,
    verify_password,
)
from db.models import User
from db.session import get_db

router = APIRouter(prefix="/api/auth", tags=["auth"])


class RegisterBody(BaseModel):
    email: str
    password: str
    name: str


class LoginBody(BaseModel):
    email: str
    password: str


@router.post("/register")
async def register(
    body: RegisterBody,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    if not body.email or not body.password or not body.name:
        raise HTTPException(400, "邮箱、密码和姓名不能为空")
    if len(body.password) < 6:
        raise HTTPException(400, "密码至少 6 位")

    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(409, "该邮箱已注册")

    user = User(
        email=body.email,
        name=body.name,
        passwordHash=hash_password(body.password),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = create_token(user)
    set_session_cookie(response, token)
    return {
        "user": {"id": user.id, "email": user.email, "name": user.name},
        "token": token,
    }


@router.post("/login")
async def login(
    body: LoginBody,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    if not body.email or not body.password:
        raise HTTPException(400, "邮箱和密码不能为空")

    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(body.password, user.passwordHash):
        raise HTTPException(401, "邮箱或密码错误")

    token = create_token(user)
    set_session_cookie(response, token)
    return {
        "user": {"id": user.id, "email": user.email, "name": user.name},
        "token": token,
    }


@router.post("/logout")
async def logout(response: Response):
    clear_session_cookie(response)
    return {"ok": True}


@router.get("/me")
async def me(user: User | None = Depends(get_current_user)):
    if not user:
        return {"user": None}
    return {"user": {"id": user.id, "email": user.email, "name": user.name}}
