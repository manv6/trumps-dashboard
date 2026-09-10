import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal,
  ActivityIndicator, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import io from 'socket.io-client';
import { useAuth } from '../AuthContext';
import { SERVER_URL } from '../config';
import Header from '../components/Header';
import PlayingCard from '../components/PlayingCard';
import { night, displayFont } from '../theme';

const SCREEN_W = Dimensions.get('window').width;

// ---------- Midnight Lounge building blocks ----------

function NightChip({ label, gold, danger, style }) {
  return (
    <View style={[
      styles.chip,
      gold && styles.chipGold,
      danger && styles.chipDanger,
      style,
    ]}>
      <Text style={[styles.chipText, gold && styles.chipTextGold, danger && styles.chipTextDanger]}>{label}</Text>
    </View>
  );
}

function GoldButton({ title, onPress, disabled, outline, style }) {
  if (outline) {
    return (
      <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.8}
        style={[styles.btnOutline, disabled && { opacity: 0.5 }, style]}>
        <Text style={styles.btnOutlineText}>{title}</Text>
      </TouchableOpacity>
    );
  }
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.85} style={style}>
      <LinearGradient colors={disabled ? ['#3a3428', '#2a251b'] : [night.goldBright, night.gold, night.goldDark]}
        style={[styles.btnGold, !disabled && styles.btnGoldGlow]}>
        <Text style={[styles.btnGoldText, disabled && { color: night.mutedDark }]}>{title}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

function Medallion({ name, initial, isTurn, isMe, bid, won, size = 56 }) {
  return (
    <View style={styles.medallion}>
      <View style={[
        styles.medallionCircle,
        { width: size, height: size, borderRadius: size / 2 },
        isTurn ? styles.medallionTurn : (isMe ? styles.medallionMe : null),
      ]}>
        <Text style={[styles.medallionInitial, { fontSize: size * 0.38 }]}>{initial}</Text>
      </View>
      <Text style={[styles.medallionName, isTurn && { color: night.gold }]} numberOfLines={1}>
        {name}{isMe ? ' (εσύ)' : ''}
      </Text>
      <Text style={styles.medallionStats}>{bid ?? '—'} / {won ?? 0}</Text>
    </View>
  );
}

// The elliptical felt table edge rising from mid-screen
function TableArc({ top }) {
  return (
    <View pointerEvents="none" style={[styles.tableArc, { top }]}>
      <LinearGradient colors={[night.tableTop, night.tableMid, night.tableEdge]} style={styles.tableArcFill} />
    </View>
  );
}

