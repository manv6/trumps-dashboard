import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, ActivityIndicator,
} from 'react-native';
import io from 'socket.io-client';
import { useAuth } from '../AuthContext';
import { SERVER_URL } from '../config';
import Header from '../components/Header';
import PlayingCard from '../components/PlayingCard';
import { Btn, Card, Chip, SectionTitle } from '../components/UI';
import { colors } from '../theme';

// Server-driven live card game: mirrors the web ActualMultiplayerGame.
export default function LiveGameScreen({ route, navigation }) {
  const { gameId } = route.params;
  const { user, joinGame } = useAuth();

  const [gameData, setGameData] = useState(null);
  const [actualState, setActualState] = useState(null);
  const [myHand, setMyHand] = useState([]);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [endResult, setEndResult] = useState(null);
  const [showEnd, setShowEnd] = useState(false);
  const [endDismissed, setEndDismissed] = useState(false);
  const socketRef = useRef(null);

  // Join via REST first (adds us to the game if needed), then open the socket.
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
      setActualState(result.game.actualState || null);
      setLoading(false);

      const socket = io(SERVER_URL);
      socketRef.current = socket;
      socket.on('connect', () => {
        setConnected(true);
        socket.emit('join-game', { gameId, userId: user.id, username: user.username });
      });
      socket.on('disconnect', () => setConnected(false));
      socket.on('game-state', (g) => setGameData(g));
      socket.on('actual-state', (s) => setActualState(s));
      socket.on('your-hand', ({ hand }) => setMyHand(hand || []));
      socket.on('game-completed', (r) => { setEndResult(r); setShowEnd(true); });
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
      socketRef.current.emit('actual-action', { gameId, action, payload });
    }
  }, [gameId]);

  // ---- Derived state (same logic as the web client) ----
  const gameState = gameData?.gameState || {};
  const numPlayers = gameState.numPlayers || 4;
  const players = gameData?.players || [];
  const playerNames = players.map((p) => p.username);
  const myIdx = players.findIndex((p) => p.userId === user.id);
  const isHost = gameData?.hostId === user.id;
  const rounds = gameState.rounds || [];

  const phase = actualState?.phase;
  const roundIdx = actualState?.roundIdx ?? gameState.currentRound ?? 0;
  const cardsThisRound = actualState?.cardsThisRound ?? rounds[roundIdx] ?? 0;
  const turn = actualState?.turn ?? -1;
  const myTurn = turn === myIdx;
  const predictions = actualState?.predictions || [];
  const tricksWon = actualState?.tricksWon || [];
  const currentTrick = actualState?.currentTrick || [];
  const completedTrick = actualState?.completedTrick || null;
  const trumpSuit = actualState?.trumpSuit || '♠';
  const firstPlayer = actualState?.firstPlayer ?? 0;

  const isLastPredictor = myIdx !== -1 &&
    (myIdx - firstPlayer + numPlayers) % numPlayers === numPlayers - 1;
  const sumOtherPredictions = predictions.reduce(
    (a, p, i) => a + (i !== myIdx && p !== null && p !== undefined ? p : 0), 0);
  const forbiddenPrediction = isLastPredictor ? cardsThisRound - sumOtherPredictions : null;

  const leadSuit = currentTrick.length > 0 ? currentTrick[0].card.suit : null;
  const holdLeadSuit = leadSuit ? myHand.some((c) => c.suit === leadSuit) : false;
  const isCardPlayable = (card) =>
    phase === 'playing' && myTurn && (!leadSuit || !holdLeadSuit || card.suit === leadSuit);

  const isCompleted = gameState.isGameCompleted || phase === 'game-over';
  const finalResult = endResult || (isCompleted ? {
    playerNames: gameData?.playerNames || playerNames,
    scores: gameData?.scores || [],
    winners: gameData?.winners || [],
  } : null);

  const totalPoints = (pIdx) =>
    (gameState.playerData?.[pIdx]?.points || []).reduce((a, b) => a + (b || 0), 0);

  if (loading) {
    return (
      <View style={styles.page}>
        <Header subtitle={`Τραπέζι ${gameId}`} onBack={() => navigation.goBack()} />
        <View style={styles.center}><ActivityIndicator size="large" color={colors.felt} /></View>
      </View>
    );
  }

  if (!gameData) {
    return (
      <View style={styles.page}>
        <Header subtitle={`Τραπέζι ${gameId}`} onBack={() => navigation.goBack()} />
        <View style={styles.center}>
          <Text style={styles.errorBig}>{error || 'Το παιχνίδι δεν βρέθηκε'}</Text>
          <Btn title="Πίσω στο Lobby" onPress={() => navigation.goBack()} style={{ marginTop: 16 }} />
        </View>
      </View>
    );
  }

  const renderWaiting = () => (
    <Card style={styles.section}>
      <Text style={styles.waitTitle}>🃏 Αναμονή παικτών</Text>
      <Text style={styles.waitSub}>Μοιράσου τον κωδικό <Text style={styles.bold}>{gameId}</Text></Text>
      <View style={styles.slotRow}>
        {Array(numPlayers).fill(null).map((_, idx) => {
          const p = players[idx];
          return (
            <View key={idx} style={[styles.slot, !p && styles.slotEmpty, p?.userId === user.id && styles.slotMe]}>
              <View style={[styles.slotAvatar, { backgroundColor: p ? colors.felt : colors.divider }]}>
                <Text style={styles.slotAvatarText}>{p ? p.username[0].toUpperCase() : '?'}</Text>
              </View>
              <Text style={styles.slotName} numberOfLines={1}>{p ? p.username : 'Αναμονή...'}</Text>
            </View>
          );
        })}
      </View>
      {isHost ? (
        <Btn
          title={players.length < numPlayers
            ? `Αναμονή παικτών (${players.length}/${numPlayers})`
            : '🚀 Έναρξη Παιχνιδιού'}
          disabled={players.length < numPlayers}
          onPress={() => sendAction('start-game')}
        />
      ) : (
        <Text style={styles.waitSub}>Περιμένουμε τον host να ξεκινήσει...</Text>
      )}
    </Card>
  );

  const renderPlayersStrip = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.strip}>
      {players.map((p, idx) => (
        <View
          key={idx}
          style={[
            styles.playerCard,
            turn === idx && styles.playerCardTurn,
            idx === myIdx && turn !== idx && styles.playerCardMe,
          ]}
        >
          <Text style={styles.playerName} numberOfLines={1}>
            {p.username}{idx === myIdx ? ' 👤' : ''}{turn === idx && phase !== 'game-over' ? ' ⏳' : ''}
          </Text>
          <Text style={styles.playerMeta}>Bid {predictions[idx] ?? '—'} · Νίκες {tricksWon[idx] ?? 0}</Text>
          <Text style={styles.playerPoints}>{totalPoints(idx)} π.</Text>
        </View>
      ))}
    </ScrollView>
  );

  const renderHand = (playable) => (
    <View style={styles.handWrap}>
      {myHand.map((card) => (
        <PlayingCard
          key={`${card.suit}${card.value}`}
          value={card.value}
          suit={card.suit}
          onPress={playable ? () => sendAction('play-card', { card }) : undefined}
          disabled={playable ? !isCardPlayable(card) : false}
        />
      ))}
      {myHand.length === 0 && (
        <Text style={styles.muted}>Δεν έχεις άλλες κάρτες</Text>
      )}
    </View>
  );

  const renderBidding = () => (
    <Card style={styles.section}>
      <SectionTitle>
        {myTurn ? 'Πόσες μάζες θα κάνεις;' : `Περιμένουμε τον/την ${playerNames[turn] || '...'}`}
      </SectionTitle>
      <View style={styles.bidRow}>
        {[...Array(cardsThisRound + 1).keys()].map((val) => {
          const forbidden = myTurn && isLastPredictor && val === forbiddenPrediction;
          const selected = predictions[myIdx] === val;
          return (
            <TouchableOpacity
              key={val}
              disabled={!myTurn || forbidden}
              onPress={() => sendAction('predict', { value: val })}
              style={[
                styles.bidChip,
                selected && styles.bidChipSelected,
                (!myTurn || forbidden) && styles.bidChipDisabled,
              ]}
            >
              <Text style={[styles.bidChipText, selected && styles.bidChipTextSelected]}>
                {forbidden ? `${val} 🚫` : val}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {myTurn && isLastPredictor && forbiddenPrediction >= 0 && forbiddenPrediction <= cardsThisRound && (
        <Text style={styles.forbidHint}>
          Προβλέπεις τελευταίος — το σύνολο δεν μπορεί να γίνει {cardsThisRound}, οπότε το {forbiddenPrediction} απαγορεύεται.
        </Text>
      )}
      <Text style={styles.handLabel}>Τα φύλλα σου</Text>
      {renderHand(false)}
    </Card>
  );

  const renderPlaying = () => (
    <Card style={styles.section}>
      <SectionTitle>
        {myTurn ? '🎯 Σειρά σου — παίξε φύλλο' : `Παίζει ο/η ${playerNames[turn] || '...'}`}
      </SectionTitle>

      {/* The felt table */}
      <View style={styles.felt}>
        <Text style={styles.feltLabel}>Στο τραπέζι</Text>
        {currentTrick.length === 0 ? (
          completedTrick ? (
            <View>
              <View style={styles.trickRow}>
                {completedTrick.trick.map((play, idx) => (
                  <View key={idx} style={styles.trickCard}>
                    <PlayingCard
                      value={play.card.value}
                      suit={play.card.suit}
                      small
                      highlighted={completedTrick.winner === play.playerIdx}
                    />
                    <Text style={styles.trickName} numberOfLines={1}>{playerNames[play.playerIdx]}</Text>
                  </View>
                ))}
              </View>
              <Chip
                label={`Η μάζα στον/στην ${playerNames[completedTrick.winner]}`}
                color={colors.goldLight}
                textColor="#241A05"
                style={{ marginTop: 8, alignSelf: 'center' }}
              />
            </View>
          ) : (
            <Text style={styles.feltText}>{playerNames[turn] || 'Κάποιος'} παίζει πρώτος</Text>
          )
        ) : (
          <View style={styles.trickRow}>
            {currentTrick.map((play, idx) => (
              <View key={idx} style={styles.trickCard}>
                <PlayingCard value={play.card.value} suit={play.card.suit} highlighted={idx === 0} />
                <Text style={styles.trickName} numberOfLines={1}>{playerNames[play.playerIdx]}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <Text style={styles.handLabel}>Τα φύλλα σου</Text>
      {renderHand(true)}
      {leadSuit && holdLeadSuit && myTurn && (
        <Text style={styles.muted}>Πρέπει να ακολουθήσεις το χρώμα ({leadSuit})</Text>
      )}
    </Card>
  );

  const renderScoreSheet = () => (
    <Card style={styles.section}>
      <SectionTitle>📋 Φύλλο Σκορ</SectionTitle>
      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View>
          {/* header */}
          <View style={styles.tr}>
            <Text style={[styles.th, styles.cellRound]}>Γ</Text>
            <Text style={[styles.th, styles.cellRound]}>Φ</Text>
            {playerNames.map((name, idx) => (
              <Text key={idx} style={[styles.th, styles.cellPlayer, idx === myIdx && { color: colors.felt }]} numberOfLines={1}>
                {name}
              </Text>
            ))}
          </View>
          {rounds.map((cards, rIdx) => {
            const isCur = rIdx === roundIdx && !isCompleted;
            return (
              <View key={rIdx} style={[styles.tr, isCur && styles.trCurrent]}>
                <Text style={[styles.td, styles.cellRound]}>{rIdx + 1}</Text>
                <Text style={[styles.td, styles.cellRound]}>{cards}</Text>
                {playerNames.map((_, pIdx) => {
                  const pd = gameState.playerData?.[pIdx] || {};
                  const pred = isCur ? predictions[pIdx] : pd.predictions?.[rIdx];
                  const tricks = isCur ? tricksWon[pIdx] : pd.tricks?.[rIdx];
                  const pts = pd.points?.[rIdx];
                  return (
                    <Text key={pIdx} style={[styles.td, styles.cellPlayer]}>
                      {(pred ?? '—')}/{(tricks ?? '—')} {pts !== undefined ? `· ${pts}π` : ''}
                    </Text>
                  );
                })}
              </View>
            );
          })}
          <View style={[styles.tr, styles.trTotal]}>
            <Text style={[styles.th, styles.cellRound]} />
            <Text style={[styles.th, styles.cellRound]}>Σ</Text>
            {playerNames.map((_, pIdx) => (
              <Text key={pIdx} style={[styles.th, styles.cellPlayer]}>{totalPoints(pIdx)}</Text>
            ))}
          </View>
        </View>
      </ScrollView>
      <Text style={styles.mutedSmall}>Π/Μ · πόντοι — τρέχων γύρος με χρυσό φόντο</Text>
    </Card>
  );

  return (
    <View style={styles.page}>
      <Header subtitle={`Τραπέζι ${gameId}`} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.topRow}>
          <Chip
            label={`Γύρος ${roundIdx + 1}/${rounds.length || '—'}`}
            color="rgba(15,95,73,0.1)" textColor={colors.felt}
          />
          <Chip label={`${cardsThisRound} φύλλα`} color={colors.divider} />
          <Chip label={`${trumpSuit} Ατού`} color={colors.feltDark} textColor={colors.goldLight} />
          <Chip
            label={connected ? '● live' : '○ εκτός'}
            color={connected ? 'rgba(46,125,50,0.12)' : 'rgba(179,38,30,0.12)'}
            textColor={connected ? colors.success : colors.error}
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {!gameState.isGameStarted && !isCompleted ? (
          renderWaiting()
        ) : (
          <View>
            {renderPlayersStrip()}
            {phase === 'predicting' && renderBidding()}
            {phase === 'playing' && renderPlaying()}
            {renderScoreSheet()}
          </View>
        )}
      </ScrollView>

      {/* End-of-game modal */}
      <Modal
        visible={!endDismissed && (showEnd || (isCompleted && !!finalResult))}
        transparent
        animationType="fade"
        onRequestClose={() => setEndDismissed(true)}
      >
        <View style={styles.modalBackdrop}>
          <Card style={styles.modalCard}>
            <Text style={styles.modalTitle}>🏆 Τέλος Παιχνιδιού</Text>
            {(finalResult?.playerNames || playerNames).map((name, idx) => {
              const score = finalResult?.scores?.[idx] ?? totalPoints(idx);
              const isWinner = (finalResult?.winners || []).includes(name);
              return (
                <View key={idx} style={styles.modalRow}>
                  <Text style={[styles.modalName, isWinner && { color: colors.gold }]}>
                    {isWinner ? '🥇 ' : ''}{name}
                  </Text>
                  <Text style={styles.modalScore}>{score}</Text>
                </View>
              );
            })}
            <Btn title="Πίσω στο Lobby" onPress={() => navigation.goBack()} style={{ marginTop: 16 }} />
            <Btn
              title="Δες το φύλλο σκορ"
              variant="outline"
              onPress={() => { setShowEnd(false); setEndDismissed(true); }}
              style={{ marginTop: 8 }}
            />
          </Card>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.ivory },
  scroll: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorBig: { color: colors.error, fontSize: 16, fontWeight: '600', textAlign: 'center' },
  topRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  error: { color: colors.warning, fontWeight: '600', marginBottom: 10 },
  section: { marginBottom: 14 },
  bold: { fontWeight: '800' },
  muted: { color: colors.textMuted, fontSize: 13 },
  mutedSmall: { color: colors.textMuted, fontSize: 11, marginTop: 6 },
  // waiting room
  waitTitle: { fontSize: 20, fontWeight: '800', color: colors.text, textAlign: 'center', marginBottom: 4 },
  waitSub: { color: colors.textMuted, textAlign: 'center', marginBottom: 16 },
  slotRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginBottom: 18 },
  slot: {
    width: 92, alignItems: 'center', padding: 10, borderRadius: 12,
    borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.paperAlt,
  },
  slotEmpty: { opacity: 0.5 },
  slotMe: { borderColor: colors.felt, borderWidth: 2 },
  slotAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  slotAvatarText: { color: '#fff', fontWeight: '800' },
  slotName: { fontSize: 12, fontWeight: '600', color: colors.text },
  // players strip
  strip: { marginBottom: 12 },
  playerCard: {
    minWidth: 110, padding: 10, borderRadius: 12, marginRight: 8,
    backgroundColor: colors.paperAlt, borderWidth: 1, borderColor: colors.divider,
  },
  playerCardTurn: { backgroundColor: colors.goldSoft, borderColor: colors.gold, borderWidth: 2 },
  playerCardMe: { borderColor: colors.felt, borderWidth: 2 },
  playerName: { fontWeight: '800', fontSize: 13, color: colors.text },
  playerMeta: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  playerPoints: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  // bidding
  bidRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  bidChip: {
    minWidth: 44, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 999,
    borderWidth: 1.5, borderColor: colors.divider, alignItems: 'center',
  },
  bidChipSelected: { backgroundColor: colors.felt, borderColor: colors.felt },
  bidChipDisabled: { opacity: 0.4 },
  bidChipText: { fontWeight: '700', fontSize: 16, color: colors.text },
  bidChipTextSelected: { color: '#fff' },
  forbidHint: { color: colors.error, fontSize: 12, fontWeight: '600', marginBottom: 6 },
  handLabel: { fontWeight: '700', color: colors.text, marginTop: 10, marginBottom: 4 },
  handWrap: { flexDirection: 'row', flexWrap: 'wrap' },
  // felt table
  felt: {
    backgroundColor: colors.feltLight, borderRadius: 14, borderWidth: 3,
    borderColor: '#9A701C', padding: 14, minHeight: 120, marginBottom: 6,
  },
  feltLabel: { color: colors.goldLight, fontWeight: '700', marginBottom: 8, fontSize: 13 },
  feltText: { color: colors.textOnFelt },
  trickRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  trickCard: { alignItems: 'center', marginHorizontal: 2, maxWidth: 70 },
  trickName: { color: colors.textOnFelt, fontSize: 10, marginTop: 2 },
  // score sheet
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.divider, paddingVertical: 6 },
  trCurrent: { backgroundColor: colors.goldSoft },
  trTotal: { backgroundColor: colors.paperAlt, borderBottomWidth: 0 },
  th: { fontWeight: '800', fontSize: 12, color: colors.text },
  td: { fontSize: 12, color: colors.text },
  cellRound: { width: 30, textAlign: 'center' },
  cellPlayer: { width: 96, textAlign: 'center' },
  // end modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(6,61,46,0.75)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard: { width: '100%', maxWidth: 380 },
  modalTitle: { fontSize: 22, fontWeight: '800', color: colors.text, textAlign: 'center', marginBottom: 14 },
  modalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  modalName: { fontWeight: '700', fontSize: 16, color: colors.text },
  modalScore: { fontWeight: '800', fontSize: 16, color: colors.text },
});
