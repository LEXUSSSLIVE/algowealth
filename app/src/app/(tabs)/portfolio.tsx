import { ArrowUpDown, ChevronDown, X } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Svg, { Circle } from 'react-native-svg';

import {
  getBalance,
  getBankList,
  getBanks,
  getDistribution,
  getInstruments,
  type Instrument,
} from '@/api/portfolio';
import { useSession } from '@/auth/session';
import { Header } from '@/components/header';
import { LineChart } from '@/components/line-chart';
import { MultiSelectSheet } from '@/components/multi-select-sheet';
import { SlidingSegment, SolidSegment } from '@/components/segment';
import { formatDateTime, formatMoney } from '@/lib/format';
import {
  bankDeltaPct,
  PERIODS,
  type BankRow,
} from '@/lib/portfolio';
import { useApiData } from '@/lib/use-api-data';
import { colors, font, radius, spacing } from '@/theme/tokens';

const BAR_COLORS = [colors.primary, colors.logoBlue, colors.headerLight,
  colors.green, '#9B59F5', colors.red, colors.textGray];

function pctColor(v: number | null) {
  if (v === null) return colors.textGray;
  return v >= 0 ? colors.green : colors.red;
}

/** The Go API returns an empty account as either null or "-" — normalize to null. */
function normAccountId(v: string | null | undefined): string | null {
  return v && v !== '-' ? v : null;
}

/** Account label: account_id, falling back to account_name (some banks
 * distinguish accounts by name only, with no ID). */
function accountLabel(id: string | null | undefined, name: string | null | undefined): string | null {
  return normAccountId(id) ?? normAccountId(name);
}

/** Bank sheet options: bank/list is a union of the group's ENTIRE history, so
 * keep only accounts present in the latest snapshot (/banks) — otherwise the
 * sheet fills up with dead filters. bank_filter duplicates (accounts without an
 * ID collapse into one key) are merged into one option, joining labels with commas. */
function bankFilterOptions(
  list: { bank_filter: string; bank_name: string; account_name: string | null; account_id: string | null }[],
  current: BankRow[],
) {
  const live = new Set(current.map((r) => `${r.name}|${normAccountId(r.account_id) ?? ''}`));
  const seen = new Map<string, { key: string; label: string; subs: string[] }>();
  for (const b of list) {
    if (!live.has(`${b.bank_name}|${normAccountId(b.account_id) ?? ''}`)) continue;
    let opt = seen.get(b.bank_filter);
    if (!opt) {
      opt = { key: b.bank_filter, label: b.bank_name, subs: [] };
      seen.set(b.bank_filter, opt);
    }
    const sub = accountLabel(b.account_id, b.account_name);
    if (sub && !opt.subs.includes(sub)) opt.subs.push(sub);
  }
  return [...seen.values()].map((o) => ({
    key: o.key,
    label: o.label,
    sublabel: o.subs.length ? o.subs.join(', ') : 'No account ID found',
  }));
}

