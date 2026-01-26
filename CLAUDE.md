# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Divvy** - A React-based PWA for smart group expense splitting that uses linear programming to optimize settlements. Minimizes payment transactions while respecting relationship constraints ("strangers" who can't transact directly).

**Key Features:**
- 🔄 Optimized settlement plans using LP solver (minimizes number of transactions)
- 🚫 Payment restrictions (prevent direct payments between specified people)
- 💾 Data export/import (JSON format)
- 🌓 Light/dark mode with system preference detection
- 📱 Progressive Web App (installable, works offline)
- 🎨 Customizable layout (drag-and-drop sections)
- 📊 Real-time balance calculations with visual indicators
- 🔍 Smart expense filtering and search

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

**Development (divvy.html):**
- React 18.2 (loaded via ESM/import maps)
- Tailwind CSS (CDN for development)
- Dexie.js 3.2.4 (IndexedDB wrapper)
- javascript-lp-solver 0.4.24 (settlement optimization)
- Babel standalone (JSX transpilation in browser)
- Sortable.js 1.15.0 (drag & drop for layout customization)
- Loglevel 1.9.1 (logging)

**Production (dist/):**
- Pre-compiled JavaScript (Babel with @babel/preset-react)
- Processed Tailwind CSS (via Tailwind CLI with custom config)
- Minified HTML/CSS/JS
- All external libraries (React, Dexie, LP solver, etc.) still loaded via CDN

## Architecture

**Development:** Single HTML file containing all code (`divvy.html`).

**Production:** Build system (`build.js`) extracts and compiles code into:
- `dist/index.html` - Minified HTML shell
- `dist/app.js` - Pre-compiled React application (~100KB)
- `dist/styles.css` - Processed Tailwind CSS (~34KB)
- `dist/icons/`, `dist/images/` - All assets
- `dist/manifest.json`, `dist/sw.js` - PWA files

**Layout:**
- Responsive 3-column layout (left/center/right) with drag-and-drop customization
- Layout preferences saved to localStorage
- Sections: Participants, Payment Restrictions, Add Expense, Recent Expenses, Balances, Settlement Plan
- Collapsible sections for better mobile experience

**State management:** React hooks only (useState, useMemo, useCallback, useEffect, useRef). Heavy memoization for balance/settlement calculations.

**Database schema (Dexie/IndexedDB):**
- `participants`: `{ name (pk) }`
- `expenses`: `{ id (pk, auto), date (indexed), payer, amount, description, beneficiaries[] }`
- `strangers`: `{ pair (pk) }` - format: "NameA|NameB"

**Theme:** Light/dark mode support with system preference detection and manual toggle.

## Design System

**Colors:**
- Primary: `#30e87a` (green)
- Primary Dark: `#25b860`
- Background Light: `#f6f8f7`
- Background Dark: `#112117`
- Text Main: `#111814`
- Slate colors for borders and secondary elements

**Typography:**
- Font: Inter (loaded from Google Fonts)
- Material Symbols Outlined for icons

**UI Patterns:**
- Rounded corners (1rem default, up to 2-3rem for cards)
- Elevated cards with subtle shadows
- Smooth transitions (150ms-300ms)
- Glass-morphism effects in dark mode
- Green accents for positive actions, red for destructive
- Visual balance indicators (green/red with amounts)

**Components:**
- Custom scrollbars (styled for light/dark modes)
- Drag-and-drop handles (6-dot pattern)
- Collapsible sections with smooth animations
- Material Design icons throughout

## Core Algorithms

1. **Balance calculation**: Payer gains amount, each beneficiary loses (amount / beneficiary count)
2. **Settlement optimization**: LP problem minimizing transaction count with balance constraints per person and optional stranger constraints

## PWA Support

Divvy is a Progressive Web App with offline capability:

- **Manifest**: `manifest.json` - Web app manifest with app name, theme colors, icons, and display mode
- **Service Worker**: `sw.js` - Caches assets for offline use with cache versioning
- **Icons**: `icons/` directory with all required sizes (16x16 to 1024x1024) including SVG
- **iOS Support**: Apple touch icon (180x180) and iOS meta tags for "Add to Home Screen"
  - Uses `mobile-web-app-capable` (modern standard, replaces deprecated `apple-mobile-web-app-capable`)
  - Status bar styling and app title configured

**Installation:**
- iOS: Open in Safari > Share > Add to Home Screen
- Android/Desktop: Browser will show "Install" prompt automatically

**Offline:** All core functionality works offline after first visit (IndexedDB persists data locally)

## Testing

Jest test suite with 130 tests and ~90% coverage:

```
tests/
  logic/           # Unit tests for core algorithms (70 tests)
    balance.test.js          # Balance calculation logic
    solver.test.js           # LP optimization with constraints
    relationships.test.js    # Stranger relationship handling
    importExport.test.js     # Data export/import functionality
  db/              # Database operation tests (28 tests)
    expenses.test.js         # Expense CRUD operations
    participants.test.js     # Participant management
  e2e/             # Integration tests (22 tests)
    app.integration.test.js  # Full user workflows
  pwa.test.js      # PWA configuration verification (10 tests)
  setup.js         # Test setup and mocks
```

**Run tests:**
```bash
npm test              # Run all tests
npm run test:watch   # Watch mode for development
npm test -- --coverage  # With coverage report
```

## CI/CD

GitHub Actions workflow (`.github/workflows/deploy.yml`):
1. **Test**: Runs Jest tests with coverage (must pass)
2. **Build**: Builds production bundle
   - Extracts React code from divvy.html
   - Compiles JSX with Babel (@babel/preset-react)
   - Processes Tailwind CSS with CLI (eliminates CDN)
   - Minifies HTML/CSS/JS
   - Copies all assets (icons, images, manifest, service worker)
3. **Deploy**: Publishes to GitHub Pages

**Build Improvements:**
- ✅ Eliminates Tailwind CSS CDN warning
- ✅ Eliminates Babel in-browser transpilation warning
- ✅ Smaller bundle size with minification
- ✅ Better performance with pre-compiled code

**Deployment:**
- Automatic deployment on push to `main` branch
- Live at: GitHub Pages URL (check repository settings)
- Build artifacts stored in `dist/` (git-ignored locally)

## File Structure

```
divvy/
├── divvy.html              # Main application (development version)
├── build.js                # Production build script
├── tailwind.config.js      # Tailwind CSS configuration
├── manifest.json           # PWA manifest
├── sw.js                   # Service worker
├── package.json            # Dependencies and scripts
├── babel.config.js         # Babel configuration for tests
├── jest.config.js          # Jest test configuration
├── icons/                  # App icons (all sizes)
├── images/                 # UI images (logos, etc.)
├── tests/                  # Test suite
├── dist/                   # Production build output (git-ignored)
└── .github/workflows/      # CI/CD configuration
```

## Debugging

**Development:**
- Use browser DevTools console
- Inspect IndexedDB in DevTools > Application > IndexedDB > divvy-db
- Check localStorage in DevTools > Application > Local Storage (for layout preferences, theme)
- Run `npm test` for automated tests
- Use `npm run dev` and visit http://localhost:8000

**Production Build:**
- Run `npm run build` to generate dist/
- Check dist/index.html for compiled output
- Verify no CDN warnings in browser console

**Common Issues:**
- Layout not saving? Check localStorage permissions
- Data not persisting? Check IndexedDB in DevTools
- Tests failing? Run `npm install` to ensure dependencies are current
