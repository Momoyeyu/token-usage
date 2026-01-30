import { formatTokens, formatPercent, calculateMigrationRatio, getMigrationColor } from '../utils/formatters';

interface MigrationProgressProps {
  claudeCodeTotal: number;
  cursorTotal: number;
}

export function MigrationProgress({ claudeCodeTotal, cursorTotal }: MigrationProgressProps) {
  const total = claudeCodeTotal + cursorTotal;
  const claudeCodePercent = total > 0 ? (claudeCodeTotal / total) * 100 : 0;
  const migrationRatio = calculateMigrationRatio(claudeCodeTotal, cursorTotal);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-medium mb-4">迁移进度</h3>

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
          <span>Claude Code: {formatTokens(claudeCodeTotal)}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-yellow-400 rounded" />
          <span>Cursor: {formatTokens(cursorTotal)}</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="bg-gray-50 p-3 rounded">
          <div className="text-gray-500">迁移比率</div>
          <div className={`text-xl font-bold ${getMigrationColor(migrationRatio)}`}>
            {formatPercent(migrationRatio)}
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

      {migrationRatio >= 100 && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded text-green-800 text-sm">
          🎉 Claude Code 使用量已超过 Cursor！迁移进展顺利。
        </div>
      )}
    </div>
  );
}
