import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CARD_ASPECT } from './cardAssets';
import { night } from '../../theme';

// Midnight card back: deep navy with a gold frame and spade medallion.
export default function CardBack({ width = 92, style }) {
  const height = Math.round(width * CARD_ASPECT);
  return (
    <View style={[styles.wrap, { width, height, borderRadius: width * 0.09 }, style]}>
      <LinearGradient
        colors={['#1c3a52', '#122636', '#0c1a26']}
        style={[StyleSheet.absoluteFill, { borderRadius: width * 0.09 }]}
      />
      <View style={[styles.frame, { borderRadius: width * 0.06, margin: width * 0.07 }]} />
      <View style={[styles.medallion, { width: width * 0.44, height: width * 0.44, borderRadius: width * 0.22 }]}>
        <Text style={{ color: night.gold, fontSize: width * 0.26, marginTop: -width * 0.015 }}>♠</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(216,178,92,0.55)',
  },
  frame: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: 'rgba(216,178,92,0.45)',
  },
  medallion: {
    borderWidth: 1.5,
    borderColor: 'rgba(216,178,92,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(216,178,92,0.08)',
  },
});
