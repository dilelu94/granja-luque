import { getDatabaseConnection } from '../db/connection.js';
import bcryptjs from 'bcryptjs';

export class User {
  constructor({ id, username, password, role }) {
    this.id = id;
    this.username = username;
    this.password = password;
    this.role = role || 'admin';
  }

  /**
   * Finds a user by ID.
   * @param {number} id 
   * @returns {Promise<User|null>}
   */
  static async findById(id) {
    const db = await getDatabaseConnection();
    const row = await db.get('SELECT * FROM users WHERE id = ?', [id]);
    return row ? new User(row) : null;
  }

  /**
   * Finds a user by username.
   * @param {string} username 
   * @returns {Promise<User|null>}
   */
  static async findByUsername(username) {
    const db = await getDatabaseConnection();
    const row = await db.get('SELECT * FROM users WHERE username = ?', [username]);
    return row ? new User(row) : null;
  }

  /**
   * Lists all users in the system.
   * @returns {Promise<User[]>}
   */
  static async listAll() {
    const db = await getDatabaseConnection();
    const rows = await db.all('SELECT id, username, role FROM users');
    return rows.map(row => new User(row));
  }

  /**
   * Saves the user (inserts or updates).
   * @returns {Promise<User>}
   */
  async save() {
    const db = await getDatabaseConnection();
    if (this.id) {
      await db.run(
        'UPDATE users SET username = ?, password = ?, role = ? WHERE id = ?',
        [this.username, this.password, this.role, this.id]
      );
    } else {
      const result = await db.run(
        'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
        [this.username, this.password, this.role]
      );
      this.id = result.lastID;
    }
    return this;
  }

  /**
   * Hashes and updates the user's password.
   * @param {string} newPassword 
   */
  async changePassword(newPassword) {
    const salt = await bcryptjs.genSalt(10);
    this.password = await bcryptjs.hash(newPassword, salt);
    await this.save();
  }

  /**
   * Deletes a user by ID.
   * @param {number} id 
   */
  static async delete(id) {
    const db = await getDatabaseConnection();
    await db.run('DELETE FROM users WHERE id = ?', [id]);
  }
}
