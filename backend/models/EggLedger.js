import { getDatabaseConnection } from '../db/connection.js';

export class EggLedger {
  /**
   * Logs a transaction in the egg ledger.
   * @param {string} type 'in' or 'out'
   * @param {string} reason The reason for the movement (e.g. 'recoleccion', 'empaquetado', 'descontado', 'ajuste_manual')
   * @param {number} quantity The number of eggs moved
   * @param {number} currentStock The stock after this transaction
   * @param {string} notes Optional notes
   */
  static async logTransaction(type, reason, quantity, currentStock, notes = '') {
    const db = await getDatabaseConnection();
    const date = new Date().toISOString();
    
    await db.run(
      `INSERT INTO egg_ledger (date, type, reason, quantity, current_stock, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [date, type, reason, quantity, currentStock, notes]
    );
  }

  /**
   * Retrieves the transaction history.
   */
  static async getHistory(limit = 100, offset = 0) {
    const db = await getDatabaseConnection();
    const rows = await db.all(
      `SELECT * FROM egg_ledger ORDER BY date DESC LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    return rows;
  }
}
