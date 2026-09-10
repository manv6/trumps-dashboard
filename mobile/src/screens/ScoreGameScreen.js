import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, ActivityIndicator,
} from 'react-native';
import io from 'socket.io-client';
import { useAuth } from '../AuthContext';
import { SERVER_URL } from '../config';
import Header from '../components/Header';
import { Btn, Card, Chip, SectionTitle, PageBg } from '../components/UI';
import { night, displayFont } from '../theme';

// Scoreboard mode, mobile-optimized: one round at a time (your Π/Μ inputs +
// everyone's values) with manual round navigation — same socket protocol as
// the web app, dressed in the Midnight Lounge design.
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

  if (loading || !gameData) {
    return (
      <View style={styles.page}>
        <Header subtitle={`Σκορ ${gameId}`} onBack={() => navigation.goBack()} />
        <View style={{ flex: 1 }}>
          <PageBg />
          <View style={styles.center}>
            {loading ? (
              <ActivityIndicator size="large" color={night.gold} />
            ) : (
              <View style={{ alignItems: 'stretch', paddingHorizontal: 24, alignSelf: 'stretch' }}>
                <Text style={styles.errorBig}>{error || 'Το παιχνίδι δεν βρέθηκε'}</Text>
                <Btn title="ΠΙΣΩ ΣΤΟ LOBBY" onPress={() => navigation.goBack()} style={{ marginTop: 18 }} />
              </View>
            )}
          </View>
        </View>
      </View>
    );
  }

  const sumPreds = playerData.slice(0, numPlayers)
    .reduce((a, p) => a + (p.predictions?.[shownRound] ?? 0), 0);

  return (
    <View style={styles.page}>
      <Header subtitle={`Σκορ ${gameId}`} onBack={() => navigation.goBack()} />
      <View style={{ flex: 1 }}>
        <PageBg />
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.topRow}>
            <Chip label={`Γύρος ${shownRound + 1}/${rounds.length}`} />
            <Chip label={`${cards} φύλλα`} />
            <Chip gold label={`Σύνολο προβλ: ${sumPreds}`} />
            <View style={[styles.connDot, { backgroundColor: connected ? '#4caf7d' : '#c0564c' }]} />
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
                    <Text style={[styles.playerName, mine && { color: night.gold }]} numberOfLines={1}>
                      {p.username}{mine ? ' (εσύ)' : ''}{isLast ? ' · τελευταίος' : ''}
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
                        placeholderTextColor={night.mutedDark}
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
                      <Text style={styles.inputLabel}>Ν</Text>
                      <TextInput
                        style={[styles.input, !mine && styles.inputReadonly]}
                        editable={mine}
                        keyboardType="number-pad"
                        maxLength={2}
                        placeholderTextColor={night.mutedDark}
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
            <Text style={styles.legend}>Π πρόβλεψη · Ν νίκες · ο τελευταίος δεν μπορεί να κάνει το σύνολο ίσο με τα φύλλα</Text>
          </Card>

          {/* Round navigation */}
          <View style={styles.navRow}>
            <Btn
              title="‹ ΠΡΟΗΓ."
              variant="outline"
              small
              disabled={shownRound === 0}
              onPress={() => setViewRound(shownRound - 1)}
            />
            {shownRound !== currentRound ? (
              <Btn title="ΤΡΕΧΩΝ ΓΥΡΟΣ" small onPress={() => setViewRound(null)} />
            ) : (
              <Btn
                title="ΕΠΟΜΕΝΟΣ ΓΥΡΟΣ ›"
                small
                disabled={currentRound >= rounds.length}
                onPress={() => { sendAction('advance-round'); setViewRound(null); }}
              />
            )}
            {shownRound === currentRound && currentRound > 0 && (
              <Btn
                title="‹ ΠΙΣΩ ΓΥΡΟ"
                variant="danger"
                small
                onPress={() => { sendAction('go-back-round'); setViewRound(null); }}
              />
            )}
          </View>

          {/* Standings */}
          <Card style={styles.section}>
            <SectionTitle>Κατάταξη</SectionTitle>
            {players
              .map((p, idx) => ({ name: p.username, pts: totalPoints(idx), idx }))
              .sort((a, b) => b.pts - a.pts)
              .map((row, rank) => (
                <View key={row.idx} style={[styles.standRow, rank === 0 && styles.standRowFirst]}>
                  <Text style={[styles.standRank, rank === 0 && { color: night.gold }]}>{rank + 1}</Text>
                  <Text style={[styles.standName, row.idx === myIdx && { color: night.gold }]}>
                    {row.name}{row.idx === myIdx ? ' (εσύ)' : ''}
                  </Text>
                  <Text style={[styles.standPts, rank === 0 && { color: night.gold }]}>{row.pts} π.</Text>
                </View>
              ))}
          </Card>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: night.bgBottom },
  scroll: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorBig: { color: night.danger, fontSize: 16, fontWeight: '600', textAlign: 'center' },
  topRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 12 },
  connDot: { width: 9, height: 9, borderRadius: 5, marginLeft: 'auto' },
  viewingPast: { color: night.gold, fontWeight: '600', marginBottom: 8, fontSize: 12 },
  error: { color: night.danger, fontWeight: '600', marginBottom: 10 },
  section: { marginBottom: 14 },
  playerRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 9,
    borderTopWidth: 1, borderTopColor: 'rgba(216,178,92,0.15)',
  },
  playerRowMine: { backgroundColor: 'rgba(216,178,92,0.06)' },
  playerRowLast: { borderLeftWidth: 3, borderLeftColor: night.gold, paddingLeft: 8 },
  playerName: { fontWeight: '700', color: night.text, fontSize: 14 },
  playerPts: { fontSize: 11, color: night.muted, marginTop: 1 },
  inputPair: { flexDirection: 'row', gap: 8 },
  inputBox: { alignItems: 'center' },
  inputLabel: { fontSize: 10, fontWeight: '700', color: night.muted, marginBottom: 2 },
  input: {
    width: 48, height: 44, borderWidth: 1, borderColor: night.goldBorderStrong, borderRadius: 10,
    textAlign: 'center', fontSize: 17, fontWeight: '700', color: night.text,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  inputReadonly: { backgroundColor: night.glassDim, borderColor: 'rgba(216,178,92,0.2)', color: night.muted },
  legend: { fontSize: 11, color: night.mutedDark, marginTop: 12, lineHeight: 16 },
  navRow: { flexDirection: 'row', gap: 8, marginBottom: 14, flexWrap: 'wrap' },
  standRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  standRowFirst: { backgroundColor: night.goldSoft, borderRadius: 10, paddingHorizontal: 8, marginHorizontal: -8 },
  standRank: { width: 30, fontFamily: displayFont, fontSize: 17, color: night.muted },
  standName: { flex: 1, fontWeight: '700', color: night.text },
  standPts: { fontFamily: displayFont, color: night.text, fontSize: 17 },
});
