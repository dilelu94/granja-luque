import express from 'express';
import { getDatabaseConnection } from '../db/connection.js';
import { authenticateToken } from './authRoutes.js';

const router = express.Router();

/**
 * GET /api/inventory/projections/base-data
 * Returns database metrics needed for the projections calculator.
 */
router.get('/base-data', authenticateToken, async (req, res) => {
  try {
    const db = await getDatabaseConnection();

    // 1. Obtener cantidad de codornices adultas activas
    const quailsRow = await db.get(`
      SELECT SUM(current_quantity) as total,
             SUM(females_quantity) as total_females,
             SUM(males_quantity) as total_males
      FROM quail_batches 
      WHERE status = 'active' AND type = 'adult'
    `);
    const activeAdultQuails = quailsRow && quailsRow.total ? quailsRow.total : 0;
    const activeAdultFemales = quailsRow && quailsRow.total_females ? quailsRow.total_females : 0;
    const activeAdultMales = quailsRow && quailsRow.total_males ? quailsRow.total_males : 0;

    // 2. Obtener costo de última compra de alimento Ponedora
    const lastPonedoraPurchase = await db.get(`
      SELECT price, quantity_kg, shipping_cost 
      FROM feed_purchases 
      WHERE feed_type = 'ponedora' 
      ORDER BY purchase_date DESC, id DESC 
      LIMIT 1
    `);
    
    let feedCostPonedoraPerKg = 1360.0; // valor por defecto ($24000 + $10000 flete) / 25kg
    if (lastPonedoraPurchase && lastPonedoraPurchase.quantity_kg > 0) {
      feedCostPonedoraPerKg = (lastPonedoraPurchase.price + lastPonedoraPurchase.shipping_cost) / lastPonedoraPurchase.quantity_kg;
    }

    // 3. Obtener costo de última compra de alimento Iniciador
    const lastIniciadorPurchase = await db.get(`
      SELECT price, quantity_kg, shipping_cost 
      FROM feed_purchases 
      WHERE feed_type = 'iniciador' 
      ORDER BY purchase_date DESC, id DESC 
      LIMIT 1
    `);
    
    let feedCostIniciadorPerKg = 1480.0; // valor por defecto ($27000 + $10000 flete) / 25kg
    if (lastIniciadorPurchase && lastIniciadorPurchase.quantity_kg > 0) {
      feedCostIniciadorPerKg = (lastIniciadorPurchase.price + lastIniciadorPurchase.shipping_cost) / lastIniciadorPurchase.quantity_kg;
    }

    // 4. Obtener todas las configuraciones
    const settingsRows = await db.all('SELECT key, value FROM settings');
    const settings = {};
    settingsRows.forEach(row => {
      settings[row.key] = row.value;
    });

    // 5. Obtener todos los productos activos para desglose de envases
    const products = await db.all("SELECT * FROM products WHERE status = 'active'");

    res.json({
      activeAdultQuails,
      activeAdultFemales,
      activeAdultMales,
      feedCostPonedoraPerKg,
      feedCostIniciadorPerKg,
      settings,
      products
    });
  } catch (error) {
    console.error('Error al obtener datos base para proyecciones:', error);
    res.status(500).json({ error: 'Error interno del servidor al obtener datos de proyección.' });
  }
});

export default router;
