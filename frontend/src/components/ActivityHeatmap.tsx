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

interface WeekData {
  days: DayData[];
  monthLabel?: string; // Label to show above this week
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

  const { weeks, maxValue, totalDays, activeDays } = useMemo(() => {
    // Build data maps
    const ccMap: Record<string, number> = {};
    const cuMap: Record<string, number> = {};

    if (claudeCode?.by_day) {
      Object.entries(claudeCode.by_day).forEach(([date, data]) => {
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
    // Align to start of week (Sunday)
    startDate.setDate(startDate.getDate() - startDate.getDay());

    // Build weeks with month labels
    const weeks: WeekData[] = [];
    let currentWeek: DayData[] = [];
    let maxVal = 0;
    let totalDaysCount = 0;
    let activeDaysCount = 0;
    let lastLabeledMonth = -1;

    const current = new Date(startDate);

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

      currentWeek.push({
        date: dateStr,
        value,
        level: 0,
      });

      // End of week (Saturday) - push the week
      if (current.getDay() === 6) {
        // Determine month label: use the month of the first day of the week
        const firstDayOfWeek = new Date(currentWeek[0].date);
        const monthOfFirstDay = firstDayOfWeek.getMonth();

        let monthLabel: string | undefined;
        if (monthOfFirstDay !== lastLabeledMonth) {
          monthLabel = MONTHS[monthOfFirstDay];
          lastLabeledMonth = monthOfFirstDay;
        }

        weeks.push({
          days: currentWeek,
          monthLabel,
        });
        currentWeek = [];
      }

      current.setDate(current.getDate() + 1);
    }

    // Handle remaining days (incomplete last week)
    if (currentWeek.length > 0) {
      const firstDayOfWeek = new Date(currentWeek[0].date);
      const monthOfFirstDay = firstDayOfWeek.getMonth();

      let monthLabel: string | undefined;
      if (monthOfFirstDay !== lastLabeledMonth) {
        monthLabel = MONTHS[monthOfFirstDay];
      }

      weeks.push({
        days: currentWeek,
        monthLabel,
      });
    }

    // Calculate levels based on max value
    weeks.forEach(week => {
      week.days.forEach(day => {
        day.level = getLevel(day.value, maxVal);
      });
    });

    return { weeks, maxValue: maxVal, totalDays: totalDaysCount, activeDays: activeDaysCount };
  }, [claudeCode, cursor, months, viewMode]);

  const colorSchemes = {
    claudeCode: ['bg-gray-100', 'bg-green-200', 'bg-green-400', 'bg-green-500', 'bg-green-700'],
    cursor: ['bg-gray-100', 'bg-yellow-200', 'bg-yellow-400', 'bg-yellow-500', 'bg-yellow-600'],
    combined: ['bg-gray-100', 'bg-blue-200', 'bg-blue-400', 'bg-blue-500', 'bg-blue-700'],
  };

  const colors = colorSchemes[viewMode];

  // Cell size and gap
  const cellSize = 11;
  const gap = 2;
  const dayLabelWidth = 28;

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
        {/* Month labels row */}
        <div className="flex text-xs text-gray-400 mb-1" style={{ height: '16px' }}>
          <div style={{ width: `${dayLabelWidth}px`, flexShrink: 0 }}></div>
          {weeks.map((week, idx) => (
            <div
              key={idx}
              style={{
                width: `${cellSize}px`,
                marginRight: `${gap}px`,
                flexShrink: 0,
                fontSize: '10px',
                overflow: 'visible',
                whiteSpace: 'nowrap',
              }}
            >
              {week.monthLabel || ''}
            </div>
          ))}
        </div>

        {/* Grid container */}
        <div className="flex">
          {/* Day labels */}
          <div
            className="flex flex-col text-xs text-gray-400"
            style={{ width: `${dayLabelWidth}px`, flexShrink: 0, fontSize: '9px' }}
          >
            <div style={{ height: `${cellSize}px` }}></div>
            <div style={{ height: `${cellSize + gap}px`, display: 'flex', alignItems: 'center' }}>Mon</div>
            <div style={{ height: `${cellSize + gap}px` }}></div>
            <div style={{ height: `${cellSize + gap}px`, display: 'flex', alignItems: 'center' }}>Wed</div>
            <div style={{ height: `${cellSize + gap}px` }}></div>
            <div style={{ height: `${cellSize + gap}px`, display: 'flex', alignItems: 'center' }}>Fri</div>
            <div style={{ height: `${cellSize}px` }}></div>
          </div>

          {/* Heatmap grid */}
          <div className="flex" style={{ gap: `${gap}px` }}>
            {weeks.map((week, weekIdx) => (
              <div key={weekIdx} className="flex flex-col" style={{ gap: `${gap}px` }}>
                {/* Pad first week if it doesn't start on Sunday */}
                {weekIdx === 0 && week.days.length < 7 && (
                  Array(7 - week.days.length).fill(null).map((_, i) => (
                    <div key={`pad-${i}`} style={{ width: `${cellSize}px`, height: `${cellSize}px` }} />
                  ))
                )}
                {week.days.map((day) => (
                  <div
                    key={day.date}
                    className={`rounded-sm ${colors[day.level]} transition-all hover:scale-125 cursor-pointer`}
                    style={{ width: `${cellSize}px`, height: `${cellSize}px` }}
                    title={`${day.date}: ${formatTokens(day.value)}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Legend and stats */}
        <div className="flex items-center justify-between mt-4 text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <span>Less</span>
            {colors.map((color, idx) => (
              <div
                key={idx}
                className={`rounded-sm ${color}`}
                style={{ width: `${cellSize}px`, height: `${cellSize}px` }}
              />
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
