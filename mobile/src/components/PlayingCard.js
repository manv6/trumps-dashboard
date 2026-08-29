import React from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../theme';

export default function PlayingCard({ value, suit, onPress, disabled, highlighted, small }) {
  const suitColor = suit === '♥' || suit === '♦' ? colors.cardRed : colors.cardBlack;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || !onPress}
      activeOpacity={0.75}
      style={[
        styles.card,
        small && styles.cardSmall,
        highlighted && styles.highlighted,
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.corner, small && styles.cornerSmall, { color: suitColor }]}>{value}</Text>
      <Text style={[styles.suit, small && styles.suitSmall, { color: suitColor }]}>{suit}</Text>
      <Text style={[styles.corner, small && styles.cornerSmall, { color: suitColor }]}>{value}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 56,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#bbb',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    margin: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  cardSmall: { width: 40, height: 58 },
  highlighted: { borderWidth: 2, borderColor: colors.gold },
  disabled: { opacity: 0.45 },
  corner: { fontSize: 12, fontWeight: '700' },
  cornerSmall: { fontSize: 10 },
  suit: { fontSize: 26, fontWeight: '700' },
  suitSmall: { fontSize: 18 },
});
