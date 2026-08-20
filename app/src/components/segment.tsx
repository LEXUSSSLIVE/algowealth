import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, font } from '@/theme/tokens';

type Option = { key: string; label: string };

/** Segment with a white sliding pill on a gray track (period on Home/Portfolio). */
export function SlidingSegment({
  options,
  value,
  onChange,
}: {
  options: Option[];
  value: string;
  onChange: (key: string) => void;
}) {
  const [width, setWidth] = useState(0);
  const idx = Math.max(0, options.findIndex((o) => o.key === value));
  const cell = width / options.length;
  const x = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(x, {
      toValue: idx * cell,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [idx, cell, x]);

  return (
    <View style={styles.slidingWrap} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && (
        <Animated.View
          style={[styles.slidingPill, { width: cell - 8, transform: [{ translateX: Animated.add(x, new Animated.Value(4)) }] }]}
        />
      )}
      {options.map((o, i) => (
        <Pressable key={o.key} style={styles.slidingItem} onPress={() => onChange(o.key)}>
          <Text style={[styles.slidingLabel, i === idx && styles.slidingLabelActive]}>
            {o.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Segment with a blue filled pill (Holdings | Allocations). */
export function SolidSegment({
  options,
  value,
  onChange,
}: {
  options: Option[];
  value: string;
  onChange: (key: string) => void;
}) {
  return (
    <View style={styles.solidWrap}>
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            style={[styles.solidItem, active && styles.solidItemActive]}
            onPress={() => onChange(o.key)}
          >
            <Text style={[styles.solidLabel, active && styles.solidLabelActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  slidingWrap: {
    flexDirection: 'row',
    backgroundColor: colors.segmentBg,
    borderRadius: 14,
    height: 44,
    alignItems: 'center',
  },
  slidingPill: {
    position: 'absolute',
    left: 0,
    top: 4,
    bottom: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 11,
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  slidingItem: { flex: 1, alignItems: 'center', justifyContent: 'center', height: '100%' },
  slidingLabel: { fontFamily: font.medium, fontSize: 14, color: colors.textGray },
  slidingLabelActive: { color: colors.textDark, fontFamily: font.semibold },
  solidWrap: { flexDirection: 'row', gap: 8 },
  solidItem: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  solidItemActive: { backgroundColor: colors.primary },
  solidLabel: { fontFamily: font.semibold, fontSize: 16, color: colors.textGray },
  solidLabelActive: { color: '#FFFFFF' },
});
