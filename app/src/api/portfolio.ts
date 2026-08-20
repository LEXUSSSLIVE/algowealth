import type { ApiClient } from '@/api/client';
import type { BalancePoint, BankRow } from '@/lib/portfolio';

export type BankListItem = {
  bank_name: string;
  account_name: string | null;
  account_id: string | null;
  bank_filter: string;
};

export type Instrument = {
  name: string;
  instrument_type: string | null;
  investment_category: string | null;
  isin: string | null;
  currency: string | null;
  quantity: number | null;
  purch_price: number | null;
  current_price: number | null;
  total_value_usd: number;
  prev_total_value_usd: number | null;
  bank_name: string;
  account_name: string | null;
  account_id: string | null;
  date: string;
};

export type Distribution = {
  total: number;
  components: { name: string; value: number; rel_value: number }[];
};

export type Post = {
  id: number;
  title: string;
  type: 'stock_ideas' | 'reports';
  image_path: string | null;
  published_at: string;
};

function qs(params: Record<string, string | number | string[] | undefined>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) continue;
    for (const item of Array.isArray(v) ? v : [v]) {
      parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(item))}`);
    }
  }
  return parts.length ? `?${parts.join('&')}` : '';
}

// The Go API reads filters as bank=/type= (singular, repeatable) — see
// filtersFromRequest in finance_track_server; banks=/types= are silently ignored.
export const getBalance = (api: ApiClient, days: number, banks?: string[]) =>
  api.get(`/portfolio/balance${qs({ days, bank: banks })}`) as Promise<BalancePoint[]>;

export const getBanks = (api: ApiClient) =>
  api.get('/portfolio/banks') as Promise<BankRow[] & Record<string, unknown>[]>;

export const getBankList = (api: ApiClient) =>
  api.get('/portfolio/bank/list') as Promise<BankListItem[]>;

export const getInstruments = (api: ApiClient, opts: {
  banks?: string[]; types?: string[]; q?: string;
  order_by?: string; order_direction?: 'asc' | 'desc';
} = {}) => api.get(`/portfolio/instruments${qs({
  bank: opts.banks, type: opts.types, q: opts.q,
  order_by: opts.order_by, order_direction: opts.order_direction,
})}`) as Promise<Instrument[]>;

export const getDistribution = (api: ApiClient, opts: { banks?: string[]; types?: string[] } = {}) =>
  api.get(`/portfolio/instruments-type/distribution${qs({ bank: opts.banks, type: opts.types })}`) as Promise<Distribution>;

export type PostDetail = Post & {
  file_path: string | null;
  content_json: string | null;
};

export const getPosts = (api: ApiClient, type?: string, limit = 4) =>
  (api.get(`/posts${qs({ type, limit })}`) as Promise<{ posts: Post[] }>).then((r) => r.posts);

export const getPost = (api: ApiClient, id: number) =>
  api.get(`/posts/${id}`) as Promise<PostDetail>;

export type StockStats = {
  symbol: string;
  market_cap: number | null;
  pe: number | null;
  forward_pe: number | null;
  eps: number | null;
  book_value: number | null;
  price_to_book: number | null;
  dividend_yield_pct: number | null;
  beta: number | null;
  high_52w: number | null;
  low_52w: number | null;
  profit_margin_pct: number | null;
  roe_pct: number | null;
  revenue: number | null;
};

export const getStockStats = (api: ApiClient, symbol: string) =>
  (api.get(`/stats?symbol=${encodeURIComponent(symbol)}`) as Promise<{ stats: StockStats }>)
    .then((r) => r.stats);

export const getQuotes = (api: ApiClient, symbols: string[]) =>
  api.get(`/quotes?symbols=${symbols.join(',')}`) as Promise<{
    quotes: { symbol: string; name: string; price: number; change: number; change_percent: number; currency: string }[];
    stale: boolean;
  }>;

export const getChart = (api: ApiClient, symbol: string, range: string, interval: string) =>
  api.get(`/chart?symbol=${encodeURIComponent(symbol)}&range=${range}&interval=${interval}`) as Promise<{
    chart: { symbol: string; timestamps: number[]; prices: number[] };
    stale: boolean;
  }>;

export const getWatchlist = (api: ApiClient) =>
  api.get('/watchlist') as Promise<{ symbol: string; name: string; created_at: string }[]>;
