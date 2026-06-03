import { getDatabaseConnection } from '../db/connection.js';

export class QuailBatch {
  constructor(data) {
    this.id = data.id || null;
    this.name = data.name;
    this.type = data.type; // 'chick' o 'adult'
    this.initialQuantity = data.initial_quantity ?? data.initialQuantity;
    this.currentQuantity = data.current_quantity ?? data.currentQuantity;
    this.birthDate = data.birth_date || data.birthDate; // YYYY-MM-DD
    this.status = data.status || 'active'; // 'active', 'sold', 'retired'
    this.notes = data.notes || '';
    this.cageId = data.cage_id || data.cageId || null;
    this.cageName = data.cage_name || data.cageName || '';
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
   * Chicks (< 45 days) eat 'iniciador', adults eat 'ponedora'.
   * @returns {string} 'iniciador' | 'ponedora'
   */
  getFeedType() {
    return this.getAgeInDays() < 45 ? 'iniciador' : 'ponedora';
  }

  /**
   * Calculates daily feed consumption breakdown for the batch in kg.
   * @param {Object} settings Object containing feed rates: feed_consumption_chick and feed_consumption_adult
   * @returns {{ initiator: number, ponedora: number }} Consumption breakdown in kg/day
   */
  getDailyFeedConsumptionBreakdown(settings) {
    const age = this.getAgeInDays();
    const rateChick = parseFloat(settings.feed_consumption_chick || 0.015);
    const rateAdult = parseFloat(settings.feed_consumption_adult || 0.025);
    const qty = this.currentQuantity;

    let initiatorNeed = 0;
    let ponedoraNeed = 0;

    if (age < 39) {
      // 100% Iniciador
      let rate = rateChick;
      // Desperdicio de 20% en las primeras 3 semanas (21 días)
      if (age < 21) {
        rate = rate * 1.20;
      }
      initiatorNeed = qty * rate;
    } else if (age >= 39 && age <= 40) {
      // Transición Día 1-2: 75% Iniciación / 25% Postura
      const rateCombined = (0.75 * rateChick) + (0.25 * rateAdult);
      initiatorNeed = qty * rateCombined * 0.75;
      ponedoraNeed = qty * rateCombined * 0.25;
    } else if (age >= 41 && age <= 42) {
      // Transición Día 3-4: 50% Iniciación / 50% Postura
      const rateCombined = (0.50 * rateChick) + (0.50 * rateAdult);
      initiatorNeed = qty * rateCombined * 0.50;
      ponedoraNeed = qty * rateCombined * 0.50;
    } else if (age >= 43 && age <= 44) {
      // Transición Día 5-6: 25% Iniciación / 75% Postura
      const rateCombined = (0.25 * rateChick) + (0.75 * rateAdult);
      initiatorNeed = qty * rateCombined * 0.25;
      ponedoraNeed = qty * rateCombined * 0.75;
    } else {
      // Age >= 45: 100% Postura
      ponedoraNeed = qty * rateAdult;
    }

    return {
      initiator: Math.round(initiatorNeed * 10000) / 10000,
      ponedora: Math.round(ponedoraNeed * 10000) / 10000
    };
  }

  /**
   * Calculates daily feed consumption for the batch in kg.
   * @param {Object} settings Object containing feed rates: feed_consumption_chick and feed_consumption_adult
   * @returns {number} Consumption in kg/day
   */
  getDailyFeedConsumption(settings) {
    const breakdown = this.getDailyFeedConsumptionBreakdown(settings);
    return breakdown.initiator + breakdown.ponedora;
  }

  /**
   * Saves the current instance to the database.
   */
  async save() {
    const db = await getDatabaseConnection();
    if (this.id) {
      await db.run(
        `UPDATE quail_batches 
         SET name = ?, type = ?, initial_quantity = ?, current_quantity = ?, birth_date = ?, status = ?, notes = ?, cage_id = ?
         WHERE id = ?`,
        [this.name, this.type, this.initialQuantity, this.currentQuantity, this.birthDate, this.status, this.notes, this.cageId, this.id]
      );
    } else {
      const result = await db.run(
        `INSERT INTO quail_batches (name, type, initial_quantity, current_quantity, birth_date, status, notes, cage_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [this.name, this.type, this.initialQuantity, this.currentQuantity, this.birthDate, this.status, this.notes, this.cageId]
      );
      this.id = result.lastID;
    }

    // Sincronizar eventos de calendario en cada guardado (creación o edición)
    await this.syncCalendarEvents(db);

    return this;
  }

  /**
   * Sincroniza los eventos automáticos del calendario para el lote de aves.
   * Si el lote es polluelo ('chick') y está activo, genera los hitos de alimentación y postura.
   * Si está inactivo o es adulto, elimina cualquier evento automático asociado.
   * @param {import('sqlite').Database} db 
   */
  async syncCalendarEvents(db) {
    // Eliminar eventos automáticos previos asociados a este lote
    await db.run(`
      DELETE FROM calendar_events 
      WHERE reference_id = ? AND type IN ('feed_transition', 'egg_posture')
    `, [this.id]);

    // Solo se agendan eventos automáticos para lotes de polluelos activos
    if (this.type !== 'chick' || this.status !== 'active') {
      return;
    }

    // Obtener el nombre de la jaula si está asociada
    let cageInfo = '';
    if (this.cageId) {
      const row = await db.get('SELECT name FROM cages WHERE id = ?', [this.cageId]);
      if (row && row.name) {
        cageInfo = ` (Jaula: ${row.name})`;
      }
    }

    const parts = this.birthDate.split('-');
    const birth = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));

    // 1. Inicio de Transición de Alimento: 39 días (Día 1 de transición)
    const transitionStartDate = new Date(birth);
    transitionStartDate.setDate(transitionStartDate.getDate() + 39);
    const transitionStartDateStr = transitionStartDate.toISOString().split('T')[0];

    await db.run(`
      INSERT INTO calendar_events (title, description, event_date, type, reference_id)
      VALUES (?, ?, ?, 'feed_transition', ?)
    `, [
      `Inicio Transición Alimento: ${this.name}${cageInfo}`,
      `Lote ${this.name}${cageInfo} cumple 39 días. Iniciar transición gradual de alimento por 7 días:\n• Día 1-2 (39-40d): 75% Iniciación / 25% Postura\n• Día 3-4 (41-42d): 50% Iniciación / 50% Postura\n• Día 5-6 (43-44d): 25% Iniciación / 75% Postura\n• Día 7 (45d): 100% Postura (Fin de transición).`,
      transitionStartDateStr,
      this.id
    ]);

    // 2. Fin de Transición de Alimento: 45 días (Día 7 de transición)
    const transitionEndDate = new Date(birth);
    transitionEndDate.setDate(transitionEndDate.getDate() + 45);
    const transitionEndDateStr = transitionEndDate.toISOString().split('T')[0];

    await db.run(`
      INSERT INTO calendar_events (title, description, event_date, type, reference_id)
      VALUES (?, ?, ?, 'feed_transition', ?)
    `, [
      `Fin Transición Alimento: ${this.name}${cageInfo}`,
      `Lote ${this.name}${cageInfo} cumple 45 días. Transición completada con éxito. A partir de hoy consume 100% alimento de Postura (Ponedoras).`,
      transitionEndDateStr,
      this.id
    ]);

    // 3. Inicio de postura a las 6 semanas (42 días)
    const postureDate = new Date(birth);
    postureDate.setDate(postureDate.getDate() + 42);
    const postureDateStr = postureDate.toISOString().split('T')[0];

    await db.run(`
      INSERT INTO calendar_events (title, description, event_date, type, reference_id)
      VALUES (?, ?, ?, 'egg_posture', ?)
    `, [
      `Inicio Postura: ${this.name}${cageInfo}`,
      `Lote ${this.name}${cageInfo} cumple 6 semanas. Debería comenzar la postura de huevos.`,
      postureDateStr,
      this.id
    ]);
  }

  /**
   * Records reduction/baja in the batch, decreasing the quantity.
   * @param {number} count Number of quails
   * @param {string} reason Reason of the reduction ('Muerte' | 'Faena')
   * @param {string} userNotes Custom notes
   */
  async recordReduction(count, reason = 'Muerte', userNotes = '') {
    if (count <= 0) return;
    this.currentQuantity = Math.max(0, this.currentQuantity - count);
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    const dateStr = `${day}/${month}/${year}`;
    const detail = userNotes ? ` (${userNotes})` : '';
    const noteStr = `\n[${dateStr}] Baja registrada: ${count} aves. Motivo: ${reason}.${detail}`;
    this.notes += noteStr;
    if (this.currentQuantity === 0) {
      this.status = 'retired';
    }
    await this.save();
  }

  /**
   * Records mortality in the batch, decreasing the quantity.
   * @param {number} count Number of deceased quails
   */
  async recordMortality(count) {
    return this.recordReduction(count, 'Muerte', '');
  }


  // --- STATICS ---

  /**
   * Retrieves a quail batch by ID.
   * @param {number} id 
   * @returns {Promise<QuailBatch|null>}
   */
  static async getById(id) {
    const db = await getDatabaseConnection();
    const row = await db.get(`
      SELECT q.*, c.name as cage_name 
      FROM quail_batches q 
      LEFT JOIN cages c ON q.cage_id = c.id 
      WHERE q.id = ?
    `, [id]);
    return row ? new QuailBatch(row) : null;
  }

  static async getAllActive() {
    const db = await getDatabaseConnection();
    const rows = await db.all(`
      SELECT q.*, c.name as cage_name 
      FROM quail_batches q 
      LEFT JOIN cages c ON q.cage_id = c.id 
      WHERE q.status = 'active' 
      ORDER BY q.birth_date DESC
    `);
    return rows.map(row => new QuailBatch(row));
  }

  static async getAll() {
    const db = await getDatabaseConnection();
    const rows = await db.all(`
      SELECT q.*, c.name as cage_name 
      FROM quail_batches q 
      LEFT JOIN cages c ON q.cage_id = c.id 
      ORDER BY q.birth_date DESC
    `);
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

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      type: this.getAgeInDays() < 45 ? 'chick' : 'adult',
      initialQuantity: this.initialQuantity,
      currentQuantity: this.currentQuantity,
      birthDate: this.birthDate,
      status: this.status,
      notes: this.notes,
      cageId: this.cageId,
      cageName: this.cageName || ''
    };
  }
}
