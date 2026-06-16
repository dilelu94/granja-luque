import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FeedStock } from '../models/FeedStock.js';
import { QuailBatch } from '../models/QuailBatch.js';
import * as dbConnection from '../db/connection.js';

// Mock dependencias
vi.mock('../db/connection.js', () => ({
  getDatabaseConnection: vi.fn()
}));
vi.mock('../models/QuailBatch.js', () => ({
  QuailBatch: {
    getAllActive: vi.fn()
  }
}));

describe('FeedStock Model', () => {
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

  it('should initialize with correct default values', () => {
    const feed = new FeedStock({ type: 'ponedora', quantity: 50 });
    expect(feed.type).toBe('ponedora');
    expect(feed.quantity).toBe(50);
    expect(feed.id).toBeNull();
  });

  it('should consume stock correctly without dropping below zero', async () => {
    const feed = new FeedStock({ type: 'iniciador', quantity: 20 });
    // mock save to just return
    feed.save = vi.fn().mockResolvedValue(feed);

    await feed.consumeStock(15);
    expect(feed.quantity).toBe(5);

    await feed.consumeStock(10);
    expect(feed.quantity).toBe(0); // No debe ser negativo
  });

  it('should calculate estimates correctly based on active batches', async () => {
    // Setup 2 mock batches: 100 adultos, 100 pollitos
    const batchAdult = {
      getDailyFeedConsumptionBreakdown: vi.fn().mockReturnValue({ initiator: 0, ponedora: 2.5 })
    };
    const batchChick = {
      getDailyFeedConsumptionBreakdown: vi.fn().mockReturnValue({ initiator: 1.5, ponedora: 0 })
    };
    QuailBatch.getAllActive.mockResolvedValue([batchAdult, batchChick]);

    // Setup mock DB to return specific stock amounts
    mockDb.get.mockImplementation(async (query, params) => {
      if (query.includes('FROM feed_stock')) {
        if (params[0] === 'iniciador') return { id: 1, type: 'iniciador', quantity: 15 };
        if (params[0] === 'ponedora') return { id: 2, type: 'ponedora', quantity: 25 };
      }
      if (query.includes('FROM feed_purchases')) {
        // Mock purchase to test costPerKg calculation
        return { price: 20000, shipping_cost: 5000, quantity_kg: 25 }; // (20000+5000)/25 = 1000
      }
      return null;
    });

    const settings = { feed_consumption_chick: '0.015', feed_consumption_adult: '0.025' };
    const estimates = await FeedStock.calculateEstimates(settings);

    // initiatorNeed = 1.5, ponedoraNeed = 2.5
    // initiatorStock = 15 -> 15 / 1.5 = 10 days
    // ponedoraStock = 25 -> 25 / 2.5 = 10 days
    expect(estimates.initiator.dailyConsumption).toBe(1.5);
    expect(estimates.initiator.daysLeft).toBe(10);
    expect(estimates.initiator.costPerKg).toBe(1000);

    expect(estimates.ponedora.dailyConsumption).toBe(2.5);
    expect(estimates.ponedora.daysLeft).toBe(10);
    expect(estimates.ponedora.costPerKg).toBe(1000);
  });
});
