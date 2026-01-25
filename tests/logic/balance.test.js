import { calculateBalances, calculateTotalSpent } from '@/logic/balance';
import { DEMO_EXPENSES, DEMO_PARTICIPANTS } from '../setup';

describe('Balance Calculation Logic', () => {
  test('Single payer, split among 3 people', () => {
    const expenses = [
      {
        payer: 'Alice',
        amount: 90,
        beneficiaries: ['Alice', 'Bob', 'Charlie'],
      },
    ];
    const balances = calculateBalances(expenses, [
      'Alice',
      'Bob',
      'Charlie',
    ]);

    expect(balances.get('Alice')).toBeCloseTo(60);
    expect(balances.get('Bob')).toBeCloseTo(-30);
    expect(balances.get('Charlie')).toBeCloseTo(-30);
  });

  test('Multiple payers balance correctly', () => {
    const expenses = [
      {
        payer: 'Alice',
        amount: 30,
        beneficiaries: ['Alice', 'Bob'],
      },
      {
        payer: 'Bob',
        amount: 40,
        beneficiaries: ['Alice', 'Bob'],
      },
    ];
    const balances = calculateBalances(expenses, ['Alice', 'Bob']);

    expect(balances.get('Alice')).toBeCloseTo(-5);
    expect(balances.get('Bob')).toBeCloseTo(5);
  });

  test('Participant with multiple expenses', () => {
    const expenses = [
      {
        payer: 'Alice',
        amount: 60,
        beneficiaries: ['Alice', 'Bob', 'Charlie'],
      },
      {
        payer: 'Alice',
        amount: 30,
        beneficiaries: ['Alice', 'Bob'],
      },
    ];
    const balances = calculateBalances(expenses, [
      'Alice',
      'Bob',
      'Charlie',
    ]);

    expect(balances.get('Alice')).toBeCloseTo(55);
    expect(balances.get('Bob')).toBeCloseTo(-35);
    expect(balances.get('Charlie')).toBeCloseTo(-20);
  });

  test('Sum of all balances equals zero', () => {
    const expenses = [
      {
        payer: 'Alice',
        amount: 100,
        beneficiaries: ['Alice', 'Bob', 'Charlie', 'David'],
      },
      {
        payer: 'Bob',
        amount: 50,
        beneficiaries: ['Bob', 'Charlie'],
      },
    ];
    const balances = calculateBalances(expenses, [
      'Alice',
      'Bob',
      'Charlie',
      'David',
    ]);

    const sum = Array.from(balances.values()).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(0, 5);
  });

  test('Handles removed participants', () => {
    const expenses = [
      {
        payer: 'Alice',
        amount: 60,
        beneficiaries: ['Alice', 'Bob', 'Charlie'],
      },
    ];
    const balances = calculateBalances(expenses, ['Alice', 'Bob']);

    expect(balances.get('Alice')).toBeCloseTo(40);
    expect(balances.get('Bob')).toBeCloseTo(-20);
    expect(balances.get('Charlie')).toBeUndefined();
  });

  test('Handles participant payer not in active list', () => {
    const expenses = [
      {
        payer: 'Charlie',
        amount: 60,
        beneficiaries: ['Alice', 'Bob', 'Charlie'],
      },
    ];
    const balances = calculateBalances(expenses, ['Alice', 'Bob', 'Charlie']);

    expect(balances.get('Charlie')).toBeCloseTo(40);
    expect(balances.get('Alice')).toBeCloseTo(-20);
    expect(balances.get('Bob')).toBeCloseTo(-20);
  });

  test('Handles invalid amount values', () => {
    const expenses = [
      {
        payer: 'Alice',
        amount: 'invalid',
        beneficiaries: ['Alice', 'Bob'],
      },
      {
        payer: 'Bob',
        amount: 30,
        beneficiaries: ['Bob', 'Alice'],
      },
    ];
    const balances = calculateBalances(expenses, ['Alice', 'Bob']);

    // Only Bob's expense should be counted
    expect(balances.get('Bob')).toBeCloseTo(15);
    expect(balances.get('Alice')).toBeCloseTo(-15);
  });

  test('Calculates total spent correctly', () => {
    const expenses = [
      { amount: 50 },
      { amount: 75.5 },
      { amount: 24.50 },
    ];

    const total = calculateTotalSpent(expenses);
    expect(total).toBeCloseTo(150, 2);
  });

  test('Handles floating point precision', () => {
    const expenses = [
      {
        payer: 'Alice',
        amount: 100,
        beneficiaries: ['Alice', 'Bob', 'Charlie'],
      },
    ];
    const balances = calculateBalances(expenses, [
      'Alice',
      'Bob',
      'Charlie',
    ]);

    // $100 / 3 = 33.333...
    expect(balances.get('Alice')).toBeCloseTo(66.67, 2);
    expect(balances.get('Bob')).toBeCloseTo(-33.33, 2);
    expect(balances.get('Charlie')).toBeCloseTo(-33.33, 2);
  });

  test('Empty expenses list', () => {
    const balances = calculateBalances([], ['Alice', 'Bob', 'Charlie']);

    expect(balances.get('Alice')).toBe(0);
    expect(balances.get('Bob')).toBe(0);
    expect(balances.get('Charlie')).toBe(0);
  });

  test('Complex multi-transaction scenario from demo data', () => {
    const balances = calculateBalances(DEMO_EXPENSES, DEMO_PARTICIPANTS);

    expect(balances.size).toBeGreaterThan(0);
    // Sum must be zero
    const sum = Array.from(balances.values()).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(0, 5);
  });
});
