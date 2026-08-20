import { Search } from 'lucide-react-native';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { BurgerMenu } from '@/components/burger-menu';
import { colors, font, spacing } from '@/theme/tokens';

/** Shared header of the authorized area: burger menu + search field (SPEC §5.4). */
export function Header({ onSearchPress }: { onSearchPress?: () => void }) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <View style={styles.wrap}>
      <Pressable style={styles.burger} onPress={() => setMenuOpen(true)} hitSlop={10}>
        <View style={[styles.bar, { width: 22 }]} />
        <View style={[styles.bar, { width: 14 }]} />
        <View style={[styles.bar, { width: 22 }]} />
      </Pressable>
      <Pressable style={styles.search} onPress={onSearchPress}>
        <Text style={styles.searchText}>{t('search.placeholder')}</Text>
        <Search size={20} color={colors.fieldIcon} strokeWidth={2} />
      </Pressable>
      <BurgerMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(4),
    paddingHorizontal: spacing(5),
    paddingTop: spacing(2),
    paddingBottom: spacing(3),
  },
  burger: { gap: 4, paddingVertical: 6 },
  bar: { height: 3, borderRadius: 2, backgroundColor: colors.primary },
  search: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: colors.fieldBorder,
    paddingHorizontal: spacing(4.5),
  },
  searchText: { fontFamily: font.regular, fontSize: 15, color: colors.textGray },
});
