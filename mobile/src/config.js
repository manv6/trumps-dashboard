import Constants from 'expo-constants';

// In development (Expo Go / dev build) we derive the dev machine's LAN IP
// from the Metro bundler host, so a phone on the same WiFi reaches the local
// backend automatically. For production builds set EXPO_PUBLIC_SERVER_URL
// to the hosted backend (https), e.g. in eas.json or .env:
//   EXPO_PUBLIC_SERVER_URL=https://your-app.up.railway.app
const devHost = Constants.expoConfig?.hostUri?.split(':')[0];

export const SERVER_URL =
  process.env.EXPO_PUBLIC_SERVER_URL ||
  (devHost ? `http://${devHost}:3002` : 'http://localhost:3002');

export const API_URL = `${SERVER_URL}/api`;
