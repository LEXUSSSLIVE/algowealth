const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatMoney(n: number): string {
  return usd.format(n);
}

export function formatDelta(abs: number, pct: number): string {
  const sign = abs > 0 ? '+' : '';
  const pctSign = pct > 0 ? '+' : '';
  return `${sign}${formatMoney(abs)} (${pctSign}${pct.toFixed(2)}%)`;
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (x: number) => String(x).padStart(2, '0');
  return `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** Yahoo returns exchange codes (NMS, NYQ) — map them to human-readable names. */
const EXCHANGE_NAMES: Record<string, string> = {
  NMS: 'NASDAQ', NGM: 'NASDAQ', NCM: 'NASDAQ', NGS: 'NASDAQ', NASDAQ: 'NASDAQ',
  NYQ: 'NYSE', NYSE: 'NYSE', ASE: 'NYSE American', PCX: 'NYSE Arca',
  BTS: 'Cboe BZX', PNK: 'OTC', OTC: 'OTC', OPR: 'OPRA',
  TOR: 'TSX', VAN: 'TSXV', LSE: 'LSE', GER: 'XETRA', FRA: 'Frankfurt',
  PAR: 'Euronext Paris', AMS: 'Euronext Amsterdam', MIL: 'Borsa Italiana',
  HKG: 'HKEX', JPX: 'Tokyo', OSA: 'Osaka',
};

export function exchangeName(code: string): string {
  return EXCHANGE_NAMES[code?.toUpperCase()] ?? code;
}
