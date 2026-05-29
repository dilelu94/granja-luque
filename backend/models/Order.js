import { MercadoPagoConfig, Preference } from 'mercadopago';
import { getDatabaseConnection } from '../db/connection.js';

export class Order {
  constructor(data) {
    this.id = data.id || null;
    this.customerName = data.customer_name || data.customerName;
    this.customerPhone = data.customer_phone || data.customerPhone;
    this.customerAddress = data.customer_address || data.customerAddress;
    this.totalPrice = data.total_price || data.totalPrice || 0.0;
    this.status = data.status || 'pending_approval'; // 'pending_approval' | 'pending_payment' | 'paid' | 'cancelled'
    this.mpPreferenceId = data.mp_preference_id || data.mpPreferenceId || null;
    this.mpPaymentId = data.mp_payment_id || data.mpPaymentId || null;
    this.createdAt = data.created_at || data.createdAt || new Date().toISOString();
    this.updatedAt = data.updated_at || data.updatedAt || new Date().toISOString();
    this.items = data.items || []; // Array de { id, product_id, name, quantity, price_at_sale }
    
    // Nuevos campos para envíos y flete
    this.shippingZone = data.shipping_zone || data.shippingZone || '';
    this.shippingCost = data.shipping_cost !== undefined ? Number(data.shipping_cost) : (Number(data.shippingCost) || 0.0);
  }

