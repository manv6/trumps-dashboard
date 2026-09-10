import React from 'react';
import { AppBar, Toolbar, Typography, Box, Chip, Button, Avatar } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

// Midnight Lounge top bar: gold TRUMPS brand -> lobby, screen context, user + logout.
export default function AppHeader({ subtitle }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        background: 'linear-gradient(180deg, #060b0a 0%, #0d1a17 100%)',
        borderBottom: '1px solid rgba(216,178,92,0.3)',
      }}
    >
      <Toolbar sx={{ gap: 1.5 }}>
        <Box
          onClick={() => navigate('/lobby')}
          sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer', userSelect: 'none' }}
        >
          <Typography component="span" sx={{ color: '#d8b25c', fontSize: '1.4rem', lineHeight: 1 }}>
            ♠
          </Typography>
          <Typography
            sx={{ fontFamily: '"Marcellus", Georgia, serif', fontSize: '1.15rem', letterSpacing: '3px', color: '#d8b25c' }}
          >
            TRUMPS
          </Typography>
        </Box>
        {subtitle && (
          <Chip
            size="small"
            label={subtitle}
            sx={{ backgroundColor: 'rgba(255,255,255,0.08)', color: '#e8e4d8', border: '1px solid rgba(216,178,92,0.3)' }}
          />
        )}
        <Box sx={{ flexGrow: 1 }} />
        {user && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Avatar sx={{ width: 30, height: 30, bgcolor: '#d8b25c', color: '#241A05', fontSize: '0.9rem', fontWeight: 700 }}>
                {user.username[0].toUpperCase()}
              </Avatar>
              <Typography variant="body2" sx={{ fontWeight: 600, color: '#e8e4d8', display: { xs: 'none', sm: 'block' } }}>
                {user.username}
              </Typography>
            </Box>
            <Button size="small" onClick={logout} sx={{ color: '#8ea198' }}>
              Έξοδος
            </Button>
          </Box>
        )}
      </Toolbar>
    </AppBar>
  );
}
