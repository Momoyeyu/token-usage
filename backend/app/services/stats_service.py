"""
Stats Service - Wrapper for existing statistics scripts
"""
import json
import subprocess
import tempfile
from pathlib import Path
from datetime import datetime, timedelta, timezone
from typing import Optional

# Path to scripts directory
SCRIPTS_DIR = Path(__file__).parent.parent.parent / "scripts"


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


def _format_tokens(n: float) -> str:
    """Format token number with K/M suffix"""
    n = int(n)
    if n >= 1_000_000:
        return f"{n/1_000_000:.2f}M"
    elif n >= 1_000:
        return f"{n/1_000:.1f}K"
    return str(n)


def _generate_personal_markdown(data: dict) -> str:
    """Generate personal report markdown"""
    cc = data.get("claude_code", {})
    cu = data.get("cursor", {})

    cc_summary = cc.get("summary", {})
    cu_summary = cu.get("summary", {})
    cc_meta = cc.get("metadata", {})
    cu_meta = cu.get("metadata", {})

    # Get values
    cc_total = cc_summary.get("total_tokens_with_cache", cc_summary.get("total_tokens", 0))
    cu_total = cu_summary.get("total_tokens", 0)

    cc_input = cc_summary.get("total_input_tokens", 0)
    cu_input = cu_summary.get("input_tokens_with_cache", 0)

    cc_output = cc_summary.get("total_output_tokens", 0)
    cu_output = cu_summary.get("output_tokens", 0)

    cc_days = cc_summary.get("active_days", 0)
    cu_days = cu_summary.get("active_days", 0)

    # Calculate migration ratio
    migration_ratio = (cc_total / cu_total * 100) if cu_total > 0 else 0

    # Get date range
    start_date = cc_meta.get("start_date", cu_meta.get("start_date", "N/A"))[:10]
    end_date = cc_meta.get("end_date", cu_meta.get("end_date", "N/A"))[:10]
    username = cc_meta.get("username", cu_meta.get("username", "Unknown"))

    md = f"""# 使用统计报告

**用户**: {username}
**统计周期**: {start_date} ~ {end_date}
**生成时间**: {datetime.now().strftime("%Y-%m-%d %H:%M")}

---

## 对比表格

| 指标 | Claude Code | Cursor | 差异 |
|------|-------------|--------|------|
| Token 总量 | {_format_tokens(cc_total)} | {_format_tokens(cu_total)} | {_format_tokens(cc_total - cu_total)} |
| 输入 Token | {_format_tokens(cc_input)} | {_format_tokens(cu_input)} | - |
| 输出 Token | {_format_tokens(cc_output)} | {_format_tokens(cu_output)} | - |
| 活跃天数 | {cc_days} | {cu_days} | - |

## 迁移进度

**Claude Code / Cursor = {migration_ratio:.1f}%**

---

*报告由 Usage Stats Dashboard 生成*
"""
    return md


def _generate_team_markdown(data: dict) -> str:
    """Generate team report markdown"""
    meta = data.get("metadata", {})
    team = data.get("team_summary", {})
    members = data.get("by_member", {})
    date_range = data.get("date_range", {})

    cc = team.get("claude_code", {})
    cu = team.get("cursor", {})

    total_members = meta.get("total_members", 0)
    start_date = (date_range.get("start") or "N/A")[:10]
    end_date = (date_range.get("end") or "N/A")[:10]

    cc_total = cc.get("total_tokens_with_cache", cc.get("total_tokens", 0))
    cu_total = cu.get("total_tokens", 0)

    migration_ratio = (cc_total / cu_total * 100) if cu_total > 0 else 0

    # Build members table
    members_rows = []
    for name, stats in members.items():
        cc_member = stats.get("claude_code", {})
        cu_member = stats.get("cursor", {})
        cc_val = cc_member.get("total_tokens_with_cache", cc_member.get("total_tokens", 0)) if cc_member else 0
        cu_val = cu_member.get("total_tokens", 0) if cu_member else 0
        members_rows.append(f"| {name} | {_format_tokens(cc_val)} | {_format_tokens(cu_val)} |")

    members_table = "\n".join(members_rows)

    md = f"""# 团队使用统计报告

**团队成员**: {total_members} 人
**统计周期**: {start_date} ~ {end_date}
**生成时间**: {datetime.now().strftime("%Y-%m-%d %H:%M")}

---

## 总体对比

| 工具 | Token 总量 | 成员数 |
|------|------------|--------|
| Claude Code | {_format_tokens(cc_total)} | {cc.get("members", 0)} |
| Cursor | {_format_tokens(cu_total)} | {cu.get("members", 0)} |

## 迁移进度

**Claude Code / Cursor = {migration_ratio:.1f}%**

## 成员明细

| 成员 | Claude Code | Cursor |
|------|-------------|--------|
{members_table}

---

*报告由 Usage Stats Dashboard 生成*
"""
    return md
