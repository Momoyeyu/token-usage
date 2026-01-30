"""
Stats Service - Wrapper for existing statistics scripts
"""
import json
import re
import subprocess
import tempfile
from pathlib import Path
from datetime import datetime, timedelta, timezone
from typing import Optional

# Path to scripts directory
SCRIPTS_DIR = Path(__file__).parent.parent.parent / "scripts"


def parse_markdown_report(content: str) -> dict:
    """
    Parse a markdown report and extract embedded stats data.
    Returns the stats data as a dict, or raises ValueError if invalid.
    """
    # Look for embedded JSON data in HTML comment
    pattern = r'<!--STATS_DATA\s*(\{.*?\})\s*STATS_DATA-->'
    match = re.search(pattern, content, re.DOTALL)

    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON in markdown: {e}")

    # Fallback: try to parse from table (less reliable)
    raise ValueError("No embedded stats data found in markdown. Please use a report exported from this dashboard.")


def get_week_date_range() -> tuple[str, str]:
    """Get current week date range (Monday to today)"""
    now = datetime.now(timezone.utc)
    days_since_monday = now.weekday()
    start = (now - timedelta(days=days_since_monday)).strftime("%Y-%m-%d")
    end = now.strftime("%Y-%m-%d")
    return start, end


def run_claude_code_stats(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    days: Optional[int] = None,
    week: bool = False,
    username: Optional[str] = None,
) -> dict:
    """
    Run claude_code_stats.py and return parsed JSON result
    """
    script_path = SCRIPTS_DIR / "claude_code_stats.py"

    cmd = ["python3", str(script_path), "--json"]

    if start_date and end_date:
        cmd.extend(["--start", start_date, "--end", end_date])
    elif days:
        cmd.extend(["--days", str(days)])
    elif week:
        cmd.append("--week")
    else:
        # Default to this week
        cmd.append("--week")

    if username:
        cmd.extend(["--username", username])

    result = subprocess.run(cmd, capture_output=True, text=True)

    if result.returncode != 0:
        raise RuntimeError(f"Script failed: {result.stderr}")

    return json.loads(result.stdout)


def run_cursor_stats(
    csv_content: bytes,
    filename: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    username: Optional[str] = None,
) -> dict:
    """
    Run cursor_stats.py with uploaded CSV content
    """
    script_path = SCRIPTS_DIR / "cursor_stats.py"

    # Write CSV to temp file
    with tempfile.NamedTemporaryFile(
        mode="wb", suffix=".csv", delete=False
    ) as tmp:
        tmp.write(csv_content)
        tmp_path = tmp.name

    try:
        cmd = ["python3", str(script_path), tmp_path, "--json"]

        if start_date and end_date:
            cmd.extend(["--start", start_date, "--end", end_date])

        if username:
            cmd.extend(["--username", username])

        result = subprocess.run(cmd, capture_output=True, text=True)

        if result.returncode != 0:
            raise RuntimeError(f"Script failed: {result.stderr}")

        return json.loads(result.stdout)
    finally:
        Path(tmp_path).unlink(missing_ok=True)


def run_team_merge(json_files: list[tuple[str, bytes]]) -> dict:
    """
    Run team_summary.py with multiple JSON files
    """
    script_path = SCRIPTS_DIR / "team_summary.py"
    tmp_paths = []

    try:
        # Write all JSON files to temp files
        for filename, content in json_files:
            with tempfile.NamedTemporaryFile(
                mode="wb", suffix=".json", delete=False
            ) as tmp:
                tmp.write(content)
                tmp_paths.append(tmp.name)

        cmd = ["python3", str(script_path), "--json"] + tmp_paths

        result = subprocess.run(cmd, capture_output=True, text=True)

        if result.returncode != 0:
            raise RuntimeError(f"Script failed: {result.stderr}")

        return json.loads(result.stdout)
    finally:
        for path in tmp_paths:
            Path(path).unlink(missing_ok=True)


def generate_markdown_report(data: dict, report_type: str = "personal") -> str:
    """
    Generate Markdown report from stats data
    """
    if report_type == "personal":
        return _generate_personal_markdown(data)
    else:
        return _generate_team_markdown(data)


