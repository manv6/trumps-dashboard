import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { CARD_IMAGES, CARD_ASPECT } from './cardAssets';
import { night } from '../../theme';

// A real playing card: bundled public-domain artwork (proper pips and
// court faces), gold glow when highlighted, dimmed when not playable.
export default function CardView({ card, width = 92, highlighted, dimmed, style }) {
  const source = CARD_IMAGES[card.suit]?.[card.value];
  const height = Math.round(width * CARD_ASPECT);
  return (
    <View
      style={[
        styles.wrap,
        { width, height, borderRadius: width * 0.09 },
        highlighted && styles.highlighted,
        dimmed && styles.dimmed,
        style,
      ]}
    >
      <Image source={source} style={{ width, height }} resizeMode="contain" fadeDuration={0} />
      {highlighted && (
        <View pointerEvents="none" style={[styles.goldRim, { borderRadius: width * 0.09 }]} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#ffffff',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.55,
    shadowRadius: 9,
    elevation: 6,
  },
  highlighted: {
    shadowColor: night.gold,
    shadowOpacity: 0.9,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  goldRim: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2.5,
    borderColor: night.gold,
  },
  dimmed: { opacity: 0.45 },
});
