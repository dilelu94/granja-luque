import { getDatabaseConnection } from '../db/connection.js';

export class EggCollection {
  constructor(data) {
    this.id = data.id || null;
    this.date = data.date; // YYYY-MM-DD
    this.quantityCollected = data.quantity_collected || data.quantityCollected || 0;
    this.quantityBroken = data.quantity_broken || data.quantityBroken || 0;
    this.notes = data.notes || '';
  }

  /**
   * Saves the collection entry to the database.
   */
  async save() {
    const db = await getDatabaseConnection();
    if (this.id) {
      await db.run(
        `UPDATE egg_production 
         SET quantity_collected = ?, quantity_broken = ?, notes = ? 
         WHERE id = ?`,
        [this.quantityCollected, this.quantityBroken, this.notes, this.id]
      );
    } else {
      const result = await db.run(
        `INSERT INTO egg_production (date, quantity_collected, quantity_broken, notes)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(date) DO UPDATE SET 
           quantity_collected = excluded.quantity_collected,
           quantity_broken = excluded.quantity_broken,
           notes = excluded.notes`,
        [this.date, this.quantityCollected, this.quantityBroken, this.notes]
      );
      if (result.lastID) {
        this.id = result.lastID;
      } else {
        // En caso de conflicto resuelto, buscamos el ID
        const row = await db.get('SELECT id FROM egg_production WHERE date = ?', [this.date]);
        if (row) this.id = row.id;
      }
    }
    return this;
  }

  // --- STATICS ---

  /**
   * Retrieves collection record for a specific date.
   * @param {string} date YYYY-MM-DD
   * @returns {Promise<EggCollection|null>}
   */
  static async getByDate(date) {
    const db = await getDatabaseConnection();
    const row = await db.get('SELECT * FROM egg_production WHERE date = ?', [date]);
    return row ? new EggCollection(row) : null;
  }

  /**
   * Gets collection stats for the last N days.
   * Calculates posture rate using the active adult quails count.
   * @param {number} limit Number of days
   * @returns {Promise<Array>}
   */
  static async getStats(limit = 14) {
    const db = await getDatabaseConnection();
    // Obtener las recolecciones
    const collections = await db.all(`
      SELECT * FROM egg_production 
      ORDER BY date DESC 
      LIMIT ?
    `, [limit]);

    // Para cada recolección, estimar el número de codornices adultas activas en esa fecha
    const stats = [];
    for (const col of collections) {
      const dateStr = col.date;
      
      // Contar codornices adultas activas en esa fecha:
      // - El lote debe haber nacido al menos 35 días antes de dateStr
      // - El lote no debe haber sido retirado antes de dateStr (para simplificar, filtramos por activos hoy,
      //   o los que se crearon antes y siguen activos)
      const adultQuailsRow = await db.get(`
        SELECT SUM(current_quantity) as total_adults 
        FROM quail_batches 
        WHERE status = 'active'
          AND date(birth_date, '+35 days') <= date(?)
          AND date(birth_date) <= date(?)
      `, [dateStr, dateStr]);

      const adultCount = adultQuailsRow ? (adultQuailsRow.total_adults || 0) : 0;
      
      // Tasa de postura: (huevos recolectados / codornices adultas) * 100
      let postureRate = 0;
      if (adultCount > 0) {
        postureRate = Math.round((col.quantity_collected / adultCount) * 1000) / 10;
      }

      stats.push({
        id: col.id,
        date: col.date,
        quantityCollected: col.quantity_collected,
        quantityBroken: col.quantity_broken,
        adultQuailsCount: adultCount,
        postureRate, // ej: 80%
        expectedEggs: Math.round(adultCount * 0.8), // 80 huevos cada 100 codornices
        notes: col.notes
      });
    }

    return stats.reverse(); // Orden cronológico para gráficas
  }

  /**
   * Packs raw eggs into a product stock (e.g. converting 30 raw eggs into 1 maple).
   * Deducts quantity from raw stock is not strictly necessary since eggs are collected,
   * but we need to track how many eggs are "available/unpacked" and how many "packaged".
   * Let's say we have an Egg Stock in settings, or we just increase the product stock directly.
   * Increasing product stock directly is the easiest and most practical!
   * The admin registers: "Empaquetar 3 maples de 30".
   * This subtracts 90 collected eggs from a virtual "unpacked egg pool" (or just updates the product stock
   * and logs it in the inventory notes).
   * Let's implement a static method that packs eggs:
   * It takes a product ID, number of packages, and egg equivalent per package.
   * It increases the product stock in the database.
   */
  static async packEggs(productId, packagesCount, eggsPerPackage) {
    const db = await getDatabaseConnection();
    
    // Incrementar el stock del producto
    await db.run(
      'UPDATE products SET stock = stock + ? WHERE id = ?',
      [packagesCount, productId]
    );

    return true;
  }
}
