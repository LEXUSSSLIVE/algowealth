export type WatchRow = {
  symbol: string;
  name: string;
  price: number | null;
  change_percent: number | null;
};

export type WatchSortBy = 'symbol' | 'change';
export type WatchSortDir = 'asc' | 'desc';

export function sortWatchlistRows(
  rows: WatchRow[],
  by: WatchSortBy,
  dir: WatchSortDir,
): WatchRow[] {
  const mul = dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (by === 'symbol') return mul * a.symbol.localeCompare(b.symbol);
    return mul * ((a.change_percent ?? 0) - (b.change_percent ?? 0));
  });
}
