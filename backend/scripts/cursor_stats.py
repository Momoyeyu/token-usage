#!/usr/bin/env python3
"""
Cursor 使用统计脚本
解析 Cursor 导出的 CSV 文件，统计使用情况

CSV 列说明：
- Date: 时间戳 (ISO 格式)
- User: 用户邮箱
- Kind: 请求类型 (On-Demand, Errored, No Charge)
- Model: 模型名称
- Max Mode: 是否使用 Max 模式
- Input (w/ Cache Write): 输入 token（包含缓存写入）
- Input (w/o Cache Write): 输入 token（不含缓存写入）
- Cache Read: 缓存读取 token
- Output Tokens: 输出 token
- Total Tokens: 总 token
- Requests: 请求数（可能是小数，表示加权）
"""

import csv
import json
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from collections import defaultdict
import argparse
import glob


def parse_timestamp(ts: str) -> datetime:
    """解析 ISO 格式时间戳"""
    if ts.endswith("Z"):
        ts = ts[:-1] + "+00:00"
    try:
        dt = datetime.fromisoformat(ts)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except ValueError:
        dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt


def parse_number(s: str) -> float:
    """解析数字字符串，处理空值"""
    if not s or s.strip() == "":
        return 0.0
    try:
        return float(s.replace(",", ""))
    except ValueError:
        return 0.0


def analyze_csv(csv_path: Path, start_date: datetime, end_date: datetime, target_user: str = None) -> dict:
    """分析单个 CSV 文件"""
    stats = {
        "input_tokens_with_cache": 0,
        "input_tokens_without_cache": 0,
        "cache_read_tokens": 0,
        "output_tokens": 0,
        "total_tokens": 0,
        "requests": 0.0,
        "records": 0,
        "errored_records": 0,
        "by_model": defaultdict(lambda: {
            "input_tokens_with_cache": 0,
            "input_tokens_without_cache": 0,
            "cache_read_tokens": 0,
            "output_tokens": 0,
            "total_tokens": 0,
            "requests": 0.0,
            "records": 0,
        }),
        "by_user": defaultdict(lambda: {
            "input_tokens_with_cache": 0,
            "input_tokens_without_cache": 0,
            "cache_read_tokens": 0,
            "output_tokens": 0,
            "total_tokens": 0,
            "requests": 0.0,
            "records": 0,
        }),
        "by_day": defaultdict(lambda: {
            "input_tokens_with_cache": 0,
            "output_tokens": 0,
            "total_tokens": 0,
            "requests": 0.0,
            "records": 0,
        }),
        "active_days": set(),
        "users": set(),
    }

    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            # 解析时间戳
            date_str = row.get("Date", "")
            if not date_str:
                continue

            try:
                timestamp = parse_timestamp(date_str)
            except (ValueError, TypeError):
                continue

            # 检查时间范围
            if timestamp < start_date or timestamp > end_date:
                continue

            # 检查用户过滤
            user = row.get("User", "")
            if target_user and user != target_user:
                continue

            # 检查请求类型
            kind = row.get("Kind", "")
            if "Errored" in kind or "No Charge" in kind:
                stats["errored_records"] += 1
                continue

            # 解析数据
            input_with_cache = parse_number(row.get("Input (w/ Cache Write)", "0"))
            input_without_cache = parse_number(row.get("Input (w/o Cache Write)", "0"))
            cache_read = parse_number(row.get("Cache Read", "0"))
            output_tokens = parse_number(row.get("Output Tokens", "0"))
            total_tokens = parse_number(row.get("Total Tokens", "0"))
            requests = parse_number(row.get("Requests", "0"))
            model = row.get("Model", "unknown")
            day = timestamp.date().isoformat()

            # 累加总计
            stats["input_tokens_with_cache"] += input_with_cache
            stats["input_tokens_without_cache"] += input_without_cache
            stats["cache_read_tokens"] += cache_read
            stats["output_tokens"] += output_tokens
            stats["total_tokens"] += total_tokens
            stats["requests"] += requests
            stats["records"] += 1
            stats["active_days"].add(day)
            stats["users"].add(user)

            # 按模型统计
            stats["by_model"][model]["input_tokens_with_cache"] += input_with_cache
            stats["by_model"][model]["input_tokens_without_cache"] += input_without_cache
            stats["by_model"][model]["cache_read_tokens"] += cache_read
            stats["by_model"][model]["output_tokens"] += output_tokens
            stats["by_model"][model]["total_tokens"] += total_tokens
            stats["by_model"][model]["requests"] += requests
            stats["by_model"][model]["records"] += 1

            # 按用户统计
            stats["by_user"][user]["input_tokens_with_cache"] += input_with_cache
            stats["by_user"][user]["input_tokens_without_cache"] += input_without_cache
            stats["by_user"][user]["cache_read_tokens"] += cache_read
            stats["by_user"][user]["output_tokens"] += output_tokens
            stats["by_user"][user]["total_tokens"] += total_tokens
            stats["by_user"][user]["requests"] += requests
            stats["by_user"][user]["records"] += 1

            # 按天统计
            stats["by_day"][day]["input_tokens_with_cache"] += input_with_cache
            stats["by_day"][day]["output_tokens"] += output_tokens
            stats["by_day"][day]["total_tokens"] += total_tokens
            stats["by_day"][day]["requests"] += requests
            stats["by_day"][day]["records"] += 1

    return stats


