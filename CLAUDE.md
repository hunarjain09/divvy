# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Divvy** - a React-based expense tracking app that uses linear programming to optimize group trip expense settlements. Minimizes payment transactions while respecting relationship constraints ("strangers" who can't transact directly).

## Development

**No build step required for development** - Open `divvy.html` directly in a modern browser to run locally.

```bash
# Run local dev server
npm run dev  # Starts Python HTTP server on port 8000

# Run tests
npm test

# Run tests with coverage
npm test -- --coverage

# Build for production (compiles JSX, processes Tailwind CSS)
npm run build
```

All data is stored locally in IndexedDB (via Dexie.js). No backend server.

### Production Build

The production build process:
1. Extracts and compiles JSX with Babel (eliminates in-browser transpilation)
2. Processes Tailwind CSS properly (eliminates CDN usage)
3. Minifies HTML, CSS, and JavaScript
4. Outputs to `dist/` directory with all assets

## Tech Stack

- React 18.2 (loaded via ESM/import maps)
- Tailwind CSS (CDN)
- Dexie.js 3.2.4 (IndexedDB wrapper)
- javascript-lp-solver 0.4.24 (settlement optimization)
- Babel standalone (JSX transpilation in browser)

## Architecture

Single HTML file containing all code (`divvy.html`).

**3-column layout:**
1. Left: Participants management, relationship constraints
2. Center: Expense logging form, transaction history
3. Right: Real-time balances, optimized settlement plan

**State management:** React hooks only (useState, useMemo, useCallback). Heavy memoization for balance/settlement calculations.

**Database schema (Dexie/IndexedDB):**
- `participants`: `{ name (pk) }`
- `expenses`: `{ id (pk, auto), date (indexed), payer, amount, description, beneficiaries[] }`
- `strangers`: `{ pair (pk) }` - format: "NameA|NameB"

## Core Algorithms

1. **Balance calculation**: Payer gains amount, each beneficiary loses (amount / beneficiary count)
2. **Settlement optimization**: LP problem minimizing transaction count with balance constraints per person and optional stranger constraints

## PWA Support

Divvy is a Progressive Web App with offline capability:

- **Manifest**: `manifest.json` - Web app manifest for installability
- **Service Worker**: `sw.js` - Caches assets for offline use (network-first strategy)
- **Icons**: `icons/` directory with all required sizes (16x16 to 1024x1024)
- **iOS Support**: Apple touch icon (180x180) and iOS meta tags for "Add to Home Screen"

To install on iOS: Open in Safari > Share > Add to Home Screen

## Testing

Jest test suite with ~90% coverage:

```
tests/
  logic/           # Unit tests for core algorithms
    balance.test.js
    solver.test.js
    relationships.test.js
    importExport.test.js
  db/              # Database operation tests
    expenses.test.js
    participants.test.js
  e2e/             # Integration tests
    app.integration.test.js
  pwa.test.js      # PWA configuration verification
  setup.js         # Test setup and mocks
```

## CI/CD

GitHub Actions workflow (`.github/workflows/deploy.yml`):
1. Runs Jest tests with coverage
2. Builds production bundle (compiles JSX, processes Tailwind CSS, minifies HTML/CSS/JS)
3. Copies all assets (icons, images, manifest, service worker)
4. Deploys to GitHub Pages

The production build eliminates:
- Tailwind CSS CDN warning
- Babel in-browser transpilation warning

## Debugging

- Use browser DevTools console
- Inspect IndexedDB in DevTools > Application > IndexedDB
- Run `npm test` for automated tests
