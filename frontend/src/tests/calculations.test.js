import { describe, it, expect } from 'vitest';
import { calculate4MonthROI, getPackagingSuggestions } from '../utils/calculations.js';

describe('Frontend Calculations', () => {
  describe('calculate4MonthROI', () => {
    it('should calculate ROI properly', () => {
      // Ingreso mensual = 1000, Inversion = 2000
      // 4 meses de ingreso = 4000
      // ROI = 4000 / 2000 = 2 (200%)
      expect(calculate4MonthROI(2000, 1000)).toBe(2);
    });

    it('should return 0 if investment is 0 to avoid Infinity', () => {
      expect(calculate4MonthROI(0, 1000)).toBe(0);
    });
  });

  describe('getPackagingSuggestions', () => {
    it('should return an empty array if no eggs or no products', () => {
      expect(getPackagingSuggestions(0, [])).toEqual([]);
      expect(getPackagingSuggestions(10, [])).toEqual([]);
      expect(getPackagingSuggestions(0, [{ egg_count: 12, container_stock: 5 }])).toEqual([]);
    });

    it('should suggest packaging based on available eggs and containers', () => {
      const products = [
        { id: 1, name: 'Maple 12', egg_count: 12, container_stock: 5 },
        { id: 2, name: 'Maple 6', egg_count: 6, container_stock: 0 }, // No containers
        { id: 3, name: 'Caja 30', egg_count: 30, container_stock: 10 }
      ];

      // Tenemos 25 huevos sueltos
      const suggestions = getPackagingSuggestions(25, products);

      // Esperamos que sugiera "Maple 12", porque puede armar 2 (24 huevos).
      // No debe sugerir "Maple 6" porque no hay stock.
      // No debe sugerir "Caja 30" porque no alcanzan los huevos (25 < 30).
      expect(suggestions.length).toBe(1);
      expect(suggestions[0].product.name).toBe('Maple 12');
      expect(suggestions[0].possiblePacks).toBe(2);
    });

    it('should cap suggestions by container stock', () => {
      const products = [
        { id: 1, name: 'Maple 12', egg_count: 12, container_stock: 1 },
      ];

      // Tenemos 100 huevos, podríamos armar 8 maples, pero solo tenemos 1 envase
      const suggestions = getPackagingSuggestions(100, products);

      expect(suggestions.length).toBe(1);
      expect(suggestions[0].possiblePacks).toBe(1);
    });

    it('should sort suggestions by largest capacity first', () => {
      const products = [
        { id: 1, name: 'Maple 6', egg_count: 6, container_stock: 10 },
        { id: 2, name: 'Caja 30', egg_count: 30, container_stock: 10 },
        { id: 3, name: 'Maple 12', egg_count: 12, container_stock: 10 }
      ];

      // 100 huevos
      const suggestions = getPackagingSuggestions(100, products);

      expect(suggestions.length).toBe(3);
      expect(suggestions[0].product.name).toBe('Caja 30');
      expect(suggestions[1].product.name).toBe('Maple 12');
      expect(suggestions[2].product.name).toBe('Maple 6');
    });
  });
});
