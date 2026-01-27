import { parseTSV, generateTSV } from '@/logic/importExport';

describe('Import/Export Logic', () => {
  describe('parseTSV', () => {
    test('Parses valid TSV with all sections', () => {
      const tsvData = `EXPENSE HISTORY
Date	Description	Payer	Amount	Beneficiaries	ISO_Timestamp	ID
Jan 20, 3:00 PM	Hotel	Alice	90.00	Alice, Bob, Charlie	2026-01-20T15:00:00.000Z	0
Jan 21, 4:00 PM	Dinner	Bob	60.00	Bob, Charlie, David	2026-01-21T16:00:00.000Z	1

TOTAL SPENT	150.00

PARTICIPANTS_DATA
Alice
Bob
Charlie
David

STRANGERS_DATA
Alice|Bob
Bob|Charlie`;

      const result = parseTSV(tsvData);

      expect(result.expenses.length).toBe(2);
      expect(result.participants.size).toBe(4);
      expect(result.strangers.size).toBe(2);
    });

    test('Parses expenses correctly', () => {
      const tsvData = `EXPENSE HISTORY
Date	Description	Payer	Amount	Beneficiaries	ISO_Timestamp	ID
Jan 20, 3:00 PM	Hotel	Alice	90.00	Alice, Bob, Charlie	2026-01-20T15:00:00.000Z	0`;

      const result = parseTSV(tsvData);

      expect(result.expenses[0].payer).toBe('Alice');
      expect(result.expenses[0].amount).toBe(90.00);
      expect(result.expenses[0].description).toBe('Hotel');
      expect(result.expenses[0].id).toBe('0');
      expect(result.expenses[0].beneficiaries).toEqual([
        'Alice',
        'Bob',
        'Charlie',
      ]);
    });

    test('Preserves UUID IDs from TSV', () => {
      const uuid = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
      const tsvData = `EXPENSE HISTORY
Date	Description	Payer	Amount	Beneficiaries	ISO_Timestamp	ID
Jan 20, 3:00 PM	Hotel	Alice	90.00	Alice, Bob	2026-01-20T15:00:00.000Z	${uuid}`;

      const result = parseTSV(tsvData);

      expect(result.expenses[0].id).toBe(uuid);
    });

    test('Sets id to undefined when ID column is missing', () => {
      const tsvData = `EXPENSE HISTORY
Date	Description	Payer	Amount	Beneficiaries	ISO_Timestamp
Jan 20, 3:00 PM	Hotel	Alice	90.00	Alice, Bob	2026-01-20T15:00:00.000Z`;

      const result = parseTSV(tsvData);

      expect(result.expenses[0].id).toBeUndefined();
    });

    test('Extracts ISO timestamp as Date object', () => {
      const tsvData = `EXPENSE HISTORY
Date	Description	Payer	Amount	Beneficiaries	ISO_Timestamp	ID
Jan 20, 3:00 PM	Test	Alice	50.00	Alice, Bob	2026-01-20T15:00:00.000Z	0`;

      const result = parseTSV(tsvData);
      const expense = result.expenses[0];

      expect(expense.date instanceof Date).toBe(true);
      expect(expense.date.toISOString()).toBe('2026-01-20T15:00:00.000Z');
    });

    test('Falls back to new Date when ISO timestamp is missing', () => {
      const tsvData = `EXPENSE HISTORY
Date	Description	Payer	Amount	Beneficiaries	ISO_Timestamp	ID
Jan 20, 3:00 PM	Hotel	Alice	90.00	Alice, Bob		0`;

      const result = parseTSV(tsvData);

      expect(result.expenses[0].date instanceof Date).toBe(true);
    });

    test('Properly splits beneficiaries with commas', () => {
      const tsvData = `EXPENSE HISTORY
Date	Description	Payer	Amount	Beneficiaries	ISO_Timestamp	ID
Jan 20, 3:00 PM	Hotel	Alice	100.00	Alice, Bob, Charlie, David	2026-01-20T15:00:00.000Z	0`;

      const result = parseTSV(tsvData);

      expect(result.expenses[0].beneficiaries).toEqual([
        'Alice',
        'Bob',
        'Charlie',
        'David',
      ]);
    });

    test('Handles special characters in descriptions', () => {
      const tsvData = `EXPENSE HISTORY
Date	Description	Payer	Amount	Beneficiaries	ISO_Timestamp	ID
Jan 20, 3:00 PM	Dinner & drinks!	Alice	50.00	Alice, Bob	2026-01-20T15:00:00.000Z	0`;

      const result = parseTSV(tsvData);

      expect(result.expenses[0].description).toBe('Dinner & drinks!');
    });

    test('Ignores malformed expense lines', () => {
      const tsvData = `EXPENSE HISTORY
Date	Description	Payer	Amount	Beneficiaries	ISO_Timestamp	ID
Jan 20, 3:00 PM	Hotel	Alice	invalid_amount	Alice, Bob	2026-01-20T15:00:00.000Z	0
Jan 21, 4:00 PM	Dinner	Bob	60.00	Bob, Charlie	2026-01-21T16:00:00.000Z	1`;

      const result = parseTSV(tsvData);

      expect(result.expenses.length).toBe(1);
      expect(result.expenses[0].payer).toBe('Bob');
    });

    test('Parses PARTICIPANTS_DATA section', () => {
      const tsvData = `PARTICIPANTS_DATA
Alice
Bob
Charlie
David`;

      const result = parseTSV(tsvData);

      expect(result.participants.size).toBe(4);
      expect(result.participants.has('Alice')).toBe(true);
      expect(result.participants.has('Bob')).toBe(true);
    });

    test('Parses STRANGERS_DATA section', () => {
      const tsvData = `STRANGERS_DATA
Alice|Bob
Bob|Charlie
David|Elena`;

      const result = parseTSV(tsvData);

      expect(result.strangers.size).toBe(3);
      expect(result.strangers.has('Alice|Bob')).toBe(true);
      expect(result.strangers.has('David|Elena')).toBe(true);
    });

    test('Handles empty sections', () => {
      const tsvData = `EXPENSE HISTORY
Date	Description	Payer	Amount	Beneficiaries	ISO_Timestamp	ID

PARTICIPANTS_DATA

STRANGERS_DATA`;

      const result = parseTSV(tsvData);

      expect(result.expenses.length).toBe(0);
      expect(result.participants.size).toBe(0);
      expect(result.strangers.size).toBe(0);
    });

    test('Skips section header lines', () => {
      const tsvData = `EXPENSE HISTORY
Date	Description	Payer	Amount	Beneficiaries	ISO_Timestamp	ID
Jan 20, 3:00 PM	Hotel	Alice	90.00	Alice, Bob	2026-01-20T15:00:00.000Z	0
TOTAL SPENT	90.00`;

      const result = parseTSV(tsvData);

      expect(result.expenses.length).toBe(1);
    });

    test('Handles expense with no beneficiaries specified', () => {
      const tsvData = `EXPENSE HISTORY
Date	Description	Payer	Amount	Beneficiaries	ISO_Timestamp	ID
Jan 20, 3:00 PM	Test	Alice	50.00		2026-01-20T15:00:00.000Z	0`;

      const result = parseTSV(tsvData);

      expect(result.expenses[0].beneficiaries).toEqual([]);
    });
  });

  describe('generateTSV', () => {
    test('Generates valid TSV format with headers', () => {
      const expenses = [
        {
          id: 'test-uuid-1',
          date: new Date('2026-01-20T15:00:00.000Z'),
          description: 'Hotel',
          payer: 'Alice',
          amount: 90.0,
          beneficiaries: ['Alice', 'Bob', 'Charlie'],
        },
      ];
      const participants = new Set(['Alice', 'Bob', 'Charlie']);
      const strangers = new Set();

      const tsv = generateTSV(expenses, participants, strangers, 90.0);

      expect(tsv).toContain('EXPENSE HISTORY');
      expect(tsv).toContain('Date\tDescription\tPayer\tAmount\tBeneficiaries');
      expect(tsv).toContain('Hotel\tAlice\t90.00');
    });

    test('Includes expense ID in output', () => {
      const expenses = [
        {
          id: 'abc-123-def',
          date: new Date('2026-01-20T15:00:00.000Z'),
          description: 'Hotel',
          payer: 'Alice',
          amount: 90.0,
          beneficiaries: ['Alice'],
        },
      ];
      const participants = new Set(['Alice']);
      const strangers = new Set();

      const tsv = generateTSV(expenses, participants, strangers, 90.0);

      expect(tsv).toContain('abc-123-def');
    });

    test('Formats amounts with 2 decimal places', () => {
      const expenses = [
        {
          id: 'test-uuid-2',
          date: new Date('2026-01-20T15:00:00.000Z'),
          description: 'Test',
          payer: 'Alice',
          amount: 50.5,
          beneficiaries: ['Alice'],
        },
      ];
      const participants = new Set(['Alice']);
      const strangers = new Set();

      const tsv = generateTSV(expenses, participants, strangers, 50.5);

      expect(tsv).toContain('50.50');
    });

    test('Includes ISO timestamp for each expense', () => {
      const expenses = [
        {
          id: 'test-uuid-3',
          date: new Date('2026-01-20T15:00:00.000Z'),
          description: 'Hotel',
          payer: 'Alice',
          amount: 90.0,
          beneficiaries: ['Alice'],
        },
      ];
      const participants = new Set(['Alice']);
      const strangers = new Set();

      const tsv = generateTSV(expenses, participants, strangers, 90.0);

      expect(tsv).toContain('2026-01-20T15:00:00.000Z');
    });

    test('Joins beneficiaries with commas and spaces', () => {
      const expenses = [
        {
          id: 'test-uuid-4',
          date: new Date('2026-01-20T15:00:00.000Z'),
          description: 'Hotel',
          payer: 'Alice',
          amount: 90.0,
          beneficiaries: ['Alice', 'Bob', 'Charlie'],
        },
      ];
      const participants = new Set(['Alice', 'Bob', 'Charlie']);
      const strangers = new Set();

      const tsv = generateTSV(expenses, participants, strangers, 90.0);

      expect(tsv).toContain('Alice, Bob, Charlie');
    });

    test('Removes tabs and newlines from descriptions', () => {
      const expenses = [
        {
          id: 'test-uuid-5',
          date: new Date('2026-01-20T15:00:00.000Z'),
          description: 'Hotel\tand\nDinner',
          payer: 'Alice',
          amount: 90.0,
          beneficiaries: ['Alice'],
        },
      ];
      const participants = new Set(['Alice']);
      const strangers = new Set();

      const tsv = generateTSV(expenses, participants, strangers, 90.0);

      expect(tsv).toContain('Hotel and Dinner');
      expect(tsv).not.toContain('Hotel\tand');
    });

    test('Includes TOTAL SPENT section', () => {
      const expenses = [
        {
          id: 'test-uuid-6',
          date: new Date('2026-01-20T15:00:00.000Z'),
          description: 'Test',
          payer: 'Alice',
          amount: 75.5,
          beneficiaries: ['Alice'],
        },
      ];
      const participants = new Set(['Alice']);
      const strangers = new Set();

      const tsv = generateTSV(expenses, participants, strangers, 75.5);

      expect(tsv).toContain('TOTAL SPENT\t75.50');
    });

    test('Includes PARTICIPANTS_DATA section', () => {
      const expenses = [];
      const participants = new Set(['Alice', 'Bob', 'Charlie']);
      const strangers = new Set();

      const tsv = generateTSV(expenses, participants, strangers, 0);

      expect(tsv).toContain('PARTICIPANTS_DATA');
    });

    test('Includes STRANGERS_DATA section', () => {
      const expenses = [];
      const participants = new Set(['Alice', 'Bob']);
      const strangers = new Set(['Alice|Bob']);

      const tsv = generateTSV(expenses, participants, strangers, 0);

      expect(tsv).toContain('STRANGERS_DATA');
      expect(tsv).toContain('Alice|Bob');
    });

    test('Generates multiple expense entries', () => {
      const expenses = [
        {
          id: 'test-uuid-7',
          date: new Date('2026-01-20T15:00:00.000Z'),
          description: 'Hotel',
          payer: 'Alice',
          amount: 90.0,
          beneficiaries: ['Alice', 'Bob'],
        },
        {
          id: 'test-uuid-8',
          date: new Date('2026-01-21T16:00:00.000Z'),
          description: 'Dinner',
          payer: 'Bob',
          amount: 60.0,
          beneficiaries: ['Bob', 'Charlie'],
        },
      ];
      const participants = new Set(['Alice', 'Bob', 'Charlie']);
      const strangers = new Set();

      const tsv = generateTSV(expenses, participants, strangers, 150.0);

      expect(tsv).toContain('Hotel\tAlice\t90.00');
      expect(tsv).toContain('Dinner\tBob\t60.00');
    });

    test('Handles empty expense list', () => {
      const expenses = [];
      const participants = new Set(['Alice', 'Bob']);
      const strangers = new Set();

      const tsv = generateTSV(expenses, participants, strangers, 0);

      expect(tsv).toContain('EXPENSE HISTORY');
      expect(tsv).toContain('TOTAL SPENT\t0.00');
    });
  });
});
