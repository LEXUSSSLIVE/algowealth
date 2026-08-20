import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useSession } from '@/auth/session';
import { colors, font, spacing } from '@/theme/tokens';

// Temporary tab placeholder used during early development.
export function StubScreen({ title }: { title: string }) {
  const { t } = useTranslation();
  const { user } = useSession();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.hint}>{t('common.comingSoon')}</Text>
      {user && <Text style={styles.user}>{user.email}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(2),
  },
  title: { fontFamily: font.bold, fontSize: 24, color: colors.textDark },
  hint: { fontFamily: font.regular, fontSize: 15, color: colors.textGray },
  user: { fontFamily: font.regular, fontSize: 13, color: colors.textGray },
});
