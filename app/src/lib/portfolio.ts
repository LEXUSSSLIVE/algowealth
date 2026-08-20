export type Period = {
  key: '1d' | '1w' | '1m' | '6m';
  label: string;
  days: number;
  range: string;
  interval: string;
};

export type BalancePoint = { total: number; date: string };

export type BankRow = {
  name: string;
  account_name: string | null;
  account_id: string | null;
  total_value_usd: number;
  prev_total_value_usd: number | null;
};

// days goes to the Go API (the number of LAST SNAPSHOTS, not calendar days),
// range/interval go to Yahoo stock charts.
export const PERIODS: Period[] = [
  { key: '1d', label: '1Day', days: 2, range: '1d', interval: '5m' },
  { key: '1w', label: '1Week', days: 7, range: '5d', interval: '30m' },
  { key: '1m', label: '1Month', days: 30, range: '1mo', interval: '1d' },
  { key: '6m', label: '6Months', days: 180, range: '6mo', interval: '1d' },
];

export function balanceDelta(series: BalancePoint[]): { abs: number; pct: number } {
  if (series.length < 2) return { abs: 0, pct: 0 };
  const first = series[0].total;
  const last = series[series.length - 1].total;
  const abs = last - first;
  return { abs, pct: first ? (abs / first) * 100 : 0 };
}

export function bankDeltaPct(total: number, prev: number | null): number | null {
  if (prev === null || prev === 0) return null;
  return ((total - prev) / prev) * 100;
}
