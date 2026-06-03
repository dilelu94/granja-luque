import { getDatabaseConnection } from '../db/connection.js';

export class CalendarEvent {
  constructor(data) {
    this.id = data.id || null;
    this.title = data.title;
    this.description = data.description || '';
    this.eventDate = data.event_date || data.eventDate; // YYYY-MM-DD
    this.type = data.type; // 'incubator_turn' | 'incubator_hatch' | 'feed_transition' | 'egg_posture' | 'vaccine' | 'manual'
    this.referenceId = data.reference_id || data.referenceId || null;
  }

  /**
   * Saves the calendar event.
   */
  async save() {
    const db = await getDatabaseConnection();
    if (this.id) {
      await db.run(
        `UPDATE calendar_events 
         SET title = ?, description = ?, event_date = ?, type = ?, reference_id = ?
         WHERE id = ?`,
        [this.title, this.description, this.eventDate, this.type, this.referenceId, this.id]
      );
    } else {
      const result = await db.run(
        `INSERT INTO calendar_events (title, description, event_date, type, reference_id)
         VALUES (?, ?, ?, ?, ?)`,
        [this.title, this.description, this.eventDate, this.type, this.referenceId]
      );
      this.id = result.lastID;
    }
    return this;
  }

  /**
   * Deletes the calendar event.
   */
  async delete() {
    if (!this.id) return;
    const db = await getDatabaseConnection();
    await db.run('DELETE FROM calendar_events WHERE id = ?', [this.id]);
    this.id = null;
  }

  // --- STATICS ---

  /**
   * Retrieves an event by ID.
   * @param {number} id 
   * @returns {Promise<CalendarEvent|null>}
   */
  static async getById(id) {
    const db = await getDatabaseConnection();
    const row = await db.get('SELECT * FROM calendar_events WHERE id = ?', [id]);
    return row ? new CalendarEvent(row) : null;
  }

  /**
   * Retrieves all calendar events.
   * @returns {Promise<CalendarEvent[]>}
   */
  static async getAll() {
    const db = await getDatabaseConnection();
    const rows = await db.all('SELECT * FROM calendar_events ORDER BY event_date ASC');
    return rows.map(row => new CalendarEvent(row));
  }

  /**
   * Retrieves events within a date range (inclusive).
   * @param {string} startDate YYYY-MM-DD
   * @param {string} endDate YYYY-MM-DD
   * @returns {Promise<CalendarEvent[]>}
   */
  static async getByDateRange(startDate, endDate) {
    const db = await getDatabaseConnection();
    const rows = await db.all(
      `SELECT * FROM calendar_events 
       WHERE date(event_date) >= date(?) AND date(event_date) <= date(?)
       ORDER BY event_date ASC`,
      [startDate, endDate]
    );
    return rows.map(row => new CalendarEvent(row));
  }

  /**
   * Registers an incubator batch, scheduling important turn and hatch dates.
   * @param {number} eggsCount Quantity of eggs put in incubator
   * @param {string} startDateStr Start date (YYYY-MM-DD)
   * @returns {Promise<Object>} Object with created events
   */
  static async registerIncubatorBatch(eggsCount, startDateStr) {
    const start = new Date(startDateStr);
    
    // 1. Detener Volteo: Día 15
    const turnDate = new Date(start);
    turnDate.setDate(turnDate.getDate() + 15);
    const turnDateStr = turnDate.toISOString().split('T')[0];
    
    const turnEvent = new CalendarEvent({
      title: `Detener Volteo (${eggsCount} huevos)`,
      description: `Incubadora iniciada el ${startDateStr}. Es el día 15: detener el volteo manual o automático y preparar bandejas de nacimiento.\n\n💧 Humedad: Es fundamental aumentar la humedad al 70-75% desde el día 15 hasta el nacimiento para facilitar que la membrana no se pegue al pichón y pueda salir con facilidad.\n\n🌡️ Temperatura: Se recomienda bajar ligeramente la temperatura (aprox. 0.5 °C a 1 °C menos que durante la incubación) durante estos últimos días.`,
      eventDate: turnDateStr,
      type: 'incubator_turn'
    });
    await turnEvent.save();

    // 2. Eclosión: Día 16 (Rango 16-18)
    const hatchDate = new Date(start);
    hatchDate.setDate(hatchDate.getDate() + 16);
    const hatchDateStr = hatchDate.toISOString().split('T')[0];
    
    const hatchEvent = new CalendarEvent({
      title: `Eclosión Estimada (${eggsCount} huevos)`,
      description: `Incubadora iniciada el ${startDateStr}. Día 16 a 18: nacimiento estimado de los polluelos de codorniz.`,
      eventDate: hatchDateStr,
      type: 'incubator_hatch'
    });
    await hatchEvent.save();

    return { turnEvent, hatchEvent };
  }
}
