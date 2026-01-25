import {
  normalizePairKey,
  isStranger,
  toggleStranger,
} from '@/logic/relationships';

describe('Relationships Logic', () => {
  describe('normalizePairKey', () => {
    test('Creates alphabetically sorted pair key', () => {
      const key = normalizePairKey('Bob', 'Alice');
      expect(key).toBe('Alice|Bob');
    });

    test('Handles already sorted names', () => {
      const key = normalizePairKey('Alice', 'Bob');
      expect(key).toBe('Alice|Bob');
    });

    test('Bidirectional pairs produce same key', () => {
      const key1 = normalizePairKey('Alice', 'Bob');
      const key2 = normalizePairKey('Bob', 'Alice');
      expect(key1).toBe(key2);
    });

    test('Case-sensitive pair keys', () => {
      const key1 = normalizePairKey('alice', 'Bob');
      const key2 = normalizePairKey('Alice', 'Bob');
      expect(key1).not.toBe(key2);
    });

    test('Handles identical names', () => {
      const key = normalizePairKey('Alice', 'Alice');
      expect(key).toBe('Alice|Alice');
    });
  });

  describe('isStranger', () => {
    test('Returns true for known strangers', () => {
      const strangers = new Set(['Alice|Bob']);
      expect(isStranger('Alice', 'Bob', strangers)).toBe(true);
    });

    test('Returns false for unknown strangers', () => {
      const strangers = new Set();
      expect(isStranger('Alice', 'Bob', strangers)).toBe(false);
    });

    test('Recognizes stranger regardless of name order', () => {
      const strangers = new Set(['Alice|Bob']);
      expect(isStranger('Bob', 'Alice', strangers)).toBe(true);
    });

    test('Returns false for friends (not in stranger set)', () => {
      const strangers = new Set(['Alice|Charlie']);
      expect(isStranger('Alice', 'Bob', strangers)).toBe(false);
    });

    test('Handles multiple stranger relationships', () => {
      const strangers = new Set([
        'Alice|Bob',
        'Bob|Charlie',
        'David|Elena',
      ]);
      expect(isStranger('Alice', 'Bob', strangers)).toBe(true);
      expect(isStranger('Alice', 'Charlie', strangers)).toBe(false);
      expect(isStranger('David', 'Elena', strangers)).toBe(true);
    });
  });

  describe('toggleStranger', () => {
    test('Adds new stranger relationship', () => {
      const strangers = new Set();
      const updated = toggleStranger('Alice', 'Bob', strangers);
      expect(updated.has('Alice|Bob')).toBe(true);
    });

    test('Removes existing stranger relationship', () => {
      const strangers = new Set(['Alice|Bob']);
      const updated = toggleStranger('Alice', 'Bob', strangers);
      expect(updated.has('Alice|Bob')).toBe(false);
    });

    test('Toggles bidirectionally', () => {
      const strangers = new Set();
      const updated = toggleStranger('Bob', 'Alice', strangers);
      expect(updated.has('Alice|Bob')).toBe(true);
    });

    test('Does not mutate original set', () => {
      const strangers = new Set(['Alice|Bob']);
      const updated = toggleStranger('Charlie', 'David', strangers);
      expect(strangers.has('Charlie|David')).toBe(false);
      expect(updated.has('Charlie|David')).toBe(true);
    });

    test('Returns unchanged set for invalid inputs (empty name)', () => {
      const strangers = new Set(['Alice|Bob']);
      const updated = toggleStranger('', 'Bob', strangers);
      expect(updated).toEqual(strangers);
    });

    test('Returns unchanged set for invalid inputs (same person twice)', () => {
      const strangers = new Set();
      const updated = toggleStranger('Alice', 'Alice', strangers);
      expect(updated).toEqual(strangers);
    });

    test('Handles multiple toggle operations', () => {
      let strangers = new Set();
      strangers = toggleStranger('Alice', 'Bob', strangers);
      expect(strangers.has('Alice|Bob')).toBe(true);

      strangers = toggleStranger('Alice', 'Bob', strangers);
      expect(strangers.has('Alice|Bob')).toBe(false);

      strangers = toggleStranger('Alice', 'Bob', strangers);
      expect(strangers.has('Alice|Bob')).toBe(true);
    });

    test('Manages multiple relationships independently', () => {
      let strangers = new Set();
      strangers = toggleStranger('Alice', 'Bob', strangers);
      strangers = toggleStranger('Charlie', 'David', strangers);
      strangers = toggleStranger('Elena', 'Frank', strangers);

      expect(strangers.size).toBe(3);
      expect(strangers.has('Alice|Bob')).toBe(true);
      expect(strangers.has('Charlie|David')).toBe(true);
      expect(strangers.has('Elena|Frank')).toBe(true);
    });
  });
});
