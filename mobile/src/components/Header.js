import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';
import { useAuth } from '../AuthContext';

// Shared felt-green top bar: brand, screen context, user + logout.
export default function Header({ subtitle, onBack }) {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();

  return (
    <View style={[styles.bar, { paddingTop: insets.top + 8 }]}>
      <View style={styles.row}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} style={styles.back}>
            <Text style={styles.backText}>‹</Text>
          </TouchableOpacity>
        ) : null}
        <Text style={styles.spade}>♠</Text>
        <Text style={styles.brand}>Trumps</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.feltDark,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  back: { marginRight: 8, paddingHorizontal: 4 },
  backText: { color: '#fff', fontSize: 28, fontWeight: '700', marginTop: -4 },
  spade: { color: colors.goldLight, fontSize: 22, marginRight: 6 },
  brand: { color: '#fff', fontSize: 18, fontWeight: '800', letterSpacing: 0.5 },
  subChip: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginLeft: 10,
  },
  subChipText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  logout: { color: 'rgba(255,255,255,0.9)', fontWeight: '700', fontSize: 13 },
});
