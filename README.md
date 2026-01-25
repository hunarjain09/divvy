# Divvy

**Smart group expense splitting with optimized settlements**

Settle up in fewer payments, not more drama.

**[Live Demo](https://hunarjain09.github.io/divvy/)**

> Optimized for Safari on iPhone - add to your home screen for the best experience.

## Screenshots

<!-- Add your iPhone screenshots here -->
<!-- ![Screenshot 1](screenshots/screenshot1.png) -->

## Features

- **Smart expense splitting** - Split costs among any subset of participants
- **LP-optimized settlements** - Minimizes the number of payment transactions using linear programming
- **Relationship constraints** - Mark "strangers" who can't transact directly; payments route through mutual friends
- **100% local data** - All data stored in IndexedDB; no server, no account required
- **Works offline** - After first load, works without internet
- **Import/Export backup** - Download TSV backups and restore anytime

## Tech Stack

- React 18.2 (ESM via import maps)
- Tailwind CSS (CDN)
- Dexie.js 3.2.4 (IndexedDB wrapper)
- javascript-lp-solver 0.4.24 (settlement optimization)
- Babel standalone (in-browser JSX transpilation)

## Add to Home Screen (iOS)

For the best experience on iPhone:

1. Open [Divvy](https://hunarjain09.github.io/divvy/) in Safari
2. Tap the Share button (square with arrow)
3. Scroll down and tap "Add to Home Screen"
4. Tap "Add"

The app will launch in full-screen mode without Safari's UI.

## Development

No build step required. Open `divvy.html` directly in a modern browser.

```bash
# Clone the repo
git clone git@github.com:hunarjain09/divvy.git
cd divvy

# Open in browser
open divvy.html
```

## License

MIT
