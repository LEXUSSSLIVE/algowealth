import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LEGAL } from '@/content/legal';
import { colors, font, spacing } from '@/theme/tokens';

export function LegalScreen({ kind }: { kind: 'privacy' | 'terms' }) {
  const router = useRouter();
  const title = kind === 'privacy' ? LEGAL.privacyTitle : LEGAL.termsTitle;
  const body = kind === 'privacy' ? LEGAL.privacy : LEGAL.terms;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing(10) }}>
        <View style={styles.header}>
          <Pressable style={styles.back} onPress={() => router.back()}>
            <ArrowLeft size={20} color="#FFFFFF" strokeWidth={2.2} />
          </Pressable>
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing(5), paddingTop: spacing(2) },
  back: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  title: {
    fontFamily: font.bold, fontSize: 28, color: colors.textDark,
    paddingHorizontal: spacing(5), marginTop: spacing(4),
  },
  body: {
    fontFamily: font.regular, fontSize: 15, lineHeight: 24, color: colors.textDark,
    paddingHorizontal: spacing(5), marginTop: spacing(4),
  },
});
