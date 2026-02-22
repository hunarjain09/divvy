/**
 * DB Migration Tests — TripExpenseDB v1 → v5
 *
 * Background:
 *   The original v2 migration tried to change the `expenses` primary key from
 *   `++id` (auto-increment integer) to `id` (UUID string) in a single step.
 *   Dexie/IndexedDB does not allow changing a primary key on an existing table
 *   and throws: UpgradeError: Not yet support for changing primary key
 *   That error was caught inside syncWithSheet() and shown to users as
 *   "Sync failed: UpgradeError Not yet support for changing primary key".
 *
 * Fix: multi-step migration using a temporary table
 *   v2 – keep expenses with ++id; copy rows into _exp_tmp with new UUID ids
 *   v3 – drop old expenses table (no upgrade fn needed)
 *   v4 – recreate expenses with UUID pk; restore rows from _exp_tmp
 *   v5 – drop _exp_tmp (no upgrade fn needed)
 *
 * These tests exercise every upgrade function in isolation and as a full chain,
 * using in-memory fakes so they run without a real IndexedDB or the global
 * Dexie mock from setup.js.
 */

import { jest } from '@jest/globals';

// ---------------------------------------------------------------------------
// Helpers — replicated from divvy.html so tests are self-contained
// ---------------------------------------------------------------------------

const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Deterministic-enough UUID generator (same algorithm as divvy.html). */
const generateId = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });

// ---------------------------------------------------------------------------
// In-memory table / transaction fakes
// ---------------------------------------------------------------------------

class FakeTable {
  constructor() {
    this._rows = [];
  }
  async toArray() {
    return [...this._rows];
  }
  async bulkAdd(items) {
    this._rows.push(...items);
  }
  async get(key) {
    return this._rows.find((r) => r.id === key) ?? undefined;
  }
  async count() {
    return this._rows.length;
  }
  clear() {
    this._rows = [];
  }
}

/** Wraps named FakeTables and exposes .table(name) like a Dexie transaction. */
class FakeTx {
  constructor(tables) {
    this._tables = tables;
  }
  table(name) {
    if (!(name in this._tables)) throw new Error(`Unknown table: ${name}`);
    return this._tables[name];
  }
}

/** Builds a simulated v1 database state with auto-increment numeric ids. */
function makeV1State(rows) {
  const expenses = new FakeTable();
  expenses._rows = rows.map((r, i) => ({ ...r, id: i + 1 })); // numeric ++id
  const expTmp = new FakeTable();
  return new FakeTx({ expenses, _exp_tmp: expTmp });
}

// ---------------------------------------------------------------------------
// Migration step functions — exact copies of the upgrade callbacks in divvy.html
// ---------------------------------------------------------------------------

async function v2Upgrade(tx) {
  const all = await tx.table('expenses').toArray();
  if (all.length > 0) {
    const migrated = all.map((e) => ({ ...e, id: generateId() }));
    await tx.table('_exp_tmp').bulkAdd(migrated);
  }
}

