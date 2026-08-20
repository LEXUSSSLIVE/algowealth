import { useRouter } from 'expo-router';
import { ArrowLeft, Mail } from 'lucide-react-native';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useSession } from '@/auth/session';
import { FormField, PillButton } from '@/components/ui';
import { colors, font, spacing } from '@/theme/tokens';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { api } = useSession();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit() {
    if (!email.trim()) return;
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email: email.trim() });
    } catch {
      // The response is unconditional — never disclose whether the email exists (SPEC §5.3)
    } finally {
      setLoading(false);
      setSent(true);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <Pressable style={styles.back} onPress={() => router.back()}>
        <ArrowLeft size={20} color="#FFFFFF" strokeWidth={2.2} />
      </Pressable>
      <View style={styles.content}>
        <Text style={styles.title}>{t('forgot.title')}</Text>
        {sent ? (
          <Text style={styles.sent}>{t('forgot.sent')}</Text>
        ) : (
          <>
            <FormField
              icon={Mail}
              placeholder={t('login.emailPlaceholder')}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <PillButton title={t('forgot.submit')} onPress={submit} loading={loading} />
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
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
  content: {
    flex: 1,
    paddingHorizontal: spacing(6),
    paddingTop: spacing(12),
    gap: spacing(4),
  },
  title: {
    fontFamily: font.semibold,
    fontSize: 22,
    lineHeight: 30,
    color: colors.textDark,
  },
  sent: {
    fontFamily: font.regular,
    fontSize: 16,
    lineHeight: 23,
    color: colors.textGray,
  },
});
