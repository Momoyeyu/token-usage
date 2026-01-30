"""
Usage Stats Dashboard - FastAPI Backend
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import claude_code, cursor, team

app = FastAPI(
    title="Usage Stats Dashboard API",
    description="API for Claude Code and Cursor usage statistics",
    version="1.0.0",
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(claude_code.router, prefix="/api/claude-code", tags=["Claude Code"])
app.include_router(cursor.router, prefix="/api/cursor", tags=["Cursor"])
app.include_router(team.router, prefix="/api/team", tags=["Team"])


@app.get("/")
async def root():
    return {"message": "Usage Stats Dashboard API", "version": "1.0.0"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
