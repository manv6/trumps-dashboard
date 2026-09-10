import React, { useRef, useEffect } from 'react';
import { View, Animated, Easing, StyleSheet } from 'react-native';
import { night } from '../../theme';

// A god's ring, icon-style: a flat golden aureole centered behind the
// winner's head — a glowing 2D ring with a soft gold disc fill.
// Drop it inside a centered wrapper, BEFORE the avatar, sized larger
// than the avatar so the ring shows all around the head.
export default function Halo({ width = 70, style }) {
  const enter = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(enter, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }).start();
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [enter, pulse]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          width,
          height: width,
          borderRadius: width / 2,
          borderWidth: 3.5,
          borderColor: night.goldBright,
          backgroundColor: 'rgba(216,178,92,0.14)',
          shadowColor: night.gold,
          shadowOpacity: 1,
          shadowRadius: 13,
          shadowOffset: { width: 0, height: 0 },
          elevation: 12,
          opacity: enter,
          transform: [
            { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) },
            { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] }) },
          ],
        },
        style,
      ]}
    >
      {/* thin inner ring for icon-like definition */}
      <View
        style={{
          ...StyleSheet.absoluteFillObject,
          margin: 4,
          borderRadius: (width - 8) / 2,
          borderWidth: 1,
          borderColor: 'rgba(236,217,173,0.7)',
        }}
      />
    </Animated.View>
  );
}
