import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { ClaudeCodeStats, CursorStats } from '../types';
import { formatTokens } from '../utils/formatters';

interface TrendChartProps {
  claudeCode: ClaudeCodeStats | null;
  cursor: CursorStats | null;
}

// Get the last 7 days date range
function getLast7Days(): string[] {
  const dates: string[] = [];
  const today = new Date();

  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    dates.push(date.toISOString().slice(0, 10));
  }

  return dates;
}

export function TrendChart({ claudeCode, cursor }: TrendChartProps) {
  const hasCursor = !!cursor;
  // Only show the last 7 days
  const dates = getLast7Days();

  if (dates.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
        暂无每日趋势数据
      </div>
    );
  }

  const data = dates.map((date) => {
    const ccDay = claudeCode?.by_day?.[date];
    const cuDay = cursor?.by_day?.[date];

    // For Claude Code, use total_tokens_with_cache (includes cache read/write)
    // This is comparable to Cursor's total_tokens which also includes cache
    const ccTotal = ccDay?.total_tokens_with_cache ??
      ((ccDay?.input_tokens || 0) + (ccDay?.output_tokens || 0) +
       (ccDay?.cache_creation_input_tokens || 0) + (ccDay?.cache_read_input_tokens || 0));

    // For Cursor, use total_tokens
    const cuTotal = cuDay?.total_tokens || 0;

    return {
      date: date.slice(5), // MM-DD format
      claudeCode: ccTotal,
      cursor: cuTotal,
    };
  });

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-medium mb-4">每日 Token 使用趋势 (近 7 天)</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis tickFormatter={(v) => formatTokens(v)} />
          <Tooltip
            formatter={(value) => formatTokens(value as number)}
            labelFormatter={(label) => `日期: ${label}`}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="claudeCode"
            name="Claude Code"
            stroke="#22c55e"
            strokeWidth={2}
            dot={{ r: 4 }}
          />
          {hasCursor && (
            <Line
              type="monotone"
              dataKey="cursor"
              name="Cursor"
              stroke="#eab308"
              strokeWidth={2}
              dot={{ r: 4 }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
