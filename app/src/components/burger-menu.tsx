import { useRouter } from 'expo-router';
import { FileText, LogOut, Settings, Shield } from 'lucide-react-native';
import React, { useEffect, useRef } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useSession } from '@/auth/session';
import { colors, font, spacing } from '@/theme/tokens';

const PANEL_WIDTH = Math.round(Dimensions.get('window').width * 0.8);

/** Slide-in left panel (SPEC §5.4: email, Privacy/Terms, Settings, Logout). */
export function BurgerMenu({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, logout } = useSession();
  const insets = useSafeAreaInsets();
  const slide = useRef(new Animated.Value(-PANEL_WIDTH)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slide, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.timing(fade, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      slide.setValue(-PANEL_WIDTH);
      fade.setValue(0);
    }
  }, [visible, slide, fade]);

  function go(path: '/privacy' | '/terms' | '/settings') {
    onClose();
    router.push(path);
  }

  function confirmLogout() {
    Alert.alert(t('menu.logoutTitle'), undefined, [
      { text: t('menu.cancel'), style: 'cancel' },
      {
        text: t('menu.logout'),
        style: 'destructive',
        onPress: () => {
          onClose();
          logout();
        },
      },
    ]);
  }

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, { opacity: fade }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <Animated.View style={[styles.panel, { transform: [{ translateX: slide }] }]}>
        <View
          style={[
            styles.panelInner,
            { paddingTop: insets.top + spacing(3), paddingBottom: insets.bottom + spacing(3) },
          ]}
        >
          <Text style={styles.email}>{user?.email}</Text>
          <View style={styles.items}>
            <MenuItem icon={<Shield size={22} color={colors.textDark} strokeWidth={1.8} />}
                      label={t('menu.privacy')} onPress={() => go('/privacy')} />
            <MenuItem icon={<FileText size={22} color={colors.textDark} strokeWidth={1.8} />}
                      label={t('menu.terms')} onPress={() => go('/terms')} />
          </View>
          <View style={styles.bottom}>
            <MenuItem icon={<Settings size={22} color={colors.textDark} strokeWidth={1.8} />}
                      label={t('menu.settings')} onPress={() => go('/settings')} />
            <MenuItem icon={<LogOut size={22} color={colors.red} strokeWidth={1.8} />}
                      label={t('menu.logout')} labelColor={colors.red} onPress={confirmLogout} />
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
}

function MenuItem({
  icon,
  label,
  labelColor = colors.textDark,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  labelColor?: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.item} onPress={onPress}>
      {icon}
      <Text style={[styles.itemLabel, { color: labelColor }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.overlay,
  },
  panel: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: PANEL_WIDTH,
    backgroundColor: '#FFFFFF',
    borderTopRightRadius: 24,
    borderBottomRightRadius: 24,
  },
  panelInner: { flex: 1, paddingHorizontal: spacing(6) },
  email: {
    fontFamily: font.semibold,
    fontSize: 16,
    color: colors.textDark,
    marginTop: spacing(4),
  },
  items: { marginTop: spacing(8), gap: spacing(2) },
  bottom: { marginTop: 'auto', gap: spacing(2) },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3.5),
    paddingVertical: spacing(3),
  },
  itemLabel: { fontFamily: font.medium, fontSize: 16 },
});