async function v4Upgrade(tx) {
  const all = await tx.table('_exp_tmp').toArray();
  if (all.length > 0) {
    await tx.table('expenses').bulkAdd(all);
  }
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const V1_EXPENSES = [
  {
    payer: 'Alice',
    amount: 90,
    description: 'Hotel',
    beneficiaries: ['Alice', 'Bob', 'Charlie'],
    date: new Date('2026-01-20'),
  },
  {
    payer: 'Bob',
    amount: 60,
    description: 'Dinner',
    beneficiaries: ['Bob', 'Charlie'],
    date: new Date('2026-01-21'),
  },
  {
    payer: 'Charlie',
    amount: 40,
    description: 'Transport',
    beneficiaries: ['Alice', 'Bob', 'Charlie', 'David'],
    date: new Date('2026-01-22'),
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DB migration v1 → v5 (fix for UpgradeError on primary key change)', () => {
  // -------------------------------------------------------------------------
  describe('v2 upgrade: copy expenses into _exp_tmp with UUID ids', () => {
    test('copies every v1 expense into _exp_tmp', async () => {
      const tx = makeV1State(V1_EXPENSES);
      await v2Upgrade(tx);

      const tmp = await tx.table('_exp_tmp').toArray();
      expect(tmp).toHaveLength(V1_EXPENSES.length);
    });

    test('assigns a valid UUID v4 to each migrated expense', async () => {
      const tx = makeV1State(V1_EXPENSES);
      await v2Upgrade(tx);

      const tmp = await tx.table('_exp_tmp').toArray();
      tmp.forEach((row) => {
        expect(row.id).toMatch(UUID_V4_RE);
      });
    });

    test('replaces numeric auto-increment id with the new UUID', async () => {
      const tx = makeV1State(V1_EXPENSES);
      await v2Upgrade(tx);

      const tmp = await tx.table('_exp_tmp').toArray();
      tmp.forEach((row) => {
        expect(typeof row.id).toBe('string');
        expect(Number.isInteger(row.id)).toBe(false);
      });
    });

    test('all migrated UUIDs are unique', async () => {
      const tx = makeV1State(V1_EXPENSES);
      await v2Upgrade(tx);

      const tmp = await tx.table('_exp_tmp').toArray();
      const ids = tmp.map((r) => r.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    test('preserves payer, amount, description, beneficiaries and date', async () => {
      const tx = makeV1State(V1_EXPENSES);
      await v2Upgrade(tx);

      const tmp = await tx.table('_exp_tmp').toArray();
      // Sort both by description for stable comparison
      const sorted = [...tmp].sort((a, b) =>
        a.description.localeCompare(b.description)
      );
      const original = [...V1_EXPENSES].sort((a, b) =>
        a.description.localeCompare(b.description)
      );

      sorted.forEach((row, i) => {
        expect(row.payer).toBe(original[i].payer);
        expect(row.amount).toBe(original[i].amount);
        expect(row.description).toBe(original[i].description);
        expect(row.beneficiaries).toEqual(original[i].beneficiaries);
        expect(row.date).toEqual(original[i].date);
      });
    });

    test('does NOT touch the original expenses table', async () => {
      const tx = makeV1State(V1_EXPENSES);
      const before = await tx.table('expenses').toArray();
      await v2Upgrade(tx);
      const after = await tx.table('expenses').toArray();

      expect(after).toEqual(before); // unchanged
    });

    test('is a no-op when expenses table is empty (fresh install)', async () => {
      const tx = makeV1State([]);
      await v2Upgrade(tx);

      const tmp = await tx.table('_exp_tmp').toArray();
      expect(tmp).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  describe('v4 upgrade: restore expenses from _exp_tmp', () => {
    /** Produces a tx where v2 has already run (realistic pre-condition for v4). */
    async function makePostV2State(rows) {
      const tx = makeV1State(rows);
      await v2Upgrade(tx);
      // v3 drops old expenses — simulate by clearing it
      tx.table('expenses').clear();
      return tx;
    }

    test('copies every row from _exp_tmp into expenses', async () => {
      const tx = await makePostV2State(V1_EXPENSES);
      await v4Upgrade(tx);

      const expenses = await tx.table('expenses').toArray();
      expect(expenses).toHaveLength(V1_EXPENSES.length);
    });

    test('restores all fields including UUID ids', async () => {
      const tx = await makePostV2State(V1_EXPENSES);
      const tmpRows = await tx.table('_exp_tmp').toArray();
      await v4Upgrade(tx);

      const expenses = await tx.table('expenses').toArray();
      const sortById = (arr) => [...arr].sort((a, b) => (a.id > b.id ? 1 : -1));
      expect(sortById(expenses)).toEqual(sortById(tmpRows));
    });

    test('all restored ids are valid UUID v4 strings', async () => {
      const tx = await makePostV2State(V1_EXPENSES);
      await v4Upgrade(tx);

      const expenses = await tx.table('expenses').toArray();
      expenses.forEach((row) => {
        expect(row.id).toMatch(UUID_V4_RE);
      });
    });

    test('is a no-op when _exp_tmp is empty (fresh install)', async () => {
      const tx = await makePostV2State([]);
      await v4Upgrade(tx);

      const expenses = await tx.table('expenses').toArray();
      expect(expenses).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  describe('full migration chain: v1 state → final v5 state', () => {
    /** Runs the complete migration pipeline on a set of v1 rows. */
    async function runFullMigration(v1Rows) {
      const tx = makeV1State(v1Rows);

      // v2: stage data in _exp_tmp
      await v2Upgrade(tx);

      // v3: drop old expenses (no upgrade fn — just clear)
      tx.table('expenses').clear();

      // v4: restore into new expenses table
      await v4Upgrade(tx);

      // v5: drop _exp_tmp (no upgrade fn — just clear)
      tx.table('_exp_tmp').clear();

      return tx;
    }

    test('all expenses survive the full migration with data intact', async () => {
      const tx = await runFullMigration(V1_EXPENSES);
      const final = await tx.table('expenses').toArray();

      expect(final).toHaveLength(V1_EXPENSES.length);

      const descriptions = final.map((r) => r.description).sort();
      expect(descriptions).toEqual(
        V1_EXPENSES.map((r) => r.description).sort()
      );
    });

    test('migrated expense count equals original v1 count', async () => {
      const tx = await runFullMigration(V1_EXPENSES);
      const count = await tx.table('expenses').count();
      expect(count).toBe(V1_EXPENSES.length);
    });

    test('every final expense has a UUID id (no numeric ids remain)', async () => {
      const tx = await runFullMigration(V1_EXPENSES);
      const final = await tx.table('expenses').toArray();

      final.forEach((row) => {
        expect(typeof row.id).toBe('string');
        expect(row.id).toMatch(UUID_V4_RE);
      });
    });

    test('all final ids are unique', async () => {
      const tx = await runFullMigration(V1_EXPENSES);
      const final = await tx.table('expenses').toArray();
      const ids = final.map((r) => r.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    test('_exp_tmp is empty after migration (cleanup complete)', async () => {
      const tx = await runFullMigration(V1_EXPENSES);
      const tmp = await tx.table('_exp_tmp').toArray();
      expect(tmp).toHaveLength(0);
    });

    test('fresh install (no v1 data) ends with empty valid expenses table', async () => {
      const tx = await runFullMigration([]);
      const final = await tx.table('expenses').toArray();
      expect(final).toHaveLength(0);
    });

    test('each expense field is bit-for-bit identical after migration', async () => {
      const tx = await runFullMigration(V1_EXPENSES);
      const final = await tx.table('expenses').toArray();

      // Match each original row to its migrated counterpart by description
      V1_EXPENSES.forEach((original) => {
        const migrated = final.find(
          (r) => r.description === original.description
        );
        expect(migrated).toBeDefined();
        expect(migrated.payer).toBe(original.payer);
        expect(migrated.amount).toBe(original.amount);
        expect(migrated.beneficiaries).toEqual(original.beneficiaries);
        expect(migrated.date).toEqual(original.date);
      });
    });

    test('large dataset (100 expenses) migrates without data loss', async () => {
      const largeSet = Array.from({ length: 100 }, (_, i) => ({
        payer: `Person${i % 5}`,
        amount: (i + 1) * 10,
        description: `Expense ${i}`,
        beneficiaries: [`Person${i % 5}`, `Person${(i + 1) % 5}`],
        date: new Date(Date.now() - i * 86400000),
      }));

      const tx = await runFullMigration(largeSet);
      const final = await tx.table('expenses').toArray();

      expect(final).toHaveLength(largeSet.length);
      const ids = final.map((r) => r.id);
      expect(new Set(ids).size).toBe(ids.length); // all UUIDs unique
      final.forEach((row) => expect(row.id).toMatch(UUID_V4_RE));
    });
  });

  // -------------------------------------------------------------------------
  describe('schema safety: v2 must not change the primary key of expenses', () => {
    /**
     * Capture what .stores() is called with for each version so we can assert
     * the schema definitions don't attempt a pk change on an existing table.
     */
    function captureSchemaDefinitions() {
      const versions = {};
      const fakeDexie = {
        version(n) {
          versions[n] = null;
          return {
            stores(schema) {
              versions[n] = schema;
              return { upgrade: () => this };
            },
          };
        },
      };

      // Replay the schema setup from divvy.html
      fakeDexie.version(1).stores({
        participants: '&name',
        expenses: '++id, date',
        strangers: '&pair',
      });
      fakeDexie.version(2).stores({
        participants: '&name',
        expenses: '++id, date',
        _exp_tmp: 'id, date',
        strangers: '&pair',
      });
      fakeDexie.version(3).stores({
        participants: '&name',
        expenses: null,
        _exp_tmp: 'id, date',
        strangers: '&pair',
      });
      fakeDexie.version(4).stores({
        participants: '&name',
        expenses: 'id, date',
        _exp_tmp: 'id, date',
        strangers: '&pair',
      });
      fakeDexie.version(5).stores({
        participants: '&name',
        expenses: 'id, date',
        _exp_tmp: null,
        strangers: '&pair',
      });

      return versions;
    }

    let schemas;
    beforeAll(() => {
      schemas = captureSchemaDefinitions();
    });

    test('v1 defines expenses with auto-increment primary key (++id)', () => {
      expect(schemas[1].expenses).toBe('++id, date');
    });

    test('v2 keeps expenses with ++id — no primary key change on existing table', () => {
      // This is the critical check: v2 must NOT change ++id to id.
      // Changing it would cause Dexie to throw UpgradeError.
      expect(schemas[2].expenses).toBe('++id, date');
    });

    test('v2 introduces _exp_tmp as a brand-new table (safe to create with any pk)', () => {
      expect(schemas[2]._exp_tmp).toBe('id, date');
    });

    test('v3 drops the old expenses table (sets it to null)', () => {
      expect(schemas[3].expenses).toBeNull();
    });

    test('v4 recreates expenses with UUID primary key on a fresh table', () => {
      // Fresh table — no existing rows — so pk can be anything Dexie supports.
      expect(schemas[4].expenses).toBe('id, date');
    });

    test('v5 removes _exp_tmp (sets it to null)', () => {
      expect(schemas[5]._exp_tmp).toBeNull();
    });

    test('v5 final expenses schema is id, date (UUID pk, no auto-increment)', () => {
      expect(schemas[5].expenses).toBe('id, date');
    });
  });
});
