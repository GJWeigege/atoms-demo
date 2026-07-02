"""Project file tree API."""

from __future__ import annotations

from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from auth.jwt import require_user
from db.models import GeneratedApp, Project, ProjectFile, User
from db.session import get_db
from services.path_utils import InvalidFilePathError, normalize_project_file_path
from services.project_files import sync_project_files, update_file_and_app

router = APIRouter(prefix="/api/projects", tags=["files"])


class FileContentBody(BaseModel):
    content: str


def _dt(dt: datetime | None) -> str | None:
    return dt.isoformat() if dt else None


def _safe_path(raw: str) -> str:
    try:
        return normalize_project_file_path(raw)
    except InvalidFilePathError as exc:
        raise HTTPException(400, "非法文件路径") from exc


@router.get("/{project_id}/files")
async def list_files(
    project_id: str,
    user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    proj = await db.execute(
        select(Project)
        .where(Project.id == project_id, Project.userId == user.id)
        .options(selectinload(Project.generatedApp))
    )
    project = proj.scalar_one_or_none()
    if not project:
        raise HTTPException(404, "项目不存在")

    result = await db.execute(
        select(ProjectFile)
        .where(ProjectFile.projectId == project_id)
        .order_by(ProjectFile.path)
    )
    files = result.scalars().all()

    if not files and project.generatedApp:
        await sync_project_files(db, project_id, project.generatedApp)
        await db.commit()
        result = await db.execute(
            select(ProjectFile)
            .where(ProjectFile.projectId == project_id)
            .order_by(ProjectFile.path)
        )
        files = result.scalars().all()

    return {
        "files": [
            {
                "id": f.id,
                "path": f.path,
                "size": f.size,
                "updatedAt": _dt(f.updatedAt),
            }
            for f in files
        ]
    }


@router.get("/{project_id}/files/{file_path:path}")
async def get_file(
    project_id: str,
    file_path: str,
    user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    path = _safe_path(file_path)
    proj = await db.execute(
        select(Project).where(Project.id == project_id, Project.userId == user.id)
    )
    if not proj.scalar_one_or_none():
        raise HTTPException(404, "项目不存在")

    result = await db.execute(
        select(ProjectFile).where(
            ProjectFile.projectId == project_id,
            ProjectFile.path == path,
        )
    )
    pf = result.scalar_one_or_none()
    if not pf:
        raise HTTPException(404, "文件不存在")
    return {
        "file": {
            "path": pf.path,
            "content": pf.content,
            "size": pf.size,
            "updatedAt": _dt(pf.updatedAt),
        }
    }


@router.put("/{project_id}/files/{file_path:path}")
async def put_file(
    project_id: str,
    file_path: str,
    body: FileContentBody,
    user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    path = _safe_path(file_path)
    proj = await db.execute(
        select(Project)
        .where(Project.id == project_id, Project.userId == user.id)
        .options(selectinload(Project.generatedApp))
    )
    project = proj.scalar_one_or_none()
    if not project:
        raise HTTPException(404, "项目不存在")

    await update_file_and_app(db, project_id, path, body.content)
    await db.commit()

    result = await db.execute(
        select(ProjectFile).where(
            ProjectFile.projectId == project_id,
            ProjectFile.path == path,
        )
    )
    pf = result.scalar_one_or_none()
    version = project.generatedApp.version if project.generatedApp else 1
    return {
        "ok": True,
        "file": {
            "path": path,
            "size": pf.size if pf else len(body.content.encode("utf-8")),
            "updatedAt": _dt(pf.updatedAt) if pf else None,
        },
        "version": version,
    }
