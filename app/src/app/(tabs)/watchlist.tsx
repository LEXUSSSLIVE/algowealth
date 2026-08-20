import { useRouter } from 'expo-router';
import { ArrowUpDown, Heart, Trash2 } from 'lucide-react-native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { getQuotes, getWatchlist } from '@/api/portfolio';
import { useSession } from '@/auth/session';
import { Header } from '@/components/header';
import { formatMoney } from '@/lib/format';
import {
  sortWatchlistRows,
  type WatchRow,
  type WatchSortBy,
  type WatchSortDir,
} from '@/lib/watchlist';
import { useApiData, useReloadOnFocus } from '@/lib/use-api-data';
import { colors, font, spacing } from '@/theme/tokens';

const REFRESH_MS = 45_000;

function pctColor(v: number | null) {
  if (v === null || v === 0) return colors.textGray;
  return v > 0 ? colors.green : colors.red;
}

export default function WatchlistScreen() {
  const { api } = useSession();
  const { t } = useTranslation();
  const router = useRouter();
  const [sortBy, setSortBy] = useState<WatchSortBy>('symbol');
  const [sortDir, setSortDir] = useState<WatchSortDir>('asc');
  const [undo, setUndo] = useState<{ symbol: string; name: string } | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const watchlist = useApiData(() => getWatchlist(api), []);
  useReloadOnFocus(watchlist.reload);
  const symbols = useMemo(
    () => (watchlist.data ?? []).map((w) => w.symbol),
    [watchlist.data],
  );
  const quotes = useApiData(
    () =>
      symbols.length
        ? getQuotes(api, symbols)
        : Promise.resolve({ quotes: [], stale: false }),
    [symbols.join(',')],
  );

  useEffect(() => {
    const id = setInterval(() => quotes.reload(), REFRESH_MS);
    return () => clearInterval(id);
  }, [quotes.reload]);

  const rows: WatchRow[] = useMemo(() => {
    const bySymbol = Object.fromEntries(
      (quotes.data?.quotes ?? []).map((q) => [q.symbol, q]),
    );
    const joined = (watchlist.data ?? []).map((w) => ({
      symbol: w.symbol,
      name: w.name,
      price: bySymbol[w.symbol]?.price ?? null,
      change_percent: bySymbol[w.symbol]?.change_percent ?? null,
    }));
    return sortWatchlistRows(joined, sortBy, sortDir);
  }, [watchlist.data, quotes.data, sortBy, sortDir]);

  function toggleSort(by: WatchSortBy) {
    if (sortBy === by) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(by);
      setSortDir(by === 'symbol' ? 'asc' : 'desc');
    }
  }

  async function remove(row: WatchRow) {
    try {
      await api.del(`/watchlist/${row.symbol}`);
      setUndo({ symbol: row.symbol, name: row.name });
      if (undoTimer.current) clearTimeout(undoTimer.current);
      undoTimer.current = setTimeout(() => setUndo(null), 5000);
      watchlist.reload();
    } catch {
      // the row comes back on the next reload
    }
  }

  async function restoreRemoved() {
    if (!undo) return;
    try {
      await api.post('/watchlist', { symbol: undo.symbol, name: undo.name });
    } finally {
      setUndo(null);
      watchlist.reload();
    }
  }

  const firstLoading = watchlist.loading && !watchlist.data;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Header onSearchPress={() => router.push('/search')} />
      <View style={styles.tableHeader}>
        <Pressable style={[styles.th, { flex: 1.4 }]} onPress={() => toggleSort('symbol')}>
          <Text style={styles.thText}>{t('watchlist.symbol')}</Text>
          <ArrowUpDown size={13} color={colors.textGray} strokeWidth={2} />
        </Pressable>
        <Text style={[styles.th, styles.thText, { flex: 1, textAlign: 'right' }]}>
          {t('watchlist.lastPrice')}
        </Text>
        <Pressable
          style={[styles.th, { flex: 1, justifyContent: 'flex-end' }]}
          onPress={() => toggleSort('change')}
        >
          <Text style={styles.thText}>{t('watchlist.change24')}</Text>
          <ArrowUpDown size={13} color={colors.textGray} strokeWidth={2} />
        </Pressable>
      </View>
      {firstLoading ? (
        <ActivityIndicator style={{ marginTop: spacing(10) }} color={colors.primary} />
      ) : rows.length === 0 ? (
        <Text style={styles.empty}>{t('home.emptyWatchlist')}</Text>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.symbol}
          renderItem={({ item }) => (
            <ReanimatedSwipeable
              renderRightActions={() => (
                <Pressable style={styles.deleteAction} onPress={() => remove(item)}>
                  <Trash2 size={22} color="#FFFFFF" strokeWidth={2} />
                </Pressable>
              )}
              overshootRight={false}
            >
              <Pressable
                style={styles.row}
                onPress={() => router.push(`/stock/${item.symbol}`)}
              >
                <View style={{ flex: 1.4 }}>
                  <Text style={styles.symbol}>{item.symbol}</Text>
                  {!!item.name && (
                    <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                  )}
                </View>
                <Text style={[styles.price, { flex: 1 }]}>
                  {item.price !== null ? formatMoney(item.price) : '—'}
                </Text>
                <Text
                  style={[styles.pct, { flex: 1, color: pctColor(item.change_percent) }]}
                >
                  {item.change_percent !== null
                    ? `${item.change_percent > 0 ? '+' : ''}${item.change_percent.toFixed(2)}%`
                    : '—'}
                </Text>
                <Pressable
                  onPress={() => remove(item)}
                  hitSlop={10}
                  style={{ marginLeft: spacing(3) }}
                >
                  <Heart size={20} color={colors.red} fill={colors.red} strokeWidth={2} />
                </Pressable>
              </Pressable>
            </ReanimatedSwipeable>
          )}
        />
      )}
      {undo && (
        <View style={styles.undoToast}>
          <Text style={styles.undoText}>
            {undo.symbol}: {t('watchlist.removed')}
          </Text>
          <Pressable onPress={restoreRemoved}>
            <Text style={styles.undoBtn}>{t('watchlist.undo')}</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing(5),
    paddingVertical: spacing(3),
    borderBottomWidth: 1,
    borderBottomColor: colors.fieldBorder,
  },
  th: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  thText: { fontFamily: font.medium, fontSize: 13, color: colors.textGray },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing(5),
    paddingVertical: spacing(3.5),
    backgroundColor: colors.bg,
  },
  symbol: { fontFamily: font.semibold, fontSize: 16, color: colors.textDark },
  name: { fontFamily: font.regular, fontSize: 12, color: colors.textGray, marginTop: 1 },
  price: { fontFamily: font.medium, fontSize: 15, color: colors.textDark, textAlign: 'right' },
  pct: { fontFamily: font.semibold, fontSize: 14, textAlign: 'right' },
  empty: {
    fontFamily: font.regular,
    fontSize: 15,
    color: colors.textGray,
    textAlign: 'center',
    marginTop: spacing(12),
    paddingHorizontal: spacing(8),
  },
  deleteAction: {
    width: 76,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  undoToast: {
    position: 'absolute',
    left: spacing(4),
    right: spacing(4),
    bottom: spacing(4),
    backgroundColor: colors.textDark,
    borderRadius: 14,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(3.5),
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  undoText: { fontFamily: font.medium, fontSize: 14, color: '#FFFFFF' },
  undoBtn: { fontFamily: font.bold, fontSize: 14, color: colors.headerLight },
});
