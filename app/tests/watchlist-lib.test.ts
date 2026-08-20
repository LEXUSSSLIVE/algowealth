import { sortWatchlistRows, type WatchRow } from '@/lib/watchlist';

const ROWS: WatchRow[] = [
  { symbol: 'MSFT', name: 'Microsoft', price: 499, change_percent: 0.18 },
  { symbol: 'AAPL', name: 'Apple', price: 312, change_percent: -0.05 },
  { symbol: 'NVDA', name: 'NVIDIA', price: 180, change_percent: 2.4 },
];

test('sorts by symbol A-Z and Z-A', () => {
  expect(sortWatchlistRows(ROWS, 'symbol', 'asc').map((r) => r.symbol))
    .toEqual(['AAPL', 'MSFT', 'NVDA']);
  expect(sortWatchlistRows(ROWS, 'symbol', 'desc').map((r) => r.symbol))
    .toEqual(['NVDA', 'MSFT', 'AAPL']);
});

test('sorts by 24h change both directions', () => {
  expect(sortWatchlistRows(ROWS, 'change', 'desc').map((r) => r.symbol))
    .toEqual(['NVDA', 'MSFT', 'AAPL']);
  expect(sortWatchlistRows(ROWS, 'change', 'asc').map((r) => r.symbol))
    .toEqual(['AAPL', 'MSFT', 'NVDA']);
});

test('does not mutate input', () => {
  const copy = [...ROWS];
  sortWatchlistRows(ROWS, 'symbol', 'asc');
  expect(ROWS).toEqual(copy);
});
