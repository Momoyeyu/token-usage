import { useState } from 'react';
import type { ClaudeCodeStats, CursorStats } from '../types';
import { formatTokens } from '../utils/formatters';

interface ComparisonTableProps {
  claudeCode: ClaudeCodeStats | null;
  cursor: CursorStats | null;
}

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

export function ComparisonTable({ claudeCode, cursor }: ComparisonTableProps) {
  if (!claudeCode && !cursor) {
    return null;
  }

  const ccSummary = claudeCode?.summary;
  const cuSummary = cursor?.summary;

  const rows = [
    {
      metric: 'Token 总量',
      tooltip: '模型处理的全部 token（含缓存）\n\nClaude Code: input + output + cache_read + cache_creation\nCursor: CSV 中的 Total Tokens',
      claudeCode: ccSummary?.total_tokens_with_cache ?? ccSummary?.total_tokens ?? 0,
      cursor: cuSummary?.total_tokens ?? 0,
      highlight: true,
    },
    {
      metric: '输入 Token (计费)',
      tooltip: '实际计费的输入 token（不含缓存读取）\n\nClaude Code: API 返回的 input_tokens\nCursor: Input (w/ Cache Write)',
      claudeCode: ccSummary?.total_input_tokens ?? 0,
      cursor: cuSummary?.input_tokens_with_cache ?? 0,
    },
    {
      metric: '缓存写入 Token',
      tooltip: '首次写入缓存的 token（有额外写入成本）\n\nClaude Code: cache_creation_input_tokens\nCursor: 包含在 Input (w/ Cache Write) 中',
      claudeCode: ccSummary?.total_cache_creation_tokens ?? 0,
      cursor: (cuSummary?.input_tokens_with_cache ?? 0) - (cuSummary?.input_tokens_without_cache ?? 0),
    },
    {
      metric: '缓存读取 Token',
      tooltip: '从缓存读取的 token（有折扣，约 10% 成本）\n\nClaude Code: cache_read_input_tokens\nCursor: Cache Read',
      claudeCode: ccSummary?.total_cache_read_tokens ?? 0,
      cursor: cuSummary?.cache_read_tokens ?? 0,
    },
    {
      metric: '输出 Token',
      tooltip: '模型生成的输出 token\n\nClaude Code: output_tokens\nCursor: Output Tokens',
      claudeCode: ccSummary?.total_output_tokens ?? 0,
      cursor: cuSummary?.output_tokens ?? 0,
    },
    {
      metric: '活跃天数',
      tooltip: '有使用记录的天数',
      claudeCode: ccSummary?.active_days ?? 0,
      cursor: cuSummary?.active_days ?? 0,
      isCount: true,
    },
    {
      metric: '会话/请求数',
      tooltip: 'Claude Code: 独立会话数\nCursor: API 请求数（加权）',
      claudeCode: ccSummary?.total_sessions ?? 0,
      cursor: cuSummary?.requests ?? 0,
      isCount: true,
    },
  ];

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
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
