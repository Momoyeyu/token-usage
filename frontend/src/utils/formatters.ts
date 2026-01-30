/**
 * Format token number with K/M suffix
 */
export function formatTokens(n: number): string {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(2)}M`;
  } else if (n >= 1_000) {
    return `${(n / 1_000).toFixed(1)}K`;
  }
  return n.toString();
}

/**
 * Format percentage
 */
export function formatPercent(n: number): string {
  return `${n.toFixed(1)}%`;
}

/**
 * Format date string to locale date
 */
export function formatDate(dateStr: string): string {
  if (!dateStr) return 'N/A';
  return dateStr.slice(0, 10);
}

/**
 * Calculate migration ratio
 */
export function calculateMigrationRatio(claudeCode: number, cursor: number): number {
  if (cursor === 0) return 0;
  return (claudeCode / cursor) * 100;
}

/**
 * Get color class based on migration ratio
 */
export function getMigrationColor(ratio: number): string {
  if (ratio >= 100) return 'text-green-600';
  if (ratio >= 50) return 'text-yellow-600';
  return 'text-red-600';
}
