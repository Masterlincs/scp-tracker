# SCP Tracker — Build and Review Guide

This document provides everything required to reproduce the exact build artifacts for the SCP Tracker browser extension and to verify the build process.

## Overview

- __Build tool__: esbuild (bundler + minifier)
- __Languages__: JavaScript, HTML, CSS
- __Outputs__: Per-target build directories
  - Chrome MV3: `dist-chrome/`
  - Firefox MV3: `dist-firefox/`
  - Firefox MV2: `dist-firefox-mv2/`
- __Build script__: `scripts/build.js`
- __Package scripts__: defined in `package.json`

## Operating system and build environment requirements

- __OS__: Windows 10/11, macOS 13+/14+, or Linux (Ubuntu 20.04+/22.04+)
- __Node.js__: version >= 16.0.0
- __npm__: version >= 8.0.0
- __Disk space__: ~500 MB free (node_modules + build outputs)
- __Network__: outbound access to npm registry for dependency install

The above constraints are declared in `package.json` under the `engines` field.

## Prerequisites and installation

1. Install Node.js and npm:
   - Windows/macOS: https://nodejs.org/ (LTS recommended)
   - Linux: use your distribution package manager or NodeSource installers
2. Verify versions:
   ```bash
   node -v
   npm -v
   ```
   Ensure Node >= 16 and npm >= 8.
3. Install dependencies (uses exact versions from `package-lock.json` if present):
   ```bash
   npm ci
   ```
   If you are modifying dependencies, use:
   ```bash
   npm install
   ```

## Build script summary

The build is executed by `scripts/build.js` (Node script) and uses __esbuild__ to:
- Bundle each JS entry (`bundle: true`)
- Generate sourcemaps (inline for dev, external for prod)
- Minify in production (`minify: true` when `NODE_ENV=production`)
- Target specific browsers per output
- Copy static assets (HTML/CSS/icons/JSON)
- Transform `manifest.json` per target (MV3 Chrome, MV3 Firefox, MV2 Firefox)

Entry points bundled:
- `src/background.js`
- `src/content.js`
- `src/pages/settings/settings.js`
- `src/popup/popup.js`
- `src/pages/onboarding/onboarding.js`

Outputs are written to one of: `dist-chrome/`, `dist-firefox/`, `dist-firefox-mv2/`.

## Step‑by‑step build instructions (exact reproduction)

1. Clean prior outputs (optional but recommended):
   ```bash
   npm run clean
   ```
2. Set production mode for deterministic minified bundles:
   ```bash
   set NODE_ENV=production    # Windows CMD
   $env:NODE_ENV="production" # PowerShell
   export NODE_ENV=production  # macOS/Linux
   ```
3. Build all targets in sequence (Chrome MV3, Firefox MV3, Firefox MV2):
   ```bash
   npm run build
   ```
   This runs `node scripts/build.js` for each target and produces:
   - `dist-chrome/`
   - `dist-firefox/`
   - `dist-firefox-mv2/`

Alternatively, build a single target:
- Chrome MV3:
  ```bash
  npm run build:chrome
  ```
- Firefox MV3:
  ```bash
  npm run build:firefox
  ```
- Firefox MV2:
  ```bash
  npm run build:firefox:mv2
  ```

4. (Optional) Create ZIPs for store upload:
   - Chrome Web Store: zip contents of `dist-chrome/`
   - AMO (Firefox Add-ons): zip contents of `dist-firefox/` (MV3) or `dist-firefox-mv2/` (MV2)

Example (macOS/Linux):
```bash
(cd dist-chrome && zip -r ../chrome.zip .)
(cd dist-firefox && zip -r ../firefox.zip .)
(cd dist-firefox-mv2 && zip -r ../firefox-mv2.zip .)
```
On Windows (PowerShell):
```powershell
Compress-Archive -Path dist-chrome\* -DestinationPath chrome.zip -Force
Compress-Archive -Path dist-firefox\* -DestinationPath firefox.zip -Force
Compress-Archive -Path dist-firefox-mv2\* -DestinationPath firefox-mv2.zip -Force
```

## Loading the extension for local testing

- __Chrome__ (MV3):
  1) Open chrome://extensions
  2) Enable Developer mode
  3) Load unpacked → select `dist-chrome/`

- __Firefox__ (MV3 or MV2):
  1) Open about:debugging#/runtime/this-firefox
  2) Load Temporary Add-on…
  3) Choose `manifest.json` inside `dist-firefox/` (MV3) or `dist-firefox-mv2/` (MV2)

Note: Some Firefox environments may still prefer MV2; use `dist-firefox-mv2/` when MV3 service workers are restricted.

## Tests and linting (optional but recommended)

- Run unit tests (Jest + jsdom):
  ```bash
  npm test
  ```
- Watch tests during development:
  ```bash
  npm run test:watch
  ```
- Lint and auto-fix:
  ```bash
  npm run lint
  npm run lint:fix
  ```

## Reproducibility notes

- Use `npm ci` on a clean checkout to ensure dependency versions match `package-lock.json`.
- Set `NODE_ENV=production` before `npm run build` for identical minified outputs.
- The build script performs deterministic copies and manifest transforms; no network calls during build (after `npm ci`).

## Toolchain details

- Bundler/minifier: `esbuild` (invoked programmatically from `scripts/build.js`)
- No webpack; no HTML/CSS templating engines. HTML/CSS are copied verbatim.
- Test runner: `jest`, environment: `jest-environment-jsdom`
- Linting/formatting: `eslint`, `prettier`

## Troubleshooting

- __Node or npm version errors__: Upgrade Node >= 16 and npm >= 8, then re-run `npm ci`.
- __Missing assets__: Ensure `assets/` and `src/` are intact; the build script copies HTML/CSS/icons/JSON.
- __Firefox MV3 review issues__: If MV3 service workers are not accepted in your environment, upload the MV2 build (`dist-firefox-mv2/`).
- __Clean and rebuild__:
  ```bash
  npm run clean && npm ci && npm run build
  ```

## Contact

For review questions, see repository metadata in `package.json` (`repository`, `bugs`, `homepage`) or open an issue on the project repo.
