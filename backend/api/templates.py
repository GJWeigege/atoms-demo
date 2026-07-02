from fastapi import APIRouter, HTTPException, Response

from shared_config import ConfigLoadError, get_project_templates

router = APIRouter(prefix="/api/templates", tags=["templates"])


@router.get("", deprecated=True)
async def list_templates(response: Response):
    """Deprecated — use GET /api/config instead."""
    response.headers["Deprecation"] = "true"
    response.headers["Link"] = '</api/config>; rel="successor-version"'
    try:
        return {"templates": get_project_templates()}
    except ConfigLoadError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
