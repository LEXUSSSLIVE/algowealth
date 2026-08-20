import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Activity,
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  Banknote,
  BarChart3,
  BookOpen,
  Coins,
  DollarSign,
  Heart,
  Landmark,
  Percent,
  PieChart,
  PiggyBank,
  Scale,
  TrendingUp,
} from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getChart, getQuotes, getStockStats, getWatchlist } from '@/api/portfolio';
import { useSession } from '@/auth/session';
import { LineChart } from '@/components/line-chart';
import { SlidingSegment } from '@/components/segment';
import { exchangeName, formatMoney } from '@/lib/format';
import { PERIODS } from '@/lib/portfolio';
import { useApiData, useReloadOnFocus } from '@/lib/use-api-data';
import { colors, font, spacing } from '@/theme/tokens';

function deltaColor(v: number) {
  if (v > 0) return colors.green;
  if (v < 0) return colors.red;
  return colors.textGray;
}

function fmtNum(v: number | null) {
  return v != null ? v.toFixed(2) : '—';
}

function fmtPct(v: number | null) {
  return v != null ? `${v.toFixed(2)}%` : '—';
}

function fmtBig(v: number | null) {
  if (v == null) return '—';
  const abs = Math.abs(v);
  if (abs >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  return formatMoney(v);
}

function StatRow({ icon: Icon, label, children }: {
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.statRow}>
      <Icon size={22} color={colors.primary} strokeWidth={1.9} />
      <Text style={styles.statLabel}>{label}</Text>
      {children}
    </View>
  );
}

