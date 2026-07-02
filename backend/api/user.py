from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth.jwt import require_user
from config import get_settings
from db.models import User
from db.session import get_db
from services.github import validate_github_token

router = APIRouter(prefix="/api/user", tags=["user"])


class SettingsBody(BaseModel):
    githubToken: str | None = None


@router.get("/settings")
async def get_settings_route(user: User = Depends(require_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User.githubToken).where(User.id == user.id))
    github_token = result.scalar_one_or_none()
    settings = get_settings()
    has_env = bool(settings.github_token.strip())
    has_user = bool(github_token and github_token.strip())
    return {
        "github": {
            "configured": has_env or has_user,
            "source": "user" if has_user else ("env" if has_env else None),
        }
    }


@router.patch("/settings")
async def update_settings(
    body: SettingsBody,
    user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    settings = get_settings()
    result = await db.execute(select(User).where(User.id == user.id))
    db_user = result.scalar_one()

    if body.githubToken is None or body.githubToken == "":
        db_user.githubToken = None
        await db.commit()
        return {"ok": True, "github": {"configured": bool(settings.github_token.strip())}}

    if not body.githubToken.strip():
        raise HTTPException(400, "Token 无效")

    valid = await validate_github_token(body.githubToken.strip())
    if not valid:
        raise HTTPException(400, "GitHub Token 验证失败")

    db_user.githubToken = body.githubToken.strip()
    await db.commit()
    return {"ok": True, "github": {"configured": True, "source": "user"}}
