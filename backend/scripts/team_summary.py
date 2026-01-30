#!/usr/bin/env python3
"""
团队使用统计汇总脚本
合并多个成员的 Claude Code 和 Cursor 统计数据，生成团队报告

使用方式:
1. 每个成员运行 claude_code_stats.py 和 cursor_stats.py，输出 JSON 文件
2. 收集所有 JSON 文件到一个目录
3. 运行此脚本生成团队汇总报告

示例:
  # 成员 A 运行:
  python3 claude_code_stats.py --username "Alice" -o alice_claude.json
  python3 cursor_stats.py --username "Alice" -o alice_cursor.json

  # 收集所有 JSON 后运行:
  python3 team_summary.py *.json -o team_report.json
"""

import json
import sys
from datetime import datetime
from pathlib import Path
from collections import defaultdict
import argparse


def load_stats_file(file_path: Path) -> dict:
    """加载统计 JSON 文件"""
    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)


def merge_stats(stats_files: list[Path]) -> dict:
    """合并多个统计文件"""
    result = {
        "metadata": {
            "generated_at": datetime.now().isoformat(),
            "total_members": 0,
            "sources": [],
        },
        "team_summary": {
            "claude_code": {
                "total_input_tokens": 0,
                "total_output_tokens": 0,
                "total_cache_creation_tokens": 0,
                "total_cache_read_tokens": 0,
                "total_tokens": 0,
                "total_tokens_with_cache": 0,
                "total_sessions": 0,
                "total_user_messages": 0,
                "members": 0,
            },
            "cursor": {
                "total_input_tokens_with_cache": 0,
                "total_input_tokens_without_cache": 0,
                "total_cache_read_tokens": 0,
                "total_output_tokens": 0,
                "total_tokens": 0,
                "total_requests": 0.0,
                "total_records": 0,
                "members": 0,
            },
            "combined": {
                "total_tokens": 0,
                "total_input_tokens": 0,
                "total_output_tokens": 0,
            }
        },
        "by_member": {},
        "by_tool": {
            "claude_code": [],
            "cursor": [],
        },
        "date_range": {
            "start": None,
            "end": None,
        }
    }

    members = set()
    claude_members = set()
    cursor_members = set()

    for file_path in stats_files:
        try:
            stats = load_stats_file(file_path)
        except Exception as e:
            print(f"警告: 无法加载 {file_path}: {e}", file=sys.stderr)
            continue

        metadata = stats.get("metadata", {})
        summary = stats.get("summary", {})
        source = metadata.get("source", "claude_code")  # 默认为 claude_code
        username = metadata.get("username", file_path.stem)

        # 更新日期范围
        start_date = metadata.get("start_date")
        end_date = metadata.get("end_date")
        if start_date:
            if not result["date_range"]["start"] or start_date < result["date_range"]["start"]:
                result["date_range"]["start"] = start_date
        if end_date:
            if not result["date_range"]["end"] or end_date > result["date_range"]["end"]:
                result["date_range"]["end"] = end_date

        result["metadata"]["sources"].append({
            "file": str(file_path),
            "username": username,
            "source": source,
        })

        # 初始化成员数据
        if username not in result["by_member"]:
            result["by_member"][username] = {
                "claude_code": None,
                "cursor": None,
            }

        members.add(username)

        if source == "cursor":
            cursor_members.add(username)
            result["by_member"][username]["cursor"] = {
                "input_tokens": int(summary.get("input_tokens_with_cache", 0)),
                "output_tokens": int(summary.get("output_tokens", 0)),
                "total_tokens": int(summary.get("total_tokens", 0)),
                "requests": summary.get("requests", 0),
                "records": summary.get("records", 0),
                "active_days": summary.get("active_days", 0),
            }

            # 累加到团队总计
            result["team_summary"]["cursor"]["total_input_tokens_with_cache"] += summary.get("input_tokens_with_cache", 0)
            result["team_summary"]["cursor"]["total_input_tokens_without_cache"] += summary.get("input_tokens_without_cache", 0)
            result["team_summary"]["cursor"]["total_cache_read_tokens"] += summary.get("cache_read_tokens", 0)
            result["team_summary"]["cursor"]["total_output_tokens"] += summary.get("output_tokens", 0)
            result["team_summary"]["cursor"]["total_tokens"] += summary.get("total_tokens", 0)
            result["team_summary"]["cursor"]["total_requests"] += summary.get("requests", 0)
            result["team_summary"]["cursor"]["total_records"] += summary.get("records", 0)

            # 添加到按工具列表
            result["by_tool"]["cursor"].append({
                "username": username,
                "total_tokens": int(summary.get("total_tokens", 0)),
                "requests": summary.get("requests", 0),
            })

        else:  # claude_code
            claude_members.add(username)
            result["by_member"][username]["claude_code"] = {
                "input_tokens": summary.get("total_input_tokens", 0),
                "output_tokens": summary.get("total_output_tokens", 0),
                "total_tokens": summary.get("total_tokens", 0),
                "total_tokens_with_cache": summary.get("total_tokens_with_cache", 0),
                "sessions": summary.get("total_sessions", 0),
                "user_messages": summary.get("total_user_messages", 0),
                "active_days": summary.get("active_days", 0),
                "active_projects": summary.get("active_projects", 0),
            }

            # 累加到团队总计
            result["team_summary"]["claude_code"]["total_input_tokens"] += summary.get("total_input_tokens", 0)
            result["team_summary"]["claude_code"]["total_output_tokens"] += summary.get("total_output_tokens", 0)
            result["team_summary"]["claude_code"]["total_cache_creation_tokens"] += summary.get("total_cache_creation_tokens", 0)
            result["team_summary"]["claude_code"]["total_cache_read_tokens"] += summary.get("total_cache_read_tokens", 0)
            result["team_summary"]["claude_code"]["total_tokens"] += summary.get("total_tokens", 0)
            result["team_summary"]["claude_code"]["total_tokens_with_cache"] += summary.get("total_tokens_with_cache", 0)
            result["team_summary"]["claude_code"]["total_sessions"] += summary.get("total_sessions", 0)
            result["team_summary"]["claude_code"]["total_user_messages"] += summary.get("total_user_messages", 0)

            # 添加到按工具列表
            result["by_tool"]["claude_code"].append({
                "username": username,
                "total_tokens": summary.get("total_tokens", 0),
                "sessions": summary.get("total_sessions", 0),
            })

    # 更新成员计数
    result["metadata"]["total_members"] = len(members)
    result["team_summary"]["claude_code"]["members"] = len(claude_members)
    result["team_summary"]["cursor"]["members"] = len(cursor_members)

    # 计算合并总计（使用可比口径：都包含缓存）
    cc_comparable = result["team_summary"]["claude_code"].get("total_tokens_with_cache",
                         result["team_summary"]["claude_code"]["total_tokens"])
    result["team_summary"]["combined"]["total_tokens"] = (
        cc_comparable +
        result["team_summary"]["cursor"]["total_tokens"]
    )
    result["team_summary"]["combined"]["total_input_tokens"] = (
        result["team_summary"]["claude_code"]["total_input_tokens"] +
        int(result["team_summary"]["cursor"]["total_input_tokens_with_cache"])
    )
    result["team_summary"]["combined"]["total_output_tokens"] = (
        result["team_summary"]["claude_code"]["total_output_tokens"] +
        int(result["team_summary"]["cursor"]["total_output_tokens"])
    )

    # 排序按工具列表
    result["by_tool"]["claude_code"].sort(key=lambda x: x["total_tokens"], reverse=True)
    result["by_tool"]["cursor"].sort(key=lambda x: x["total_tokens"], reverse=True)

    return result


