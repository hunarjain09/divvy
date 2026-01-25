import { jest } from '@jest/globals';

// Only set up browser mocks if we're in jsdom environment (not node)
if (typeof window !== 'undefined') {
  // Mock window.solver (LP Solver)
  global.window.solver = {
    Solve: jest.fn((model) => ({
      T_Alice_Bob: 5000, // $50
      T_Bob_Charlie: 3000, // $30
    })),
  };
}

// Mock localStorage
const localStorageMock = {
  data: {},
  getItem: (key) => localStorageMock.data[key] || null,
  setItem: (key, val) => {
    localStorageMock.data[key] = val;
  },
  removeItem: (key) => {
    delete localStorageMock.data[key];
  },
  clear: () => {
    localStorageMock.data = {};
  },
};

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Mock Dexie
jest.mock('dexie', () => {
  // Collection-like object with filter/first/toArray/reverse support
  class MockCollection {
    constructor(data = []) {
      this._data = data;
    }

    filter(predicate) {
      const filtered = this._data.filter(predicate);
      return new MockCollection(filtered);
    }

    reverse() {
      const reversed = [...this._data].reverse();
      return new MockCollection(reversed);
    }

    async first() {
      return this._data.length > 0 ? this._data[0] : undefined;
    }

    async toArray() {
      return this._data;
    }
  }

  // Mock Table with data persistence
  class MockTable {
    constructor() {
      this._storage = [];
    }

    async add(item) {
      const id = item.id || Math.random();
      this._storage.push({ ...item, id });
      return id;
    }

    async delete(key) {
      this._storage = this._storage.filter(item => item.id !== key);
    }

    async bulkAdd(items) {
      items.forEach(item => {
        const id = item.id || Math.random();
        this._storage.push({ ...item, id });
      });
    }

    async bulkDelete(keys) {
      this._storage = this._storage.filter(item => !keys.includes(item.id));
    }

    async toArray() {
      return this._storage;
    }

    async count() {
      return this._storage.length;
    }

    async put(item) {
      const existingIndex = this._storage.findIndex(x => x.id === item.id);
      if (existingIndex >= 0) {
        this._storage[existingIndex] = item;
      } else {
        this._storage.push(item);
      }
    }

    async clear() {
      this._storage = [];
    }

    async get(key) {
      return this._storage.find(item => item.id === key) || null;
    }

    filter(predicate) {
      return new MockCollection(this._storage.filter(predicate));
    }

    orderBy(fieldName) {
      const sorted = [...this._storage].sort((a, b) => {
        const aVal = a[fieldName];
        const bVal = b[fieldName];
        if (aVal < bVal) return -1;
        if (aVal > bVal) return 1;
        return 0;
      });
      return new MockCollection(sorted);
    }
  }

  return {
    __esModule: true,
    default: class Dexie {
      constructor(name) {
        this.name = name;
        this.participants = new MockTable();
        this.expenses = new MockTable();
        this.strangers = new MockTable();
      }

      version() {
        return {
          stores: () => this,
        };
      }

      transaction(mode, ...stores) {
        return (callback) => callback();
      }
    },
  };
});

// Global test fixtures
export const DEMO_PARTICIPANTS = ['Alice', 'Bob', 'Charlie', 'David', 'Elena'];

export const DEMO_EXPENSES = [
  {
    id: 1,
    payer: 'Alice',
    amount: 90,
    description: 'Hotel',
    beneficiaries: ['Alice', 'Bob', 'Charlie'],
    date: new Date('2026-01-20'),
  },
  {
    id: 2,
    payer: 'Bob',
    amount: 60,
    description: 'Dinner',
    beneficiaries: ['Bob', 'Charlie', 'David'],
    date: new Date('2026-01-21'),
  },
  {
    id: 3,
    payer: 'Charlie',
    amount: 40,
    description: 'Transport',
    beneficiaries: ['Alice', 'Bob', 'Charlie', 'David'],
    date: new Date('2026-01-22'),
  },
];

// Reset mocks before each test
beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
});

// Suppress console errors during tests (optional)
const originalError = console.error;
beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Not implemented: navigation')
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});
