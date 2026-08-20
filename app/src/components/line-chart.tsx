import React, { useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';

import { colors, font } from '@/theme/tokens';

export type ChartPoint = { value: number; label?: string };

type Props = {
  points: ChartPoint[];
  height?: number;
  grid?: boolean;
  gradient?: boolean;
  baseline?: boolean;
  tooltip?: boolean;
  formatValue?: (v: number) => string;
};

const PAD_Y = 0.1;

export function LineChart({
  points,
  height = 200,
  grid = false,
  gradient = true,
  baseline = false,
  tooltip = false,
  formatValue = (v) => v.toFixed(2),
}: Props) {
  const [width, setWidth] = useState(0);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const gradId = useRef(`grad-${Math.random().toString(36).slice(2)}`).current;

  const up = points.length < 2 || points[points.length - 1].value >= points[0].value;
  const color = up ? colors.green : colors.red;

  const geometry = useMemo(() => {
    if (width === 0 || points.length === 0) return null;
    const values = points.map((p) => p.value);
    let min = Math.min(...values);
    let max = Math.max(...values);
    if (min === max) {
      min -= 1;
      max += 1;
    }
    const span = max - min;
    min -= span * PAD_Y;
    max += span * PAD_Y;
    const x = (i: number) =>
      points.length === 1 ? width / 2 : (i / (points.length - 1)) * width;
    const y = (v: number) => height - ((v - min) / (max - min)) * height;
    const xy = points.map((p, i) => [x(i), y(p.value)] as const);
    const line = xy.map(([px, py], i) => `${i === 0 ? 'M' : 'L'}${px} ${py}`).join(' ');
    const area = `${line} L${xy[xy.length - 1][0]} ${height} L${xy[0][0]} ${height} Z`;
    return { xy, line, area, y };
  }, [width, points, height]);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => tooltip,
        onMoveShouldSetPanResponder: () => tooltip,
        onPanResponderGrant: (e) => pick(e.nativeEvent.locationX),
        onPanResponderMove: (e) => pick(e.nativeEvent.locationX),
        onPanResponderRelease: () => setActiveIdx(null),
        onPanResponderTerminate: () => setActiveIdx(null),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tooltip, width, points.length],
  );

  function pick(locationX: number) {
    if (points.length < 2 || width === 0) return;
    const idx = Math.round((locationX / width) * (points.length - 1));
    setActiveIdx(Math.max(0, Math.min(points.length - 1, idx)));
  }

  const active = activeIdx !== null && geometry ? geometry.xy[activeIdx] : null;

  return (
    <View
      style={{ height }}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      {...(tooltip ? responder.panHandlers : {})}
    >
      {geometry && (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity="0.25" />
              <Stop offset="1" stopColor={color} stopOpacity="0" />
            </LinearGradient>
          </Defs>
          {grid &&
            [0.2, 0.4, 0.6, 0.8].map((f) => (
              <Line
                key={f}
                x1={0}
                y1={height * f}
                x2={width}
                y2={height * f}
                stroke={colors.fieldBorder}
                strokeDasharray="4 6"
              />
            ))}
          {baseline && points.length > 0 && (
            <Line
              x1={0}
              y1={geometry.y(points[0].value)}
              x2={width}
              y2={geometry.y(points[0].value)}
              stroke={colors.textGray}
              strokeOpacity={0.5}
              strokeDasharray="3 5"
            />
          )}
          {gradient && points.length > 1 && <Path d={geometry.area} fill={`url(#${gradId})`} />}
          {points.length > 1 ? (
            <Path d={geometry.line} stroke={color} strokeWidth={2.2} fill="none" />
          ) : (
            <Circle cx={geometry.xy[0][0]} cy={geometry.xy[0][1]} r={4} fill={color} />
          )}
          {active && (
            <>
              <Line
                x1={active[0]}
                y1={0}
                x2={active[0]}
                y2={height}
                stroke={colors.textGray}
                strokeDasharray="3 5"
              />
              <Circle cx={active[0]} cy={active[1]} r={5} fill={color} stroke="#FFFFFF" strokeWidth={2} />
            </>
          )}
        </Svg>
      )}
      {active && activeIdx !== null && (
        <View
          style={[
            styles.bubble,
            {
              left: Math.max(0, Math.min(active[0] - 60, width - 120)),
              top: Math.max(0, active[1] - 48),
            },
          ]}
        >
          <Text style={styles.bubbleValue}>{formatValue(points[activeIdx].value)}</Text>
          {points[activeIdx].label && (
            <Text style={styles.bubbleLabel}>{points[activeIdx].label}</Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    position: 'absolute',
    width: 120,
    backgroundColor: colors.textDark,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  bubbleValue: { color: '#FFFFFF', fontFamily: font.semibold, fontSize: 12 },
  bubbleLabel: { color: '#C9CDD6', fontFamily: font.regular, fontSize: 10, marginTop: 1 },
});
