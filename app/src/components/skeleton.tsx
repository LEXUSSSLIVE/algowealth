import React, { useEffect, useRef } from 'react';
import { Animated, type ViewStyle } from 'react-native';

import { colors } from '@/theme/tokens';

/** Pulsing gray placeholder (first load of lists, SPEC §6). */
export function Skeleton({ style }: { style?: ViewStyle }) {
  const pulse = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.5, duration: 600, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[
        { backgroundColor: colors.segmentBg, borderRadius: 14, opacity: pulse },
        style,
      ]}
    />
  );
}
