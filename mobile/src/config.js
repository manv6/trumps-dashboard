import Constants from 'expo-constants';
import { Platform } from 'react-native';

// In development (Expo Go / dev build) we derive the dev machine's LAN IP
// from the Metro bundler host, so a phone on the same WiFi reaches the local
// backend automatically. For production NATIVE builds set
// EXPO_PUBLIC_SERVER_URL to the hosted backend (https). A production WEB
// build (expo export --platform web served by the game server) talks to its
// own origin.
const devHost = Constants.expoConfig?.hostUri?.split(':')[0];
const webOrigin = Platform.OS === 'web' && typeof window !== 'undefined'
  ? window.location.origin
  : null;

export const SERVER_URL =
  process.env.EXPO_PUBLIC_SERVER_URL ||
  (devHost ? `http://${devHost}:3002` : (webOrigin || 'http://localhost:3002'));

export const API_URL = `${SERVER_URL}/api`;
