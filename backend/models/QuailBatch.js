import { getDatabaseConnection } from '../db/connection.js';

export class QuailBatch {
  constructor(data) {
    this.id = data.id || null;
    this.name = data.name;
    this.type = data.type; // 'chick' o 'adult'
    this.initialQuantity = data.initial_quantity || data.initialQuantity;
    this.currentQuantity = data.current_quantity || data.currentQuantity;
    this.birthDate = data.birth_date || data.birthDate; // YYYY-MM-DD
    this.status = data.status || 'active'; // 'active', 'sold', 'retired'
    this.notes = data.notes || '';
  }

  /**
   * Calculates age in days.
   * @returns {number}
   */
  getAgeInDays() {
    const parts = this.birthDate.split('-');
    const birth = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    const today = new Date();
    // Reset hours to avoid timezone/DST differences affecting integer days
    birth.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    const diffTime = Math.abs(today - birth);
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Calculates age in weeks.
   * @returns {number}
   */
  getAgeInWeeks() {
    return Math.floor(this.getAgeInDays() / 7);
  }

  /**
   * Determines feed type based on age.
   * Chicks (< 5 weeks) eat 'iniciador', adults eat 'ponedora'.
   * @returns {string} 'iniciador' | 'ponedora'
   */
  getFeedType() {
    return this.getAgeInDays() < 35 ? 'iniciador' : 'ponedora';
  }

  /**
   * Calculates daily feed consumption for the batch in kg.
   * @param {Object} settings Object containing feed rates: feed_consumption_chick and feed_consumption_adult
   * @returns {number} Consumption in kg/day
   */
  getDailyFeedConsumption(settings) {
    const feedType = this.getFeedType();
    const rate = feedType === 'iniciador'
      ? parseFloat(settings.feed_consumption_chick || 0.015)
      : parseFloat(settings.feed_consumption_adult || 0.025);
    return this.currentQuantity * rate;
  }

  /**
   * Saves the current instance to the database.
   */
  async save() {
    const db = await getDatabaseConnection();
    if (this.id) {
      await db.run(
        `UPDATE quail_batches 
         SET name = ?, type = ?, initial_quantity = ?, current_quantity = ?, birth_date = ?, status = ?, notes = ?
         WHERE id = ?`,
        [this.name, this.type, this.initialQuantity, this.currentQuantity, this.birthDate, this.status, this.notes, this.id]
      );
    } else {
      const result = await db.run(
        `INSERT INTO quail_batches (name, type, initial_quantity, current_quantity, birth_date, status, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [this.name, this.type, this.initialQuantity, this.currentQuantity, this.birthDate, this.status, this.notes]
      );
      this.id = result.lastID;
      
      // Si es un lote de polluelos recién nacidos, agregar hitos automáticos al calendario
      if (this.type === 'chick' && this.status === 'active') {
        await this._createAutomaticHatchingCalendarEvents(db);
      }
    }
    return this;
  }

  /**
   * Creates automatic calendar events for feed transition and posture start.
   * @param {import('sqlite').Database} db 
   * @private
   */
  async _createAutomaticHatchingCalendarEvents(db) {
    const parts = this.birthDate.split('-');
    const birth = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    
    // Transición de Alimento a las 5 semanas (35 días)
    const transitionDate = new Date(birth);
    transitionDate.setDate(transitionDate.getDate() + 35);
    const transitionDateStr = transitionDate.toISOString().split('T')[0];
    
    await db.run(`
      INSERT INTO calendar_events (title, description, event_date, type, reference_id)
      VALUES (?, ?, ?, 'feed_transition', ?)
    `, [
      `Cambio Alimento: ${this.name}`,
      `Lote ${this.name} cumple 5 semanas. Cambiar alimento de Iniciador a Ponedora.`,
      transitionDateStr,
      this.id
    ]);

    // Inicio de postura a las 6 semanas (42 días)
    const postureDate = new Date(birth);
    postureDate.setDate(postureDate.getDate() + 42);
    const postureDateStr = postureDate.toISOString().split('T')[0];

    await db.run(`
      INSERT INTO calendar_events (title, description, event_date, type, reference_id)
      VALUES (?, ?, ?, 'egg_posture', ?)
    `, [
      `Inicio Postura: ${this.name}`,
      `Lote ${this.name} cumple 6 semanas. Debería comenzar la postura de huevos.`,
      postureDateStr,
      this.id
    ]);
  }

  /**
   * Records mortality in the batch, decreasing the quantity.
   * @param {number} count Number of deceased quails
   */
  async recordMortality(count) {
    if (count <= 0) return;
    this.currentQuantity = Math.max(0, this.currentQuantity - count);
    const mortalityNote = `\n[${new Date().toISOString().split('T')[0]}] Baja registrada: ${count} aves.`;
    this.notes += mortalityNote;
    if (this.currentQuantity === 0) {
      this.status = 'retired';
    }
    await this.save();
  }

  // --- STATICS ---

  /**
   * Retrieves a quail batch by ID.
   * @param {number} id 
   * @returns {Promise<QuailBatch|null>}
   */
  static async getById(id) {
    const db = await getDatabaseConnection();
    const row = await db.get('SELECT * FROM quail_batches WHERE id = ?', [id]);
    return row ? new QuailBatch(row) : null;
  }

  /**
   * Retrieves all active quail batches.
   * @returns {Promise<QuailBatch[]>}
   */
  static async getAllActive() {
    const db = await getDatabaseConnection();
    const rows = await db.all("SELECT * FROM quail_batches WHERE status = 'active' ORDER BY birth_date DESC");
    return rows.map(row => new QuailBatch(row));
  }

  /**
   * Retrieves all quail batches.
   * @returns {Promise<QuailBatch[]>}
   */
  static async getAll() {
    const db = await getDatabaseConnection();
    const rows = await db.all("SELECT * FROM quail_batches ORDER BY birth_date DESC");
    return rows.map(row => new QuailBatch(row));
  }

  /**
   * Get active total quail count.
   * @returns {Promise<number>}
   */
  static async getActiveTotalCount() {
    const db = await getDatabaseConnection();
    const row = await db.get("SELECT SUM(current_quantity) as total FROM quail_batches WHERE status = 'active'");
    return row ? (row.total || 0) : 0;
  }

  /**
   * Get active counts by type (chick vs adult).
   * @returns {Promise<{chick: number, adult: number}>}
   */
  static async getActiveCountsByType() {
    const db = await getDatabaseConnection();
    const rows = await db.all(`
      SELECT type, SUM(current_quantity) as total 
      FROM quail_batches 
      WHERE status = 'active' 
      GROUP BY type
    `);
    const counts = { chick: 0, adult: 0 };
    rows.forEach(row => {
      counts[row.type] = row.total || 0;
    });
    return counts;
  }
}
