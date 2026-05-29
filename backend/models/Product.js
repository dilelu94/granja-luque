import { getDatabaseConnection } from '../db/connection.js';

export class Product {
  constructor(data) {
    this.id = data.id || null;
    this.name = data.name;
    this.description = data.description || '';
    this.price = data.price;
    this.stock = data.stock || 0;
    this.category = data.category || 'other';
    this.imageUrl = data.image_url || data.imageUrl || '';
    this.status = data.status || 'active';
    
    // Desglose de Costos (Nuevos campos)
    this.containerCost = data.container_cost !== undefined ? data.container_cost : (data.containerCost || 0.0);
    this.labelCost = data.label_cost !== undefined ? data.label_cost : (data.labelCost || 0.0);
    this.eggCount = data.egg_count !== undefined ? data.egg_count : (data.eggCount || 0);
  }

  /**
   * Calculates total production cost of the product.
   * @param {number} eggUnitCost Cost of a single egg
   * @returns {number}
   */
  getTotalCost(eggUnitCost = 0) {
    const rawCost = Number(this.eggCount) * Number(eggUnitCost);
    return Number(this.containerCost) + Number(this.labelCost) + rawCost;
  }

  /**
   * Calculates net profit margin for a single sale.
   * @param {number} eggUnitCost Cost of a single egg
   * @returns {number}
   */
  getProfitMargin(eggUnitCost = 0) {
    return Number(this.price) - this.getTotalCost(eggUnitCost);
  }

  /**
   * Saves product changes (including cost parameters) to the database.
   */
  async save() {
    const db = await getDatabaseConnection();
    if (this.id) {
      await db.run(
        `UPDATE products 
         SET name = ?, description = ?, price = ?, stock = ?, category = ?, image_url = ?, status = ?, container_cost = ?, label_cost = ?, egg_count = ?
         WHERE id = ?`,
        [this.name, this.description, this.price, this.stock, this.category, this.imageUrl, this.status, this.containerCost, this.labelCost, this.eggCount, this.id]
      );
    } else {
      const result = await db.run(
        `INSERT INTO products (name, description, price, stock, category, image_url, status, container_cost, label_cost, egg_count)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [this.name, this.description, this.price, this.stock, this.category, this.imageUrl, this.status, this.containerCost, this.labelCost, this.eggCount]
      );
      this.id = result.lastID;
    }
    return this;
  }

  // --- STATICS ---

  /**
   * Gets a product by ID.
   * @param {number} id 
   * @returns {Promise<Product|null>}
   */
  static async getById(id) {
    const db = await getDatabaseConnection();
    const row = await db.get('SELECT * FROM products WHERE id = ?', [id]);
    return row ? new Product(row) : null;
  }

  /**
   * Gets all products.
   * @returns {Promise<Product[]>}
   */
  static async getAll() {
    const db = await getDatabaseConnection();
    const rows = await db.all('SELECT * FROM products ORDER BY name ASC');
    return rows.map(row => new Product(row));
  }
}
