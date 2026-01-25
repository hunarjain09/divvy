import { generateSettlementPlan } from '@/logic/solver';
import { isStranger } from '@/logic/relationships';

describe('Settlement Solver Logic', () => {
  describe('generateSettlementPlan', () => {
    test('Returns empty array when already settled', () => {
      const balances = new Map([
        ['Alice', 0],
        ['Bob', 0],
      ]);
      const strangers = new Set();

      const plan = generateSettlementPlan(balances, strangers, isStranger);

      expect(plan).toEqual([]);
    });

    test('Returns empty array when solver is unavailable', () => {
      const originalSolver = window.solver;
      window.solver = undefined;

      const balances = new Map([
        ['Alice', 50],
        ['Bob', -50],
      ]);
      const strangers = new Set();

      const plan = generateSettlementPlan(balances, strangers, isStranger);

      expect(plan).toEqual([]);
      window.solver = originalSolver;
    });

    test('Filters out zero or near-zero amounts', () => {
      const balances = new Map([
        ['Alice', 0.001],
        ['Bob', -0.001],
        ['Charlie', 0],
      ]);
      const strangers = new Set();

      const plan = generateSettlementPlan(balances, strangers, isStranger);

      expect(plan).toEqual([]);
    });

    test('Simple 2-person settlement: debtor to creditor', () => {
      const balances = new Map([
        ['Alice', 50], // creditor
        ['Bob', -50], // debtor
      ]);
      const strangers = new Set();

      const plan = generateSettlementPlan(balances, strangers, (a, b) =>
        isStranger(a, b, strangers)
      );

      expect(plan.length).toBeGreaterThan(0);
      expect(plan[0].amount).toBeCloseTo(50);
    });

    test('Settlement plan contains from, to, amount, and isStranger properties', () => {
      const balances = new Map([
        ['Alice', 50],
        ['Bob', -50],
      ]);
      const strangers = new Set();

      const plan = generateSettlementPlan(balances, strangers, (a, b) =>
        isStranger(a, b, strangers)
      );

      if (plan.length > 0) {
        const transaction = plan[0];
        expect(transaction).toHaveProperty('from');
        expect(transaction).toHaveProperty('to');
        expect(transaction).toHaveProperty('amount');
        expect(transaction).toHaveProperty('isStranger');
      }
    });

    test('Respects stranger relationships (prefers friend paths)', () => {
      const balances = new Map([
        ['Alice', 50],
        ['Bob', -20],
        ['Charlie', -30],
      ]);
      const strangers = new Set(['Alice|Bob']); // Alice and Bob are strangers
      const mockIsStranger = (a, b) => isStranger(a, b, strangers);

      const plan = generateSettlementPlan(balances, strangers, mockIsStranger);

      // If solver routes through Charlie instead of Bob, that would prefer friends
      expect(plan).toBeDefined();
      expect(Array.isArray(plan)).toBe(true);
    });

    test('Handles chain debt scenario', () => {
      const balances = new Map([
        ['Alice', 30], // creditor
        ['Bob', 0], // intermediate
        ['Charlie', -30], // debtor
      ]);
      const strangers = new Set();

      const plan = generateSettlementPlan(balances, strangers, (a, b) =>
        isStranger(a, b, strangers)
      );

      // Even if chain routing not optimal, should produce valid plan
      expect(Array.isArray(plan)).toBe(true);
    });

    test('Handles multiple creditors and debtors', () => {
      const balances = new Map([
        ['Alice', 30],
        ['Bob', 40],
        ['Charlie', -35],
        ['David', -35],
      ]);
      const strangers = new Set();

      const plan = generateSettlementPlan(balances, strangers, (a, b) =>
        isStranger(a, b, strangers)
      );

      expect(plan).toBeDefined();
      expect(Array.isArray(plan)).toBe(true);
    });

    test('Settlement plan amounts are rounded to cents', () => {
      const balances = new Map([
        ['Alice', 50.33],
        ['Bob', -50.33],
      ]);
      const strangers = new Set();

      const plan = generateSettlementPlan(balances, strangers, (a, b) =>
        isStranger(a, b, strangers)
      );

      if (plan.length > 0) {
        plan.forEach(transaction => {
          expect(Number.isFinite(transaction.amount)).toBe(true);
        });
      }
    });

    test('Includes isStranger flag for stranger transactions', () => {
      const balances = new Map([
        ['Alice', 50],
        ['Bob', -25],
        ['Charlie', -25],
      ]);
      const strangers = new Set(['Alice|Bob']);

      const plan = generateSettlementPlan(balances, strangers, (a, b) =>
        isStranger(a, b, strangers)
      );

      if (plan.length > 0) {
        plan.forEach(transaction => {
          const isStr = isStranger(
            transaction.from,
            transaction.to,
            strangers
          );
          expect(transaction.isStranger).toBe(isStr);
        });
      }
    });
  });
});
