import { getDatabaseConnection } from '../db/connection.js';

export class Settings {
  /**
   * Retrieves the value of a specific setting key.
   * @param {string} key 
   * @returns {Promise<string|null>}
   */
  static async get(key) {
    const db = await getDatabaseConnection();
    const row = await db.get('SELECT value FROM settings WHERE key = ?', [key]);
    return row ? row.value : null;
  }

  /**
   * Updates or inserts a setting key-value pair.
   * @param {string} key 
   * @param {string} value 
   */
  static async set(key, value) {
    const db = await getDatabaseConnection();
    await db.run(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      [key, String(value)]
    );
  }

  /**
   * Retrieves all settings as a key-value object.
   * @returns {Promise<Object>}
   */
  static async getAll() {
    const db = await getDatabaseConnection();
    const rows = await db.all('SELECT key, value FROM settings');
    const settingsObj = {};
    rows.forEach(row => {
      settingsObj[row.key] = row.value;
    });
    return settingsObj;
  }
}
