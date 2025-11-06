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
    try {
      const result = await listGames();
      if (result.success) {
        setAvailableGames(result.games || []);
      } else {
        setAvailableGames([]);
        setError('Failed to load games: ' + result.error);
      }
    } catch (error) {
      setAvailableGames([]);
      setError('API not available - running in frontend-only mode');
    }
    setGamesLoading(false);
  };

  const loadAllGamesHistory = async () => {
    setHistoryLoading(true);
    try {
      const result = await getAllGamesHistory();
      if (result.success) {
        setAllGamesHistory(result.games || []);
      } else {
        setAllGamesHistory([]);
        setError('Failed to load history: ' + result.error);
      }
    } catch (error) {
      setAllGamesHistory([]);
      setError('API not available - running in frontend-only mode');
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
    <Box sx={{ 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      py: { xs: 2, sm: 4 }
    }}>
      <Container maxWidth="md">
        <Paper sx={{ 
          p: { xs: 2, sm: 4 },
          borderRadius: 3,
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
        }}>
          <Box sx={{ 
            display: 'flex', 
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'space-between', 
            alignItems: { xs: 'center', sm: 'center' }, 
            mb: 3,
            gap: { xs: 2, sm: 0 }
          }}>
            <Typography 
              variant="h4"
              sx={{
                fontSize: { xs: '1.75rem', sm: '2.125rem' },
                fontWeight: 700,
                background: 'linear-gradient(45deg, #667eea, #764ba2)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}
            >
              🎴 Game Lobby
            </Typography>
            <Box sx={{ 
              display: 'flex', 
              flexDirection: { xs: 'column', sm: 'row' },
              alignItems: 'center', 
              gap: { xs: 1, sm: 2 },
              textAlign: { xs: 'center', sm: 'left' }
            }}>
              <Typography 
                variant="body1"
                sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}
              >
                Welcome, <strong>{user.username}</strong>!
              </Typography>
              <Button 
                variant="outlined" 
                onClick={logout}
                size="small"
                sx={{
                  borderRadius: 2,
                  fontWeight: 600
                }}
              >
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
            <Card sx={{ 
              borderRadius: 3,
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
              height: '100%'
            }}>
              <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                <Typography 
                  variant="h6" 
                  gutterBottom
                  sx={{ 
                    fontSize: { xs: '1.125rem', sm: '1.25rem' },
                    fontWeight: 600
                  }}
                >
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
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2
                      }
                    }}
                  />
                  <Button
                    variant="contained"
                    size="large"
                    onClick={handleCreateGame}
                    disabled={loading}
                    fullWidth
                    sx={{
                      py: { xs: 1.5, sm: 2 },
                      fontSize: { xs: '1rem', sm: '1.125rem' },
                      fontWeight: 600,
                      borderRadius: 2,
                      background: 'linear-gradient(45deg, #667eea, #764ba2)',
                      '&:hover': {
                        background: 'linear-gradient(45deg, #5a6fd8, #6a4190)',
                      }
                    }}
                  >
                    {loading ? 'Creating Game...' : 'Create Game'}
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card sx={{ 
              borderRadius: 3,
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
              height: '100%'
            }}>
              <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                <Typography 
                  variant="h6" 
                  gutterBottom
                  sx={{ 
                    fontSize: { xs: '1.125rem', sm: '1.25rem' },
                    fontWeight: 600
                  }}
                >
                  🚪 Join Existing Game
                </Typography>
                <Stack spacing={3}>
                  <TextField
                    label="Game ID"
                    value={gameIdInput}
                    onChange={(e) => setGameIdInput(e.target.value.toUpperCase())}
                    placeholder="Enter 8-character game code"
                    fullWidth
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2
                      }
                    }}
                  />
                  <Button
                    variant="contained"
                    size="large"
                    onClick={handleJoinGame}
                    disabled={loading || !gameIdInput.trim()}
                    fullWidth
                    sx={{
                      py: { xs: 1.5, sm: 2 },
                      fontSize: { xs: '1rem', sm: '1.125rem' },
                      fontWeight: 600,
                      borderRadius: 2,
                      background: 'linear-gradient(45deg, #667eea, #764ba2)',
                      '&:hover': {
                        background: 'linear-gradient(45deg, #5a6fd8, #6a4190)',
                      }
                    }}
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
              
              {(!availableGames || availableGames.length === 0) ? (
                <Paper sx={{ p: 3, textAlign: 'center' }}>
                  <Typography color="text.secondary">
                    No active games at the moment. Create a new game to get started!
                  </Typography>
                </Paper>
              ) : (
                <div>
                  {/* Desktop Table View */}
                  <Box sx={{ display: { xs: 'none', md: 'block' } }}>
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
                          {(availableGames || []).map((game) => {
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
                  </Box>

                  {/* Mobile Card View */}
                  <Box sx={{ display: { xs: 'block', md: 'none' } }}>
                    <Stack spacing={2}>
                      {(availableGames || []).map((game) => {
                        const isUserInGame = game.playerIds && game.playerIds.includes(user.id);
                        
                        return (
                          <Card key={game.gameId} sx={{ 
                            borderRadius: 2,
                            border: isUserInGame ? '2px solid #1976d2' : '1px solid #e0e0e0'
                          }}>
                            <CardContent sx={{ p: 2 }}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                                <Box>
                                  <Typography variant="h6" sx={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: '1rem' }}>
                                    {game.gameId}
                                  </Typography>
                                  {isUserInGame && (
                                    <Chip 
                                      label="YOU'RE HERE" 
                                      color="primary" 
                                      size="small" 
                                      sx={{ mt: 0.5 }}
                                    />
                                  )}
                                </Box>
                                <Chip 
                                  label={game.status || 'waiting'} 
                                  color={game.status === 'waiting' ? 'warning' : 'success'}
                                  size="small"
                                />
                              </Box>
                              
                              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mb: 2 }}>
                                <Typography variant="body2" color="text.secondary">
                                  <strong>Host:</strong> {game.host}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                  <strong>Players:</strong> {game.players}/{game.maxPlayers}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                  <strong>Round:</strong> {game.currentRound || 0}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                  <strong>Available:</strong> {game.spotsAvailable}
                                </Typography>
                              </Box>
                              
                              <Button
                                variant={isUserInGame ? "contained" : "outlined"}
                                color="primary"
                                size="small"
                                fullWidth
                                disabled={!isUserInGame && (game.spotsAvailable === 0 || (isInGame && !isUserInGame))}
                                onClick={() => {
                                  if (isUserInGame) {
                                    navigate(`/game/${game.gameId}`);
                                  } else {
                                    setGameIdInput(game.gameId);
                                    handleJoinGame();
                                  }
                                }}
                                sx={{ 
                                  borderRadius: 2,
                                  py: 1,
                                  fontWeight: 600
                                }}
                              >
                                {isUserInGame ? 'Enter Game' : 
                                 game.spotsAvailable === 0 ? 'Full' : 
                                 (isInGame && !isUserInGame) ? 'In Other Game' : 'Join'}
                              </Button>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </Stack>
                  </Box>
                </div>
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
              
              {(!allGamesHistory || allGamesHistory.length === 0) ? (
                <Paper sx={{ p: 3, textAlign: 'center' }}>
                  <Typography color="text.secondary">
                    No games in history yet. Start playing to see games here!
                  </Typography>
                </Paper>
              ) : (
                <div>
                  {/* Desktop Table View */}
                  <Box sx={{ display: { xs: 'none', md: 'block' } }}>
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
                          {(allGamesHistory || []).map((game) => (
                            <TableRow key={game.gameId} hover>
                              <TableCell>
                                <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                                  {game.gameId}
                                </Typography>
                              </TableCell>
                              <TableCell>{game.playerNames}</TableCell>
                              <TableCell>
                                <Chip 
                                  label={game.isCompleted ? 'Completed' : 'In Progress'} 
                                  color={game.isCompleted ? 'success' : 'warning'}
                                  size="small"
                                />
                              </TableCell>
                              <TableCell>
                                <Chip 
                                  label={game.isParticipant ? 'Participant' : 'Observer'} 
                                  color={game.isParticipant ? 'primary' : 'default'}
                                  size="small"
                                />
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" color="text.secondary">
                                  {new Date(game.createdAt).toLocaleDateString()}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="outlined"
                                  color="primary"
                                  size="small"
                                  onClick={() => {
                                    if (game.isCompleted && game.finalResults) {
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
                  </Box>

                  {/* Mobile Card View */}
                  <Box sx={{ display: { xs: 'block', md: 'none' } }}>
                    <Stack spacing={2}>
                      {(allGamesHistory || []).map((game) => (
                        <Card key={game.gameId} sx={{ borderRadius: 2 }}>
                          <CardContent sx={{ p: 2 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                              <Typography variant="h6" sx={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: '1rem' }}>
                                {game.gameId}
                              </Typography>
                              <Box sx={{ display: 'flex', gap: 1, flexDirection: 'column', alignItems: 'flex-end' }}>
                                <Chip 
                                  label={game.isCompleted ? 'Completed' : 'In Progress'} 
                                  color={game.isCompleted ? 'success' : 'warning'}
                                  size="small"
                                />
                                <Chip 
                                  label={game.isParticipant ? 'Participant' : 'Observer'} 
                                  color={game.isParticipant ? 'primary' : 'default'}
                                  size="small"
                                />
                              </Box>
                            </Box>
                            
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                              <strong>Players:</strong> {game.playerNames}
                            </Typography>
                            
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                              <strong>Date:</strong> {new Date(game.createdAt).toLocaleDateString()}
                            </Typography>
                            
                            <Button
                              variant="outlined"
                              color="primary"
                              size="small"
                              fullWidth
                              onClick={() => {
                                if (game.isCompleted && game.finalResults) {
                                  setSelectedGameResults(game.finalResults);
                                  setResultsDialogOpen(true);
                                } else {
                                  navigate(`/game/${game.gameId}`);
                                }
                              }}
                              sx={{ 
                                borderRadius: 2,
                                py: 1,
                                fontWeight: 600
                              }}
                            >
                              {game.isCompleted 
                                ? (game.finalResults ? 'View Results' : 'View Game')
                                : (game.isParticipant ? 'Rejoin Game' : 'View Game')
                              }
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    </Stack>
                  </Box>
                </div>
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
    </Box>
  );
}