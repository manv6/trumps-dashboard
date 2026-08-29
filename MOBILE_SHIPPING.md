# 📱 Shipping Trumps to Android (Google Play) & iOS (App Store)

> **UPDATE:** the repo now contains a **native Expo app** in [`mobile/`](mobile/)
> — real React Native screens talking to the same backend, shippable via
> **EAS Build** (cloud iOS builds, no Mac needed). See [`mobile/README.md`](mobile/README.md)
> for run + ship instructions; the store-side sections of this guide
> (5.3+, 6.3+: consoles, review requirements, privacy) still apply.
> The Capacitor path below remains as the web-wrap alternative.

This guide covers everything needed to ship this app to both stores using
**Capacitor** — a native wrapper that packages the existing React build into
real Android/iOS apps. No rewrite needed: the React code stays exactly as it
is, and every future web change ships to mobile with one sync command.

> **Why Capacitor and not alternatives?**
> - *React Native* = full rewrite. Not worth it.
> - *Cordova* = legacy, effectively superseded by Capacitor.
> - *PWA only* = installable from the browser but **cannot be listed in the
>   Apple App Store**, and discoverability is poor. (A PWA/TWA shortcut for
>   Android only is described at the end as a cheaper option.)

---

## 0. The big picture

This project is **two apps**: the React client and the Node/Socket.io server.
A phone app cannot talk to `localhost`, so shipping to the stores has a hard
prerequisite:

```
┌─────────────┐        HTTPS + WebSocket        ┌──────────────────────┐
│  Phone app   │ ──────────────────────────────▶ │  Hosted backend      │
│  (Capacitor  │                                 │  (Railway/Render/…)  │
│  wraps the   │                                 │  Express + Socket.io │
│  React build)│                                 │  + MongoDB           │
└─────────────┘                                 └──────────────────────┘
```

**Order of operations:**
1. Deploy the backend publicly (Section 1)
2. Point the client at it via an env var (Section 2 — small code change)
3. Wrap with Capacitor (Section 3)
4. Icons/splash (Section 4)
5. Android → Play Store (Section 5)
6. iOS → App Store (Section 6)

### Accounts, hardware & costs

| Item | Needed for | Cost |
|------|-----------|------|
| Google Play Console account | Android | **$25 one-time** |
| Apple Developer Program | iOS | **$99 / year** |
| A Mac with Xcode | iOS builds (mandatory — no way around it) | — |
| Android Studio (any OS) | Android builds | free |
| Backend hosting (Railway hobby or similar) | both | ~$5/mo |
| MongoDB Atlas free tier | persistence | free |
| A privacy policy URL | both stores require it | free (a page on your site) |

---

## 1. Deploy the backend publicly

The repo already has Railway config (`railway.json`, `deploy-railway.sh`,
`Procfile`). Any host that supports **WebSockets** works (Railway, Render,
Fly.io — *not* Vercel serverless, which can't hold Socket.io connections).

```bash
# Railway (already configured in this repo)
npm i -g @railway/cli
railway login
railway init          # create/link project
railway up            # deploys using railway.json
```

Then in the Railway dashboard set the environment variables:

```
NODE_ENV=production
JWT_SECRET=<generate a long random string — do NOT keep the dev one>
MONGODB_URI=<MongoDB Atlas connection string>   # otherwise games vanish on restart!
```

> ⚠️ **MongoDB is not optional for production.** The in-memory fallback loses
> every user and game on each restart/redeploy. Create a free cluster at
> https://cloud.mongodb.com, allow access from anywhere (0.0.0.0/0), and set
> `MONGODB_URI`.

Verify: `https://<your-app>.up.railway.app/api/health` returns `{"status":"OK"}`.

The server already uses `origin: "*"` for CORS, so requests from the
Capacitor app (`capacitor://localhost` / `https://localhost`) will be accepted
without changes.

---

## 2. Point the client at the hosted backend (code change required)

**This is the one code change the app needs.** Three files currently build
URLs from `window.location.origin` in production — inside Capacitor the origin
is `capacitor://localhost`, so API calls would go nowhere.

Files affected:
- `src/AuthContext.js` (API_BASE_URL)
- `src/ActualMultiplayerGame.js` (socket URL)
- `src/MultiplayerGame.js` (socket URL)

Change the pattern to prefer a build-time env var. In `src/AuthContext.js`:

```js
const SERVER_URL = process.env.REACT_APP_SERVER_URL || '';

const API_BASE_URL = SERVER_URL
  ? `${SERVER_URL}/api`
  : (process.env.NODE_ENV === 'development'
      ? (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
          ? 'http://localhost:3002/api'
          : `http://${window.location.hostname}:3002/api`)
      : `${window.location.origin}/api`);
```

And in both game components, the socket URL becomes:

```js
const socketUrl = process.env.REACT_APP_SERVER_URL
  || (process.env.NODE_ENV === 'development'
      ? /* existing localhost:3002 logic */
      : window.location.origin);
