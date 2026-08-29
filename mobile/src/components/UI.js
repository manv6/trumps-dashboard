import React from 'react';
import { Text, TextInput, TouchableOpacity, View, StyleSheet, ActivityIndicator } from 'react-native';
import { colors, radius, shadow } from '../theme';

// Small shared building blocks so every screen looks the same.

export function Btn({ title, onPress, variant = 'primary', disabled, loading, style, small }) {
  const base = [styles.btn, small && styles.btnSmall, styles[`btn_${variant}`], disabled && styles.btnDisabled, style];
  const textStyle = [styles.btnText, small && styles.btnTextSmall, styles[`btnText_${variant}`]];
  return (
    <TouchableOpacity style={base} onPress={onPress} disabled={disabled || loading} activeOpacity={0.8}>
      {loading
        ? <ActivityIndicator color={variant === 'primary' ? '#fff' : colors.felt} />
        : <Text style={textStyle}>{title}</Text>}
    </TouchableOpacity>
  );
}

export function Chip({ label, color = colors.divider, textColor = colors.text, style }) {
  return (
    <View style={[styles.chip, { backgroundColor: color }, style]}>
      <Text style={[styles.chipText, { color: textColor }]}>{label}</Text>
    </View>
  );
}

export function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Field(props) {
  return (
    <TextInput
      placeholderTextColor={colors.textMuted}
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
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSmall: { paddingVertical: 8, paddingHorizontal: 12 },
  btn_primary: { backgroundColor: colors.felt },
  btn_gold: { backgroundColor: colors.gold },
  btn_outline: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.felt },
  btn_danger: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.error },
  btnDisabled: { opacity: 0.45 },
  btnText: { fontWeight: '700', fontSize: 16 },
  btnTextSmall: { fontSize: 13 },
  btnText_primary: { color: '#fff' },
  btnText_gold: { color: '#241A05' },
  btnText_outline: { color: colors.felt },
  btnText_danger: { color: colors.error },
  chip: {
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
    alignSelf: 'flex-start',
  },
  chipText: { fontWeight: '600', fontSize: 12 },
  card: {
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: 16,
    ...shadow,
  },
  field: {
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    color: colors.text,
  },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: 10 },
});
