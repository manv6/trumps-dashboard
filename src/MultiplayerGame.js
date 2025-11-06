import React, { useState, useEffect } from 'react';
import {
  Container, Paper, Stack, Button, Typography,
  Table, TableHead, TableRow, TableCell, TableBody,
  TextField, Box, Alert, Chip, Avatar, Card, CardContent
} from '@mui/material';
import io from 'socket.io-client';
import { useAuth } from './AuthContext';

// Helper functions (copied from original App.js)
function cumulativePoints(pointsArr, roundIdx) {
  let sum = 0;
  for (let i = 0; i <= roundIdx; i++) {
    sum += pointsArr[i] || 0;
  }
  return sum;
}

function getRankedSummary(players, numPlayers, totalPoints) {
  const summary = players.slice(0, numPlayers).map(p => ({
    Παίκτης: p.name,
    "Σύνολο Πόντων": totalPoints(p),
  })).sort((a, b) => b["Σύνολο Πόντων"] - a["Σύνολο Πόντων"]);
  let rank = 1;
  let prev = null;
  summary.forEach((row, i) => {
    row["Κατάταξη"] = row["Σύνολο Πόντων"] === prev ? rank : (rank = i + 1);
    prev = row["Σύνολο Πόντων"];
  });
  return summary;
}

