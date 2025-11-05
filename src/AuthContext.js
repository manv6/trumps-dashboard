import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const API_BASE_URL = process.env.NODE_ENV === 'development' 
  ? (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:3002/api'
      : `http://${window.location.hostname}:3002/api`)
  : 'http://localhost:3002/api';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      // Verify token with backend
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      const userData = localStorage.getItem('user');
      if (userData) {
        setUser(JSON.parse(userData));
      }
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/login`, {
        email,
        password
      });

      const { token, user } = response.data;
      
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      setUser(user);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Login failed'
      };
    }
  };

  const register = async (username, email, password) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/register`, {
        username,
        email,
        password
      });

      const { token, user } = response.data;
      
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      setUser(user);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Registration failed'
      };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
  };

  const createGame = async (numPlayers) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/create-game`, {
        userId: user.id,
        username: user.username,
        numPlayers
      });

      return {
        success: true,
        gameId: response.data.gameId,
        game: response.data.game
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to create game'
      };
    }
  };

  const joinGame = async (gameId) => {
    try {
      // First try to get the game state
      const gameResponse = await axios.get(`${API_BASE_URL}/game/${gameId}`);
      const game = gameResponse.data.game;
      
      // Check if user is already in the game
      const isUserInGame = game.players.some(player => player.userId === user.id);
      
      if (isUserInGame) {
        // User is already in the game, just return the game state
        return {
          success: true,
          game: game
        };
      } else {
        // User needs to join the game
        const joinResponse = await axios.post(`${API_BASE_URL}/join-game`, {
          gameId,
          userId: user.id,
          username: user.username
        });

        return {
          success: true,
          game: joinResponse.data.game
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to join game'
      };
    }
  };

  const getGame = async (gameId) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/game/${gameId}`);

      return {
        success: true,
        game: response.data.game
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to get game'
      };
    }
  };

  const listGames = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/games`);

      return {
        success: true,
        games: response.data.games
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to list games'
      };
    }
  };

  const getUserHistory = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/user/${user.id}/history`);

      return {
        success: true,
        games: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to get user history'
      };
    }
  };

  const getAllGamesHistory = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/games/history?userId=${user.id}`);
      return {
        success: true,
        games: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to get all games history'
      };
    }
  };

  const checkCurrentGame = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/user/current-game?userId=${user.id}`);
      return {
        success: true,
        ...response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to check current game'
      };
    }
  };

  const completeGame = async (gameId) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/game/${gameId}/complete`, {
        userId: user.id
      });
      return {
        success: true,
        ...response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to complete game'
      };
    }
  };

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    createGame,
    joinGame,
    getGame,
    listGames,
    getUserHistory,
    getAllGamesHistory,
    checkCurrentGame,
    completeGame
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};