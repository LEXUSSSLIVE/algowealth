import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Animated,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import {
  getBalance,
  getChart,
  getPosts,
  getQuotes,
  getWatchlist,
  type Post,
} from '@/api/portfolio';
import { fileUrl } from '@/api/config';
import { useSession } from '@/auth/session';
import { Header } from '@/components/header';
import { LineChart } from '@/components/line-chart';
import { SlidingSegment } from '@/components/segment';
import { Skeleton } from '@/components/skeleton';
import { formatDateTime, formatDelta, formatMoney } from '@/lib/format';
import { balanceDelta, PERIODS } from '@/lib/portfolio';
import { useApiData, useReloadOnFocus } from '@/lib/use-api-data';
import { colors, font, radius, spacing } from '@/theme/tokens';

type Quote = {
  symbol: string;
  name: string;
  price: number;
  change: number;
  change_percent: number;
};

function deltaColor(v: number) {
  if (v > 0) return colors.green;
  if (v < 0) return colors.red;
  return colors.textGray;
}

function FadeIn({ children, fadeKey }: { children: React.ReactNode; fadeKey: string | number }) {
  const opacity = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    opacity.setValue(0);
    Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }).start();
  }, [fadeKey, opacity]);
  return <Animated.View style={{ opacity }}>{children}</Animated.View>;
}

function BalanceBlock({ periodDays }: { periodDays: number }) {
  const { api } = useSession();
  const { t } = useTranslation();
  const { data, loading } = useApiData(() => getBalance(api, periodDays), [periodDays]);

  if (loading && !data) {
    return (
      <View style={styles.balanceRow}>
        <View style={{ flex: 1, gap: 8 }}>
          <Skeleton style={{ height: 16, width: 110 }} />
          <Skeleton style={{ height: 34, width: 220 }} />
          <Skeleton style={{ height: 14, width: 160 }} />
        </View>
      </View>
    );
  }

  const series = data ?? [];
  const last = series.length ? series[series.length - 1] : null;
  const delta = balanceDelta(series);

  return (
    <View style={styles.balanceRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.balanceLabel}>{t('home.balanceLabel')}</Text>
        <FadeIn fadeKey={periodDays}>
          <Text style={styles.balanceValue} numberOfLines={1} adjustsFontSizeToFit>
            {last ? formatMoney(last.total) : '—'}
          </Text>
          {last ? (
            <>
              <Text style={[styles.balanceDelta, { color: deltaColor(delta.abs) }]}>
                {formatDelta(delta.abs, delta.pct)}
              </Text>
              <Text style={styles.lastUpdated}>
                {t('home.lastUpdated')}: {formatDateTime(last.date)}
              </Text>
            </>
          ) : (
            <Text style={styles.lastUpdated}>{t('home.noData')}</Text>
          )}
        </FadeIn>
      </View>
      {series.length > 0 && (
        <View style={styles.balanceChart}>
          <LineChart
            points={series.map((p) => ({ value: p.total }))}
            height={76}
            baseline
            gradient
          />
        </View>
      )}
    </View>
  );
}

function FavoriteCard({ quote }: { quote: Quote }) {
  const { api } = useSession();
  const router = useRouter();
  const { data } = useApiData(() => getChart(api, quote.symbol, '1d', '15m'), [quote.symbol]);
  const points = (data?.chart.prices ?? []).map((value) => ({ value }));

  return (
    <Pressable
      style={styles.favCard}
      onPress={() =>
        router.push({
          pathname: '/stock/[symbol]',
          params: { symbol: quote.symbol, name: quote.name },
        })
      }
    >
      <Text style={styles.favPrice}>{formatMoney(quote.price)}</Text>
      <Text style={[styles.favChangeAbs, { color: deltaColor(quote.change) }]}>
        {quote.change > 0 ? '+' : ''}{formatMoney(quote.change)}
      </Text>
      <View style={{ height: 56, marginVertical: spacing(2) }}>
        {points.length > 1 && <LineChart points={points} height={56} baseline gradient />}
      </View>
      <View style={styles.favBottom}>
        <View style={{ flex: 1 }}>
          <Text style={styles.favSymbol}>{quote.symbol}</Text>
          {!!quote.name && (
            <Text style={styles.favName} numberOfLines={1}>{quote.name}</Text>
          )}
        </View>
        <Text style={[styles.favPct, { color: deltaColor(quote.change_percent) }]}>
          {quote.change_percent > 0 ? '+' : ''}{quote.change_percent.toFixed(2)}%
        </Text>
      </View>
    </Pressable>
  );
}

