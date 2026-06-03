import { getDatabaseConnection } from '../db/connection.js';

const addDays = (dateTimeStr, days) => {
  // dateTimeStr is in YYYY-MM-DD HH:MM format
  const parts = dateTimeStr.split(' ');
  const dateParts = parts[0].split('-');
  const timeParts = parts[1] ? parts[1].split(':') : ['00', '00'];
  
  const d = new Date(
    Number(dateParts[0]),
    Number(dateParts[1]) - 1,
    Number(dateParts[2]),
    Number(timeParts[0]),
    Number(timeParts[1])
  );
  d.setDate(d.getDate() + days);
  
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  
  return {
    dateOnly: `${yyyy}-${mm}-${dd}`,
    dateTime: `${yyyy}-${mm}-${dd} ${hh}:${min}`
  };
};

const formatDateTime = (dtStr) => {
  if (!dtStr) return '';
  const parts = dtStr.split(' ');
  const dateParts = parts[0].split('-');
  const timeStr = parts[1] || '00:00';
  return `${dateParts[2]}/${dateParts[1]}/${dateParts[0]} ${timeStr}`;
};

export class Incubation {
  constructor(data) {
    this.id = data.id || null;
    this.eggsCount = data.eggs_count || data.eggsCount;
    this.startDate = data.start_date || data.startDate; // YYYY-MM-DD HH:MM
    this.status = data.status || 'active'; // 'active', 'completed', 'cancelled'
    this.notes = data.notes || '';
  }

  async save() {
    const db = await getDatabaseConnection();
    
    // Asegurar formato limpio (reemplazar T con espacio si viene de datetime-local)
    if (this.startDate) {
      this.startDate = this.startDate.replace('T', ' ');
    }

    if (this.id) {
      await db.run(
        `UPDATE incubations 
         SET eggs_count = ?, start_date = ?, status = ?, notes = ?
         WHERE id = ?`,
        [this.eggsCount, this.startDate, this.status, this.notes, this.id]
      );
    } else {
      const result = await db.run(
        `INSERT INTO incubations (eggs_count, start_date, status, notes)
         VALUES (?, ?, ?, ?)`,
        [this.eggsCount, this.startDate, this.status, this.notes]
      );
      this.id = result.lastID;
    }

    // Sincronizar los eventos del calendario
    await this.syncCalendarEvents(db);

    return this;
  }

  async delete() {
    if (!this.id) return;
    const db = await getDatabaseConnection();
    await db.run('DELETE FROM calendar_events WHERE reference_id = ? AND type IN ("incubator_turn", "incubator_hatch", "manual")', [this.id]);
    await db.run('DELETE FROM incubations WHERE id = ?', [this.id]);
    this.id = null;
  }

  async syncCalendarEvents(db) {
    // Eliminar eventos previos asociados
    await db.run('DELETE FROM calendar_events WHERE reference_id = ? AND type IN ("incubator_turn", "incubator_hatch", "manual")', [this.id]);

    if (this.status !== 'active') {
      return; // Solo se muestran alertas para incubaciones activas
    }

    // 1. Ovoscopia: Día 7 a las 20:00 (horario razonable siempre)
    const ovoscopiaDate = addDays(this.startDate, 7);
    await db.run(
      `INSERT INTO calendar_events (title, description, event_date, type, reference_id)
       VALUES (?, ?, ?, 'manual', ?)`,
      [
        `Ovoscopia (${this.eggsCount} huevos)`,
        `Incubación iniciada el ${formatDateTime(this.startDate)}. Día 7: realizar la ovoscopia (descarte de huevos no fértiles).`,
        `${ovoscopiaDate.dateOnly} 20:00`,
        this.id
      ]
    );

    // 2. Detener Volteo: Día 15 a la hora exacta de inicio de la incubación
    const turnDate = addDays(this.startDate, 15);
    await db.run(
      `INSERT INTO calendar_events (title, description, event_date, type, reference_id)
       VALUES (?, ?, ?, 'incubator_turn', ?)`,
      [
        `Detener Volteo (${this.eggsCount} huevos)`,
        `Incubación iniciada el ${formatDateTime(this.startDate)}. Se cumplen 15 días: detener el volteo manual o automático.\n\n💧 Humedad: Es fundamental aumentar la humedad al 70-75% desde el día 15 hasta el nacimiento para facilitar que la membrana no se pegue al pichón y pueda salir con facilidad.\n\n🌡️ Temperatura: Se recomienda bajar ligeramente la temperatura (aprox. 0.5 °C a 1 °C menos que durante la incubación) durante estos últimos días.`,
        turnDate.dateTime,
        this.id
      ]
    );

    // 3. Eclosión: Día 17 a la hora exacta de inicio de la incubación
    const hatchDate = addDays(this.startDate, 17);
    await db.run(
      `INSERT INTO calendar_events (title, description, event_date, type, reference_id)
       VALUES (?, ?, ?, 'incubator_hatch', ?)`,
      [
        `Eclosión Estimada (${this.eggsCount} huevos)`,
        `Incubación iniciada el ${formatDateTime(this.startDate)}. Día 17/18: nacimiento estimado de los polluelos.`,
        hatchDate.dateTime,
        this.id
      ]
    );
  }

  // --- STATICS ---

  static async getById(id) {
    const db = await getDatabaseConnection();
    const row = await db.get('SELECT * FROM incubations WHERE id = ?', [id]);
    return row ? new Incubation(row) : null;
  }

  static async getAll() {
    const db = await getDatabaseConnection();
    const rows = await db.all('SELECT * FROM incubations ORDER BY start_date DESC');
    return rows.map(row => new Incubation(row));
  }

  static async getActive() {
    const db = await getDatabaseConnection();
    const rows = await db.all("SELECT * FROM incubations WHERE status = 'active' ORDER BY start_date DESC");
    return rows.map(row => new Incubation(row));
  }
}