```

Then create `.env.production` in the repo root (CRA picks it up automatically
for `npm run build`):

```
REACT_APP_SERVER_URL=https://<your-app>.up.railway.app
```

Web deployments are unaffected (when the var is unset, behavior is unchanged).

> 🔒 Must be **https** — Android and iOS block cleartext `http://` traffic in
> WebViews by default. Railway gives you https automatically.

---

## 3. Wrap the app with Capacitor

Requirements: **Node 20+** (you have v23 ✓).

```bash
cd /path/to/trumps-dashboard

npm install @capacitor/core
npm install -D @capacitor/cli

# Init — the appId becomes your bundle ID in BOTH stores and is
# effectively PERMANENT once published. Choose carefully.
npx cap init "Trumps" "com.evlastos.trumps" --web-dir=build

npm run build                 # production React build (reads .env.production)

npm install @capacitor/android @capacitor/ios
npx cap add android           # creates android/ (native project)
npx cap add ios               # creates ios/  (native project, Mac only)
npx cap sync                  # copies build/ into both native projects
```

This creates `capacitor.config.ts` — commit it, plus the `android/` and `ios/`
directories (they are real native projects, meant to be versioned).

**The routine for every future release:**

```bash
npm run build && npx cap sync
```

That's it — web changes flow into both native projects.

### Recommended quality-of-life plugins

```bash
npm install @capacitor/status-bar @capacitor/splash-screen @capacitor/app
npx cap sync
```

- `@capacitor/app`: handle the Android hardware back button (otherwise it
  exits the app instead of navigating back in React Router):

```js
// e.g. in src/index.js or MainApp.js
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

if (Capacitor.isNativePlatform()) {
  CapApp.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) window.history.back();
    else CapApp.exitApp();
  });
}
```

---

## 4. Icons & splash screens

One source image each, generated for every density automatically:

```bash
npm install -D @capacitor/assets
mkdir -p assets
# assets/icon.png        -> 1024x1024, no transparency for iOS
# assets/splash.png      -> 2732x2732, logo centered (use the ♠ + felt green #0F5F49)
# assets/splash-dark.png -> optional dark variant
npx capacitor-assets generate
```

---

## 5. Android → Google Play

### 5.1 Local build & test

