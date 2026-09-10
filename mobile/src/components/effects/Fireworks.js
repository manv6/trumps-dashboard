import React, { useRef, useEffect, useMemo } from 'react';
import { View, Animated, Easing, StyleSheet, Dimensions } from 'react-native';

const { width: W, height: H } = Dimensions.get('window');

const COLORS = ['#ecd9ad', '#d8b25c', '#e0847a', '#7fc4ec', '#f6efdd', '#4caf7d'];
const CYCLE = 3200; // one full fireworks cycle, then it repeats

// A single spark flying out of a burst, with a touch of gravity.
function Spark({ delay, angle, dist, color, size, duration, loop = true }) {
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const seq = Animated.sequence([
      Animated.delay(delay),
      Animated.timing(t, { toValue: 1, duration, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(t, { toValue: 0, duration: 0, useNativeDriver: true }),
      Animated.delay(Math.max(0, CYCLE - delay - duration)),
    ]);
    const anim = loop ? Animated.loop(seq) : seq;
    anim.start();
    return () => anim.stop();
  }, [t, delay, duration, loop]);

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

// The bright core flash at the heart of each burst.
function Flash({ delay, color, loop = true }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const seq = Animated.sequence([
      Animated.delay(delay),
      Animated.timing(t, { toValue: 1, duration: 420, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(t, { toValue: 0, duration: 0, useNativeDriver: true }),
      Animated.delay(Math.max(0, CYCLE - delay - 420)),
    ]);
    const anim = loop ? Animated.loop(seq) : seq;
    anim.start();
    return () => anim.stop();
  }, [t, delay, loop]);
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: -30, top: -30,
        width: 60, height: 60, borderRadius: 30,
        backgroundColor: color,
        opacity: t.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.85, 0] }),
        transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.2, 2.6] }) }],
      }}
    />
  );
}

// Full-screen fireworks (pointer-transparent). Mount while celebrating.
// loop=true repeats forever; loop=false fires each burst once.
export default function Fireworks({ bursts = 6, sparksPerBurst = 16, loop = true }) {
  const config = useMemo(() => {
    const list = [];
    for (let b = 0; b < bursts; b++) {
      const cx = W * (0.15 + Math.random() * 0.7);
      const cy = H * (0.1 + Math.random() * 0.45);
      const delay = loop
        ? b * (CYCLE / (bursts + 1)) + Math.random() * 180
        : b * 300 + Math.random() * 120; // one-shot: quick volley
      const dist = 80 + Math.random() * 90;
      const color = COLORS[b % COLORS.length];
      const sparks = [];
      for (let s = 0; s < sparksPerBurst; s++) {
        const angle = (Math.PI * 2 * s) / sparksPerBurst + Math.random() * 0.3;
        sparks.push({
          angle,
          dist: dist * (0.7 + Math.random() * 0.6),
          size: 7 + Math.random() * 6,
          duration: 1100 + Math.random() * 400,
          color: Math.random() < 0.3 ? '#ffffff' : color,
        });
      }
      list.push({ cx, cy, delay, color, sparks });
    }
    return list;
  }, [bursts, sparksPerBurst, loop]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {config.map((burst, b) => (
        <View key={b} style={{ position: 'absolute', left: burst.cx, top: burst.cy }}>
          <Flash delay={burst.delay} color={burst.color} loop={loop} />
          {burst.sparks.map((s, i) => (
            <Spark key={i} delay={burst.delay + 60} loop={loop} {...s} />
          ))}
        </View>
      ))}
    </View>
  );
}
