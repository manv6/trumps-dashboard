import React, { useState, useEffect } from 'react';
import { 
  Container, Typography, Box, Button, TextField, Paper, 
  Alert, Table, TableBody, TableCell, 
  TableContainer, TableHead, TableRow, Chip, Tabs, Tab,
  Grid, Card, CardContent, Stack,
  Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

export default function GameLobby() {
  const { user, logout, createGame, joinGame, listGames, getAllGamesHistory, checkCurrentGame } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [gameIdInput, setGameIdInput] = useState('');
  const [numPlayers, setNumPlayers] = useState(4);
  const [availableGames, setAvailableGames] = useState([]);
  const [gamesLoading, setGamesLoading] = useState(false);
  const [allGamesHistory, setAllGamesHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [currentTab, setCurrentTab] = useState(0);
  const [userCurrentGame, setUserCurrentGame] = useState(null);
  const [isInGame, setIsInGame] = useState(false);
  const [selectedGameResults, setSelectedGameResults] = useState(null);
  const [resultsDialogOpen, setResultsDialogOpen] = useState(false);

  // Check if user is currently in a game
  const checkUserCurrentGame = async () => {
    const result = await checkCurrentGame();
    if (result.success && result.isInGame) {
      setUserCurrentGame(result.gameId);
      setIsInGame(true);
      return true;
    } else {
      setIsInGame(false);
      setUserCurrentGame(null);
      return false;
    }
  };

  const handleCreateGame = async () => {
    // Check if user is already in a game
    const userInGame = await checkUserCurrentGame();
    if (userInGame) {
      setError(`You are already in game ${userCurrentGame}. Please leave that game first.`);
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    const result = await createGame(numPlayers);
    
    if (result.success) {
      setSuccess(`Game created! Game ID: ${result.gameId}`);
      // Navigate to the created game
      setTimeout(() => {
        navigate(`/game/${result.gameId}`);
      }, 1500);
    } else {
      setError(result.error);
    }
    
    setLoading(false);
  };

  const handleJoinGame = async () => {
    if (!gameIdInput.trim()) {
      setError('Please enter a game ID');
      return;
    }

    // Check if user is already in a game
    const userInGame = await checkUserCurrentGame();
    if (userInGame) {
      setError(`You are already in game ${userCurrentGame}. Please leave that game first.`);
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    const result = await joinGame(gameIdInput.trim().toUpperCase());
    
    if (result.success) {
      setSuccess('Joined game successfully!');
      setTimeout(() => {
        navigate(`/game/${gameIdInput.trim().toUpperCase()}`);
      }, 1000);
    } else {
      setError(result.error);
    }
    
    setLoading(false);
  };

  const loadGames = async () => {
    setGamesLoading(true);
    const result = await listGames();
    if (result.success) {
      setAvailableGames(result.games);
    } else {
      setError('Failed to load games: ' + result.error);
    }
    setGamesLoading(false);
  };

  const loadAllGamesHistory = async () => {
    setHistoryLoading(true);
    const result = await getAllGamesHistory();
    if (result.success) {
      setAllGamesHistory(result.games);
    } else {
      setError('Failed to load history: ' + result.error);
    }
    setHistoryLoading(false);
  };

  const handleJoinFromList = async (gameId) => {
    // Check if user is already in a game
    const userInGame = await checkUserCurrentGame();
    if (userInGame) {
      setError(`You are already in game ${userCurrentGame}. Please leave that game first.`);
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    const result = await joinGame(gameId);
    
    if (result.success) {
      setSuccess('Joined game successfully!');
      setTimeout(() => {
        navigate(`/game/${gameId}`);
      }, 1000);
    } else {
      setError(result.error);
    }
    
    setLoading(false);
  };

  // Load games on component mount and periodically refresh
  useEffect(() => {
    loadGames();
    loadAllGamesHistory();
    checkUserCurrentGame();
    const interval = setInterval(loadGames, 5000); // Refresh games every 5 seconds
    return () => clearInterval(interval);
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Container maxWidth="md">
      <Paper sx={{ p: 4, mt: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4">
            🎴 Game Lobby
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="body1">
              Welcome, <strong>{user.username}</strong>!
            </Typography>
            <Button variant="outlined" onClick={logout}>
              Αποσύνδεση
            </Button>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {success}
          </Alert>
        )}

        {isInGame && (
          <Alert severity="info" sx={{ mb: 2 }}>
            You are currently in game: <strong>{userCurrentGame}</strong>
            <Button 
              variant="outlined" 
              size="small" 
              sx={{ ml: 2 }}
              onClick={() => navigate(`/game/${userCurrentGame}`)}
            >
              Go to Game
            </Button>
          </Alert>
        )}

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  🎯 Create New Game
                </Typography>
                <Stack spacing={3}>
                  <TextField
                    label="Number of Players"
                    type="number"
                    value={numPlayers}
                    onChange={(e) => setNumPlayers(Math.max(2, Math.min(8, Number(e.target.value))))}
                    inputProps={{ min: 2, max: 8 }}
                    fullWidth
                  />
                  <Button
                    variant="contained"
                    size="large"
                    onClick={handleCreateGame}
                    disabled={loading}
                    fullWidth
                  >
                    {loading ? 'Creating Game...' : 'Create Game'}
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  🚪 Join Existing Game
                </Typography>
                <Stack spacing={3}>
                  <TextField
                    label="Game ID"
                    value={gameIdInput}
                    onChange={(e) => setGameIdInput(e.target.value.toUpperCase())}
                    placeholder="Enter 8-character game code"
                    fullWidth
                  />
                  <Button
                    variant="contained"
                    size="large"
                    onClick={handleJoinGame}
                    disabled={loading || !gameIdInput.trim()}
                    fullWidth
                  >
                    {loading ? 'Joining Game...' : 'Join Game'}
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Games Section with Tabs */}
        <Box sx={{ mt: 4 }}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={currentTab} onChange={(e, newValue) => setCurrentTab(newValue)}>
              <Tab label="🎮 Active Games" />
              <Tab label="📚 All Games History" />
            </Tabs>
          </Box>
          
          {/* Active Games Tab */}
          {currentTab === 0 && (
            <Box sx={{ pt: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  Join or Browse Active Games
                </Typography>
                <Button 
                  variant="outlined" 
                  size="small" 
                  onClick={loadGames}
                  disabled={gamesLoading}
                >
                  {gamesLoading ? 'Loading...' : 'Refresh'}
                </Button>
              </Box>
              
              {availableGames.length === 0 ? (
                <Paper sx={{ p: 3, textAlign: 'center' }}>
                  <Typography color="text.secondary">
                    No active games at the moment. Create a new game to get started!
                  </Typography>
                </Paper>
              ) : (
                <TableContainer component={Paper}>
                  <Table size="small" aria-label="active games">
                    <TableHead>
                      <TableRow>
                        <TableCell><strong>Game ID</strong></TableCell>
                        <TableCell><strong>Host</strong></TableCell>
                        <TableCell><strong>Players</strong></TableCell>
                        <TableCell><strong>Status</strong></TableCell>
                        <TableCell><strong>Round</strong></TableCell>
                        <TableCell><strong>Action</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {availableGames.map((game) => {
                        // Check if current user is already in this game
                        const isUserInGame = game.playerIds && game.playerIds.includes(user.id);
                        
                        return (
                          <TableRow key={game.gameId} hover>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                                {game.gameId}
                                {isUserInGame && (
                                  <Chip 
                                    label="YOU'RE HERE" 
                                    color="primary" 
                                    size="small" 
                                    sx={{ ml: 1, fontSize: '0.7em' }}
                                  />
                                )}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2">
                                {game.hostUsername}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2">
                                {game.playersCount}/{game.maxPlayers}
                                {game.connectedPlayers !== game.playersCount && (
                                  <span style={{ color: '#666', fontSize: '0.8em' }}>
                                    {' '}({game.connectedPlayers} online)
                                  </span>
                                )}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Chip 
                                label={game.isCompleted ? 'Completed' : game.isStarted ? 'In Progress' : 'Waiting'}
                                color={game.isCompleted ? 'default' : game.isStarted ? 'warning' : 'success'}
                                size="small"
                              />
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2">
                                {game.isStarted ? `${game.currentRound}/${game.totalRounds}` : '-'}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant={
                                  isUserInGame ? "contained" : 
                                  game.spotsAvailable > 0 ? "contained" : "outlined"
                                }
                                color={isUserInGame ? "success" : "primary"}
                                size="small"
                                disabled={
                                  isUserInGame ? false : 
                                  (game.spotsAvailable === 0 || loading || (isInGame && !isUserInGame))
                                }
                                onClick={() => {
                                  if (isUserInGame) {
                                    navigate(`/game/${game.gameId}`);
                                  } else {
                                    handleJoinFromList(game.gameId);
                                  }
                                }}
                                sx={{ minWidth: '80px' }}
                              >
                                {isUserInGame ? 'Enter Game' : 
                                 game.spotsAvailable === 0 ? 'Full' : 
                                 (isInGame && !isUserInGame) ? 'In Other Game' : 'Join'}
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>
          )}
          
          {/* All Games History Tab */}
          {currentTab === 1 && (
            <Box sx={{ pt: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  All Games History
                </Typography>
                <Button 
                  variant="outlined" 
                  size="small" 
                  onClick={loadAllGamesHistory}
                  disabled={historyLoading}
                >
                  {historyLoading ? 'Loading...' : 'Refresh'}
                </Button>
              </Box>
              
              {allGamesHistory.length === 0 ? (
                <Paper sx={{ p: 3, textAlign: 'center' }}>
                  <Typography color="text.secondary">
                    No games in history yet. Start playing to see games here!
                  </Typography>
                </Paper>
              ) : (
                <TableContainer component={Paper}>
                  <Table size="small" aria-label="all games history">
                    <TableHead>
                      <TableRow>
                        <TableCell><strong>Game ID</strong></TableCell>
                        <TableCell><strong>Players</strong></TableCell>
                        <TableCell><strong>Status</strong></TableCell>
                        <TableCell><strong>Participation</strong></TableCell>
                        <TableCell><strong>Date</strong></TableCell>
                        <TableCell><strong>Action</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {allGamesHistory.map((game) => (
                        <TableRow key={game.gameId} hover>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                              {game.gameId}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {game.playerNames.join(', ')}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip 
                              label={game.isCompleted ? 'Completed' : game.isStarted ? 'In Progress' : 'Waiting'}
                              color={game.isCompleted ? 'default' : game.isStarted ? 'warning' : 'success'}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            <Chip 
                              label={game.isParticipant ? '✅ Participated' : '👀 Observer'}
                              color={game.isParticipant ? 'success' : 'default'}
                              size="small"
                              variant={game.isParticipant ? 'filled' : 'outlined'}
                            />
                            {game.isParticipant && game.isCompleted && game.userRank && (
                              <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                                Rank: #{game.userRank} | Score: {game.userScore}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {new Date(game.createdAt).toLocaleDateString()}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outlined"
                              size="small"
                              onClick={() => {
                                if (game.finalResults && game.isCompleted) {
                                  setSelectedGameResults(game.finalResults);
                                  setResultsDialogOpen(true);
                                } else {
                                  navigate(`/game/${game.gameId}`);
                                }
                              }}
                              sx={{ minWidth: '80px' }}
                            >
                              {game.isCompleted 
                                ? (game.finalResults ? 'View Results' : 'View Game')
                                : (game.isParticipant ? 'Rejoin Game' : 'View Game')
                              }
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>
          )}
        </Box>

        {/* Results Dialog */}
        <Dialog 
          open={resultsDialogOpen} 
          onClose={() => setResultsDialogOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Game Results</DialogTitle>
          <DialogContent>
            {selectedGameResults && (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>Rank</strong></TableCell>
                      <TableCell><strong>Player</strong></TableCell>
                      <TableCell><strong>Score</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {selectedGameResults.map((result) => (
                      <TableRow key={result.playerId}>
                        <TableCell>
                          <Chip 
                            label={`#${result.rank}`}
                            color={result.rank === 1 ? 'success' : result.rank <= 3 ? 'warning' : 'default'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: result.rank === 1 ? 'bold' : 'normal' }}>
                            {result.username}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: result.rank === 1 ? 'bold' : 'normal' }}>
                            {result.score}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setResultsDialogOpen(false)}>Close</Button>
          </DialogActions>
        </Dialog>

        <Box sx={{ mt: 4 }}>
          <Typography variant="h6" gutterBottom>
            📖 How to Play
          </Typography>
          <Typography variant="body2" color="text.secondary">
            1. Create a new game or join an existing one using the game ID<br/>
            2. Wait for all players to join<br/>
            3. Play Trump cards in real-time with your friends<br/>
            4. Make predictions, play tricks, and compete for the highest score!
          </Typography>
        </Box>
      </Paper>
    </Container>
  );
}