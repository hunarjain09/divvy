# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Trip Expense Settler - a React-based expense tracking app that uses linear programming to optimize group trip expense settlements. Minimizes payment transactions while respecting relationship constraints ("strangers" who can't transact directly).

## Development

**No build step required** - This is a zero-build project. Open `artifact.html` directly in a modern browser to run.

All data is stored locally in IndexedDB (via Dexie.js). No backend server.

## Tech Stack

- React 18.2 (loaded via ESM/import maps)
- Tailwind CSS (CDN)
- Dexie.js 3.2.4 (IndexedDB wrapper)
- javascript-lp-solver 0.4.24 (settlement optimization)
- Babel standalone (JSX transpilation in browser)

## Architecture

Single HTML file containing all code (`artifact.html` is primary, `blah.html` is a variant copy).

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

## Debugging

- Use browser DevTools console
- Inspect IndexedDB in DevTools > Application > IndexedDB
- No automated tests present
