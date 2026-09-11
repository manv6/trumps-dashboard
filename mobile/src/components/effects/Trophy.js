import React, { useRef, useEffect } from 'react';
import { Animated, Easing } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { night } from '../../theme';

// The end-of-game trophy from the Midnight design: a stroke trophy inside a
// glowing gold medallion, breathing gently.
export default function Trophy({ size = 64 }) {
  const glow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(glow, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(glow, { toValue: 0, duration: 1300, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [glow]);

  const icon = size * 0.47;
  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 1.5,
        borderColor: night.gold,
        backgroundColor: 'rgba(216,178,92,0.12)',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: night.gold,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.9,
        shadowRadius: 16,
        elevation: 12,
        transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] }) }],
      }}
    >
      <Svg width={icon} height={icon} viewBox="0 0 24 24" fill="none"
        stroke={night.gold} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
        <Path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
        <Path d="M4 22h16" />
        <Path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
        <Path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
        <Path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
      </Svg>
    </Animated.View>
  );
}
