import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { night, displayFont } from '../theme';

// Midnight-styled exit menu. (The native Alert is a no-op on web, and this
// matches the design everywhere anyway.)
export default function ExitDialog({ visible, onClose, onLeave, canTerminate, onTerminate }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <View style={styles.panel}>
          <Text style={styles.title}>Έξοδος από το τραπέζι</Text>
          <Text style={styles.sub}>Τι θέλεις να κάνεις;</Text>

          <TouchableOpacity onPress={onLeave} activeOpacity={0.85} style={{ marginTop: 18 }}>
            <LinearGradient colors={[night.goldBright, night.gold, night.goldDark]} style={styles.btnGold}>
              <Text style={styles.btnGoldText}>ΕΞΟΔΟΣ</Text>
            </LinearGradient>
          </TouchableOpacity>

          {canTerminate && (
            <TouchableOpacity onPress={onTerminate} activeOpacity={0.8} style={[styles.btnDanger, { marginTop: 10 }]}>
              <Text style={styles.btnDangerText}>ΤΕΡΜΑΤΙΣΜΟΣ ΤΡΑΠΕΖΙΟΥ</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity onPress={onClose} activeOpacity={0.8} style={[styles.btnOutline, { marginTop: 10 }]}>
            <Text style={styles.btnOutlineText}>ΑΚΥΡΩΣΗ</Text>
          </TouchableOpacity>

          {canTerminate && (
            <Text style={styles.hint}>Ο τερματισμός κλείνει το τραπέζι οριστικά για όλους.</Text>
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(4,8,7,0.85)',
    alignItems: 'center', justifyContent: 'center', padding: 26,
  },
  panel: {
    alignSelf: 'stretch', maxWidth: 400,
    backgroundColor: night.panel, borderWidth: 1.5, borderColor: night.goldBorderStrong,
    borderRadius: 20, padding: 22,
  },
  title: { fontFamily: displayFont, color: night.text, fontSize: 22, textAlign: 'center' },
  sub: { color: night.muted, fontSize: 13, textAlign: 'center', marginTop: 5 },
  btnGold: { height: 50, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  btnGoldText: { color: '#241A05', fontWeight: '800', fontSize: 13, letterSpacing: 1 },
  btnDanger: {
    height: 48, borderRadius: 13, alignItems: 'center', justifyContent: 'center',
    backgroundColor: night.dangerBg, borderWidth: 1.5, borderColor: night.dangerBorder,
  },
  btnDangerText: { color: night.danger, fontWeight: '700', fontSize: 12, letterSpacing: 1 },
  btnOutline: {
    height: 48, borderRadius: 13, alignItems: 'center', justifyContent: 'center',
    backgroundColor: night.glass, borderWidth: 1.5, borderColor: night.goldBorderStrong,
  },
  btnOutlineText: { color: night.gold, fontWeight: '700', fontSize: 12, letterSpacing: 1 },
  hint: { color: night.mutedDark, fontSize: 11, textAlign: 'center', marginTop: 14 },
});
