import { useState } from 'react';
import type { ClaudeCodeStats, CursorStats } from '../types';
import { fetchClaudeCodeStats, uploadCursorCsv, exportMarkdown } from '../services/api';
import { FileUploader } from './FileUploader';
import { ComparisonTable } from './ComparisonTable';
import { TrendChart } from './TrendChart';
import { MigrationProgress } from './MigrationProgress';
import { ActivityHeatmap } from './ActivityHeatmap';
import { formatDate } from '../utils/formatters';

// Helper functions for Cursor dashboard URL (365 days range)
function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function getYearStart(): string {
  const now = new Date();
  // Go back 364 days (365 days total including today)
  const start = new Date(now);
  start.setDate(now.getDate() - 364);
  return start.toISOString().slice(0, 10);
}

export function PersonalTab() {
  const [claudeCodeStats, setClaudeCodeStats] = useState<ClaudeCodeStats | null>(null);
  const [cursorStats, setCursorStats] = useState<CursorStats | null>(null);
  const [cursorFile, setCursorFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCursorUpload = (files: File[]) => {
    if (files.length > 0) {
      setCursorFile(files[0]);
      setError(null);
    }
  };

  const handleCalculate = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch Claude Code stats for 1 year
      const ccStats = await fetchClaudeCodeStats({ days: 365 });
      setClaudeCodeStats(ccStats);

      // If Cursor CSV uploaded, parse it without date filter (get all data)
      if (cursorFile) {
        const cuStats = await uploadCursorCsv(cursorFile);
        setCursorStats(cuStats);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '计算失败');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const markdown = await exportMarkdown('personal', {
        claude_code: claudeCodeStats,
        cursor: cursorStats,
      });

      // Download as file
      const blob = new Blob([markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `usage-report-${new Date().toISOString().slice(0, 10)}.md`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : '导出失败');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">个人使用统计</h2>
          <p className="text-gray-500 text-sm">
            对比本周 Claude Code 和 Cursor 的使用情况
          </p>
        </div>
        {(claudeCodeStats || cursorStats) && (
          <button
            onClick={handleExport}
            className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            导出 Markdown
          </button>
        )}
      </div>

      {/* Upload Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium mb-4">数据源</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-gray-600 mb-2">Claude Code (自动获取本地数据)</div>
            <div className="border rounded-lg p-4 bg-green-50 border-green-200">
              <div className="flex items-center gap-2 text-green-700">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>将自动读取 ~/.claude/ 数据</span>
              </div>
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600 mb-2">
              Cursor CSV (可选)
              <a
                href={`https://cursor.com/cn/dashboard?tab=usage&from=${getYearStart()}&to=${getToday()}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 text-blue-500 hover:text-blue-700 text-xs"
              >
                去下载 →
              </a>
            </div>
            {cursorFile ? (
              <div className="border rounded-lg p-4 bg-yellow-50 border-yellow-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-yellow-700">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="truncate">{cursorFile.name}</span>
                  </div>
                  <button
                    onClick={() => setCursorFile(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
            ) : (
              <FileUploader
                accept=".csv"
                onUpload={handleCursorUpload}
                label="上传 Cursor CSV"
                description="点击上方链接打开 Cursor Dashboard，点击 Export CSV 下载"
              />
            )}
          </div>
        </div>

        <button
          onClick={handleCalculate}
          disabled={loading}
          className="mt-4 w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium transition-colors"
        >
          {loading ? '计算中...' : '计算本周使用情况'}
        </button>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {error}
          </div>
        )}
      </div>

      {/* Results */}
      {(claudeCodeStats || cursorStats) && (
        <>
          {/* Date Range */}
          <div className="text-sm text-gray-500">
            统计周期: {formatDate(claudeCodeStats?.metadata.start_date || cursorStats?.metadata.start_date || '')} ~ {formatDate(claudeCodeStats?.metadata.end_date || cursorStats?.metadata.end_date || '')}
          </div>

          {/* Comparison Table */}
          <ComparisonTable claudeCode={claudeCodeStats} cursor={cursorStats} />

          {/* Migration Progress */}
          {claudeCodeStats && cursorStats && (
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
