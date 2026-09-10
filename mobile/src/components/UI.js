import React from 'react';
import { Text, TextInput, TouchableOpacity, View, StyleSheet, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { night } from '../theme';

// Midnight Lounge shared building blocks — every screen uses these so the
// whole app reads as one design.

// Full-screen night backdrop: place first inside a flex:1 page View.
export function PageBg() {
  return (
    <LinearGradient
      colors={[night.bgTop, night.bgMid, night.bgBottom]}
      style={StyleSheet.absoluteFill}
    />
  );
}

export function Btn({ title, onPress, variant = 'primary', disabled, loading, style, small }) {
  if (variant === 'primary' || variant === 'gold') {
    return (
      <TouchableOpacity onPress={onPress} disabled={disabled || loading} activeOpacity={0.85} style={style}>
        <LinearGradient
          colors={disabled ? ['#3a3428', '#2a251b'] : [night.goldBright, night.gold, night.goldDark]}
          style={[styles.btn, small && styles.btnSmall, !disabled && styles.btnGoldGlow]}
        >
          {loading
            ? <ActivityIndicator color="#241A05" />
            : <Text style={[styles.btnGoldText, small && styles.btnTextSmall, disabled && { color: night.mutedDark }]}>{title}</Text>}
        </LinearGradient>
      </TouchableOpacity>
    );
  }
  const isDanger = variant === 'danger';
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={[styles.btn, small && styles.btnSmall, styles.btnOutline, isDanger && styles.btnDanger, disabled && { opacity: 0.45 }, style]}
    >
      {loading
        ? <ActivityIndicator color={isDanger ? night.danger : night.gold} />
        : <Text style={[styles.btnOutlineText, small && styles.btnTextSmall, isDanger && { color: night.danger }]}>{title}</Text>}
    </TouchableOpacity>
  );
}

export function Chip({ label, gold, danger, style, textStyle }) {
  return (
    <View style={[styles.chip, gold && styles.chipGold, danger && styles.chipDanger, style]}>
      <Text style={[styles.chipText, gold && styles.chipTextGold, danger && styles.chipTextDanger, textStyle]}>{label}</Text>
    </View>
  );
}

export function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Field(props) {
  return (
    <TextInput
      placeholderTextColor={night.mutedDark}
      style={[styles.field, props.style]}
      {...props}
    />
  );
}

export function SectionTitle({ children, style }) {
  return <Text style={[styles.sectionTitle, style]}>{children}</Text>;
}

const styles = StyleSheet.create({
  btn: {
    height: 52,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  btnSmall: { height: 38, borderRadius: 10, paddingHorizontal: 13 },
  btnGoldGlow: {
    shadowColor: night.gold, shadowOpacity: 0.4, shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 }, elevation: 7,
  },
  btnGoldText: { color: '#241A05', fontWeight: '800', fontSize: 14, letterSpacing: 1 },
  btnOutline: {
    backgroundColor: night.glass,
    borderWidth: 1.5,
    borderColor: night.goldBorderStrong,
  },
  btnDanger: { borderColor: night.dangerBorder, backgroundColor: night.dangerBg },
  btnOutlineText: { color: night.gold, fontWeight: '700', fontSize: 13, letterSpacing: 1 },
  btnTextSmall: { fontSize: 12 },
  chip: {
    backgroundColor: night.glass,
    borderWidth: 1,
    borderColor: night.goldBorder,
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 11,
    alignSelf: 'flex-start',
  },
  chipGold: { backgroundColor: night.goldSoft, borderColor: night.gold },
  chipDanger: { backgroundColor: night.dangerBg, borderColor: night.dangerBorder },
  chipText: { color: night.text, fontWeight: '600', fontSize: 12 },
  chipTextGold: { color: night.gold, fontWeight: '700' },
  chipTextDanger: { color: night.danger },
  card: {
    backgroundColor: night.glassDim,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(216,178,92,0.25)',
    padding: 16,
  },
  field: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 1,
    borderColor: night.goldBorder,
    borderRadius: 11,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    color: night.text,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: night.text, marginBottom: 10, letterSpacing: 0.3 },
});
