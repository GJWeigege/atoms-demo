"""Sync GeneratedApp into ProjectFile records."""

from __future__ import annotations

import json

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import GeneratedApp, ProjectFile


def _tsx_mock(html: str, css: str, js: str) -> str:
    safe_html = html[:200].replace("`", "").replace("{", "{{").replace("}", "}}")
    return f'''import React from "react";

export default function Index() {{
  return (
    <div className="atoms-app">
      <style>{{`{css[:500]}...`}}</style>
      <div dangerouslySetInnerHTML={{{{ __html: `{safe_html}...` }}}} />
    </div>
  );
}}
'''


async def sync_project_files(db: AsyncSession, project_id: str, app: GeneratedApp) -> None:
    """Replace project files from GeneratedApp snapshot."""
    await db.execute(delete(ProjectFile).where(ProjectFile.projectId == project_id))

    files = [
        ("index.html", app.html),
        ("styles.css", app.css),
        ("scripts.js", app.js),
        ("src/pages/Index.tsx", _tsx_mock(app.html, app.css, app.js)),
    ]
    for path, content in files:
        db.add(
            ProjectFile(
                projectId=project_id,
                path=path,
                content=content,
                size=len(content.encode("utf-8")),
            )
        )


async def load_app_from_files(db: AsyncSession, project_id: str) -> dict[str, str] | None:
    result = await db.execute(
        select(ProjectFile).where(ProjectFile.projectId == project_id)
    )
    rows = {f.path: f.content for f in result.scalars().all()}
    if not rows:
        return None
    return {
        "html": rows.get("index.html", ""),
        "css": rows.get("styles.css", ""),
        "js": rows.get("scripts.js", ""),
    }


async def update_file_and_app(
    db: AsyncSession, project_id: str, path: str, content: str
) -> None:
    result = await db.execute(
        select(ProjectFile).where(
            ProjectFile.projectId == project_id,
            ProjectFile.path == path,
        )
    )
    pf = result.scalar_one_or_none()
    if pf:
        pf.content = content
        pf.size = len(content.encode("utf-8"))
    else:
        db.add(
            ProjectFile(
                projectId=project_id,
                path=path,
                content=content,
                size=len(content.encode("utf-8")),
            )
        )

    app_result = await db.execute(
        select(GeneratedApp).where(GeneratedApp.projectId == project_id)
    )
    app = app_result.scalar_one_or_none()
    if not app:
        return
    if path == "index.html":
        app.html = content
    elif path == "styles.css":
        app.css = content
    elif path == "scripts.js":
        app.js = content
    app.version += 1
