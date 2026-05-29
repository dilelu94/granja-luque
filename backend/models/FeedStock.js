import { getDatabaseConnection } from '../db/connection.js';
import { QuailBatch } from './QuailBatch.js';

export class FeedStock {
  constructor(data) {
    this.id = data.id || null;
    this.type = data.type; // 'iniciador' | 'ponedora'
    this.quantity = data.quantity || 0; // en kg
    this.lastUpdated = data.last_updated || data.lastUpdated || new Date().toISOString();
  }

  /**
   * Saves the current feed stock state.
   */
  async save() {
    const db = await getDatabaseConnection();
    this.lastUpdated = new Date().toISOString();
    if (this.id) {
      await db.run(
        'UPDATE feed_stock SET quantity = ?, last_updated = ? WHERE id = ?',
        [this.quantity, this.lastUpdated, this.id]
      );
    } else {
      const result = await db.run(
        'INSERT INTO feed_stock (type, quantity, last_updated) VALUES (?, ?, ?)',
        [this.type, this.quantity, this.lastUpdated]
      );
      this.id = result.lastID;
    }
    return this;
  }

  /**
   * Adds feed stock (e.g. bought a new bag) and registers purchase details.
   * @param {number} kg 
   * @param {number} price Cost of the feed bag/amount
   * @param {number} shippingCost Cost of shipping/flete
   */
  async addStock(kg, price = 0.0, shippingCost = 0.0) {
    if (kg <= 0) return;
    this.quantity += kg;
    await this.save();

    // Registrar la compra en el historial de gastos
    const db = await getDatabaseConnection();
    await db.run(
      `INSERT INTO feed_purchases (feed_type, quantity_kg, price, shipping_cost, purchase_date)
       VALUES (?, ?, ?, ?, ?)`,
      [this.type, kg, price, shippingCost, new Date().toISOString().split('T')[0]]
    );
  }

  /**
   * Deducts feed stock (e.g. manual consumption or adjustments).
   * @param {number} kg 
   */
  async consumeStock(kg) {
    if (kg <= 0) return;
    this.quantity = Math.max(0, this.quantity - kg);
    await this.save();
  }

  // --- STATICS ---

  /**
   * Gets feed stock by type.
   * @param {string} type 'iniciador' | 'ponedora'
   * @returns {Promise<FeedStock>}
   */
  static async getByType(type) {
    const db = await getDatabaseConnection();
    const row = await db.get('SELECT * FROM feed_stock WHERE type = ?', [type]);
    if (!row) {
      // Si no existe, crear uno con cantidad 0
      const newStock = new FeedStock({ type, quantity: 0 });
      await newStock.save();
      return newStock;
    }
    return new FeedStock(row);
  }

  /**
   * Gets all feed stocks.
   * @returns {Promise<FeedStock[]>}
   */
  static async getAll() {
    const db = await getDatabaseConnection();
    const rows = await db.all('SELECT * FROM feed_stock');
    return rows.map(row => new FeedStock(row));
  }

  /**
   * Calculates the estimated duration of feed stocks based on daily consumption of all active batches.
   * @param {Object} settings Global settings for feed rates
   * @returns {Promise<Object>} Object with consumption rates and days remaining
   */
  static async calculateEstimates(settings) {
    const activeBatches = await QuailBatch.getAllActive();
    
    let dailyInitiatorNeed = 0;
    let dailyLayingNeed = 0;

    activeBatches.forEach(batch => {
      const consumption = batch.getDailyFeedConsumption(settings);
      if (batch.getFeedType() === 'iniciador') {
        dailyInitiatorNeed += consumption;
      } else {
        dailyLayingNeed += consumption;
      }
    });

    const initiatorStock = await FeedStock.getByType('iniciador');
    const layingStock = await FeedStock.getByType('ponedora');

    const daysLeftInitiator = dailyInitiatorNeed > 0 
      ? Math.round((initiatorStock.quantity / dailyInitiatorNeed) * 10) / 10 
      : null; // null significa sin consumo activo
    
    const daysLeftLaying = dailyLayingNeed > 0 
      ? Math.round((layingStock.quantity / dailyLayingNeed) * 10) / 10 
      : null;

    return {
      initiator: {
        stock: initiatorStock.quantity,
        dailyConsumption: dailyInitiatorNeed,
        daysLeft: daysLeftInitiator
      },
      ponedora: {
        stock: layingStock.quantity,
        dailyConsumption: dailyLayingNeed,
        daysLeft: daysLeftLaying
      }
    };
  }

  /**
   * Automatically deducts feed stock based on one day of consumption.
   * This can be run by a cron task or when the admin opens the dashboard.
   * To prevent duplicate deductions, we should track when the last deduction was made,
   * or just let the user run it/view estimates.
   * For simplicity and accuracy in a farm system, daily consumption is usually deducted
   * automatically per day elapsed, or manually updated.
   * Let's implement a method that calculates consumption since a specific date and deducts it.
   */
  static async deductDailyConsumption(daysCount = 1, settings) {
    const estimates = await FeedStock.calculateEstimates(settings);
    
    if (estimates.initiator.dailyConsumption > 0) {
      const initStock = await FeedStock.getByType('iniciador');
      await initStock.consumeStock(estimates.initiator.dailyConsumption * daysCount);
    }
    
    if (estimates.ponedora.dailyConsumption > 0) {
      const layingStock = await FeedStock.getByType('ponedora');
      await layingStock.consumeStock(estimates.ponedora.dailyConsumption * daysCount);
    }
  }
}