export default function StockScreen() {
  const { api } = useSession();
  const router = useRouter();
  const params = useLocalSearchParams<{ symbol: string; name?: string; exchange?: string }>();
  const symbol = String(params.symbol ?? '').toUpperCase();
  const [periodKey, setPeriodKey] = useState('1d');
  const period = PERIODS.find((p) => p.key === periodKey) ?? PERIODS[0];

  const quote = useApiData(() => getQuotes(api, [symbol]), [symbol]);
  const chart = useApiData(
    () => getChart(api, symbol, period.range, period.interval),
    [symbol, period.range, period.interval],
  );
  const watchlist = useApiData(() => getWatchlist(api), []);
  useReloadOnFocus(watchlist.reload);
  const stats = useApiData(() => getStockStats(api, symbol), [symbol]);

  const q = quote.data?.quotes[0];
  const name = (params.name as string) || q?.name || '';
  const exchange = (params.exchange as string) || (q as { exchange?: string } | undefined)?.exchange || '';
  const inWatchlist = useMemo(
    () => (watchlist.data ?? []).some((w) => w.symbol === symbol),
    [watchlist.data, symbol],
  );

  const prices = chart.data?.chart.prices ?? [];
  const timestamps = chart.data?.chart.timestamps ?? [];
  const points = prices.map((value, i) => ({
    value,
    label: timestamps[i]
      ? new Date(timestamps[i] * 1000).toLocaleString('ru-RU', {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        })
      : undefined,
  }));
  const periodDelta =
    prices.length > 1
      ? ((prices[prices.length - 1] - prices[0]) / prices[0]) * 100
      : 0;

  async function toggleHeart() {
    if (inWatchlist) {
      await api.del(`/watchlist/${symbol}`);
    } else {
      await api.post('/watchlist', { symbol, name });
    }
    watchlist.reload();
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable style={styles.back} onPress={() => router.back()}>
            <ArrowLeft size={20} color="#FFFFFF" strokeWidth={2.2} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.symbol}>{symbol}</Text>
            {!!name && <Text style={styles.name} numberOfLines={1}>{name}</Text>}
            {!!exchange && <Text style={styles.exchange}>{exchangeName(exchange)}</Text>}
          </View>
          <Pressable onPress={toggleHeart} hitSlop={10}>
            <Heart
              size={26}
              color={inWatchlist ? colors.red : colors.tabInactive}
              fill={inWatchlist ? colors.red : 'transparent'}
              strokeWidth={2}
            />
          </Pressable>
        </View>

        <View style={styles.priceBlock}>
          <Text style={styles.price}>{q ? formatMoney(q.price) : '—'}</Text>
          {prices.length > 1 && (
            <Text style={[styles.periodDelta, { color: deltaColor(periodDelta) }]}>
              {periodDelta > 0 ? '+' : ''}{periodDelta.toFixed(2)}% · {period.label}
            </Text>
          )}
        </View>

        <View style={{ marginTop: spacing(4) }}>
          <LineChart
            points={points}
            height={220}
            grid
            gradient
            tooltip
            formatValue={formatMoney}
          />
        </View>

        <View style={styles.section}>
          <SlidingSegment
            options={PERIODS.map((p) => ({ key: p.key, label: p.label }))}
            value={periodKey}
            onChange={setPeriodKey}
          />
        </View>

        <View style={[styles.section, { paddingBottom: spacing(10) }]}>
          <Text style={styles.statsTitle}>Market Stats</Text>
          <StatRow icon={Banknote} label="Latest Price">
            <Text style={styles.statValue}>
              {q ? formatMoney(q.price) : '—'}
              {q ? (
                <Text style={{ color: deltaColor(q.change_percent) }}>
                  {' '}({q.change_percent > 0 ? '+' : ''}{q.change_percent.toFixed(2)}%)
                </Text>
              ) : null}
            </Text>
          </StatRow>
          <StatRow icon={Landmark} label="Market Cap">
            <Text style={styles.statValue}>{fmtBig(stats.data?.market_cap ?? null)}</Text>
          </StatRow>
          <StatRow icon={Percent} label="PE Ratio">
            <Text style={styles.statValue}>{fmtNum(stats.data?.pe ?? null)}</Text>
          </StatRow>
          <StatRow icon={TrendingUp} label="Forward PE">
            <Text style={styles.statValue}>{fmtNum(stats.data?.forward_pe ?? null)}</Text>
          </StatRow>
          <StatRow icon={Coins} label="EPS">
            <Text style={styles.statValue}>{fmtNum(stats.data?.eps ?? null)}</Text>
          </StatRow>
          <StatRow icon={BookOpen} label="Book Value">
            <Text style={styles.statValue}>{fmtNum(stats.data?.book_value ?? null)}</Text>
          </StatRow>
          <StatRow icon={Scale} label="Price to Book">
            <Text style={styles.statValue}>{fmtNum(stats.data?.price_to_book ?? null)}</Text>
          </StatRow>
          <StatRow icon={PiggyBank} label="Dividend Yield">
            <Text style={styles.statValue}>{fmtPct(stats.data?.dividend_yield_pct ?? null)}</Text>
          </StatRow>
          <StatRow icon={Activity} label="Beta">
            <Text style={styles.statValue}>{fmtNum(stats.data?.beta ?? null)}</Text>
          </StatRow>
          <StatRow icon={ArrowUpRight} label="52W High">
            <Text style={styles.statValue}>
              {stats.data?.high_52w != null ? formatMoney(stats.data.high_52w) : '—'}
            </Text>
          </StatRow>
          <StatRow icon={ArrowDownRight} label="52W Low">
            <Text style={styles.statValue}>
              {stats.data?.low_52w != null ? formatMoney(stats.data.low_52w) : '—'}
            </Text>
          </StatRow>
          <StatRow icon={PieChart} label="Profit Margin">
            <Text style={styles.statValue}>{fmtPct(stats.data?.profit_margin_pct ?? null)}</Text>
          </StatRow>
          <StatRow icon={BarChart3} label="ROE">
            <Text style={styles.statValue}>{fmtPct(stats.data?.roe_pct ?? null)}</Text>
          </StatRow>
          <StatRow icon={DollarSign} label="Revenue">
            <Text style={styles.statValue}>{fmtBig(stats.data?.revenue ?? null)}</Text>
          </StatRow>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    paddingHorizontal: spacing(5),
    paddingTop: spacing(2),
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  symbol: { fontFamily: font.bold, fontSize: 20, color: colors.textDark },
  name: { fontFamily: font.regular, fontSize: 13, color: colors.textGray },
  exchange: { fontFamily: font.regular, fontSize: 11, color: colors.textGray },
  priceBlock: { paddingHorizontal: spacing(5), marginTop: spacing(5) },
  price: { fontFamily: font.bold, fontSize: 34, color: colors.textDark },
  periodDelta: { fontFamily: font.semibold, fontSize: 15, marginTop: spacing(1) },
  section: { paddingHorizontal: spacing(5), marginTop: spacing(4), paddingBottom: spacing(8) },
  statsTitle: {
    fontFamily: font.bold,
    fontSize: 24,
    color: colors.textDark,
    marginBottom: spacing(2),
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3.5),
    paddingVertical: spacing(3.5),
  },
  statLabel: { flex: 1, fontFamily: font.semibold, fontSize: 16, color: colors.textDark },
  statValue: { fontFamily: font.bold, fontSize: 17, color: colors.textDark },
});
