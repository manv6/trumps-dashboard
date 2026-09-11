import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal,
  ActivityIndicator, Animated, Easing, Dimensions, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import io from 'socket.io-client';
import { useAuth } from '../AuthContext';
import { SERVER_URL } from '../config';
import Header from '../components/Header';
import Halo from '../components/effects/Halo';
import Fireworks from '../components/effects/Fireworks';
import { night, displayFont } from '../theme';

const SCREEN_W = Dimensions.get('window').width;

function NightChip({ label, gold, style }) {
  return (
    <View style={[styles.chip, gold && styles.chipGold, style]}>
      <Text style={[styles.chipText, gold && styles.chipTextGold]}>{label}</Text>
    </View>
  );
}

function GoldButton({ title, onPress, disabled, outline, danger, small, style }) {
  if (outline || danger) {
    return (
      <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.8}
        style={[styles.btnOutline, small && styles.btnSmall, danger && styles.btnDanger, disabled && { opacity: 0.5 }, style]}>
        <Text style={[styles.btnOutlineText, small && styles.btnTextSmall, danger && { color: night.danger }]}>{title}</Text>
      </TouchableOpacity>
    );
  }
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.85} style={style}>
      <LinearGradient colors={disabled ? ['#3a3428', '#2a251b'] : [night.goldBright, night.gold, night.goldDark]}
        style={[styles.btnGold, small && styles.btnSmall, !disabled && styles.btnGoldGlow]}>
        <Text style={[styles.btnGoldText, small && styles.btnTextSmall, disabled && { color: night.mutedDark }]}>{title}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

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
        transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.4] }) }],
      }}
    />
  );
}

