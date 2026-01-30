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

export function TrendChart({ claudeCode, cursor }: TrendChartProps) {
  // Merge by_day data from both sources
  const dateSet = new Set<string>();

  if (claudeCode?.by_day) {
    Object.keys(claudeCode.by_day).forEach((d) => dateSet.add(d));
  }
  if (cursor?.by_day) {
    Object.keys(cursor.by_day).forEach((d) => dateSet.add(d));
  }

  const dates = Array.from(dateSet).sort();

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

    // For Claude Code, use input + output as daily total (more comparable to Cursor's total)
    const ccTotal = ccDay
      ? (ccDay.input_tokens || 0) + (ccDay.output_tokens || 0)
      : 0;

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
      <h3 className="text-lg font-medium mb-4">每日 Token 使用趋势</h3>
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
          <Line
            type="monotone"
            dataKey="cursor"
            name="Cursor"
            stroke="#eab308"
            strokeWidth={2}
            dot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
