import { useState, useMemo } from 'react';
import type { ClaudeCodeStats, CursorStats } from '../types';
import { formatTokens } from '../utils/formatters';

interface ComparisonTableProps {
  claudeCode: ClaudeCodeStats | null;
  cursor: CursorStats | null;
}

type TimeRange = '1d' | '7d' | '30d';

interface TooltipProps {
  text: string;
}

function Tooltip({ text }: TooltipProps) {
  const [show, setShow] = useState(false);

  return (
    <span className="relative inline-block ml-1">
      <span
        className="inline-flex items-center justify-center w-4 h-4 text-xs text-gray-400 bg-gray-100 rounded-full cursor-help hover:bg-gray-200 hover:text-gray-600"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
      >
        ?
      </span>
      {show && (
        <div className="absolute z-10 w-64 p-2 text-xs text-left text-gray-700 bg-white border border-gray-200 rounded-lg shadow-lg -left-28 top-6">
          <div className="whitespace-pre-line">{text}</div>
          <div className="absolute w-2 h-2 bg-white border-l border-t border-gray-200 -top-1 left-1/2 -translate-x-1/2 rotate-45"></div>
        </div>
      )}
    </span>
  );
}

// Get dates for time range
function getDateRange(range: TimeRange): { start: string; end: string } {
  const now = new Date();
  const end = now.toISOString().slice(0, 10);

  const startDate = new Date(now);
  switch (range) {
    case '1d':
      // Today only
      break;
    case '7d':
      startDate.setDate(startDate.getDate() - 6);
      break;
    case '30d':
      startDate.setDate(startDate.getDate() - 29);
      break;
  }
  const start = startDate.toISOString().slice(0, 10);

  return { start, end };
}

// Calculate stats from by_day data for a given date range
function calculateStatsFromByDay(
  claudeCode: ClaudeCodeStats | null,
  cursor: CursorStats | null,
  range: TimeRange
) {
  const { start, end } = getDateRange(range);

  // Claude Code aggregation
  let ccTotal = 0, ccInput = 0, ccOutput = 0, ccCacheCreation = 0, ccCacheRead = 0;
  let ccActiveDays = 0, ccSessions = 0;

  if (claudeCode?.by_day) {
    Object.entries(claudeCode.by_day).forEach(([date, data]) => {
      if (date >= start && date <= end) {
        const dayData = data as any;
        ccInput += dayData.input_tokens || 0;
        ccOutput += dayData.output_tokens || 0;
        ccCacheCreation += dayData.cache_creation_input_tokens || 0;
        ccCacheRead += dayData.cache_read_input_tokens || 0;
        ccTotal += dayData.total_tokens_with_cache ||
          ((dayData.input_tokens || 0) + (dayData.output_tokens || 0) +
           (dayData.cache_creation_input_tokens || 0) + (dayData.cache_read_input_tokens || 0));
        if (ccTotal > 0 || dayData.input_tokens > 0) ccActiveDays++;
      }
    });
  }

  // Use session count from summary (we don't have per-day sessions)
  ccSessions = claudeCode?.summary?.total_sessions || 0;

  // Cursor aggregation
  let cuTotal = 0, cuInput = 0, cuOutput = 0, cuCacheRead = 0, cuInputWithout = 0;
  let cuActiveDays = 0, cuRequests = 0;

  if (cursor?.by_day) {
    Object.entries(cursor.by_day).forEach(([date, data]) => {
      if (date >= start && date <= end) {
        cuTotal += data.total_tokens || 0;
        cuInput += data.input_tokens_with_cache || 0;
        cuOutput += data.output_tokens || 0;
        cuRequests += data.requests || 0;
        if (data.total_tokens > 0) cuActiveDays++;
      }
    });
  }

  // Get cache read from summary (not available per day)
  cuCacheRead = cursor?.summary?.cache_read_tokens || 0;
  cuInputWithout = cursor?.summary?.input_tokens_without_cache || 0;

  // Scale cache values proportionally if we're filtering by date
  if (range !== '30d' && cursor?.summary?.total_tokens && cuTotal > 0) {
    const ratio = cuTotal / cursor.summary.total_tokens;
    cuCacheRead = Math.round(cuCacheRead * ratio);
    cuInputWithout = Math.round((cursor?.summary?.input_tokens_without_cache || 0) * ratio);
  }

  const cuCacheCreation = cuInput - (cuInputWithout || cuInput);

  return {
    claudeCode: {
      total: ccTotal,
      input: ccInput,
      output: ccOutput,
      cacheCreation: ccCacheCreation,
      cacheRead: ccCacheRead,
      activeDays: ccActiveDays,
      sessions: ccSessions,
    },
    cursor: {
      total: cuTotal,
      input: cuInput,
      output: cuOutput,
      cacheCreation: cuCacheCreation > 0 ? cuCacheCreation : 0,
      cacheRead: cuCacheRead,
      activeDays: cuActiveDays,
      requests: cuRequests,
    },
  };
}

