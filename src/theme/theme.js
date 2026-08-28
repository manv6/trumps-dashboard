import { createTheme } from '@mui/material/styles';

// "Card table" design system: deep felt green + gold accents on warm ivory.
// One palette, one radius, one shadow — every screen reads as the same app.
const palette = {
  primary: {
    main: '#0F5F49', // felt green
    light: '#35836B',
    dark: '#063D2E',
    contrastText: '#FFFFFF',
  },
  secondary: {
    main: '#C9962E', // gold
    light: '#E0B85C',
    dark: '#9A701C',
    contrastText: '#241A05',
  },
  background: {
    default: '#F3F1EA', // warm ivory
    paper: '#FFFFFF',
  },
  text: {
    primary: '#1E2B26',
    secondary: '#5B6B64',
  },
  success: { main: '#2E7D32' },
  warning: { main: '#B45309' },
  error: { main: '#B3261E' },
  info: { main: '#0E7490' },
  divider: '#E4E0D5',
};

const softShadow =
  '0 1px 3px rgba(16, 42, 34, 0.08), 0 6px 20px rgba(16, 42, 34, 0.06)';

const theme = createTheme({
  palette,
  shape: { borderRadius: 12 },
  typography: {
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    h4: { fontWeight: 800, letterSpacing: '-0.5px' },
    h5: { fontWeight: 700, letterSpacing: '-0.3px' },
    h6: { fontWeight: 700 },
    subtitle1: { fontWeight: 600 },
    subtitle2: { fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 700 },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none' },
        elevation1: { boxShadow: softShadow },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          border: `1px solid ${palette.divider}`,
          boxShadow: softShadow,
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 10 },
        sizeLarge: { paddingTop: 12, paddingBottom: 12 },
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
          '&.Mui-selected': {
            backgroundColor: 'rgba(15, 95, 73, 0.10)',
            color: palette.primary.dark,
            fontWeight: 700,
            '&:hover': { backgroundColor: 'rgba(15, 95, 73, 0.16)' },
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
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 10 },
      },
    },
  },
});

export default theme;
