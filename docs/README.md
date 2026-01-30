# Usage Stats Dashboard 文档

## 文档索引

| 文档 | 说明 |
|------|------|
| [stats-calculation.md](./stats-calculation.md) | 统计计算方法、流程图、字段对比 |
| [data-sources.md](./data-sources.md) | 数据源格式、示例数据、代码片段 |

## 快速参考

### Token 字段对照表

| 含义 | Claude Code | Cursor |
|------|-------------|--------|
| 全量 Token (可对比) | `total_tokens_with_cache` | `total_tokens` |
| 新输入 Token | `total_input_tokens` | `input_tokens_without_cache` |
| 含缓存写入的输入 | `input + cache_creation` | `input_tokens_with_cache` |
| 缓存读取 | `total_cache_read_tokens` | `cache_read_tokens` |
| 输出 | `total_output_tokens` | `output_tokens` |

### 数据文件位置

```
Claude Code: ~/.claude/projects/*/*.jsonl
Cursor:      手动导出 CSV (Settings > Usage > Export)
```

### 关键公式

```
# Claude Code 全量 Token
total_tokens_with_cache = input + output + cache_creation + cache_read

# Cursor 缓存写入量 (需计算)
cache_write = input_tokens_with_cache - input_tokens_without_cache
```
