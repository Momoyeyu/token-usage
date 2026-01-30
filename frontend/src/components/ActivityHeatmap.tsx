import { useState, useMemo } from 'react';
import type { ClaudeCodeStats, CursorStats } from '../types';

interface ActivityHeatmapProps {
  claudeCode: ClaudeCodeStats | null;
  cursor: CursorStats | null;
}

type ViewMode = 'claudeCode' | 'cursor' | 'combined';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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

// Format date as YYYY-MM-DD in local timezone (not UTC)
function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Get all dates in a year (365 days including today)
function getYearDates(): { date: Date; dateStr: string }[] {
  const now = new Date();
  const dates: { date: Date; dateStr: string }[] = [];

  // Normalize to midnight to avoid time comparison issues
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Start from 364 days ago (365 days total including today)
  const start = new Date(today);
  start.setDate(today.getDate() - 364);

  const current = new Date(start);
  while (current <= today) {
    dates.push({
      date: new Date(current),
      dateStr: formatLocalDate(current),  // Use local timezone, not UTC
    });
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

// Group dates by week (Sun-Sat)
function groupByWeeks(dates: { date: Date; dateStr: string }[]): { date: Date; dateStr: string }[][] {
  const weeks: { date: Date; dateStr: string }[][] = [];
  let currentWeek: { date: Date; dateStr: string }[] = [];

  // Pad the first week if it doesn't start on Sunday
  if (dates.length > 0) {
    const firstDay = dates[0].date.getDay();
    for (let i = 0; i < firstDay; i++) {
      currentWeek.push({ date: new Date(0), dateStr: '' }); // placeholder
    }
  }

  for (const d of dates) {
    currentWeek.push(d);
    if (d.date.getDay() === 6) { // Saturday
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }

  // Push remaining days
  if (currentWeek.length > 0) {
    weeks.push(currentWeek);
  }

  return weeks;
}

// Get month labels with their starting week index
function getMonthLabels(weeks: { date: Date; dateStr: string }[][]): { label: string; weekIdx: number }[] {
  const labels: { label: string; weekIdx: number }[] = [];
  let lastMonth = -1;

  weeks.forEach((week, weekIdx) => {
    // Find first valid date in this week
    const validDay = week.find(d => d.dateStr !== '');
    if (validDay) {
      const month = validDay.date.getMonth();
      if (month !== lastMonth) {
        labels.push({ label: MONTHS[month], weekIdx });
        lastMonth = month;
      }
    }
  });

  return labels;
}

export function ActivityHeatmap({ claudeCode, cursor }: ActivityHeatmapProps) {
  const hasCursor = !!cursor;
  const [viewMode, setViewMode] = useState<ViewMode>(hasCursor ? 'combined' : 'claudeCode');

  const { weeks, monthLabels, maxValue, activeDays, dayValues } = useMemo(() => {
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

    const dates = getYearDates();
    const weeks = groupByWeeks(dates);
    const monthLabels = getMonthLabels(weeks);

    // Calculate values
    let maxVal = 0;
    let totalDaysCount = 0;
    let activeDaysCount = 0;
    const dayValues: Record<string, { value: number; level: 0 | 1 | 2 | 3 | 4 }> = {};

    for (const d of dates) {
      const ccVal = ccMap[d.dateStr] || 0;
      const cuVal = cuMap[d.dateStr] || 0;

      let value = 0;
      switch (viewMode) {
        case 'claudeCode': value = ccVal; break;
        case 'cursor': value = cuVal; break;
        default: value = ccVal + cuVal;
      }

      if (value > maxVal) maxVal = value;
      totalDaysCount++;
      if (value > 0) activeDaysCount++;

      dayValues[d.dateStr] = { value, level: 0 };
    }

    // Calculate levels
    for (const dateStr of Object.keys(dayValues)) {
      dayValues[dateStr].level = getLevel(dayValues[dateStr].value, maxVal);
    }

    return { weeks, monthLabels, maxValue: maxVal, totalDays: totalDaysCount, activeDays: activeDaysCount, dayValues };
  }, [claudeCode, cursor, viewMode]);

  const colorSchemes = {
    claudeCode: ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'],
    cursor: ['#ebedf0', '#fef08a', '#fde047', '#facc15', '#eab308'],
    combined: ['#ebedf0', '#9ecae1', '#6baed6', '#3182bd', '#08519c'],
  };

  const colors = colorSchemes[viewMode];

  return (
    <div className="bg-white rounded-lg shadow p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium">Activity Heatmap</h3>
        {hasCursor && (
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {(['combined', 'claudeCode', 'cursor'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  viewMode === mode
                    ? `bg-white shadow ${mode === 'claudeCode' ? 'text-green-600' : mode === 'cursor' ? 'text-yellow-600' : 'text-blue-600'}`
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {mode === 'claudeCode' ? 'Claude Code' : mode === 'cursor' ? 'Cursor' : 'Combined'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Heatmap */}
      <div className="overflow-x-auto">
        <div style={{ display: 'inline-block' }}>
          {/* Month labels */}
          <div style={{ display: 'flex', marginLeft: '32px', marginBottom: '4px' }}>
            {weeks.map((_, weekIdx) => {
              const label = monthLabels.find(m => m.weekIdx === weekIdx);
              return (
                <div
                  key={weekIdx}
                  style={{
                    width: '12px',
                    marginRight: '3px',
                    fontSize: '10px',
                    color: '#57606a',
                    overflow: 'visible',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {label?.label || ''}
                </div>
              );
            })}
          </div>

          {/* Grid */}
          <div style={{ display: 'flex' }}>
            {/* Day labels */}
            <div style={{ display: 'flex', flexDirection: 'column', marginRight: '4px' }}>
              {DAYS.map((day, idx) => (
                <div
                  key={day}
                  style={{
                    height: '12px',
                    marginBottom: '3px',
                    fontSize: '10px',
                    color: '#57606a',
                    lineHeight: '12px',
                    textAlign: 'right',
                    width: '28px',
                    visibility: idx % 2 === 1 ? 'visible' : 'hidden',
                  }}
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Weeks */}
            <div style={{ display: 'flex', gap: '3px' }}>
              {weeks.map((week, weekIdx) => (
                <div key={weekIdx} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  {week.map((day, dayIdx) => {
                    const isPlaceholder = day.dateStr === '';
                    const data = dayValues[day.dateStr];
                    return (
                      <div
                        key={dayIdx}
                        style={{
                          width: '12px',
                          height: '12px',
                          borderRadius: '2px',
                          backgroundColor: isPlaceholder ? 'transparent' : colors[data?.level || 0],
                          cursor: isPlaceholder ? 'default' : 'pointer',
                        }}
                        title={isPlaceholder ? '' : `${day.dateStr}: ${formatTokens(data?.value || 0)}`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', fontSize: '12px', color: '#57606a' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span>Less</span>
              {colors.map((color, idx) => (
                <div
                  key={idx}
                  style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '2px',
                    backgroundColor: color,
                  }}
                />
              ))}
              <span>More</span>
            </div>
            <div style={{ display: 'flex', gap: '16px' }}>
              <span>{activeDays} active days</span>
              {maxValue > 0 && <span>Peak: {formatTokens(maxValue)}</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
