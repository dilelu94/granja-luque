import { describe, it, expect } from 'vitest';
import { calculateDynamicEggCost } from '../utils/costCalculator.js';

describe('costCalculator Utility', () => {
  it('should calculate dynamic egg cost properly based on adult counts and feed prices', () => {
    // 2 batches
    // Batch 1: 50 females, 60 current
    // Batch 2: 50 females, 40 current (wait, usually females <= current) -> Let's say 30 females, 40 current
    const adultBatches = [
      { femalesQuantity: 50, currentQuantity: 60 },
      { femalesQuantity: 30, currentQuantity: 40 }
    ];

    const feedConsumptionAdult = '0.025';
    const ponedoraCostPerKg = 1000;

    // Expected daily feed cost:
    // Total adults = 100
    // Total females = 80
    // Feed = 100 * 0.025 * 1000 = 2.5 * 1000 = 2500
    // Daily eggs = 80 * 0.8 = 64
    // Cost per egg = 2500 / 64 = 39.0625

    const cost = calculateDynamicEggCost(adultBatches, feedConsumptionAdult, ponedoraCostPerKg);
    expect(cost).toBeCloseTo(39.0625, 4);
  });

  it('should return 0 if there are no females (division by zero protection)', () => {
    const adultBatches = [
      { femalesQuantity: 0, currentQuantity: 50 }
    ];
    const cost = calculateDynamicEggCost(adultBatches, 0.025, 1000);
    expect(cost).toBe(0);
  });
});