// A tappable game value badge (Π or Ν) — replaces the old text inputs.
function ValueBadge({ label, value, mine, active, onPress }) {
  return (
    <TouchableOpacity disabled={!onPress} onPress={onPress} activeOpacity={0.75}>
      <View style={{ alignItems: 'center' }}>
        <Text style={styles.badgeLabel}>{label}</Text>
        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
          {active && <PulseRing size={46} />}
          <View style={[
            styles.badge,
            mine && styles.badgeMine,
            active && styles.badgeActive,
            value === undefined && styles.badgeEmpty,
          ]}>
            <Text style={[styles.badgeText, value === undefined && { color: night.mutedDark }]}>
              {value === undefined ? '·' : value}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// Scoreboard mode: a Midnight-styled score sheet. The HOST keeps the sheet
// for everyone (and can reorder seats); players may fill their own line.
// Values are picked from gold chips — no keyboard anywhere.
export default function ScoreGameScreen({ route, navigation }) {
  const { gameId } = route.params;
  const { user, joinGame, completeGame } = useAuth();

  const [gameData, setGameData] = useState(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewRound, setViewRound] = useState(null); // null = follow currentRound
  const [picker, setPicker] = useState(null); // { type: 'pred'|'tricks', playerIdx }
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

  // ---- Game intelligence (same rules as the web scoreboard) ----
  const firstPlayerIdx = shownRound % numPlayers;
  const lastPlayerIdx = (firstPlayerIdx - 1 + numPlayers) % numPlayers;
  const predictionOrder = Array(numPlayers).fill(0).map((_, i) => (firstPlayerIdx + i) % numPlayers);

  const predOf = (pIdx, r = shownRound) => {
    const v = playerData[pIdx]?.predictions?.[r];
    return v === undefined || v === null || v === '' ? undefined : v;
  };
  const tricksOf = (pIdx, r = shownRound) => {
    const v = playerData[pIdx]?.tricks?.[r];
    return v === undefined || v === null || v === '' ? undefined : v;
  };

  // whose turn to predict (first empty in rotation order)
  const activePredictor = predictionOrder.find((pi) => predOf(pi) === undefined);
  const allPredsDone = activePredictor === undefined;

  // forbidden value for the LAST predictor: total may not equal the cards
  const sumBefore = (targetIdx) => {
    let sum = 0;
    for (const pi of predictionOrder) {
      if (pi === targetIdx) break;
      sum += predOf(pi) ?? 0;
    }
    return sum;
  };
  const forbiddenFor = (pIdx) => (pIdx === lastPlayerIdx ? cards - sumBefore(pIdx) : null);

  const sumPreds = predictionOrder.reduce((a, pi) => a + (predOf(pi) ?? 0), 0);

  const totalPoints = (pIdx) =>
    (playerData[pIdx]?.points || []).reduce((a, b) => a + (b || 0), 0);

  const isHost = gameData?.hostId === user.id;

  const submitValue = (type, value, playerIdx) => {
    sendAction(type === 'pred' ? 'update-prediction' : 'update-tricks', {
      roundIdx: shownRound,
      playerIdx,
      value,
    });
    setPicker(null);
  };

  const openPicker = (type, playerIdx) => {
    if (type === 'tricks' && !allPredsDone) {
      setError('Πρώτα οι προβλέψεις όλων, μετά οι νίκες');
      return;
    }
    setPicker({ type, playerIdx });
  };

  const leaveTable = () => {
    if (socketRef.current?.connected) socketRef.current.emit('leave-game', { gameId });
    navigation.goBack();
  };

  const confirmExit = () => {
    const buttons = [
      { text: 'Ακύρωση', style: 'cancel' },
      { text: 'Έξοδος', onPress: leaveTable },
    ];
    if (isHost && !gameState.isGameCompleted) {
      buttons.push({
        text: 'Τερματισμός τραπεζιού',
        style: 'destructive',
        onPress: async () => { await completeGame(gameId); navigation.goBack(); },
      });
    }
    Alert.alert('Έξοδος από το τραπέζι', 'Τι θέλεις να κάνεις;', buttons);
  };

  if (loading || !gameData) {
    return (
      <View style={styles.page}>
        <Header subtitle={`Σκορ ${gameId}`} onBack={() => navigation.goBack()} />
        <LinearGradient colors={[night.bgTop, night.bgMid, night.bgBottom]} style={styles.center}>
          {loading ? (
            <ActivityIndicator size="large" color={night.gold} />
          ) : (
            <View style={{ alignItems: 'stretch', paddingHorizontal: 24, alignSelf: 'stretch' }}>
              <Text style={styles.errorBig}>{error || 'Το παιχνίδι δεν βρέθηκε'}</Text>
              <GoldButton title="ΠΙΣΩ ΣΤΟ LOBBY" onPress={() => navigation.goBack()} style={{ marginTop: 18 }} />
            </View>
          )}
        </LinearGradient>
      </View>
    );
  }

  const standings = players
    .map((p, idx) => ({ name: p.username, pts: totalPoints(idx), idx }))
    .sort((a, b) => b.pts - a.pts);
  const leaderIdx = standings[0]?.pts > 0 ? standings[0].idx : -1;

  return (
    <View style={styles.page}>
      <Header subtitle={`Σκορ ${gameId}`} onBack={() => navigation.goBack()} />
      <View style={{ flex: 1 }}>
        <LinearGradient colors={[night.bgTop, night.bgMid, night.bgBottom]} style={StyleSheet.absoluteFill} />
        {/* felt table backdrop */}
        <View pointerEvents="none" style={styles.tableArc}>
          <LinearGradient colors={[night.tableTop, night.tableMid, night.tableEdge]} style={styles.tableArcFill} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.topRow}>
            <NightChip label={`Γύρος ${shownRound + 1}/${rounds.length}`} />
            <NightChip label={`${cards} φύλλα`} />
            <NightChip gold label={`Σύνολο ${sumPreds}/${cards}`} />
            <TouchableOpacity onPress={confirmExit} activeOpacity={0.8}>
              <NightChip label="Έξοδος" />
            </TouchableOpacity>
            <View style={[styles.connDot, { backgroundColor: connected ? '#4caf7d' : '#c0564c' }]} />
          </View>
          {shownRound !== currentRound && (
            <Text style={styles.viewingPast}>Βλέπεις τον γύρο {shownRound + 1} — ο τρέχων είναι ο {currentRound + 1}</Text>
          )}

          <Text style={styles.turnLine}>Φύλλο Σκορ</Text>
          <Text style={styles.orderLine}>
            Σειρά: {predictionOrder.map((pi) => players[pi]?.username?.split(' ')[0]).join(' → ')}
            {isHost ? '  ·  ως host γράφεις για όλους' : ''}
          </Text>

          {/* player rows */}
          <View style={{ gap: 9, marginTop: 14 }}>
            {players.map((p, idx) => {
              const mine = idx === myIdx;
              const canEdit = isHost || mine;
              const pred = predOf(idx);
              const tricks = tricksOf(idx);
              const pts = playerData[idx]?.points?.[shownRound];
              const isLast = idx === lastPlayerIdx;
              const forb = isLast && pred === undefined ? forbiddenFor(idx) : null;
              return (
                <View key={idx} style={[styles.playerCard, mine && styles.playerCardMine]}>
                  <View style={{ alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                    {idx === leaderIdx && <Halo width={54} />}
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{p.username[0]?.toUpperCase()}</Text>
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.playerName, mine && { color: night.goldBright }]} numberOfLines={1}>
                      {p.username}{mine ? ' (εσύ)' : ''}
                    </Text>
                    <Text style={styles.playerMeta}>
                      {idx === firstPlayerIdx ? 'πρώτος · ' : ''}{isLast ? 'τελευταίος · ' : ''}{totalPoints(idx)} π. σύνολο
                    </Text>
                    {forb !== null && forb >= 0 && forb <= cards && (
                      <Text style={styles.forbHint}>ΟΧΙ {forb} — το σύνολο δεν γίνεται {cards}</Text>
                    )}
                    {pts !== undefined && (
                      <Text style={[styles.roundPts, pred !== undefined && pred === tricks && { color: night.gold }]}>
                        {pred !== undefined && pred === tricks ? `πέτυχε! +${pts} π.` : `+${pts} π. στον γύρο`}
                      </Text>
                    )}
                    {isHost && idx > 0 && (
                      <TouchableOpacity
                        onPress={() => {
                          const order = players.map((_, i) => i);
                          [order[idx - 1], order[idx]] = [order[idx], order[idx - 1]];
                          sendAction('set-seats', { order });
                        }}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Text style={styles.seatMoveText}>↑ μετακίνηση πιο νωρίς</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <ValueBadge
                      label="ΠΡΟΒΛΕΨΗ" value={pred} mine={canEdit}
                      active={false}
                      onPress={canEdit ? () => openPicker('pred', idx) : undefined}
                    />
                    <ValueBadge
                      label="ΝΙΚΕΣ" value={tricks} mine={canEdit}
                      active={false}
                      onPress={canEdit && allPredsDone ? () => openPicker('tricks', idx) : undefined}
                    />
                  </View>
                </View>
              );
            })}
          </View>

          {/* round navigation */}
          <View style={styles.navRow}>
            <GoldButton title="‹ ΠΡΟΗΓ." outline small disabled={shownRound === 0} onPress={() => setViewRound(shownRound - 1)} />
            {shownRound !== currentRound ? (
              <GoldButton title="ΤΡΕΧΩΝ ΓΥΡΟΣ" small onPress={() => setViewRound(null)} />
            ) : (
              <GoldButton
                title={currentRound === rounds.length - 1 ? 'ΟΛΟΚΛΗΡΩΣΗ ΠΑΙΧΝΙΔΙΟΥ' : 'ΕΠΟΜΕΝΟΣ ΓΥΡΟΣ ›'} small
                disabled={currentRound >= rounds.length}
                onPress={() => { sendAction('advance-round'); setViewRound(null); }}
              />
            )}
            {shownRound === currentRound && currentRound > 0 && (
              <GoldButton title="‹ ΔΙΟΡΘΩΣΗ" danger small onPress={() => { sendAction('go-back-round'); setViewRound(null); }} />
            )}
          </View>

          {/* standings */}
          <Text style={styles.standTitle}>Κατάταξη</Text>
          <View style={{ gap: 7 }}>
            {standings.map((row, rank) => (
              <View key={row.idx} style={[styles.standRow, rank === 0 && styles.standRowFirst]}>
                <Text style={[styles.standRank, rank === 0 && { color: night.gold }]}>{rank + 1}</Text>
                <Text style={[styles.standName, row.idx === myIdx && { color: night.goldBright }]}>
                  {row.name}{row.idx === myIdx ? ' (εσύ)' : ''}
                </Text>
                <Text style={[styles.standPts, rank === 0 && { color: night.gold }]}>{row.pts} π.</Text>
              </View>
            ))}
          </View>
        </ScrollView>

        {error ? (
          <View style={styles.toast}>
            <Text style={styles.toastText}>{error}</Text>
          </View>
        ) : null}
      </View>

      {/* end of game: fireworks + final standings */}
      {gameState.isGameCompleted && (
        <View style={styles.endOverlay} pointerEvents="box-none">
          <Fireworks />
          <View style={styles.endPanel}>
            <Text style={styles.pickerTitle}>Τέλος Παιχνιδιού</Text>
            <Text style={styles.endWinnerLine}>
              ΝΙΚΗΤΗΣ · {standings[0]?.name?.toUpperCase() || '—'}
            </Text>
            <View style={{ gap: 8, marginTop: 16, alignSelf: 'stretch' }}>
              {standings.map((row, rank) => (
                <View key={row.idx} style={[styles.standRow, rank === 0 && styles.standRowFirst]}>
                  {rank === 0 && (
                    <View style={{ width: 30, alignItems: 'center', justifyContent: 'center' }}>
                      <Halo width={30} />
                    </View>
                  )}
                  {rank !== 0 && <Text style={styles.standRank}>{rank + 1}</Text>}
                  <Text style={[styles.standName, row.idx === myIdx && { color: night.goldBright }]}>
                    {row.name}{row.idx === myIdx ? ' (εσύ)' : ''}
                  </Text>
                  <Text style={[styles.standPts, rank === 0 && { color: night.gold }]}>{row.pts} π.</Text>
                </View>
              ))}
            </View>
            <GoldButton title="ΠΙΣΩ ΣΤΟ LOBBY" onPress={() => navigation.goBack()} style={{ marginTop: 18, alignSelf: 'stretch' }} />
          </View>
        </View>
      )}

      {/* chip picker — the game way to enter a value */}
      <Modal visible={!!picker} transparent animationType="fade" onRequestClose={() => setPicker(null)}>
        <TouchableOpacity style={styles.pickerBackdrop} activeOpacity={1} onPress={() => setPicker(null)}>
          <View style={styles.pickerPanel}>
            <Text style={styles.pickerTitle}>
              {picker?.type === 'pred' ? 'Πρόβλεψη' : 'Νίκες'} — {players[picker?.playerIdx]?.username || ''}
            </Text>
            <Text style={styles.pickerSub}>Γύρος {shownRound + 1} · {cards} φύλλα</Text>
            <View style={styles.pickerWrap}>
              {[...Array(cards + 1).keys()].map((val) => {
                const targetIdx = picker?.playerIdx ?? myIdx;
                const forb = picker?.type === 'pred' ? forbiddenFor(targetIdx) : null;
                const isForbidden = forb !== null && val === forb && forb >= 0;
                const current = picker?.type === 'pred' ? predOf(targetIdx) : tricksOf(targetIdx);
                const selected = current === val;
                return (
                  <TouchableOpacity
                    key={val}
                    disabled={isForbidden}
                    onPress={() => submitValue(picker.type, val, picker.playerIdx)}
                    activeOpacity={0.8}
                  >
                    {selected ? (
                      <LinearGradient colors={[night.goldBright, night.gold, night.goldDark]} style={styles.pickChip}>
                        <Text style={[styles.pickChipText, { color: '#241A05', fontWeight: '800' }]}>{val}</Text>
                      </LinearGradient>
                    ) : (
                      <View style={[styles.pickChip, isForbidden ? styles.pickChipForbidden : styles.pickChipOpen]}>
                        <Text style={[styles.pickChipText, isForbidden && { color: night.mutedDark }]}>{val}</Text>
                        {isForbidden && <View style={styles.pickChipStrike} />}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity onPress={() => submitValue(picker.type, undefined, picker?.playerIdx)}>
              <Text style={styles.pickerClear}>Καθάρισε την τιμή</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: night.bgBottom },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorBig: { color: night.danger, fontSize: 16, fontWeight: '600', textAlign: 'center' },
  scroll: { padding: 16, paddingBottom: 46 },

  tableArc: { position: 'absolute', left: -110, right: -110, top: 210, bottom: 0, overflow: 'hidden' },
  tableArcFill: {
    flex: 1,
    borderTopLeftRadius: SCREEN_W, borderTopRightRadius: SCREEN_W,
    borderTopWidth: 2, borderColor: 'rgba(216,178,92,0.55)',
  },

  topRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 10 },
  chip: {
    backgroundColor: night.glass, borderWidth: 1, borderColor: night.goldBorder,
    borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12,
  },
  chipGold: { backgroundColor: night.goldSoft, borderColor: night.gold },
  chipText: { color: night.text, fontSize: 12, fontWeight: '600' },
  chipTextGold: { color: night.gold, fontWeight: '700' },
  connDot: { width: 9, height: 9, borderRadius: 5, marginLeft: 'auto' },
  viewingPast: { color: night.gold, fontWeight: '600', marginBottom: 6, fontSize: 12 },

  turnLine: { fontFamily: displayFont, color: night.text, fontSize: 21, textAlign: 'center', marginTop: 8 },
  orderLine: { color: night.mutedDark, fontSize: 11, textAlign: 'center', marginTop: 4, letterSpacing: 0.5 },

  playerCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(10,20,17,0.82)', borderWidth: 1, borderColor: 'rgba(216,178,92,0.25)',
    borderRadius: 15, paddingVertical: 11, paddingHorizontal: 13,
  },
  playerCardMine: { borderColor: night.goldBorderStrong },
  playerCardActive: {
    borderColor: night.gold, borderWidth: 1.5,
    shadowColor: night.gold, shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 0 }, elevation: 7,
  },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#1d2b33', borderWidth: 1.5, borderColor: night.goldBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarActive: { borderColor: night.gold, borderWidth: 2 },
  avatarText: { color: night.text, fontWeight: '700', fontSize: 16 },
  playerName: { color: night.text, fontWeight: '700', fontSize: 15 },
  playerMeta: { color: night.muted, fontSize: 11, marginTop: 2 },
  forbHint: { color: night.danger, fontSize: 11, fontWeight: '700', marginTop: 3 },
  roundPts: { color: night.muted, fontSize: 11, fontWeight: '700', marginTop: 3 },

  badgeLabel: { color: night.mutedDark, fontSize: 8.5, fontWeight: '700', letterSpacing: 1, marginBottom: 3 },
  badge: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: night.glass, borderWidth: 1.5, borderColor: night.goldBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  badgeMine: { borderColor: night.gold, backgroundColor: night.goldSoft },
  badgeActive: { borderWidth: 2, borderColor: night.gold },
  badgeEmpty: { borderStyle: 'dashed' },
  badgeText: { fontFamily: displayFont, color: night.text, fontSize: 18 },

  navRow: { flexDirection: 'row', gap: 8, marginTop: 16, flexWrap: 'wrap' },
  btnGold: { height: 50, borderRadius: 13, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  btnGoldGlow: { shadowColor: night.gold, shadowOpacity: 0.4, shadowRadius: 13, shadowOffset: { width: 0, height: 0 }, elevation: 7 },
  btnGoldText: { color: '#241A05', fontWeight: '800', fontSize: 13, letterSpacing: 1 },
  btnOutline: {
    height: 50, borderRadius: 13, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16,
    backgroundColor: night.glass, borderWidth: 1.5, borderColor: night.goldBorderStrong,
  },
  btnDanger: { borderColor: night.dangerBorder, backgroundColor: night.dangerBg },
  btnOutlineText: { color: night.gold, fontWeight: '700', fontSize: 12, letterSpacing: 1 },
  btnSmall: { height: 40, borderRadius: 11, paddingHorizontal: 13 },
  btnTextSmall: { fontSize: 11.5 },

  standTitle: { fontFamily: displayFont, color: night.text, fontSize: 19, marginTop: 22, marginBottom: 9 },
  standRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(10,20,17,0.7)', borderWidth: 1, borderColor: 'rgba(216,178,92,0.2)',
    borderRadius: 12, paddingVertical: 9, paddingHorizontal: 13,
  },
  standRowFirst: { borderColor: night.gold, backgroundColor: night.goldSoft },
  standRank: { width: 28, fontFamily: displayFont, fontSize: 16, color: night.muted },
  standName: { flex: 1, fontWeight: '700', color: night.text, fontSize: 14 },
  standPts: { fontFamily: displayFont, color: night.text, fontSize: 16 },

  pickerBackdrop: { flex: 1, backgroundColor: 'rgba(4,8,7,0.85)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  pickerPanel: {
    alignSelf: 'stretch', backgroundColor: night.panel, borderWidth: 1.5, borderColor: night.goldBorderStrong,
    borderRadius: 20, padding: 22, alignItems: 'center',
  },
  pickerTitle: { fontFamily: displayFont, color: night.text, fontSize: 22, textAlign: 'center' },
  pickerSub: { color: night.muted, fontSize: 12, marginTop: 4 },
  pickerWrap: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 11, marginTop: 18 },
  pickChip: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  pickChipOpen: { backgroundColor: night.glass, borderWidth: 1.5, borderColor: night.gold, borderStyle: 'dashed' },
  pickChipForbidden: { backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  pickChipText: { color: night.text, fontSize: 19, fontWeight: '700' },
  pickChipStrike: { position: 'absolute', width: 38, height: 2, borderRadius: 2, backgroundColor: '#8a4a42', transform: [{ rotate: '-45deg' }] },
  pickerClear: { color: night.mutedDark, fontSize: 12, fontWeight: '600', marginTop: 18, textDecorationLine: 'underline' },

  endOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(4,8,7,0.92)',
    alignItems: 'center', justifyContent: 'center', padding: 24, zIndex: 60,
  },
  endPanel: {
    alignSelf: 'stretch', backgroundColor: night.panel, borderWidth: 1.5, borderColor: night.goldBorderStrong,
    borderRadius: 20, padding: 22, alignItems: 'center',
  },
  endWinnerLine: { color: night.gold, fontSize: 12, fontWeight: '700', letterSpacing: 2, marginTop: 5 },
  toast: {
    position: 'absolute', top: 60, alignSelf: 'center',
    backgroundColor: night.dangerBg, borderWidth: 1, borderColor: night.dangerBorder,
    borderRadius: 10, paddingVertical: 8, paddingHorizontal: 16, maxWidth: '88%',
  },
  toastText: { color: '#f3d5cf', fontSize: 13, fontWeight: '600', textAlign: 'center' },
});
