import React, { useState } from 'react';
import {
  View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../AuthContext';
import { Btn, Card, Field, PageBg } from '../components/UI';
import { night, displayFont } from '../theme';

export default function AuthScreen() {
  const { login, register } = useAuth();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ username: '', email: '', password: '', confirm: '' });

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async () => {
    setError('');
    if (mode === 'register') {
      if (form.password !== form.confirm) return setError('Οι κωδικοί δεν ταιριάζουν');
      if (form.password.length < 6) return setError('Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες');
    }
    setLoading(true);
    const result = mode === 'login'
      ? await login(form.email.trim(), form.password)
      : await register(form.username.trim(), form.email.trim(), form.password);
    if (!result.success) setError(result.error);
    setLoading(false);
  };

  return (
    <View style={styles.page}>
      <PageBg />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 44, paddingBottom: insets.bottom + 40 }]}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.spade}>♠</Text>
          <Text style={styles.title}>TRUMPS</Text>
          <Text style={styles.subtitle}>Παίξε ή κράτα σκορ με την παρέα σου — online</Text>

          <Card style={styles.card}>
            <View style={styles.tabs}>
              {['login', 'register'].map((m) => (
                <Text
                  key={m}
                  onPress={() => { setMode(m); setError(''); }}
                  style={[styles.tab, mode === m && styles.tabActive]}
                >
                  {m === 'login' ? 'Σύνδεση' : 'Εγγραφή'}
                </Text>
              ))}
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            {mode === 'register' && (
              <Field
                placeholder="Όνομα Χρήστη"
                value={form.username}
                onChangeText={set('username')}
                autoCapitalize="none"
                style={styles.input}
              />
            )}
            <Field
              placeholder="Email"
              value={form.email}
              onChangeText={set('email')}
              autoCapitalize="none"
              keyboardType="email-address"
              style={styles.input}
            />
            <Field
              placeholder="Κωδικός"
              value={form.password}
              onChangeText={set('password')}
              secureTextEntry
              style={styles.input}
            />
            {mode === 'register' && (
              <Field
                placeholder="Επιβεβαίωση Κωδικού"
                value={form.confirm}
                onChangeText={set('confirm')}
                secureTextEntry
                style={styles.input}
              />
            )}

            <Btn
              title={mode === 'login' ? 'ΣΥΝΔΕΣΗ' : 'ΕΓΓΡΑΦΗ'}
              onPress={submit}
              loading={loading}
              style={{ marginTop: 8 }}
            />
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: night.bgBottom },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24 },
  spade: { fontSize: 46, color: night.gold, textAlign: 'center' },
  title: { fontFamily: displayFont, fontSize: 34, color: night.text, textAlign: 'center', letterSpacing: 6, marginTop: 4 },
  subtitle: { color: night.muted, textAlign: 'center', marginTop: 8, marginBottom: 26, fontSize: 13 },
  card: { padding: 20, backgroundColor: 'rgba(16,26,23,0.85)', borderColor: night.goldBorder },
  tabs: { flexDirection: 'row', marginBottom: 16 },
  tab: {
    flex: 1, textAlign: 'center', paddingVertical: 11, fontWeight: '700',
    color: night.mutedDark, borderBottomWidth: 2, borderBottomColor: 'rgba(216,178,92,0.2)',
  },
  tabActive: { color: night.gold, borderBottomColor: night.gold },
  error: { color: night.danger, marginBottom: 10, fontWeight: '600' },
  input: { marginBottom: 12 },
});
