import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal,
  ActivityIndicator, Dimensions, Animated, Easing, Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import io from 'socket.io-client';
import { useAuth } from '../AuthContext';
import { SERVER_URL } from '../config';
import Header from '../components/Header';
import CardView from '../components/cards/CardView';
import CardBack from '../components/cards/CardBack';
import Halo from '../components/effects/Halo';
import Fireworks from '../components/effects/Fireworks';
import { night, displayFont } from '../theme';

const SCREEN_W = Dimensions.get('window').width;
const SCREEN_H = Dimensions.get('window').height;

const HAND_CARD_W = 94;
const TABLE_CARD_W = 76;

// ---------- small UI pieces ----------

function NightChip({ label, gold, style }) {
  return (
    <View style={[styles.chip, gold && styles.chipGold, style]}>
      <Text style={[styles.chipText, gold && styles.chipTextGold]}>{label}</Text>
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

// Pulsing gold ring for whoever's turn it is
function PulseRing({ size }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 0, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: size, height: size, borderRadius: size / 2,
        borderWidth: 2, borderColor: night.gold,
        opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.8, 0] }),
        transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.45] }) }],
      }}
    />
  );
}

function Medallion({ name, initial, isTurn, halo, bid, won }) {
  return (
    <View style={styles.medallion}>
      <View style={{ alignItems: 'center', justifyContent: 'center' }}>
        {isTurn && <PulseRing size={56} />}
        {halo && <Halo width={72} />}
        <View style={[styles.medallionCircle, isTurn && styles.medallionTurn]}>
          <Text style={styles.medallionInitial}>{initial}</Text>
        </View>
      </View>
      <Text style={[styles.medallionName, isTurn && { color: night.gold }]} numberOfLines={1}>{name}</Text>
      <Text style={styles.medallionStats}>{bid ?? '—'} / {won ?? 0}</Text>
    </View>
  );
}

function TableArc({ top }) {
  return (
    <View pointerEvents="none" style={[styles.tableArc, { top }]}>
      <LinearGradient colors={[night.tableTop, night.tableMid, night.tableEdge]} style={styles.tableArcFill} />
    </View>
  );
}

// ---------- animated cards ----------

