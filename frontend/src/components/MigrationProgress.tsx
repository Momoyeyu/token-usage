import type { ClaudeCodeStats, CursorStats } from '../types';
import { formatTokens, formatPercent, getMigrationColor } from '../utils/formatters';

interface MigrationProgressProps {
  claudeCode: ClaudeCodeStats | null;
  cursor: CursorStats | null;
}

// Get 7-day stats
function get7DayStats(claudeCode: ClaudeCodeStats | null, cursor: CursorStats | null) {
  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - 6);

  const start = startDate.toISOString().slice(0, 10);
  const end = today.toISOString().slice(0, 10);

  let ccTotal = 0;
  let cuTotal = 0;

  // Aggregate Claude Code for 7 days
  if (claudeCode?.by_day) {
    Object.entries(claudeCode.by_day).forEach(([date, data]) => {
      if (date >= start && date <= end) {
        const dayData = data as any;
        ccTotal += dayData.total_tokens_with_cache ||
          ((dayData.input_tokens || 0) + (dayData.output_tokens || 0) +
           (dayData.cache_creation_input_tokens || 0) + (dayData.cache_read_input_tokens || 0));
      }
    });
  }

  // Aggregate Cursor for 7 days
  if (cursor?.by_day) {
    Object.entries(cursor.by_day).forEach(([date, data]) => {
      if (date >= start && date <= end) {
        cuTotal += data.total_tokens || 0;
      }
    });
  }

  return { ccTotal, cuTotal, start, end };
}

export function MigrationProgress({ claudeCode, cursor }: MigrationProgressProps) {
  const { ccTotal, cuTotal, start, end } = get7DayStats(claudeCode, cursor);

  const total = ccTotal + cuTotal;
  const claudeCodePercent = total > 0 ? (ccTotal / total) * 100 : 0;

  // Calculate migration ratio - handle cursor = 0 case
  const migrationRatio = cuTotal > 0 ? (ccTotal / cuTotal) * 100 : (ccTotal > 0 ? Infinity : 0);
  const migrationRatioDisplay = cuTotal > 0 ? `${migrationRatio.toFixed(1)}%` : (ccTotal > 0 ? '∞' : '0%');

  // Don't show if no data at all
  if (total === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium">迁移进度</h3>
        <span className="text-xs text-gray-400">基于近 7 天数据 ({start} ~ {end})</span>
      </div>

      {/* Progress Bar */}
      <div className="relative h-8 bg-gray-200 rounded-full overflow-hidden mb-4">
        <div
          className="absolute left-0 top-0 h-full bg-green-500 transition-all duration-500"
          style={{ width: `${Math.min(claudeCodePercent, 100)}%` }}
        />
        <div
          className="absolute right-0 top-0 h-full bg-yellow-400 transition-all duration-500"
          style={{ width: `${Math.min(100 - claudeCodePercent, 100)}%` }}
        />
      </div>

      {/* Legend */}
      <div className="flex justify-between text-sm mb-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-green-500 rounded" />
          <span>Claude Code: {formatTokens(ccTotal)}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-yellow-400 rounded" />
          <span>Cursor: {formatTokens(cuTotal)}</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="bg-gray-50 p-3 rounded">
          <div className="text-gray-500">迁移比率</div>
          <div className={`text-xl font-bold ${getMigrationColor(migrationRatio)}`}>
            {migrationRatioDisplay}
          </div>
          <div className="text-xs text-gray-400">Claude Code / Cursor</div>
        </div>
        <div className="bg-gray-50 p-3 rounded">
          <div className="text-gray-500">占比</div>
          <div className="text-xl font-bold text-green-600">
            {formatPercent(claudeCodePercent)}
          </div>
          <div className="text-xs text-gray-400">Claude Code 占总量</div>
        </div>
      </div>

      {migrationRatio >= 100 && migrationRatio !== Infinity && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded text-green-800 text-sm">
          Claude Code 使用量已超过 Cursor！
        </div>
      )}
      {migrationRatio === Infinity && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded text-green-800 text-sm">
          已完全迁移到 Claude Code！
        </div>
      )}
    </div>
  );
}
