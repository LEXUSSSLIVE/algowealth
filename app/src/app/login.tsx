import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ArrowLeft, Lock, Mail } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import { ApiError } from '@/api/client';
import { useSession } from '@/auth/session';
import { FormField, PillButton, Toast } from '@/components/ui';
import { colors, font, radius, spacing } from '@/theme/tokens';

const HEADER_HEIGHT = 300;

function HeaderWave() {
  return (
    <View style={styles.header}>
      <Svg
        width="100%"
        height={HEADER_HEIGHT}
        viewBox="0 0 375 300"
        preserveAspectRatio="none"
        style={StyleSheet.absoluteFill}
      >
        <Path
          d="M0 0 H375 V120 C300 210 210 260 120 262 C70 263 25 250 0 232 Z"
          fill={colors.headerLight}
        />
      </Svg>
      <Image
        source={require('../../assets/images/logo.png')}
        style={styles.headerLogo}
        contentFit="contain"
      />
    </View>
  );
}

export default function LoginScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { login } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!email.trim() || !password) return;
    setLoading(true);
    setError(null);
    try {
      await login(email.trim(), password);
      // Navigation happens automatically: Stack.Protected switches to (tabs)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('common.error'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.screen}>
      <HeaderWave />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <Pressable style={styles.back} onPress={() => router.back()}>
          <ArrowLeft size={20} color="#FFFFFF" strokeWidth={2.2} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.appName}>{t('login.appName')}</Text>
          <Text style={styles.slogan}>{t('login.slogan')}</Text>
        </View>
        <KeyboardAvoidingView
          style={styles.form}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <FormField
            icon={Mail}
            placeholder={t('login.emailPlaceholder')}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
          />
          <FormField
            icon={Lock}
            placeholder={t('login.passwordPlaceholder')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
          />
          <Pressable onPress={() => router.push('/forgot-password')}>
            <Text style={styles.forgot}>{t('login.forgot')}</Text>
          </Pressable>
          <PillButton title={t('login.submit')} onPress={submit} loading={loading} />
        </KeyboardAvoidingView>
      </SafeAreaView>
      {error && <Toast message={error} onHide={() => setError(null)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  safe: { flex: 1 },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: HEADER_HEIGHT,
  },
  headerLogo: {
    position: 'absolute',
    right: spacing(4),
    top: spacing(10),
    width: 230,
    height: 144,
  },
  back: {
    marginLeft: spacing(5),
    marginTop: spacing(2),
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    marginLeft: spacing(6),
    marginTop: spacing(6),
  },
  appName: {
    fontFamily: font.bold,
    fontSize: 30,
    color: '#FFFFFF',
  },
  slogan: {
    fontFamily: font.medium,
    fontSize: 13,
    color: '#FFFFFF',
    marginTop: spacing(1.5),
    maxWidth: 200,
  },
  form: {
    flex: 1,
    marginTop: HEADER_HEIGHT - 190,
    paddingHorizontal: spacing(6),
    gap: spacing(4),
    justifyContent: 'flex-start',
    paddingTop: spacing(20),
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    backgroundColor: colors.bg,
  },
  forgot: {
    alignSelf: 'flex-end',
    color: colors.primary,
    fontFamily: font.medium,
    fontSize: 14,
    marginBottom: spacing(2),
  },
});
