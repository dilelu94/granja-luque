PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL
    , role TEXT CHECK(role IN ('super_admin', 'admin')) NOT NULL DEFAULT 'admin');
INSERT INTO users VALUES(1,'admin','$2a$10$ZPhoApvb9sIy0Z/uv17I/u6ZfJNw.eJNHdX/pi95RpNavSQqCM8D2','super_admin');
CREATE TABLE settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
INSERT INTO settings VALUES('admin_whatsapp','5491122334455');
INSERT INTO settings VALUES('whatsapp_bot_url','');
INSERT INTO settings VALUES('feed_consumption_adult','0.025');
INSERT INTO settings VALUES('feed_consumption_chick','0.015');
INSERT INTO settings VALUES('egg_base_cost','120.0');
INSERT INTO settings VALUES('shipping_default_cost','1500.0');
INSERT INTO settings VALUES('incubator_capacity','24');
INSERT INTO settings VALUES('hatch_rate','0.70');
INSERT INTO settings VALUES('cage_build_time_days','7');
INSERT INTO settings VALUES('electricity_kwh_cost','60.0');
INSERT INTO settings VALUES('cage_bulb_wattage','100');
INSERT INTO settings VALUES('cage_light_hours','16');
INSERT INTO settings VALUES('cost_fertile_egg','250.0');
INSERT INTO settings VALUES('cost_adult_quail','15000.0');
INSERT INTO settings VALUES('loose_eggs_stock','13');
CREATE TABLE quail_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT CHECK(type IN ('chick', 'adult')) NOT NULL,
      initial_quantity INTEGER NOT NULL,
      current_quantity INTEGER NOT NULL,
      birth_date TEXT NOT NULL,
      status TEXT CHECK(status IN ('active', 'sold', 'retired')) NOT NULL DEFAULT 'active',
      notes TEXT
    , cage_id INTEGER REFERENCES cages(id), females_quantity INTEGER DEFAULT 0, males_quantity INTEGER DEFAULT 0);
CREATE TABLE feed_stock (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT UNIQUE CHECK(type IN ('iniciador', 'ponedora')) NOT NULL,
      quantity REAL NOT NULL DEFAULT 0.0,
      last_updated TEXT NOT NULL
    );
INSERT INTO feed_stock VALUES(1,'iniciador',0.0,'2026-05-30T07:39:10.802Z');
INSERT INTO feed_stock VALUES(2,'ponedora',0.0,'2026-05-30T07:39:10.802Z');
CREATE TABLE egg_production (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT UNIQUE NOT NULL,
      quantity_collected INTEGER NOT NULL DEFAULT 0,
      quantity_broken INTEGER NOT NULL DEFAULT 0,
      notes TEXT
    );
CREATE TABLE products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0,
      category TEXT CHECK(category IN ('eggs', 'processed', 'birds', 'manure', 'other')) NOT NULL DEFAULT 'other',
      image_url TEXT,
      status TEXT CHECK(status IN ('active', 'inactive')) NOT NULL DEFAULT 'active'
    , container_cost REAL NOT NULL DEFAULT 0.0, label_cost REAL NOT NULL DEFAULT 0.0, egg_count INTEGER NOT NULL DEFAULT 0, container_stock INTEGER NOT NULL DEFAULT 0);
INSERT INTO products VALUES(1,'Maple de 30 Huevos de Codorniz','Huevos frescos de codorniz, seleccionados diariamente de nuestra granja.',11250.0,0,'eggs','https://images.unsplash.com/photo-1598965402089-897ce52e8355?q=80&w=400&auto=format&fit=crop','active',150.0,30.0,30,0);
INSERT INTO products VALUES(2,'Paquete de 12 Huevos de Codorniz','Caja plástica de 12 huevos frescos seleccionados.',4500.0,0,'eggs','https://images.unsplash.com/photo-1598965402089-897ce52e8355?q=80&w=400&auto=format&fit=crop','active',80.0,30.0,12,0);
INSERT INTO products VALUES(3,'Paquete de 6 Huevos de Codorniz','Caja plástica de 6 huevos frescos (tamaño degustación).',2500.0,0,'eggs','https://images.unsplash.com/photo-1598965402089-897ce52e8355?q=80&w=400&auto=format&fit=crop','active',60.0,30.0,6,0);
CREATE TABLE orders (
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
    , shipping_zone TEXT, shipping_cost REAL NOT NULL DEFAULT 0.0);
CREATE TABLE order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      price_at_sale REAL NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products (id)
    );
CREATE TABLE calendar_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      event_date TEXT NOT NULL,
      type TEXT CHECK(type IN ('incubator_turn', 'incubator_hatch', 'feed_transition', 'egg_posture', 'vaccine', 'manual')) NOT NULL,
      reference_id INTEGER
    );
CREATE TABLE feed_purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      feed_type TEXT CHECK(feed_type IN ('iniciador', 'ponedora')) NOT NULL,
      quantity_kg REAL NOT NULL,
      price REAL NOT NULL,
      shipping_cost REAL NOT NULL DEFAULT 0.0,
      purchase_date TEXT NOT NULL
    );
CREATE TABLE cages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      capacity INTEGER NOT NULL DEFAULT 50,
      notes TEXT
    );
CREATE TABLE incubations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      eggs_count INTEGER NOT NULL,
      start_date TEXT NOT NULL, -- YYYY-MM-DD HH:MM
      status TEXT CHECK(status IN ('active', 'completed', 'cancelled')) NOT NULL DEFAULT 'active',
      notes TEXT
    );
PRAGMA writable_schema=ON;
CREATE TABLE IF NOT EXISTS sqlite_sequence(name,seq);
DELETE FROM sqlite_sequence;
INSERT INTO sqlite_sequence VALUES('users',1);
INSERT INTO sqlite_sequence VALUES('feed_stock',10);
INSERT INTO sqlite_sequence VALUES('products',3);
PRAGMA writable_schema=OFF;
COMMIT;
