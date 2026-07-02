"""Safe path normalization for project file APIs."""

from __future__ import annotations

from urllib.parse import unquote


class InvalidFilePathError(ValueError):
    pass


def normalize_project_file_path(raw: str) -> str:
    """Reject traversal segments and normalize to a relative project path."""
    path = unquote(raw).replace("\\", "/").strip()
    while path.startswith("/"):
        path = path[1:]
    if not path:
        raise InvalidFilePathError("empty path")
    parts = [p for p in path.split("/") if p not in ("", ".")]
    if any(p == ".." for p in parts):
        raise InvalidFilePathError("path traversal")
    return "/".join(parts)
