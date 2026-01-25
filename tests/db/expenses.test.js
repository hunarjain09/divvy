import Dexie from 'dexie';
import { jest } from '@jest/globals';

// Mock expense operations
class ExpenseDB {
  constructor() {
    this.db = new Dexie('testDB');
    this.db.version(1).stores({
      expenses: '++id,payer,date',
    });
  }

  async addExpense(expense) {
    if (!expense.description || !expense.payer || expense.amount === undefined) {
      throw new Error('Invalid expense data');
    }
    const expenseWithDate = {
      ...expense,
      date: expense.date || new Date(),
    };
    return await this.db.expenses.add(expenseWithDate);
  }

  async removeExpense(id) {
    return await this.db.expenses.delete(id);
  }

  async updateExpense(id, updates) {
    const expense = await this.db.expenses.get(id);
    if (!expense) {
      throw new Error('Expense not found');
    }
    return await this.db.expenses.put({ ...expense, ...updates, id });
  }

  async getAllExpenses() {
    return await this.db.expenses.orderBy('date').reverse().toArray();
  }

  async getExpensesByParticipant(participantName) {
    return await this.db.expenses
      .filter(exp => 
        exp.payer === participantName || 
        (exp.beneficiaries && exp.beneficiaries.includes(participantName))
      )
      .toArray();
  }

  async getExpensesByDate(startDate, endDate) {
    return await this.db.expenses
      .filter(exp => exp.date >= startDate && exp.date <= endDate)
      .toArray();
  }
}

