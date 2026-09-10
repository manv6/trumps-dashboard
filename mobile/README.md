# 📱 Trumps — Native Mobile App (Expo)

Native React Native app (Expo SDK 57) for the Trumps game. Talks to the same
backend as the web app (REST + Socket.io) — accounts, games, and history are
shared between web and mobile.

## Screens

- **Auth** — login/register (same accounts as the web app)
- **Lobby** — create game (Live Cards / Scoreboard mode), join by code,
  live list of open games, link to history
- **Live Game** — full real-time card game: waiting room, bidding,
  felt trick table, follow-suit hints, score sheet, end-of-game modal
- **Score Game** — scoreboard mode optimized for phones: one round at a time
  with your Π/Μ inputs, round navigation, standings
- **History** — completed live games

## Run in development

```bash
# 1. Start the backend (repo root)
cd server && node server.js          # listens on :3002

# 2. Start the app
cd mobile
npx expo start
```

Scan the QR with **Expo Go** (App Store / Play Store) on a phone that is on
the **same WiFi** as your computer. The app automatically points API calls at
your computer's LAN IP (derived from the Metro host) on port 3002 — no
configuration needed for development.

Press `i` for the iOS Simulator or `a` for an Android emulator.

## Point at a hosted backend

Set `EXPO_PUBLIC_SERVER_URL` (must be **https** for production builds):

```bash
# .env in mobile/ (picked up by Expo automatically), or inline:
EXPO_PUBLIC_SERVER_URL=https://your-app.up.railway.app npx expo start
```

## Ship to the stores (EAS)

EAS Build compiles in Expo's cloud — **no Mac needed for iOS builds**.

```bash
npm install -g eas-cli
eas login                       # free Expo account
eas build:configure             # creates eas.json

# Put the production backend URL in eas.json build profile:
#   "production": { "env": { "EXPO_PUBLIC_SERVER_URL": "https://..." } }

eas build --platform android --profile production   # -> .aab for Play Store
eas build --platform ios --profile production       # -> .ipa for App Store

# Submit straight from the CLI (needs store accounts, see ../MOBILE_SHIPPING.md)
eas submit --platform android
eas submit --platform ios
```

Store accounts, review requirements (privacy policy, demo login, account
deletion), and all the store-side steps are documented in
[`../MOBILE_SHIPPING.md`](../MOBILE_SHIPPING.md) — sections 5.3+ and 6.3+
apply unchanged; EAS replaces the local Android Studio/Xcode build steps.

## Architecture notes

- `src/config.js` — backend URL resolution (dev LAN auto-detect / env var)
- `src/AuthContext.js` — auth + REST calls, token in AsyncStorage
- `src/theme.js` — same felt-green/gold design system as the web app
- Game screens open their own Socket.io connection and mirror the web
  clients' server-driven protocol (`actual-action` for live games,
  `game-action` for scoreboard games). All game logic stays on the server.
