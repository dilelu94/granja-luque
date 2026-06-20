import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CageEggCollection } from '../models/CageEggCollection.js';
import { EggCollection } from '../models/EggCollection.js';
import * as dbConnection from '../db/connection.js';

vi.mock('../db/connection.js', () => ({
  getDatabaseConnection: vi.fn()
}));

vi.mock('../models/EggCollection.js', () => ({
  EggCollection: {
    getByDate: vi.fn()
  }
}));

describe('CageEggCollection Model', () => {
  let mockDb;

  beforeEach(() => {
    mockDb = {
      run: vi.fn(),
      get: vi.fn(),
      all: vi.fn()
    };
    dbConnection.getDatabaseConnection.mockResolvedValue(mockDb);
    vi.clearAllMocks();
  });

  it('should initialize with correct properties', () => {
    const col = new CageEggCollection({
      id: 1,
      date: '2026-06-20',
      cage_id: 2,
      cage_name: 'Cage-A',
      quantity_collected: 20,
      quantity_broken: 2,
      notes: 'Good laying'
    });
    expect(col.id).toBe(1);
    expect(col.date).toBe('2026-06-20');
    expect(col.cageId).toBe(2);
    expect(col.cageName).toBe('Cage-A');
    expect(col.quantityCollected).toBe(20);
    expect(col.quantityBroken).toBe(2);
    expect(col.notes).toBe('Good laying');
  });

  it('should call update and return addition when record already exists for date and cage', async () => {
    mockDb.get.mockResolvedValue({
      id: 10,
      date: '2026-06-20',
      cage_id: 2,
      quantity_collected: 15,
      quantity_broken: 1,
      notes: 'Initial'
    });

    const mockGlobalEggColl = {
      quantityCollected: 15,
      quantityBroken: 1,
      notes: 'Initial',
      save: vi.fn().mockResolvedValue(true)
    };
    EggCollection.getByDate.mockResolvedValue(mockGlobalEggColl);

    const result = await CageEggCollection.saveCollection('2026-06-20', 2, 10, 2, 'Added notes');

    expect(result.isAddition).toBe(true);
    expect(result.finalCollected).toBe(25);
    expect(result.finalBroken).toBe(3);
    
    // Verifies global collection sync
    expect(mockGlobalEggColl.quantityCollected).toBe(25);
    expect(mockGlobalEggColl.quantityBroken).toBe(3);
    expect(mockGlobalEggColl.save).toHaveBeenCalled();
  });
});
