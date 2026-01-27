import Dexie from 'dexie';
import { jest } from '@jest/globals';

/**
 * Playground Mode Tests
 * Verifies that playground uses a sandboxed database,
 * demo data loads correctly, and the main database is never affected.
 */

const DEMO_PARTICIPANTS = ['Alex', 'Jordan', 'Sam', 'Riley', 'Morgan'];
const DEMO_STRANGER_PAIR = 'Jordan|Morgan';

function makeDemoExpenses() {
  const now = new Date().toISOString();
  return [
    { id: 'e1', payer: 'Alex', amount: 180, description: 'Airbnb (2 nights)', beneficiaries: ['Alex', 'Jordan', 'Sam', 'Riley', 'Morgan'], date: new Date(Date.now() - 3 * 86400000), lastModified: now, deleted: false },
    { id: 'e2', payer: 'Jordan', amount: 65, description: 'Grocery run', beneficiaries: ['Alex', 'Jordan', 'Sam', 'Riley', 'Morgan'], date: new Date(Date.now() - 2.5 * 86400000), lastModified: now, deleted: false },
    { id: 'e3', payer: 'Sam', amount: 120, description: 'Surf board rentals', beneficiaries: ['Sam', 'Riley', 'Morgan'], date: new Date(Date.now() - 2 * 86400000), lastModified: now, deleted: false },
    { id: 'e4', payer: 'Riley', amount: 85, description: 'Seafood dinner', beneficiaries: ['Alex', 'Jordan', 'Sam', 'Riley', 'Morgan'], date: new Date(Date.now() - 1.5 * 86400000), lastModified: now, deleted: false },
    { id: 'e5', payer: 'Alex', amount: 40, description: 'Beach bonfire supplies', beneficiaries: ['Alex', 'Jordan', 'Sam', 'Riley', 'Morgan'], date: new Date(Date.now() - 86400000), lastModified: now, deleted: false },
    { id: 'e6', payer: 'Morgan', amount: 55, description: 'Breakfast & coffee', beneficiaries: ['Alex', 'Jordan', 'Sam', 'Riley', 'Morgan'], date: new Date(Date.now() - 0.5 * 86400000), lastModified: now, deleted: false },
    { id: 'e7', payer: 'Jordan', amount: 30, description: 'Gas money', beneficiaries: ['Alex', 'Jordan', 'Riley'], date: new Date(), lastModified: now, deleted: false },
  ];
}

/**
 * Simulates the playground mode logic from divvy.html.
 * Uses two separate Dexie instances to mirror the real architecture.
 */
class PlaygroundController {
  constructor() {
    this.mainDb = new Dexie('TripExpenseDB');
    this.mainDb.version(1).stores({
      participants: '&name',
      expenses: 'id, date',
      strangers: '&pair',
    });

    this.playgroundDb = new Dexie('TripExpenseDB_Playground');
    this.playgroundDb.version(1).stores({
      participants: '&name',
      expenses: 'id, date',
      strangers: '&pair',
    });

    this.activeDb = this.mainDb;
    this.isPlayground = false;
  }

  async enterPlayground() {
    this.activeDb = this.playgroundDb;
    this.isPlayground = true;

    // Clear any previous playground data
    await this.activeDb.participants.clear();
    await this.activeDb.expenses.clear();
    await this.activeDb.strangers.clear();

    // Load demo data
    await this.activeDb.participants.bulkAdd(
      DEMO_PARTICIPANTS.map(name => ({ name }))
    );
    await this.activeDb.expenses.bulkAdd(makeDemoExpenses());
    await this.activeDb.strangers.add({ pair: DEMO_STRANGER_PAIR });
  }

  async exitPlayground() {
    // Clean up playground
    await this.playgroundDb.participants.clear();
    await this.playgroundDb.expenses.clear();
    await this.playgroundDb.strangers.clear();

    // Switch back
    this.activeDb = this.mainDb;
    this.isPlayground = false;
  }

  async getParticipants() {
    return await this.activeDb.participants.toArray();
  }

  async getExpenses() {
    return await this.activeDb.expenses.toArray();
  }

  async getStrangers() {
    return await this.activeDb.strangers.toArray();
  }

  async addParticipant(name) {
    return await this.activeDb.participants.add({ name });
  }

  async addExpense(expense) {
    return await this.activeDb.expenses.add(expense);
  }

  async addStranger(pair) {
    return await this.activeDb.strangers.add({ pair });
  }
}


