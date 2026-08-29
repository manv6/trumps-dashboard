import React from 'react';
import { AppBar, Toolbar, Typography, Box, Chip, Button, Avatar } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

// Shared top bar: brand → back to lobby, current context, user + logout.
export default function AppHeader({ subtitle }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{ background: 'linear-gradient(120deg, #063D2E 0%, #0F5F49 100%)' }}
    >
      <Toolbar sx={{ gap: 1.5 }}>
        <Box
          onClick={() => navigate('/lobby')}
          sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer', userSelect: 'none' }}
        >
          <Typography component="span" sx={{ color: '#E0B85C', fontSize: '1.5rem', lineHeight: 1 }}>
            ♠
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '0.5px' }}>
            Trumps
          </Typography>
        </Box>
        {subtitle && (
          <Chip
            size="small"
            label={subtitle}
            sx={{ backgroundColor: 'rgba(255,255,255,0.14)', color: '#fff' }}
          />
        )}
        <Box sx={{ flexGrow: 1 }} />
        {user && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Avatar sx={{ width: 30, height: 30, bgcolor: '#C9962E', color: '#241A05', fontSize: '0.9rem', fontWeight: 700 }}>
                {user.username[0].toUpperCase()}
              </Avatar>
              <Typography variant="body2" sx={{ fontWeight: 600, display: { xs: 'none', sm: 'block' } }}>
                {user.username}
              </Typography>
            </Box>
            <Button color="inherit" size="small" onClick={logout} sx={{ opacity: 0.9 }}>
              Αποσύνδεση
            </Button>
          </Box>
        )}
      </Toolbar>
    </AppBar>
  );
}
