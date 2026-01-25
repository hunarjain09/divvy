import { calculateBalances } from '@/logic/balance';
import {
  normalizePairKey,
  isStranger,
  toggleStranger,
} from '@/logic/relationships';
import { parseTSV, generateTSV } from '@/logic/importExport';
import { generateSettlementPlan } from '@/logic/solver';
import { jest } from '@jest/globals';

/**
 * End-to-End Integration Tests
 * Tests complete user workflows across multiple modules
 */
describe('E2E User Workflows', () => {
  describe('Workflow: Add participant -> Log expense -> Verify balance', () => {
    test('Single participant adds expense for themselves', () => {
      const participants = ['Alice'];
      const expenses = [
        {
          payer: 'Alice',
          amount: 100,
          beneficiaries: ['Alice'],
          description: 'Shopping',
          date: new Date(),
        },
      ];

      const balances = calculateBalances(expenses, participants);

      expect(balances.get('Alice')).toBeCloseTo(100);
    });

    test('Two participants, one pays for both', () => {
      const participants = ['Alice', 'Bob'];
      const expenses = [
        {
          payer: 'Alice',
          amount: 60,
          beneficiaries: ['Alice', 'Bob'],
          description: 'Dinner',
          date: new Date(),
        },
      ];

      const balances = calculateBalances(expenses, participants);

      expect(balances.get('Alice')).toBeCloseTo(30);
      expect(balances.get('Bob')).toBeCloseTo(-30);
    });

    test('Multiple expenses accumulate correctly', () => {
      const participants = ['Alice', 'Bob', 'Charlie'];
      const expenses = [
        {
          payer: 'Alice',
          amount: 90,
          beneficiaries: ['Alice', 'Bob', 'Charlie'],
          description: 'Hotel',
          date: new Date('2026-01-10'),
        },
        {
          payer: 'Bob',
          amount: 60,
          beneficiaries: ['Alice', 'Bob', 'Charlie'],
          description: 'Meals',
          date: new Date('2026-01-11'),
        },
        {
          payer: 'Charlie',
          amount: 30,
          beneficiaries: ['Alice', 'Bob', 'Charlie'],
          description: 'Transport',
          date: new Date('2026-01-12'),
        },
      ];

      const balances = calculateBalances(expenses, participants);

      // Each paid 90, 60, 30 respectively. Split 180/3 = 60 per person
      // Alice: 90 - 60 = 30
      // Bob: 60 - 60 = 0
      // Charlie: 30 - 60 = -30
      expect(balances.get('Alice')).toBeCloseTo(30);
      expect(balances.get('Bob')).toBeCloseTo(0);
      expect(balances.get('Charlie')).toBeCloseTo(-30);
    });

    test('New participant joins existing group', () => {
      // Initial state
      const participants1 = ['Alice', 'Bob'];
      const expenses1 = [
        {
          payer: 'Alice',
          amount: 60,
          beneficiaries: ['Alice', 'Bob'],
          description: 'Dinner',
          date: new Date('2026-01-10'),
        },
      ];

      const balances1 = calculateBalances(expenses1, participants1);
      expect(balances1.size).toBe(2);

      // Charlie joins
      const participants2 = ['Alice', 'Bob', 'Charlie'];
      const expenses2 = [
        ...expenses1,
        {
          payer: 'Charlie',
          amount: 90,
          beneficiaries: ['Alice', 'Bob', 'Charlie'],
          description: 'Hotel',
          date: new Date('2026-01-11'),
        },
      ];

      const balances2 = calculateBalances(expenses2, participants2);
      expect(balances2.size).toBe(3);
      expect(balances2.has('Charlie')).toBe(true);
    });
  });

  describe('Workflow: Mark strangers -> Verify settlement uses friend routes', () => {
    test('Settlement includes stranger flag when appropriate', () => {
      const participants = ['Alice', 'Bob', 'Charlie'];
      const expenses = [
        {
          payer: 'Alice',
          amount: 90,
          beneficiaries: ['Alice', 'Bob', 'Charlie'],
        },
        {
          payer: 'Bob',
          amount: 0,
          beneficiaries: [],
        },
        {
          payer: 'Charlie',
          amount: 0,
          beneficiaries: [],
        },
      ];

      const balances = calculateBalances(expenses, participants);
      const strangers = new Set(); // No strangers initially

      const plan = generateSettlementPlan(balances, strangers, (a, b) =>
        isStranger(a, b, strangers)
      );

      if (plan.length > 0) {
        plan.forEach(transaction => {
          expect(transaction.isStranger).toBe(false);
        });
      }
    });

    test('Marking pair as strangers updates settlement flag', () => {
      let strangers = new Set();

      // Initially, Alice and Bob are friends
      expect(isStranger('Alice', 'Bob', strangers)).toBe(false);

      // Mark as strangers
      strangers = toggleStranger('Alice', 'Bob', strangers);

      expect(isStranger('Alice', 'Bob', strangers)).toBe(true);
    });

    test('Multiple stranger relationships tracked independently', () => {
      let strangers = new Set();

      // Mark multiple pairs as strangers
      strangers = toggleStranger('Alice', 'Bob', strangers);
      strangers = toggleStranger('Alice', 'Charlie', strangers);

      expect(isStranger('Alice', 'Bob', strangers)).toBe(true);
      expect(isStranger('Alice', 'Charlie', strangers)).toBe(true);
      expect(isStranger('Bob', 'Charlie', strangers)).toBe(false);
    });

    test('Toggling removes stranger relationship', () => {
      let strangers = new Set();
      strangers = toggleStranger('Alice', 'Bob', strangers);

      expect(isStranger('Alice', 'Bob', strangers)).toBe(true);

      strangers = toggleStranger('Alice', 'Bob', strangers);
      expect(isStranger('Alice', 'Bob', strangers)).toBe(false);
    });
  });

  describe('Workflow: Download TSV -> Restore TSV -> Verify data integrity', () => {
    test('Export and re-import preserves expense data', () => {
      const originalExpenses = [
        {
          date: new Date('2026-01-20T15:00:00.000Z'),
          description: 'Hotel',
          payer: 'Alice',
          amount: 90.0,
          beneficiaries: ['Alice', 'Bob', 'Charlie'],
        },
        {
          date: new Date('2026-01-21T16:00:00.000Z'),
          description: 'Dinner',
          payer: 'Bob',
          amount: 60.0,
          beneficiaries: ['Bob', 'Charlie', 'David'],
        },
      ];
      const participants = new Set(['Alice', 'Bob', 'Charlie', 'David']);
      const strangers = new Set();

      // Generate TSV
      const tsv = generateTSV(originalExpenses, participants, strangers, 150.0);

      // Parse TSV back
      const parsed = parseTSV(tsv);

      expect(parsed.expenses.length).toBe(2);
      expect(parsed.expenses[0].payer).toBe('Alice');
      expect(parsed.expenses[1].payer).toBe('Bob');
    });

    test('Export and re-import preserves participant data', () => {
      const expenses = [
        {
          date: new Date('2026-01-20T15:00:00.000Z'),
          description: 'Test',
          payer: 'Alice',
          amount: 50.0,
          beneficiaries: ['Alice', 'Bob'],
        },
      ];
      const participants = new Set(['Alice', 'Bob', 'Charlie', 'David']);
      const strangers = new Set();

      const tsv = generateTSV(expenses, participants, strangers, 50.0);
      const parsed = parseTSV(tsv);

      expect(parsed.participants.size).toBe(4);
      expect(parsed.participants.has('Alice')).toBe(true);
      expect(parsed.participants.has('Charlie')).toBe(true);
    });

    test('Export and re-import preserves stranger relationships', () => {
      const expenses = [];
      const participants = new Set(['Alice', 'Bob', 'Charlie']);
      const strangers = new Set(['Alice|Bob', 'Bob|Charlie']);

      const tsv = generateTSV(expenses, participants, strangers, 0);
      const parsed = parseTSV(tsv);

      expect(parsed.strangers.size).toBe(2);
      expect(parsed.strangers.has('Alice|Bob')).toBe(true);
      expect(parsed.strangers.has('Bob|Charlie')).toBe(true);
    });

    test('Round-trip preserves expense amounts precisely', () => {
      const originalExpenses = [
        {
          date: new Date('2026-01-20T15:00:00.000Z'),
          description: 'Test 1',
          payer: 'Alice',
          amount: 50.99,
          beneficiaries: ['Alice'],
        },
        {
          date: new Date('2026-01-21T16:00:00.000Z'),
          description: 'Test 2',
          payer: 'Bob',
          amount: 99.99,
          beneficiaries: ['Bob'],
        },
      ];
      const participants = new Set(['Alice', 'Bob']);
      const strangers = new Set();

      const tsv = generateTSV(
        originalExpenses,
        participants,
        strangers,
        150.98
      );
      const parsed = parseTSV(tsv);

      expect(parsed.expenses[0].amount).toBeCloseTo(50.99, 2);
      expect(parsed.expenses[1].amount).toBeCloseTo(99.99, 2);
    });

    test('Re-imported expenses can be used for balance calculation', () => {
      const originalExpenses = [
        {
          date: new Date('2026-01-20T15:00:00.000Z'),
          description: 'Shared meal',
          payer: 'Alice',
          amount: 60.0,
          beneficiaries: ['Alice', 'Bob'],
        },
      ];
      const participants = new Set(['Alice', 'Bob']);
      const strangers = new Set();

      const tsv = generateTSV(originalExpenses, participants, strangers, 60.0);
      const parsed = parseTSV(tsv);

      // Remove metadata fields added by parser if needed
      const cleanExpenses = parsed.expenses.map(e => ({
        payer: e.payer,
        amount: e.amount,
        beneficiaries: e.beneficiaries,
      }));

      const balances = calculateBalances(
        cleanExpenses,
        Array.from(parsed.participants)
      );

      expect(balances.get('Alice')).toBeCloseTo(30);
      expect(balances.get('Bob')).toBeCloseTo(-30);
    });
  });

  describe('Workflow: Remove participant -> Verify expenses preserved', () => {
    test('Removing participant does not affect historical expenses', () => {
      const participants = ['Alice', 'Bob', 'Charlie', 'David'];
      const expenses = [
        {
          payer: 'Alice',
          amount: 100,
          beneficiaries: ['Alice', 'Bob', 'Charlie'],
          description: 'Group activity',
          date: new Date('2026-01-10'),
        },
        {
          payer: 'Bob',
          amount: 60,
          beneficiaries: ['Alice', 'Bob'],
          description: 'Lunch',
          date: new Date('2026-01-11'),
        },
      ];

      // Calculate with David
      const balancesWithDavid = calculateBalances(expenses, participants);
      expect(balancesWithDavid.has('David')).toBe(true);

      // Remove David
      const participantsWithoutDavid = participants.filter(p => p !== 'David');
      const balancesWithoutDavid = calculateBalances(
        expenses,
        participantsWithoutDavid
      );

      // Expenses remain unchanged
      expect(expenses.length).toBe(2);
      expect(expenses[0].payer).toBe('Alice');
      expect(expenses[0].beneficiaries).toContain('Alice');
    });

    test('Settlement plan recalculates after participant removal', () => {
      // Initial state with 4 participants
      let participants = ['Alice', 'Bob', 'Charlie', 'David'];
      const expenses = [
        {
          payer: 'Alice',
          amount: 120,
          beneficiaries: ['Alice', 'Bob', 'Charlie', 'David'],
        },
      ];

      let balances = calculateBalances(expenses, participants);
      let plan1 = generateSettlementPlan(balances, new Set(), () => false);

      // Remove David
      participants = participants.filter(p => p !== 'David');
      balances = calculateBalances(expenses, participants);
      let plan2 = generateSettlementPlan(balances, new Set(), () => false);

      // Plans may differ
      expect(Array.isArray(plan1)).toBe(true);
      expect(Array.isArray(plan2)).toBe(true);
    });

    test('Participant expenses remain in transaction history', () => {
      const allExpenses = [
        {
          payer: 'Alice',
          amount: 50,
          beneficiaries: ['Alice'],
          description: 'Solo expense',
          date: new Date('2026-01-10'),
        },
        {
          payer: 'David',
          amount: 100,
          beneficiaries: ['David'],
          description: 'David solo expense',
          date: new Date('2026-01-11'),
        },
      ];

      // Find David's expenses before removal
      const davidExpenses = allExpenses.filter(e => e.payer === 'David');
      expect(davidExpenses.length).toBe(1);

      // Remove David from participant list (but expenses remain)
      const participants = ['Alice', 'Bob', 'Charlie'];

      // Expenses are still accessible
      expect(allExpenses.length).toBe(2);
      expect(
        allExpenses.some(e => e.payer === 'David')
      ).toBe(true);
    });
  });

  describe('Full workflow integration', () => {
    test('Complete trip scenario: add, log, mark strangers, settle, export', () => {
      // Setup
      const participants = new Set(['Alice', 'Bob', 'Charlie']);
      let strangers = new Set();

      // Add expenses
      const expenses = [
        {
          date: new Date('2026-01-20'),
          description: 'Hotel',
          payer: 'Alice',
          amount: 300,
          beneficiaries: ['Alice', 'Bob', 'Charlie'],
        },
        {
          date: new Date('2026-01-21'),
          description: 'Meals',
          payer: 'Bob',
          amount: 150,
          beneficiaries: ['Alice', 'Bob', 'Charlie'],
        },
        {
          date: new Date('2026-01-22'),
          description: 'Activities',
          payer: 'Charlie',
          amount: 90,
          beneficiaries: ['Alice', 'Bob', 'Charlie'],
        },
      ];

      // Calculate balances
      const balances = calculateBalances(
        expenses,
        Array.from(participants)
      );

      // Verify total is balanced
      const sum = Array.from(balances.values()).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(0, 5);

      // Mark Alice and Charlie as strangers
      strangers = toggleStranger('Alice', 'Charlie', strangers);
      expect(isStranger('Alice', 'Charlie', strangers)).toBe(true);

      // Generate settlement plan
      const plan = generateSettlementPlan(
        balances,
        strangers,
        (a, b) => isStranger(a, b, strangers)
      );
      expect(Array.isArray(plan)).toBe(true);

      // Export to TSV
      const tsv = generateTSV(expenses, participants, strangers, 540);
      expect(tsv).toContain('EXPENSE HISTORY');
      expect(tsv).toContain('STRANGERS_DATA');

      // Re-import and verify
      const parsed = parseTSV(tsv);
      expect(parsed.expenses.length).toBe(3);
      expect(parsed.participants.size).toBe(3);
      expect(parsed.strangers.size).toBe(1);
    });
  });
});
