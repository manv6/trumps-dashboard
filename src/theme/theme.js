import { createTheme } from '@mui/material/styles';

// "Midnight Lounge" design system: a night room with a felt table —
// deep green-black surfaces, gold accents, warm white text.
// Matches the mobile app's night palette.
const palette = {
  mode: 'dark',
  primary: {
    main: '#d8b25c', // gold
    light: '#ecd9ad',
    dark: '#b8933e',
    contrastText: '#241A05',
  },
  secondary: {
    main: '#35836B', // felt green accent
    light: '#4fa588',
    dark: '#17453a',
    contrastText: '#FFFFFF',
  },
  background: {
    default: '#0a1412', // night room
    paper: '#10201d',
  },
  text: {
    primary: '#e8e4d8',
    secondary: '#8ea198',
  },
  success: { main: '#4caf7d' },
  warning: { main: '#e0b85c' },
  error: { main: '#e0847a' },
  info: { main: '#7fc4ec' },
  divider: 'rgba(216,178,92,0.2)',
};

const goldGlow = '0 0 18px rgba(216,178,92,0.25)';

const theme = createTheme({
  palette,
  shape: { borderRadius: 12 },
  typography: {
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    h4: { fontFamily: '"Marcellus", Georgia, serif', letterSpacing: '0.5px' },
    h5: { fontFamily: '"Marcellus", Georgia, serif', letterSpacing: '0.3px' },
    h6: { fontWeight: 700 },
    subtitle1: { fontWeight: 600 },
    subtitle2: { fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 700 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          background: 'radial-gradient(120% 90% at 50% 0%, #10201d 0%, #0a1412 45%, #060b0a 100%)',
          backgroundAttachment: 'fixed',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: '1px solid rgba(216,178,92,0.25)',
        },
        elevation1: { boxShadow: '0 6px 24px rgba(0,0,0,0.5)' },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          border: '1px solid rgba(216,178,92,0.25)',
          backgroundColor: 'rgba(255,255,255,0.03)',
          boxShadow: '0 6px 24px rgba(0,0,0,0.4)',
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 10 },
        sizeLarge: { paddingTop: 12, paddingBottom: 12 },
        containedPrimary: {
          background: 'linear-gradient(180deg, #ecd9ad 0%, #d8b25c 45%, #b8933e 100%)',
          color: '#241A05',
          boxShadow: goldGlow,
          '&:hover': {
            background: 'linear-gradient(180deg, #f2e4bd 0%, #e0bc68 45%, #c29d46 100%)',
            boxShadow: '0 0 24px rgba(216,178,92,0.4)',
          },
        },
        outlinedPrimary: {
          borderColor: 'rgba(216,178,92,0.6)',
          '&:hover': { borderColor: '#d8b25c', backgroundColor: 'rgba(216,178,92,0.08)' },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 600 },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 700 },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          color: '#8ea198',
          borderColor: 'rgba(216,178,92,0.25)',
          '&.Mui-selected': {
            backgroundColor: 'rgba(216,178,92,0.14)',
            color: '#d8b25c',
            fontWeight: 700,
            '&:hover': { backgroundColor: 'rgba(216,178,92,0.2)' },
          },
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-head': { fontWeight: 700, color: palette.text.primary },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { borderBottomColor: 'rgba(216,178,92,0.15)' },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 10 },
      },
    },
  },
});

export default theme;