function PostCard({ post }: { post: Post }) {
  const router = useRouter();
  const category = post.type === 'reports' ? 'Reports' : 'Stock ideas';
  return (
    <Pressable style={styles.postCard} onPress={() => router.push(`/blog/${post.id}`)}>
      <View style={{ flex: 1 }}>
        <Text style={styles.postTitle} numberOfLines={2}>{post.title}</Text>
        <Text style={styles.postMeta}>{formatDateTime(post.published_at).slice(0, 10)}</Text>
        <Text style={styles.postMeta}>{category}</Text>
      </View>
      {post.image_path ? (
        <Image source={{ uri: fileUrl(post.image_path) }} style={styles.postImage} />
      ) : (
        <View style={styles.postImage} />
      )}
    </Pressable>
  );
}

export default function HomeScreen() {
  const { api } = useSession();
  const { t } = useTranslation();
  const router = useRouter();
  const [periodKey, setPeriodKey] = useState('1d');
  const [newsType, setNewsType] = useState<'stock_ideas' | 'reports' | undefined>(undefined);

  const period = PERIODS.find((p) => p.key === periodKey) ?? PERIODS[0];

  const watchlist = useApiData(() => getWatchlist(api), []);
  useReloadOnFocus(watchlist.reload);
  const symbols = useMemo(
    () => (watchlist.data ?? []).map((w) => w.symbol),
    [watchlist.data],
  );
  const nameBySymbol = useMemo(
    () => Object.fromEntries((watchlist.data ?? []).map((w) => [w.symbol, w.name])),
    [watchlist.data],
  );
  const quotes = useApiData(
    () =>
      symbols.length
        ? getQuotes(api, symbols)
        : Promise.resolve({ quotes: [], stale: false }),
    [symbols.join(',')],
  );
  useReloadOnFocus(quotes.reload);
  const favQuotes: Quote[] = (quotes.data?.quotes ?? []).map((q) => ({
    ...q,
    name: q.name || nameBySymbol[q.symbol] || '',
  }));

  const posts = useApiData(() => getPosts(api, newsType), [newsType]);

  const chips = [
    { key: 'all', label: t('home.chipAll') },
    { key: 'stock_ideas', label: t('home.chipIdeas') },
    { key: 'reports', label: t('home.chipReports') },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Header onSearchPress={() => router.push('/search')} />
        <View style={styles.section}>
          <SlidingSegment
            options={PERIODS.map((p) => ({ key: p.key, label: p.label }))}
            value={periodKey}
            onChange={setPeriodKey}
          />
        </View>
        <View style={styles.section}>
          <BalanceBlock periodDays={period.days} />
        </View>

        <View style={[styles.section, styles.rowBetween, { marginTop: spacing(7) }]}>
          <Text style={styles.h2}>
            {t('home.favorites')} ({favQuotes.length})
          </Text>
          {favQuotes.length > 0 && (
            <Pressable onPress={() => router.push('/watchlist')}>
              <Text style={styles.link}>{t('home.all')}</Text>
            </Pressable>
          )}
        </View>
        {watchlist.loading && !watchlist.data ? (
          <View style={[styles.section, { flexDirection: 'row', gap: spacing(3) }]}>
            <Skeleton style={{ width: 180, height: 150 }} />
            <Skeleton style={{ width: 180, height: 150 }} />
          </View>
        ) : favQuotes.length === 0 ? (
          <Text style={[styles.section, styles.emptyText]}>{t('home.emptyWatchlist')}</Text>
        ) : (
          <FlatList
            horizontal
            data={favQuotes}
            keyExtractor={(q) => q.symbol}
            renderItem={({ item }) => <FavoriteCard quote={item} />}
            contentContainerStyle={{ paddingHorizontal: spacing(5), gap: spacing(3) }}
            style={{ marginTop: spacing(3) }}
            showsHorizontalScrollIndicator={false}
          />
        )}

        <View style={[styles.section, styles.rowBetween, { marginTop: spacing(7) }]}>
          <Text style={styles.h2}>{t('home.news')}</Text>
          <Pressable onPress={() => router.push('/blog')}>
            <Text style={styles.link}>{t('home.all')}</Text>
          </Pressable>
        </View>
        <View style={[styles.section, styles.chipsRow]}>
          {chips.map((c) => {
            const active = (c.key === 'all' && !newsType) || c.key === newsType;
            return (
              <Pressable
                key={c.key}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() =>
                  setNewsType(c.key === 'all' ? undefined : (c.key as 'stock_ideas' | 'reports'))
                }
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{c.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={[styles.section, { gap: spacing(3), paddingBottom: spacing(8) }]}>
          {(posts.data ?? []).map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
          {posts.data && posts.data.length === 0 && (
            <Text style={styles.emptyText}>{t('home.noPosts')}</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  section: { paddingHorizontal: spacing(5), marginTop: spacing(3) },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  h2: { fontFamily: font.bold, fontSize: 24, color: colors.textDark },
  link: { fontFamily: font.semibold, fontSize: 15, color: colors.primary },
  emptyText: { fontFamily: font.regular, fontSize: 14, color: colors.textGray },
  balanceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(3) },
  balanceLabel: { fontFamily: font.regular, fontSize: 15, color: colors.textGray },
  balanceValue: {
    fontFamily: font.medium,
    fontSize: 34,
    color: colors.textDark,
    marginTop: spacing(1),
  },
  balanceDelta: { fontFamily: font.medium, fontSize: 14, marginTop: spacing(1) },
  lastUpdated: {
    fontFamily: font.regular,
    fontSize: 12,
    color: colors.textGray,
    marginTop: spacing(1),
  },
  balanceChart: { width: 120 },
  favCard: {
    width: 180,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.fieldBorder,
    backgroundColor: colors.bg,
    padding: spacing(4),
  },
  favPrice: { fontFamily: font.bold, fontSize: 20, color: colors.textDark },
  favChangeAbs: { fontFamily: font.medium, fontSize: 13, marginTop: 2 },
  favBottom: { flexDirection: 'row', alignItems: 'flex-end' },
  favSymbol: { fontFamily: font.semibold, fontSize: 15, color: colors.textDark },
  favName: { fontFamily: font.regular, fontSize: 12, color: colors.textGray },
  favPct: { fontFamily: font.semibold, fontSize: 13 },
  chipsRow: { flexDirection: 'row', gap: spacing(2), flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: spacing(4),
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.fieldBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontFamily: font.medium, fontSize: 14, color: colors.textGray },
  chipTextActive: { color: '#FFFFFF' },
  postCard: {
    flexDirection: 'row',
    gap: spacing(3),
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.fieldBorder,
    padding: spacing(4),
  },
  postTitle: { fontFamily: font.semibold, fontSize: 16, color: colors.textDark },
  postMeta: { fontFamily: font.regular, fontSize: 12, color: colors.textGray, marginTop: 2 },
  postImage: {
    width: 110,
    height: 72,
    borderRadius: 12,
    backgroundColor: colors.segmentBg,
  },
});
