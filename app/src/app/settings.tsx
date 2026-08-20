import { useRouter } from 'expo-router';
import { ArrowLeft, Lock } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { ApiError } from '@/api/client';
import { useSession } from '@/auth/session';
import { FormField, PillButton, Toast } from '@/components/ui';
import { colors, font, radius, spacing } from '@/theme/tokens';

export default function SettingsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user, api, logout } = useSession();
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [newPw2, setNewPw2] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [deletePw, setDeletePw] = useState('');
  const [deleting, setDeleting] = useState(false);

  async function changePassword() {
    if (!oldPw || !newPw) return;
    if (newPw !== newPw2) {
      setToast(t('settings.passwordsDontMatch'));
      return;
    }
    setSaving(true);
    try {
      await api.post('/auth/change-password', {
        old_password: oldPw,
        new_password: newPw,
      });
      setOldPw(''); setNewPw(''); setNewPw2('');
      setToast(t('settings.passwordChanged'));
    } catch (e) {
      setToast(e instanceof ApiError ? e.message : t('common.error'));
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete() {
    if (!deletePw) return;
    Alert.alert(t('settings.deleteConfirmTitle'), t('settings.deleteConfirmText'), [
      { text: t('menu.cancel'), style: 'cancel' },
      {
        text: t('settings.delete'),
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await api.post('/me/delete', { password: deletePw });
            await logout();
          } catch (e) {
            setToast(e instanceof ApiError ? e.message : t('common.error'));
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing(10) }}>
        <View style={styles.header}>
          <Pressable style={styles.back} onPress={() => router.back()}>
            <ArrowLeft size={20} color="#FFFFFF" strokeWidth={2.2} />
          </Pressable>
          <Text style={styles.title}>{t('settings.title')}</Text>
        </View>

        <Text style={styles.sectionLabel}>{t('settings.account')}</Text>
        <View style={styles.card}>
          <Text style={styles.email}>{user?.email}</Text>
        </View>

        <Text style={styles.sectionLabel}>{t('settings.changePassword')}</Text>
        <View style={[styles.card, { gap: spacing(3) }]}>
          <FormField icon={Lock} placeholder={t('settings.oldPassword')}
                     value={oldPw} onChangeText={setOldPw} secureTextEntry />
          <FormField icon={Lock} placeholder={t('settings.newPassword')}
                     value={newPw} onChangeText={setNewPw} secureTextEntry />
          <FormField icon={Lock} placeholder={t('settings.newPassword2')}
                     value={newPw2} onChangeText={setNewPw2} secureTextEntry />
          <PillButton title={t('settings.save')} onPress={changePassword} loading={saving} />
        </View>

        <Text style={styles.sectionLabel}>{t('settings.dangerZone')}</Text>
        <View style={[styles.card, { gap: spacing(3) }]}>
          <Text style={styles.deleteHint}>{t('settings.deleteHint')}</Text>
          <FormField icon={Lock} placeholder={t('settings.oldPassword')}
                     value={deletePw} onChangeText={setDeletePw} secureTextEntry />
          <Pressable
            style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.85 }]}
            disabled={deleting}
            onPress={confirmDelete}>
            <Text style={styles.deleteBtnText}>{t('settings.deleteAccount')}</Text>
          </Pressable>
        </View>
      </ScrollView>
      {toast && <Toast message={toast} onHide={() => setToast(null)} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: spacing(3),
    paddingHorizontal: spacing(5), paddingTop: spacing(2),
  },
  back: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontFamily: font.bold, fontSize: 24, color: colors.textDark },
  sectionLabel: {
    fontFamily: font.medium, fontSize: 13, color: colors.textGray,
    marginTop: spacing(6), marginBottom: spacing(2), paddingHorizontal: spacing(5),
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  card: {
    marginHorizontal: spacing(5), borderRadius: radius.card,
    borderWidth: 1, borderColor: colors.fieldBorder, padding: spacing(4),
  },
  email: { fontFamily: font.semibold, fontSize: 16, color: colors.textDark },
  deleteHint: { fontFamily: font.regular, fontSize: 13, color: colors.textGray },
  deleteBtn: {
    height: 52, borderRadius: radius.button, backgroundColor: colors.red,
    alignItems: 'center', justifyContent: 'center',
  },
  deleteBtnText: { color: '#FFFFFF', fontFamily: font.semibold, fontSize: 16 },
});
