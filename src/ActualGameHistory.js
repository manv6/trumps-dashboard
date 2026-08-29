import React, { useEffect, useState } from 'react';
import { Paper, Typography, Box, CircularProgress, Alert, Table, TableHead, TableRow, TableCell, TableBody } from '@mui/material';
import { useAuth } from './AuthContext';

export default function ActualGameHistory() {
  const { user, getActualGameHistory } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [games, setGames] = useState([]);

  useEffect(() => {
    async function fetchHistory() {
      setLoading(true);
      setError('');
      try {
        // You may need to implement getActualGameHistory in AuthContext.js
        const data = await getActualGameHistory(user.id);
        setGames(data.games || []);
      } catch (err) {
        setError('Failed to load history.');
      }
      setLoading(false);
    }
    fetchHistory();
  }, [user.id, getActualGameHistory]);

  return (
    <Paper sx={{ p: 3, borderRadius: 3, mt: 2 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>Advanced Game History</Typography>
      {loading && <CircularProgress />}
      {error && <Alert severity="error">{error}</Alert>}
      {!loading && !error && (
        <Box>
          {games.length === 0 ? (
            <Alert severity="info">No completed games found.</Alert>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Players</TableCell>
                  <TableCell>Winners</TableCell>
                  <TableCell>Scores</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {games.map((game, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{new Date(game.completedAt).toLocaleString()}</TableCell>
                    <TableCell>{game.playerNames?.join(', ')}</TableCell>
                    <TableCell>{game.winners?.join(', ')}</TableCell>
                    <TableCell>{game.scores?.join(', ')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Box>
      )}
    </Paper>
  );
}
