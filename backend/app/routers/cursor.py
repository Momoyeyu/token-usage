"""
Cursor API Router
"""
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, UploadFile, File

from ..services.stats_service import run_cursor_stats

router = APIRouter()


@router.post("/upload")
async def upload_cursor_csv(
    file: UploadFile = File(..., description="Cursor usage CSV file"),
    start: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    username: Optional[str] = Query(None, description="Username"),
):
    """
    Upload and parse Cursor usage CSV file
    """
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="File must be a CSV")

    try:
        content = await file.read()
        result = run_cursor_stats(
            csv_content=content,
            filename=file.filename,
            start_date=start,
            end_date=end,
            username=username,
        )
        return {"success": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
