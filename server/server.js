const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*", // Allow all origins for development
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors({
  origin: "*", // Allow all origins for development
  credentials: true
}));
app.use(express.json());

// MongoDB connection (with fallback to in-memory storage)
let useDatabase = false;
if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/trumps-dashboard')
    .then(() => {
      console.log('Connected to MongoDB');
      useDatabase = true;
    })
    .catch(err => {
      console.log('MongoDB not available, using in-memory storage:', err.message);
      useDatabase = false;
    });
}

// User Schema
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// Game Schema
const gameSchema = new mongoose.Schema({
  gameId: { type: String, required: true, unique: true },
  hostId: { type: String, required: true },
  players: [{
    userId: String,
    username: String,
    socketId: String,
    isConnected: { type: Boolean, default: true }
  }],
  gameState: {
    numPlayers: { type: Number, default: 4 },
    rounds: [Number],
    currentRound: { type: Number, default: 0 },
    gameDate: String,
    playerData: [{
      name: String,
      predictions: [Number],
      tricks: [Number],
      points: [Number]
    }],
    isGameStarted: { type: Boolean, default: false },
    isGameCompleted: { type: Boolean, default: false }
  },
  finalScores: {
    type: Map,
    of: Number,
    default: {}
  },
  completedAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

const Game = mongoose.model('Game', gameSchema);

// In-memory active games for quick access
const activeGames = new Map();
const users = new Map(); // In-memory user storage for testing

// Helper Functions
function generateRounds(n) {
  let max;
  if (n >= 2 && n <= 5) {
    max = 10;
  } else {
    max = Math.floor(52 / n);
  }
  let rounds = [];
  for (let i = max; i > 2; i--) rounds.push(i);
  for (let i = 0; i < n; i++) rounds.push(2);
  for (let i = 3; i <= max; i++) rounds.push(i);
  return rounds;
}

// Authentication Routes
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    if (useDatabase) {
      // Check if user exists in database
      const existingUser = await User.findOne({ 
        $or: [{ email }, { username }] 
      });
      
      if (existingUser) {
        return res.status(400).json({ 
          error: 'User with this email or username already exists' 
        });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);
      
      // Create user
      const user = new User({
        username,
        email,
        password: hashedPassword
      });
      
      await user.save();
      
      // Generate JWT
      const token = jwt.sign(
        { userId: user._id, username: user.username },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '7d' }
      );
      
      res.status(201).json({
        token,
        user: {
          id: user._id,
          username: user.username,
          email: user.email
        }
      });
    } else {
      // In-memory storage for testing
      const userId = Date.now().toString();
      
      // Check if user exists
      for (let [, userData] of users) {
        if (userData.email === email || userData.username === username) {
          return res.status(400).json({ 
            error: 'User with this email or username already exists' 
          });
        }
      }
      
      const hashedPassword = await bcrypt.hash(password, 12);
      const userData = { username, email, password: hashedPassword };
      users.set(userId, userData);
      
      const token = jwt.sign(
        { userId, username },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '7d' }
      );
      
      res.status(201).json({
        token,
        user: { id: userId, username, email }
      });
    }
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (useDatabase) {
      // Find user in database
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(400).json({ error: 'Invalid credentials' });
      }
      
      // Check password
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ error: 'Invalid credentials' });
      }
      
      // Generate JWT
      const token = jwt.sign(
        { userId: user._id, username: user.username },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '7d' }
      );
      
      res.json({
        token,
        user: {
          id: user._id,
          username: user.username,
          email: user.email
        }
      });
    } else {
      // In-memory storage
      let foundUser = null;
      let foundId = null;
      
      for (let [id, userData] of users) {
        if (userData.email === email) {
          foundUser = userData;
          foundId = id;
          break;
        }
      }
      
      if (!foundUser) {
        return res.status(400).json({ error: 'Invalid credentials' });
      }
      
      const isMatch = await bcrypt.compare(password, foundUser.password);
      if (!isMatch) {
        return res.status(400).json({ error: 'Invalid credentials' });
      }
      
      const token = jwt.sign(
        { userId: foundId, username: foundUser.username },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '7d' }
      );
      
      res.json({
        token,
        user: {
          id: foundId,
          username: foundUser.username,
          email: foundUser.email
        }
      });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Game Routes
