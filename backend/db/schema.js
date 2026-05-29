import bcryptjs from 'bcryptjs';
import { getDatabaseConnection } from './connection.js';

/**
 * Helper to run table alterations safely (ignoring duplicate column errors).
 */
async function addColumnIfNotExists(db, tableName, columnName, columnDefinition) {
  try {
    const tableInfo = await db.all(`PRAGMA table_info(${tableName})`);
    const columnExists = tableInfo.some(col => col.name === columnName);
    
    if (!columnExists) {
      await db.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`);
      console.log(`Columna '${columnName}' agregada exitosamente a la tabla '${tableName}'.`);
    }
  } catch (error) {
    console.error(`Error al verificar/agregar columna '${columnName}' a la tabla '${tableName}':`, error);
  }
}

/**
 * Initializes the database tables and populates default data if not present.
 */
export async function initializeDatabase() {
  const db = await getDatabaseConnection();

  // 1. Tabla de Usuarios Administradores
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL
    )
  `);

  // 2. Tabla de Configuraciones Editables
  await db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  // 3. Tabla de Lotes de Codornices (Aves)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS quail_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT CHECK(type IN ('chick', 'adult')) NOT NULL,
      initial_quantity INTEGER NOT NULL,
      current_quantity INTEGER NOT NULL,
      birth_date TEXT NOT NULL,
      status TEXT CHECK(status IN ('active', 'sold', 'retired')) NOT NULL DEFAULT 'active',
      notes TEXT
    )
  `);

  // 4. Tabla de Stock de Alimento
  await db.exec(`
    CREATE TABLE IF NOT EXISTS feed_stock (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT UNIQUE CHECK(type IN ('iniciador', 'ponedora')) NOT NULL,
      quantity REAL NOT NULL DEFAULT 0.0,
      last_updated TEXT NOT NULL
    )
  `);

  // 5. Tabla de Recolección de Huevos Diaria
  await db.exec(`
    CREATE TABLE IF NOT EXISTS egg_production (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT UNIQUE NOT NULL,
      quantity_collected INTEGER NOT NULL DEFAULT 0,
      quantity_broken INTEGER NOT NULL DEFAULT 0,
      notes TEXT
    )
  `);

  // 6. Tabla de Productos para Venta
  await db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0,
      category TEXT CHECK(category IN ('eggs', 'processed', 'birds', 'manure', 'other')) NOT NULL DEFAULT 'other',
      image_url TEXT,
      status TEXT CHECK(status IN ('active', 'inactive')) NOT NULL DEFAULT 'active'
    )
  `);

  // --- MIGRACIONES PARA LA TABLA PRODUCTS (Desglose de costos) ---
  await addColumnIfNotExists(db, 'products', 'container_cost', 'REAL NOT NULL DEFAULT 0.0');
  await addColumnIfNotExists(db, 'products', 'label_cost', 'REAL NOT NULL DEFAULT 0.0');
  await addColumnIfNotExists(db, 'products', 'egg_count', 'INTEGER NOT NULL DEFAULT 0');

  // 7. Tabla de Pedidos de Venta
  await db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      customer_address TEXT NOT NULL,
      total_price REAL NOT NULL DEFAULT 0.0,
      status TEXT CHECK(status IN ('pending_approval', 'pending_payment', 'paid', 'cancelled')) NOT NULL DEFAULT 'pending_approval',
      mp_preference_id TEXT,
      mp_payment_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  // --- MIGRACIONES PARA LA TABLA ORDERS (Envíos) ---
  await addColumnIfNotExists(db, 'orders', 'shipping_zone', 'TEXT');
  await addColumnIfNotExists(db, 'orders', 'shipping_cost', 'REAL NOT NULL DEFAULT 0.0');

  // 8. Tabla de Detalles del Pedido
  await db.exec(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      price_at_sale REAL NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products (id)
    )
  `);

  // 9. Tabla de Eventos del Calendario
  await db.exec(`
    CREATE TABLE IF NOT EXISTS calendar_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      event_date TEXT NOT NULL,
      type TEXT CHECK(type IN ('incubator_turn', 'incubator_hatch', 'feed_transition', 'egg_posture', 'vaccine', 'manual')) NOT NULL,
      reference_id INTEGER
    )
  `);

  // 10. Nueva Tabla de Historial de Compras de Alimento (Flete y Costo)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS feed_purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      feed_type TEXT CHECK(feed_type IN ('iniciador', 'ponedora')) NOT NULL,
      quantity_kg REAL NOT NULL,
      price REAL NOT NULL,
      shipping_cost REAL NOT NULL DEFAULT 0.0,
      purchase_date TEXT NOT NULL
    )
  `);

  // --- POBLACIÓN DE DATOS POR DEFECTO ---

  // Crear usuario administrador por defecto
  const adminUser = process.env.ADMIN_USERNAME || 'admin';
  const adminPass = process.env.ADMIN_PASSWORD || 'adminpass';
  
  const existingAdmin = await db.get('SELECT id FROM users WHERE username = ?', [adminUser]);
  if (!existingAdmin) {
    const salt = await bcryptjs.genSalt(10);
    const hashedPassword = await bcryptjs.hash(adminPass, salt);
    await db.run('INSERT INTO users (username, password) VALUES (?, ?)', [adminUser, hashedPassword]);
    console.log(`Usuario administrador por defecto creado: ${adminUser}`);
  }

  // Insertar configuraciones iniciales
  const defaultSettings = [
    { key: 'admin_whatsapp', value: '5491122334455' },
    { key: 'whatsapp_bot_url', value: '' },
    { key: 'feed_consumption_adult', value: '0.025' }, // 25 gramos por codorniz adulta
    { key: 'feed_consumption_chick', value: '0.015' },  // 15 gramos por codorniz polluelo
    { key: 'egg_base_cost', value: '15.0' },             // Costo base estimado de producción de un huevo suelto ($15 ARS)
    { key: 'shipping_default_cost', value: '1500.0' }     // Cargo estándar de envío a domicilio
  ];

  for (const s of defaultSettings) {
    await db.run('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', [s.key, s.value]);
  }

  // Insertar registros de alimentos por defecto si no existen
  const now = new Date().toISOString();
  await db.run("INSERT OR IGNORE INTO feed_stock (type, quantity, last_updated) VALUES ('iniciador', 0.0, ?)", [now]);
  await db.run("INSERT OR IGNORE INTO feed_stock (type, quantity, last_updated) VALUES ('ponedora', 0.0, ?)", [now]);

  // Insertar productos por defecto si no existen
  const defaultProducts = [
    {
      name: 'Maple de 30 Huevos de Codorniz',
      description: 'Huevos frescos de codorniz, seleccionados diariamente de nuestra granja.',
      price: 1500.0,
      stock: 50,
      category: 'eggs',
      image_url: 'https://images.unsplash.com/photo-1598965402089-897ce52e8355?q=80&w=400&auto=format&fit=crop',
      status: 'active',
      container_cost: 150.0, // Envase plástico
      label_cost: 30.0,      // Etiqueta impresa
      egg_count: 30
    },
    {
      name: 'Paquete de 12 Huevos de Codorniz',
      description: 'Caja plástica de 12 huevos frescos seleccionados.',
      price: 700.0,
      stock: 30,
      category: 'eggs',
      image_url: 'https://images.unsplash.com/photo-1598965402089-897ce52e8355?q=80&w=400&auto=format&fit=crop',
      status: 'active',
      container_cost: 80.0,
      label_cost: 30.0,
      egg_count: 12
    },
    {
      name: 'Paquete de 6 Huevos de Codorniz',
      description: 'Caja plástica de 6 huevos frescos (tamaño degustación).',
      price: 400.0,
      stock: 20,
      category: 'eggs',
      image_url: 'https://images.unsplash.com/photo-1598965402089-897ce52e8355?q=80&w=400&auto=format&fit=crop',
      status: 'active',
      container_cost: 60.0,
      label_cost: 30.0,
      egg_count: 6
    }
  ];

  for (const p of defaultProducts) {
    const exists = await db.get('SELECT id FROM products WHERE name = ?', [p.name]);
    if (!exists) {
      await db.run(`
        INSERT INTO products (name, description, price, stock, category, image_url, status, container_cost, label_cost, egg_count)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [p.name, p.description, p.price, p.stock, p.category, p.image_url, p.status, p.container_cost, p.label_cost, p.egg_count]);
    }
  }
}
