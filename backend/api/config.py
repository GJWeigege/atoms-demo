import logging

from fastapi import APIRouter, HTTPException

from shared_config import ConfigLoadError, get_app_config

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/config", tags=["config"])


@router.get("")
async def get_config():
    """Public app config for the frontend (whitelist fields only)."""
    try:
        return get_app_config()
    except ConfigLoadError as exc:
        logger.error("Config load failed: %s", exc)
        raise HTTPException(status_code=503, detail=str(exc)) from exc
