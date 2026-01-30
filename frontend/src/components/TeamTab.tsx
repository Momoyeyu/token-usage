import { useState } from 'react';
import type { ClaudeCodeStats, CursorStats } from '../types';
import { FileUploader } from './FileUploader';
import { ComparisonTable } from './ComparisonTable';
import { TrendChart } from './TrendChart';
import { MigrationProgress } from './MigrationProgress';
import { ActivityHeatmap } from './ActivityHeatmap';
import { formatDate } from '../utils/formatters';

interface ExportedData {
  version: number;
  exported_at: string;
  claude_code: ClaudeCodeStats | null;
  cursor: CursorStats | null;
}

interface AggregatedData {
  claude_code: ClaudeCodeStats | null;
  cursor: CursorStats | null;
  team_metadata: {
    members: number;
    start_date: string;
    end_date: string;
    files: string[];
  };
}

// Aggregate multiple exported JSON files
function aggregateData(files: { name: string; data: ExportedData }[]): AggregatedData {
  const ccByDay: Record<string, any> = {};
  const cuByDay: Record<string, any> = {};

  const ccSummary = {
    total_input_tokens: 0,
    total_output_tokens: 0,
    total_cache_creation_tokens: 0,
    total_cache_read_tokens: 0,
    total_tokens: 0,
    total_tokens_with_cache: 0,
    total_sessions: 0,
    active_days: 0,
  };

  const cuSummary = {
    input_tokens_with_cache: 0,
    input_tokens_without_cache: 0,
    cache_read_tokens: 0,
    output_tokens: 0,
    total_tokens: 0,
    requests: 0,
    records: 0,
    errored_records: 0,
    active_days: 0,
    users_count: 0,
  };

  const startDates: string[] = [];
  const endDates: string[] = [];
  const fileNames: string[] = [];

  for (const { name, data } of files) {
    fileNames.push(name);

    // Claude Code
    if (data.claude_code) {
      const cc = data.claude_code;
      const sum = cc.summary || {};

      ccSummary.total_input_tokens += sum.total_input_tokens || 0;
      ccSummary.total_output_tokens += sum.total_output_tokens || 0;
      ccSummary.total_cache_creation_tokens += sum.total_cache_creation_tokens || 0;
      ccSummary.total_cache_read_tokens += sum.total_cache_read_tokens || 0;
      ccSummary.total_tokens_with_cache += sum.total_tokens_with_cache || 0;
      ccSummary.total_sessions += sum.total_sessions || 0;

      if (cc.metadata?.start_date) startDates.push(cc.metadata.start_date);
      if (cc.metadata?.end_date) endDates.push(cc.metadata.end_date);

      // Aggregate by_day
      if (cc.by_day) {
        for (const [day, dayData] of Object.entries(cc.by_day)) {
          if (!ccByDay[day]) {
            ccByDay[day] = {
              input_tokens: 0,
              output_tokens: 0,
              cache_creation_input_tokens: 0,
              cache_read_input_tokens: 0,
              total_tokens_with_cache: 0,
            };
          }
          const d = dayData as any;
          ccByDay[day].input_tokens += d.input_tokens || 0;
          ccByDay[day].output_tokens += d.output_tokens || 0;
          ccByDay[day].cache_creation_input_tokens += d.cache_creation_input_tokens || 0;
          ccByDay[day].cache_read_input_tokens += d.cache_read_input_tokens || 0;
          ccByDay[day].total_tokens_with_cache += d.total_tokens_with_cache || 0;
        }
      }
    }

    // Cursor
    if (data.cursor) {
      const cu = data.cursor;
      const sum = cu.summary || {};

      cuSummary.input_tokens_with_cache += sum.input_tokens_with_cache || 0;
      cuSummary.input_tokens_without_cache += sum.input_tokens_without_cache || 0;
      cuSummary.cache_read_tokens += sum.cache_read_tokens || 0;
      cuSummary.output_tokens += sum.output_tokens || 0;
      cuSummary.total_tokens += sum.total_tokens || 0;
      cuSummary.requests += sum.requests || 0;

      if (cu.metadata?.start_date) startDates.push(cu.metadata.start_date);
      if (cu.metadata?.end_date) endDates.push(cu.metadata.end_date);

      // Aggregate by_day
      if (cu.by_day) {
        for (const [day, dayData] of Object.entries(cu.by_day)) {
          if (!cuByDay[day]) {
            cuByDay[day] = {
              input_tokens_with_cache: 0,
              output_tokens: 0,
              total_tokens: 0,
              requests: 0,
              records: 0,
            };
          }
          cuByDay[day].input_tokens_with_cache += dayData.input_tokens_with_cache || 0;
          cuByDay[day].output_tokens += dayData.output_tokens || 0;
          cuByDay[day].total_tokens += dayData.total_tokens || 0;
          cuByDay[day].requests += dayData.requests || 0;
          cuByDay[day].records += dayData.records || 0;
        }
      }
    }
  }

  // Calculate derived values
  ccSummary.total_tokens = ccSummary.total_input_tokens + ccSummary.total_output_tokens;
  ccSummary.active_days = Object.keys(ccByDay).filter(d => ccByDay[d].total_tokens_with_cache > 0).length;
  cuSummary.active_days = Object.keys(cuByDay).filter(d => cuByDay[d].total_tokens > 0).length;

  const startDate = startDates.length > 0 ? startDates.sort()[0] : '';
  const endDate = endDates.length > 0 ? endDates.sort().pop()! : '';

  const hasCc = ccSummary.total_tokens_with_cache > 0 || Object.keys(ccByDay).length > 0;
  const hasCu = cuSummary.total_tokens > 0 || Object.keys(cuByDay).length > 0;

  return {
    claude_code: hasCc ? {
      metadata: {
        generated_at: new Date().toISOString(),
        start_date: startDate,
        end_date: endDate,
        username: 'team',
        machine: 'aggregated',
      },
      summary: ccSummary,
      by_day: ccByDay,
      by_model: {},
      by_project: {},
    } : null,
    cursor: hasCu ? {
      metadata: {
        generated_at: new Date().toISOString(),
        start_date: startDate,
        end_date: endDate,
        username: 'team',
        machine: 'aggregated',
        source: 'cursor',
        csv_files: [],
      },
      summary: cuSummary,
      by_day: cuByDay,
      by_model: {},
      by_user: {},
    } : null,
    team_metadata: {
      members: files.length,
      start_date: startDate,
      end_date: endDate,
      files: fileNames,
    },
  };
}

