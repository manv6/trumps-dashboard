import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Backend URL resolution:
// - EXPO_PUBLIC_SERVER_URL always wins (production native builds).
// - Web in development: the game server on the same machine, port 3002
//   (never the Metro origin - it serves the bundle, not the API).
// - Web in production (expo export served by the game server): same origin.
// - Native in development: the dev machine's LAN IP from the Metro host.
const devHost = Constants.expoConfig?.hostUri?.split(':')[0];
const isWeb = Platform.OS === 'web' && typeof window !== 'undefined';

let base;
if (process.env.EXPO_PUBLIC_SERVER_URL) {
  base = process.env.EXPO_PUBLIC_SERVER_URL;
} else if (isWeb) {
  base = __DEV__
    ? `http://${window.location.hostname}:3002`
    : window.location.origin;
} else {
  base = devHost ? `http://${devHost}:3002` : 'http://localhost:3002';
}

export const SERVER_URL = base;
export const API_URL = `${SERVER_URL}/api`;
