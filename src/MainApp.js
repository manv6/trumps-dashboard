import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import AuthPage from './AuthPage';
import GameLobby from './GameLobby';
import GameRoom from './GameRoom';
import ActualGameRoom from './ActualGameRoom';
import { CircularProgress, Box } from '@mui/material';

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/lobby" replace />} />
      <Route path="/lobby" element={<GameLobby />} />
      <Route path="/game/:gameId" element={<GameRoom />} />
      <Route path="/actual-game/:gameId" element={<ActualGameRoom />} />
      <Route path="/actual-history" element={React.createElement(require('./ActualGameHistory').default)} />
      <Route path="*" element={<Navigate to="/lobby" replace />} />
    </Routes>
  );
}

export default function MainApp() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}