def _format_tokens(n: float, with_sign: bool = False) -> str:
    """Format token number with K/M suffix"""
    n = int(n)
    prefix = ""
    if with_sign and n > 0:
        prefix = "+"

    abs_n = abs(n)
    sign = "-" if n < 0 else ""

    if abs_n >= 1_000_000:
        return f"{prefix}{sign}{abs_n/1_000_000:.2f}M"
    elif abs_n >= 1_000:
        return f"{prefix}{sign}{abs_n/1_000:.1f}K"
    return f"{prefix}{n}"


def _generate_personal_markdown(data: dict) -> str:
    """Generate personal report markdown"""
    cc = data.get("claude_code") or {}
    cu = data.get("cursor") or {}

    cc_summary = cc.get("summary", {})
    cu_summary = cu.get("summary", {})
    cc_meta = cc.get("metadata", {})
    cu_meta = cu.get("metadata", {})

    # Get values - matching frontend ComparisonTable fields
    cc_total = cc_summary.get("total_tokens_with_cache", cc_summary.get("total_tokens", 0))
    cu_total = cu_summary.get("total_tokens", 0)

    cc_input = cc_summary.get("total_input_tokens", 0)
    cu_input = cu_summary.get("input_tokens_with_cache", 0)

    cc_cache_creation = cc_summary.get("total_cache_creation_tokens", 0)
    cu_cache_creation = cu_summary.get("input_tokens_with_cache", 0) - cu_summary.get("input_tokens_without_cache", 0)

    cc_cache_read = cc_summary.get("total_cache_read_tokens", 0)
    cu_cache_read = cu_summary.get("cache_read_tokens", 0)

    cc_output = cc_summary.get("total_output_tokens", 0)
    cu_output = cu_summary.get("output_tokens", 0)

    cc_days = cc_summary.get("active_days", 0)
    cu_days = cu_summary.get("active_days", 0)

    cc_sessions = cc_summary.get("total_sessions", 0)
    cu_requests = cu_summary.get("requests", 0)

    # Check if cursor data exists
    has_cursor = bool(cu_summary)

    # Calculate migration ratio
    migration_ratio = (cc_total / cu_total * 100) if cu_total > 0 else 0

    # Get date range
    start_date = (cc_meta.get("start_date") or cu_meta.get("start_date") or "N/A")[:10]
    end_date = (cc_meta.get("end_date") or cu_meta.get("end_date") or "N/A")[:10]
    username = cc_meta.get("username") or cu_meta.get("username") or "Unknown"

    # Build table based on whether cursor data exists
    if has_cursor:
        table = f"""| 指标 | Claude Code | Cursor | 差异 |
|------|-------------|--------|------|
| Token 总量 | {_format_tokens(cc_total)} | {_format_tokens(cu_total)} | {_format_tokens(cc_total - cu_total, with_sign=True)} |
| 输入 Token | {_format_tokens(cc_input)} | {_format_tokens(cu_input)} | {_format_tokens(cc_input - cu_input, with_sign=True)} |
| 缓存写入 Token | {_format_tokens(cc_cache_creation)} | {_format_tokens(cu_cache_creation)} | {_format_tokens(cc_cache_creation - cu_cache_creation, with_sign=True)} |
| 缓存读取 Token | {_format_tokens(cc_cache_read)} | {_format_tokens(cu_cache_read)} | {_format_tokens(cc_cache_read - cu_cache_read, with_sign=True)} |
| 输出 Token | {_format_tokens(cc_output)} | {_format_tokens(cu_output)} | {_format_tokens(cc_output - cu_output, with_sign=True)} |
| 活跃天数 | {cc_days} | {cu_days} | {cc_days - cu_days:+d} |
| 会话/请求数 | {cc_sessions} | {int(cu_requests)} | {cc_sessions - int(cu_requests):+d} |"""
        migration_section = f"\n## 迁移进度\n\n**Claude Code / Cursor = {migration_ratio:.1f}%**\n"
    else:
        table = f"""| 指标 | Claude Code |
|------|-------------|
| Token 总量 | {_format_tokens(cc_total)} |
| 输入 Token | {_format_tokens(cc_input)} |
| 缓存写入 Token | {_format_tokens(cc_cache_creation)} |
| 缓存读取 Token | {_format_tokens(cc_cache_read)} |
| 输出 Token | {_format_tokens(cc_output)} |
| 活跃天数 | {cc_days} |
| 会话数 | {cc_sessions} |"""
        migration_section = ""

    md = f"""# 使用统计报告

**用户**: {username}
**统计周期**: {start_date} ~ {end_date}
**生成时间**: {datetime.now().strftime("%Y-%m-%d %H:%M")}

---

## 统计表格

{table}
{migration_section}
---

*报告由 Usage Stats Dashboard 生成*

<!--STATS_DATA
{json.dumps({
    "type": "personal",
    "version": 2,
    "username": username,
    "start_date": start_date,
    "end_date": end_date,
    "claude_code": {
        "summary": cc_summary,
        "by_day": cc.get("by_day", {})
    },
    "cursor": {
        "summary": cu_summary,
        "by_day": cu.get("by_day", {})
    }
}, ensure_ascii=False)}
STATS_DATA-->
"""
    return md