def format_tokens(n: float) -> str:
    """格式化 token 数量"""
    n = int(n)
    if n >= 1_000_000:
        return f"{n/1_000_000:.2f}M"
    elif n >= 1_000:
        return f"{n/1_000:.1f}K"
    return str(n)


def print_report(stats: dict):
    """打印团队报告"""
    metadata = stats["metadata"]
    team = stats["team_summary"]
    date_range = stats["date_range"]

    print("=" * 70)
    print("团队使用统计报告")
    print("=" * 70)
    print(f"\n生成时间: {metadata['generated_at'][:19]}")
    print(f"统计周期: {date_range['start'][:10] if date_range['start'] else 'N/A'} ~ {date_range['end'][:10] if date_range['end'] else 'N/A'}")
    print(f"团队成员: {metadata['total_members']} 人")
    print(f"数据文件: {len(metadata['sources'])} 个")

    print("\n" + "=" * 70)
    print("📊 总体对比")
    print("=" * 70)
    print(f"\n{'工具':<20} {'成员数':<10} {'Token 总量':<15} {'主要指标':<20}")
    print("-" * 70)

    claude = team["claude_code"]
    cursor = team["cursor"]

    # 使用 total_tokens_with_cache 来与 Cursor 的 total_tokens 对比（都包含缓存）
    cc_comparable = claude.get('total_tokens_with_cache', claude['total_tokens'])
    print(f"{'Claude Code':<20} {claude['members']:<10} {format_tokens(cc_comparable):<15} "
          f"会话: {claude['total_sessions']}, 消息: {claude['total_user_messages']}")
    print(f"{'Cursor':<20} {cursor['members']:<10} {format_tokens(cursor['total_tokens']):<15} "
          f"请求: {cursor['total_requests']:.0f}, 记录: {cursor['total_records']}")
    print("-" * 70)
    combined_total = cc_comparable + cursor['total_tokens']
    print(f"{'合计':<20} {metadata['total_members']:<10} {format_tokens(combined_total):<15}")

    # 迁移进度（使用可比口径）
    if cursor["total_tokens"] > 0:
        migration_ratio = cc_comparable / cursor["total_tokens"] * 100
        print(f"\n🔄 迁移进度: Claude Code / Cursor = {migration_ratio:.1f}%")
        print(f"   (两者 Token 均包含缓存读取，口径一致)")

    # Claude Code 详情
    if claude["members"] > 0:
        print("\n" + "-" * 70)
        print("🟢 Claude Code 使用详情")
        print("-" * 70)
        print(f"  输入 Token:        {format_tokens(claude['total_input_tokens'])}")
        print(f"  输出 Token:        {format_tokens(claude['total_output_tokens'])}")
        print(f"  缓存创建 Token:    {format_tokens(claude['total_cache_creation_tokens'])}")
        print(f"  缓存读取 Token:    {format_tokens(claude['total_cache_read_tokens'])}")
        print(f"  ────────────────────────────────")
        print(f"  API Token:         {format_tokens(claude['total_tokens'])} (input + output)")
        print(f"  全量 Token:        {format_tokens(cc_comparable)} (含缓存)")

    # Cursor 详情
    if cursor["members"] > 0:
        print("\n" + "-" * 70)
        print("🟡 Cursor 使用详情")
        print("-" * 70)
        print(f"  输入 Token (含缓存): {format_tokens(cursor['total_input_tokens_with_cache'])}")
        print(f"  输入 Token (不含):   {format_tokens(cursor['total_input_tokens_without_cache'])}")
        print(f"  缓存读取 Token:      {format_tokens(cursor['total_cache_read_tokens'])}")
        print(f"  输出 Token:          {format_tokens(cursor['total_output_tokens'])}")

    # 按成员统计
    if stats["by_member"]:
        print("\n" + "=" * 70)
        print("👥 按成员统计")
        print("=" * 70)
        print(f"\n{'成员':<20} {'Claude Code':<20} {'Cursor':<20}")
        print("-" * 70)

        for username, member_stats in sorted(stats["by_member"].items()):
            cc = member_stats.get("claude_code")
            cu = member_stats.get("cursor")
            # 使用可比口径（含缓存）
            cc_str = format_tokens(cc.get("total_tokens_with_cache", cc["total_tokens"])) if cc else "-"
            cu_str = format_tokens(cu["total_tokens"]) if cu else "-"
            print(f"{username:<20} {cc_str:<20} {cu_str:<20}")

    print("\n" + "=" * 70)


