import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from './config';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        const userData = await AsyncStorage.getItem('user');
        if (token && userData) {
          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          setUser(JSON.parse(userData));
        }
      } catch (e) {
        // corrupted storage — start signed out
      }
      setLoading(false);
    })();
  }, []);

  const persistSession = async (token, userObj) => {
    await AsyncStorage.setItem('token', token);
    await AsyncStorage.setItem('user', JSON.stringify(userObj));
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setUser(userObj);
  };

  const login = async (email, password) => {
    try {
      const { data } = await axios.post(`${API_URL}/login`, { email, password });
      await persistSession(data.token, data.user);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.error || 'Login failed' };
    }
  };

  const register = async (username, email, password) => {
    try {
      const { data } = await axios.post(`${API_URL}/register`, { username, email, password });
      await persistSession(data.token, data.user);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.error || 'Registration failed' };
    }
  };

  const logout = async () => {
    await AsyncStorage.multiRemove(['token', 'user']);
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
  };

  const createGame = async (numPlayers, mode = 'normal') => {
    try {
      const { data } = await axios.post(`${API_URL}/create-game`, {
        userId: user.id, username: user.username, numPlayers, mode,
      });
      return { success: true, gameId: data.gameId, game: data.game };
    } catch (error) {
      return { success: false, error: error.response?.data?.error || 'Failed to create game' };
    }
  };

  const joinGame = async (gameId) => {
    try {
      const { data } = await axios.get(`${API_URL}/game/${gameId}`);
      const game = data.game;
      const isUserInGame = game.players.some((p) => p.userId === user.id);
      if (isUserInGame) return { success: true, game };
      const joinRes = await axios.post(`${API_URL}/join-game`, {
        gameId, userId: user.id, username: user.username,
      });
      return { success: true, game: joinRes.data.game };
    } catch (error) {
      return { success: false, error: error.response?.data?.error || 'Failed to join game' };
    }
  };

  const listGames = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/games`);
      return { success: true, games: data.games };
    } catch (error) {
      return { success: false, games: [], error: error.response?.data?.error || 'Failed to list games' };
    }
  };

  const checkCurrentGame = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/user/current-game?userId=${user.id}`);
      return { success: true, ...data };
    } catch (error) {
      return { success: false, error: error.response?.data?.error || 'Failed to check current game' };
    }
  };

  const getActualGameHistory = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/actual-games/history`);
      return { success: true, games: data.games };
    } catch (error) {
      return { success: false, games: [], error: error.response?.data?.error || 'Failed to get history' };
    }
  };

  const value = {
    user, loading,
    login, register, logout,
    createGame, joinGame, listGames, checkCurrentGame, getActualGameHistory,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
