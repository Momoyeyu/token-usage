#!/usr/bin/env python3
"""
Claude Code 使用统计脚本
统计 Claude Code 在指定时间范围内的使用情况

数据来源：
1. ~/.claude/stats-cache.json - 全局统计缓存
2. ~/.claude/projects/*/sessions-index.json - 项目会话索引
3. ~/.claude/projects/*/*.jsonl - 会话详细消息（包含精确 token 数据）
"""

import json
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from collections import defaultdict
import argparse


def get_claude_dir() -> Path:
    """获取 Claude Code 数据目录"""
    return Path.home() / ".claude"


def parse_timestamp(ts: str) -> datetime:
    """解析 ISO 格式时间戳，返回 UTC 时间（带时区信息）"""
    # 处理不同格式的时间戳
    if ts.endswith("Z"):
        ts = ts[:-1] + "+00:00"
    try:
        dt = datetime.fromisoformat(ts)
        # 如果没有时区信息，假定为 UTC
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except ValueError:
        # 处理毫秒
        dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt


def load_stats_cache() -> dict:
    """加载全局统计缓存"""
    stats_file = get_claude_dir() / "stats-cache.json"
    if stats_file.exists():
        with open(stats_file, "r") as f:
            return json.load(f)
    return {}


def get_project_dirs() -> list[Path]:
    """获取所有项目目录"""
    projects_dir = get_claude_dir() / "projects"
    if not projects_dir.exists():
        return []
    return [d for d in projects_dir.iterdir() if d.is_dir()]


def load_sessions_index(project_dir: Path) -> dict:
    """加载项目的会话索引"""
    index_file = project_dir / "sessions-index.json"
    if index_file.exists():
        with open(index_file, "r") as f:
            return json.load(f)
    return {"entries": []}


