import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Container, Paper, Typography, CircularProgress, Alert, Box } from '@mui/material';
import { useAuth } from './AuthContext';
import MultiplayerGame from './MultiplayerGame';

export default function GameRoom() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { user, joinGame } = useAuth();
  const [gameData, setGameData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadGame = async () => {
      if (!gameId || !user) {
        setError('Invalid game or user session');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError('');

        // Try to join the game (this will work for both new joins and rejoins)
        const result = await joinGame(gameId);
        
        if (result.success) {
          setGameData(result.game);
        } else {
          setError(result.error || 'Failed to load game');
          // Redirect to lobby after a delay if game not found
          setTimeout(() => {
            navigate('/lobby');
          }, 3000);
        }
      } catch (err) {
        console.error('Error loading game:', err);
        setError('Failed to load game');
        setTimeout(() => {
          navigate('/lobby');
        }, 3000);
      } finally {
        setLoading(false);
      }
    };

    loadGame();
  }, [gameId, user, joinGame, navigate]);

  const handleLeaveGame = () => {
    navigate('/lobby');
  };

  if (loading) {
    return (
      <Container maxWidth="xl">
        <Paper sx={{ p: 4, mt: 4 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <CircularProgress />
            <Typography variant="h6">
              Loading game {gameId}...
            </Typography>
          </Box>
        </Paper>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="xl">
        <Paper sx={{ p: 4, mt: 4 }}>
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
          <Typography variant="body1">
            Redirecting to lobby in a few seconds...
          </Typography>
        </Paper>
      </Container>
    );
  }

  if (!gameData) {
    return (
      <Container maxWidth="xl">
        <Paper sx={{ p: 4, mt: 4 }}>
          <Alert severity="warning">
            Game not found or no longer available.
          </Alert>
        </Paper>
      </Container>
    );
  }

  return (
    <MultiplayerGame 
      gameId={gameId}
      initialGameData={gameData}
      onLeaveGame={handleLeaveGame}
    />
  );
}