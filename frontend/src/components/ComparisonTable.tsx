import type { ClaudeCodeStats, CursorStats } from '../types';
import { formatTokens } from '../utils/formatters';

interface ComparisonTableProps {
  claudeCode: ClaudeCodeStats | null;
  cursor: CursorStats | null;
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
      claudeCode: ccSummary?.total_tokens_with_cache ?? ccSummary?.total_tokens ?? 0,
      cursor: cuSummary?.total_tokens ?? 0,
      highlight: true,
    },
    {
      metric: '输入 Token',
      claudeCode: ccSummary?.total_input_tokens ?? 0,
      cursor: cuSummary?.input_tokens_with_cache ?? 0,
    },
    {
      metric: '输出 Token',
      claudeCode: ccSummary?.total_output_tokens ?? 0,
      cursor: cuSummary?.output_tokens ?? 0,
    },
    {
      metric: '缓存读取 Token',
      claudeCode: ccSummary?.total_cache_read_tokens ?? 0,
      cursor: cuSummary?.cache_read_tokens ?? 0,
    },
    {
      metric: '活跃天数',
      claudeCode: ccSummary?.active_days ?? 0,
      cursor: cuSummary?.active_days ?? 0,
      isCount: true,
    },
    {
      metric: '会话/请求数',
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
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-mono">
                  {row.isCount ? row.claudeCode : formatTokens(row.claudeCode)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-mono">
                  {row.isCount ? row.cursor : formatTokens(row.cursor)}
                </td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-mono ${diffClass}`}>
                  {row.isCount
                    ? (diff > 0 ? '+' : '') + diff
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
