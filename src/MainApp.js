import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline, CircularProgress, Box, Container } from '@mui/material';
import { AuthProvider, useAuth } from './AuthContext';
import theme from './theme/theme';
import AuthPage from './AuthPage';
import GameLobby from './GameLobby';
import GameRoom from './GameRoom';
import ActualGameRoom from './ActualGameRoom';
import ActualGameHistory from './ActualGameHistory';
import AppHeader from './AppHeader';

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
      <Route
        path="/actual-history"
        element={
          <React.Fragment>
            <AppHeader subtitle="Ιστορικό" />
            <Container maxWidth="md" sx={{ py: 3 }}>
              <ActualGameHistory />
            </Container>
          </React.Fragment>
        }
      />
      <Route path="*" element={<Navigate to="/lobby" replace />} />
    </Routes>
  );
}

export default function MainApp() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <Router>
          <AppContent />
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}