def analyze_jsonl_file(jsonl_path: Path, start_date: datetime, end_date: datetime) -> dict:
    """分析单个 JSONL 文件，提取 token 使用数据"""
    stats = {
        "input_tokens": 0,
        "output_tokens": 0,
        "cache_creation_input_tokens": 0,
        "cache_read_input_tokens": 0,
        "user_messages": 0,
        "assistant_messages": 0,
        "tool_calls": 0,
        "models_used": defaultdict(lambda: {
            "input_tokens": 0,
            "output_tokens": 0,
            "cache_creation_input_tokens": 0,
            "cache_read_input_tokens": 0,
            "requests": 0,
        }),
        "by_day": defaultdict(lambda: {
            "input_tokens": 0,
            "output_tokens": 0,
            "cache_creation_input_tokens": 0,
            "cache_read_input_tokens": 0,
            "requests": 0,
        }),
    }

    if not jsonl_path.exists():
        return stats

    seen_request_ids = set()  # 避免重复计算同一请求的 token

    try:
        with open(jsonl_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    record = json.loads(line)
                except json.JSONDecodeError:
                    continue

                # 检查时间戳是否在范围内
                timestamp_str = record.get("timestamp")
                if not timestamp_str:
                    continue

                try:
                    timestamp = parse_timestamp(timestamp_str)
                except (ValueError, TypeError):
                    continue

                # 检查是否在日期范围内
                if timestamp < start_date or timestamp > end_date:
                    continue

                record_type = record.get("type")

                if record_type == "user":
                    # 检查是否是用户消息（非工具结果）
                    message = record.get("message", {})
                    content = message.get("content", "")
                    if isinstance(content, str) or (
                        isinstance(content, list) and
                        any(c.get("type") == "text" for c in content if isinstance(c, dict))
                    ):
                        stats["user_messages"] += 1

                elif record_type == "assistant":
                    message = record.get("message", {})
                    usage = message.get("usage", {})
                    request_id = record.get("requestId", "")
                    model = message.get("model", "unknown")

                    # 只统计每个请求一次（避免流式响应重复计算）
                    if request_id and request_id in seen_request_ids:
                        continue
                    if request_id:
                        seen_request_ids.add(request_id)

                    if usage:
                        input_tokens = usage.get("input_tokens", 0)
                        output_tokens = usage.get("output_tokens", 0)
                        cache_creation = usage.get("cache_creation_input_tokens", 0)
                        cache_read = usage.get("cache_read_input_tokens", 0)

                        stats["input_tokens"] += input_tokens
                        stats["output_tokens"] += output_tokens
                        stats["cache_creation_input_tokens"] += cache_creation
                        stats["cache_read_input_tokens"] += cache_read

                        # 按模型统计
                        stats["models_used"][model]["input_tokens"] += input_tokens
                        stats["models_used"][model]["output_tokens"] += output_tokens
                        stats["models_used"][model]["cache_creation_input_tokens"] += cache_creation
                        stats["models_used"][model]["cache_read_input_tokens"] += cache_read
                        stats["models_used"][model]["requests"] += 1

                        # 按天统计
                        day = timestamp.date().isoformat()
                        stats["by_day"][day]["input_tokens"] += input_tokens
                        stats["by_day"][day]["output_tokens"] += output_tokens
                        stats["by_day"][day]["cache_creation_input_tokens"] += cache_creation
                        stats["by_day"][day]["cache_read_input_tokens"] += cache_read
                        stats["by_day"][day]["requests"] += 1

                    # 统计助手消息和工具调用
                    content = message.get("content", [])
                    if isinstance(content, list):
                        for item in content:
                            if isinstance(item, dict):
                                if item.get("type") == "text":
                                    stats["assistant_messages"] += 1
                                elif item.get("type") == "tool_use":
                                    stats["tool_calls"] += 1

    except Exception as e:
        print(f"Warning: Error reading {jsonl_path}: {e}", file=sys.stderr)

    return stats


def collect_stats(start_date: datetime, end_date: datetime, username: str = None) -> dict:
    """收集指定时间范围内的统计数据"""
    result = {
        "metadata": {
            "generated_at": datetime.now().isoformat(),
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "username": username or os.environ.get("USER", "unknown"),
            "machine": os.uname().nodename,
        },
        "summary": {
            "total_input_tokens": 0,
            "total_output_tokens": 0,
            "total_cache_creation_tokens": 0,
            "total_cache_read_tokens": 0,
            "total_tokens": 0,  # input + output (不含缓存，这是实际 API 调用的 token)
            "total_sessions": 0,
            "total_user_messages": 0,
            "total_assistant_messages": 0,
            "total_tool_calls": 0,
            "active_days": set(),
            "active_projects": set(),
        },
        "by_model": defaultdict(lambda: {
            "input_tokens": 0,
            "output_tokens": 0,
            "cache_creation_input_tokens": 0,
            "cache_read_input_tokens": 0,
            "requests": 0,
        }),
        "by_project": {},
        "by_day": defaultdict(lambda: {
            "input_tokens": 0,
            "output_tokens": 0,
            "cache_creation_input_tokens": 0,
            "cache_read_input_tokens": 0,
            "total_tokens_with_cache": 0,
        }),
    }

    project_dirs = get_project_dirs()

    for project_dir in project_dirs:
        project_name = project_dir.name
        sessions_index = load_sessions_index(project_dir)
        project_stats = {
            "input_tokens": 0,
            "output_tokens": 0,
            "cache_creation_input_tokens": 0,
            "cache_read_input_tokens": 0,
            "sessions": 0,
            "user_messages": 0,
            "assistant_messages": 0,
            "tool_calls": 0,
        }

        for entry in sessions_index.get("entries", []):
            session_id = entry.get("sessionId")
            if not session_id:
                continue

            # 检查会话时间是否可能在范围内
            created = entry.get("created")
            modified = entry.get("modified")
            if created:
                try:
                    created_dt = parse_timestamp(created)
                    # 如果会话创建时间晚于结束日期，跳过
                    if created_dt > end_date:
                        continue
                except (ValueError, TypeError):
                    pass

            if modified:
                try:
                    modified_dt = parse_timestamp(modified)
                    # 如果会话最后修改时间早于开始日期，跳过
                    if modified_dt < start_date:
                        continue
                except (ValueError, TypeError):
                    pass

            # 分析 JSONL 文件
            jsonl_path = project_dir / f"{session_id}.jsonl"
            session_stats = analyze_jsonl_file(jsonl_path, start_date, end_date)

            if session_stats["input_tokens"] > 0 or session_stats["user_messages"] > 0:
                project_stats["sessions"] += 1
                result["summary"]["total_sessions"] += 1
                result["summary"]["active_projects"].add(project_name)

                # 记录活跃日期
                if created:
                    try:
                        result["summary"]["active_days"].add(parse_timestamp(created).date())
                    except (ValueError, TypeError):
                        pass

            # 累加统计
            for key in ["input_tokens", "output_tokens", "cache_creation_input_tokens",
                       "cache_read_input_tokens", "user_messages", "assistant_messages", "tool_calls"]:
                project_stats[key] += session_stats[key]

            # 按模型统计
            for model, model_stats in session_stats["models_used"].items():
                for key in ["input_tokens", "output_tokens", "cache_creation_input_tokens",
                           "cache_read_input_tokens", "requests"]:
                    result["by_model"][model][key] += model_stats[key]

            # 按天统计
            for day, day_stats in session_stats["by_day"].items():
                result["by_day"][day]["input_tokens"] += day_stats["input_tokens"]
                result["by_day"][day]["output_tokens"] += day_stats["output_tokens"]
                result["by_day"][day]["cache_creation_input_tokens"] += day_stats["cache_creation_input_tokens"]
                result["by_day"][day]["cache_read_input_tokens"] += day_stats["cache_read_input_tokens"]
                # Calculate total with cache for this day
                day_total = (day_stats["input_tokens"] + day_stats["output_tokens"] +
                            day_stats["cache_creation_input_tokens"] + day_stats["cache_read_input_tokens"])
                result["by_day"][day]["total_tokens_with_cache"] += day_total
                # Track active days from actual data
                result["summary"]["active_days"].add(datetime.fromisoformat(day).date())

        # 累加到总计
        result["summary"]["total_input_tokens"] += project_stats["input_tokens"]
        result["summary"]["total_output_tokens"] += project_stats["output_tokens"]
        result["summary"]["total_cache_creation_tokens"] += project_stats["cache_creation_input_tokens"]
        result["summary"]["total_cache_read_tokens"] += project_stats["cache_read_input_tokens"]
        result["summary"]["total_user_messages"] += project_stats["user_messages"]
        result["summary"]["total_assistant_messages"] += project_stats["assistant_messages"]
        result["summary"]["total_tool_calls"] += project_stats["tool_calls"]

        if project_stats["sessions"] > 0:
            result["by_project"][project_name] = project_stats

    # 计算总 token
    # API Token: input + output（实际 API 调用消耗，不含缓存）
    result["summary"]["total_tokens"] = (
        result["summary"]["total_input_tokens"] +
        result["summary"]["total_output_tokens"]
    )
    # 全量 Token: input + output + cache_read + cache_creation（与 Cursor 的 Total Tokens 对应）
    result["summary"]["total_tokens_with_cache"] = (
        result["summary"]["total_input_tokens"] +
        result["summary"]["total_output_tokens"] +
        result["summary"]["total_cache_read_tokens"] +
        result["summary"]["total_cache_creation_tokens"]
    )

    # 转换 set 为 list
    result["summary"]["active_days"] = len(result["summary"]["active_days"])
    result["summary"]["active_projects"] = len(result["summary"]["active_projects"])

    # 转换 defaultdict 为普通 dict
    result["by_model"] = dict(result["by_model"])
    result["by_day"] = dict(result["by_day"])

    return result


def format_tokens(n: int) -> str:
    """格式化 token 数量"""
    if n >= 1_000_000:
        return f"{n/1_000_000:.2f}M"
    elif n >= 1_000:
        return f"{n/1_000:.1f}K"
    return str(n)


def print_summary(stats: dict):
    """打印统计摘要"""
    summary = stats["summary"]
    metadata = stats["metadata"]

    print("=" * 60)
    print("Claude Code 使用统计报告")
    print("=" * 60)
    print(f"\n用户: {metadata['username']} @ {metadata['machine']}")
    print(f"统计周期: {metadata['start_date'][:10]} ~ {metadata['end_date'][:10]}")
    print(f"生成时间: {metadata['generated_at'][:19]}")

    print("\n📊 Token 使用量")
    print("-" * 40)
    print(f"  输入 Token:        {format_tokens(summary['total_input_tokens']):>12}")
    print(f"  输出 Token:        {format_tokens(summary['total_output_tokens']):>12}")
    print(f"  缓存创建 Token:    {format_tokens(summary['total_cache_creation_tokens']):>12}")
    print(f"  缓存读取 Token:    {format_tokens(summary['total_cache_read_tokens']):>12}")
    print(f"  ─────────────────────────────────────")
    print(f"  API Token:         {format_tokens(summary['total_tokens']):>12} (input + output)")
    print(f"  全量 Token:        {format_tokens(summary['total_tokens_with_cache']):>12} (含缓存，可比 Cursor)")

    print("\n📈 活动统计")
    print("-" * 40)
    print(f"  会话数:            {summary['total_sessions']:>12}")
    print(f"  用户消息数:        {summary['total_user_messages']:>12}")
    print(f"  助手消息数:        {summary['total_assistant_messages']:>12}")
    print(f"  工具调用数:        {summary['total_tool_calls']:>12}")
    print(f"  活跃天数:          {summary['active_days']:>12}")
    print(f"  活跃项目数:        {summary['active_projects']:>12}")

    if stats["by_model"]:
        print("\n🤖 按模型统计")
        print("-" * 40)
        for model, model_stats in stats["by_model"].items():
            model_total = model_stats["input_tokens"] + model_stats["output_tokens"]
            print(f"  {model}:")
            print(f"    请求数: {model_stats['requests']}, Token: {format_tokens(model_total)}")

    if stats["by_project"]:
        print("\n📁 按项目统计 (Top 5)")
        print("-" * 40)
        sorted_projects = sorted(
            stats["by_project"].items(),
            key=lambda x: x[1]["input_tokens"] + x[1]["output_tokens"],
            reverse=True
        )[:5]
        for project_name, project_stats in sorted_projects:
            # 简化项目名显示
            display_name = project_name.replace("-Users-admin-Projects-", "").rstrip("-")
            project_total = project_stats["input_tokens"] + project_stats["output_tokens"]
            print(f"  {display_name}:")
            print(f"    会话: {project_stats['sessions']}, Token: {format_tokens(project_total)}")

    print("\n" + "=" * 60)


def main():
    parser = argparse.ArgumentParser(
        description="统计 Claude Code 使用情况",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  %(prog)s                    # 统计本周（周一到今天）
  %(prog)s --days 7           # 统计最近 7 天
  %(prog)s --start 2026-01-24 --end 2026-01-30  # 指定日期范围
  %(prog)s --output stats.json # 输出到 JSON 文件
        """
    )
    parser.add_argument("--start", type=str, help="开始日期 (YYYY-MM-DD)")
    parser.add_argument("--end", type=str, help="结束日期 (YYYY-MM-DD)")
    parser.add_argument("--days", type=int, help="统计最近 N 天")
    parser.add_argument("--week", action="store_true", help="统计本周（周一到今天）")
    parser.add_argument("--username", type=str, help="用户名（用于团队汇总）")
    parser.add_argument("--output", "-o", type=str, help="输出 JSON 文件路径")
    parser.add_argument("--json", action="store_true", help="仅输出 JSON（不打印摘要）")

    args = parser.parse_args()

    # 确定日期范围（使用 UTC 时区以匹配日志中的时间戳）
    now = datetime.now(timezone.utc)
    today = now.replace(hour=23, minute=59, second=59, microsecond=999999)

    if args.start and args.end:
        start_date = datetime.strptime(args.start, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        end_date = datetime.strptime(args.end, "%Y-%m-%d").replace(
            hour=23, minute=59, second=59, microsecond=999999, tzinfo=timezone.utc
        )
    elif args.days:
        end_date = today
        start_date = (now - timedelta(days=args.days - 1)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
    else:
        # 默认：本周（周一到今天）
        end_date = today
        # 计算本周一
        days_since_monday = now.weekday()
        start_date = (now - timedelta(days=days_since_monday)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )

    # 收集统计
    stats = collect_stats(start_date, end_date, args.username)

    # 输出
    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(stats, f, ensure_ascii=False, indent=2)
        if not args.json:
            print(f"统计数据已保存到: {args.output}")

    if args.json:
        print(json.dumps(stats, ensure_ascii=False, indent=2))
    elif not args.output:
        print_summary(stats)
    else:
        print_summary(stats)


if __name__ == "__main__":
    main()