function AccountCard({ row }: { row: BankRow }) {
  const delta = bankDeltaPct(row.total_value_usd, row.prev_total_value_usd);
  return (
    <View style={styles.bankCard}>
      <View style={styles.bankRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.bankName}>{row.name}</Text>
          <Text style={styles.bankAccounts}>
            {accountLabel(row.account_id, row.account_name) ?? 'No account ID found'}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing(1.5) }}>
          <Text style={styles.bankValue}>{formatMoney(row.total_value_usd)}</Text>
          {delta !== null && (
            <Text style={[styles.bankDelta, { color: pctColor(delta) }]}>
              ({delta > 0 ? '+' : ''}{delta.toFixed(2)}%)
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

function InstrumentSearchResults({ query }: { query: string }) {
  const { api } = useSession();
  const instruments = useApiData(() => getInstruments(api, { q: query }), [query]);
  return (
    <View style={{ gap: spacing(3), marginTop: spacing(3), paddingBottom: spacing(8) }}>
      {(instruments.data ?? []).map((inst, i) => (
        <View key={`${inst.name}-${i}`} style={styles.bankCard}>
          <View style={styles.instRow}>
            <View style={{ flex: 1, paddingRight: spacing(2) }}>
              <Text style={styles.instName} numberOfLines={2}>{inst.name}</Text>
              <Text style={styles.instMeta}>
                {inst.instrument_type ?? '—'} · {inst.bank_name}
              </Text>
            </View>
            <Text style={styles.instValue}>{formatMoney(inst.total_value_usd)}</Text>
          </View>
        </View>
      ))}
      {instruments.data && instruments.data.length === 0 && (
        <Text style={styles.instMeta}>—</Text>
      )}
    </View>
  );
}

function HoldingsTab({ instrumentQuery }: { instrumentQuery: string }) {
  const { api } = useSession();
  const { t } = useTranslation();
  const [periodKey, setPeriodKey] = useState('1d');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [bankSheet, setBankSheet] = useState(false);
  const [selectedBanks, setSelectedBanks] = useState<string[]>([]);

  const period = PERIODS.find((p) => p.key === periodKey) ?? PERIODS[0];
  const balance = useApiData(
    () => getBalance(api, period.days, selectedBanks.length ? selectedBanks : undefined),
    [period.days, selectedBanks.join('|')],
  );
  const banks = useApiData(() => getBanks(api), []);
  const bankList = useApiData(() => getBankList(api), []);

  const filterOptions = useMemo(
    () => bankFilterOptions(bankList.data ?? [], (banks.data ?? []) as BankRow[]),
    [bankList.data, banks.data],
  );

  const accountRows = useMemo(() => {
    const filterByRow: Record<string, string> = {};
    for (const b of bankList.data ?? []) {
      filterByRow[`${b.bank_name}|${normAccountId(b.account_id) ?? ''}`] = b.bank_filter;
    }
    let list = [...((banks.data ?? []) as BankRow[])];
    if (selectedBanks.length) {
      const sel = new Set(selectedBanks);
      list = list.filter((r) =>
        sel.has(filterByRow[`${r.name}|${normAccountId(r.account_id) ?? ''}`]),
      );
    }
    return list.sort((a, b) =>
      sortDir === 'asc'
        ? a.total_value_usd - b.total_value_usd
        : b.total_value_usd - a.total_value_usd,
    );
  }, [banks.data, bankList.data, selectedBanks, sortDir]);

  const series = balance.data ?? [];
  const last = series.length ? series[series.length - 1] : null;

  if (instrumentQuery) {
    return <InstrumentSearchResults query={instrumentQuery} />;
  }

  return (
    <View>
      <Text style={styles.balanceLabel}>{t('home.balanceLabel')}</Text>
      <Text style={styles.balanceBig}>{last ? formatMoney(last.total) : '—'}</Text>
      <View style={{ marginTop: spacing(3) }}>
        <LineChart
          points={series.map((p) => ({
            value: p.total,
            label: formatDateTime(p.date).slice(0, 10),
          }))}
          height={190}
          grid
          gradient
          tooltip
          formatValue={formatMoney}
        />
      </View>
      <View style={{ marginTop: spacing(3) }}>
        <SlidingSegment
          options={PERIODS.map((p) => ({ key: p.key, label: p.label }))}
          value={periodKey}
          onChange={setPeriodKey}
        />
      </View>
      <View style={styles.controls}>
        <Pressable style={styles.filterChip} onPress={() => setBankSheet(true)}>
          <Text style={styles.filterChipText}>{t('portfolio.bank')}</Text>
          <ChevronDown size={16} color={colors.primary} strokeWidth={2.2} />
        </Pressable>
        <Pressable style={styles.sortBtn} onPress={() => setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))}>
          <Text style={styles.sortText}>{t('portfolio.currentBalance')}</Text>
          <ArrowUpDown size={15} color={colors.textGray} strokeWidth={2} />
        </Pressable>
      </View>
      {selectedBanks.length > 0 && (
        <View style={styles.selectedRow}>
          {selectedBanks.map((f) => (
            <Pressable
              key={f}
              style={styles.selectedChip}
              onPress={() => setSelectedBanks((cur) => cur.filter((x) => x !== f))}
            >
              <Text style={styles.selectedChipText} numberOfLines={1}>
                {filterOptions.find((o) => o.key === f)?.label ?? f}
              </Text>
              <X size={14} color={colors.primary} strokeWidth={2.2} />
            </Pressable>
          ))}
        </View>
      )}
      <View style={{ gap: spacing(3), marginTop: spacing(3), paddingBottom: spacing(8) }}>
        {accountRows.map((r, i) => (
          <AccountCard key={`${r.name}|${r.account_id ?? ''}|${i}`} row={r} />
        ))}
      </View>
      <MultiSelectSheet
        visible={bankSheet}
        title={t('portfolio.chooseBank')}
        clearLabel={t('portfolio.clearAll')}
        applyLabel={t('portfolio.apply')}
        options={filterOptions}
        selected={selectedBanks}
        onApply={(keys) => {
          setSelectedBanks(keys);
          setBankSheet(false);
        }}
        onClose={() => setBankSheet(false)}
      />
    </View>
  );
}

