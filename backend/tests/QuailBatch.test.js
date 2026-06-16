import { describe, it, expect, vi } from 'vitest';
import { QuailBatch } from '../models/QuailBatch.js';

describe('QuailBatch Model', () => {
  it('should correctly calculate age in days based on birth_date', () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const birth = new Date(today);
    birth.setDate(today.getDate() - 20); // 20 días de edad

    const batch = new QuailBatch({
      birth_date: birth.toISOString().split('T')[0]
    });

    expect(batch.getAgeInDays()).toBe(20);
  });

  it('should correctly calculate feed type based on age', () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // 10 días -> iniciador
    let birth = new Date(today);
    birth.setDate(today.getDate() - 10);
    let batch = new QuailBatch({ birth_date: birth.toISOString().split('T')[0] });
    expect(batch.getFeedType()).toBe('iniciador');

    // 50 días -> ponedora
    birth = new Date(today);
    birth.setDate(today.getDate() - 50);
    batch = new QuailBatch({ birth_date: birth.toISOString().split('T')[0] });
    expect(batch.getFeedType()).toBe('ponedora');
  });

  it('should calculate daily feed consumption correctly for young chicks', () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const birth = new Date(today);
    birth.setDate(today.getDate() - 20);

    const batch = new QuailBatch({
      birth_date: birth.toISOString().split('T')[0],
      current_quantity: 100
    });

    const settings = { feed_consumption_chick: '0.015', feed_consumption_adult: '0.025' };
    const breakdown = batch.getDailyFeedConsumptionBreakdown(settings);

    // 100 aves * 0.015 kg = 1.5 kg, mas 20% desperdicio por tener < 21 días = 1.8 kg
    expect(breakdown.initiator).toBe(1.8);
    expect(breakdown.ponedora).toBe(0);
  });

  it('should calculate proportional feed consumption during transition (41-42 days)', () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const birth = new Date(today);
    birth.setDate(today.getDate() - 41); // En transición 50/50

    const batch = new QuailBatch({
      birth_date: birth.toISOString().split('T')[0],
      current_quantity: 100
    });

    const settings = { feed_consumption_chick: '0.015', feed_consumption_adult: '0.025' };
    const breakdown = batch.getDailyFeedConsumptionBreakdown(settings);

    // rateCombined = 0.5 * 0.015 + 0.5 * 0.025 = 0.020
    // initiator = 100 * 0.020 * 0.50 = 1.0
    // ponedora = 100 * 0.020 * 0.50 = 1.0

    expect(breakdown.initiator).toBeCloseTo(1.0, 2);
    expect(breakdown.ponedora).toBeCloseTo(1.0, 2);
  });

  it('should properly instantiate females and males quantities', () => {
    const batch = new QuailBatch({
      females_quantity: 40,
      males_quantity: 10
    });
    expect(batch.femalesQuantity).toBe(40);
    expect(batch.malesQuantity).toBe(10);
  });
});