// ---------- Screen ----------

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
  const [showScore, setShowScore] = useState(false);
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

  // ---- Derived state (same protocol as the web client) ----
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
  const correctBids = (pIdx) => {
    const pd = gameState.playerData?.[pIdx] || {};
    let c = 0;
    (pd.predictions || []).forEach((pred, r) => {
      if (pred !== undefined && pred !== null && pd.tricks?.[r] === pred) c += 1;
    });
    return c;
  };

  // ---- Loading / error shells ----
  if (loading || !gameData) {
    return (
      <View style={styles.page}>
        <Header subtitle={`Τραπέζι ${gameId}`} onBack={() => navigation.goBack()} />
        <LinearGradient colors={[night.bgTop, night.bgMid, night.bgBottom]} style={styles.center}>
          {loading ? (
            <ActivityIndicator size="large" color={night.gold} />
          ) : (
            <View style={{ alignItems: 'center', paddingHorizontal: 24 }}>
              <Text style={styles.errorBig}>{error || 'Το παιχνίδι δεν βρέθηκε'}</Text>
              <GoldButton title="ΠΙΣΩ ΣΤΟ LOBBY" onPress={() => navigation.goBack()} style={{ marginTop: 20, alignSelf: 'stretch' }} />
            </View>
          )}
        </LinearGradient>
      </View>
    );
  }

  // ---- Waiting room ----
  const renderWaiting = () => (
    <View style={{ flex: 1 }}>
      <TableArc top={430} />
      <View style={{ alignItems: 'center', paddingTop: 26 }}>
        <Text style={styles.waitTitle}>Το τραπέζι ετοιμάζεται</Text>
        <Text style={styles.waitSub}>Μοιράσου τον κωδικό για να καθίσουν οι φίλοι σου</Text>

        <View style={styles.codePlate}>
          <View>
            <Text style={styles.codeLabel}>ΚΩΔΙΚΟΣ ΤΡΑΠΕΖΙΟΥ</Text>
            <Text style={styles.codeValue}>{gameId}</Text>
          </View>
        </View>

        <View style={styles.slotRow}>
          {Array(numPlayers).fill(null).map((_, idx) => {
            const p = players[idx];
            return (
              <View key={idx} style={styles.medallion}>
                {p ? (
                  <View style={[styles.medallionCircle, styles.slotCircle, p.userId === user.id && styles.medallionTurn]}>
                    <Text style={[styles.medallionInitial, { fontSize: 24 }]}>{p.username[0].toUpperCase()}</Text>
                  </View>
                ) : (
                  <View style={[styles.slotCircle, styles.slotEmpty]}>
                    <Text style={{ color: night.goldBorder, fontSize: 26, fontWeight: '300' }}>+</Text>
                  </View>
                )}
                <Text style={styles.medallionName} numberOfLines={1}>
                  {p ? p.username : 'Ελεύθερη θέση'}
                </Text>
                <Text style={styles.medallionStats}>
                  {p ? (p.userId === gameData.hostId ? 'HOST' : 'ΕΤΟΙΜΟΣ') : `${players.length}/${numPlayers}`}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      <View style={{ position: 'absolute', bottom: 40, left: 28, right: 28 }}>
        {isHost ? (
          <GoldButton
            title={players.length < numPlayers ? `ΑΝΑΜΟΝΗ ΠΑΙΚΤΩΝ (${players.length}/${numPlayers})` : 'ΕΝΑΡΞΗ ΠΑΙΧΝΙΔΙΟΥ'}
            disabled={players.length < numPlayers}
            onPress={() => sendAction('start-game')}
          />
        ) : (
          <Text style={[styles.waitSub, { textAlign: 'center' }]}>Το παιχνίδι ξεκινά μόλις ο host δώσει το σύνθημα…</Text>
        )}
      </View>
    </View>
  );

  // ---- Fanned hand ----
  const renderHand = (playable) => {
    const n = myHand.length;
    if (n === 0) {
      return <Text style={[styles.mutedText, { textAlign: 'center', marginBottom: 30 }]}>Δεν έχεις άλλα φύλλα</Text>;
    }
    const spread = Math.min(58, 9 * Math.max(n - 1, 1));
    const step = n > 1 ? spread / (n - 1) : 0;
    const R = 300;
    return (
      <View style={styles.handArea} pointerEvents="box-none">
        {myHand.map((card, i) => {
          const angle = -spread / 2 + i * step;
          const rad = (angle * Math.PI) / 180;
          const x = Math.sin(rad) * R;
          const y = (1 - Math.cos(rad)) * R;
          const canPlay = playable && isCardPlayable(card);
          return (
            <View
              key={`${card.suit}${card.value}`}
              style={{
                position: 'absolute',
                left: SCREEN_W / 2 - 40 + x,
                bottom: 6 - y + (canPlay ? 16 : 0),
                transform: [{ rotate: `${angle}deg` }],
                zIndex: i,
              }}
            >
              <PlayingCard
                value={card.value}
                suit={card.suit}
                size="hand"
                highlighted={canPlay}
                disabled={playable && !canPlay}
                onPress={playable ? () => sendAction('play-card', { card }) : undefined}
              />
            </View>
          );
        })}
      </View>
    );
  };

  // ---- Trick on the table ----
  const renderTrick = () => {
    if (currentTrick.length === 0 && completedTrick) {
      return (
        <View style={{ alignItems: 'center' }}>
          <View style={styles.trickRow}>
            {completedTrick.trick.map((play, idx) => (
              <View key={idx} style={{ alignItems: 'center', marginHorizontal: 2, transform: [{ rotate: `${(idx - (completedTrick.trick.length - 1) / 2) * 7}deg` }] }}>
                <PlayingCard value={play.card.value} suit={play.card.suit} size="mini"
                  highlighted={completedTrick.winner === play.playerIdx} />
                <Text style={styles.trickName} numberOfLines={1}>{playerNames[play.playerIdx]}</Text>
              </View>
            ))}
          </View>
          <View style={styles.winnerTag}>
            <Text style={styles.winnerTagText}>Νίκη για τον/την {playerNames[completedTrick.winner]}</Text>
          </View>
        </View>
      );
    }
    if (currentTrick.length === 0) {
      return (
        <Text style={styles.tableHint}>
          {myTurn ? 'Παίζεις πρώτος — διάλεξε φύλλο' : `${playerNames[turn] || 'Κάποιος'} παίζει πρώτος`}
        </Text>
      );
    }
    return (
      <View style={{ alignItems: 'center' }}>
        <View style={styles.trickRow}>
          {currentTrick.map((play, idx) => (
            <View key={idx} style={{ alignItems: 'center', marginHorizontal: -6, transform: [{ rotate: `${(idx - (currentTrick.length - 1) / 2) * 9}deg` }, { translateY: idx % 2 === 0 ? 6 : -4 }] }}>
              <PlayingCard value={play.card.value} suit={play.card.suit} size="table" highlighted={idx === 0} />
              <Text style={styles.trickName} numberOfLines={1}>{playerNames[play.playerIdx]}</Text>
            </View>
          ))}
        </View>
        {leadSuit && (
          <Text style={[styles.tableHint, { marginTop: 8 }]}>ΑΚΟΛΟΥΘΗΣΕ {leadSuit}</Text>
        )}
      </View>
    );
  };

  // ---- Bidding chips ----
  const renderBidding = () => (
    <View style={{ alignItems: 'center', paddingHorizontal: 20 }}>
      <Text style={styles.promptTitle}>
        {myTurn ? 'Πόσες νίκες θα κάνεις;' : `Προβλέπει ο/η ${playerNames[turn] || '...'}`}
      </Text>
      {myTurn && isLastPredictor && (
        <Text style={styles.promptSub}>ΠΡΟΒΛΕΠΕΙΣ ΤΕΛΕΥΤΑΙΟΣ</Text>
      )}
      <View style={styles.bidWrap}>
        {[...Array(cardsThisRound + 1).keys()].map((val) => {
          const forbidden = myTurn && isLastPredictor && val === forbiddenPrediction;
          const selected = predictions[myIdx] === val;
          const enabled = myTurn && !forbidden && predictions[myIdx] == null;
          return (
            <TouchableOpacity
              key={val}
              disabled={!enabled}
              onPress={() => sendAction('predict', { value: val })}
              activeOpacity={0.8}
            >
              {selected ? (
                <LinearGradient colors={[night.goldBright, night.gold, night.goldDark]} style={[styles.bidChip, styles.bidChipSelected]}>
                  <Text style={[styles.bidChipText, { color: '#241A05', fontWeight: '800' }]}>{val}</Text>
                </LinearGradient>
              ) : (
                <View style={[styles.bidChip, forbidden ? styles.bidChipForbidden : (enabled ? styles.bidChipOpen : styles.bidChipIdle)]}>
                  <Text style={[styles.bidChipText, forbidden && { color: night.mutedDark }]}>{val}</Text>
                  {forbidden && <View style={styles.bidChipStrike} />}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
      {myTurn && isLastPredictor && forbiddenPrediction >= 0 && forbiddenPrediction <= cardsThisRound && (
        <View style={styles.forbidNote}>
          <Text style={styles.forbidNoteText}>
            Το σύνολο δεν μπορεί να γίνει {cardsThisRound} — το {forbiddenPrediction} απαγορεύεται
          </Text>
        </View>
      )}
    </View>
  );

  // ---- Score sheet modal ----
  const renderScoreModal = () => (
    <Modal visible={showScore} transparent animationType="slide" onRequestClose={() => setShowScore(false)}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.panel, { maxHeight: '82%' }]}>
          <Text style={styles.panelTitle}>Φύλλο Σκορ</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.tr}>
                <Text style={[styles.th, styles.cellRound]}>Γ</Text>
                <Text style={[styles.th, styles.cellRound]}>Φ</Text>
                {playerNames.map((name, idx) => (
                  <Text key={idx} style={[styles.th, styles.cellPlayer, idx === myIdx && { color: night.gold }]} numberOfLines={1}>{name}</Text>
                ))}
              </View>
              {rounds.map((cards, rIdx) => {
                const isCur = rIdx === roundIdx && !isCompleted;
                return (
                  <View key={rIdx} style={[styles.tr, isCur && { backgroundColor: night.goldSoft }]}>
                    <Text style={[styles.td, styles.cellRound]}>{rIdx + 1}</Text>
                    <Text style={[styles.td, styles.cellRound]}>{cards}</Text>
                    {playerNames.map((_, pIdx) => {
                      const pd = gameState.playerData?.[pIdx] || {};
                      const pred = isCur ? predictions[pIdx] : pd.predictions?.[rIdx];
                      const tricks = isCur ? tricksWon[pIdx] : pd.tricks?.[rIdx];
                      const pts = pd.points?.[rIdx];
                      return (
                        <Text key={pIdx} style={[styles.td, styles.cellPlayer]}>
                          {(pred ?? '—')}/{(tricks ?? '—')}{pts !== undefined ? ` · ${pts}` : ''}
                        </Text>
                      );
                    })}
                  </View>
                );
              })}
              <View style={[styles.tr, { borderBottomWidth: 0 }]}>
                <Text style={[styles.th, styles.cellRound]} />
                <Text style={[styles.th, styles.cellRound]}>Σ</Text>
                {playerNames.map((_, pIdx) => (
                  <Text key={pIdx} style={[styles.th, styles.cellPlayer, { color: night.gold }]}>{totalPoints(pIdx)}</Text>
                ))}
              </View>
            </ScrollView>
          </ScrollView>
          <Text style={styles.scoreLegend}>πρόβλεψη / νίκες · πόντοι — τρέχων γύρος με χρυσό</Text>
          <GoldButton title="ΚΛΕΙΣΙΜΟ" outline onPress={() => setShowScore(false)} style={{ marginTop: 14 }} />
        </View>
      </View>
    </Modal>
  );

  // ---- End-of-game modal ----
  const ranked = (finalResult?.playerNames || playerNames)
    .map((name, idx) => ({
      name, idx,
      score: finalResult?.scores?.[idx] ?? totalPoints(idx),
      isWinner: (finalResult?.winners || []).includes(name),
    }))
    .sort((a, b) => b.score - a.score);

  const renderEndModal = () => (
    <Modal
      visible={!endDismissed && (showEnd || (isCompleted && !!finalResult))}
      transparent animationType="fade"
      onRequestClose={() => setEndDismissed(true)}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Τέλος Παιχνιδιού</Text>
          <Text style={styles.winnerLine}>
            {ranked.filter(r => r.isWinner).length > 1 ? 'ΝΙΚΗΤΕΣ' : 'ΝΙΚΗΤΗΣ'} · {(finalResult?.winners || []).join(', ').toUpperCase()}
          </Text>
          <View style={{ gap: 9, marginTop: 16 }}>
            {ranked.map((row) => (
              <View key={row.idx} style={[styles.rankRow, row.isWinner && styles.rankRowWinner]}>
                <View style={[styles.medallionCircle, { width: 40, height: 40, borderRadius: 20 }, row.isWinner && styles.medallionTurn]}>
                  <Text style={[styles.medallionInitial, { fontSize: 16 }]}>{row.name[0]?.toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 11 }}>
                  <Text style={[styles.rankName, row.isWinner && { color: night.goldBright }]}>
                    {row.name}{row.idx === myIdx ? '  (εσύ)' : ''}
                  </Text>
                  <Text style={styles.rankSub}>{correctBids(row.idx)} σωστές προβλέψεις</Text>
                </View>
                <Text style={[styles.rankScore, row.isWinner && { color: night.gold }]}>{row.score}</Text>
              </View>
            ))}
          </View>
          <GoldButton title="ΝΕΟ ΠΑΙΧΝΙΔΙ" onPress={() => navigation.goBack()} style={{ marginTop: 20 }} />
          <GoldButton title="ΦΥΛΛΟ ΣΚΟΡ" outline
            onPress={() => { setShowEnd(false); setEndDismissed(true); setShowScore(true); }}
            style={{ marginTop: 9 }} />
        </View>
      </View>
    </Modal>
  );

  // ---- Main game layout ----
  const opponents = players.map((p, idx) => ({ p, idx })).filter(({ idx }) => idx !== myIdx);

  return (
    <View style={styles.page}>
      <Header subtitle={`Τραπέζι ${gameId}`} onBack={() => navigation.goBack()} />
      <View style={{ flex: 1 }}>
        <LinearGradient colors={[night.bgTop, night.bgMid, night.bgBottom]} style={StyleSheet.absoluteFill} />

        {!gameState.isGameStarted && !isCompleted ? renderWaiting() : (
          <View style={{ flex: 1 }}>
            {/* HUD row */}
            <View style={styles.hudRow}>
              <NightChip label={`Γύρος ${roundIdx + 1}/${rounds.length || '—'}`} />
              <NightChip label={`${cardsThisRound} φύλλα`} />
              <NightChip gold label={`${trumpSuit} Ατού`} />
              <TouchableOpacity onPress={() => setShowScore(true)} activeOpacity={0.8}>
                <NightChip label="Σκορ" style={{ borderStyle: 'dashed' }} />
              </TouchableOpacity>
              <View style={[styles.connDot, { backgroundColor: connected ? '#4caf7d' : '#c0564c' }]} />
            </View>

            {/* opponents medallions */}
            <View style={styles.medallionRow}>
              {opponents.map(({ p, idx }) => (
                <Medallion
                  key={idx}
                  name={p.username}
                  initial={p.username[0]?.toUpperCase()}
                  isTurn={turn === idx && phase !== 'game-over'}
                  bid={predictions[idx]}
                  won={tricksWon[idx]}
                />
              ))}
            </View>

            {/* table + phase content */}
            <TableArc top={158} />
            <View style={{ flex: 1, justifyContent: 'center', paddingBottom: 130 }}>
              {phase === 'predicting' && renderBidding()}
              {phase === 'playing' && renderTrick()}
              {phase === 'game-over' && (
                <Text style={styles.promptTitle}>Το παιχνίδι ολοκληρώθηκε</Text>
              )}
            </View>

            {/* my stat strip */}
            <View style={styles.statStrip}>
              <View style={styles.statCell}>
                <Text style={styles.statLabel}>ΠΡΟΒΛΕΨΗ</Text>
                <Text style={[styles.statValue, { color: night.gold }]}>{predictions[myIdx] ?? '—'}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statCell}>
                <Text style={styles.statLabel}>ΝΙΚΕΣ</Text>
                <Text style={styles.statValue}>{tricksWon[myIdx] ?? 0}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statCell}>
                <Text style={styles.statLabel}>ΠΟΝΤΟΙ</Text>
                <Text style={styles.statValue}>{totalPoints(myIdx)}</Text>
              </View>
              {phase === 'playing' && myTurn && (
                <React.Fragment>
                  <View style={styles.statDivider} />
                  <Text style={styles.turnBadge}>ΣΕΙΡΑ ΣΟΥ</Text>
                </React.Fragment>
              )}
            </View>

            {/* hand */}
            {renderHand(phase === 'playing')}
          </View>
        )}

        {/* error toast */}
        {error ? (
          <View style={styles.toast}>
            <Text style={styles.toastText}>{error}</Text>
          </View>
        ) : null}
      </View>

      {renderScoreModal()}
      {renderEndModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: night.bgBottom },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorBig: { color: night.danger, fontSize: 16, fontWeight: '600', textAlign: 'center' },
  mutedText: { color: night.muted, fontSize: 13 },

  // chips + HUD
  hudRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingTop: 12 },
  chip: {
    backgroundColor: night.glass, borderWidth: 1, borderColor: night.goldBorder,
    borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12,
  },
  chipGold: { backgroundColor: night.goldSoft, borderColor: night.gold },
  chipDanger: { backgroundColor: night.dangerBg, borderColor: night.dangerBorder },
  chipText: { color: night.text, fontSize: 12, fontWeight: '600' },
  chipTextGold: { color: night.gold, fontWeight: '700' },
  chipTextDanger: { color: night.danger },
  connDot: { width: 9, height: 9, borderRadius: 5, marginLeft: 'auto' },

  // medallions
  medallionRow: { flexDirection: 'row', justifyContent: 'center', gap: 26, paddingTop: 14 },
  medallion: { alignItems: 'center', width: 84 },
  medallionCircle: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#1d2b33', borderWidth: 1.5, borderColor: night.goldBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  medallionTurn: {
    borderColor: night.gold, borderWidth: 2.5,
    shadowColor: night.gold, shadowOpacity: 0.8, shadowRadius: 12, shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  medallionMe: { borderColor: night.goldBorderStrong },
  medallionInitial: { color: night.text, fontWeight: '700' },
  medallionName: { color: night.muted, fontSize: 11, fontWeight: '600', marginTop: 5 },
  medallionStats: { color: night.gold, fontSize: 11, fontWeight: '700', marginTop: 1 },

  // table
  tableArc: { position: 'absolute', left: -110, right: -110, bottom: 0, overflow: 'hidden' },
  tableArcFill: {
    flex: 1,
    borderTopLeftRadius: SCREEN_W, borderTopRightRadius: SCREEN_W,
    borderTopWidth: 2, borderColor: 'rgba(216,178,92,0.8)',
  },
  tableHint: { color: 'rgba(232,228,216,0.6)', fontSize: 12, fontWeight: '600', letterSpacing: 1.5, textAlign: 'center' },
  trickRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  trickName: { color: 'rgba(223,243,234,0.85)', fontSize: 10, marginTop: 3, maxWidth: 66, textAlign: 'center' },
  winnerTag: {
    marginTop: 10, backgroundColor: night.goldBright, borderRadius: 999,
    paddingVertical: 5, paddingHorizontal: 14,
  },
  winnerTagText: { color: '#241A05', fontWeight: '700', fontSize: 12 },

  // bidding
  promptTitle: { fontFamily: displayFont, color: night.text, fontSize: 24, textAlign: 'center' },
  promptSub: { color: night.muted, fontSize: 11, fontWeight: '700', letterSpacing: 2, marginTop: 5, textAlign: 'center' },
  bidWrap: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 11, marginTop: 18, maxWidth: 330 },
  bidChip: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  bidChipOpen: { backgroundColor: night.glass, borderWidth: 1.5, borderColor: night.gold, borderStyle: 'dashed' },
  bidChipIdle: { backgroundColor: night.glassDim, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  bidChipForbidden: { backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  bidChipSelected: {
    shadowColor: night.gold, shadowOpacity: 0.8, shadowRadius: 14, shadowOffset: { width: 0, height: 0 }, elevation: 10,
  },
  bidChipText: { color: night.text, fontSize: 19, fontWeight: '700' },
  bidChipStrike: { position: 'absolute', width: 38, height: 2, borderRadius: 2, backgroundColor: '#8a4a42', transform: [{ rotate: '-45deg' }] },
  forbidNote: {
    marginTop: 16, backgroundColor: night.dangerBg, borderWidth: 1, borderColor: night.dangerBorder,
    borderRadius: 10, paddingVertical: 7, paddingHorizontal: 14,
  },
  forbidNoteText: { color: night.danger, fontSize: 12, fontWeight: '600', textAlign: 'center' },

  // stat strip
  statStrip: {
    position: 'absolute', bottom: 158, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 13,
    backgroundColor: 'rgba(10,18,16,0.75)', borderWidth: 1, borderColor: night.goldBorder,
    borderRadius: 14, paddingVertical: 7, paddingHorizontal: 16,
  },
  statCell: { alignItems: 'center' },
  statLabel: { color: night.muted, fontSize: 9, letterSpacing: 1.5, fontWeight: '600' },
  statValue: { fontFamily: displayFont, color: night.text, fontSize: 18 },
  statDivider: { width: 1, height: 26, backgroundColor: 'rgba(216,178,92,0.3)' },
  turnBadge: { color: night.gold, fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },

  // hand
  handArea: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 150 },

  // waiting room
  waitTitle: { fontFamily: displayFont, color: night.text, fontSize: 25, textAlign: 'center' },
  waitSub: { color: night.muted, fontSize: 13, marginTop: 6, textAlign: 'center' },
  codePlate: {
    marginTop: 22, backgroundColor: night.glass, borderWidth: 1.5, borderColor: night.goldBorderStrong,
    borderRadius: 16, paddingVertical: 13, paddingHorizontal: 26, alignItems: 'center',
    shadowColor: night.gold, shadowOpacity: 0.25, shadowRadius: 18, shadowOffset: { width: 0, height: 0 }, elevation: 6,
  },
  codeLabel: { color: night.muted, fontSize: 10, letterSpacing: 2, fontWeight: '600', textAlign: 'center' },
  codeValue: { fontFamily: displayFont, color: night.gold, fontSize: 29, letterSpacing: 5, marginTop: 2, textAlign: 'center' },
  slotRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 14, marginTop: 28, paddingHorizontal: 14 },
  slotCircle: { width: 62, height: 62, borderRadius: 31, alignItems: 'center', justifyContent: 'center' },
  slotEmpty: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: night.goldBorder, backgroundColor: night.glassDim },

  // modals
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(4,8,7,0.8)', alignItems: 'center', justifyContent: 'center', padding: 22 },
  panel: {
    alignSelf: 'stretch', backgroundColor: night.panel, borderWidth: 1.5, borderColor: night.goldBorderStrong,
    borderRadius: 20, padding: 22,
    shadowColor: '#000', shadowOpacity: 0.7, shadowRadius: 30, shadowOffset: { width: 0, height: 18 }, elevation: 16,
  },
  panelTitle: { fontFamily: displayFont, color: night.text, fontSize: 25, textAlign: 'center' },
  winnerLine: { color: night.gold, fontSize: 12, fontWeight: '700', letterSpacing: 2, textAlign: 'center', marginTop: 5 },
  rankRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: night.glassDim, borderWidth: 1, borderColor: 'rgba(216,178,92,0.25)',
    borderRadius: 13, paddingVertical: 9, paddingHorizontal: 12,
  },
  rankRowWinner: {
    backgroundColor: night.goldSoft, borderColor: night.gold, borderWidth: 1.5,
    shadowColor: night.gold, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 0 }, elevation: 6,
  },
  rankName: { color: night.text, fontWeight: '700', fontSize: 15 },
  rankSub: { color: night.muted, fontSize: 11, marginTop: 1 },
  rankScore: { fontFamily: displayFont, color: night.text, fontSize: 22 },

  // buttons
  btnGold: { height: 52, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  btnGoldGlow: { shadowColor: night.gold, shadowOpacity: 0.45, shadowRadius: 16, shadowOffset: { width: 0, height: 0 }, elevation: 8 },
  btnGoldText: { color: '#241A05', fontWeight: '800', fontSize: 14, letterSpacing: 1 },
  btnOutline: {
    height: 50, borderRadius: 13, alignItems: 'center', justifyContent: 'center',
    backgroundColor: night.glass, borderWidth: 1.5, borderColor: night.goldBorderStrong,
  },
  btnOutlineText: { color: night.gold, fontWeight: '700', fontSize: 13, letterSpacing: 1 },

  // score table
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: 'rgba(216,178,92,0.18)', paddingVertical: 7 },
  th: { color: night.text, fontWeight: '800', fontSize: 12 },
  td: { color: night.text, fontSize: 12 },
  cellRound: { width: 30, textAlign: 'center' },
  cellPlayer: { width: 96, textAlign: 'center' },
  scoreLegend: { color: night.mutedDark, fontSize: 11, marginTop: 10, textAlign: 'center' },

  // toast
  toast: {
    position: 'absolute', top: 60, alignSelf: 'center',
    backgroundColor: night.dangerBg, borderWidth: 1, borderColor: night.dangerBorder,
    borderRadius: 10, paddingVertical: 8, paddingHorizontal: 16, maxWidth: '88%',
  },
  toastText: { color: '#f3d5cf', fontSize: 13, fontWeight: '600', textAlign: 'center' },
});
