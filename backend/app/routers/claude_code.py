"""
Claude Code API Router
"""
from typing import Optional
from fastapi import APIRouter, HTTPException, Query

from ..services.stats_service import run_claude_code_stats

router = APIRouter()


@router.get("/stats")
async def get_claude_code_stats(
    start: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    days: Optional[int] = Query(None, description="Last N days"),
    week: bool = Query(False, description="This week"),
    username: Optional[str] = Query(None, description="Username"),
):
    """
    Get Claude Code usage statistics from local data
    """
    try:
        result = run_claude_code_stats(
            start_date=start,
            end_date=end,
            days=days,
            week=week or (not start and not days),
            username=username,
        )
        return {"success": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
