import { useState, useMemo } from 'react';
import type { ClaudeCodeStats, CursorStats } from '../types';

interface ActivityHeatmapProps {
  claudeCode: ClaudeCodeStats | null;
  cursor: CursorStats | null;
  months?: number;
}

interface DayData {
  date: string;
  value: number;
  level: 0 | 1 | 2 | 3 | 4;
}

type ViewMode = 'claudeCode' | 'cursor' | 'combined';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getLevel(value: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (value === 0 || max === 0) return 0;
  const ratio = value / max;
  if (ratio < 0.25) return 1;
  if (ratio < 0.5) return 2;
  if (ratio < 0.75) return 3;
  return 4;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export function ActivityHeatmap({ claudeCode, cursor, months = 3 }: ActivityHeatmapProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('combined');

  const { weeks, maxValue, monthLabels, totalDays, activeDays } = useMemo(() => {
    // Build data maps
    const ccMap: Record<string, number> = {};
    const cuMap: Record<string, number> = {};

    if (claudeCode?.by_day) {
      Object.entries(claudeCode.by_day).forEach(([date, data]) => {
        // Use total_tokens_with_cache if available, otherwise calculate from components
        ccMap[date] = (data as any).total_tokens_with_cache ??
          ((data.input_tokens || 0) + (data.output_tokens || 0) +
           ((data as any).cache_creation_input_tokens || 0) + ((data as any).cache_read_input_tokens || 0));
      });
    }

    if (cursor?.by_day) {
      Object.entries(cursor.by_day).forEach(([date, data]) => {
        cuMap[date] = data.total_tokens || 0;
      });
    }

    // Generate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);
    startDate.setDate(startDate.getDate() - startDate.getDay());

    // Build weeks
    const weeks: DayData[][] = [];
    let currentWeek: DayData[] = [];
    let maxVal = 0;
    let totalDaysCount = 0;
    let activeDaysCount = 0;
    const monthPositions: { month: number; weekIndex: number }[] = [];
    let lastMonth = -1;

    const current = new Date(startDate);
    let weekIndex = 0;

    while (current <= endDate) {
      const dateStr = current.toISOString().slice(0, 10);
      const ccVal = ccMap[dateStr] || 0;
      const cuVal = cuMap[dateStr] || 0;

      let value = 0;
      switch (viewMode) {
        case 'claudeCode':
          value = ccVal;
          break;
        case 'cursor':
          value = cuVal;
          break;
        case 'combined':
        default:
          value = ccVal + cuVal;
      }

      if (value > maxVal) maxVal = value;
      totalDaysCount++;
      if (value > 0) activeDaysCount++;

      const currentMonth = current.getMonth();
      if (currentMonth !== lastMonth) {
        monthPositions.push({ month: currentMonth, weekIndex });
        lastMonth = currentMonth;
      }

      currentWeek.push({
        date: dateStr,
        value,
        level: 0,
      });

      if (current.getDay() === 6) {
        weeks.push(currentWeek);
        currentWeek = [];
        weekIndex++;
      }

      current.setDate(current.getDate() + 1);
    }

    if (currentWeek.length > 0) {
      weeks.push(currentWeek);
    }

    // Calculate levels
    weeks.forEach(week => {
      week.forEach(day => {
        day.level = getLevel(day.value, maxVal);
      });
    });

    const labels = monthPositions.map(({ month, weekIndex }) => ({
      label: MONTHS[month],
      position: weekIndex,
    }));

    return { weeks, maxValue: maxVal, monthLabels: labels, totalDays: totalDaysCount, activeDays: activeDaysCount };
  }, [claudeCode, cursor, months, viewMode]);

  const colorSchemes = {
    claudeCode: ['bg-gray-100', 'bg-green-200', 'bg-green-400', 'bg-green-500', 'bg-green-700'],
    cursor: ['bg-gray-100', 'bg-yellow-200', 'bg-yellow-400', 'bg-yellow-500', 'bg-yellow-600'],
    combined: ['bg-gray-100', 'bg-blue-200', 'bg-blue-400', 'bg-blue-500', 'bg-blue-700'],
  };

  const colors = colorSchemes[viewMode];

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium">Activity Heatmap</h3>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setViewMode('combined')}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              viewMode === 'combined' ? 'bg-white shadow text-blue-600' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Combined
          </button>
          <button
            onClick={() => setViewMode('claudeCode')}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              viewMode === 'claudeCode' ? 'bg-white shadow text-green-600' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Claude Code
          </button>
          <button
            onClick={() => setViewMode('cursor')}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              viewMode === 'cursor' ? 'bg-white shadow text-yellow-600' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Cursor
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="relative">
          {/* Month labels */}
          <div className="flex text-xs text-gray-400 mb-1" style={{ paddingLeft: '28px', height: '16px' }}>
            {monthLabels.map(({ label, position }, idx) => (
              <span
                key={idx}
                style={{
                  position: 'absolute',
                  left: `${28 + position * 13}px`,
                }}
              >
                {label}
              </span>
            ))}
          </div>

          {/* Grid container */}
          <div className="flex">
            {/* Day labels */}
            <div className="flex flex-col text-xs text-gray-400 pr-1" style={{ fontSize: '9px' }}>
              <div className="h-[11px]"></div>
              <div className="h-[11px] flex items-center">Mon</div>
              <div className="h-[11px]"></div>
              <div className="h-[11px] flex items-center">Wed</div>
              <div className="h-[11px]"></div>
              <div className="h-[11px] flex items-center">Fri</div>
              <div className="h-[11px]"></div>
            </div>

            {/* Heatmap grid */}
            <div className="flex gap-[2px]">
              {weeks.map((week, weekIdx) => (
                <div key={weekIdx} className="flex flex-col gap-[2px]">
                  {weekIdx === 0 && week.length < 7 && (
                    Array(7 - week.length).fill(null).map((_, i) => (
                      <div key={`pad-${i}`} className="w-[11px] h-[11px]" />
                    ))
                  )}
                  {week.map((day) => (
                    <div
                      key={day.date}
                      className={`w-[11px] h-[11px] rounded-sm ${colors[day.level]} transition-all hover:scale-125 cursor-pointer`}
                      title={`${day.date}: ${formatTokens(day.value)}`}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Legend and stats */}
        <div className="flex items-center justify-between mt-4 text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <span>Less</span>
            {colors.map((color, idx) => (
              <div key={idx} className={`w-[11px] h-[11px] rounded-sm ${color}`} />
            ))}
            <span>More</span>
          </div>
          <div className="flex gap-4">
            <span>Active: {activeDays}/{totalDays} days</span>
            {maxValue > 0 && <span>Peak: {formatTokens(maxValue)}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
