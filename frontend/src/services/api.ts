import type { ClaudeCodeStats, CursorStats, TeamStats } from '../types';

const API_BASE = 'http://localhost:8000/api';

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

interface MarkdownResponse {
  success: boolean;
  markdown: string;
}

export async function fetchClaudeCodeStats(params?: {
  start?: string;
  end?: string;
  days?: number;
  week?: boolean;
  username?: string;
} | null): Promise<ClaudeCodeStats> {
  const searchParams = new URLSearchParams();
  if (params?.start) searchParams.set('start', params.start);
  if (params?.end) searchParams.set('end', params.end);
  if (params?.days) searchParams.set('days', params.days.toString());
  if (params?.week) searchParams.set('week', 'true');
  if (params?.username) searchParams.set('username', params.username);

  const response = await fetch(`${API_BASE}/claude-code/stats?${searchParams}`);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const result: ApiResponse<ClaudeCodeStats> = await response.json();
  if (!result.success) {
    throw new Error('API returned unsuccessful response');
  }
  return result.data;
}

export async function uploadCursorCsv(
  file: File,
  params?: {
    start?: string;
    end?: string;
    username?: string;
    week?: boolean;
  } | null
): Promise<CursorStats> {
  const searchParams = new URLSearchParams();
  if (params?.start) searchParams.set('start', params.start);
  if (params?.end) searchParams.set('end', params.end);
  if (params?.username) searchParams.set('username', params.username);

  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE}/cursor/upload?${searchParams}`, {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const result: ApiResponse<CursorStats> = await response.json();
  if (!result.success) {
    throw new Error('API returned unsuccessful response');
  }
  return result.data;
}

export async function mergeTeamStats(files: File[]): Promise<TeamStats> {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append('files', file);
  });

  const response = await fetch(`${API_BASE}/team/merge`, {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const result: ApiResponse<TeamStats> = await response.json();
  if (!result.success) {
    throw new Error('API returned unsuccessful response');
  }
  return result.data;
}

export async function exportMarkdown(
  type: 'personal' | 'team',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any
): Promise<string> {
  const response = await fetch(`${API_BASE}/team/export/markdown`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ type, data }),
  });
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const result: MarkdownResponse = await response.json();
  if (!result.success) {
    throw new Error('API returned unsuccessful response');
  }
  return result.markdown;
}
