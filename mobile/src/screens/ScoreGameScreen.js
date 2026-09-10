import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, ActivityIndicator,
} from 'react-native';
import io from 'socket.io-client';
import { useAuth } from '../AuthContext';
import { SERVER_URL } from '../config';
import Header from '../components/Header';
import { Btn, Card, Chip, SectionTitle } from '../components/UI';
import { colors } from '../theme';

// Scoreboard mode, mobile-optimized: instead of the huge web table, the phone
// focuses on ONE round at a time (your Π/Μ inputs + everyone's values) with
// manual round navigation — same socket protocol as the web app.
export default function ScoreGameScreen({ route, navigation }) {
  const { gameId } = route.params;
  const { user, joinGame } = useAuth();

  const [gameData, setGameData] = useState(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewRound, setViewRound] = useState(null); // null = follow currentRound
  const [drafts, setDrafts] = useState({}); // local input values keyed `${type}-${round}`
  const socketRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await joinGame(gameId);
      if (cancelled) return;
      if (!result.success) {
        setError(result.error || 'Το παιχνίδι δεν βρέθηκε');
        setLoading(false);
        return;
      }
      setGameData(result.game);
      setLoading(false);

      const socket = io(SERVER_URL);
      socketRef.current = socket;
      socket.on('connect', () => {
        setConnected(true);
        socket.emit('join-game', { gameId, userId: user.id, username: user.username });
      });
      socket.on('disconnect', () => setConnected(false));
      socket.on('game-state', (g) => setGameData(g));
      socket.on('error', (msg) => setError(typeof msg === 'string' ? msg : 'Κάτι πήγε στραβά'));
    })();
    return () => {
      cancelled = true;
      if (socketRef.current) socketRef.current.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, user.id]);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(''), 4000);
    return () => clearTimeout(t);
  }, [error]);

  const sendAction = useCallback((action, payload = {}) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('game-action', { gameId, action, payload });
    }
  }, [gameId]);

  const gameState = gameData?.gameState || {};
  const numPlayers = gameState.numPlayers || 4;
  const players = gameData?.players || [];
  const rounds = gameState.rounds || [];
  const currentRound = gameState.currentRound ?? 0;
  const shownRound = viewRound ?? currentRound;
  const cards = rounds[shownRound] ?? 0;
  const myIdx = players.findIndex((p) => p.userId === user.id);
  const playerData = gameState.playerData || [];

  // Same rotation rules as the web app
  const firstPlayerIdx = shownRound % numPlayers;
  const lastPlayerIdx = (firstPlayerIdx - 1 + numPlayers) % numPlayers;

  const totalPoints = (pIdx) =>
    (playerData[pIdx]?.points || []).reduce((a, b) => a + (b || 0), 0);

  const submitValue = (type, value) => {
    const num = value === '' ? undefined : Number(value);
    if (num !== undefined && (!Number.isInteger(num) || num < 0 || num > cards)) {
      setError(`Επιτρεπτές τιμές: 0–${cards}`);
      return;
    }
    sendAction(type === 'pred' ? 'update-prediction' : 'update-tricks', {
      roundIdx: shownRound,
      playerIdx: myIdx,
      value: num,
    });
  };

  if (loading) {
    return (
      <View style={styles.page}>
        <Header subtitle={`Σκορ ${gameId}`} onBack={() => navigation.goBack()} />
        <View style={styles.center}><ActivityIndicator size="large" color={colors.felt} /></View>
      </View>
    );
  }

  if (!gameData) {
    return (
      <View style={styles.page}>
        <Header subtitle={`Σκορ ${gameId}`} onBack={() => navigation.goBack()} />
        <View style={styles.center}>
          <Text style={styles.errorBig}>{error || 'Το παιχνίδι δεν βρέθηκε'}</Text>
          <Btn title="Πίσω στο Lobby" onPress={() => navigation.goBack()} style={{ marginTop: 16 }} />
        </View>
      </View>
    );
  }

  const sumPreds = playerData.slice(0, numPlayers)
    .reduce((a, p) => a + (p.predictions?.[shownRound] ?? 0), 0);

  return (
    <View style={styles.page}>
      <Header subtitle={`Σκορ ${gameId}`} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.topRow}>
          <Chip label={`Γύρος ${shownRound + 1}/${rounds.length}`} color="rgba(15,95,73,0.1)" textColor={colors.felt} />
          <Chip label={`${cards} φύλλα`} color={colors.divider} />
          <Chip label={`Σύνολο προβλ: ${sumPreds}`} color={colors.goldSoft} textColor={colors.gold} />
          <Chip
            label={connected ? '● live' : '○ εκτός'}
            color={connected ? 'rgba(46,125,50,0.12)' : 'rgba(179,38,30,0.12)'}
            textColor={connected ? colors.success : colors.error}
          />
        </View>
        {shownRound !== currentRound && (
          <Text style={styles.viewingPast}>Βλέπεις τον γύρο {shownRound + 1} (τρέχων: {currentRound + 1})</Text>
        )}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {/* Round editor */}
        <Card style={styles.section}>
          <SectionTitle>Γύρος {shownRound + 1} — Πρώτος: {players[firstPlayerIdx]?.username || '—'}</SectionTitle>
          {players.map((p, idx) => {
            const pd = playerData[idx] || {};
            const pred = pd.predictions?.[shownRound];
            const tricks = pd.tricks?.[shownRound];
            const pts = pd.points?.[shownRound];
            const mine = idx === myIdx;
            const isLast = idx === lastPlayerIdx;
            return (
              <View key={idx} style={[styles.playerRow, mine && styles.playerRowMine, isLast && styles.playerRowLast]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.playerName} numberOfLines={1}>
                    {p.username}{mine ? ' 👤' : ''}{isLast ? ' 🔶' : ''}
                  </Text>
                  {pts !== undefined && (
                    <Text style={styles.playerPts}>{pts} πόντοι αυτόν τον γύρο</Text>
                  )}
                </View>
                <View style={styles.inputPair}>
                  <View style={styles.inputBox}>
                    <Text style={styles.inputLabel}>Π</Text>
                    <TextInput
                      style={[styles.input, !mine && styles.inputReadonly]}
                      editable={mine}
                      keyboardType="number-pad"
                      maxLength={2}
                      value={mine && drafts[`pred-${shownRound}`] !== undefined
                        ? drafts[`pred-${shownRound}`]
                        : (pred !== undefined && pred !== null ? String(pred) : '')}
                      onChangeText={(v) => setDrafts((d) => ({ ...d, [`pred-${shownRound}`]: v }))}
                      onEndEditing={(e) => {
                        submitValue('pred', e.nativeEvent.text.trim());
                        setDrafts((d) => { const n = { ...d }; delete n[`pred-${shownRound}`]; return n; });
                      }}
                    />
                  </View>
                  <View style={styles.inputBox}>
                    <Text style={styles.inputLabel}>Μ</Text>
                    <TextInput
                      style={[styles.input, !mine && styles.inputReadonly]}
                      editable={mine}
                      keyboardType="number-pad"
                      maxLength={2}
                      value={mine && drafts[`tricks-${shownRound}`] !== undefined
                        ? drafts[`tricks-${shownRound}`]
                        : (tricks !== undefined && tricks !== null ? String(tricks) : '')}
                      onChangeText={(v) => setDrafts((d) => ({ ...d, [`tricks-${shownRound}`]: v }))}
                      onEndEditing={(e) => {
                        submitValue('tricks', e.nativeEvent.text.trim());
                        setDrafts((d) => { const n = { ...d }; delete n[`tricks-${shownRound}`]; return n; });
                      }}
                    />
                  </View>
                </View>
              </View>
            );
          })}
          <Text style={styles.legend}>👤 εσύ · 🔶 τελευταίος (δεν μπορεί σύνολο = φύλλα) · Π πρόβλεψη · Μ νίκες</Text>
        </Card>

        {/* Round navigation */}
        <View style={styles.navRow}>
          <Btn
            title="‹ Προηγ."
            variant="outline"
            small
            disabled={shownRound === 0}
            onPress={() => setViewRound(shownRound - 1)}
          />
          {shownRound !== currentRound ? (
            <Btn title="Τρέχων γύρος" variant="gold" small onPress={() => setViewRound(null)} />
          ) : (
            <Btn
              title="Επόμενος γύρος ›"
              small
              disabled={currentRound >= rounds.length}
              onPress={() => { sendAction('advance-round'); setViewRound(null); }}
            />
          )}
          {shownRound === currentRound && currentRound > 0 && (
            <Btn
              title="‹ Πίσω γύρο"
              variant="danger"
              small
              onPress={() => { sendAction('go-back-round'); setViewRound(null); }}
            />
          )}
        </View>

        {/* Standings */}
        <Card style={styles.section}>
          <SectionTitle>🏆 Κατάταξη</SectionTitle>
          {players
            .map((p, idx) => ({ name: p.username, pts: totalPoints(idx), idx }))
            .sort((a, b) => b.pts - a.pts)
            .map((row, rank) => (
              <View key={row.idx} style={styles.standRow}>
                <Text style={styles.standRank}>{rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : rank + 1}</Text>
                <Text style={[styles.standName, row.idx === myIdx && { color: colors.felt }]}>{row.name}</Text>
                <Text style={styles.standPts}>{row.pts} π.</Text>
              </View>
            ))}
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.ivory },
  scroll: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorBig: { color: colors.error, fontSize: 16, fontWeight: '600', textAlign: 'center' },
  topRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  viewingPast: { color: colors.warning, fontWeight: '600', marginBottom: 8, fontSize: 12 },
  error: { color: colors.warning, fontWeight: '600', marginBottom: 10 },
  section: { marginBottom: 14 },
  playerRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 8,
    borderTopWidth: 1, borderTopColor: colors.divider,
  },
  playerRowMine: { backgroundColor: 'rgba(15,95,73,0.05)' },
  playerRowLast: { borderLeftWidth: 3, borderLeftColor: colors.gold, paddingLeft: 6 },
  playerName: { fontWeight: '700', color: colors.text },
  playerPts: { fontSize: 11, color: colors.textMuted },
  inputPair: { flexDirection: 'row', gap: 8 },
  inputBox: { alignItems: 'center' },
  inputLabel: { fontSize: 10, fontWeight: '700', color: colors.textMuted },
  input: {
    width: 48, height: 42, borderWidth: 1, borderColor: colors.divider, borderRadius: 8,
    textAlign: 'center', fontSize: 16, fontWeight: '700', color: colors.text,
    backgroundColor: colors.paper,
  },
  inputReadonly: { backgroundColor: colors.paperAlt, color: colors.textMuted },
  legend: { fontSize: 11, color: colors.textMuted, marginTop: 10 },
  navRow: { flexDirection: 'row', gap: 8, marginBottom: 14, flexWrap: 'wrap' },
  standRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  standRank: { width: 34, fontSize: 16 },
  standName: { flex: 1, fontWeight: '700', color: colors.text },
  standPts: { fontWeight: '800', color: colors.text },
});
