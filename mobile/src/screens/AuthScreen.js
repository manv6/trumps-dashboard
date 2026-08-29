import React, { useState } from 'react';
import {
  View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../AuthContext';
import { Btn, Card, Field } from '../components/UI';
import { colors } from '../theme';

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
    <KeyboardAvoidingView
      style={styles.page}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.spade}>♠</Text>
        <Text style={styles.title}>Trumps</Text>
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
            title={mode === 'login' ? 'Σύνδεση' : 'Εγγραφή'}
            onPress={submit}
            loading={loading}
            style={{ marginTop: 8 }}
          />
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.feltDark },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24 },
  spade: { fontSize: 44, color: colors.gold, textAlign: 'center' },
  title: { fontSize: 32, fontWeight: '800', color: '#fff', textAlign: 'center', marginTop: 4 },
  subtitle: { color: colors.textOnFelt, textAlign: 'center', marginTop: 6, marginBottom: 24 },
  card: { padding: 20 },
  tabs: { flexDirection: 'row', marginBottom: 16 },
  tab: {
    flex: 1, textAlign: 'center', paddingVertical: 10, fontWeight: '700',
    color: colors.textMuted, borderBottomWidth: 2, borderBottomColor: colors.divider,
  },
  tabActive: { color: colors.felt, borderBottomColor: colors.felt },
  error: { color: colors.error, marginBottom: 10, fontWeight: '600' },
  input: { marginBottom: 12 },
});
