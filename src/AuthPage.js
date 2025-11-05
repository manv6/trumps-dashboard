import React, { useState } from 'react';
import {
  Container, Paper, Stack, Button, Typography,
  TextField, Box, Alert, Tabs, Tab
} from '@mui/material';
import { useAuth } from './AuthContext';

function TabPanel({ children, value, index }) {
  return (
    <div hidden={value !== index}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

export default function AuthPage() {
  const { login, register } = useAuth();
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Login form
  const [loginData, setLoginData] = useState({
    email: '',
    password: ''
  });
  
  // Register form
  const [registerData, setRegisterData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await login(loginData.email, loginData.password);
    
    if (!result.success) {
      setError(result.error);
    }
    
    setLoading(false);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (registerData.password !== registerData.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (registerData.password.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    const result = await register(
      registerData.username,
      registerData.email,
      registerData.password
    );
    
    if (!result.success) {
      setError(result.error);
    }
    
    setLoading(false);
  };

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
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
        }}>
          <Typography 
            variant="h4" 
            align="center" 
            gutterBottom
            sx={{ 
              fontSize: { xs: '1.75rem', sm: '2.125rem' },
              fontWeight: 700,
              background: 'linear-gradient(45deg, #667eea, #764ba2)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}
          >
            🎴 Trumps Dashboard
          </Typography>
          
          <Typography 
            variant="body1" 
            align="center" 
            color="text.secondary" 
            sx={{ 
              mb: 3,
              fontSize: { xs: '0.875rem', sm: '1rem' }
            }}
          >
            Join or create multiplayer Trump card games
          </Typography>

          <Tabs 
            value={tab} 
            onChange={(e, newValue) => setTab(newValue)} 
            centered
            sx={{
              '& .MuiTab-root': {
                fontSize: { xs: '0.875rem', sm: '1rem' },
                fontWeight: 600
              }
            }}
          >
            <Tab label="Σύνδεση" />
            <Tab label="Εγγραφή" />
          </Tabs>

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}

        <TabPanel value={tab} index={0}>
          <form onSubmit={handleLogin}>
            <Stack spacing={3}>
              <TextField
                label="Email"
                type="email"
                value={loginData.email}
                onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                required
                fullWidth
              />
              <TextField
                label="Κωδικός"
                type="password"
                value={loginData.password}
                onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                required
                fullWidth
              />
              <Button
                type="submit"
                variant="contained"
                size="large"
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
                {loading ? 'Σύνδεση...' : 'Σύνδεση'}
              </Button>
            </Stack>
          </form>
        </TabPanel>

        <TabPanel value={tab} index={1}>
          <form onSubmit={handleRegister}>
            <Stack spacing={3}>
              <TextField
                label="Όνομα Χρήστη"
                value={registerData.username}
                onChange={(e) => setRegisterData({ ...registerData, username: e.target.value })}
                required
                fullWidth
              />
              <TextField
                label="Email"
                type="email"
                value={registerData.email}
                onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                required
                fullWidth
              />
              <TextField
                label="Κωδικός"
                type="password"
                value={registerData.password}
                onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                required
                fullWidth
              />
              <TextField
                label="Επιβεβαίωση Κωδικού"
                type="password"
                value={registerData.confirmPassword}
                onChange={(e) => setRegisterData({ ...registerData, confirmPassword: e.target.value })}
                required
                fullWidth
              />
              <Button
                type="submit"
                variant="contained"
                size="large"
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
                {loading ? 'Εγγραφή...' : 'Εγγραφή'}
              </Button>
            </Stack>
          </form>
        </TabPanel>
      </Paper>
    </Container>
    </Box>
  );
}