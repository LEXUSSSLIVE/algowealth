import { CircleCheck } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { PillButton } from '@/components/ui';
import { colors, font, radius, spacing } from '@/theme/tokens';

type Props = {
  visible: boolean;
  title: string;
  clearLabel: string;
  applyLabel: string;
  options: { key: string; label: string; sublabel?: string }[];
  selected: string[];
  onApply: (keys: string[]) => void;
  onClose: () => void;
};

/** Filter bottom-sheet with checkmarks (Choose Bank / Choose Instrument). */
export function MultiSelectSheet({
  visible,
  title,
  clearLabel,
  applyLabel,
  options,
  selected,
  onApply,
  onClose,
}: Props) {
  const [local, setLocal] = useState<string[]>(selected);
  const slide = useRef(new Animated.Value(400)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setLocal(selected);
      Animated.parallel([
        Animated.timing(slide, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.timing(fade, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      slide.setValue(400);
      fade.setValue(0);
    }
  }, [visible, selected, slide, fade]);

  function toggle(key: string) {
    setLocal((cur) =>
      cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key],
    );
  }

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, { opacity: fade }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <Animated.View style={[styles.sheet, { transform: [{ translateY: slide }] }]}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Pressable onPress={() => setLocal([])}>
            <Text style={styles.clear}>{clearLabel}</Text>
          </Pressable>
        </View>
        <ScrollView style={{ maxHeight: 320 }}>
          {options.map((o) => {
            const on = local.includes(o.key);
            return (
              <Pressable key={o.key} style={styles.row} onPress={() => toggle(o.key)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowLabel}>{o.label}</Text>
                  {!!o.sublabel && <Text style={styles.rowSublabel}>{o.sublabel}</Text>}
                </View>
                <View style={styles.checkSlot}>
                  {on && <CircleCheck size={24} color={colors.green} strokeWidth={2} />}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
        <View style={styles.footer}>
          <PillButton title={applyLabel} onPress={() => onApply(local)} />
        </View>
      </Animated.View>
    </Modal>
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
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingBottom: spacing(8),
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.textDark,
    marginTop: spacing(2),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing(5),
    paddingTop: spacing(5),
    paddingBottom: spacing(3),
  },
  title: { fontFamily: font.bold, fontSize: 20, color: colors.textDark },
  clear: { fontFamily: font.semibold, fontSize: 15, color: colors.primary },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing(5),
    paddingVertical: spacing(3),
  },
  rowLabel: {
    fontFamily: font.medium,
    fontSize: 17,
    color: colors.textDark,
    paddingRight: spacing(3),
  },
  rowSublabel: {
    fontFamily: font.regular,
    fontSize: 13,
    color: colors.textGray,
    marginTop: 2,
  },
  checkSlot: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    paddingHorizontal: spacing(5),
    paddingTop: spacing(3),
    borderTopWidth: 1,
    borderTopColor: colors.fieldBorder,
  },
});
