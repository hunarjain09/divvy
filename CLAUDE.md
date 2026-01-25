# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Divvy** - a React-based expense tracking app that uses linear programming to optimize group trip expense settlements. Minimizes payment transactions while respecting relationship constraints ("strangers" who can't transact directly).

## Development

**No build step required** - This is a zero-build project. Open `divvy.html` directly in a modern browser to run.

```bash
# Run local dev server
npm run dev  # Starts Python HTTP server on port 8000

# Run tests
npm test

# Run tests with coverage
npm test -- --coverage
```

All data is stored locally in IndexedDB (via Dexie.js). No backend server.

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
2. Minifies HTML
3. Copies PWA assets (icons, manifest, service worker)
4. Deploys to GitHub Pages

## Debugging

- Use browser DevTools console
- Inspect IndexedDB in DevTools > Application > IndexedDB
- Run `npm test` for automated tests
