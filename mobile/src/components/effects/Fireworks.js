import React, { useRef, useEffect, useMemo } from 'react';
import { View, Animated, Easing, StyleSheet, Dimensions } from 'react-native';

const { width: W, height: H } = Dimensions.get('window');

const COLORS = ['#ecd9ad', '#d8b25c', '#e0847a', '#7fc4ec', '#f6efdd', '#4caf7d'];
const CYCLE = 3200; // one full fireworks cycle, then it repeats

// A single spark flying out of a burst, with a touch of gravity.
function Spark({ delay, angle, dist, color, size, duration }) {
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(t, { toValue: 1, duration, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(t, { toValue: 0, duration: 0, useNativeDriver: true }),
        Animated.delay(Math.max(0, CYCLE - delay - duration)),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [t, delay, duration]);

  const dx = Math.cos(angle) * dist;
  const dy = Math.sin(angle) * dist;

  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        shadowColor: color,
        shadowOpacity: 0.9,
        shadowRadius: 5,
        shadowOffset: { width: 0, height: 0 },
        opacity: t.interpolate({ inputRange: [0, 0.08, 0.7, 1], outputRange: [0, 1, 0.9, 0] }),
        transform: [
          { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, dx] }) },
          // ease out, then sag a little at the end: gravity
          { translateY: t.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0, dy * 0.85, dy + 34] }) },
          { scale: t.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0.4, 1, 0.25] }) },
        ],
      }}
    />
  );
}

// Full-screen looping fireworks (pointer-transparent). Mount while celebrating.
export default function Fireworks({ bursts = 5, sparksPerBurst = 12 }) {
  const config = useMemo(() => {
    const list = [];
    for (let b = 0; b < bursts; b++) {
      const cx = W * (0.18 + Math.random() * 0.64);
      const cy = H * (0.12 + Math.random() * 0.38);
      const delay = b * (CYCLE / (bursts + 1)) + Math.random() * 180;
      const dist = 60 + Math.random() * 70;
      const color = COLORS[b % COLORS.length];
      const sparks = [];
      for (let s = 0; s < sparksPerBurst; s++) {
        const angle = (Math.PI * 2 * s) / sparksPerBurst + Math.random() * 0.35;
        sparks.push({
          angle,
          dist: dist * (0.75 + Math.random() * 0.5),
          size: 5 + Math.random() * 4,
          duration: 1050 + Math.random() * 350,
          color: Math.random() < 0.25 ? '#ffffff' : color,
        });
      }
      list.push({ cx, cy, delay, sparks });
    }
    return list;
  }, [bursts, sparksPerBurst]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {config.map((burst, b) => (
        <View key={b} style={{ position: 'absolute', left: burst.cx, top: burst.cy }}>
          {burst.sparks.map((s, i) => (
            <Spark key={i} delay={burst.delay} {...s} />
          ))}
        </View>
      ))}
    </View>
  );
}