function Donut({ total, components }: {
  total: number;
  components: { name: string; value: number; rel_value: number }[];
}) {
  const { t } = useTranslation();
  const size = 200;
  const stroke = 28;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const gap = components.length > 1 ? 8 : 0;
  let acc = 0;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        {components.map((comp, i) => {
          const len = Math.max((comp.rel_value / 100) * c - gap, 2);
          const el = (
            <Circle
              key={comp.name}
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke={BAR_COLORS[i % BAR_COLORS.length]}
              strokeWidth={stroke}
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-acc}
              strokeLinecap="round"
              fill="none"
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          );
          acc += (comp.rel_value / 100) * c;
          return el;
        })}
      </Svg>
      <View style={styles.donutCenter}>
        <Text style={styles.donutLabel}>{t('portfolio.yourBalance')}</Text>
        <Text style={styles.donutValue}>{formatMoney(total)}</Text>
      </View>
    </View>
  );
}

function AllocationsTab() {
  const { api } = useSession();
  const { t } = useTranslation();
  const [typeSheet, setTypeSheet] = useState(false);
  const [bankSheet, setBankSheet] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedBanks, setSelectedBanks] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'bank' | 'account'>('bank');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Types come from the UNfiltered distribution: /instrument-type/list returns a
  // union of the entire history — dead options made the multi-select look broken.
  const allTypes = useApiData(() => getDistribution(api), []);
  const bankList = useApiData(() => getBankList(api), []);
  const banks = useApiData(() => getBanks(api), []);
  const dist = useApiData(
    () =>
      getDistribution(api, {
        types: selectedTypes.length ? selectedTypes : undefined,
        banks: selectedBanks.length ? selectedBanks : undefined,
      }),
    [selectedTypes.join('|'), selectedBanks.join('|')],
  );
  const instruments = useApiData(
    () =>
      getInstruments(api, {
        types: selectedTypes.length ? selectedTypes : undefined,
        banks: selectedBanks.length ? selectedBanks : undefined,
      }),
    [selectedTypes.join('|'), selectedBanks.join('|')],
  );

  const total = dist.data?.total ?? 0;
  const components = dist.data?.components ?? [];

  const rows = useMemo(() => {
    const list = [...(instruments.data ?? [])];
    const key = (i: Instrument) =>
      sortBy === 'bank' ? (i.bank_name ?? '') : (accountLabel(i.account_id, i.account_name) ?? '');
    list.sort((a, b) => key(a).localeCompare(key(b)) || a.name.localeCompare(b.name));
    if (sortDir === 'desc') list.reverse();
    return list;
  }, [instruments.data, sortBy, sortDir]);

  function toggleSort(field: 'bank' | 'account') {
    if (sortBy === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortBy(field);
      setSortDir('asc');
    }
  }

  return (
    <View>
      <View style={styles.donutRow}>
        <Donut total={total} components={components} />
        <View style={styles.legend}>
          {components.map((c, i) => (
            <View key={c.name} style={styles.legendRow}>
              <View
                style={[styles.legendDot, { backgroundColor: BAR_COLORS[i % BAR_COLORS.length] }]}
              />
              <Text style={styles.legendName} numberOfLines={2}>{c.name}</Text>
              <Text style={styles.legendPct}>{Math.round(c.rel_value)}%</Text>
            </View>
          ))}
          {dist.data && components.length === 0 && (
            <Text style={styles.instMeta}>{t('home.noData')}</Text>
          )}
        </View>
      </View>
      <View style={styles.controls}>
        <Pressable style={styles.filterChip} onPress={() => setBankSheet(true)}>
          <Text style={styles.filterChipText}>{t('portfolio.bank')}</Text>
          <ChevronDown size={16} color={colors.primary} strokeWidth={2.2} />
        </Pressable>
        <Pressable style={styles.filterChip} onPress={() => setTypeSheet(true)}>
          <Text style={styles.filterChipText}>Instrument type</Text>
          <ChevronDown size={16} color={colors.primary} strokeWidth={2.2} />
        </Pressable>
        <View style={{ flexDirection: 'row', gap: spacing(3) }}>
          {(['bank', 'account'] as const).map((field) => (
            <Pressable key={field} style={styles.sortBtn} onPress={() => toggleSort(field)}>
              <Text style={[styles.sortText, sortBy === field && { color: colors.primary }]}>
                {field === 'bank' ? t('portfolio.bank') : t('portfolio.account')}
              </Text>
              <ArrowUpDown
                size={15}
                color={sortBy === field ? colors.primary : colors.textGray}
                strokeWidth={2}
              />
            </Pressable>
          ))}
        </View>
      </View>
      <View style={styles.colHeader}>
        <Text style={[styles.colHeaderText, { flex: 1.5 }]}>{t('portfolio.name')}</Text>
        <Text style={[styles.colHeaderText, styles.colRight, { flex: 0.8 }]}>
          {t('portfolio.price')}
        </Text>
        <Text style={[styles.colHeaderText, styles.colRight, { flex: 1 }]}>
          {t('portfolio.quantity')}
        </Text>
      </View>
      <View style={{ gap: spacing(3), paddingBottom: spacing(8) }}>
        {rows.map((inst, i) => (
          <View key={`${inst.name}-${inst.account_id}-${i}`} style={styles.allocInstCard}>
            <View style={{ flex: 1.5, paddingRight: spacing(2) }}>
              <Text style={styles.instName} numberOfLines={2}>{inst.name}</Text>
              <Text style={styles.instMeta}>ISIN: {inst.isin || 'no ISIN in data'}</Text>
              <Text style={styles.instMeta}>Bank: {inst.bank_name}</Text>
              {!!accountLabel(inst.account_id, inst.account_name) && (
                <Text style={styles.instMeta}>Account: {accountLabel(inst.account_id, inst.account_name)}</Text>
              )}
            </View>
            <View style={{ flex: 0.8, alignItems: 'flex-end' }}>
              {inst.current_price != null && (
                <Text style={styles.instValue}>{formatMoney(inst.current_price)}</Text>
              )}
            </View>
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Text style={styles.instValue}>{formatMoney(inst.total_value_usd)}</Text>
              {inst.quantity != null && (
                <Text style={styles.instMeta}>{inst.quantity}</Text>
              )}
            </View>
          </View>
        ))}
        {instruments.data && rows.length === 0 && (
          <Text style={styles.instMeta}>{t('home.noData')}</Text>
        )}
      </View>
      <MultiSelectSheet
        visible={typeSheet}
        title={t('portfolio.chooseInstrument')}
        clearLabel={t('portfolio.clearAll')}
        applyLabel={t('portfolio.apply')}
        options={(allTypes.data?.components ?? []).map((c) => ({ key: c.name, label: c.name }))}
        selected={selectedTypes}
        onApply={(keys) => {
          setSelectedTypes(keys);
          setTypeSheet(false);
        }}
        onClose={() => setTypeSheet(false)}
      />
      <MultiSelectSheet
        visible={bankSheet}
        title={t('portfolio.chooseBank')}
        clearLabel={t('portfolio.clearAll')}
        applyLabel={t('portfolio.apply')}
        options={bankFilterOptions(bankList.data ?? [], (banks.data ?? []) as BankRow[])}
        selected={selectedBanks}
        onApply={(keys) => {
          setSelectedBanks(keys);
          setBankSheet(false);
        }}
        onClose={() => setBankSheet(false)}
      />
    </View>
  );
}

