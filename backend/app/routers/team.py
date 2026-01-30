"""
Team API Router
"""
import json
from datetime import datetime
from typing import List
from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel

from ..services.stats_service import run_team_merge, generate_markdown_report, parse_markdown_report

router = APIRouter()


class ExportRequest(BaseModel):
    type: str  # "personal" or "team"
    data: dict


def markdown_to_json_stats(md_data: dict) -> list:
    """
    Convert parsed markdown data to JSON format compatible with team_summary.py
    """
    username = md_data.get("username", "unknown")
    results = []

    # Claude Code stats
    if md_data.get("claude_code"):
        cc = md_data["claude_code"]
        cc_stats = {
            "metadata": {
                "generated_at": datetime.now().isoformat(),
                "start_date": md_data.get("start_date", ""),
                "end_date": md_data.get("end_date", ""),
                "username": username,
                "machine": "imported",
            },
            "summary": {
                "total_input_tokens": cc.get("total_input_tokens", 0),
                "total_output_tokens": cc.get("total_output_tokens", 0),
                "total_cache_creation_tokens": cc.get("total_cache_creation_tokens", 0),
                "total_cache_read_tokens": cc.get("total_cache_read_tokens", 0),
                "total_tokens": cc.get("total_input_tokens", 0) + cc.get("total_output_tokens", 0),
                "total_tokens_with_cache": cc.get("total_tokens_with_cache", 0),
                "total_sessions": cc.get("total_sessions", 0),
                "total_user_messages": 0,
                "total_assistant_messages": 0,
                "total_tool_calls": 0,
                "active_days": cc.get("active_days", 0),
                "active_projects": 0,
            },
            "by_model": {},
            "by_project": {},
            "by_day": {},
        }
        results.append((f"{username}_claude.json", json.dumps(cc_stats).encode()))

    # Cursor stats
    if md_data.get("cursor"):
        cu = md_data["cursor"]
        cu_stats = {
            "metadata": {
                "generated_at": datetime.now().isoformat(),
                "start_date": md_data.get("start_date", ""),
                "end_date": md_data.get("end_date", ""),
                "username": username,
                "machine": "imported",
                "source": "cursor",
                "csv_files": [],
            },
            "summary": {
                "input_tokens_with_cache": cu.get("input_tokens_with_cache", 0),
                "input_tokens_without_cache": cu.get("input_tokens_without_cache", 0),
                "cache_read_tokens": cu.get("cache_read_tokens", 0),
                "output_tokens": cu.get("output_tokens", 0),
                "total_tokens": cu.get("total_tokens", 0),
                "requests": cu.get("requests", 0),
                "records": 0,
                "errored_records": 0,
                "active_days": cu.get("active_days", 0),
                "users_count": 1,
            },
            "by_model": {},
            "by_user": {},
            "by_day": {},
        }
        results.append((f"{username}_cursor.json", json.dumps(cu_stats).encode()))

    return results


@router.post("/merge")
async def merge_team_stats(
    files: List[UploadFile] = File(..., description="Markdown report files"),
):
    """
    Merge multiple team member markdown reports into team summary
    """
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded")

    json_files = []
    for file in files:
        content = await file.read()
        filename = file.filename or "unknown"

        if not filename.endswith(".md"):
            raise HTTPException(
                status_code=400,
                detail=f"File {filename} must be a Markdown (.md) file"
            )

        # Parse markdown file and convert to JSON format
        try:
            md_data = parse_markdown_report(content.decode("utf-8"))
            converted = markdown_to_json_stats(md_data)
            json_files.extend(converted)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=f"Error parsing {filename}: {str(e)}")

    if not json_files:
        raise HTTPException(status_code=400, detail="No valid stats data found in uploaded files")

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