describe('Playground Mode', () => {
  let ctrl;

  beforeEach(() => {
    ctrl = new PlaygroundController();
  });

  describe('Database isolation', () => {
    test('Playground uses a different database instance than main', () => {
      expect(ctrl.mainDb).not.toBe(ctrl.playgroundDb);
      expect(ctrl.mainDb.name).toBe('TripExpenseDB');
      expect(ctrl.playgroundDb.name).toBe('TripExpenseDB_Playground');
    });

    test('activeDb starts pointing to main database', () => {
      expect(ctrl.activeDb).toBe(ctrl.mainDb);
      expect(ctrl.isPlayground).toBe(false);
    });

    test('Entering playground switches activeDb to playground database', async () => {
      await ctrl.enterPlayground();
      expect(ctrl.activeDb).toBe(ctrl.playgroundDb);
      expect(ctrl.isPlayground).toBe(true);
    });

    test('Exiting playground switches activeDb back to main database', async () => {
      await ctrl.enterPlayground();
      await ctrl.exitPlayground();
      expect(ctrl.activeDb).toBe(ctrl.mainDb);
      expect(ctrl.isPlayground).toBe(false);
    });
  });

  describe('Demo data loading', () => {
    test('Loads all 5 demo participants', async () => {
      await ctrl.enterPlayground();
      const participants = await ctrl.getParticipants();
      expect(participants.length).toBe(5);
      const names = participants.map(p => p.name).sort();
      expect(names).toEqual(['Alex', 'Jordan', 'Morgan', 'Riley', 'Sam']);
    });

    test('Loads all 7 demo expenses', async () => {
      await ctrl.enterPlayground();
      const expenses = await ctrl.getExpenses();
      expect(expenses.length).toBe(7);
    });

    test('Demo expenses have correct total ($575)', async () => {
      await ctrl.enterPlayground();
      const expenses = await ctrl.getExpenses();
      const total = expenses.reduce((sum, e) => sum + e.amount, 0);
      expect(total).toBe(575);
    });

    test('Demo expenses have valid structure', async () => {
      await ctrl.enterPlayground();
      const expenses = await ctrl.getExpenses();
      expenses.forEach(exp => {
        expect(exp).toHaveProperty('id');
        expect(exp).toHaveProperty('payer');
        expect(exp).toHaveProperty('amount');
        expect(exp).toHaveProperty('description');
        expect(exp).toHaveProperty('beneficiaries');
        expect(exp).toHaveProperty('date');
        expect(exp).toHaveProperty('lastModified');
        expect(exp).toHaveProperty('deleted', false);
        expect(typeof exp.amount).toBe('number');
        expect(exp.amount).toBeGreaterThan(0);
        expect(Array.isArray(exp.beneficiaries)).toBe(true);
        expect(exp.beneficiaries.length).toBeGreaterThan(0);
        expect(DEMO_PARTICIPANTS).toContain(exp.payer);
      });
    });

    test('Loads stranger relationship (Jordan|Morgan)', async () => {
      await ctrl.enterPlayground();
      const strangers = await ctrl.getStrangers();
      expect(strangers.length).toBe(1);
      expect(strangers[0].pair).toBe('Jordan|Morgan');
    });
  });

  describe('Sandboxing — main data is never affected', () => {
    test('Main database stays empty when playground has demo data', async () => {
      await ctrl.enterPlayground();

      // Playground should have data
      const pgParticipants = await ctrl.playgroundDb.participants.toArray();
      expect(pgParticipants.length).toBe(5);

      // Main should be untouched
      const mainParticipants = await ctrl.mainDb.participants.toArray();
      expect(mainParticipants.length).toBe(0);
    });

    test('Main database with existing data is not modified by playground', async () => {
      // Add real data to main
      await ctrl.mainDb.participants.add({ name: 'RealUser' });
      await ctrl.mainDb.expenses.add({
        id: 'real-1', payer: 'RealUser', amount: 100,
        description: 'Real expense', beneficiaries: ['RealUser'],
        date: new Date(), lastModified: new Date().toISOString(), deleted: false,
      });

      // Enter playground
      await ctrl.enterPlayground();

      // Playground has demo data
      const pgParticipants = await ctrl.playgroundDb.participants.toArray();
      expect(pgParticipants.length).toBe(5);
      expect(pgParticipants.map(p => p.name)).not.toContain('RealUser');

      // Main still has original data
      const mainParticipants = await ctrl.mainDb.participants.toArray();
      expect(mainParticipants.length).toBe(1);
      expect(mainParticipants[0].name).toBe('RealUser');

      const mainExpenses = await ctrl.mainDb.expenses.toArray();
      expect(mainExpenses.length).toBe(1);
      expect(mainExpenses[0].description).toBe('Real expense');
    });

    test('Adding data in playground does not leak to main', async () => {
      await ctrl.enterPlayground();

      // Add extra data in playground
      await ctrl.addParticipant('PlaygroundOnly');
      await ctrl.addExpense({
        id: 'pg-extra', payer: 'PlaygroundOnly', amount: 999,
        description: 'Sandbox expense', beneficiaries: ['PlaygroundOnly'],
        date: new Date(), lastModified: new Date().toISOString(), deleted: false,
      });
      await ctrl.addStranger('Alex|PlaygroundOnly');

      // Verify playground has extra data
      const pgParticipants = await ctrl.playgroundDb.participants.toArray();
      expect(pgParticipants.map(p => p.name)).toContain('PlaygroundOnly');

      // Main should have nothing
      const mainParticipants = await ctrl.mainDb.participants.toArray();
      expect(mainParticipants.length).toBe(0);

      const mainExpenses = await ctrl.mainDb.expenses.toArray();
      expect(mainExpenses.length).toBe(0);

      const mainStrangers = await ctrl.mainDb.strangers.toArray();
      expect(mainStrangers.length).toBe(0);
    });

    test('Exiting playground preserves main data', async () => {
      // Set up real data
      await ctrl.mainDb.participants.add({ name: 'Alice' });
      await ctrl.mainDb.participants.add({ name: 'Bob' });
      await ctrl.mainDb.expenses.add({
        id: 'real-1', payer: 'Alice', amount: 50,
        description: 'Coffee', beneficiaries: ['Alice', 'Bob'],
        date: new Date(), lastModified: new Date().toISOString(), deleted: false,
      });

      // Enter and exit playground
      await ctrl.enterPlayground();
      await ctrl.exitPlayground();

      // Main data should be intact
      const participants = await ctrl.getParticipants();
      expect(participants.length).toBe(2);
      expect(participants.map(p => p.name).sort()).toEqual(['Alice', 'Bob']);

      const expenses = await ctrl.getExpenses();
      expect(expenses.length).toBe(1);
      expect(expenses[0].description).toBe('Coffee');
    });
  });

  describe('Playground cleanup on exit', () => {
    test('Playground database is cleared after exit', async () => {
      await ctrl.enterPlayground();

      // Verify playground has data
      let pgExpenses = await ctrl.playgroundDb.expenses.toArray();
      expect(pgExpenses.length).toBe(7);

      await ctrl.exitPlayground();

      // Playground should be empty
      pgExpenses = await ctrl.playgroundDb.expenses.toArray();
      expect(pgExpenses.length).toBe(0);

      const pgParticipants = await ctrl.playgroundDb.participants.toArray();
      expect(pgParticipants.length).toBe(0);

      const pgStrangers = await ctrl.playgroundDb.strangers.toArray();
      expect(pgStrangers.length).toBe(0);
    });

    test('Re-entering playground starts with fresh demo data', async () => {
      await ctrl.enterPlayground();

      // Modify playground data
      await ctrl.addParticipant('ExtraUser');
      let participants = await ctrl.getParticipants();
      expect(participants.length).toBe(6);

      // Exit and re-enter
      await ctrl.exitPlayground();
      await ctrl.enterPlayground();

      // Should have exactly the original demo data, no ExtraUser
      participants = await ctrl.getParticipants();
      expect(participants.length).toBe(5);
      expect(participants.map(p => p.name)).not.toContain('ExtraUser');
    });
  });

  describe('Operations route through activeDb', () => {
    test('getParticipants returns demo data in playground, main data outside', async () => {
      await ctrl.mainDb.participants.add({ name: 'RealUser' });

      // Before playground — reads main
      let participants = await ctrl.getParticipants();
      expect(participants.length).toBe(1);
      expect(participants[0].name).toBe('RealUser');

      // In playground — reads playground
      await ctrl.enterPlayground();
      participants = await ctrl.getParticipants();
      expect(participants.length).toBe(5);
      expect(participants.map(p => p.name)).not.toContain('RealUser');

      // After exit — reads main again
      await ctrl.exitPlayground();
      participants = await ctrl.getParticipants();
      expect(participants.length).toBe(1);
      expect(participants[0].name).toBe('RealUser');
    });

    test('addExpense in playground does not affect main', async () => {
      await ctrl.enterPlayground();
      await ctrl.addExpense({
        id: 'pg-new', payer: 'Alex', amount: 42,
        description: 'Playground only', beneficiaries: ['Alex'],
        date: new Date(), lastModified: new Date().toISOString(), deleted: false,
      });

      const pgExpenses = await ctrl.playgroundDb.expenses.toArray();
      expect(pgExpenses.length).toBe(8); // 7 demo + 1 new

      const mainExpenses = await ctrl.mainDb.expenses.toArray();
      expect(mainExpenses.length).toBe(0);
    });

    test('addStranger in playground does not affect main', async () => {
      await ctrl.enterPlayground();
      await ctrl.addStranger('Alex|Sam');

      const pgStrangers = await ctrl.playgroundDb.strangers.toArray();
      expect(pgStrangers.length).toBe(2); // Jordan|Morgan + Alex|Sam

      const mainStrangers = await ctrl.mainDb.strangers.toArray();
      expect(mainStrangers.length).toBe(0);
    });
  });
});