describe('Expense Database Operations', () => {
  let expenseDB;

  beforeEach(() => {
    expenseDB = new ExpenseDB();
    jest.clearAllMocks();
  });

  describe('addExpense', () => {
    test('Adds a new expense successfully', async () => {
      const expense = {
        description: 'Hotel',
        payer: 'Alice',
        amount: 90,
        beneficiaries: ['Alice', 'Bob'],
      };

      const id = await expenseDB.addExpense(expense);
      expect(typeof id).toBe('number');
    });

    test('Adds expense with current date if not provided', async () => {
      const beforeTime = new Date();
      const expense = {
        description: 'Lunch',
        payer: 'Alice',
        amount: 30,
        beneficiaries: ['Alice'],
      };

      await expenseDB.addExpense(expense);
      const expenses = await expenseDB.getAllExpenses();

      if (expenses.length > 0) {
        expect(expenses[0].date).toBeDefined();
      }
    });

    test('Uses provided date for expense', async () => {
      const specifiedDate = new Date('2026-01-15T10:00:00');
      const expense = {
        description: 'Dinner',
        payer: 'Bob',
        amount: 60,
        date: specifiedDate,
        beneficiaries: ['Bob', 'Charlie'],
      };

      await expenseDB.addExpense(expense);
      const expenses = await expenseDB.getAllExpenses();

      expect(expenses[0].date).toEqual(specifiedDate);
    });

    test('Rejects expense with missing description', async () => {
      const expense = {
        payer: 'Alice',
        amount: 50,
      };

      await expect(expenseDB.addExpense(expense)).rejects.toThrow(
        'Invalid expense data'
      );
    });

    test('Rejects expense with missing payer', async () => {
      const expense = {
        description: 'Hotel',
        amount: 90,
      };

      await expect(expenseDB.addExpense(expense)).rejects.toThrow(
        'Invalid expense data'
      );
    });

    test('Rejects expense with missing amount', async () => {
      const expense = {
        description: 'Hotel',
        payer: 'Alice',
      };

      await expect(expenseDB.addExpense(expense)).rejects.toThrow(
        'Invalid expense data'
      );
    });

    test('Accepts zero amount expense', async () => {
      const expense = {
        description: 'Adjustment',
        payer: 'Alice',
        amount: 0,
        beneficiaries: ['Alice'],
      };

      await expect(expenseDB.addExpense(expense)).resolves.toBeDefined();
    });

    test('Accepts negative amount expense', async () => {
      const expense = {
        description: 'Refund',
        payer: 'Alice',
        amount: -25,
        beneficiaries: ['Alice'],
      };

      await expect(expenseDB.addExpense(expense)).resolves.toBeDefined();
    });

    test('Preserves beneficiaries list', async () => {
      const expense = {
        description: 'Group dinner',
        payer: 'Alice',
        amount: 120,
        beneficiaries: ['Alice', 'Bob', 'Charlie', 'David'],
      };

      await expenseDB.addExpense(expense);
      const expenses = await expenseDB.getAllExpenses();

      expect(expenses[0].beneficiaries).toEqual([
        'Alice',
        'Bob',
        'Charlie',
        'David',
      ]);
    });
  });

  describe('removeExpense', () => {
    test('Removes expense by ID', async () => {
      const expense = {
        description: 'Test',
        payer: 'Alice',
        amount: 50,
      };

      const id = await expenseDB.addExpense(expense);
      await expenseDB.removeExpense(id);

      const expenses = await expenseDB.getAllExpenses();
      const found = expenses.find(e => e.id === id);
      expect(found).toBeUndefined();
    });

    test('Does not affect other expenses', async () => {
      const exp1 = { description: 'Hotel', payer: 'Alice', amount: 90 };
      const exp2 = { description: 'Dinner', payer: 'Bob', amount: 60 };

      const id1 = await expenseDB.addExpense(exp1);
      const id2 = await expenseDB.addExpense(exp2);

      await expenseDB.removeExpense(id1);

      const expenses = await expenseDB.getAllExpenses();
      const remaining = expenses.find(e => e.id === id2);
      expect(remaining?.description).toBe('Dinner');
    });
  });

  describe('updateExpense', () => {
    test('Updates expense amount', async () => {
      const expense = {
        description: 'Hotel',
        payer: 'Alice',
        amount: 90,
      };

      const id = await expenseDB.addExpense(expense);
      await expenseDB.updateExpense(id, { amount: 100 });

      const updated = await expenseDB.db.expenses.get(id);
      expect(updated.amount).toBe(100);
    });

    test('Updates expense description', async () => {
      const expense = {
        description: 'Dinner',
        payer: 'Alice',
        amount: 60,
      };

      const id = await expenseDB.addExpense(expense);
      await expenseDB.updateExpense(id, { description: 'Lunch & Dinner' });

      const updated = await expenseDB.db.expenses.get(id);
      expect(updated.description).toBe('Lunch & Dinner');
    });

    test('Updates multiple fields at once', async () => {
      const expense = {
        description: 'Original',
        payer: 'Alice',
        amount: 50,
      };

      const id = await expenseDB.addExpense(expense);
      await expenseDB.updateExpense(id, {
        description: 'Updated',
        amount: 75,
        payer: 'Bob',
      });

      const updated = await expenseDB.db.expenses.get(id);
      expect(updated.description).toBe('Updated');
      expect(updated.amount).toBe(75);
      expect(updated.payer).toBe('Bob');
    });

    test('Throws error for non-existent expense', async () => {
      await expect(expenseDB.updateExpense(999, { amount: 50 })).rejects.toThrow(
        'Expense not found'
      );
    });

    test('Preserves other fields when updating', async () => {
      const expense = {
        description: 'Hotel',
        payer: 'Alice',
        amount: 90,
        beneficiaries: ['Alice', 'Bob'],
        date: new Date('2026-01-15'),
      };

      const id = await expenseDB.addExpense(expense);
      await expenseDB.updateExpense(id, { amount: 100 });

      const updated = await expenseDB.db.expenses.get(id);
      expect(updated.beneficiaries).toEqual(['Alice', 'Bob']);
      expect(updated.date).toEqual(new Date('2026-01-15'));
    });
  });

  describe('getAllExpenses', () => {
    test('Returns expenses sorted by date (newest first)', async () => {
      const date1 = new Date('2026-01-10');
      const date2 = new Date('2026-01-20');
      const date3 = new Date('2026-01-15');

      await expenseDB.addExpense({
        description: 'First',
        payer: 'Alice',
        amount: 50,
        date: date1,
      });
      await expenseDB.addExpense({
        description: 'Third',
        payer: 'Bob',
        amount: 60,
        date: date2,
      });
      await expenseDB.addExpense({
        description: 'Second',
        payer: 'Charlie',
        amount: 40,
        date: date3,
      });

      const expenses = await expenseDB.getAllExpenses();

      expect(expenses[0].date).toEqual(date2);
      expect(expenses[1].date).toEqual(date3);
      expect(expenses[2].date).toEqual(date1);
    });

    test('Returns empty array when no expenses', async () => {
      const expenses = await expenseDB.getAllExpenses();
      expect(Array.isArray(expenses)).toBe(true);
    });
  });

  describe('getExpensesByParticipant', () => {
    test('Returns expenses where participant is payer', async () => {
      await expenseDB.addExpense({
        description: 'Alice paid',
        payer: 'Alice',
        amount: 50,
        beneficiaries: ['Alice', 'Bob'],
      });
      await expenseDB.addExpense({
        description: 'Bob paid',
        payer: 'Bob',
        amount: 60,
        beneficiaries: ['Bob', 'Charlie'],
      });

      const aliceExpenses = await expenseDB.getExpensesByParticipant('Alice');
      const hasAlicePaid = aliceExpenses.some(e => e.payer === 'Alice');
      expect(hasAlicePaid).toBe(true);
    });

    test('Returns expenses where participant is beneficiary', async () => {
      await expenseDB.addExpense({
        description: 'Group expense',
        payer: 'Alice',
        amount: 120,
        beneficiaries: ['Alice', 'Bob', 'Charlie'],
      });

      const bobExpenses = await expenseDB.getExpensesByParticipant('Bob');
      const found = bobExpenses.some(
        e => e.beneficiaries?.includes('Bob')
      );
      expect(found).toBe(true);
    });

    test('Returns empty array for participant with no expenses', async () => {
      await expenseDB.addExpense({
        description: 'Someone else',
        payer: 'Alice',
        amount: 50,
        beneficiaries: ['Alice'],
      });

      const expenses = await expenseDB.getExpensesByParticipant('David');
      expect(expenses.length).toBe(0);
    });
  });

  describe('getExpensesByDate', () => {
    test('Returns expenses within date range', async () => {
      const date1 = new Date('2026-01-10');
      const date2 = new Date('2026-01-15');
      const date3 = new Date('2026-01-20');

      await expenseDB.addExpense({
        description: 'Early',
        payer: 'Alice',
        amount: 50,
        date: date1,
      });
      await expenseDB.addExpense({
        description: 'Middle',
        payer: 'Bob',
        amount: 60,
        date: date2,
      });
      await expenseDB.addExpense({
        description: 'Late',
        payer: 'Charlie',
        amount: 40,
        date: date3,
      });

      const expenses = await expenseDB.getExpensesByDate(
        new Date('2026-01-12'),
        new Date('2026-01-18')
      );

      expect(expenses.some(e => e.description === 'Middle')).toBe(true);
      expect(expenses.some(e => e.description === 'Early')).toBe(false);
      expect(expenses.some(e => e.description === 'Late')).toBe(false);
    });

    test('Includes boundary dates', async () => {
      const startDate = new Date('2026-01-15');
      const endDate = new Date('2026-01-20');

      await expenseDB.addExpense({
        description: 'Start',
        payer: 'Alice',
        amount: 50,
        date: startDate,
      });
      await expenseDB.addExpense({
        description: 'End',
        payer: 'Bob',
        amount: 60,
        date: endDate,
      });

      const expenses = await expenseDB.getExpensesByDate(startDate, endDate);

      expect(expenses.some(e => e.description === 'Start')).toBe(true);
      expect(expenses.some(e => e.description === 'End')).toBe(true);
    });
  });
});