- Install **Android Studio** (bundles the SDK; Capacitor needs JDK 21 —
  Android Studio's embedded JDK is fine).

```bash
npx cap open android        # opens the project in Android Studio
```

Run on the emulator or a USB-connected phone (enable Developer Options →
USB debugging). Test: register, create a live game, play a full round with a
second player (e.g. the web app in a browser).

### 5.2 Signing key (KEEP THIS SAFE FOREVER)

```bash
keytool -genkey -v -keystore trumps-release.keystore \
  -alias trumps -keyalg RSA -keysize 2048 -validity 10000
```

- Store the keystore + passwords in a password manager. **Losing it means you
  can never update the app again** (Play App Signing mitigates this — opt in
  when prompted during the first upload, it's the default and recommended).
- Never commit the keystore. Add `*.keystore` to `.gitignore`.

Configure it in `android/app/build.gradle` (signingConfigs → release) or just
use Android Studio: **Build → Generate Signed App Bundle** → choose the
keystore → build type `release` → produces an `.aab` file.

### 5.3 Play Console

1. https://play.google.com/console → pay $25, verify identity.
2. **Create app** → name "Trumps", app (not game category is fine either way —
   pick Game → Card).
3. Complete every item in the **Dashboard checklist**:
   - Store listing: short/full description, screenshots (min 2 per device
     type; take them from the emulator), 512×512 icon, feature graphic 1024×500.
   - **Privacy policy URL** (required — the app has accounts).
   - **Data safety form**: declare you collect email + username for
     account management (you do), data encrypted in transit, and offer
     account deletion (see 5.5).
   - Content rating questionnaire (card game, no gambling with real money →
     usually rated 3+/Everyone; answer the gambling questions carefully —
     this is a trick-taking game with points, **no real-money play**).
   - App access: provide a **test login** (email+password of a demo account)
     so reviewers can get past the auth screen.
4. Upload the `.aab` to **Internal testing** first, install via the opt-in
   link, sanity-check on a real device.

### 5.4 ⚠️ New personal accounts: mandatory testing period

Personal developer accounts created after Nov 2023 must run a
**closed test with at least 12 testers for 14 continuous days** before Play
grants access to production. Plan for this: recruit friends (their Gmail
addresses go in an email list on the closed-testing track). Organization
accounts are exempt.

### 5.5 Account deletion (both stores demand this)

Google (and Apple, more strictly) require that apps with account creation
offer **account deletion**. The backend currently has no delete endpoint —
add one before submission:

- `DELETE /api/user` (auth'd) that removes the user document, and a small
  "Delete my account" button in the app (e.g. under the header menu), plus a
  web URL that explains how to delete (Play asks for this link in the Data
  safety form).

### 5.6 Release

Promote the tested build to **Production** → review typically takes a few
hours to a few days for a first release.

---

## 6. iOS → App Store

### 6.1 Requirements

- A **Mac** with **Xcode 16+** (App Store submissions must be built with the
  current iOS SDK; keep Xcode updated).
- Apple Developer Program membership ($99/yr): https://developer.apple.com/programs/

### 6.2 Local build & test

```bash
npx cap open ios            # opens ios/App/App.xcworkspace in Xcode
```

1. In Xcode → target **App** → *Signing & Capabilities*: select your Team;
   Xcode manages certificates/profiles automatically for development.
2. Set the **Bundle Identifier** to match `com.evlastos.trumps`.
3. Run on the Simulator, then on a real iPhone (free with your account).
4. Test a full game against a second player on the web.

### 6.3 App Store Connect setup

1. https://appstoreconnect.apple.com → **My Apps → +** → New App →
   platform iOS, name "Trumps", bundle ID from the dropdown, SKU anything.
2. Fill in: description, keywords, support URL, **privacy policy URL**,
   screenshots (6.7" iPhone required set; take them in the Simulator with
   ⌘S), category *Games → Card*.
3. **App Privacy** section: declare Email Address + User ID collected, linked
   to identity, used for App Functionality. Not used for tracking.
4. **App Review Information**: provide a demo account login — reviewers WILL
   reject without it (guideline 2.1).

### 6.4 Things Apple specifically rejects this kind of app for

- **No account deletion** (guideline 5.1.1(v)) — same fix as Android 5.5.
  Apple actively checks this. Do it before first submission.
- **Sign in with Apple**: only required if you add third-party logins
  (Google/Facebook). Plain email+password does NOT trigger the requirement.
  If you ever add Google login, you must add Apple login too.
- **Web wrapper concerns (4.2 minimum functionality)**: Capacitor apps are
  accepted routinely, but make it feel like an app: no browser chrome
  artifacts, splash screen, proper status bar color (use
  `@capacitor/status-bar`, set it to the felt green), no dead ends. A real
  multiplayer game has clearly enough functionality — this is mostly about
  polish.
- Gambling questions: it's a points-based trick game, no wagering — say so in
  Review Notes if asked.

### 6.5 Upload & release

1. Xcode: **Product → Archive** (with target "Any iOS Device").
2. Organizer window → **Distribute App → App Store Connect → Upload**.
3. In App Store Connect the build appears after processing (~15 min).
4. Best practice: release to **TestFlight** first (internal testers install
   instantly; external testers need a light beta review), play a few games.
5. Attach the build to the version → **Submit for Review**.
   First reviews typically take 1–3 days.

---

## 7. Updating the app after changes

```bash
# every release
npm run build && npx cap sync

# Android: bump versionCode + versionName in android/app/build.gradle,
#          Generate Signed Bundle, upload to a Play track
# iOS: bump Version/Build in Xcode, Product → Archive, upload
```

- Store review is needed for every binary update (usually fast after the
  first one).
- Because the UI is a web build, consider an **OTA live-update service**
  later (Capgo, Ionic Appflow) to push JS/CSS changes without store review —
  allowed by both stores as long as native behavior doesn't change.

---

## 8. Pre-submission checklist (both stores)

- [ ] Backend deployed with HTTPS, `JWT_SECRET` rotated, MongoDB Atlas wired
- [ ] `.env.production` has `REACT_APP_SERVER_URL`; full game works on a phone
      against the hosted backend
- [ ] Account deletion endpoint + button + explainer URL
- [ ] Privacy policy URL live
- [ ] Demo account credentials for reviewers
- [ ] Icons + splash generated; status bar themed
- [ ] Android: keystore backed up, versionCode set, closed test running (new
      personal accounts: 12 testers × 14 days)
- [ ] iOS: screenshots for 6.7" iPhone, App Privacy filled, TestFlight pass
- [ ] Greek + English store listings? (App supports Greek labels — listing in
      both `el-GR` and `en-US` widens reach)

---

## 9. Cheaper Android-only alternative: PWA + TWA

If you only care about Android and want to skip native tooling:

1. Host the web build (Vercel config already exists) with a valid manifest
   (`public/manifest.json` is already there) + a service worker.
2. Use **Bubblewrap** (`npm i -g @bubblewrap/cli`, `bubblewrap init --manifest=...`)
   to generate a Trusted Web Activity — a Play-Store-installable shell around
   the hosted PWA.
3. Same Play Console flow as Section 5.

Pros: no native projects to maintain, updates are instant (it's just your
website). Cons: Android only (Apple does not accept TWAs), requires the site
to stay hosted, offline behavior needs a service worker.

**Recommendation:** go Capacitor for both stores; it keeps one codebase and
one workflow.
