import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity,
} from 'react-native';
import { useAuth } from '../AuthContext';
import Header from '../components/Header';
import { Btn, Card, Chip, SectionTitle, PageBg } from '../components/UI';
import { night, displayFont } from '../theme';

const screenFor = (mode) => (mode === 'actual' ? 'LiveGame' : 'ScoreGame');

export default function LobbyScreen({ navigation }) {
  const { user, createGame, joinGame, listGames, checkCurrentGame } = useAuth();
  const [gameMode, setGameMode] = useState('actual');
  const [numPlayers, setNumPlayers] = useState(4);
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
    setBusy(true);
    const result = await createGame(numPlayers, gameMode);
    setBusy(false);
    if (result.success) navigation.navigate(screenFor(gameMode), { gameId: result.gameId });
    else setError(result.error);
  };

  const handleJoin = async (gameId, mode) => {
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
      <View style={{ flex: 1 }}>
        <PageBg />
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={night.gold} />}
        >
          <Text style={styles.welcome}>Καλώς ήρθες, {user.username}</Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {current && (
            <Card style={styles.currentCard}>
              <Text style={styles.currentText}>
                Κάθεσαι στο τραπέζι <Text style={styles.currentCode}>{current.gameId}</Text>
              </Text>
              <Btn
                title="ΕΠΙΣΤΡΟΦΗ"
                small
                onPress={() => navigation.navigate(screenFor(current.mode), { gameId: current.gameId })}
              />
            </Card>
          )}

          {/* Create game */}
          <Card style={styles.section}>
            <SectionTitle>Νέο Τραπέζι</SectionTitle>
            <View style={styles.modeRow}>
              <TouchableOpacity
                style={[styles.modeBtn, gameMode === 'actual' && styles.modeBtnActive]}
                onPress={() => setGameMode('actual')}
              >
                <Text style={[styles.modeText, gameMode === 'actual' && styles.modeTextActive]}>♠ Live Κάρτες</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeBtn, gameMode === 'normal' && styles.modeBtnActive]}
                onPress={() => setGameMode('normal')}
              >
                <Text style={[styles.modeText, gameMode === 'normal' && styles.modeTextActive]}>Μόνο Σκορ</Text>
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

            <Btn title="ΔΗΜΙΟΥΡΓΙΑ ΤΡΑΠΕΖΙΟΥ" onPress={handleCreate} loading={busy} />
          </Card>

          {/* Available games */}
          <Card style={styles.section}>
            <View style={styles.listHeader}>
              <SectionTitle style={{ marginBottom: 0 }}>Ανοιχτά Τραπέζια</SectionTitle>
              <View style={{ flexDirection: 'row', gap: 16 }}>
                <TouchableOpacity onPress={() => navigation.navigate('Help')}>
                  <Text style={styles.historyLink}>Βοήθεια ›</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => navigation.navigate('History')}>
                  <Text style={styles.historyLink}>Ιστορικό ›</Text>
                </TouchableOpacity>
              </View>
            </View>

            {games.length === 0 ? (
              <Text style={styles.empty}>Κανένα ανοιχτό τραπέζι. Άνοιξε ένα!</Text>
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
                          <Chip gold label="♠ LIVE" style={{ marginLeft: 8, paddingVertical: 2 }} />
                        )}
                        {isMine && (
                          <Chip label="ΕΙΣΑΙ ΜΕΣΑ" style={{ marginLeft: 8, paddingVertical: 2 }} />
                        )}
                      </View>
                      <Text style={styles.gameMeta}>
                        {game.hostUsername} · {game.playersCount}/{game.maxPlayers} παίκτες ·{' '}
                        {game.isStarted ? `Γύρος ${game.currentRound}/${game.totalRounds}` : 'Αναμονή'}
                      </Text>
                    </View>
                    <Btn
                      title={isMine ? 'ΜΠΕΣ' : full ? 'ΠΛΗΡΕΣ' : 'ΜΠΕΣ'}
                      variant={isMine ? 'primary' : 'outline'}
                      small
                      disabled={!isMine && full}
                      onPress={() => handleJoin(game.gameId, game.mode)}
                    />
                  </View>
                );
              })
            )}
          </Card>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: night.bgBottom },
  scroll: { padding: 16, paddingBottom: 40 },
  welcome: { fontFamily: displayFont, fontSize: 22, color: night.text, marginBottom: 14 },
  error: { color: night.danger, fontWeight: '600', marginBottom: 10 },
  currentCard: {
    marginBottom: 14, backgroundColor: night.goldSoft, borderColor: night.gold,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  currentText: { color: night.text, flex: 1, marginRight: 10, fontSize: 13 },
  currentCode: { color: night.gold, fontWeight: '800', letterSpacing: 1 },
  section: { marginBottom: 14 },
  modeRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  modeBtn: {
    flex: 1, borderWidth: 1.5, borderColor: 'rgba(216,178,92,0.25)', borderRadius: 11,
    paddingVertical: 11, alignItems: 'center', backgroundColor: night.glassDim,
  },
  modeBtnActive: { borderColor: night.gold, backgroundColor: night.goldSoft },
  modeText: { fontWeight: '600', color: night.mutedDark, fontSize: 13 },
  modeTextActive: { color: night.gold, fontWeight: '700' },
  modeHint: { color: night.mutedDark, fontSize: 12, marginBottom: 14 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  stepperLabel: { fontSize: 15, fontWeight: '600', color: night.text },
  stepper: { flexDirection: 'row', alignItems: 'center' },
  stepBtn: {
    width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: night.goldBorderStrong,
    backgroundColor: night.glass, alignItems: 'center', justifyContent: 'center',
  },
  stepBtnText: { fontSize: 20, fontWeight: '700', color: night.gold, marginTop: -2 },
  stepValue: { fontFamily: displayFont, fontSize: 22, color: night.text, marginHorizontal: 18 },
  joinRow: { flexDirection: 'row', alignItems: 'center' },
  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  historyLink: { color: night.gold, fontWeight: '700', fontSize: 13 },
  empty: { color: night.mutedDark, paddingVertical: 8 },
  gameRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 11,
    borderTopWidth: 1, borderTopColor: 'rgba(216,178,92,0.15)',
  },
  gameIdRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
  gameId: { fontWeight: '800', fontSize: 15, color: night.gold, letterSpacing: 1 },
  gameMeta: { color: night.muted, fontSize: 12 },
});
