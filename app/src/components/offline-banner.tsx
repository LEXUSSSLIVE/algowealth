import NetInfo from '@react-native-community/netinfo';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { colors, font } from '@/theme/tokens';

export function OfflineBanner() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      setOffline(state.isConnected === false);
    });
    return unsub;
  }, []);

  if (!offline) return null;
  return (
    <Text style={[styles.banner, { paddingTop: insets.top + 4 }]}>
      {t('common.offline')}
    </Text>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    backgroundColor: colors.textDark,
    color: '#FFFFFF',
    fontFamily: font.medium,
    fontSize: 13,
    textAlign: 'center',
    paddingBottom: 8,
  },
});