// A card in my fan: deals in from the deck, springs to its fan slot when the
// hand reflows, lifts when playable, and flies toward the table when played.
function HandCard({ card, x, y, deg, lift, dealDelay, playable, dimmed, onPlay }) {
  const pos = useRef(new Animated.ValueXY({ x: -x, y: -(SCREEN_H * 0.52) })).current;
  const rot = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.9)).current;
  const target = useRef({ x: 0, y: 0 });
  const flying = useRef(false);

  // Deal-in on mount, spring to new slot on reflow
  useEffect(() => {
    if (flying.current) return;
    const toY = lift ? -16 : 0;
    target.current = { x: 0, y: toY };
    Animated.parallel([
      Animated.spring(pos, { toValue: { x: 0, y: toY }, delay: dealDelay, friction: 8, tension: 50, useNativeDriver: true }),
      Animated.spring(rot, { toValue: 1, delay: dealDelay, friction: 8, tension: 50, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, delay: dealDelay, friction: 8, useNativeDriver: true }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [x, y, deg, lift, dealDelay]);

  const handlePress = () => {
    if (!playable || flying.current) return;
    flying.current = true;
    Animated.parallel([
      Animated.timing(pos, { toValue: { x: -x, y: -(SCREEN_H * 0.42) }, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(scale, { toValue: 0.82, duration: 260, useNativeDriver: true }),
    ]).start();
    setTimeout(() => onPlay(card), 140);
  };

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: x + SCREEN_W / 2 - HAND_CARD_W / 2,
        bottom: 4 - y,
        transform: [
          { translateX: pos.x },
          { translateY: pos.y },
          { rotate: rot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${deg}deg`] }) },
          { scale },
        ],
      }}
    >
      <Pressable onPress={handlePress} disabled={!playable}>
        <CardView card={card} width={HAND_CARD_W} highlighted={playable} dimmed={dimmed} />
      </Pressable>
    </Animated.View>
  );
}

// A card landing on the table: slides in from the player's side with a spring.
function TableCard({ card, deg, fromBottom, width = TABLE_CARD_W, highlighted, name }) {
  const slide = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(slide, { toValue: 1, friction: 7, tension: 60, useNativeDriver: true }).start();
  }, [slide]);
  return (
    <Animated.View
      style={{
        alignItems: 'center',
        marginHorizontal: -7,
        opacity: slide,
        transform: [
          { translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [fromBottom ? 150 : -150, 0] }) },
          { rotate: slide.interpolate({ inputRange: [0, 1], outputRange: [`${deg + (fromBottom ? 16 : -16)}deg`, `${deg}deg`] }) },
          { scale: slide.interpolate({ inputRange: [0, 1], outputRange: [1.12, 1] }) },
        ],
      }}
    >
      <CardView card={card} width={width} highlighted={highlighted} />
      {name ? <Text style={styles.trickName} numberOfLines={1}>{name}</Text> : null}
    </Animated.View>
  );
}

// The finished trick: rests a beat, then sweeps toward the winner and fades.
function TrickSweep({ trick, winner, winnerName, myIdx, opponentSlot }) {
  const sweep = useRef(new Animated.Value(0)).current;
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      Animated.timing(sweep, { toValue: 1, duration: 480, easing: Easing.in(Easing.cubic), useNativeDriver: true })
        .start(() => setGone(true));
    }, 750);
    return () => clearTimeout(t);
  }, [sweep]);

  const toMe = winner === myIdx;
  const slot = opponentSlot(winner);
  const dx = toMe ? 0 : slot.x * 0.7;
  const dy = toMe ? 320 : -300;

  return (
    <View style={{ alignItems: 'center' }}>
      {!gone && (
        <Animated.View
          style={{
            flexDirection: 'row',
            opacity: sweep.interpolate({ inputRange: [0, 0.75, 1], outputRange: [1, 0.9, 0] }),
            transform: [
              { translateX: sweep.interpolate({ inputRange: [0, 1], outputRange: [0, dx] }) },
              { translateY: sweep.interpolate({ inputRange: [0, 1], outputRange: [0, dy] }) },
              { scale: sweep.interpolate({ inputRange: [0, 1], outputRange: [1, 0.4] }) },
            ],
          }}
        >
          {trick.map((play, idx) => (
            <View key={idx} style={{ marginHorizontal: -7, transform: [{ rotate: `${(idx - (trick.length - 1) / 2) * 8}deg` }] }}>
              <CardView card={play.card} width={64} highlighted={play.playerIdx === winner} />
            </View>
          ))}
        </Animated.View>
      )}
      <View style={[styles.winnerTag, gone && { marginTop: 40 }]}>
        <Text style={styles.winnerTagText}>Νίκη για τον/την {winnerName}</Text>
      </View>
    </View>
  );
}

// Bid chip that pops in
function BidChip({ val, delay, selected, forbidden, enabled, onPick }) {
  const pop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(pop, { toValue: 1, delay, friction: 6, tension: 90, useNativeDriver: true }).start();
  }, [pop, delay]);
  return (
    <Animated.View style={{ transform: [{ scale: pop }] }}>
      <TouchableOpacity disabled={!enabled} onPress={onPick} activeOpacity={0.8}>
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
    </Animated.View>
  );
}

// ---------- screen ----------

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
  const [trickHalo, setTrickHalo] = useState(null); // playerIdx crowned after a trick
  const [roundSummary, setRoundSummary] = useState(null); // { round, results } shown between rounds
  const prevRoundRef = useRef(null);
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

  // Crown the trick winner with a halo for a couple of seconds
  const completedTrickWinner = actualState?.completedTrick?.winner;
  const completedTrickCount = (actualState?.tricksWon || []).reduce((a, b) => a + (b || 0), 0);
  useEffect(() => {
    if (completedTrickWinner === undefined || completedTrickWinner === null) return;
    setTrickHalo(completedTrickWinner);
    const t = setTimeout(() => setTrickHalo(null), 2600);
    return () => clearTimeout(t);
  }, [completedTrickWinner, completedTrickCount]);

  // When a round finishes (server advanced to the next one), celebrate it:
  // show every player's result with halos + fireworks for the winners.
  const liveRoundIdx = actualState?.roundIdx;
  useEffect(() => {
    if (liveRoundIdx === undefined || liveRoundIdx === null) return;
    const prev = prevRoundRef.current;
    prevRoundRef.current = liveRoundIdx;
    if (prev === null || liveRoundIdx !== prev + 1) return; // first load or reset
    const pd = gameData?.gameState?.playerData || [];
    const results = (gameData?.players || []).map((p, idx) => {
      const pred = pd[idx]?.predictions?.[prev];
      const tricks = pd[idx]?.tricks?.[prev];
      return {
        idx,
        name: p.username,
        pred, tricks,
        pts: pd[idx]?.points?.[prev] ?? 0,
        hit: pred !== undefined && pred !== null && pred === tricks,
      };
    });
    // let the last trick's sweep finish before the curtain rises
    const show = setTimeout(() => setRoundSummary({ round: prev, results }), 800);
    return () => clearTimeout(show);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveRoundIdx]);

  // auto-dismiss the round celebration
  useEffect(() => {
    if (!roundSummary) return;
    const t = setTimeout(() => setRoundSummary(null), 5200);
    return () => clearTimeout(t);
  }, [roundSummary]);

  // ---- Derived state ----
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

  const opponents = players.map((p, idx) => ({ p, idx })).filter(({ idx }) => idx !== myIdx);
  // x-offset of an opponent's medallion relative to screen center (for sweeps)
  const opponentSlot = useCallback((playerIdx) => {
    const o = opponents.findIndex(({ idx }) => idx === playerIdx);
    if (o === -1) return { x: 0 };
    return { x: (o - (opponents.length - 1) / 2) * 110 };
  }, [opponents]);

  // ---- Loading / error shells ----
  if (loading || !gameData) {
    return (
      <View style={styles.page}>
        <Header subtitle={`Τραπέζι ${gameId}`} onBack={() => navigation.goBack()} />
        <LinearGradient colors={[night.bgTop, night.bgMid, night.bgBottom]} style={styles.center}>
          {loading ? (
            <ActivityIndicator size="large" color={night.gold} />
          ) : (
            <View style={{ alignItems: 'center', paddingHorizontal: 24, alignSelf: 'stretch' }}>
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
      <TableArc top={SCREEN_H * 0.52} />
      <View style={{ alignItems: 'center', paddingTop: 26 }}>
        <Text style={styles.waitTitle}>Το τραπέζι ετοιμάζεται</Text>
        <Text style={styles.waitSub}>Μοιράσου τον κωδικό για να καθίσουν οι φίλοι σου</Text>
        <View style={styles.codePlate}>
          <Text style={styles.codeLabel}>ΚΩΔΙΚΟΣ ΤΡΑΠΕΖΙΟΥ</Text>
          <Text style={styles.codeValue}>{gameId}</Text>
        </View>
        <View style={styles.slotRow}>
          {Array(numPlayers).fill(null).map((_, idx) => {
            const p = players[idx];
            return (
              <View key={idx} style={styles.medallion}>
                {p ? (
                  <View style={[styles.medallionCircle, p.userId === user.id && styles.medallionTurn]}>
                    <Text style={styles.medallionInitial}>{p.username[0].toUpperCase()}</Text>
                  </View>
                ) : (
                  <View style={[styles.medallionCircle, styles.slotEmpty]}>
                    <Text style={{ color: night.goldBorder, fontSize: 24, fontWeight: '300' }}>+</Text>
                  </View>
                )}
                <Text style={styles.medallionName} numberOfLines={1}>{p ? p.username : 'Ελεύθερη'}</Text>
                <Text style={styles.medallionStats}>
                  {p ? (p.userId === gameData.hostId ? 'HOST' : 'ΕΤΟΙΜΟΣ') : `${players.length}/${numPlayers}`}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
      {/* deck resting on the table */}
      <View style={{ position: 'absolute', top: SCREEN_H * 0.56, alignSelf: 'center' }}>
        <CardBack width={76} style={{ transform: [{ rotate: '5deg' }], position: 'absolute', left: 8 }} />
        <CardBack width={76} style={{ transform: [{ rotate: '-4deg' }] }} />
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

  // ---- The fanned hand (dealt with stagger, keyed by round so each deal re-animates) ----
  const renderHand = (playable) => {
    const n = myHand.length;
    if (n === 0) return null;
    const spread = Math.min(52, 8.5 * Math.max(n - 1, 1));
    const step = n > 1 ? spread / (n - 1) : 0;
    const R = 330;
    return (
      <View key={`hand-${roundIdx}`} style={styles.handArea} pointerEvents="box-none">
        {myHand.map((card, i) => {
          const angle = -spread / 2 + i * step;
          const rad = (angle * Math.PI) / 180;
          const canPlay = playable && isCardPlayable(card);
          return (
            <HandCard
              key={`${card.suit}${card.value}`}
              card={card}
              x={Math.sin(rad) * R}
              y={(1 - Math.cos(rad)) * R}
              deg={angle}
              lift={canPlay}
              dealDelay={i * 70}
              playable={canPlay}
              dimmed={playable && !canPlay}
              onPlay={(c) => sendAction('play-card', { card: c })}
            />
          );
        })}
      </View>
    );
  };

  // ---- Trick area ----
  const renderTrick = () => {
    if (currentTrick.length === 0 && completedTrick) {
      return (
        <TrickSweep
          key={`sweep-${roundIdx}-${tricksWon.reduce((a, b) => a + b, 0)}`}
          trick={completedTrick.trick}
          winner={completedTrick.winner}
          winnerName={playerNames[completedTrick.winner]}
          myIdx={myIdx}
          opponentSlot={opponentSlot}
        />
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
            <TableCard
              key={`${play.card.suit}${play.card.value}`}
              card={play.card}
              deg={(idx - (currentTrick.length - 1) / 2) * 9}
              fromBottom={play.playerIdx === myIdx}
              highlighted={idx === 0}
              name={playerNames[play.playerIdx]}
            />
          ))}
        </View>
        {leadSuit && <Text style={[styles.tableHint, { marginTop: 10 }]}>ΑΚΟΛΟΥΘΗΣΕ {leadSuit}</Text>}
      </View>
    );
  };

  // ---- Bidding ----
  const renderBidding = () => (
    <View style={{ alignItems: 'center', paddingHorizontal: 20 }}>
      <Text style={styles.promptTitle}>
        {myTurn ? 'Πόσες νίκες θα κάνεις;' : `Προβλέπει ο/η ${playerNames[turn] || '...'}`}
      </Text>
      {myTurn && isLastPredictor && <Text style={styles.promptSub}>ΠΡΟΒΛΕΠΕΙΣ ΤΕΛΕΥΤΑΙΟΣ</Text>}
      <View style={styles.bidWrap}>
        {[...Array(cardsThisRound + 1).keys()].map((val) => {
          const forbidden = myTurn && isLastPredictor && val === forbiddenPrediction;
          return (
            <BidChip
              key={`${roundIdx}-${val}`}
              val={val}
              delay={val * 35}
              selected={predictions[myIdx] === val}
              forbidden={forbidden}
              enabled={myTurn && !forbidden && predictions[myIdx] == null}
              onPick={() => sendAction('predict', { value: val })}
            />
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
        <Fireworks />
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Τέλος Παιχνιδιού</Text>
          <Text style={styles.winnerLine}>
            {ranked.filter(r => r.isWinner).length > 1 ? 'ΝΙΚΗΤΕΣ' : 'ΝΙΚΗΤΗΣ'} · {(finalResult?.winners || []).join(', ').toUpperCase()}
          </Text>
          <View style={{ gap: 9, marginTop: 16 }}>
            {ranked.map((row) => (
              <View key={row.idx} style={[styles.rankRow, row.isWinner && styles.rankRowWinner]}>
                <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                  {row.isWinner && <Halo width={56} />}
                  <View style={[styles.medallionCircle, { width: 40, height: 40, borderRadius: 20 }, row.isWinner && styles.medallionTurn]}>
                    <Text style={[styles.medallionInitial, { fontSize: 16 }]}>{row.name[0]?.toUpperCase()}</Text>
                  </View>
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

  return (
    <View style={styles.page}>
      <Header subtitle={`Τραπέζι ${gameId}`} onBack={() => navigation.goBack()} />
      <View style={{ flex: 1 }}>
        <LinearGradient colors={[night.bgTop, night.bgMid, night.bgBottom]} style={StyleSheet.absoluteFill} />

        {!gameState.isGameStarted && !isCompleted ? renderWaiting() : (
          <View style={{ flex: 1 }}>
            <View style={styles.hudRow}>
              <NightChip label={`Γύρος ${roundIdx + 1}/${rounds.length || '—'}`} />
              <NightChip label={`${cardsThisRound} φύλλα`} />
              <NightChip gold label={`${trumpSuit} Ατού`} />
              <TouchableOpacity onPress={() => setShowScore(true)} activeOpacity={0.8}>
                <NightChip label="Σκορ" />
              </TouchableOpacity>
              <View style={[styles.connDot, { backgroundColor: connected ? '#4caf7d' : '#c0564c' }]} />
            </View>

            <View style={styles.medallionRow}>
              {opponents.map(({ p, idx }) => (
                <Medallion
                  key={idx}
                  name={p.username}
                  initial={p.username[0]?.toUpperCase()}
                  isTurn={turn === idx && phase !== 'game-over'}
                  halo={trickHalo === idx}
                  bid={predictions[idx]}
                  won={tricksWon[idx]}
                />
              ))}
            </View>

            <TableArc top={162} />

            {/* the deck resting at the top of the table */}
            {(phase === 'predicting' || phase === 'playing') && (
              <View style={{ position: 'absolute', top: 178, right: 26 }}>
                <CardBack width={46} style={{ transform: [{ rotate: '6deg' }], position: 'absolute', left: 5, top: 2 }} />
                <CardBack width={46} style={{ transform: [{ rotate: '-3deg' }] }} />
              </View>
            )}

            <View style={{ flex: 1, justifyContent: 'center', paddingBottom: 150 }}>
              {phase === 'predicting' && renderBidding()}
              {phase === 'playing' && renderTrick()}
              {phase === 'game-over' && (
                <Text style={styles.promptTitle}>Το παιχνίδι ολοκληρώθηκε</Text>
              )}
            </View>

            {trickHalo === myIdx && (
              <View pointerEvents="none" style={styles.myHalo}>
                <View style={{ width: 56, height: 56, alignItems: 'center', justifyContent: 'center' }}>
                  <Halo width={56} />
                  <Text style={{ fontSize: 22 }}>👑</Text>
                </View>
                <Text style={styles.myHaloText}>ΝΙΚΗ!</Text>
              </View>
            )}

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

            {renderHand(phase === 'playing')}
          </View>
        )}

        {/* round-end celebration: winners with halos + fireworks */}
        {roundSummary && (
          <Pressable style={styles.roundOverlay} onPress={() => setRoundSummary(null)}>
            <Fireworks bursts={7} sparksPerBurst={16} />
            <View style={styles.roundPanel}>
              <Text style={styles.roundOverlayTitle}>Γύρος {roundSummary.round + 1} ολοκληρώθηκε</Text>
              <Text style={styles.roundOverlaySub}>
                {roundSummary.results.some(r => r.hit) ? 'ΠΕΤΥΧΑΝ ΤΗΝ ΠΡΟΒΛΕΨΗ ΤΟΥΣ' : 'ΚΑΝΕΙΣ ΔΕΝ ΠΕΤΥΧΕ ΤΗΝ ΠΡΟΒΛΕΨΗ'}
              </Text>
              <View style={styles.roundWinnersRow}>
                {roundSummary.results.filter(r => r.hit).map((r) => (
                  <View key={r.idx} style={{ alignItems: 'center', width: 86 }}>
                    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                      <Halo width={82} />
                      <View style={[styles.medallionCircle, styles.medallionTurn, { width: 58, height: 58, borderRadius: 29 }]}>
                        <Text style={[styles.medallionInitial, { fontSize: 22 }]}>{r.name[0]?.toUpperCase()}</Text>
                      </View>
                    </View>
                    <Text style={[styles.medallionName, { color: night.goldBright, marginTop: 7 }]} numberOfLines={1}>
                      {r.name}{r.idx === myIdx ? ' (εσύ)' : ''}
                    </Text>
                    <Text style={styles.roundWinPts}>+{r.pts} π.</Text>
                  </View>
                ))}
              </View>
              <View style={{ gap: 6, marginTop: 16, alignSelf: 'stretch' }}>
                {roundSummary.results.map((r) => (
                  <View key={r.idx} style={styles.roundResultRow}>
                    <Text style={[styles.roundResultName, r.hit && { color: night.goldBright }]} numberOfLines={1}>
                      {r.name}{r.idx === myIdx ? ' (εσύ)' : ''}
                    </Text>
                    <Text style={styles.roundResultDetail}>
                      πρόβλεψη {r.pred ?? '—'} · νίκες {r.tricks ?? '—'}
                    </Text>
                    <Text style={[styles.roundResultPts, r.hit && { color: night.gold }]}>+{r.pts}</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.roundOverlayHint}>άγγιξε για συνέχεια</Text>
            </View>
          </Pressable>
        )}

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

  hudRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingTop: 12 },
  chip: {
    backgroundColor: night.glass, borderWidth: 1, borderColor: night.goldBorder,
    borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12,
  },
  chipGold: { backgroundColor: night.goldSoft, borderColor: night.gold },
  chipText: { color: night.text, fontSize: 12, fontWeight: '600' },
  chipTextGold: { color: night.gold, fontWeight: '700' },
  connDot: { width: 9, height: 9, borderRadius: 5, marginLeft: 'auto' },

  medallionRow: { flexDirection: 'row', justifyContent: 'center', gap: 26, paddingTop: 24 },
  myHalo: { position: 'absolute', bottom: 236, alignSelf: 'center', alignItems: 'center', zIndex: 20 },
  myHaloText: { color: night.goldBright, fontSize: 12, fontWeight: '800', letterSpacing: 2, marginTop: 4 },
  medallion: { alignItems: 'center', width: 84 },
  medallionCircle: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#1d2b33', borderWidth: 1.5, borderColor: night.goldBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  medallionTurn: {
    borderColor: night.gold, borderWidth: 2.5,
    shadowColor: night.gold, shadowOpacity: 0.8, shadowRadius: 12, shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  medallionInitial: { color: night.text, fontWeight: '700', fontSize: 20 },
  medallionName: { color: night.muted, fontSize: 11, fontWeight: '600', marginTop: 5 },
  medallionStats: { color: night.gold, fontSize: 11, fontWeight: '700', marginTop: 1 },
  slotEmpty: { borderStyle: 'dashed', backgroundColor: night.glassDim },

  tableArc: { position: 'absolute', left: -110, right: -110, bottom: 0, overflow: 'hidden' },
  tableArcFill: {
    flex: 1,
    borderTopLeftRadius: SCREEN_W, borderTopRightRadius: SCREEN_W,
    borderTopWidth: 2, borderColor: 'rgba(216,178,92,0.8)',
  },
  tableHint: { color: 'rgba(232,228,216,0.6)', fontSize: 12, fontWeight: '600', letterSpacing: 1.5, textAlign: 'center' },
  trickRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  trickName: { color: 'rgba(223,243,234,0.85)', fontSize: 10, marginTop: 3, maxWidth: 74, textAlign: 'center' },
  winnerTag: {
    marginTop: 12, backgroundColor: night.goldBright, borderRadius: 999,
    paddingVertical: 5, paddingHorizontal: 14, alignSelf: 'center',
  },
  winnerTagText: { color: '#241A05', fontWeight: '700', fontSize: 12 },

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

  statStrip: {
    position: 'absolute', bottom: 172, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 13,
    backgroundColor: 'rgba(10,18,16,0.8)', borderWidth: 1, borderColor: night.goldBorder,
    borderRadius: 14, paddingVertical: 7, paddingHorizontal: 16,
  },
  statCell: { alignItems: 'center' },
  statLabel: { color: night.muted, fontSize: 9, letterSpacing: 1.5, fontWeight: '600' },
  statValue: { fontFamily: displayFont, color: night.text, fontSize: 18 },
  statDivider: { width: 1, height: 26, backgroundColor: 'rgba(216,178,92,0.3)' },
  turnBadge: { color: night.gold, fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },

  handArea: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 170 },

  waitTitle: { fontFamily: displayFont, color: night.text, fontSize: 25, textAlign: 'center' },
  waitSub: { color: night.muted, fontSize: 13, marginTop: 6, textAlign: 'center' },
  codePlate: {
    marginTop: 22, backgroundColor: night.glass, borderWidth: 1.5, borderColor: night.goldBorderStrong,
    borderRadius: 16, paddingVertical: 13, paddingHorizontal: 26, alignItems: 'center',
    shadowColor: night.gold, shadowOpacity: 0.25, shadowRadius: 18, shadowOffset: { width: 0, height: 0 }, elevation: 6,
  },
  codeLabel: { color: night.muted, fontSize: 10, letterSpacing: 2, fontWeight: '600', textAlign: 'center' },
  codeValue: { fontFamily: displayFont, color: night.gold, fontSize: 29, letterSpacing: 5, marginTop: 2, textAlign: 'center' },
  slotRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 14, marginTop: 26, paddingHorizontal: 14 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(4,8,7,0.85)', alignItems: 'center', justifyContent: 'center', padding: 22 },
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

  btnGold: { height: 52, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  btnGoldGlow: { shadowColor: night.gold, shadowOpacity: 0.45, shadowRadius: 16, shadowOffset: { width: 0, height: 0 }, elevation: 8 },
  btnGoldText: { color: '#241A05', fontWeight: '800', fontSize: 14, letterSpacing: 1 },
  btnOutline: {
    height: 50, borderRadius: 13, alignItems: 'center', justifyContent: 'center',
    backgroundColor: night.glass, borderWidth: 1.5, borderColor: night.goldBorderStrong,
  },
  btnOutlineText: { color: night.gold, fontWeight: '700', fontSize: 13, letterSpacing: 1 },

  tr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: 'rgba(216,178,92,0.18)', paddingVertical: 7 },
  th: { color: night.text, fontWeight: '800', fontSize: 12 },
  td: { color: night.text, fontSize: 12 },
  cellRound: { width: 30, textAlign: 'center' },
  cellPlayer: { width: 96, textAlign: 'center' },
  scoreLegend: { color: night.mutedDark, fontSize: 11, marginTop: 10, textAlign: 'center' },

  roundOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(4,8,7,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 50,
  },
  roundPanel: { alignItems: 'center', alignSelf: 'stretch', maxWidth: 380 },
  roundOverlayTitle: { fontFamily: displayFont, color: night.text, fontSize: 26, textAlign: 'center' },
  roundOverlaySub: { color: night.muted, fontSize: 11, fontWeight: '700', letterSpacing: 2, marginTop: 6, textAlign: 'center' },
  roundWinnersRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 14, marginTop: 30 },
  roundWinPts: { fontFamily: displayFont, color: night.gold, fontSize: 17, marginTop: 2 },
  roundResultRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(216,178,92,0.25)',
    borderRadius: 11, paddingVertical: 8, paddingHorizontal: 13,
  },
  roundResultName: { flex: 1, color: night.text, fontWeight: '700', fontSize: 14 },
  roundResultDetail: { color: night.muted, fontSize: 12, marginRight: 10 },
  roundResultPts: { fontFamily: displayFont, color: night.text, fontSize: 17, minWidth: 40, textAlign: 'right' },
  roundOverlayHint: { color: night.mutedDark, fontSize: 11, marginTop: 20 },
  toast: {
    position: 'absolute', top: 60, alignSelf: 'center',
    backgroundColor: night.dangerBg, borderWidth: 1, borderColor: night.dangerBorder,
    borderRadius: 10, paddingVertical: 8, paddingHorizontal: 16, maxWidth: '88%',
  },
  toastText: { color: '#f3d5cf', fontSize: 13, fontWeight: '600', textAlign: 'center' },
});