app.post('/api/create-game', async (req, res) => {
  try {
    const { userId, username, numPlayers } = req.body;
    
    const gameId = uuidv4().substr(0, 8).toUpperCase();
    const rounds = generateRounds(numPlayers);
    
    const gameData = {
      gameId,
      hostId: userId,
      players: [{
        userId,
        username,
        socketId: null,
        isConnected: false
      }],
      gameState: {
        numPlayers,
        rounds,
        currentRound: 0,
        gameDate: new Date().toISOString(),
        playerData: Array(8).fill("").map((_, i) => ({
          name: i === 0 ? username : `Παίκτης ${i + 1}`,
          predictions: [],
          tricks: [],
          points: []
        })),
        isGameStarted: false,
        isGameCompleted: false
      }
    };
    
    if (useDatabase) {
      const game = new Game(gameData);
      await game.save();
    }
    
    activeGames.set(gameId, gameData);
    
    res.json({ gameId, game: gameData });
  } catch (error) {
    console.error('Create game error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/join-game', async (req, res) => {
  try {
    const { gameId, userId, username } = req.body;
    
    let game = activeGames.get(gameId);
    
    if (!game && useDatabase) {
      const dbGame = await Game.findOne({ gameId });
      if (dbGame) {
        game = dbGame.toObject();
        activeGames.set(gameId, game);
      }
    }
    
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    if (game.players.length >= game.gameState.numPlayers) {
      return res.status(400).json({ error: 'Game is full' });
    }
    
    // Check if user already in game
    const existingPlayer = game.players.find(p => p.userId === userId);
    if (existingPlayer) {
      return res.status(400).json({ error: 'Already in this game' });
    }
    
    // Add player
    game.players.push({
      userId,
      username,
      socketId: null,
      isConnected: false
    });
    
    // Update player data
    const playerIndex = game.players.length - 1;
    game.gameState.playerData[playerIndex].name = username;
    
    if (useDatabase) {
      await Game.findOneAndUpdate(
        { gameId },
        { 
          players: game.players,
          gameState: game.gameState 
        },
        { new: true }
      );
    }
    
    // Update active games
    activeGames.set(gameId, game);
    
    res.json({ game });
  } catch (error) {
    console.error('Join game error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get game state by ID (for URL-based access)
app.get('/api/game/:gameId', async (req, res) => {
  try {
    const { gameId } = req.params;
    
    let game = activeGames.get(gameId);
    
    if (!game && useDatabase) {
      const dbGame = await Game.findOne({ gameId });
      if (dbGame) {
        game = dbGame.toObject();
        activeGames.set(gameId, game);
      }
    }
    
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    res.json({ game });
  } catch (error) {
    console.error('Get game error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// List all available games
app.get('/api/games', async (req, res) => {
  try {
    console.log('Games endpoint called, activeGames size:', activeGames.size);
    const gamesList = [];
    
    // Get games from active memory
    for (const game of activeGames.values()) {
      // Skip completed games
      if (game.gameState.isGameCompleted) {
        console.log('Skipping completed game:', game.gameId);
        continue;
      }
      
      const spotsAvailable = game.gameState.numPlayers - game.players.length;
      const connectedCount = game.players.filter(p => p.isConnected).length;
      
      console.log('Processing game:', game.gameId, 'spots:', spotsAvailable);
      
      gamesList.push({
        gameId: game.gameId,
        hostUsername: game.players[0]?.username || 'Unknown',
        playersCount: game.players.length,
        maxPlayers: game.gameState.numPlayers,
        spotsAvailable: spotsAvailable,
        connectedPlayers: connectedCount,
        isStarted: game.gameState.isGameStarted,
        isCompleted: game.gameState.isGameCompleted,
        currentRound: game.gameState.currentRound + 1,
        totalRounds: game.gameState.rounds.length,
        createdAt: game.createdAt || new Date().toISOString(),
        playerNames: game.players.map(p => p.username),
        playerIds: game.players.map(p => p.userId)
      });
    }
    
    // Get games from database if available
    if (useDatabase) {
      try {
        const dbGames = await Game.find({});
        for (const dbGame of dbGames) {
          // Skip if already in active games or if completed
          if (!activeGames.has(dbGame.gameId) && !dbGame.gameState.isGameCompleted) {
            const spotsAvailable = dbGame.gameState.numPlayers - dbGame.players.length;
            const connectedCount = dbGame.players.filter(p => p.isConnected).length;
            
            gamesList.push({
              gameId: dbGame.gameId,
              hostUsername: dbGame.players[0]?.username || 'Unknown',
              playersCount: dbGame.players.length,
              maxPlayers: dbGame.gameState.numPlayers,
              spotsAvailable: spotsAvailable,
              connectedPlayers: connectedCount,
              isStarted: dbGame.gameState.isGameStarted,
              isCompleted: dbGame.gameState.isGameCompleted,
              currentRound: dbGame.gameState.currentRound + 1,
              totalRounds: dbGame.gameState.rounds.length,
              createdAt: dbGame.createdAt,
              playerNames: dbGame.players.map(p => p.username),
              playerIds: dbGame.players.map(p => p.userId)
            });
          }
        }
      } catch (dbError) {
        console.log('Database query failed, using only active games');
      }
    }
    
    // Sort by creation date (newest first)
    gamesList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    console.log('Returning games list:', gamesList.length, 'games');
    res.json({ games: gamesList });
  } catch (error) {
    console.error('List games error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all games history with participation indicator
app.get('/api/games/history', async (req, res) => {
  const userId = req.query.userId; // Get userId from query params
  
  try {
    // Get all games from both active and database
    const allGames = [];
    
    // Get games from active memory
    for (const game of activeGames.values()) {
      allGames.push(game);
    }
    
    // Get games from database if available
    if (useDatabase) {
      try {
        const dbGames = await Game.find({});
        for (const dbGame of dbGames) {
          // Skip if already in active games
          if (!activeGames.has(dbGame.gameId)) {
            allGames.push(dbGame.toObject ? dbGame.toObject() : dbGame);
          }
        }
      } catch (dbError) {
        console.log('Database query failed, using only active games');
      }
    }
    
    const gameHistory = processGameHistory(allGames, userId);
    res.json(gameHistory);
  } catch (error) {
    console.error('Error fetching games history:', error);
    res.status(500).json({ error: 'Failed to fetch games history' });
  }
});

function processGameHistory(allGames, userId) {
  const gameHistory = allGames.map(game => {
    const userPlayer = game.players.find(player => player.userId === userId);
    const playerNames = game.players.map(player => player.username);
    const isParticipant = !!userPlayer;
    
    let userScore = null;
    let userRank = null;
    let finalResults = null;
    
    if (game.gameState.isGameCompleted && game.finalScores) {
      // Calculate final results with rankings
      const scores = Object.entries(game.finalScores)
        .map(([playerId, score]) => {
          const player = game.players.find(p => p.userId === playerId);
          return { 
            playerId, 
            username: player?.username || 'Unknown',
            score 
          };
        })
        .sort((a, b) => b.score - a.score);
      
      finalResults = scores.map((entry, index) => ({
        ...entry,
        rank: index + 1
      }));
      
      if (isParticipant) {
        userScore = game.finalScores[userId] || 0;
        userRank = scores.findIndex(entry => entry.playerId === userId) + 1;
      }
    } else if (game.gameState.isGameCompleted) {
      // Calculate from player data if finalScores not available
      const playerData = game.gameState.playerData.filter(p => p.name && p.name !== '' && p.points && p.points.length > 0);
      if (playerData.length > 0) {
        const scores = playerData.map((player, index) => {
          const totalScore = player.points.reduce((sum, points) => sum + points, 0);
          const gamePlayer = game.players[index];
          return {
            playerId: gamePlayer?.userId || `player-${index}`,
            username: player.name,
            score: totalScore
          };
        }).sort((a, b) => b.score - a.score);
        
        finalResults = scores.map((entry, index) => ({
          ...entry,
          rank: index + 1
        }));
        
        if (isParticipant) {
          const userEntry = scores.find(entry => entry.playerId === userId);
          userScore = userEntry?.score || 0;
          userRank = scores.findIndex(entry => entry.playerId === userId) + 1;
        }
      }
    }
    
    return {
      gameId: game.gameId,
      createdAt: game.createdAt || new Date().toISOString(),
      isStarted: game.gameState.isGameStarted,
      isCompleted: game.gameState.isGameCompleted,
      currentRound: game.gameState.currentRound + 1,
      totalRounds: game.gameState.rounds.length,
      playerNames,
      playersCount: game.players.length,
      maxPlayers: game.gameState.numPlayers,
      hostUsername: game.players[0]?.username || 'Unknown',
      isParticipant,
      userScore,
      userRank,
      finalResults
    };
  });
  
  // Sort by creation date (newest first)
  gameHistory.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  return gameHistory;
}

// Get user's game history (keep for backward compatibility)
app.get('/api/user/:userId/history', async (req, res) => {
  const { userId } = req.params;
  
  try {
    // Find all games where the user participated
    const userGames = [];
    
    // Get games from active memory
    for (const game of activeGames.values()) {
      if (game.players.some(player => player.userId === userId)) {
        userGames.push(game);
      }
    }
    
    // Get games from database if available
    if (useDatabase) {
      try {
        const dbGames = await Game.find({});
        for (const dbGame of dbGames) {
          if (!activeGames.has(dbGame.gameId) && 
              dbGame.players.some(player => player.userId === userId)) {
            userGames.push(dbGame.toObject ? dbGame.toObject() : dbGame);
          }
        }
      } catch (dbError) {
        console.log('Database query failed, using only active games');
      }
    }
    
    const gameHistory = processUserGameHistory(userGames, userId);
    res.json(gameHistory);
  } catch (error) {
    console.error('Error fetching user game history:', error);
    res.status(500).json({ error: 'Failed to fetch game history' });
  }
});

function processUserGameHistory(userGames, userId) {
  const gameHistory = userGames.map(game => {
    const playerNames = game.players.map(player => player.username);
    
    let userScore = null;
    let userRank = null;
    
    if (game.gameState.isGameCompleted && game.finalScores) {
      userScore = game.finalScores[userId] || 0;
      
      // Calculate rank based on final scores
      const scores = Object.entries(game.finalScores)
        .map(([playerId, score]) => ({ playerId, score }))
        .sort((a, b) => b.score - a.score);
      
      userRank = scores.findIndex(entry => entry.playerId === userId) + 1;
    }
    
    return {
      gameId: game.gameId,
      createdAt: game.createdAt || new Date().toISOString(),
      isStarted: game.gameState.isGameStarted,
      isCompleted: game.gameState.isGameCompleted,
      currentRound: game.gameState.currentRound + 1,
      totalRounds: game.gameState.rounds.length,
      playerNames,
      userScore,
      userRank
    };
  });
  
  // Sort by creation date (newest first)
  gameHistory.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  return gameHistory;
}

// Check if user is currently in any active game
app.get('/api/user/current-game', (req, res) => {
  const userId = req.query.userId; // Get userId from query params
  
  try {
    // Find any active game where the user is a participant
    let activeGame = null;
    
    // Check active games first
    for (const game of activeGames.values()) {
      if (!game.gameState.isGameCompleted && 
          game.players.some(player => player.userId === userId)) {
        activeGame = game;
        break;
      }
    }
    
    if (activeGame) {
      res.json({ 
        isInGame: true, 
        gameId: activeGame.gameId,
        gameStatus: activeGame.gameState.isGameStarted ? 'in-progress' : 'waiting'
      });
    } else {
      res.json({ isInGame: false });
    }
  } catch (error) {
    console.error('Error checking current game:', error);
    res.status(500).json({ error: 'Failed to check current game' });
  }
});

// End/Complete a game manually (for testing or force-ending games)
app.post('/api/game/:gameId/complete', async (req, res) => {
  try {
    const { gameId } = req.params;
    const { userId } = req.body; // User requesting completion
    
    console.log(`Complete game request: gameId=${gameId}, userId=${userId}`);
    console.log('Request body:', req.body);
    
    if (!userId) {
      return res.status(400).json({ error: 'userId is required in request body' });
    }
    
    let game = activeGames.get(gameId);
    
    if (!game && useDatabase) {
      const dbGame = await Game.findOne({ gameId });
      if (dbGame) {
        game = dbGame.toObject();
        activeGames.set(gameId, game);
      }
    }
    
    if (!game) {
      console.log(`Game not found: ${gameId}`);
      console.log('Available games:', Array.from(activeGames.keys()));
      return res.status(404).json({ error: 'Game not found' });
    }
    
    console.log(`Game found: ${gameId}, hostId=${game.hostId}, requestingUserId=${userId}`);
    console.log('Game players:', game.players.map(p => ({ userId: p.userId, username: p.username })));
    
    // Only host can force complete a game
    if (game.hostId !== userId) {
      console.log(`Permission denied: ${userId} is not host (${game.hostId})`);
      return res.status(403).json({ error: 'Only the host can complete the game' });
    }
    
    if (game.gameState.isGameCompleted) {
      console.log(`Game already completed: ${gameId}`);
      return res.status(400).json({ error: 'Game is already completed' });
    }
    
    // Calculate final scores based on current state
    const finalScores = {};
    for (let i = 0; i < game.gameState.numPlayers; i++) {
      const playerData = game.gameState.playerData[i];
      const player = game.players[i];
      
      if (player && playerData && playerData.points && playerData.points.length > 0) {
        const totalScore = playerData.points.reduce((sum, points) => sum + (points || 0), 0);
        finalScores[player.userId] = totalScore;
      }
    }
    
    // Mark game as completed
    game.gameState.isGameCompleted = true;
    game.finalScores = finalScores;
    game.completedAt = new Date().toISOString();
    
    // Update active games
    activeGames.set(gameId, game);
    
    // Save to database if available
    if (useDatabase) {
      try {
        await Game.findOneAndUpdate(
          { gameId },
          { 
            gameState: game.gameState,
            finalScores: finalScores,
            completedAt: game.completedAt
          },
          { new: true }
        );
      } catch (dbError) {
        console.error('Failed to save completed game to database:', dbError);
      }
    }
    
    console.log('Game manually completed:', gameId, 'Final scores:', finalScores);
    
    // Broadcast game state update to all players in the game
    io.to(gameId).emit('game-state', game);
    
    res.json({ 
      success: true, 
      message: 'Game completed successfully',
      finalScores,
      gameId 
    });
  } catch (error) {
    console.error('Error completing game:', error);
    res.status(500).json({ error: 'Failed to complete game: ' + error.message });
  }
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-game', async (data) => {
    const { gameId, userId, username } = data;
    
    try {
      const game = activeGames.get(gameId);
      if (!game) {
        socket.emit('error', 'Game not found');
        return;
      }
      
      // Update player socket
      const playerIndex = game.players.findIndex(p => p.userId === userId);
      if (playerIndex !== -1) {
        game.players[playerIndex].socketId = socket.id;
        game.players[playerIndex].isConnected = true;
      }
      
      socket.join(gameId);
      socket.gameId = gameId;
      socket.userId = userId;
      
      // Send current game state
      socket.emit('game-state', game);
      
      // Notify other players
      socket.to(gameId).emit('player-joined', {
        username,
        players: game.players
      });
      
    } catch (error) {
      socket.emit('error', 'Failed to join game');
    }
  });

  socket.on('game-action', async (data) => {
    const { gameId, action, payload } = data;
    
    try {
      const game = activeGames.get(gameId);
      if (!game) return;
      
      // Find the player making the action
      const playerIndex = game.players.findIndex(p => p.userId === socket.userId);
      if (playerIndex === -1) {
        socket.emit('error', 'Player not found in game');
        return;
      }
      
      // Update game state based on action
      switch (action) {
        case 'update-prediction':
          const { roundIdx, playerIdx, value } = payload;
          
          // Security check: players can only update their own data
          if (playerIdx !== playerIndex) {
            socket.emit('error', 'You can only update your own predictions');
            return;
          }
          
          // Round lock check: can only edit current or future rounds
          if (roundIdx < game.gameState.currentRound) {
            socket.emit('error', 'Cannot edit completed rounds');
            return;
          }
          
          game.gameState.playerData[playerIdx].predictions[roundIdx] = value;
          
          // Manual round advancement - removed auto-advance logic
          break;
          
        case 'update-tricks':
          const { roundIdx: rIdx, playerIdx: pIdx, value: val } = payload;
          
          // Security check: players can only update their own data
          if (pIdx !== playerIndex) {
            socket.emit('error', 'You can only update your own tricks');
            return;
          }
          
          // Round lock check: can edit current round and previous rounds (for corrections)
          if (rIdx > game.gameState.currentRound) {
            socket.emit('error', 'Can only edit tricks for current or previous rounds');
            return;
          }
          
          // Can only enter tricks if predictions are complete for this round
          const roundPredictions = game.gameState.playerData
            .slice(0, game.gameState.numPlayers)
            .map(p => p.predictions[rIdx]);
          
          const allPredictionsComplete = roundPredictions.every(pred => 
            pred !== undefined && pred !== null && pred !== ""
          );
          
          if (!allPredictionsComplete) {
            socket.emit('error', 'All players must complete predictions before entering tricks');
            return;
          }
          
          game.gameState.playerData[pIdx].tricks[rIdx] = val;
          
          // Calculate points
          const pred = game.gameState.playerData[pIdx].predictions[rIdx];
          const tricks = val;
          game.gameState.playerData[pIdx].points[rIdx] = 
            pred !== undefined && tricks !== undefined && pred === tricks
              ? tricks + 10
              : tricks || 0;
          
          // Manual round advancement - removed auto-advance logic
          break;
          
        case 'start-game':
          game.gameState.isGameStarted = true;
          break;
          
        case 'advance-round':
          // Any player can advance the round
          if (game.gameState.currentRound < game.gameState.rounds.length - 1) {
            game.gameState.currentRound += 1;
          } else if (game.gameState.currentRound === game.gameState.rounds.length - 1) {
            // Check if all tricks are complete for final round
            const finalRoundTricks = game.gameState.playerData
              .slice(0, game.gameState.numPlayers)
              .map(p => p.tricks[game.gameState.currentRound]);
            
            const allFinalTricksComplete = finalRoundTricks.every(trick => 
              trick !== undefined && trick !== null && trick !== ""
            );
            
            if (allFinalTricksComplete) {
              game.gameState.isGameCompleted = true;
              
              // Calculate and save final scores
              const finalScores = {};
              for (let i = 0; i < game.gameState.numPlayers; i++) {
                const playerData = game.gameState.playerData[i];
                const player = game.players[i];
                
                if (player && playerData && playerData.points && playerData.points.length > 0) {
                  const totalScore = playerData.points.reduce((sum, points) => sum + (points || 0), 0);
                  finalScores[player.userId] = totalScore;
                }
              }
              
              // Save final scores to the game object
              game.finalScores = finalScores;
              game.completedAt = new Date().toISOString();
              
              console.log('Game completed!', game.gameId, 'Final scores:', finalScores);
              
              // Broadcast game state update to all players in the game
              io.to(gameId).emit('game-state', game);
              
              // Save to database if available
              if (useDatabase) {
                try {
                  await Game.findOneAndUpdate(
                    { gameId: game.gameId },
                    { 
                      gameState: game.gameState,
                      finalScores: finalScores,
                      completedAt: game.completedAt
                    },
                    { new: true }
                  );
                  console.log('Game saved to database');
                } catch (dbError) {
                  console.error('Failed to save completed game to database:', dbError);
                }
              }
            }
          }
          break;
          
        case 'go-back-round':
          // Any player can go back to previous round
          if (game.gameState.currentRound > 0) {
            game.gameState.currentRound -= 1;
            game.gameState.isGameCompleted = false; // Unmark completion if going back
          }
          break;
          
        case 'reset-game':
          // Only host can reset game
          if (game.hostId !== socket.userId) {
            socket.emit('error', 'Only the host can reset the game');
            return;
          }
          
          game.gameState.playerData.forEach((player, idx) => {
            if (idx < game.players.length) {
              player.name = game.players[idx].username;
            } else {
              player.name = `Παίκτης ${idx + 1}`;
            }
            player.predictions = [];
            player.tricks = [];
            player.points = [];
          });
          game.gameState.isGameStarted = false;
          game.gameState.isGameCompleted = false;
          game.gameState.currentRound = 0;
          break;
          
        default:
          console.log('Unknown action:', action);
          break;
      }
      
      // Save to database if available
      if (useDatabase) {
        await Game.findOneAndUpdate(
          { gameId },
          { gameState: game.gameState },
          { new: true }
        );
      }
      
      // Broadcast to all players in the game
      io.to(gameId).emit('game-state', game);
      
    } catch (error) {
      socket.emit('error', 'Failed to process game action');
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    if (socket.gameId && socket.userId) {
      const game = activeGames.get(socket.gameId);
      if (game) {
        const playerIndex = game.players.findIndex(p => p.userId === socket.userId);
        if (playerIndex !== -1) {
          game.players[playerIndex].isConnected = false;
        }
        
        // Notify other players
        socket.to(socket.gameId).emit('player-disconnected', {
          userId: socket.userId,
          players: game.players
        });
      }
    }
  });
});

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

// For Vercel serverless functions
if (process.env.VERCEL) {
  module.exports = app;
} else {
  // For local development
  server.listen(PORT, HOST, () => {
    console.log(`Server running on port ${PORT}`);
  });
}