export function ComparisonTable({ claudeCode, cursor }: ComparisonTableProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');

  const stats = useMemo(() => {
    return calculateStatsFromByDay(claudeCode, cursor, timeRange);
  }, [claudeCode, cursor, timeRange]);

  if (!claudeCode && !cursor) {
    return null;
  }

  const rows = [
    {
      metric: 'Token 总量',
      tooltip: '模型处理的全部 token（含缓存）\n\nClaude Code: input + output + cache_read + cache_creation\nCursor: CSV 中的 Total Tokens',
      claudeCode: stats.claudeCode.total,
      cursor: stats.cursor.total,
      highlight: true,
    },
    {
      metric: '输入 Token (计费)',
      tooltip: '实际计费的输入 token（不含缓存读取）\n\nClaude Code: API 返回的 input_tokens\nCursor: Input (w/ Cache Write)',
      claudeCode: stats.claudeCode.input,
      cursor: stats.cursor.input,
    },
    {
      metric: '缓存写入 Token',
      tooltip: '首次写入缓存的 token（有额外写入成本）\n\nClaude Code: cache_creation_input_tokens\nCursor: 包含在 Input (w/ Cache Write) 中',
      claudeCode: stats.claudeCode.cacheCreation,
      cursor: stats.cursor.cacheCreation,
    },
    {
      metric: '缓存读取 Token',
      tooltip: '从缓存读取的 token（有折扣，约 10% 成本）\n\nClaude Code: cache_read_input_tokens\nCursor: Cache Read',
      claudeCode: stats.claudeCode.cacheRead,
      cursor: stats.cursor.cacheRead,
    },
    {
      metric: '输出 Token',
      tooltip: '模型生成的输出 token\n\nClaude Code: output_tokens\nCursor: Output Tokens',
      claudeCode: stats.claudeCode.output,
      cursor: stats.cursor.output,
    },
    {
      metric: '活跃天数',
      tooltip: '有使用记录的天数',
      claudeCode: stats.claudeCode.activeDays,
      cursor: stats.cursor.activeDays,
      isCount: true,
    },
    {
      metric: '会话/请求数',
      tooltip: 'Claude Code: 独立会话数\nCursor: API 请求数（加权）',
      claudeCode: stats.claudeCode.sessions,
      cursor: stats.cursor.requests,
      isCount: true,
    },
  ];

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      {/* Time range selector */}
      <div className="flex items-center justify-between px-6 py-3 border-b bg-gray-50">
        <span className="text-sm font-medium text-gray-700">统计周期</span>
        <div className="flex gap-1 bg-gray-200 rounded-lg p-1">
          {(['1d', '7d', '30d'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                timeRange === range
                  ? 'bg-white shadow text-blue-600 font-medium'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {range === '1d' ? '今天' : range === '7d' ? '7 天' : '30 天'}
            </button>
          ))}
        </div>
      </div>

      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              指标
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Claude Code
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Cursor
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              差异
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {rows.map((row) => {
            const diff = row.claudeCode - row.cursor;
            const diffClass = diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-600' : 'text-gray-500';

            return (
              <tr key={row.metric} className={row.highlight ? 'bg-blue-50' : ''}>
                <td className={`px-6 py-4 whitespace-nowrap text-sm ${row.highlight ? 'font-medium' : ''}`}>
                  {row.metric}
                  <Tooltip text={row.tooltip} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-mono">
                  {row.isCount ? row.claudeCode.toLocaleString() : formatTokens(row.claudeCode)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-mono">
                  {row.isCount ? Math.round(row.cursor).toLocaleString() : formatTokens(row.cursor)}
                </td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-mono ${diffClass}`}>
                  {row.isCount
                    ? (diff > 0 ? '+' : '') + Math.round(diff).toLocaleString()
                    : (diff > 0 ? '+' : '') + formatTokens(diff)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
