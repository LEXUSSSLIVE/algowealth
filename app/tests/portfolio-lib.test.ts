import { formatDateTime, formatDelta, formatMoney } from '@/lib/format';
import {
  balanceDelta,
  bankDeltaPct,
  PERIODS,
} from '@/lib/portfolio';

test('formatMoney renders dollars with thousand separators', () => {
  expect(formatMoney(201190091.25)).toBe('$201,190,091.25');
  expect(formatMoney(0)).toBe('$0.00');
  expect(formatMoney(-312.31)).toBe('-$312.31');
});

test('formatDelta shows sign, money and percent', () => {
  expect(formatDelta(224255.78, 1.317)).toBe('+$224,255.78 (+1.32%)');
  expect(formatDelta(-312.31, -0.13)).toBe('-$312.31 (-0.13%)');
  expect(formatDelta(0, 0)).toBe('$0.00 (0.00%)');
});

test('formatDateTime renders DD.MM.YYYY HH:mm', () => {
  expect(formatDateTime('2024-12-15T00:00:00Z')).toBe('15.12.2024 00:00');
});

test('PERIODS map segment keys to Go days and Yahoo chart params', () => {
  expect(PERIODS.map((p) => p.key)).toEqual(['1d', '1w', '1m', '6m']);
  const day = PERIODS[0];
  expect(day.days).toBe(2);
  expect(day.range).toBe('1d');
  expect(day.interval).toBe('5m');
  expect(PERIODS[3].days).toBe(180);
});

test('balanceDelta computes first-to-last change', () => {
  const series = [
    { total: 100, date: '2024-10-15T00:00:00Z' },
    { total: 110, date: '2024-11-27T00:00:00Z' },
  ];
  expect(balanceDelta(series)).toEqual({ abs: 10, pct: 10 });
});

test('balanceDelta with under two points is zero', () => {
  expect(balanceDelta([{ total: 201190091.25, date: 'x' }])).toEqual({ abs: 0, pct: 0 });
  expect(balanceDelta([])).toEqual({ abs: 0, pct: 0 });
});

test('bankDeltaPct is null without prev', () => {
  expect(bankDeltaPct(150, 150)).toBe(0);
  expect(bankDeltaPct(110, 100)).toBeCloseTo(10);
  expect(bankDeltaPct(200, null)).toBeNull();
  expect(bankDeltaPct(200, 0)).toBeNull();
});
