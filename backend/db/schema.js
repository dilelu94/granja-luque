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

  // 2.5. Tabla de Jaulas (Cages)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS cages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      capacity INTEGER NOT NULL DEFAULT 50,
      notes TEXT
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
  await addColumnIfNotExists(db, 'products', 'container_stock', 'INTEGER NOT NULL DEFAULT 0');

  // --- MIGRACIONES PARA LA TABLA USERS (Roles) ---
  await addColumnIfNotExists(db, 'users', 'role', "TEXT CHECK(role IN ('super_admin', 'admin')) NOT NULL DEFAULT 'admin'");

  // --- MIGRACIONES PARA LA TABLA QUAIL_BATCHES (Jaulas) ---
  await addColumnIfNotExists(db, 'quail_batches', 'cage_id', 'INTEGER REFERENCES cages(id)');
  await addColumnIfNotExists(db, 'quail_batches', 'females_quantity', 'INTEGER DEFAULT 0');
  await addColumnIfNotExists(db, 'quail_batches', 'males_quantity', 'INTEGER DEFAULT 0');

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

  // 11. Nueva Tabla de Incubaciones
  await db.exec(`
    CREATE TABLE IF NOT EXISTS incubations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      eggs_count INTEGER NOT NULL,
      start_date TEXT NOT NULL, -- YYYY-MM-DD HH:MM
      status TEXT CHECK(status IN ('active', 'completed', 'cancelled')) NOT NULL DEFAULT 'active',
      notes TEXT
    )
  `);

  // --- POBLACIÓN DE DATOS POR DEFECTO ---

  // Crear usuario administrador por defecto
  const adminUser = process.env.ADMIN_USERNAME || 'admin';
  const adminPass = process.env.ADMIN_PASSWORD || 'adminpass';
  
  const anyUser = await db.get('SELECT id FROM users LIMIT 1');
  if (!anyUser) {
    // Si la tabla de usuarios está completamente vacía (instalación inicial)
    const salt = await bcryptjs.genSalt(10);
    const hashedPassword = await bcryptjs.hash(adminPass, salt);
    await db.run("INSERT INTO users (username, password, role) VALUES (?, ?, 'super_admin')", [adminUser, hashedPassword]);
    console.log(`Usuario administrador por defecto creado: ${adminUser} (super_admin)`);
  } else {
    // Si ya existe el usuario 'admin', asegurar que tenga el rol de 'super_admin'
    const existingAdmin = await db.get('SELECT id FROM users WHERE username = ?', [adminUser]);
    if (existingAdmin) {
      await db.run("UPDATE users SET role = 'super_admin' WHERE username = ?", [adminUser]);
    }
  }

  // Insertar configuraciones iniciales
  const defaultSettings = [
    { key: 'admin_whatsapp', value: '5491122334455' },
    { key: 'whatsapp_bot_url', value: '' },
    { key: 'feed_consumption_adult', value: '0.025' }, // 25 gramos por codorniz adulta
    { key: 'feed_consumption_chick', value: '0.015' },  // 15 gramos por codorniz polluelo
    { key: 'egg_base_cost', value: '120.0' },            // Costo base estimado de producción de un huevo suelto ($120 ARS)
    { key: 'shipping_default_cost', value: '1500.0' },   // Cargo estándar de envío a domicilio
    { key: 'incubator_capacity', value: '24' },
    { key: 'hatch_rate', value: '0.70' },
    { key: 'cage_build_time_days', value: '7' },
    { key: 'electricity_kwh_cost', value: '60.0' },
    { key: 'cage_bulb_wattage', value: '100' },
    { key: 'cage_light_hours', value: '16' },
    { key: 'cost_fertile_egg', value: '250.0' },
    { key: 'cost_adult_quail', value: '15000.0' },
    { key: 'loose_eggs_stock', value: '13' }
  ];

  for (const s of defaultSettings) {
    await db.run('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', [s.key, s.value]);
  }

  // Migración de configuraciones existentes con valores genéricos antiguos
  await db.run("UPDATE settings SET value = '120.0' WHERE key = 'egg_base_cost' AND value = '15.0'");
  await db.run("UPDATE settings SET value = '250.0' WHERE key = 'cost_fertile_egg' AND value = '50.0'");
  await db.run("UPDATE settings SET value = '15000.0' WHERE key = 'cost_adult_quail' AND value = '1200.0'");

  // Parche manual para corregir fecha de postura (de 17/05/2026 a 16/06/2026)
  await db.run("UPDATE egg_production SET date = '2026-06-16' WHERE date = '2026-05-17'");

  // Insertar registros de alimentos por defecto si no existen
  const now = new Date().toISOString();
  await db.run("INSERT OR IGNORE INTO feed_stock (type, quantity, last_updated) VALUES ('iniciador', 0.0, ?)", [now]);
  await db.run("INSERT OR IGNORE INTO feed_stock (type, quantity, last_updated) VALUES ('ponedora', 0.0, ?)", [now]);

  // Insertar productos por defecto si no existen
  const defaultProducts = [
    {
      name: 'Maple de 30 Huevos de Codorniz',
      description: 'Huevos frescos de codorniz, seleccionados diariamente de nuestra granja.',
      price: 11250.0,
      stock: 0,
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
      price: 4500.0,
      stock: 0,
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
      price: 2500.0,
      stock: 0,
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

  // Migración de productos existentes con valores genéricos antiguos
  await db.run("UPDATE products SET price = 11250.0 WHERE name = 'Maple de 30 Huevos de Codorniz' AND price = 1500.0");
  await db.run("UPDATE products SET price = 4500.0 WHERE name = 'Paquete de 12 Huevos de Codorniz' AND price = 700.0");
  await db.run("UPDATE products SET price = 2500.0 WHERE name = 'Paquete de 6 Huevos de Codorniz' AND price = 400.0");
}

