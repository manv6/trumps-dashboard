const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
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

// Serve static files from React build (for production)
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../build')));
}

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
  mode: { type: String, default: 'normal' }, // 'normal' or 'actual'
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
  playerNames: [String],
  winners: [String],
  scores: [Number],
  actualState: { type: mongoose.Schema.Types.Mixed, default: null },
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

// ===== Actual-mode (real-time card play) game engine =====
const CARD_SUITS = ['\u2660', '\u2665', '\u2666', '\u2663']; // spades hearts diamonds clubs
const CARD_VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

// Private hands are kept OUT of the game object so broadcasting
// `game-state` can never leak another player's cards.
const actualHands = new Map(); // gameId -> [[card, ...], ...] per player index

function createShuffledDeck() {
  const deck = [];
  for (const suit of CARD_SUITS) {
    for (const value of CARD_VALUES) deck.push({ suit, value });
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

const cardRank = (card) => CARD_VALUES.indexOf(card.value);
const sameCard = (a, b) => a && b && a.suit === b.suit && a.value === b.value;

// Deal a new round: hands, trump card, reset trick state, prediction phase
function startActualRound(game) {
  const numPlayers = game.gameState.numPlayers;
  const roundIdx = game.gameState.currentRound;
  const cards = game.gameState.rounds[roundIdx];
  const deck = createShuffledDeck();
  const hands = Array(numPlayers).fill(null).map((_, i) =>
    deck.slice(i * cards, (i + 1) * cards)
  );
  actualHands.set(game.gameId, hands);

  const firstPlayer = roundIdx % numPlayers;
  game.actualState = {
    phase: 'predicting', // 'predicting' | 'playing' | 'game-over'
    roundIdx,
    cardsThisRound: cards,
    trumpSuit: '\u2660', // spades are always trump (balanders)
    firstPlayer,
    turn: firstPlayer,
    predictions: Array(numPlayers).fill(null),
    currentTrick: [], // [{ playerIdx, card }]
    completedTrick: null, // last finished trick { trick, winner }, for display
    lastTrickWinner: null,
    tricksWon: Array(numPlayers).fill(0)
  };
}

// Public view of the actual-mode state (hand sizes only, no cards)
function actualPublicState(game) {
  const s = game.actualState;
  if (!s) return null;
  const hands = actualHands.get(game.gameId) || [];
  return { ...s, handCounts: hands.map(h => h.length) };
}

// Send each connected player their own hand privately
function emitActualHands(game) {
  const hands = actualHands.get(game.gameId) || [];
  game.players.forEach((player, idx) => {
    if (player.socketId && player.isConnected) {
      io.to(player.socketId).emit('your-hand', { playerIdx: idx, hand: hands[idx] || [] });
    }
  });
}

// Highest trump wins; otherwise highest card of the lead suit
function actualTrickWinner(trick, trumpSuit) {
  let best = 0;
  for (let i = 1; i < trick.length; i++) {
    const card = trick[i].card;
    const bestCard = trick[best].card;
    const isTrump = trumpSuit && card.suit === trumpSuit;
    const bestIsTrump = trumpSuit && bestCard.suit === trumpSuit;
    if (isTrump && !bestIsTrump) {
      best = i;
    } else if (!!isTrump === !!bestIsTrump && card.suit === bestCard.suit && cardRank(card) > cardRank(bestCard)) {
      best = i;
    }
  }
  return trick[best].playerIdx;
}

// Mark the game finished and stamp the fields the history views read
function finalizeActualGame(game) {
  const numPlayers = game.gameState.numPlayers;
  const totals = [];
  for (let i = 0; i < numPlayers; i++) {
    totals.push(game.gameState.playerData[i].points.reduce((a, b) => a + (b || 0), 0));
  }
  const names = game.players.map(p => p.username);
  const maxScore = Math.max(...totals);

  game.gameState.isGameCompleted = true;
  game.completedAt = new Date().toISOString();
  game.playerNames = names;
  game.scores = totals;
  game.winners = names.filter((_, i) => totals[i] === maxScore);
  game.finalScores = {};
  game.players.forEach((p, i) => { game.finalScores[p.userId] = totals[i]; });
  game.actualState = { ...game.actualState, phase: 'game-over', currentTrick: [], turn: -1 };
  actualHands.delete(game.gameId);
}

// Record round results into the shared score sheet, then advance to the
// next round or finish the game. Returns true when the game completed.
function finishActualRound(game) {
  const s = game.actualState;
  const roundIdx = s.roundIdx;
  for (let i = 0; i < game.gameState.numPlayers; i++) {
    const pd = game.gameState.playerData[i];
    pd.predictions[roundIdx] = s.predictions[i];
    pd.tricks[roundIdx] = s.tricksWon[i];
    pd.points[roundIdx] = s.predictions[i] === s.tricksWon[i]
      ? s.tricksWon[i] + 10
      : s.tricksWon[i];
  }
  if (roundIdx < game.gameState.rounds.length - 1) {
    game.gameState.currentRound = roundIdx + 1;
    startActualRound(game);
    return false;
  }
  finalizeActualGame(game);
  return true;
}

async function persistActualGame(game) {
  if (!useDatabase) return;
  try {
    await Game.findOneAndUpdate(
      { gameId: game.gameId },
      {
        gameState: game.gameState,
        actualState: game.actualState,
        finalScores: game.finalScores,
        completedAt: game.completedAt,
        playerNames: game.playerNames,
        winners: game.winners,
        scores: game.scores
      },
      { new: true }
    );
  } catch (e) {
    console.error('Failed to persist actual game:', e.message);
  }
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
  const { userId, username, numPlayers, mode } = req.body;
    
    const gameId = uuidv4().substr(0, 8).toUpperCase();
    const rounds = generateRounds(numPlayers);
    
    const gameData = {
      gameId,
      hostId: userId,
      mode: mode === 'actual' ? 'actual' : 'normal',
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
        mode: game.mode || 'normal',
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
              mode: dbGame.mode || 'normal',
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
      mode: game.mode || 'normal',
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
        mode: activeGame.mode || 'normal',
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


// Complete an actual-mode game. The server normally finishes the game by
// itself after the last trick; this endpoint is a safety valve for clients
// and returns the final result either way.
app.post('/api/actual-game/:gameId/complete', async (req, res) => {
  try {
    const { gameId } = req.params;
    const { userId } = req.body;

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
    if (game.mode !== 'actual') {
      return res.status(400).json({ error: 'Not an actual-mode game' });
    }
    if (!game.players.some(p => p.userId === userId)) {
      return res.status(403).json({ error: 'Only players in this game can complete it' });
    }

    if (!game.gameState.isGameCompleted) {
      finalizeActualGame(game);
      await persistActualGame(game);
      io.to(gameId).emit('game-state', game);
      io.to(gameId).emit('actual-state', actualPublicState(game));
    }

    res.json({
      success: true,
      gameId,
      completedAt: game.completedAt,
      playerNames: game.playerNames,
      winners: game.winners,
      scores: game.scores,
      finalScores: game.finalScores
    });
  } catch (error) {
    console.error('Error completing actual game:', error);
    res.status(500).json({ error: 'Failed to complete actual game' });
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
      
      // Actual mode: send public card state and this player's private hand
      if (game.mode === 'actual' && game.actualState) {
        socket.emit('actual-state', actualPublicState(game));
        const hands = actualHands.get(gameId);
        if (hands && playerIndex !== -1) {
          socket.emit('your-hand', { playerIdx: playerIndex, hand: hands[playerIndex] || [] });
        }
      }
      
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


  // Real-time card play actions (actual mode). All game logic runs on the
  // server; clients only send intents and render the broadcast state.
  socket.on('actual-action', async (data) => {
    const { gameId, action, payload = {} } = data;
    try {
      const game = activeGames.get(gameId);
      if (!game || game.mode !== 'actual') {
        socket.emit('error', 'Actual game not found');
        return;
      }
      const playerIndex = game.players.findIndex(p => p.userId === socket.userId);
      if (playerIndex === -1) {
        socket.emit('error', 'Player not found in game');
        return;
      }
      const numPlayers = game.gameState.numPlayers;
      const s = game.actualState;

      switch (action) {
        case 'start-game': {
          if (game.hostId !== socket.userId) {
            socket.emit('error', 'Only the host can start the game');
            return;
          }
          if (game.players.length < numPlayers) {
            socket.emit('error', `Waiting for players (${game.players.length}/${numPlayers})`);
            return;
          }
          if (game.gameState.isGameStarted && game.actualState) {
            break; // already started, just rebroadcast
          }
          game.gameState.isGameStarted = true;
          game.gameState.currentRound = 0;
          startActualRound(game);
          break;
        }

        case 'predict': {
          if (!s || s.phase !== 'predicting') {
            socket.emit('error', 'Not in the prediction phase');
            return;
          }
          if (s.turn !== playerIndex) {
            socket.emit('error', 'Not your turn to predict');
            return;
          }
          const value = Number(payload.value);
          if (!Number.isInteger(value) || value < 0 || value > s.cardsThisRound) {
            socket.emit('error', 'Invalid prediction');
            return;
          }
          const isLastPredictor =
            (s.turn - s.firstPlayer + numPlayers) % numPlayers === numPlayers - 1;
          if (isLastPredictor) {
            const sumSoFar = s.predictions.reduce((a, b) => a + (b ?? 0), 0);
            if (value === s.cardsThisRound - sumSoFar) {
              socket.emit('error', `The total cannot equal ${s.cardsThisRound} - pick another number`);
              return;
            }
          }
          s.predictions[playerIndex] = value;
          if (isLastPredictor) {
            s.phase = 'playing';
            s.turn = s.firstPlayer;
          } else {
            s.turn = (s.turn + 1) % numPlayers;
          }
          break;
        }

        case 'play-card': {
          if (!s || s.phase !== 'playing') {
            socket.emit('error', 'Not in the playing phase');
            return;
          }
          if (s.turn !== playerIndex) {
            socket.emit('error', 'Not your turn to play');
            return;
          }
          const hands = actualHands.get(gameId) || [];
          const hand = hands[playerIndex] || [];
          const cardIdx = hand.findIndex(c => sameCard(c, payload.card));
          if (cardIdx === -1) {
            socket.emit('error', 'That card is not in your hand');
            return;
          }
          // Must follow the lead suit when possible
          if (s.currentTrick.length > 0) {
            const leadSuit = s.currentTrick[0].card.suit;
            const hasLead = hand.some(c => c.suit === leadSuit);
            if (hasLead && hand[cardIdx].suit !== leadSuit) {
              socket.emit('error', `You must follow suit (${leadSuit})`);
              return;
            }
          }
          const card = hand.splice(cardIdx, 1)[0];
          s.currentTrick.push({ playerIdx: playerIndex, card });

          if (s.currentTrick.length === numPlayers) {
            // Trick complete: resolve winner, winner leads the next trick
            const winner = actualTrickWinner(s.currentTrick, s.trumpSuit);
            s.tricksWon[winner] += 1;
            s.completedTrick = { trick: s.currentTrick, winner };
            s.lastTrickWinner = winner;
            s.currentTrick = [];
            s.turn = winner;

            if (hands.every(h => h.length === 0)) {
              // Round over: score it, deal the next round or finish the game
              const gameDone = finishActualRound(game);
              if (gameDone) {
                io.to(gameId).emit('game-completed', {
                  finalScores: game.finalScores,
                  winners: game.winners,
                  scores: game.scores,
                  playerNames: game.playerNames
                });
              }
            }
          } else {
            s.turn = (s.turn + 1) % numPlayers;
          }
          break;
        }

        default:
          socket.emit('error', 'Unknown actual-game action');
          return;
      }

      await persistActualGame(game);
      io.to(gameId).emit('game-state', game);
      io.to(gameId).emit('actual-state', actualPublicState(game));
      emitActualHands(game);
    } catch (error) {
      console.error('actual-action error:', error);
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

// Health check endpoint
// Get completed advanced/actual games history
app.get('/api/actual-games/history', async (req, res) => {
  try {
    let actualGames = [];
    // Get games from active memory
    for (const game of activeGames.values()) {
      if (game.mode === 'actual' && game.gameState.isGameCompleted) {
        actualGames.push(game);
      }
    }
    // Get games from database if available
    if (useDatabase) {
      try {
        const dbGames = await Game.find({ mode: 'actual', 'gameState.isGameCompleted': true });
        for (const dbGame of dbGames) {
          // Skip if already in active games
          if (!activeGames.has(dbGame.gameId)) {
            actualGames.push(dbGame.toObject ? dbGame.toObject() : dbGame);
          }
        }
      } catch (dbError) {
        console.log('Database query failed, using only active games');
      }
    }
    // Sort by completion date (newest first)
    actualGames.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
    res.json({ games: actualGames });
  } catch (error) {
    console.error('Error fetching actual games history:', error);
    res.status(500).json({ error: 'Failed to fetch actual games history' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Catch-all handler: send back React's index.html file for production
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../build/index.html'));
  });
}

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