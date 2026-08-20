import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { PillButton } from '@/components/ui';
import { colors, font, spacing } from '@/theme/tokens';

export default function WelcomeScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(rise, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, [fade, rise]);

  return (
    <SafeAreaView style={styles.safe}>
      <Animated.View style={[styles.content, { opacity: fade, transform: [{ translateY: rise }] }]}>
        <Image
          source={require('../../assets/images/logo.png')}
          style={styles.logo}
          contentFit="contain"
        />
        <Text style={styles.title}>{t('welcome.title')}</Text>
        <Text style={styles.subtitle}>{t('welcome.subtitle')}</Text>
        <View style={styles.indicator} />
      </Animated.View>
      <View style={styles.footer}>
        <PillButton title={t('welcome.cta')} onPress={() => router.push('/login')} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing(8),
  },
  logo: { width: 280, height: 175, marginBottom: spacing(16) },
  title: {
    fontFamily: font.bold,
    fontSize: 28,
    lineHeight: 36,
    color: colors.textDark,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: font.regular,
    fontSize: 16,
    lineHeight: 22,
    color: colors.textGray,
    textAlign: 'center',
    marginTop: spacing(4),
  },
  indicator: {
    width: 56,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: spacing(8),
  },
  footer: { paddingHorizontal: spacing(6), paddingBottom: spacing(4) },
});
