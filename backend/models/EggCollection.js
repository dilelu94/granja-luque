import { getDatabaseConnection } from '../db/connection.js';

export class EggCollection {
  constructor(data) {
    this.id = data.id || null;
    this.date = data.date; // YYYY-MM-DD
    this.quantityCollected = data.quantity_collected || data.quantityCollected || 0;
    this.quantityBroken = data.quantity_broken || data.quantityBroken || 0;
    this.notes = data.notes || '';
    this.tempMin = data.temp_min !== undefined ? data.temp_min : null;
    this.tempMax = data.temp_max !== undefined ? data.temp_max : null;
    this.tempAvg = data.temp_avg !== undefined ? data.temp_avg : null;
    this.humidity = data.humidity !== undefined ? data.humidity : null;
    this.daylightDuration = data.daylight_duration !== undefined ? data.daylight_duration : null;
    this.cloudCover = data.cloud_cover !== undefined ? data.cloud_cover : null;
  }

  /**
   * Saves the collection entry to the database.
   */
  async save() {
    const db = await getDatabaseConnection();
    const { Settings } = await import('./Settings.js');

    let oldNet = 0;
    let isUpdate = false;

    if (this.id) {
      const old = await db.get('SELECT quantity_collected, quantity_broken FROM egg_production WHERE id = ?', [this.id]);
      if (old) {
        oldNet = old.quantity_collected - old.quantity_broken;
        isUpdate = true;
      }
    } else {
      const existing = await db.get('SELECT id, quantity_collected, quantity_broken FROM egg_production WHERE date = ?', [this.date]);
      if (existing) {
        this.id = existing.id;
        oldNet = existing.quantity_collected - existing.quantity_broken;
        isUpdate = true;
      }
    }

    const newNet = this.quantityCollected - this.quantityBroken;
    const delta = newNet - oldNet;

    if (isUpdate) {
      await db.run(
        `UPDATE egg_production 
         SET quantity_collected = ?, quantity_broken = ?, notes = ?, temp_min = ?, temp_max = ?, temp_avg = ?, humidity = ?, daylight_duration = ?, cloud_cover = ?
         WHERE id = ?`,
        [this.quantityCollected, this.quantityBroken, this.notes, this.tempMin, this.tempMax, this.tempAvg, this.humidity, this.daylightDuration, this.cloudCover, this.id]
      );
    } else {
      const result = await db.run(
        `INSERT INTO egg_production (date, quantity_collected, quantity_broken, notes, temp_min, temp_max, temp_avg, humidity, daylight_duration, cloud_cover)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [this.date, this.quantityCollected, this.quantityBroken, this.notes, this.tempMin, this.tempMax, this.tempAvg, this.humidity, this.daylightDuration, this.cloudCover]
      );
      this.id = result.lastID;
    }

    if (delta !== 0) {
      const currentLoose = await Settings.get('loose_eggs_stock') || 0;
      const nextLoose = Math.max(0, Number(currentLoose) + delta);
      await Settings.set('loose_eggs_stock', nextLoose);

      try {
        const { EggLedger } = await import('./EggLedger.js');
        const type = delta > 0 ? 'in' : 'out';
        const reason = delta > 0 ? 'recoleccion' : 'ajuste';
        await EggLedger.logTransaction(type, reason, Math.abs(delta), nextLoose, `Recolección/Ajuste diario (${this.date})`);
      } catch (err) {
        console.error('Error logging to ledger', err);
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
        SELECT SUM(current_quantity) as total_adults,
               SUM(females_quantity) as total_females
        FROM quail_batches 
        WHERE status = 'active'
          AND date(birth_date, '+35 days') <= date(?)
          AND date(birth_date) <= date(?)
      `, [dateStr, dateStr]);

      const adultCount = adultQuailsRow ? (adultQuailsRow.total_females || 0) : 0;
      
      // Tasa de postura: (huevos recolectados / codornices hembras adultas) * 100
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
        notes: col.notes,
        tempMin: col.temp_min,
        tempMax: col.temp_max,
        tempAvg: col.temp_avg,
        humidity: col.humidity,
        daylightDuration: col.daylight_duration,
        cloudCover: col.cloud_cover
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
    const { Settings } = await import('./Settings.js');
    
    const requiredEggs = packagesCount * eggsPerPackage;
    
    // Validar y descontar huevos sueltos
    const currentLoose = await Settings.get('loose_eggs_stock') || 0;
    if (Number(currentLoose) < requiredEggs) {
      throw new Error(`Huevos sueltos insuficientes. Se requieren ${requiredEggs} pero hay ${currentLoose}.`);
    }

    // Validar y descontar envases
    const product = await db.get('SELECT container_stock FROM products WHERE id = ?', [productId]);
    if (!product) throw new Error('Producto no encontrado.');
    if (product.container_stock < packagesCount) {
      throw new Error(`Envases insuficientes. Se requieren ${packagesCount} pero hay ${product.container_stock}.`);
    }

    // Actualizar inventarios
    const nextLoose = Number(currentLoose) - requiredEggs;
    await Settings.set('loose_eggs_stock', nextLoose);

    try {
      const { EggLedger } = await import('./EggLedger.js');
      await EggLedger.logTransaction('out', 'empaquetado', requiredEggs, nextLoose, `Empaquetados ${packagesCount} unidades (Producto ID: ${productId})`);
    } catch (err) {
      console.error('Error logging to ledger', err);
    }
    
    await db.run(
      'UPDATE products SET stock = stock + ?, container_stock = container_stock - ? WHERE id = ?',
      [packagesCount, packagesCount, productId]
    );

    return true;
  }
}
