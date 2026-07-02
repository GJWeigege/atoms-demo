import sys
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Ensure backend root is on path when running as module
BACKEND_ROOT = Path(__file__).parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from api.config import router as config_router
from api.auth import router as auth_router
from api.conversations import router as conversations_router
from api.files import router as files_router
from api.projects import router as projects_router
from api.streaming import router as streaming_router
from api.templates import router as templates_router
from api.user import router as user_router
from config import get_settings
from db.models import Base
from db.session import engine
from mcp_tools.artifact_tools import list_mcp_tools


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        from db.migrate import migrate_conversation_message_columns

        await conn.run_sync(migrate_conversation_message_columns)
    yield
    await engine.dispose()


app = FastAPI(
    title="Atoms Demo API",
    description="Python backend — FastAPI + LangGraph",
    version="0.1.0",
    lifespan=lifespan,
)

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(config_router)
app.include_router(auth_router)
app.include_router(conversations_router)
app.include_router(projects_router)
app.include_router(streaming_router)
app.include_router(files_router)
app.include_router(templates_router)
app.include_router(user_router)


@app.get("/api/health")
async def health():
    return {"status": "ok", "backend": "python"}


@app.get("/api/mcp/tools")
async def mcp_tools():
    """MCP integration point — lists tool specs for future MCP server."""
    return {"tools": list_mcp_tools()}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
