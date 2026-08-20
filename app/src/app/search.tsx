import { useRouter } from 'expo-router';
import { Heart, Search as SearchIcon, X } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { getWatchlist } from '@/api/portfolio';
import { useSession } from '@/auth/session';
import { exchangeName } from '@/lib/format';
import { useApiData } from '@/lib/use-api-data';
import { colors, font, spacing } from '@/theme/tokens';

type SearchResult = {
  symbol: string;
  shortname: string;
  exchange: string;
  type: string;
};

const DEBOUNCE_MS = 300;

export default function SearchScreen() {
  const { api } = useSession();
  const { t } = useTranslation();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  const watchlist = useApiData(() => getWatchlist(api), []);
  const inWatchlist = useMemo(
    () => new Set((watchlist.data ?? []).map((w) => w.symbol)),
    [watchlist.data],
  );

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    if (debounced.length < 1) {
      setResults([]);
      return;
    }
    setLoading(true);
    api
      .get(`/search?q=${encodeURIComponent(debounced)}`)
      .then((r) => {
        if (!cancelled) setResults((r as { results: SearchResult[] }).results);
      })
      .catch(() => {
        if (!cancelled) setResults([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debounced, api]);

  async function toggleHeart(item: SearchResult) {
    if (inWatchlist.has(item.symbol)) {
      await api.del(`/watchlist/${item.symbol}`);
    } else {
      await api.post('/watchlist', { symbol: item.symbol, name: item.shortname });
    }
    watchlist.reload();
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.searchRow}>
        <View style={styles.inputWrap}>
          <SearchIcon size={20} color={colors.fieldIcon} strokeWidth={2} />
          <TextInput
            style={styles.input}
            placeholder={t('search.placeholder')}
            placeholderTextColor={colors.textGray}
            value={query}
            onChangeText={setQuery}
            autoFocus
            autoCapitalize="characters"
            autoCorrect={false}
          />
        </View>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <X size={26} color={colors.textDark} strokeWidth={2} />
        </Pressable>
      </View>
      {loading && <ActivityIndicator style={{ marginTop: spacing(6) }} color={colors.primary} />}
      {!loading && debounced.length > 0 && results.length === 0 && (
        <Text style={styles.empty}>{t('search.noResults')}</Text>
      )}
      <FlatList
        data={results}
        keyExtractor={(r) => r.symbol}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => {
          const active = inWatchlist.has(item.symbol);
          return (
            <Pressable
              style={styles.row}
              onPress={() =>
                router.push({
                  pathname: '/stock/[symbol]',
                  params: { symbol: item.symbol, name: item.shortname, exchange: item.exchange },
                })
              }
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.symbol}>{item.symbol}</Text>
                <Text style={styles.name} numberOfLines={1}>
                  {item.shortname}
                  {item.exchange ? ` · ${exchangeName(item.exchange)}` : ''}
                </Text>
              </View>
              <Pressable onPress={() => toggleHeart(item)} hitSlop={10}>
                <Heart
                  size={22}
                  color={active ? colors.red : colors.tabInactive}
                  fill={active ? colors.red : 'transparent'}
                  strokeWidth={2}
                />
              </Pressable>
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    paddingHorizontal: spacing(5),
    paddingTop: spacing(3),
    paddingBottom: spacing(2),
  },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2.5),
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: colors.fieldBorder,
    paddingHorizontal: spacing(4),
  },
  input: { flex: 1, fontFamily: font.regular, fontSize: 16, color: colors.textDark },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing(5),
    paddingVertical: spacing(3.5),
  },
  symbol: { fontFamily: font.semibold, fontSize: 16, color: colors.textDark },
  name: { fontFamily: font.regular, fontSize: 13, color: colors.textGray, marginTop: 1 },
  empty: {
    fontFamily: font.regular,
    fontSize: 14,
    color: colors.textGray,
    textAlign: 'center',
    marginTop: spacing(8),
  },
});
