import express from 'express';
import { QuailBatch } from '../models/QuailBatch.js';
import { FeedStock } from '../models/FeedStock.js';
import { EggCollection } from '../models/EggCollection.js';
import { Settings } from '../models/Settings.js';
import { getDatabaseConnection } from '../db/connection.js';
import { authenticateToken } from './authRoutes.js';

const router = express.Router();

// ==========================================
// 1. PRODUCTOS (PÚBLICO Y ADMIN)
// ==========================================

/**
 * GET /api/inventory/products
 * PUBLIC: List active products for sale in the shop.
 */
router.get('/products', async (req, res) => {
  try {
    const db = await getDatabaseConnection();
    const rows = await db.all("SELECT * FROM products WHERE status = 'active' ORDER BY name ASC");
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener productos públicos:', error);
    res.status(500).json({ error: 'Error al obtener productos.' });
  }
});

/**
 * GET /api/inventory/products/admin
 * ADMIN ONLY: List all products (active & inactive) with full stock details.
 */
router.get('/products/admin', authenticateToken, async (req, res) => {
  try {
    const db = await getDatabaseConnection();
    const rows = await db.all('SELECT * FROM products ORDER BY name ASC');
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener productos admin:', error);
    res.status(500).json({ error: 'Error al obtener productos.' });
  }
});

/**
 * POST /api/inventory/products
 * ADMIN ONLY: Create a new product.
 */
