import React from 'react';
import { Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { night } from '../theme';

const SIZES = {
  hand: { w: 80, h: 116, corner: 17, cornerSuit: 14, pip: 34, radius: 11, pad: 7 },
  table: { w: 68, h: 97, corner: 15, cornerSuit: 12, pip: 36, radius: 9, pad: 6 },
  mini: { w: 46, h: 66, corner: 11, cornerSuit: 9, pip: 20, radius: 7, pad: 4 },
};

// Midnight Lounge playing card: warm white gradient face, gold glow when
// highlighted (playable / winning), dimmed when not playable.
export default function PlayingCard({ value, suit, onPress, disabled, highlighted, size = 'hand' }) {
  const s = SIZES[size] || SIZES.hand;
  const suitColor = suit === '♥' || suit === '♦' ? night.cardRed : night.cardBlack;

  const card = (
    <LinearGradient
      colors={highlighted ? ['#ffffff', '#f3edda'] : [night.cardFace, night.cardFaceDim]}
      style={[
        styles.card,
        { width: s.w, height: s.h, borderRadius: s.radius, padding: s.pad },
        highlighted && styles.highlighted,
        disabled && styles.disabled,
      ]}
    >
      <Text style={{ color: suitColor, fontWeight: '700', fontSize: s.corner, lineHeight: s.corner + 1 }}>
        {value}
      </Text>
      <Text style={{ color: suitColor, fontWeight: '700', fontSize: s.cornerSuit, lineHeight: s.cornerSuit + 1, marginTop: -1 }}>
        {suit}
      </Text>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Text style={{ position: 'absolute', top: '38%', alignSelf: 'center', fontSize: s.pip, color: suitColor }}>
          {suit}
        </Text>
      </View>
    </LinearGradient>
  );

  if (!onPress) return card;
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.8}>
      {card}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.55,
    shadowRadius: 8,
    elevation: 6,
  },
  highlighted: {
    borderWidth: 1.5,
    borderColor: night.gold,
    shadowColor: night.gold,
    shadowOpacity: 0.8,
    shadowRadius: 12,
    elevation: 10,
  },
  disabled: { opacity: 0.45 },
});
