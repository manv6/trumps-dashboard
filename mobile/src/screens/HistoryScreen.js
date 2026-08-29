import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useAuth } from '../AuthContext';
import Header from '../components/Header';
import { Card, Chip } from '../components/UI';
import { colors } from '../theme';

export default function HistoryScreen({ navigation }) {
  const { getActualGameHistory } = useAuth();
  const [games, setGames] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = async () => {
    const result = await getActualGameHistory();
    setGames(result.games || []);
    setLoaded(true);
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <View style={styles.page}>
      <Header subtitle="Ιστορικό" onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={styles.title}>🃏 Ολοκληρωμένα Live Παιχνίδια</Text>
        {loaded && games.length === 0 && (
          <Card><Text style={styles.empty}>Κανένα ολοκληρωμένο παιχνίδι ακόμα.</Text></Card>
        )}
        {games.map((game, idx) => (
          <Card key={game.gameId || idx} style={styles.gameCard}>
            <View style={styles.rowBetween}>
              <Text style={styles.gameId}>{game.gameId}</Text>
              <Text style={styles.date}>
                {game.completedAt ? new Date(game.completedAt).toLocaleDateString('el-GR') : ''}
              </Text>
            </View>
            <Text style={styles.players}>{(game.playerNames || []).join(', ')}</Text>
            <View style={styles.resultRow}>
              <Chip
                label={`🏆 ${(game.winners || []).join(', ') || '—'}`}
                color={colors.goldSoft}
                textColor={colors.gold}
              />
              <Text style={styles.scores}>{(game.scores || []).join(' · ')}</Text>
            </View>
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.ivory },
  scroll: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 12 },
  empty: { color: colors.textMuted },
  gameCard: { marginBottom: 10 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  gameId: { fontWeight: '800', color: colors.text },
  date: { color: colors.textMuted, fontSize: 12 },
  players: { color: colors.textMuted, marginTop: 4, fontSize: 13 },
  resultRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  scores: { fontWeight: '700', color: colors.text },
});
