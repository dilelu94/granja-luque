import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Incubation } from '../models/Incubation.js';
import * as dbConnection from '../db/connection.js';

vi.mock('../db/connection.js', () => ({
  getDatabaseConnection: vi.fn()
}));

describe('Incubation Model', () => {
  let mockDb;

  beforeEach(() => {
    mockDb = {
      run: vi.fn().mockResolvedValue({ lastID: 1 }),
      get: vi.fn(),
      all: vi.fn()
    };
    dbConnection.getDatabaseConnection.mockResolvedValue(mockDb);
    vi.clearAllMocks();
  });

  it('should initialize with active status and parse fields', () => {
    const todayStr = '2026-06-01T10:00';
    const incubation = new Incubation({
      eggs_count: 50,
      start_date: todayStr
    });

    expect(incubation.status).toBe('active');
    expect(incubation.eggsCount).toBe(50);
    expect(incubation.startDate).toBe(todayStr);
  });

  it('should format date and create batch if status is completed', async () => {
    const incubation = new Incubation({
      id: 1,
      eggs_count: 50,
      start_date: '2026-06-01T10:00',
      status: 'completed'
    });

    mockDb.get.mockResolvedValue({ status: 'active' }); // Old status was active

    await incubation.save();

    expect(incubation.startDate).toBe('2026-06-01 10:00'); // Replaces T with space
    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE incubations'),
      expect.any(Array)
    );
  });
});