type ViewMode = 'total' | 'average';

// Apply divisor to stats for average calculation
function applyDivisor(data: AggregatedData, divisor: number): { claudeCode: ClaudeCodeStats | null; cursor: CursorStats | null } {
  if (divisor <= 1) {
    return { claudeCode: data.claude_code, cursor: data.cursor };
  }

  const claudeCode = data.claude_code ? {
    ...data.claude_code,
    summary: {
      ...data.claude_code.summary,
      total_input_tokens: Math.round(data.claude_code.summary.total_input_tokens / divisor),
      total_output_tokens: Math.round(data.claude_code.summary.total_output_tokens / divisor),
      total_cache_creation_tokens: Math.round(data.claude_code.summary.total_cache_creation_tokens / divisor),
      total_cache_read_tokens: Math.round(data.claude_code.summary.total_cache_read_tokens / divisor),
      total_tokens: Math.round(data.claude_code.summary.total_tokens / divisor),
      total_tokens_with_cache: Math.round(data.claude_code.summary.total_tokens_with_cache / divisor),
      total_sessions: Math.round(data.claude_code.summary.total_sessions / divisor),
    },
    by_day: Object.fromEntries(
      Object.entries(data.claude_code.by_day).map(([day, dayData]) => [
        day,
        {
          input_tokens: Math.round((dayData.input_tokens || 0) / divisor),
          output_tokens: Math.round((dayData.output_tokens || 0) / divisor),
          cache_creation_input_tokens: Math.round(((dayData as any).cache_creation_input_tokens || 0) / divisor),
          cache_read_input_tokens: Math.round(((dayData as any).cache_read_input_tokens || 0) / divisor),
          total_tokens_with_cache: Math.round(((dayData as any).total_tokens_with_cache || 0) / divisor),
        },
      ])
    ),
  } : null;

  const cursor = data.cursor ? {
    ...data.cursor,
    summary: {
      ...data.cursor.summary,
      input_tokens_with_cache: Math.round(data.cursor.summary.input_tokens_with_cache / divisor),
      input_tokens_without_cache: Math.round(data.cursor.summary.input_tokens_without_cache / divisor),
      cache_read_tokens: Math.round(data.cursor.summary.cache_read_tokens / divisor),
      output_tokens: Math.round(data.cursor.summary.output_tokens / divisor),
      total_tokens: Math.round(data.cursor.summary.total_tokens / divisor),
      requests: Math.round(data.cursor.summary.requests / divisor),
    },
    by_day: Object.fromEntries(
      Object.entries(data.cursor.by_day).map(([day, dayData]) => [
        day,
        {
          input_tokens_with_cache: Math.round(dayData.input_tokens_with_cache / divisor),
          output_tokens: Math.round(dayData.output_tokens / divisor),
          total_tokens: Math.round(dayData.total_tokens / divisor),
          requests: Math.round(dayData.requests / divisor),
          records: Math.round(dayData.records / divisor),
        },
      ])
    ),
  } : null;

  return { claudeCode, cursor };
}