def collect_stats(csv_files: list[Path], start_date: datetime, end_date: datetime,
                  target_user: str = None, username: str = None) -> dict:
    """收集所有 CSV 文件的统计数据"""
    result = {
        "metadata": {
            "generated_at": datetime.now().isoformat(),
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "username": username or os.environ.get("USER", "unknown"),
            "machine": os.uname().nodename,
            "source": "cursor",
            "csv_files": [str(f) for f in csv_files],
        },
        "summary": {
            "input_tokens_with_cache": 0,
            "input_tokens_without_cache": 0,
            "cache_read_tokens": 0,
            "output_tokens": 0,
            "total_tokens": 0,
            "requests": 0.0,
            "records": 0,
            "errored_records": 0,
            "active_days": 0,
            "users_count": 0,
        },
        "by_model": {},
        "by_user": {},
        "by_day": {},
    }

    all_active_days = set()
    all_users = set()
    combined_by_model = defaultdict(lambda: {
        "input_tokens_with_cache": 0,
        "input_tokens_without_cache": 0,
        "cache_read_tokens": 0,
        "output_tokens": 0,
        "total_tokens": 0,
        "requests": 0.0,
        "records": 0,
    })
    combined_by_user = defaultdict(lambda: {
        "input_tokens_with_cache": 0,
        "input_tokens_without_cache": 0,
        "cache_read_tokens": 0,
        "output_tokens": 0,
        "total_tokens": 0,
        "requests": 0.0,
        "records": 0,
    })
    combined_by_day = defaultdict(lambda: {
        "input_tokens_with_cache": 0,
        "output_tokens": 0,
        "total_tokens": 0,
        "requests": 0.0,
        "records": 0,
    })

    for csv_file in csv_files:
        stats = analyze_csv(csv_file, start_date, end_date, target_user)

        # 累加总计
        result["summary"]["input_tokens_with_cache"] += stats["input_tokens_with_cache"]
        result["summary"]["input_tokens_without_cache"] += stats["input_tokens_without_cache"]
        result["summary"]["cache_read_tokens"] += stats["cache_read_tokens"]
        result["summary"]["output_tokens"] += stats["output_tokens"]
        result["summary"]["total_tokens"] += stats["total_tokens"]
        result["summary"]["requests"] += stats["requests"]
        result["summary"]["records"] += stats["records"]
        result["summary"]["errored_records"] += stats["errored_records"]

        all_active_days.update(stats["active_days"])
        all_users.update(stats["users"])

        # 合并按模型统计
        for model, model_stats in stats["by_model"].items():
            for key in model_stats:
                combined_by_model[model][key] += model_stats[key]

        # 合并按用户统计
        for user, user_stats in stats["by_user"].items():
            for key in user_stats:
                combined_by_user[user][key] += user_stats[key]

        # 合并按天统计
        for day, day_stats in stats["by_day"].items():
            for key in day_stats:
                combined_by_day[day][key] += day_stats[key]

    result["summary"]["active_days"] = len(all_active_days)
    result["summary"]["users_count"] = len(all_users)
    result["by_model"] = dict(combined_by_model)
    result["by_user"] = dict(combined_by_user)
    result["by_day"] = dict(combined_by_day)

    return result


