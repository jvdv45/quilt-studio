# Quilt Studio

A browser-based quilt design tool built for quilters. Upload photos of your actual fabrics, paint them onto a block grid, and export a preview image to share or print.

## Features

- **Custom grid** — set any size up to 20 × 20 blocks
- **Fabric upload** — use photos of your real fabrics as swatches
- **Paint & drag** — tap a block to colour it, or click-and-drag to paint multiple blocks at once
- **Replace All** — swap every block of one fabric for another in one step
- **Undo** — step back through your last 20 changes
- **Templates** — save a layout pattern and reload it for future designs (stored locally in your browser)
- **Export** — download your finished design as a PNG image
- **Zoom mode** — pinch to zoom and drag to pan on touch screens
- **Installable** — works as a PWA; add it to your home screen on iOS or Android

## Install on your device

Quilt Studio can be installed like a native app — no App Store required.

### iPhone / iPad (Safari)
1. Open the site in **Safari** (must be Safari, not Chrome)
2. Tap the **Share** button (box with arrow pointing up)
3. Scroll down and tap **Add to Home Screen**
4. Tap **Add** — the Quilt Studio icon appears on your home screen
5. Launch it — opens fullscreen with no browser address bar

### Android (Chrome)
1. Open the site in **Chrome**
2. Chrome will show an **"Add Quilt Studio to Home screen"** banner automatically
3. Or tap the **3-dot menu** → **Add to Home screen**
4. Tap **Install** — it launches like a native app

### Desktop (Chrome / Edge)
1. Open the site in Chrome or Edge
2. Look for the **install icon** (⊕) in the address bar
3. Click it → **Install**
4. The app opens in its own window and appears in your taskbar/dock

## Running locally

```bash
npm install
npm start
```

Opens at `http://localhost:3000`. Changes hot-reload automatically.

## Building for production

```bash
npm run build
```

Outputs an optimised `build/` folder ready to deploy.

## Deploying to Netlify

1. Push this repo to GitHub
2. Go to [netlify.com](https://netlify.com) → **Add new site** → **Import an existing project**
3. Select your repo and use these build settings:

| Setting | Value |
|---|---|
| Build command | `npm run build` |
| Publish directory | `build` |

Future updates deploy automatically when you push to `main`.

## Tech

- [React 18](https://react.dev) (Create React App)
- No UI library — all styling is plain inline styles
- Templates and undo history stored in `localStorage`