export function TeamTab() {
  const [files, setFiles] = useState<File[]>([]);
  const [teamData, setTeamData] = useState<AggregatedData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('total');

  const handleUpload = (newFiles: File[]) => {
    setFiles((prev) => [...prev, ...newFiles]);
    setError(null);
  };

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMerge = async () => {
    if (files.length === 0) {
      setError('请先上传成员统计文件');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Parse all JSON files
      const parsedFiles: { name: string; data: ExportedData }[] = [];

      for (const file of files) {
        const text = await file.text();
        try {
          const data = JSON.parse(text) as ExportedData;
          if (!data.version) {
            throw new Error('Invalid format');
          }
          parsedFiles.push({ name: file.name, data });
        } catch {
          throw new Error(`文件 ${file.name} 格式无效，请使用从本系统导出的 JSON 文件`);
        }
      }

      // Aggregate data
      const aggregated = aggregateData(parsedFiles);
      setTeamData(aggregated);
    } catch (e) {
      setError(e instanceof Error ? e.message : '合并失败');
    } finally {
      setLoading(false);
    }
  };

  // Apply divisor based on view mode
  const divisor = viewMode === 'average' ? (teamData?.team_metadata.members || 1) : 1;
  const { claudeCode: claudeCodeStats, cursor: cursorStats } = teamData
    ? applyDivisor(teamData, divisor)
    : { claudeCode: null, cursor: null };
  const hasCursor = (cursorStats?.summary?.total_tokens ?? 0) > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">团队使用统计</h2>
          <p className="text-gray-500 text-sm">
            上传团队成员的统计文件，汇总查看使用情况
          </p>
        </div>
        {teamData && (
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('total')}
              className={`px-4 py-2 text-sm rounded-md transition-colors ${
                viewMode === 'total'
                  ? 'bg-white shadow text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              总值
            </button>
            <button
              onClick={() => setViewMode('average')}
              className={`px-4 py-2 text-sm rounded-md transition-colors ${
                viewMode === 'average'
                  ? 'bg-white shadow text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              平均值
            </button>
          </div>
        )}
      </div>

      {/* Upload Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium mb-4">上传成员数据</h3>
        <p className="text-sm text-gray-500 mb-4">
          上传各成员从「个人统计」页面导出的 JSON 文件
        </p>

        <FileUploader
          accept=".json"
          multiple
          onUpload={handleUpload}
          label="上传 JSON 文件"
          description="支持批量上传多个成员的统计文件"
        />

        {files.length > 0 && (
          <div className="mt-4">
            <div className="text-sm text-gray-600 mb-2">已上传 {files.length} 个文件:</div>
            <div className="space-y-2">
              {files.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 bg-gray-50 rounded"
                >
                  <span className="text-sm truncate">{file.name}</span>
                  <button
                    onClick={() => handleRemoveFile(index)}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={handleMerge}
          disabled={loading || files.length === 0}
          className="mt-4 w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium transition-colors"
        >
          {loading ? '合并中...' : '计算团队汇总'}
        </button>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {error}
          </div>
        )}
      </div>

      {/* Results - Same components as PersonalTab */}
      {teamData && (
        <>
          {/* Team Info */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <span>数据来源: <strong>{teamData.team_metadata.members}</strong> 位成员</span>
              <span>•</span>
              <span>统计周期: {formatDate(teamData.team_metadata.start_date)} ~ {formatDate(teamData.team_metadata.end_date)}</span>
              <span>•</span>
              <span>显示: <strong>{viewMode === 'total' ? '团队总值' : '人均值'}</strong></span>
            </div>
          </div>

          {/* Comparison Table */}
          <ComparisonTable claudeCode={claudeCodeStats} cursor={cursorStats} />

          {/* Migration Progress */}
          {claudeCodeStats && cursorStats && hasCursor && (
            <MigrationProgress claudeCode={claudeCodeStats} cursor={cursorStats} />
          )}

          {/* Activity Heatmap */}
          <ActivityHeatmap claudeCode={claudeCodeStats} cursor={cursorStats} />

          {/* Trend Chart */}
          <TrendChart claudeCode={claudeCodeStats} cursor={cursorStats} />
        </>
      )}
    </div>
  );
}
