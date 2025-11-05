import React, { useState, useEffect } from 'react';
import {
  Container, Paper, Stack, Button, Typography,
  Table, TableHead, TableRow, TableCell, TableBody,
  TextField, Box, Alert, Chip, Avatar
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
    // Initialize socket connection
    const newSocket = io('http://localhost:5001');
    
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
      <Container maxWidth="xl">
        <Paper sx={{ p: 4, mt: 4 }}>
          <Typography variant="h5" align="center">
            Connecting to game...
          </Typography>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl">
      <Paper id="dashboard-content" sx={{ p: 4, mt: 4 }}>
        <Stack spacing={3}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <Box>
              <Typography variant="h4" align="left">
                🎴 Trumps – Multiplayer Game
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1 }}>
                <Chip 
                  label={`Game ID: ${gameId}`} 
                  variant="outlined" 
                  color="primary"
                />
                <Chip 
                  label={connected ? "🟢 Connected" : "🔴 Disconnected"} 
                  variant="outlined"
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
              display: "table",
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

          <Box sx={{ overflowX: "auto" }} data-table-container>
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

          {/* Ranking */}
          <Box>
            <Typography variant="h6" mt={2} mb={2} sx={{ fontWeight: "bold", color: "#1976d2" }}>
              🏆 Κατάταξη
            </Typography>
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
                  )
                )}
              </TableBody>
            </Table>
          </Box>

          <Stack direction="row" spacing={2}>
            {isHost && !isGameCompleted && (
              <Button 
                variant="contained" 
                color="success" 
                onClick={handleCompleteGame}
                disabled={completingGame}
              >
                {completingGame ? 'Completing...' : 'Complete Game'}
              </Button>
            )}
            <Button variant="outlined" color="error" onClick={handleResetGame}>
              Reset Game
            </Button>
            <Button variant="outlined" onClick={onLeaveGame}>
              Leave Game
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Container>
  );
}