def format_tokens(n: float) -> str:
    """格式化 token 数量"""
    n = int(n)
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
    print("Cursor 使用统计报告")
    print("=" * 60)
    print(f"\n用户: {metadata['username']} @ {metadata['machine']}")
    print(f"统计周期: {metadata['start_date'][:10]} ~ {metadata['end_date'][:10]}")
    print(f"生成时间: {metadata['generated_at'][:19]}")
    print(f"数据源: {len(metadata['csv_files'])} 个 CSV 文件")

    print("\n📊 Token 使用量")
    print("-" * 40)
    print(f"  输入 Token (含缓存写):  {format_tokens(summary['input_tokens_with_cache']):>12}")
    print(f"  输入 Token (不含缓存):  {format_tokens(summary['input_tokens_without_cache']):>12}")
    print(f"  缓存读取 Token:         {format_tokens(summary['cache_read_tokens']):>12}")
    print(f"  输出 Token:             {format_tokens(summary['output_tokens']):>12}")
    print(f"  ─────────────────────────────────────")
    print(f"  总计 Token:             {format_tokens(summary['total_tokens']):>12}")

    print("\n📈 活动统计")
    print("-" * 40)
    print(f"  API 请求数:             {summary['requests']:>12.1f}")
    print(f"  记录数:                 {summary['records']:>12}")
    print(f"  错误记录数:             {summary['errored_records']:>12}")
    print(f"  活跃天数:               {summary['active_days']:>12}")
    print(f"  用户数:                 {summary['users_count']:>12}")

    if stats["by_model"]:
        print("\n🤖 按模型统计")
        print("-" * 40)
        sorted_models = sorted(
            stats["by_model"].items(),
            key=lambda x: x[1]["total_tokens"],
            reverse=True
        )
        for model, model_stats in sorted_models[:5]:
            print(f"  {model}:")
            print(f"    记录: {model_stats['records']}, Token: {format_tokens(model_stats['total_tokens'])}")

    if stats["by_user"] and len(stats["by_user"]) > 1:
        print("\n👤 按用户统计")
        print("-" * 40)
        sorted_users = sorted(
            stats["by_user"].items(),
            key=lambda x: x[1]["total_tokens"],
            reverse=True
        )
        for user, user_stats in sorted_users[:5]:
            # 简化邮箱显示
            display_user = user.split("@")[0] if "@" in user else user
            print(f"  {display_user}:")
            print(f"    记录: {user_stats['records']}, Token: {format_tokens(user_stats['total_tokens'])}")

    if stats["by_day"]:
        print("\n📅 按日期统计")
        print("-" * 40)
        sorted_days = sorted(stats["by_day"].items())
        for day, day_stats in sorted_days:
            print(f"  {day}: {format_tokens(day_stats['total_tokens'])} ({day_stats['records']} 条记录)")

    print("\n" + "=" * 60)


def find_csv_files(directory: Path, pattern: str = "*.csv") -> list[Path]:
    """在目录中查找 CSV 文件"""
    return list(directory.glob(pattern))


def main():
    parser = argparse.ArgumentParser(
        description="统计 Cursor 使用情况（从导出的 CSV 文件）",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  %(prog)s usage.csv                    # 分析单个 CSV 文件
  %(prog)s *.csv                        # 分析当前目录所有 CSV 文件
  %(prog)s --dir ./data                 # 分析指定目录的 CSV 文件
  %(prog)s --start 2026-01-24 --end 2026-01-30  # 指定日期范围
  %(prog)s --user alice@example.com     # 只统计特定用户
  %(prog)s --output stats.json          # 输出到 JSON 文件
        """
    )
    parser.add_argument("csv_files", nargs="*", help="CSV 文件路径（支持通配符）")
    parser.add_argument("--dir", type=str, help="CSV 文件所在目录")
    parser.add_argument("--start", type=str, help="开始日期 (YYYY-MM-DD)")
    parser.add_argument("--end", type=str, help="结束日期 (YYYY-MM-DD)")
    parser.add_argument("--days", type=int, help="统计最近 N 天")
    parser.add_argument("--user", type=str, help="只统计特定用户")
    parser.add_argument("--username", type=str, help="用户名（用于团队汇总）")
    parser.add_argument("--output", "-o", type=str, help="输出 JSON 文件路径")
    parser.add_argument("--json", action="store_true", help="仅输出 JSON（不打印摘要）")

    args = parser.parse_args()

    # 收集 CSV 文件
    csv_files = []
    if args.csv_files:
        for pattern in args.csv_files:
            # Check if it's an actual file path first, then try glob
            p = Path(pattern)
            if p.is_file():
                csv_files.append(p)
            else:
                csv_files.extend(Path(".").glob(pattern))
    elif args.dir:
        csv_files = find_csv_files(Path(args.dir))
    else:
        # 默认查找当前目录的 CSV 文件
        csv_files = find_csv_files(Path("."))

    if not csv_files:
        print("错误: 未找到 CSV 文件", file=sys.stderr)
        print("用法: cursor_stats.py [csv文件...] 或 cursor_stats.py --dir <目录>", file=sys.stderr)
        sys.exit(1)

    csv_files = [f for f in csv_files if f.is_file()]
    if not csv_files:
        print("错误: 未找到有效的 CSV 文件", file=sys.stderr)
        sys.exit(1)

    # 确定日期范围
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
        days_since_monday = now.weekday()
        start_date = (now - timedelta(days=days_since_monday)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )

    # 收集统计
    stats = collect_stats(csv_files, start_date, end_date, args.user, args.username)

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
