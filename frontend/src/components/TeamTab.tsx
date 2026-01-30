import { useState } from 'react';
import type { TeamStats } from '../types';
import { mergeTeamStats, exportMarkdown } from '../services/api';
import { FileUploader } from './FileUploader';
import { formatTokens, formatPercent, calculateMigrationRatio, getMigrationColor } from '../utils/formatters';

export function TeamTab() {
  const [files, setFiles] = useState<File[]>([]);
  const [teamStats, setTeamStats] = useState<TeamStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = (newFiles: File[]) => {
    setFiles((prev) => [...prev, ...newFiles]);
    setError(null);
  };

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMerge = async () => {
    if (files.length === 0) {
      setError('请先上传成员报告文件');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const stats = await mergeTeamStats(files);
      setTeamStats(stats);
    } catch (e) {
      setError(e instanceof Error ? e.message : '合并失败');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!teamStats) return;

    try {
      const markdown = await exportMarkdown('team', teamStats);

      const blob = new Blob([markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `team-report-${new Date().toISOString().slice(0, 10)}.md`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : '导出失败');
    }
  };

  const ccTotal = teamStats?.team_summary.claude_code.total_tokens_with_cache ??
                  teamStats?.team_summary.claude_code.total_tokens ?? 0;
  const cuTotal = teamStats?.team_summary.cursor.total_tokens ?? 0;
  const migrationRatio = calculateMigrationRatio(ccTotal, cuTotal);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">团队使用统计</h2>
          <p className="text-gray-500 text-sm">
            合并团队成员的统计数据，生成汇总报告
          </p>
        </div>
        {teamStats && (
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
        <h3 className="text-lg font-medium mb-4">上传成员数据</h3>
        <p className="text-sm text-gray-500 mb-4">
          上传各成员导出的 Markdown 报告（.md 文件）
        </p>

        <FileUploader
          accept=".md"
          multiple
          onUpload={handleUpload}
          label="上传 Markdown 报告"
          description="上传成员导出的 .md 报告文件"
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

      {/* Results */}
      {teamStats && (
        <>
          {/* Summary Cards */}
          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-gray-500 text-sm">团队成员</div>
              <div className="text-3xl font-bold">{teamStats.metadata.total_members}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-gray-500 text-sm">Claude Code 使用量</div>
              <div className="text-3xl font-bold text-green-600">{formatTokens(ccTotal)}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-gray-500 text-sm">Cursor 使用量</div>
              <div className="text-3xl font-bold text-yellow-600">{formatTokens(cuTotal)}</div>
            </div>
          </div>

          {/* Migration Progress */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium mb-4">团队迁移进度</h3>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="relative h-4 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="absolute left-0 top-0 h-full bg-green-500 transition-all duration-500"
                    style={{ width: `${Math.min((ccTotal / (ccTotal + cuTotal)) * 100, 100)}%` }}
                  />
                </div>
              </div>
              <div className={`text-2xl font-bold ${getMigrationColor(migrationRatio)}`}>
                {formatPercent(migrationRatio)}
              </div>
            </div>
            <div className="mt-2 text-sm text-gray-500">
              Claude Code / Cursor 比值
            </div>
          </div>

          {/* Member Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <h3 className="text-lg font-medium p-6 pb-0">成员明细</h3>
            <table className="min-w-full divide-y divide-gray-200 mt-4">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    成员
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Claude Code
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cursor
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    迁移率
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {Object.entries(teamStats.by_member).map(([name, stats]) => {
                  const memberCc = stats.claude_code?.total_tokens_with_cache ??
                                   stats.claude_code?.total_tokens ?? 0;
                  const memberCu = stats.cursor?.total_tokens ?? 0;
                  const memberRatio = calculateMigrationRatio(memberCc, memberCu);

                  return (
                    <tr key={name}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-mono">
                        {formatTokens(memberCc)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-mono">
                        {formatTokens(memberCu)}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-mono ${getMigrationColor(memberRatio)}`}>
                        {formatPercent(memberRatio)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Average Stats */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium mb-4">人均统计</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-gray-50 p-4 rounded">
                <div className="text-gray-500 text-sm">人均 Claude Code Token</div>
                <div className="text-xl font-bold text-green-600">
                  {formatTokens(ccTotal / Math.max(teamStats.team_summary.claude_code.members, 1))}
                </div>
              </div>
              <div className="bg-gray-50 p-4 rounded">
                <div className="text-gray-500 text-sm">人均 Cursor Token</div>
                <div className="text-xl font-bold text-yellow-600">
                  {formatTokens(cuTotal / Math.max(teamStats.team_summary.cursor.members, 1))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