router.post('/products', authenticateToken, async (req, res) => {
  const { name, description, price, stock, category, imageUrl, status, containerCost, labelCost, eggCount } = req.body;

  if (!name || price === undefined || stock === undefined || !category) {
    return res.status(400).json({ error: 'Faltan campos requeridos (nombre, precio, stock, categoría).' });
  }

  try {
    const db = await getDatabaseConnection();
    const result = await db.run(`
      INSERT INTO products (name, description, price, stock, category, image_url, status, container_cost, label_cost, egg_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [name, description, price, stock, category, imageUrl || null, status || 'active', Number(containerCost || 0), Number(labelCost || 0), Number(eggCount || 0)]);
    
    res.status(201).json({ id: result.lastID, message: 'Producto creado con éxito.' });
  } catch (error) {
    console.error('Error al crear producto:', error);
    res.status(500).json({ error: 'Error al crear producto. Puede que el nombre ya exista.' });
  }
});

/**
 * PUT /api/inventory/products/:id
 * ADMIN ONLY: Update product details.
 */
router.put('/products/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { name, description, price, stock, category, imageUrl, status, containerCost, labelCost, eggCount } = req.body;

  try {
    const db = await getDatabaseConnection();
    const product = await db.get('SELECT id FROM products WHERE id = ?', [id]);
    if (!product) {
      return res.status(404).json({ error: 'Producto no encontrado.' });
    }

    await db.run(`
      UPDATE products 
      SET name = ?, description = ?, price = ?, stock = ?, category = ?, image_url = ?, status = ?, container_cost = ?, label_cost = ?, egg_count = ?
      WHERE id = ?
    `, [name, description, price, stock, category, imageUrl, status, Number(containerCost || 0), Number(labelCost || 0), Number(eggCount || 0), id]);

    res.json({ message: 'Producto actualizado con éxito.' });
  } catch (error) {
    console.error('Error al actualizar producto:', error);
    res.status(500).json({ error: 'Error al actualizar producto.' });
  }
});

/**
 * DELETE /api/inventory/products/:id
 * ADMIN ONLY: Delete product.
 */
router.delete('/products/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const db = await getDatabaseConnection();
    // Verificar si el producto tiene dependencias en order_items
    const hasOrders = await db.get('SELECT id FROM order_items WHERE product_id = ? LIMIT 1', [id]);
    
    if (hasOrders) {
      // En lugar de borrarlo físicamente, lo desactivamos para no romper historial de ventas
      await db.run("UPDATE products SET status = 'inactive' WHERE id = ?", [id]);
      return res.json({ message: 'El producto está asociado a pedidos antiguos. Se ha desactivado en su lugar.' });
    }

    await db.run('DELETE FROM products WHERE id = ?', [id]);
    res.json({ message: 'Producto eliminado físicamente con éxito.' });
  } catch (error) {
    console.error('Error al eliminar producto:', error);
    res.status(500).json({ error: 'Error al eliminar producto.' });
  }
});


// ==========================================
// 2. LOTES DE CODORNICES (ADMIN)
// ==========================================

/**
 * GET /api/inventory/quail-batches
 * ADMIN ONLY: Get all quail batches.
 */
router.get('/quail-batches', authenticateToken, async (req, res) => {
  try {
    const batches = await QuailBatch.getAll();
    res.json(batches);
  } catch (error) {
    console.error('Error al obtener lotes de codornices:', error);
    res.status(500).json({ error: 'Error al obtener lotes de codornices.' });
  }
});

/**
 * POST /api/inventory/quail-batches
 * ADMIN ONLY: Create a new quail batch.
 */
router.post('/quail-batches', authenticateToken, async (req, res) => {
  const { name, type, initialQuantity, birthDate, notes } = req.body;

  if (!name || !type || !initialQuantity || !birthDate) {
    return res.status(400).json({ error: 'Campos obligatorios faltantes (nombre, tipo, cantidad inicial, fecha de nacimiento).' });
  }

  try {
    const batch = new QuailBatch({
      name,
      type,
      initialQuantity: Number(initialQuantity),
      currentQuantity: Number(initialQuantity),
      birthDate,
      notes,
      status: 'active'
    });
    
    await batch.save();
    res.status(201).json({ message: 'Lote de codornices creado con éxito.', batch });
  } catch (error) {
    console.error('Error al crear lote:', error);
    res.status(500).json({ error: 'Error al crear lote de codornices.' });
  }
});

/**
 * POST /api/inventory/quail-batches/:id/mortality
 * ADMIN ONLY: Log quails mortality or reduction.
 */
router.post('/quail-batches/:id/mortality', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { count, reason, notes } = req.body;

  if (count === undefined || Number(count) <= 0) {
    return res.status(400).json({ error: 'Cantidad de bajas debe ser mayor a 0.' });
  }

  try {
    const batch = await QuailBatch.getById(id);
    if (!batch) {
      return res.status(404).json({ error: 'Lote no encontrado.' });
    }

    await batch.recordReduction(Number(count), reason || 'Muerte', notes || '');
    res.json({ message: 'Bajas registradas con éxito.', batch });
  } catch (error) {
    console.error('Error al registrar bajas:', error);
    res.status(500).json({ error: 'Error al registrar bajas.' });
  }
});

/**
 * PUT /api/inventory/quail-batches/:id
 * ADMIN ONLY: Edit batch details.
 */
router.put('/quail-batches/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { name, type, initialQuantity, currentQuantity, birthDate, status, notes } = req.body;

  try {
    const batch = await QuailBatch.getById(id);
    if (!batch) {
      return res.status(404).json({ error: 'Lote no encontrado.' });
    }

    batch.name = name !== undefined ? name : batch.name;
    batch.type = type !== undefined ? type : batch.type;
    batch.initialQuantity = initialQuantity !== undefined ? Number(initialQuantity) : batch.initialQuantity;
    batch.currentQuantity = currentQuantity !== undefined ? Number(currentQuantity) : batch.currentQuantity;
    batch.birthDate = birthDate !== undefined ? birthDate : batch.birthDate;
    batch.status = status !== undefined ? status : batch.status;
    batch.notes = notes !== undefined ? notes : batch.notes;

    if (batch.currentQuantity === 0) {
      batch.status = 'retired';
    }

    await batch.save();
    res.json({ message: 'Lote actualizado con éxito.', batch });
  } catch (error) {
    console.error('Error al actualizar lote:', error);
    res.status(500).json({ error: 'Error al actualizar lote.' });
  }
});


// ==========================================
// 3. ALIMENTO / FEED (ADMIN)
// ==========================================

/**
 * GET /api/inventory/feed
 * ADMIN ONLY: Get feed stocks and depletion forecasts, with automatic consumption deduction.
 */
router.get('/feed', authenticateToken, async (req, res) => {
  try {
    const settings = await Settings.getAll();
    await FeedStock.deductAutomaticConsumption(settings); // Descontar consumo automáticamente
    const estimates = await FeedStock.calculateEstimates(settings);
    res.json(estimates);
  } catch (error) {
    console.error('Error al obtener stock de alimentos:', error);
    res.status(500).json({ error: 'Error al calcular estimación de alimento.' });
  }
});

/**
 * GET /api/inventory/feed/purchases
 * ADMIN ONLY: Get recent feed purchases.
 */
router.get('/feed/purchases', authenticateToken, async (req, res) => {
  try {
    const db = await getDatabaseConnection();
    const rows = await db.all('SELECT * FROM feed_purchases ORDER BY purchase_date DESC, id DESC LIMIT 20');
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener compras de alimento:', error);
    res.status(500).json({ error: 'Error al obtener historial de compras.' });
  }
});

/**
 * POST /api/inventory/feed/buy
 * ADMIN ONLY: Register feed purchase (adds stock).
 */
router.post('/feed/buy', authenticateToken, async (req, res) => {
  const { type, quantity, price, shippingCost, purchaseDate } = req.body;

  if (!type || quantity === undefined || Number(quantity) <= 0) {
    return res.status(400).json({ error: 'Faltan campos (tipo de alimento: iniciador/ponedora, cantidad en kg > 0).' });
  }

  try {
    const feed = await FeedStock.getByType(type);
    await feed.addStock(Number(quantity), Number(price || 0.0), Number(shippingCost || 0.0), purchaseDate);
    res.json({ message: `Compra registrada: +${quantity} kg de alimento ${type}.`, stock: feed.quantity });
  } catch (error) {
    console.error('Error al registrar compra de alimento:', error);
    res.status(500).json({ error: 'Error al registrar compra.' });
  }
});

/**
 * POST /api/inventory/feed/consume
 * ADMIN ONLY: Register manual feed adjustment (reduces stock).
 */
router.post('/feed/consume', authenticateToken, async (req, res) => {
  const { type, quantity } = req.body;

  if (!type || quantity === undefined || Number(quantity) <= 0) {
    return res.status(400).json({ error: 'Faltan campos (tipo de alimento: iniciador/ponedora, cantidad en kg > 0).' });
  }

  try {
    const feed = await FeedStock.getByType(type);
    await feed.consumeStock(Number(quantity));
    res.json({ message: `Consumo registrado: -${quantity} kg de alimento ${type}.`, stock: feed.quantity });
  } catch (error) {
    console.error('Error al registrar consumo de alimento:', error);
    res.status(500).json({ error: 'Error al registrar consumo.' });
  }
});


// ==========================================
// 4. HUEVOS / EGGS (ADMIN)
// ==========================================

/**
 * GET /api/inventory/eggs
 * ADMIN ONLY: Get egg collection logs and daily posture rate statistics.
 */
router.get('/eggs', authenticateToken, async (req, res) => {
  const limit = req.query.limit ? Number(req.query.limit) : 14;
  try {
    const stats = await EggCollection.getStats(limit);
    
    // Obtener total acumulado de huevos recolectados en toda la historia
    const db = await getDatabaseConnection();
    const sumRow = await db.get('SELECT SUM(quantity_collected) as totalCollected, SUM(quantity_broken) as totalBroken FROM egg_production');
    
    res.json({
      history: stats,
      totals: {
        collected: sumRow ? (sumRow.totalCollected || 0) : 0,
        broken: sumRow ? (sumRow.totalBroken || 0) : 0
      }
    });
  } catch (error) {
    console.error('Error al obtener recolecciones de huevos:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas de postura.' });
  }
});

/**
 * POST /api/inventory/eggs/collect
 * ADMIN ONLY: Log daily egg collection.
 */
router.post('/eggs/collect', authenticateToken, async (req, res) => {
  const { date, quantityCollected, quantityBroken, notes } = req.body;

  if (!date || quantityCollected === undefined) {
    return res.status(400).json({ error: 'Faltan campos requeridos (fecha y cantidad recolectada).' });
  }

  try {
    const collection = new EggCollection({
      date,
      quantityCollected: Number(quantityCollected),
      quantityBroken: Number(quantityBroken || 0),
      notes
    });

    await collection.save();
    res.status(201).json({ message: 'Recolección de huevos registrada.', collection });
  } catch (error) {
    console.error('Error al registrar huevos:', error);
    res.status(500).json({ error: 'Error al registrar huevos recogidos.' });
  }
});

/**
 * POST /api/inventory/eggs/pack
 * ADMIN ONLY: Pack collected eggs into products (adds stock to a product).
 */
router.post('/eggs/pack', authenticateToken, async (req, res) => {
  const { productId, packagesCount, eggsPerPackage } = req.body;

  if (!productId || !packagesCount || !eggsPerPackage) {
    return res.status(400).json({ error: 'Faltan parámetros (producto, cantidad de empaques, huevos por empaque).' });
  }

  try {
    await EggCollection.packEggs(Number(productId), Number(packagesCount), Number(eggsPerPackage));
    res.json({ message: `Empacado completado. Se añadieron ${packagesCount} unidades al stock del producto.` });
  } catch (error) {
    console.error('Error al empaquetar huevos:', error);
    res.status(500).json({ error: 'Error al actualizar el stock del producto.' });
  }
});

export default router;
