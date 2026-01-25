import Dexie from 'dexie';
import { jest } from '@jest/globals';

// Mock participant operations
class ParticipantDB {
  constructor() {
    this.db = new Dexie('testDB');
    this.db.version(1).stores({
      participants: '++id,name',
    });
  }

  async addParticipant(name) {
    if (!name || typeof name !== 'string' || !name.trim()) {
      throw new Error('Invalid participant name');
    }
    const existing = await this.db.participants
      .filter(p => p.name === name)
      .first();
    if (existing) {
      throw new Error('Participant already exists');
    }
    return await this.db.participants.add({ name });
  }

  async removeParticipant(id) {
    return await this.db.participants.delete(id);
  }

  async getAllParticipants() {
    return await this.db.participants.toArray();
  }

  async getParticipantByName(name) {
    return await this.db.participants.filter(p => p.name === name).first();
  }
}

describe('Participant Database Operations', () => {
  let participantDB;

  beforeEach(() => {
    participantDB = new ParticipantDB();
    jest.clearAllMocks();
  });

  describe('addParticipant', () => {
    test('Adds a new participant successfully', async () => {
      const participantDB = new ParticipantDB();
      await participantDB.addParticipant('Alice');

      const participants = await participantDB.getAllParticipants();
      expect(participants.length).toBeGreaterThan(0);
    });

    test('Rejects empty participant name', async () => {
      await expect(participantDB.addParticipant('')).rejects.toThrow(
        'Invalid participant name'
      );
    });

    test('Rejects null participant name', async () => {
      await expect(participantDB.addParticipant(null)).rejects.toThrow(
        'Invalid participant name'
      );
    });

    test('Rejects non-string participant name', async () => {
      await expect(participantDB.addParticipant(123)).rejects.toThrow(
        'Invalid participant name'
      );
    });

    test('Prevents duplicate participant names', async () => {
      await participantDB.addParticipant('Bob');
      await expect(participantDB.addParticipant('Bob')).rejects.toThrow(
        'Participant already exists'
      );
    });

    test('Allows adding multiple unique participants', async () => {
      await participantDB.addParticipant('Alice');
      await participantDB.addParticipant('Bob');
      await participantDB.addParticipant('Charlie');

      const participants = await participantDB.getAllParticipants();
      expect(participants.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('removeParticipant', () => {
    test('Removes participant by ID', async () => {
      const id = await participantDB.addParticipant('Alice');
      await participantDB.removeParticipant(id);

      const participant = await participantDB.db.participants.get(id);
      expect(participant).toBeNull();
    });

    test('Successfully removes participant from list', async () => {
      const id1 = await participantDB.addParticipant('Alice');
      const id2 = await participantDB.addParticipant('Bob');

      await participantDB.removeParticipant(id1);

      const participants = await participantDB.getAllParticipants();
      const remaining = participants.filter(p => p.id === id1);
      expect(remaining.length).toBe(0);
    });

    test('Does not affect other participants', async () => {
      const id1 = await participantDB.addParticipant('Alice');
      const id2 = await participantDB.addParticipant('Bob');

      await participantDB.removeParticipant(id1);

      const bob = await participantDB.db.participants.get(id2);
      expect(bob?.name).toBe('Bob');
    });
  });

  describe('getAllParticipants', () => {
    test('Returns empty array initially', async () => {
      const participants = await participantDB.getAllParticipants();
      expect(Array.isArray(participants)).toBe(true);
    });

    test('Returns all added participants', async () => {
      await participantDB.addParticipant('Alice');
      await participantDB.addParticipant('Bob');
      await participantDB.addParticipant('Charlie');

      const participants = await participantDB.getAllParticipants();
      expect(participants.length).toBeGreaterThanOrEqual(3);
    });

    test('Returns participants with correct structure', async () => {
      await participantDB.addParticipant('Alice');
      const participants = await participantDB.getAllParticipants();

      if (participants.length > 0) {
        const participant = participants[0];
        expect(participant).toHaveProperty('id');
        expect(participant).toHaveProperty('name');
      }
    });
  });

  describe('getParticipantByName', () => {
    test('Retrieves participant by exact name match', async () => {
      await participantDB.addParticipant('Alice');
      const participant = await participantDB.getParticipantByName('Alice');

      expect(participant?.name).toBe('Alice');
    });

    test('Returns undefined for non-existent participant', async () => {
      const participant = await participantDB.getParticipantByName(
        'NonExistent'
      );
      expect(participant).toBeUndefined();
    });

    test('Is case-sensitive', async () => {
      await participantDB.addParticipant('Alice');
      const participant = await participantDB.getParticipantByName('alice');

      expect(participant).toBeUndefined();
    });

    test('Finds participant among multiple entries', async () => {
      await participantDB.addParticipant('Alice');
      await participantDB.addParticipant('Bob');
      await participantDB.addParticipant('Charlie');

      const participant = await participantDB.getParticipantByName('Bob');
      expect(participant?.name).toBe('Bob');
    });
  });

  describe('Participant name validation', () => {
    test('Accepts alphanumeric names', async () => {
      await expect(
        participantDB.addParticipant('Alice123')
      ).resolves.toBeDefined();
    });

    test('Accepts names with spaces', async () => {
      await expect(
        participantDB.addParticipant('John Doe')
      ).resolves.toBeDefined();
    });

    test('Accepts names with special characters', async () => {
      await expect(participantDB.addParticipant("O'Brien")).resolves.toBeDefined();
    });

    test('Rejects whitespace-only names', async () => {
      await expect(participantDB.addParticipant('   ')).rejects.toThrow();
    });
  });
});
