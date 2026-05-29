import express from 'express';
import { Settings } from '../models/Settings.js';
import { authenticateToken } from './authRoutes.js';

const router = express.Router();

/**
 * GET /api/settings/public
 * PUBLIC: get public configurations (like admin_whatsapp number).
 */
router.get('/public', async (req, res) => {
  try {
    const adminWhatsapp = await Settings.get('admin_whatsapp');
    const shippingDefaultCost = await Settings.get('shipping_default_cost') || '1500.0';
    res.json({ 
      admin_whatsapp: adminWhatsapp,
      shipping_default_cost: shippingDefaultCost
    });
  } catch (error) {
    console.error('Error al obtener configuraciones públicas:', error);
    res.status(500).json({ error: 'Error al obtener configuraciones públicas.' });
  }
});

/**
 * GET /api/settings
 * Admin only: get all system settings.
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const settings = await Settings.getAll();
    res.json(settings);
  } catch (error) {
    console.error('Error al obtener configuraciones:', error);
    res.status(500).json({ error: 'Error al obtener las configuraciones.' });
  }
});

/**
 * PUT /api/settings
 * Admin only: update one or more system settings.
 */
router.put('/', authenticateToken, async (req, res) => {
  const newSettings = req.body; // Key-value pairs

  if (!newSettings || typeof newSettings !== 'object') {
    return res.status(400).json({ error: 'Formato de configuración inválido.' });
  }

  try {
    for (const [key, value] of Object.entries(newSettings)) {
      await Settings.set(key, value);
    }
    const updated = await Settings.getAll();
    res.json({ message: 'Configuraciones actualizadas con éxito.', settings: updated });
  } catch (error) {
    console.error('Error al guardar configuraciones:', error);
    res.status(500).json({ error: 'Error al guardar las configuraciones.' });
  }
});

export default router;
