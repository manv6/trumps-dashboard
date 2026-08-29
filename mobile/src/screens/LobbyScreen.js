import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity,
} from 'react-native';
import { useAuth } from '../AuthContext';
import Header from '../components/Header';
import { Btn, Card, Chip, Field, SectionTitle } from '../components/UI';
import { colors } from '../theme';

const screenFor = (mode) => (mode === 'actual' ? 'LiveGame' : 'ScoreGame');

export default function LobbyScreen({ navigation }) {
  const { user, createGame, joinGame, listGames, checkCurrentGame } = useAuth();
  const [gameMode, setGameMode] = useState('actual');
  const [numPlayers, setNumPlayers] = useState(4);
  const [joinCode, setJoinCode] = useState('');
  const [games, setGames] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [current, setCurrent] = useState(null); // { gameId, mode }

  const loadGames = useCallback(async () => {
    const result = await listGames();
    if (result.success) setGames(result.games || []);
    const cur = await checkCurrentGame();
    setCurrent(cur.success && cur.isInGame ? { gameId: cur.gameId, mode: cur.mode || 'normal' } : null);
  }, [listGames, checkCurrentGame]);

  useEffect(() => {
    loadGames();
    const interval = setInterval(loadGames, 5000);
    const unsub = navigation.addListener('focus', loadGames);
    return () => { clearInterval(interval); unsub(); };
  }, [loadGames, navigation]);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(''), 4000);
    return () => clearTimeout(t);
  }, [error]);

  const handleCreate = async () => {
    if (current) return setError(`Είσαι ήδη στο παιχνίδι ${current.gameId}`);
    setBusy(true);
    const result = await createGame(numPlayers, gameMode);
    setBusy(false);
    if (result.success) navigation.navigate(screenFor(gameMode), { gameId: result.gameId });
    else setError(result.error);
  };

  const handleJoin = async (gameId, mode) => {
    if (current && current.gameId !== gameId) {
      return setError(`Είσαι ήδη στο παιχνίδι ${current.gameId}`);
    }
    setBusy(true);
    const result = await joinGame(gameId);
    setBusy(false);
    if (result.success) navigation.navigate(screenFor(mode || result.game?.mode), { gameId });
    else setError(result.error);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadGames();
    setRefreshing(false);
  };

  return (
    <View style={styles.page}>
      <Header subtitle="Lobby" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={styles.welcome}>Καλώς ήρθες, {user.username} 👋</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {current && (
          <Card style={styles.currentCard}>
            <Text style={styles.currentText}>Είσαι στο παιχνίδι <Text style={styles.bold}>{current.gameId}</Text></Text>
            <Btn
              title="Επιστροφή στο παιχνίδι"
              variant="gold"
              small
              onPress={() => navigation.navigate(screenFor(current.mode), { gameId: current.gameId })}
            />
          </Card>
        )}

        {/* Create game */}
        <Card style={styles.section}>
          <SectionTitle>Νέο Παιχνίδι</SectionTitle>
          <View style={styles.modeRow}>
            <TouchableOpacity
              style={[styles.modeBtn, gameMode === 'actual' && styles.modeBtnActive]}
              onPress={() => setGameMode('actual')}
            >
              <Text style={[styles.modeText, gameMode === 'actual' && styles.modeTextActive]}>🃏 Live Κάρτες</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeBtn, gameMode === 'normal' && styles.modeBtnActive]}
              onPress={() => setGameMode('normal')}
            >
              <Text style={[styles.modeText, gameMode === 'normal' && styles.modeTextActive]}>📊 Μόνο Σκορ</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.modeHint}>
            {gameMode === 'actual'
              ? 'Οι κάρτες μοιράζονται και παίζονται online, σε πραγματικό χρόνο'
              : 'Κράτα σκορ ενώ παίζετε με αληθινή τράπουλα'}
          </Text>

          <View style={styles.stepperRow}>
            <Text style={styles.stepperLabel}>Παίκτες</Text>
            <View style={styles.stepper}>
              <TouchableOpacity style={styles.stepBtn} onPress={() => setNumPlayers((n) => Math.max(2, n - 1))}>
                <Text style={styles.stepBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.stepValue}>{numPlayers}</Text>
              <TouchableOpacity style={styles.stepBtn} onPress={() => setNumPlayers((n) => Math.min(8, n + 1))}>
                <Text style={styles.stepBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Btn title="Δημιουργία Παιχνιδιού" onPress={handleCreate} loading={busy} />
        </Card>

        {/* Join by code */}
        <Card style={styles.section}>
          <SectionTitle>Μπες με Κωδικό</SectionTitle>
          <View style={styles.joinRow}>
            <Field
              placeholder="π.χ. AB12CD34"
              value={joinCode}
              onChangeText={(v) => setJoinCode(v.toUpperCase())}
              autoCapitalize="characters"
              style={{ flex: 1, marginRight: 10 }}
            />
            <Btn
              title="Μπες"
              variant="outline"
              disabled={!joinCode.trim()}
              onPress={() => handleJoin(joinCode.trim(), null)}
            />
          </View>
        </Card>

        {/* Available games */}
        <Card style={styles.section}>
          <View style={styles.listHeader}>
            <SectionTitle style={{ marginBottom: 0 }}>Διαθέσιμα Παιχνίδια</SectionTitle>
            <TouchableOpacity onPress={() => navigation.navigate('History')}>
              <Text style={styles.historyLink}>Ιστορικό ›</Text>
            </TouchableOpacity>
          </View>

          {games.length === 0 ? (
            <Text style={styles.empty}>Κανένα ενεργό παιχνίδι. Φτιάξε ένα!</Text>
          ) : (
            games.map((game) => {
              const isMine = game.playerIds?.includes(user.id);
              const full = game.spotsAvailable === 0;
              return (
                <View key={game.gameId} style={styles.gameRow}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.gameIdRow}>
                      <Text style={styles.gameId}>{game.gameId}</Text>
                      {game.mode === 'actual' && (
                        <Chip label="🃏 LIVE" color={colors.goldSoft} textColor={colors.gold} style={{ marginLeft: 8 }} />
                      )}
                      {isMine && (
                        <Chip label="ΕΙΣΑΙ ΜΕΣΑ" color="rgba(15,95,73,0.12)" textColor={colors.felt} style={{ marginLeft: 8 }} />
                      )}
                    </View>
                    <Text style={styles.gameMeta}>
                      {game.hostUsername} · {game.playersCount}/{game.maxPlayers} παίκτες ·{' '}
                      {game.isStarted ? `Γύρος ${game.currentRound}/${game.totalRounds}` : 'Αναμονή'}
                    </Text>
                  </View>
                  <Btn
                    title={isMine ? 'Μπες' : full ? 'Πλήρες' : 'Μπες'}
                    variant={isMine ? 'gold' : 'outline'}
                    small
                    disabled={!isMine && (full || (current && current.gameId !== game.gameId))}
                    onPress={() => handleJoin(game.gameId, game.mode)}
                  />
                </View>
              );
            })
          )}
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.ivory },
  scroll: { padding: 16, paddingBottom: 40 },
  welcome: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 12 },
  error: { color: colors.error, fontWeight: '600', marginBottom: 10 },
  currentCard: {
    marginBottom: 14, backgroundColor: colors.goldSoft, borderColor: colors.gold,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  currentText: { color: colors.text, flex: 1, marginRight: 10 },
  bold: { fontWeight: '800' },
  section: { marginBottom: 14 },
  modeRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  modeBtn: {
    flex: 1, borderWidth: 1.5, borderColor: colors.divider, borderRadius: 10,
    paddingVertical: 10, alignItems: 'center',
  },
  modeBtnActive: { borderColor: colors.felt, backgroundColor: 'rgba(15,95,73,0.08)' },
  modeText: { fontWeight: '600', color: colors.textMuted },
  modeTextActive: { color: colors.felt, fontWeight: '700' },
  modeHint: { color: colors.textMuted, fontSize: 12, marginBottom: 14 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  stepperLabel: { fontSize: 16, fontWeight: '600', color: colors.text },
  stepper: { flexDirection: 'row', alignItems: 'center' },
  stepBtn: {
    width: 38, height: 38, borderRadius: 10, borderWidth: 1.5, borderColor: colors.felt,
    alignItems: 'center', justifyContent: 'center',
  },
  stepBtnText: { fontSize: 20, fontWeight: '700', color: colors.felt, marginTop: -2 },
  stepValue: { fontSize: 18, fontWeight: '800', color: colors.text, marginHorizontal: 16 },
  joinRow: { flexDirection: 'row', alignItems: 'center' },
  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  historyLink: { color: colors.felt, fontWeight: '700' },
  empty: { color: colors.textMuted, paddingVertical: 8 },
  gameRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: colors.divider,
  },
  gameIdRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  gameId: { fontWeight: '800', fontSize: 15, color: colors.text, fontVariant: ['tabular-nums'] },
  gameMeta: { color: colors.textMuted, fontSize: 12 },
});
