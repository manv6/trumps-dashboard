import React, { useRef, useEffect } from 'react';
import { Animated, Easing } from 'react-native';
import { night } from '../../theme';

// A god's ring: a glowing golden halo that drops in above a winner's head,
// then hovers with a gentle bob and shimmer.
export default function Halo({ width = 44, style }) {
  const enter = useRef(new Animated.Value(0)).current;
  const bob = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(enter, { toValue: 1, friction: 6, tension: 70, useNativeDriver: true }).start();
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(bob, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(bob, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [enter, bob]);

  const height = Math.round(width * 0.34);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          width,
          height,
          borderRadius: width / 2,
          borderWidth: 3.5,
          borderColor: night.goldBright,
          backgroundColor: 'transparent',
          shadowColor: night.gold,
          shadowOpacity: 0.95,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 0 },
          elevation: 12,
          opacity: enter.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }),
          transform: [
            { translateY: Animated.add(
                enter.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }),
                bob.interpolate({ inputRange: [0, 1], outputRange: [0, -3.5] })
              ) },
            { scaleY: 0.85 },
          ],
        },
        style,
      ]}
    />
  );
}
