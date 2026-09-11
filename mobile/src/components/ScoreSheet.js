import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { night, displayFont } from '../theme';

// One player's total as a growing gold race bar.
function RaceBar({ name, initial, score, maxScore, rank, isMe, delay }) {
  const grow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(grow, {
      toValue: 1, duration: 750, delay,
      easing: Easing.out(Easing.cubic), useNativeDriver: false,
    }).start();
  }, [grow, delay]);

  const pct = maxScore > 0 ? Math.max(score / maxScore, 0.06) : 0.06;
  const first = rank === 0;

  return (
    <View style={styles.raceRow}>
      <View style={[styles.raceAvatar, first && styles.raceAvatarFirst]}>
        <Text style={styles.raceAvatarText}>{initial}</Text>
      </View>
      <View style={{ flex: 1, marginHorizontal: 10 }}>
        <Text style={[styles.raceName, isMe && { color: night.goldBright }]} numberOfLines={1}>
          {name}{isMe ? ' (εσύ)' : ''}
        </Text>
        <View style={styles.raceTrack}>
          <Animated.View style={{ width: grow.interpolate({ inputRange: [0, 1], outputRange: ['0%', `${pct * 100}%`] }) }}>
            <LinearGradient
              colors={first ? [night.goldBright, night.gold, night.goldDark] : ['#3d5a50', '#28423a']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={[styles.raceFill, first && styles.raceFillFirst]}
            />
          </Animated.View>
        </View>
      </View>
      <Text style={[styles.raceScore, first && { color: night.gold }]}>{score}</Text>
    </View>
  );
}

// A single round cell for one player: prediction/wins pill.
// gold = nailed the bid, glass = missed, dashed = not played yet.
function RoundCell({ pred, tricks, pts, hit, pending }) {
  if (pending) {
    return (
      <View style={styles.cell}>
        <View style={[styles.pill, styles.pillPending]}>
          <Text style={styles.pillPendingText}>{pred !== undefined ? pred : '·'}</Text>
        </View>
      </View>
    );
  }
  if (hit) {
    return (
      <View style={styles.cell}>
        <LinearGradient colors={[night.goldBright, night.gold]} style={styles.pill}>
          <Text style={styles.pillHitText}>{pred}/{tricks}</Text>
        </LinearGradient>
        <Text style={styles.cellPts}>+{pts}</Text>
      </View>
    );
  }
  return (
    <View style={styles.cell}>
      <View style={[styles.pill, styles.pillMiss]}>
        <Text style={styles.pillMissText}>{pred ?? '—'}/{tricks ?? '—'}</Text>
      </View>
      <Text style={styles.cellPtsDim}>{pts !== undefined ? `+${pts}` : ' '}</Text>
    </View>
  );
}