  /**
   * Saves the order metadata (does not save items).
   */
  async save() {
    const db = await getDatabaseConnection();
    this.updatedAt = new Date().toISOString();
    
    if (this.id) {
      await db.run(
        `UPDATE orders 
         SET customer_name = ?, customer_phone = ?, customer_address = ?, total_price = ?, status = ?, mp_preference_id = ?, mp_payment_id = ?, updated_at = ?, shipping_zone = ?, shipping_cost = ?
         WHERE id = ?`,
        [this.customerName, this.customerPhone, this.customerAddress, this.totalPrice, this.status, this.mpPreferenceId, this.mpPaymentId, this.updatedAt, this.shippingZone, this.shippingCost, this.id]
      );
    } else {
      const result = await db.run(
        `INSERT INTO orders (customer_name, customer_phone, customer_address, total_price, status, mp_preference_id, mp_payment_id, created_at, updated_at, shipping_zone, shipping_cost)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [this.customerName, this.customerPhone, this.customerAddress, this.totalPrice, this.status, this.mpPreferenceId, this.mpPaymentId, this.createdAt, this.updatedAt, this.shippingZone, this.shippingCost]
      );
      this.id = result.lastID;
    }
    return this;
  }

  /**
   * Adds an item to the order list in memory (not database).
   */
  addItem(productId, name, quantity, priceAtSale) {
    this.items.push({
      product_id: productId,
      name,
      quantity,
      price_at_sale: priceAtSale
    });
    this.totalPrice += priceAtSale * quantity;
  }

  /**
   * Saves order items to database (should be called on creation).
   */
  async saveItems() {
    if (!this.id) throw new Error('Order must be saved before saving items.');
    const db = await getDatabaseConnection();
    for (const item of this.items) {
      await db.run(
        `INSERT INTO order_items (order_id, product_id, quantity, price_at_sale)
         VALUES (?, ?, ?, ?)`,
        [this.id, item.product_id, item.quantity, item.price_at_sale]
      );
    }
  }

  /**
   * Updates order status and handles inventory adjustments if status changes to 'paid'.
   * @param {string} newStatus 
   */
  async updateStatus(newStatus) {
    const oldStatus = this.status;
    if (oldStatus === newStatus) return;

    this.status = newStatus;
    await this.save();

    // Si el pedido pasa a pagado, descontamos el stock de productos
    if (newStatus === 'paid' && oldStatus !== 'paid') {
      await this.deductInventory();
    }
    // Si se cancela un pedido que ya estaba pagado, reponer el stock
    else if (newStatus === 'cancelled' && oldStatus === 'paid') {
      await this.restoreInventory();
    }
  }

  /**
   * Deducts items from products stock.
   */
  async deductInventory() {
    const db = await getDatabaseConnection();
    for (const item of this.items) {
      await db.run(
        'UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?',
        [item.quantity, item.product_id]
      );
    }
  }

  /**
   * Restores items to products stock.
   */
  async restoreInventory() {
    const db = await getDatabaseConnection();
    for (const item of this.items) {
      await db.run(
        'UPDATE products SET stock = stock + ? WHERE id = ?',
        [item.quantity, item.product_id]
      );
    }
  }

  /**
   * Generates a Mercado Pago payment link for this order.
   * @param {string} mpAccessToken 
   * @param {string} webhookUrl 
   * @returns {Promise<string>} Preference init_point (payment link)
   */
  async approveAndGeneratePreference(mpAccessToken, webhookUrl) {
    if (!mpAccessToken) {
      throw new Error('Access Token de Mercado Pago no provisto.');
    }

    const client = new MercadoPagoConfig({ accessToken: mpAccessToken });
    const preference = new Preference(client);

    // Formatear items para Mercado Pago
    const mpItems = this.items.map(item => ({
      id: String(item.product_id),
      title: item.name,
      quantity: Number(item.quantity),
      unit_price: Number(item.price_at_sale),
      currency_id: 'ARS'
    }));

    // Si hay un costo de envío, lo agregamos como un item para cobrarlo mediante MP
    if (Number(this.shippingCost) > 0) {
      mpItems.push({
        id: 'shipping-fee',
        title: `Costo de Envío: ${this.shippingZone}`,
        quantity: 1,
        unit_price: Number(this.shippingCost),
        currency_id: 'ARS'
      });
    }

    const preferenceBody = {
      items: mpItems,
      back_urls: {
        success: `${webhookUrl.split('/api/')[0]}/?payment=success&orderId=${this.id}`,
        failure: `${webhookUrl.split('/api/')[0]}/?payment=failure&orderId=${this.id}`,
        pending: `${webhookUrl.split('/api/')[0]}/?payment=pending&orderId=${this.id}`
      },
      auto_return: 'approved',
      notification_url: webhookUrl,
      external_reference: String(this.id)
    };

    const response = await preference.create({ body: preferenceBody });
    
    this.mpPreferenceId = response.id;
    this.status = 'pending_payment';
    await this.save();

    return response.init_point;
  }

  // --- STATICS ---

  /**
   * Creates an order with items and shipping parameters.
   * @param {Object} orderData { customerName, customerPhone, customerAddress, shippingZone, shippingCost, items: [{product_id, name, quantity, price_at_sale}] }
   * @returns {Promise<Order>}
   */
  static async createOrder(orderData) {
    const order = new Order({
      customerName: orderData.customerName,
      customerPhone: orderData.customerPhone,
      customerAddress: orderData.customerAddress,
      shippingZone: orderData.shippingZone || '',
      shippingCost: orderData.shippingCost !== undefined ? Number(orderData.shippingCost) : 0.0,
      status: 'pending_approval'
    });

    order.items = orderData.items;
    
    // Calcular el total: suma de items + costo de envío
    const productsTotal = order.items.reduce((sum, item) => sum + (item.price_at_sale * item.quantity), 0);
    order.totalPrice = productsTotal + Number(order.shippingCost);

    await order.save();
    await order.saveItems();
    return order;
  }

  /**
   * Gets an order by ID, including items.
   * @param {number} id 
   * @returns {Promise<Order|null>}
   */
  static async getById(id) {
    const db = await getDatabaseConnection();
    const orderRow = await db.get('SELECT * FROM orders WHERE id = ?', [id]);
    if (!orderRow) return null;

    const items = await db.all(`
      SELECT oi.*, p.name 
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `, [id]);

    const order = new Order(orderRow);
    order.items = items;
    return order;
  }

  /**
   * Gets all orders.
   * @returns {Promise<Order[]>}
   */
  static async getAll() {
    const db = await getDatabaseConnection();
    const orderRows = await db.all('SELECT * FROM orders ORDER BY created_at DESC');
    
    const orders = [];
    for (const row of orderRows) {
      const items = await db.all(`
        SELECT oi.*, p.name 
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = ?
      `, [row.id]);
      
      const order = new Order(row);
      order.items = items;
      orders.push(order);
    }
    return orders;
  }
}