def main():
    parser = argparse.ArgumentParser(
        description="合并团队成员的 Claude Code 和 Cursor 统计数据",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  %(prog)s alice_*.json bob_*.json      # 合并多个成员的文件
  %(prog)s --dir ./stats                # 合并目录中所有 JSON 文件
  %(prog)s *.json -o team_report.json   # 输出团队报告
        """
    )
    parser.add_argument("json_files", nargs="*", help="统计 JSON 文件")
    parser.add_argument("--dir", type=str, help="JSON 文件所在目录")
    parser.add_argument("--output", "-o", type=str, help="输出 JSON 文件路径")
    parser.add_argument("--json", action="store_true", help="仅输出 JSON")

    args = parser.parse_args()

    # 收集 JSON 文件
    json_files = []
    if args.json_files:
        for pattern in args.json_files:
            json_files.extend(Path(".").glob(pattern))
    elif args.dir:
        json_files = list(Path(args.dir).glob("*.json"))
    else:
        json_files = list(Path(".").glob("*_stats.json"))

    # 过滤只保留文件
    json_files = [f for f in json_files if f.is_file() and f.suffix == ".json"]

    if not json_files:
        print("错误: 未找到 JSON 统计文件", file=sys.stderr)
        print("用法: team_summary.py [json文件...] 或 team_summary.py --dir <目录>", file=sys.stderr)
        sys.exit(1)

    # 合并统计
    stats = merge_stats(json_files)

    # 输出
    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(stats, f, ensure_ascii=False, indent=2)
        if not args.json:
            print(f"团队报告已保存到: {args.output}\n")

    if args.json:
        print(json.dumps(stats, ensure_ascii=False, indent=2))
    else:
        print_report(stats)


if __name__ == "__main__":
    main()
