// Claude Code Stats Types
export interface ClaudeCodeStats {
  metadata: {
    generated_at: string;
    start_date: string;
    end_date: string;
    username: string;
    machine: string;
  };
  summary: {
    total_input_tokens: number;
    total_output_tokens: number;
    total_cache_creation_tokens: number;
    total_cache_read_tokens: number;
    total_tokens: number;
    total_tokens_with_cache: number;
    total_sessions: number;
    total_user_messages: number;
    total_assistant_messages: number;
    total_tool_calls: number;
    active_days: number;
    active_projects: number;
  };
  by_model: Record<string, {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens: number;
    cache_read_input_tokens: number;
    requests: number;
  }>;
  by_project: Record<string, {
    input_tokens: number;
    output_tokens: number;
    sessions: number;
    user_messages: number;
  }>;
  by_day: Record<string, {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
    requests?: number;
    sessions?: number;
  }>;
}

// Cursor Stats Types
export interface CursorStats {
  metadata: {
    generated_at: string;
    start_date: string;
    end_date: string;
    username: string;
    machine: string;
    source: string;
    csv_files: string[];
  };
  summary: {
    input_tokens_with_cache: number;
    input_tokens_without_cache: number;
    cache_read_tokens: number;
    output_tokens: number;
    total_tokens: number;
    requests: number;
    records: number;
    errored_records: number;
    active_days: number;
    users_count: number;
  };
  by_model: Record<string, {
    total_tokens: number;
    requests: number;
    records: number;
  }>;
  by_day: Record<string, {
    input_tokens_with_cache: number;
    output_tokens: number;
    total_tokens: number;
    requests: number;
    records: number;
  }>;
}

// Combined data for comparison
export interface ComparisonData {
  claude_code: ClaudeCodeStats | null;
  cursor: CursorStats | null;
}

// Trend data for charts
export interface TrendDataPoint {
  date: string;
  claudeCode: number;
  cursor: number;
}