def _generate_team_markdown(data: dict) -> str:
    """Generate team report markdown"""
    meta = data.get("metadata", {})
    team = data.get("team_summary", {})
    members = data.get("by_member", {})
    date_range = data.get("date_range", {})

    cc = team.get("claude_code") or {}
    cu = team.get("cursor") or {}

    total_members = meta.get("total_members", 0)
    start_date = (date_range.get("start") or "N/A")[:10]
    end_date = (date_range.get("end") or "N/A")[:10]

    cc_total = cc.get("total_tokens_with_cache", cc.get("total_tokens", 0))
    cu_total = cu.get("total_tokens", 0)

    # Check if cursor data exists
    has_cursor = cu_total > 0 or cu.get("members", 0) > 0

    # Calculate migration ratio - handle cursor = 0 case
    if cu_total > 0:
        migration_ratio_display = f"{(cc_total / cu_total * 100):.1f}%"
    elif cc_total > 0:
        migration_ratio_display = "∞ (已完全迁移)"
    else:
        migration_ratio_display = "0%"

    # Build members table
    members_rows = []
    for name, stats in members.items():
        cc_member = stats.get("claude_code") or {}
        cu_member = stats.get("cursor") or {}
        cc_val = cc_member.get("total_tokens_with_cache", cc_member.get("total_tokens", 0)) if cc_member else 0
        cu_val = cu_member.get("total_tokens", 0) if cu_member else 0
        if has_cursor:
            members_rows.append(f"| {name} | {_format_tokens(cc_val)} | {_format_tokens(cu_val)} |")
        else:
            members_rows.append(f"| {name} | {_format_tokens(cc_val)} |")

    members_table = "\n".join(members_rows)

    # Build sections based on whether cursor data exists
    if has_cursor:
        overview_table = f"""| 工具 | Token 总量 | 成员数 |
|------|------------|--------|
| Claude Code | {_format_tokens(cc_total)} | {cc.get("members", 0)} |
| Cursor | {_format_tokens(cu_total)} | {cu.get("members", 0)} |"""
        migration_section = f"\n## 迁移进度\n\n**Claude Code / Cursor = {migration_ratio_display}**\n"
        members_header = "| 成员 | Claude Code | Cursor |\n|------|-------------|--------|"
    else:
        overview_table = f"""| 工具 | Token 总量 | 成员数 |
|------|------------|--------|
| Claude Code | {_format_tokens(cc_total)} | {cc.get("members", 0)} |"""
        migration_section = ""
        members_header = "| 成员 | Claude Code |\n|------|-------------|"

    md = f"""# 团队使用统计报告

**团队成员**: {total_members} 人
**统计周期**: {start_date} ~ {end_date}
**生成时间**: {datetime.now().strftime("%Y-%m-%d %H:%M")}

---

## 总体对比

{overview_table}
{migration_section}
## 成员明细

{members_header}
{members_table}

---

*报告由 Usage Stats Dashboard 生成*
"""
    return md