export default function MultiplayerGame({ gameId, initialGameData, onLeaveGame }) {
  const { user, completeGame } = useAuth();
  const [socket, setSocket] = useState(null);
  const [gameData, setGameData] = useState(initialGameData);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');
  const [completingGame, setCompletingGame] = useState(false);

  // Game state derived from gameData
  const players = gameData?.gameState?.playerData || [];
  const numPlayers = gameData?.gameState?.numPlayers || 4;
  const rounds = gameData?.gameState?.rounds || [];
  const connectedPlayers = gameData?.players || [];
  const currentRound = gameData?.gameState?.currentRound || 0;
  const isGameCompleted = gameData?.gameState?.isGameCompleted || false;
  const hostId = gameData?.hostId;
  const isHost = hostId === user.id;

  // Find current user's player index
  const currentUserPlayerIndex = connectedPlayers.findIndex(p => p.userId === user.id);

  const cellWidth = Math.max(55, Math.floor(900 / (numPlayers * 2)));

  useEffect(() => {
    // Initialize socket connection with dynamic URL
    const socketUrl = process.env.NODE_ENV === 'development' 
      ? (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
          ? 'http://localhost:3002'
          : `http://${window.location.hostname}:3002`)
      : window.location.origin;
    
    const newSocket = io(socketUrl);
    
    newSocket.on('connect', () => {
      console.log('Connected to server');
      setConnected(true);
      
      // Join the game room
      newSocket.emit('join-game', {
        gameId,
        userId: user.id,
        username: user.username
      });
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from server');
      setConnected(false);
    });

    newSocket.on('game-state', (updatedGameData) => {
      console.log('Game state updated:', updatedGameData);
      setGameData(updatedGameData);
    });

    newSocket.on('player-joined', (data) => {
      console.log('Player joined:', data.username);
    });

    newSocket.on('player-disconnected', (data) => {
      console.log('Player disconnected:', data.userId);
    });

    newSocket.on('error', (errorMsg) => {
      setError(errorMsg);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [gameId, user.id, user.username]);

  const emitGameAction = (action, payload) => {
    if (socket && connected) {
      socket.emit('game-action', {
        gameId,
        action,
        payload
      });
    }
  };

  const handlePrediction = (rIdx, pIdx, value) => {
    emitGameAction('update-prediction', {
      roundIdx: rIdx,
      playerIdx: pIdx,
      value: value === "" ? undefined : Number(value)
    });
  };

  const handleTricks = (rIdx, pIdx, value) => {
    emitGameAction('update-tricks', {
      roundIdx: rIdx,
      playerIdx: pIdx,
      value: value === "" ? undefined : Number(value)
    });
  };

  const handleResetGame = () => {
    emitGameAction('reset-game', {});
  };

  const totalPoints = (player) =>
    player.points.reduce((a, b) => a + (b || 0), 0);

  // Helper function to determine if a field is editable
  const isFieldEditable = (roundIdx, playerIdx, fieldType) => {
    // Can only edit your own column
    if (playerIdx !== currentUserPlayerIndex) {
      return false;
    }
    
    // Game completed
    if (isGameCompleted) {
      return false;
    }
    
    // For predictions: can edit current round and future rounds
    if (fieldType === 'prediction') {
      return roundIdx >= currentRound;
    }
    
    // For tricks: can edit current round and previous rounds (for corrections)
    if (fieldType === 'tricks') {
      // Can edit current round and previous rounds
      if (roundIdx > currentRound) {
        return false;
      }
      
      // Check if all predictions for this round are complete
      const roundPredictions = players
        .slice(0, numPlayers)
        .map(p => p.predictions[roundIdx]);
      
      return roundPredictions.every(pred => 
        pred !== undefined && pred !== null && pred !== ""
      );
    }
    
    return false;
  };

  const handleNextRound = () => {
    emitGameAction('advance-round', {});
  };

  const handlePreviousRound = () => {
    emitGameAction('go-back-round', {});
  };

  const handleCompleteGame = async () => {
    if (!isHost) {
      setError('Only the host can complete the game');
      return;
    }
    
    setCompletingGame(true);
    setError('');
    
    try {
      console.log('Completing game:', gameId, 'User:', user.id);
      const result = await completeGame(gameId);
      console.log('Complete game result:', result);
      
      if (result.success) {
        // The game state will be updated via socket
        console.log('Game completed successfully:', result);
        // Optionally show success message
      } else {
        setError(result.error || 'Failed to complete game');
        console.error('Complete game failed:', result.error);
      }
    } catch (error) {
      const errorMsg = 'Failed to complete game: ' + (error.message || error);
      setError(errorMsg);
      console.error('Complete game error:', error);
    } finally {
      setCompletingGame(false);
    }
  };

  if (!connected) {
    return (
      <Box sx={{ 
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2
      }}>
        <Container maxWidth="sm">
          <Paper sx={{ 
            p: { xs: 3, sm: 4 },
            borderRadius: 3,
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            textAlign: 'center'
          }}>
            <Typography 
              variant="h5" 
              sx={{ 
                fontSize: { xs: '1.25rem', sm: '1.5rem' },
                fontWeight: 600,
                mb: 2
              }}
            >
              🎴 Connecting to game...
            </Typography>
            <Typography 
              variant="body2" 
              color="text.secondary"
              sx={{ mb: 2 }}
            >
              Game ID: {gameId}
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              <div>🔄</div>
            </Box>
          </Paper>
        </Container>
      </Box>
    );
  }

  return (
    <Box sx={{ 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      py: { xs: 2, sm: 4 }
    }}>
      <Container maxWidth="xl">
        <Paper id="dashboard-content" sx={{ 
          p: { xs: 2, sm: 4 },
          borderRadius: 3,
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
        }}>
          <Stack spacing={3}>
            <Box sx={{ 
              display: "flex", 
              flexDirection: { xs: 'column', sm: 'row' },
              justifyContent: "space-between", 
              alignItems: { xs: 'center', sm: 'flex-start' },
              gap: { xs: 2, sm: 0 }
            }}>
              <Box sx={{ textAlign: { xs: 'center', sm: 'left' } }}>
                <Typography 
                  variant="h4" 
                  sx={{ 
                    fontSize: { xs: '1.5rem', sm: '2.125rem' },
                    fontWeight: 700,
                    background: 'linear-gradient(45deg, #667eea, #764ba2)',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent'
                  }}
                >
                  🎴 Trumps – Multiplayer Game
                </Typography>
                <Box sx={{ 
                  display: 'flex', 
                  flexDirection: { xs: 'column', sm: 'row' },
                  alignItems: 'center', 
                  gap: 1, 
                  mt: 1 
                }}>
                  <Chip 
                    label={`Game ID: ${gameId}`} 
                    variant="outlined" 
                    color="primary"
                    size="small"
                  />
                  <Chip 
                    label={connected ? "🟢 Connected" : "🔴 Disconnected"} 
                    variant="outlined"
                    size="small"
                    color={connected ? "success" : "error"}
                  />
                </Box>
              </Box>
            
            {/* Reference Guide */}
            <Paper 
              sx={{ 
                p: 2, 
                maxWidth: 300, 
                backgroundColor: "#f8f9fa",
                border: "1px solid #e0e0e0"
              }}
            >
              <Typography variant="h6" sx={{ mb: 1, color: "#1976d2", fontSize: "1rem" }}>
                📋 Οδηγός Χρήσης
              </Typography>
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: "bold", mb: 0.5 }}>
                  🎯 Βαθμολογία:
                </Typography>
                <Typography variant="caption" sx={{ display: "block", lineHeight: 1.3 }}>
                  • Σωστή πρόβλεψη: Μάζια + 10 πόντοι<br/>
                  • Λάθος πρόβλεψη: Μόνο τα μάζια
                </Typography>
              </Box>
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: "bold", mb: 0.5 }}>
                  🎨 Χρώματα Πίνακα:
                </Typography>
                <Box sx={{ display: "flex", alignItems: "center", mb: 0.3 }}>
                  <Box sx={{ width: 12, height: 12, backgroundColor: "#e7ffd6", border: "1px solid #43a047", mr: 1 }}></Box>
                  <Typography variant="caption">Σωστή πρόβλεψη</Typography>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", mb: 0.3 }}>
                  <Box sx={{ width: 12, height: 12, backgroundColor: "#e3f2fd", border: "1px solid #2196f3", mr: 1 }}></Box>
                  <Typography variant="caption">Η σειρά σας</Typography>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", mb: 0.3 }}>
                  <Box sx={{ width: 12, height: 12, backgroundColor: "#f0f0f0", border: "1px solid #ccc", mr: 1 }}></Box>
                  <Typography variant="caption">Άλλοι παίκτες</Typography>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", mb: 0.3 }}>
                  <Box sx={{ width: 12, height: 12, backgroundColor: "#f3e5f5", border: "1px solid #9c27b0", mr: 1 }}></Box>
                  <Typography variant="caption">Τρέχων γύρος</Typography>
                </Box>
              </Box>
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: "bold", mb: 0.5 }}>
                  🔒 Κανόνες Επεξεργασίας:
                </Typography>
                <Typography variant="caption" sx={{ display: "block", lineHeight: 1.3 }}>
                  • Μόνο τη δική σας στήλη<br/>
                  • Προβλέψεις: τρέχων και μελλοντικοί γύροι<br/>
                  • Μάζια: μόνο τρέχων γύρος
                </Typography>
              </Box>
              
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: "bold", mb: 0.5 }}>
                  🔄 Σειρά Παικτών:
                </Typography>
                <Typography variant="caption" sx={{ display: "block", lineHeight: 1.3 }}>
                  Κάθε γύρος αρχίζει από διαφορετικό παίκτη.<br/>
                  Ο τελευταίος δεν μπορεί να κάνει το σύνολο ίσο με τα φύλλα.
                </Typography>
              </Box>
            </Paper>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {/* Game Status */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Chip 
              label={`Current Round: ${currentRound + 1}/${rounds.length}`}
              color="primary"
              variant="filled"
            />
            {isGameCompleted && (
              <Chip 
                label="🏆 Game Completed!"
                color="success"
                variant="filled"
              />
            )}
            <Typography variant="body2" color="text.secondary">
              You are: <strong>{connectedPlayers[currentUserPlayerIndex]?.username || 'Unknown'}</strong> (Player {currentUserPlayerIndex + 1})
            </Typography>
          </Box>

          {/* Connected Players */}
          <Box>
            <Typography variant="h6" gutterBottom>
              👥 Connected Players ({connectedPlayers.length}/{numPlayers})
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {connectedPlayers.map((player, idx) => (
                <Chip
                  key={idx}
                  avatar={<Avatar>{player.username[0].toUpperCase()}</Avatar>}
                  label={player.username}
                  variant={player.isConnected ? "filled" : "outlined"}
                  color={player.isConnected ? "success" : "default"}
                />
              ))}
            </Box>
          </Box>

          {/* Sticky Player Names Header */}
          <Box 
            sx={{ 
              position: "sticky", 
              top: 0, 
              backgroundColor: "#fff", 
              zIndex: 10,
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
              borderBottom: "2px solid #1976d2",
              display: { xs: 'none', lg: 'table' },
              width: "100%",
              tableLayout: "fixed"
            }}
          >
            <Box sx={{ display: "table-row" }}>
              <Box sx={{ 
                display: "table-cell",
                width: `${cellWidth}px`, 
                textAlign: "center", 
                fontWeight: "bold", 
                padding: "6px 16px",
                borderRight: "1px solid #e0e0e0",
                verticalAlign: "middle"
              }}>
                Γύρος
              </Box>
              <Box sx={{ 
                display: "table-cell",
                width: `${cellWidth}px`, 
                textAlign: "center", 
                fontWeight: "bold", 
                padding: "6px 16px",
                borderRight: "1px solid #e0e0e0",
                verticalAlign: "middle"
              }}>
                Φύλλα
              </Box>
              {players.slice(0, numPlayers).map((p, idx) => (
                <Box
                  key={idx}
                  sx={{ 
                    display: "table-cell",
                    width: `${cellWidth * 2}px`,
                    textAlign: "center",
                    fontWeight: "bold",
                    fontSize: "1.1rem",
                    color: "#1976d2",
                    padding: "6px 16px",
                    borderRight: idx < numPlayers - 1 ? "1px solid #e0e0e0" : "none",
                    verticalAlign: "middle"
                  }}
                >
                  <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <Box>{p.name}</Box>
                    <Typography variant="caption" sx={{ color: "#666", fontSize: "0.7rem" }}>
                      Παίκτης {idx + 1}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>

          {/* Desktop Game Table */}
          <Box sx={{ display: { xs: 'none', lg: 'block' } }}>
            <Box sx={{ 
              overflowX: "auto",
              border: '1px solid #e0e0e0',
              borderRadius: 2,
              backgroundColor: '#fafafa'
            }} data-table-container>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ visibility: "hidden" }}>
                  <TableCell sx={{ fontWeight: "bold", width: cellWidth, padding: "6px 16px" }}>Γύρος</TableCell>
                  <TableCell sx={{ fontWeight: "bold", width: cellWidth, padding: "6px 16px" }}>Φύλλα</TableCell>
                  {players.slice(0, numPlayers).map((p, idx) => (
                    <TableCell 
                      key={idx} 
                      colSpan={2} 
                      align="center"
                      sx={{ 
                        fontWeight: "bold",
                        fontSize: "1.1rem",
                        color: "#1976d2",
                        width: cellWidth * 2,
                        padding: "6px 16px"
                      }}
                    >
                      {p.name}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rounds.map((cards, roundIdx) => {
                  // Rotating first player logic (same as original)
                  const firstPlayerIdx = roundIdx % numPlayers;
                  const lastPlayerIdx = (firstPlayerIdx - 1 + numPlayers) % numPlayers;
                  
                  const predictionOrder = [];
                  for (let i = 0; i < numPlayers; i++) {
                    const playerIdx = (firstPlayerIdx + i) % numPlayers;
                    predictionOrder.push({
                      playerIdx,
                      prediction: players[playerIdx].predictions[roundIdx]
                    });
                  }
                  
                  const sumPredSoFar = (targetPlayerIdx) => {
                    let sum = 0;
                    const targetOrderIdx = predictionOrder.findIndex(p => p.playerIdx === targetPlayerIdx);
                    for (let i = 0; i < targetOrderIdx; i++) {
                      const pred = predictionOrder[i].prediction;
                      sum += (pred !== undefined && pred !== null && pred !== "") ? Number(pred) : 0;
                    }
                    return sum;
                  };
                  
                  const firstEmptyInOrder = predictionOrder.find(p => 
                    p.prediction === undefined || p.prediction === null || p.prediction === ""
                  );
                  const activePlayerIdx = firstEmptyInOrder ? firstEmptyInOrder.playerIdx : -1;
                  
                  const sumAllPreds = predictionOrder.reduce((acc, p) => {
                    const val = p.prediction;
                    return acc + (val !== undefined && val !== null && val !== "" ? Number(val) : 0);
                  }, 0);
                  
                  return (
                    <React.Fragment key={roundIdx}>
                      <TableRow 
                        sx={{ 
                          backgroundColor: roundIdx === currentRound ? "#f3e5f5" : 
                                          roundIdx < currentRound ? "#f5f5f5" : "inherit"
                        }}
                      >
                        <TableCell rowSpan={2} sx={{ 
                          borderLeft: roundIdx === currentRound ? "4px solid #9c27b0" : "none"
                        }}>
                          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                            <Typography variant="body2" sx={{ fontWeight: "bold" }}>
                              {roundIdx + 1}
                            </Typography>
                            {roundIdx === currentRound && (
                              <Chip label="ΤΡΕΧΩΝ" size="small" color="primary" />
                            )}
                            {roundIdx < currentRound && (
                              <Chip label="ΤΕΛΟΣ" size="small" color="default" />
                            )}
                            
                            {/* Round Navigation Controls */}
                            {!isGameCompleted && roundIdx === currentRound && (
                              <Box sx={{ display: 'flex', gap: 0.5, mt: 1 }}>
                                {currentRound > 0 && (
                                  <Button
                                    variant="outlined"
                                    size="small"
                                    onClick={handlePreviousRound}
                                    disabled={currentRound === 0}
                                    sx={{ fontSize: '0.6rem', padding: '2px 6px', minWidth: 'auto' }}
                                  >
                                    Previous
                                  </Button>
                                )}
                                {currentRound < rounds.length - 1 && (
                                  <Button
                                    variant="outlined"
                                    size="small"
                                    onClick={handleNextRound}
                                    disabled={currentRound >= rounds.length - 1}
                                    sx={{ fontSize: '0.6rem', padding: '2px 6px', minWidth: 'auto' }}
                                  >
                                    Next
                                  </Button>
                                )}
                              </Box>
                            )}
                          </Box>
                        </TableCell>
                        <TableCell rowSpan={2} sx={{ 
                          borderLeft: roundIdx === currentRound ? "4px solid #9c27b0" : "none"
                        }}>
                          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                            {cards}
                            <Typography
                              variant="caption"
                              sx={{ color: "#666", fontWeight: "normal" }}
                            >
                              Σύνολο προβλ: {sumAllPreds}
                            </Typography>
                            <Typography
                              variant="caption"
                              sx={{ color: "#1976d2", fontWeight: "bold", fontSize: "0.7rem" }}
                            >
                              Πρώτος: {players[firstPlayerIdx].name.split(' ')[1] || players[firstPlayerIdx].name}
                            </Typography>
                          </Box>
                        </TableCell>
                        {players.slice(0, numPlayers).map((p, playerIdx) => {
                          const isActive = playerIdx === activePlayerIdx;
                          const isLastPlayer = playerIdx === lastPlayerIdx;
                          const isMyColumn = playerIdx === currentUserPlayerIndex;
                          const predictionEditable = isFieldEditable(roundIdx, playerIdx, 'prediction');
                          const tricksEditable = isFieldEditable(roundIdx, playerIdx, 'tricks');
                          
                          let helper = "";
                          if (isActive && isLastPlayer && numPlayers > 1) {
                            const forbidden = cards - sumPredSoFar(playerIdx);
                            helper = forbidden >= 0 && forbidden <= cards ? `ΟΧΙ ${forbidden}` : "ΟΣΕΣ";
                          }
                          
                          return (
                            <React.Fragment key={playerIdx}>
                              <TableCell sx={{ 
                                p: 0.5, 
                                width: cellWidth,
                                backgroundColor: 
                                  isActive ? "#e3f2fd" :           // Blue for active player (visible to all)
                                  !isMyColumn ? "#f0f0f0" : "inherit",  // Gray for others, white for my column
                                border: isLastPlayer ? "2px solid #ff9800" : "1px solid #e0e0e0",
                                opacity: predictionEditable ? 1 : 0.6
                              }}>
                                <TextField
                                  label="Π"
                                  type="number"
                                  inputProps={{ min: 0, max: cards }}
                                  value={
                                    p.predictions[roundIdx] !== undefined
                                      ? p.predictions[roundIdx]
                                      : ""
                                  }
                                  onChange={e =>
                                    handlePrediction(roundIdx, playerIdx, e.target.value)
                                  }
                                  disabled={!predictionEditable}
                                  size="small"
                                  sx={{ 
                                    width: "100%",
                                    '& .MuiInputBase-input': {
                                      backgroundColor: isActive ? "#e3f2fd" :           // Blue for active player (visible to all)
                                                      !isMyColumn ? "#f5f5f5" : "inherit"  // Gray for others, white for my column
                                    }
                                  }}
                                  helperText={helper}
                                  FormHelperTextProps={{
                                    sx: { color: helper ? "#d1381b !important" : "inherit", fontWeight: "bold" }
                                  }}
                                />
                              </TableCell>
                              <TableCell sx={{ 
                                p: 0.5, 
                                width: cellWidth,
                                backgroundColor: 
                                  isActive ? "#e3f2fd" :           // Blue for active player (visible to all)
                                  !isMyColumn ? "#f0f0f0" : "inherit",  // Gray for others, white for my column
                                border: isLastPlayer ? "2px solid #ff9800" : "1px solid #e0e0e0",
                                opacity: tricksEditable ? 1 : 0.6
                              }}>
                                <TextField
                                  label="Μ"
                                  type="number"
                                  inputProps={{ min: 0, max: cards }}
                                  value={
                                    p.tricks[roundIdx] !== undefined
                                      ? p.tricks[roundIdx]
                                      : ""
                                  }
                                  onChange={e =>
                                    handleTricks(roundIdx, playerIdx, e.target.value)
                                  }
                                  disabled={!tricksEditable}
                                  size="small"
                                  sx={{ 
                                    width: "100%",
                                    '& .MuiInputBase-input': {
                                      backgroundColor: isActive ? "#e3f2fd" :           // Blue for active player (visible to all)
                                                      !isMyColumn ? "#f5f5f5" : "inherit"  // Gray for others, white for my column
                                    }
                                  }}
                                />
                              </TableCell>
                            </React.Fragment>
                          );
                        })}
                      </TableRow>
                      {/* Points row */}
                      <TableRow>
                        {players.slice(0, numPlayers).map((p, idx) => {
                          const pred = p.predictions[roundIdx];
                          const tricks = p.tricks[roundIdx];
                          const hit =
                            pred === tricks &&
                            pred !== undefined &&
                            tricks !== undefined;
                          const cumPoints = cumulativePoints(p.points, roundIdx);
                          return (
                            <TableCell
                              key={`points-${roundIdx}-${idx}`}
                              colSpan={2}
                              align="center"
                              sx={{
                                backgroundColor: hit ? "#e7ffd6" : "#f8f8f8",
                                fontWeight: "bold",
                              }}
                            >
                              <Box
                                sx={{
                                  display: "inline-block",
                                  border: hit ? "2px solid #43a047" : undefined,
                                  borderRadius: hit ? "50%" : undefined,
                                  px: 2,
                                  py: 0.5,
                                  fontWeight: "bold",
                                  color: hit ? "#1b3c20" : "inherit",
                                  fontSize: "1.07em",
                                  letterSpacing: "1px",
                                  minWidth: 55,
                                }}
                              >
                                {cumPoints} πόντοι
                              </Box>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </Box>
          </Box>

          {/* Mobile Game View */}
          <Box sx={{ display: { xs: 'block', lg: 'none' } }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
              📊 Game Progress
            </Typography>
            <Stack spacing={2}>
              {rounds.map((cards, roundIdx) => {
                // Calculate the same player indices as desktop table
                const firstPlayerIdx = roundIdx % numPlayers;
                const lastPlayerIdx = (firstPlayerIdx - 1 + numPlayers) % numPlayers;
                
                const predictionOrder = [];
                for (let i = 0; i < numPlayers; i++) {
                  const playerIdx = (firstPlayerIdx + i) % numPlayers;
                  predictionOrder.push({
                    playerIdx,
                    prediction: players[playerIdx].predictions[roundIdx]
                  });
                }
                
                const firstEmptyInOrder = predictionOrder.find(p => 
                  p.prediction === undefined || p.prediction === null || p.prediction === ""
                );
                const activePlayerIdx = firstEmptyInOrder ? firstEmptyInOrder.playerIdx : -1;
                
                // Helper function for card restriction calculation
                const sumPredSoFar = (targetPlayerIdx) => {
                  let sum = 0;
                  const targetOrderIdx = predictionOrder.findIndex(p => p.playerIdx === targetPlayerIdx);
                  for (let i = 0; i < targetOrderIdx; i++) {
                    const pred = predictionOrder[i].prediction;
                    sum += (pred !== undefined && pred !== null && pred !== "") ? Number(pred) : 0;
                  }
                  return sum;
                };
                
                return (
                  <Card key={roundIdx} sx={{ 
                    borderRadius: 2,
                    border: '1px solid #e0e0e0',
                    backgroundColor: '#fafafa'
                  }}>
                    <CardContent sx={{ p: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600 }}>
                          Round {roundIdx + 1}
                        </Typography>
                        <Chip 
                          label={`${cards} cards`} 
                          size="small" 
                          color="primary"
                        />
                      </Box>
                      
                      <Stack spacing={1}>
                        {players.slice(0, numPlayers).map((player, playerIdx) => {
                          // Same highlighting logic as desktop table
                          const isActivePlayer = playerIdx === activePlayerIdx;
                          const isLastPlayer = playerIdx === lastPlayerIdx;
                          const isMyCard = playerIdx === currentUserPlayerIndex;
                          
                          // Calculate card restriction for last player (same logic as desktop)
                          let restrictionMessage = "";
                          if (isActivePlayer && isLastPlayer && numPlayers > 1) {
                            const forbidden = cards - sumPredSoFar(playerIdx);
                            restrictionMessage = forbidden >= 0 && forbidden <= cards ? `ΟΧΙ ${forbidden}` : "ΟΣΕΣ";
                          }
                          
                          return (
                            <Box key={playerIdx} sx={{ position: 'relative' }}>
                              {/* Restriction chip for last player */}
                              {restrictionMessage && (
                                <Chip
                                  label={restrictionMessage}
                                  size="small"
                                  sx={{
                                    position: 'absolute',
                                    top: -8,
                                    right: 8,
                                    zIndex: 1,
                                    backgroundColor: '#d32f2f',
                                    color: 'white',
                                    fontWeight: 'bold',
                                    fontSize: '0.75rem'
                                  }}
                                />
                              )}
                              
                              <Box sx={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'space-between',
                                p: 1,
                                backgroundColor: isActivePlayer ? '#e3f2fd' : (isMyCard ? '#f8f9fa' : 'white'),
                                borderRadius: 1,
                                border: isLastPlayer ? '2px solid #ff9800' : '1px solid #e0e0e0'
                              }}>
                              <Typography variant="body2" sx={{ fontWeight: 600, minWidth: '80px' }}>
                                {player.name}
                              </Typography>
                            
                            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                              <TextField
                                size="small"
                                type="number"
                                placeholder="Pred"
                                value={player.predictions[roundIdx] ?? ""}
                                onChange={(e) => handlePrediction(roundIdx, playerIdx, e.target.value)}
                                disabled={!isFieldEditable(roundIdx, playerIdx, 'prediction')}
                                sx={{ width: '60px' }}
                              />
                              <Typography variant="body2" color="text.secondary">
                                /
                              </Typography>
                              <TextField
                                size="small"
                                type="number"
                                placeholder="Tricks"
                                value={player.tricks[roundIdx] ?? ""}
                                onChange={(e) => handleTricks(roundIdx, playerIdx, e.target.value)}
                                disabled={!isFieldEditable(roundIdx, playerIdx, 'tricks')}
                                sx={{ width: '60px' }}
                              />
                              <Typography variant="body2" sx={{ 
                                minWidth: '40px', 
                                textAlign: 'right',
                                fontWeight: 600,
                                color: '#1976d2'
                              }}>
                                {player.points[roundIdx] ?? 0}
                              </Typography>
                            </Box>
                          </Box>
                          </Box>
                          );
                        })}
                      </Stack>
                    </CardContent>
                  </Card>
                );
              })}
            </Stack>
          </Box>

          {/* Ranking */}
          <Box>
            <Typography variant="h6" mt={2} mb={2} sx={{ fontWeight: "bold", color: "#1976d2" }}>
              🏆 Κατάταξη
            </Typography>
            
            {/* Desktop Ranking Table */}
            <Box sx={{ display: { xs: 'none', md: 'block' } }}>
              <Table size="small" sx={{ maxWidth: 500, border: "1px solid #e0e0e0", borderRadius: 2 }}>
                <TableHead>
                  <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
                    <TableCell sx={{ fontWeight: "bold" }}>Κατάταξη</TableCell>
                    <TableCell sx={{ fontWeight: "bold" }}>Παίκτης</TableCell>
                    <TableCell sx={{ fontWeight: "bold" }}>Πόντοι</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {getRankedSummary(players, numPlayers, totalPoints).map(
                    (row, i) => (
                      <TableRow 
                        key={i}
                        sx={{ 
                          '&:nth-of-type(odd)': { backgroundColor: '#f9f9f9' },
                          '&:first-of-type': { backgroundColor: '#fff3e0', fontWeight: 'bold' }
                        }}
                      >
                        <TableCell>
                          {row["Κατάταξη"] === 1 ? "🥇" : row["Κατάταξη"] === 2 ? "🥈" : row["Κατάταξη"] === 3 ? "🥉" : row["Κατάταξη"]}
                      </TableCell>
                      <TableCell sx={{ fontWeight: row["Κατάταξη"] === 1 ? "bold" : "normal" }}>
                        {row["Παίκτης"]}
                      </TableCell>
                      <TableCell sx={{ fontWeight: row["Κατάταξη"] === 1 ? "bold" : "normal" }}>
                        {row["Σύνολο Πόντων"]}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
            </Box>
            
            {/* Mobile Ranking Cards */}
            <Box sx={{ display: { xs: 'block', md: 'none' } }}>
              <Stack spacing={1}>
                {getRankedSummary(players, numPlayers, totalPoints).map(
                  (row, i) => (
                    <Card 
                      key={i} 
                      sx={{ 
                        borderRadius: 2,
                        border: row["Κατάταξη"] === 1 ? '2px solid #ffd700' : '1px solid #e0e0e0',
                        backgroundColor: row["Κατάταξη"] === 1 ? '#fff8e1' : 'white'
                      }}
                    >
                      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="h6" sx={{ fontSize: '1.25rem' }}>
                              {row["Κατάταξη"] === 1 ? "🥇" : row["Κατάταξη"] === 2 ? "🥈" : row["Κατάταξη"] === 3 ? "🥉" : `#${row["Κατάταξη"]}`}
                            </Typography>
                            <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600 }}>
                              {row["Παίκτης"]}
                            </Typography>
                          </Box>
                          <Typography variant="h6" sx={{ 
                            fontSize: '1.25rem', 
                            fontWeight: 700, 
                            color: '#1976d2' 
                          }}>
                            {row["Σύνολο Πόντων"]}
                          </Typography>
                        </Box>
                      </CardContent>
                    </Card>
                  )
                )}
              </Stack>
            </Box>
          </Box>

          <Stack 
            direction={{ xs: 'column', sm: 'row' }} 
            spacing={2}
            sx={{ mt: 3 }}
          >
            {isHost && !isGameCompleted && (
              <Button 
                variant="contained" 
                color="success" 
                onClick={handleCompleteGame}
                disabled={completingGame}
                fullWidth={{ xs: true, sm: false }}
                sx={{
                  py: { xs: 1.5, sm: 1 },
                  borderRadius: 2,
                  fontWeight: 600
                }}
              >
                {completingGame ? 'Completing...' : 'Complete Game'}
              </Button>
            )}
            <Button 
              variant="outlined" 
              color="error" 
              onClick={handleResetGame}
              fullWidth={{ xs: true, sm: false }}
              sx={{
                py: { xs: 1.5, sm: 1 },
                borderRadius: 2,
                fontWeight: 600
              }}
            >
              Reset Game
            </Button>
            <Button 
              variant="outlined" 
              onClick={onLeaveGame}
              fullWidth={{ xs: true, sm: false }}
              sx={{
                py: { xs: 1.5, sm: 1 },
                borderRadius: 2,
                fontWeight: 600
              }}
            >
              Leave Game
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Container>
    </Box>
  );
}