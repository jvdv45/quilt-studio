# Quilt Studio — Deployment Guide
## GitHub + Netlify + PWA Home Screen Install

---

## What you need
- A free [GitHub](https://github.com) account
- A free [Netlify](https://netlify.com) account (sign up with GitHub)
- [Node.js](https://nodejs.org) installed (LTS version)
- A code editor — [VS Code](https://code.visualstudio.com) recommended

---

## Part 1 — Run locally

### Step 1 — Install dependencies

Open Terminal (Mac) or Command Prompt (Windows) inside the `quilt-studio` folder:

```bash
npm install
```

### Step 2 — Start the development server

```bash
npm start
```

Opens at `http://localhost:3000`. Press `Ctrl+C` to stop.

### Step 3 — Build for production

```bash
npm run build
```

Creates an optimised `build/` folder ready to deploy.

---

## Part 2 — Push to GitHub

### Step 4 — Create a GitHub repository

1. Go to [github.com/new](https://github.com/new)
2. Name it `quilt-studio`
3. Leave "Initialise with README" **unchecked**
4. Click **Create repository**

### Step 5 — Push your code

```bash
git init
git add .
git commit -m "Initial commit — Quilt Studio PWA"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/quilt-studio.git
git push -u origin main
```

> Replace `YOUR_USERNAME` with your GitHub username.

---

## Part 3 — Deploy to Netlify

### Step 6 — Connect Netlify

1. Go to [netlify.com](https://netlify.com) → **Add new site** → **Import an existing project**
2. Click **GitHub** and select your `quilt-studio` repo

### Step 7 — Build settings

| Setting | Value |
|---|---|
| Build command | `npm run build` |
| Publish directory | `build` |

Click **Deploy site**. Your app will be live in about 60 seconds at a URL like:
`https://quilt-studio-abc123.netlify.app`

Customise it under **Site settings → Domain management → Change site name**.

### Step 8 — Future updates

```bash
git add .
git commit -m "Your change description"
git push
```

Netlify auto-redeploys within ~60 seconds. Friends see the update immediately.

---

## Part 4 — Install on Home Screen (PWA)

The app is configured as a Progressive Web App. Once your Netlify URL is live:

### iPhone / iPad (Safari)
1. Open your Netlify URL in **Safari** (must be Safari, not Chrome)
2. Tap the **Share** button (box with arrow pointing up)
3. Scroll down and tap **Add to Home Screen**
4. Tap **Add** — the Quilt Studio icon appears on your home screen
5. Launch it — opens fullscreen with no browser address bar

### Android (Chrome)
1. Open your Netlify URL in **Chrome**
2. Chrome will show an **"Add Quilt Studio to Home screen"** banner automatically
3. Or tap the **3-dot menu** → **Add to Home screen**
4. Tap **Install** — it launches like a native app

### Desktop (Chrome / Edge)
1. Open your Netlify URL
2. Look for the **install icon** (⊕) in the address bar
3. Click it → **Install**
4. The app opens in its own window, appears in your taskbar/dock

---

## How the PWA works

| File | Purpose |
|---|---|
| `public/manifest.json` | App name, icon, display mode (standalone = no browser chrome) |
| `public/service-worker.js` | Caches app files so it works offline after first visit |
| `public/icon-192.png` | App icon for Android and general use |
| `public/icon-512.png` | High-res icon for splash screens |
| `public/apple-touch-icon.png` | Icon specifically for iPhone/iPad home screen |
| `public/index.html` | iOS PWA meta tags + safe area insets for notch devices |
| `src/index.jsx` | Registers the service worker on first load |

---

## Troubleshooting

**PWA install prompt not showing on Android**
The site must be served over HTTPS — Netlify does this automatically. Make sure you're using the `https://` URL, not `http://`.

**"Add to Home Screen" missing on iPhone**
Must use Safari. Chrome on iOS does not support PWA installation.

**App not updating after a change**
The service worker caches aggressively. After deploying, users may need to:
- Close and reopen the app once
- Or pull down to refresh if that gesture is available

To force an update, increment the `CACHE_NAME` version in `public/service-worker.js`
(e.g. change `quilt-studio-v1` to `quilt-studio-v2`) before pushing.

**Templates not persisting**
Templates are stored in `localStorage` — they're per-browser and per-device.
Clearing browser/app data will remove them.

**White screen after deploy**
Check Netlify build logs. Confirm publish directory is `build` not `public`.
