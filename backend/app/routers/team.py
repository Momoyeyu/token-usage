"""
Team API Router
"""
from typing import List
from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel

from ..services.stats_service import run_team_merge, generate_markdown_report

router = APIRouter()


class ExportRequest(BaseModel):
    type: str  # "personal" or "team"
    data: dict


@router.post("/merge")
async def merge_team_stats(
    files: List[UploadFile] = File(..., description="JSON stats files"),
):
    """
    Merge multiple team member JSON files into team summary
    """
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded")

    json_files = []
    for file in files:
        if not file.filename.endswith(".json"):
            raise HTTPException(
                status_code=400,
                detail=f"File {file.filename} must be a JSON file"
            )
        content = await file.read()
        json_files.append((file.filename, content))

    try:
        result = run_team_merge(json_files)
        return {"success": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/export/markdown")
async def export_markdown(request: ExportRequest):
    """
    Generate Markdown report from stats data
    """
    try:
        markdown = generate_markdown_report(request.data, request.type)
        return {"success": True, "markdown": markdown}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
