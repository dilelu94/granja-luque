import { getDatabaseConnection } from '../db/connection.js';

export class Cage {
  constructor(data) {
    this.id = data.id || null;
    this.name = data.name;
    this.capacity = data.capacity !== undefined ? data.capacity : 50;
    this.notes = data.notes || '';
  }

  /**
   * Saves the cage (insert or update).
   */
  async save() {
    const db = await getDatabaseConnection();
    if (this.id) {
      const oldCage = await Cage.getById(this.id);
      
      await db.run(
        `UPDATE cages 
         SET name = ?, capacity = ?, notes = ?
         WHERE id = ?`,
        [this.name, this.capacity, this.notes, this.id]
      );

      // Si cambió el nombre de la jaula, sincronizar eventos de calendario de sus lotes
      if (oldCage && oldCage.name !== this.name) {
        const { QuailBatch } = await import('./QuailBatch.js');
        const batches = await db.all('SELECT id FROM quail_batches WHERE cage_id = ?', [this.id]);
        for (const row of batches) {
          const batch = await QuailBatch.getById(row.id);
          if (batch) {
            await batch.syncCalendarEvents(db);
          }
        }
      }
    } else {
      const result = await db.run(
        `INSERT INTO cages (name, capacity, notes)
         VALUES (?, ?, ?)`,
        [this.name, this.capacity, this.notes]
      );
      this.id = result.lastID;
    }
    return this;
  }

  /**
   * Deletes the cage, setting cage_id to NULL on any associated quail batches.
   */
  async delete() {
    if (!this.id) return;
    const db = await getDatabaseConnection();
    // Desvincular lotes de codornices asociados
    await db.run('UPDATE quail_batches SET cage_id = NULL WHERE cage_id = ?', [this.id]);
    // Eliminar la jaula
    await db.run('DELETE FROM cages WHERE id = ?', [this.id]);
    this.id = null;
  }

  // --- STATICS ---

  static async getById(id) {
    const db = await getDatabaseConnection();
    const row = await db.get('SELECT * FROM cages WHERE id = ?', [id]);
    return row ? new Cage(row) : null;
  }

  static async getByName(name) {
    const db = await getDatabaseConnection();
    const row = await db.get('SELECT * FROM cages WHERE name = ?', [name]);
    return row ? new Cage(row) : null;
  }

  static async getAll() {
    const db = await getDatabaseConnection();
    const rows = await db.all('SELECT * FROM cages ORDER BY name ASC');
    return rows.map(row => new Cage(row));
  }

  /**
   * Returns cages with their active bird count occupancy.
   */
  static async getCagesOccupancy() {
    const db = await getDatabaseConnection();
    const rows = await db.all(`
      SELECT c.id, c.name, c.capacity, c.notes,
             COALESCE(SUM(CASE WHEN q.status = 'active' THEN q.current_quantity ELSE 0 END), 0) as current_occupancy
      FROM cages c
      LEFT JOIN quail_batches q ON q.cage_id = c.id
      GROUP BY c.id
      ORDER BY c.name ASC
    `);
    return rows;
  }
}
