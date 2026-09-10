import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { night, displayFont } from '../theme';
import { useAuth } from '../AuthContext';

// Midnight Lounge top bar: gold TRUMPS brand, screen context, logout.
export default function Header({ subtitle, onBack }) {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();

  return (
    <LinearGradient colors={['#060b0a', '#0d1a17']} style={[styles.bar, { paddingTop: insets.top + 8 }]}>
      <View style={styles.row}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} style={styles.back} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.backText}>‹</Text>
          </TouchableOpacity>
        ) : null}
        <Text style={styles.spade}>♠</Text>
        <Text style={styles.brand}>TRUMPS</Text>
        {subtitle ? (
          <View style={styles.subChip}>
            <Text style={styles.subChipText}>{subtitle}</Text>
          </View>
        ) : null}
        <View style={{ flex: 1 }} />
        {user ? (
          <TouchableOpacity onPress={logout} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.logout}>Έξοδος</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(216,178,92,0.25)',
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  back: { marginRight: 8, paddingHorizontal: 4 },
  backText: { color: night.text, fontSize: 28, fontWeight: '700', marginTop: -4 },
  spade: { color: night.gold, fontSize: 20, marginRight: 7 },
  brand: { fontFamily: displayFont, color: night.gold, fontSize: 17, letterSpacing: 3 },
  subChip: {
    backgroundColor: night.glass,
    borderWidth: 1,
    borderColor: night.goldBorder,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginLeft: 10,
  },
  subChipText: { color: night.text, fontSize: 11, fontWeight: '600' },
  logout: { color: night.muted, fontWeight: '700', fontSize: 13 },
});