export default function PortfolioScreen() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'holdings' | 'allocations'>('holdings');
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');

  React.useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(id);
  }, [query]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Header
          onSearchPress={() => {
            setSearchOpen((v) => !v);
            if (searchOpen) setQuery('');
          }}
        />
        <View style={styles.section}>
          <Text style={styles.title}>{t('portfolio.title')}</Text>
          {searchOpen && (
            <TextInput
              style={styles.searchInput}
              placeholder={t('search.inPortfolio')}
              placeholderTextColor={colors.textGray}
              value={query}
              onChangeText={setQuery}
              autoFocus
              autoCorrect={false}
            />
          )}
          <View style={{ marginTop: spacing(4) }}>
            <SolidSegment
              options={[
                { key: 'holdings', label: t('portfolio.holdings') },
                { key: 'allocations', label: t('portfolio.allocations') },
              ]}
              value={tab}
              onChange={(k) => setTab(k as 'holdings' | 'allocations')}
            />
          </View>
          <View style={{ marginTop: spacing(5) }}>
            {tab === 'holdings' ? (
              <HoldingsTab instrumentQuery={searchOpen ? debounced : ''} />
            ) : (
              <AllocationsTab />
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  section: { paddingHorizontal: spacing(5) },
  title: { fontFamily: font.bold, fontSize: 30, color: colors.textDark, marginTop: spacing(2) },
  searchInput: {
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: spacing(4.5),
    fontFamily: font.regular,
    fontSize: 15,
    color: colors.textDark,
    marginTop: spacing(3),
  },
  balanceLabel: {
    fontFamily: font.regular,
    fontSize: 15,
    color: colors.textGray,
    textAlign: 'center',
  },
  balanceBig: {
    fontFamily: font.bold,
    fontSize: 32,
    color: colors.textDark,
    textAlign: 'center',
    marginTop: spacing(1),
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing(4),
    // same horizontal inset as the card padding below
    paddingHorizontal: spacing(4),
  },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  filterChipText: { fontFamily: font.semibold, fontSize: 15, color: colors.primary },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sortText: { fontFamily: font.regular, fontSize: 14, color: colors.textGray },
  selectedRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2), marginTop: spacing(3) },
  selectedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 16,
    paddingHorizontal: spacing(3),
    height: 32,
    maxWidth: 220,
  },
  selectedChipText: { fontFamily: font.medium, fontSize: 13, color: colors.primary, flexShrink: 1 },
  bankCard: {
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.fieldBorder,
    padding: spacing(4),
  },
  bankRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
  bankName: { fontFamily: font.semibold, fontSize: 16, color: colors.textDark },
  bankAccounts: { fontFamily: font.regular, fontSize: 12, color: colors.textGray, marginTop: 2 },
  bankValue: { fontFamily: font.semibold, fontSize: 15, color: colors.textDark },
  bankDelta: { fontFamily: font.medium, fontSize: 12, marginTop: 2 },
  bankDetails: {
    marginTop: spacing(3),
    borderTopWidth: 1,
    borderTopColor: colors.fieldBorder,
    paddingTop: spacing(3),
    gap: spacing(3),
  },
  instRow: { flexDirection: 'row', alignItems: 'center' },
  instName: { fontFamily: font.medium, fontSize: 14, color: colors.textDark },
  instMeta: { fontFamily: font.regular, fontSize: 12, color: colors.textGray, marginTop: 1 },
  instValue: { fontFamily: font.semibold, fontSize: 14, color: colors.textDark },
  donutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(4),
    marginTop: spacing(5),
  },
  donutCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutLabel: { fontFamily: font.regular, fontSize: 13, color: colors.textGray },
  donutValue: {
    fontFamily: font.bold,
    fontSize: 17,
    color: colors.textDark,
    marginTop: 2,
  },
  legend: { flex: 1, gap: spacing(3) },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendName: { flex: 1, fontFamily: font.medium, fontSize: 14, color: colors.textDark },
  legendPct: { fontFamily: font.semibold, fontSize: 15, color: colors.textDark },
  colHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing(5),
    marginBottom: spacing(3),
    // same horizontal inset as the card padding — otherwise the columns drift
    paddingHorizontal: spacing(4),
  },
  colHeaderText: { fontFamily: font.regular, fontSize: 14, color: colors.textGray },
  colRight: { textAlign: 'right' },
  allocInstCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.fieldBorder,
    padding: spacing(4),
  },
});