// The full score sheet: a totals race up top, then the round-by-round grid —
// gold pills where a bid was nailed, the current round framed in gold.
export default function ScoreSheet({
  players, playerData, rounds, currentRound, isCompleted, myIdx,
  livePredictions, liveTricks,
}) {
  const names = players.map((p) => p.username);
  const totals = names.map((_, i) =>
    (playerData?.[i]?.points || []).reduce((a, b) => a + (b || 0), 0));
  const maxTotal = Math.max(...totals, 1);
  const ranked = names
    .map((name, idx) => ({ name, idx, score: totals[idx] }))
    .sort((a, b) => b.score - a.score);

  const val = (v) => (v === undefined || v === null || v === '' ? undefined : v);

  return (
    <View>
      {/* totals race */}
      <View style={{ gap: 9 }}>
        {ranked.map((row, rank) => (
          <RaceBar
            key={row.idx}
            name={row.name}
            initial={row.name[0]?.toUpperCase()}
            score={row.score}
            maxScore={maxTotal}
            rank={rank}
            isMe={row.idx === myIdx}
            delay={rank * 120}
          />
        ))}
      </View>

      {/* round grid */}
      <Text style={styles.gridTitle}>ΓΥΡΟΙ</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View style={styles.gridHead}>
            <View style={styles.roundCol}>
              <Text style={styles.gridHeadText}>Γ</Text>
            </View>
            {names.map((name, i) => (
              <View key={i} style={styles.playerCol}>
                <View style={[styles.headAvatar, i === myIdx && styles.headAvatarMe]}>
                  <Text style={styles.headAvatarText}>{name[0]?.toUpperCase()}</Text>
                </View>
              </View>
            ))}
          </View>
          {rounds.map((cards, rIdx) => {
            const isCur = rIdx === currentRound && !isCompleted;
            const isFuture = rIdx > currentRound && !isCompleted;
            return (
              <View key={rIdx} style={[styles.gridRow, isCur && styles.gridRowCurrent]}>
                <View style={styles.roundCol}>
                  <Text style={[styles.roundNum, isCur && { color: night.gold }]}>{rIdx + 1}</Text>
                  <Text style={styles.roundCards}>{cards}♠</Text>
                </View>
                {names.map((_, pIdx) => {
                  const pd = playerData?.[pIdx] || {};
                  const pred = isCur && livePredictions
                    ? val(livePredictions[pIdx]) : val(pd.predictions?.[rIdx]);
                  const tricks = isCur && liveTricks
                    ? val(liveTricks[pIdx]) : val(pd.tricks?.[rIdx]);
                  const pts = pd.points?.[rIdx];
                  const settled = pts !== undefined && !isCur;
                  const hit = settled && val(pd.predictions?.[rIdx]) === val(pd.tricks?.[rIdx]);
                  return (
                    <View key={pIdx} style={styles.playerCol}>
                      <RoundCell
                        pred={pred}
                        tricks={tricks}
                        pts={pts}
                        hit={hit}
                        pending={isFuture || (!settled && !isCur) || (isCur && tricks === undefined)}
                      />
                    </View>
                  );
                })}
              </View>
            );
          })}
        </View>
      </ScrollView>
      <Text style={styles.legend}>χρυσό = πέτυχε την πρόβλεψη · π/ν = πρόβλεψη/νίκες</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // race
  raceRow: { flexDirection: 'row', alignItems: 'center' },
  raceAvatar: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#1d2b33', borderWidth: 1.5, borderColor: night.goldBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  raceAvatarFirst: {
    borderColor: night.gold,
    shadowColor: night.gold, shadowOpacity: 0.7, shadowRadius: 9,
    shadowOffset: { width: 0, height: 0 }, elevation: 7,
  },
  raceAvatarText: { color: night.text, fontWeight: '700', fontSize: 14 },
  raceName: { color: night.text, fontSize: 12, fontWeight: '700', marginBottom: 4 },
  raceTrack: {
    height: 12, borderRadius: 6, overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(216,178,92,0.2)',
  },
  raceFill: { height: '100%', borderRadius: 6 },
  raceFillFirst: {},
  raceScore: { fontFamily: displayFont, color: night.text, fontSize: 20, minWidth: 42, textAlign: 'right' },

  // grid
  gridTitle: { color: night.muted, fontSize: 10, letterSpacing: 2, fontWeight: '700', marginTop: 20, marginBottom: 8 },
  gridHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  gridHeadText: { color: night.mutedDark, fontWeight: '800', fontSize: 11 },
  headAvatar: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#1d2b33', borderWidth: 1.5, borderColor: night.goldBorder,
    alignItems: 'center', justifyContent: 'center', alignSelf: 'center',
  },
  headAvatarMe: { borderColor: night.gold },
  headAvatarText: { color: night.text, fontWeight: '700', fontSize: 12 },
  roundCol: { width: 40, alignItems: 'center', justifyContent: 'center' },
  playerCol: { width: 66, alignItems: 'center' },
  gridRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 5,
    borderRadius: 10,
  },
  gridRowCurrent: {
    backgroundColor: 'rgba(216,178,92,0.08)',
    borderWidth: 1, borderColor: 'rgba(216,178,92,0.45)',
  },
  roundNum: { fontFamily: displayFont, color: night.muted, fontSize: 14 },
  roundCards: { color: night.mutedDark, fontSize: 9 },
  cell: { alignItems: 'center' },
  pill: {
    minWidth: 46, height: 26, borderRadius: 13, paddingHorizontal: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  pillPending: { borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(216,178,92,0.35)', backgroundColor: 'rgba(255,255,255,0.02)' },
  pillPendingText: { color: night.mutedDark, fontSize: 12, fontWeight: '700' },
  pillMiss: { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  pillMissText: { color: night.text, fontSize: 12, fontWeight: '700' },
  pillHitText: { color: '#241A05', fontSize: 12, fontWeight: '800' },
  cellPts: { color: night.gold, fontSize: 9, fontWeight: '800', marginTop: 2 },
  cellPtsDim: { color: night.mutedDark, fontSize: 9, marginTop: 2 },
  legend: { color: night.mutedDark, fontSize: 10.5, marginTop: 12, textAlign: 'center' },
});
