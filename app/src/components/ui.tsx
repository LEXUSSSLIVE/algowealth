import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

import { colors, font, radius, spacing } from '@/theme/tokens';

export function PillButton({
  title,
  onPress,
  loading,
  disabled,
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        pressed && { backgroundColor: colors.primaryPressed, transform: [{ scale: 0.98 }] },
        (disabled || loading) && { opacity: 0.7 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <Text style={styles.buttonText}>{title}</Text>
      )}
    </Pressable>
  );
}

export function FormField({
  icon: Icon,
  ...inputProps
}: TextInputProps & { icon: LucideIcon }) {
  const [focused, setFocused] = React.useState(false);
  return (
    <View style={[styles.field, focused && { borderColor: colors.primary }]}>
      <Icon size={20} color={colors.fieldIcon} strokeWidth={1.8} />
      <TextInput
        style={styles.fieldInput}
        placeholderTextColor={colors.textGray}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        {...inputProps}
      />
    </View>
  );
}

export function Toast({ message, onHide }: { message: string; onHide: () => void }) {
  const slide = useRef(new Animated.Value(-80)).current;

  useEffect(() => {
    Animated.timing(slide, { toValue: 0, duration: 250, useNativeDriver: true }).start();
    const timer = setTimeout(() => {
      Animated.timing(slide, { toValue: -80, duration: 250, useNativeDriver: true }).start(onHide);
    }, 4000);
    return () => clearTimeout(timer);
  }, [slide, onHide]);

  return (
    <Animated.View style={[styles.toast, { transform: [{ translateY: slide }] }]}>
      <Text style={styles.toastText}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 56,
    borderRadius: radius.button,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontFamily: font.semibold,
    fontSize: 17,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    height: 54,
    borderRadius: radius.field,
    borderWidth: 1,
    borderColor: colors.fieldBorder,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing(5),
  },
  fieldInput: {
    flex: 1,
    fontFamily: font.regular,
    fontSize: 16,
    color: colors.textDark,
  },
  toast: {
    position: 'absolute',
    top: 0,
    left: spacing(4),
    right: spacing(4),
    zIndex: 10,
    backgroundColor: colors.red,
    borderRadius: 14,
    paddingVertical: spacing(3.5),
    paddingHorizontal: spacing(4),
  },
  toastText: {
    color: '#FFFFFF',
    fontFamily: font.medium,
    fontSize: 14,
    textAlign: 'center',
  },
});
