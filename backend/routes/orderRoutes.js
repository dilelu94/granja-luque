import express from 'express';
import { Order } from '../models/Order.js';
import { Settings } from '../models/Settings.js';
import { Payment } from 'mercadopago';
import { authenticateToken } from './authRoutes.js';

const router = express.Router();

// Helper para notificar al Bot de WhatsApp (si está configurada su URL)
async function notifyWhatsAppBot(event, orderData, extra = {}) {
  try {
    const botUrl = await Settings.get('whatsapp_bot_url');
    if (!botUrl) {
      console.log('WhatsApp Bot: No se definió URL del webhook del bot. Saltando notificación.');
      return;
    }

    const payload = {
      event, // 'order.created' | 'order.approved' | 'order.paid'
      orderId: orderData.id,
      customerName: orderData.customerName,
      customerPhone: orderData.customerPhone,
      customerAddress: orderData.customerAddress,
      totalPrice: orderData.totalPrice,
      items: orderData.items,
      ...extra
    };

    console.log(`WhatsApp Bot: Enviando evento "${event}" a ${botUrl}`);
    
    // Disparar en segundo plano sin bloquear la respuesta HTTP del usuario
    fetch(botUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(err => {
      console.error('Error al conectar con el Bot de WhatsApp:', err.message);
    });
  } catch (error) {
    console.error('Error en notificador del bot de WhatsApp:', error);
  }
}

/**
 * POST /api/orders
 * PUBLIC: Create a new pending order from the shop cart checkout.
 */
router.post('/', async (req, res) => {
  const { customerName, customerPhone, customerAddress, items, shippingZone, shippingCost } = req.body;

  if (!customerName || !customerPhone || !customerAddress || !items || !items.length) {
    return res.status(400).json({ error: 'Faltan datos del comprador o artículos en el carrito.' });
  }

  try {
    // Estructura esperada de items en req.body: [{product_id, name, quantity, price_at_sale}]
    const order = await Order.createOrder({
      customerName,
      customerPhone,
      customerAddress,
      shippingZone: shippingZone || '',
      shippingCost: shippingCost !== undefined ? Number(shippingCost) : 0.0,
      items
    });

    // Notificar al bot de WhatsApp que hay un nuevo pedido pendiente
    await notifyWhatsAppBot('order.created', order);

    res.status(201).json({ 
      id: order.id, 
      totalPrice: order.totalPrice,
      message: 'Pedido registrado con éxito. Esperando aprobación del administrador.' 
    });
  } catch (error) {
    console.error('Error al registrar pedido:', error);
    res.status(500).json({ error: 'Error al registrar el pedido.' });
  }
});

/**
 * GET /api/orders/:id/status
 * PUBLIC: Check the status of a specific order.
 */
router.get('/:id/status', async (req, res) => {
  const { id } = req.params;
  try {
    const order = await Order.getById(Number(id));
    if (!order) {
      return res.status(404).json({ error: 'Pedido no encontrado.' });
    }
    res.json({
      id: order.id,
      status: order.status,
      totalPrice: order.totalPrice,
      mpPreferenceId: order.mpPreferenceId
    });
  } catch (error) {
    console.error('Error al verificar estado de pedido:', error);
    res.status(500).json({ error: 'Error al verificar estado.' });
  }
});

/**
 * GET /api/orders
 * ADMIN ONLY: List all orders.
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const orders = await Order.getAll();
    res.json(orders);
  } catch (error) {
    console.error('Error al obtener pedidos admin:', error);
    res.status(500).json({ error: 'Error al obtener pedidos.' });
  }
});

/**
 * POST /api/orders/:id/approve
 * ADMIN ONLY: Approve order, generate MP payment link, and notify bot/admin.
 */
router.post('/:id/approve', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const order = await Order.getById(Number(id));
    if (!order) {
      return res.status(404).json({ error: 'Pedido no encontrado.' });
    }

    if (order.status !== 'pending_approval') {
      return res.status(400).json({ error: `El pedido ya está en estado: ${order.status}` });
    }

    const mpToken = await Settings.get('MERCADO_PAGO_ACCESS_TOKEN') || process.env.MERCADO_PAGO_ACCESS_TOKEN;
    const webhookUrl = await Settings.get('MERCADO_PAGO_WEBHOOK_URL') || process.env.MERCADO_PAGO_WEBHOOK_URL;

    if (!mpToken) {
      return res.status(500).json({ error: 'Falta configurar la credencial (Access Token) de Mercado Pago.' });
    }

    // Generar preferencia y actualizar estado del pedido a 'pending_payment'
    const paymentLink = await order.approveAndGeneratePreference(mpToken, webhookUrl);

    // Notificar al bot de WhatsApp que el pedido fue aprobado y pasarle el link de pago
    await notifyWhatsAppBot('order.approved', order, { paymentLink });

    res.json({ 
      message: 'Pedido aprobado y preferencia de pago generada.', 
      paymentLink,
      order 
    });
  } catch (error) {
    console.error('Error al aprobar pedido:', error);
    res.status(500).json({ error: `Error en la integración de Mercado Pago: ${error.message}` });
  }
});

/**
 * POST /api/orders/:id/cancel
 * ADMIN ONLY: Cancel order (restores stock if it was already paid).
 */
router.post('/:id/cancel', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const order = await Order.getById(Number(id));
    if (!order) {
      return res.status(404).json({ error: 'Pedido no encontrado.' });
    }

    await order.updateStatus('cancelled');
    res.json({ message: 'Pedido cancelado con éxito.', order });
  } catch (error) {
    console.error('Error al cancelar pedido:', error);
    res.status(500).json({ error: 'Error al cancelar el pedido.' });
  }
});

/**
 * POST /api/orders/:id/pay-manual
 * ADMIN ONLY: Mark order as paid manually (useful for cash or bank transfers).
 */
router.post('/:id/pay-manual', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const order = await Order.getById(Number(id));
    if (!order) {
      return res.status(404).json({ error: 'Pedido no encontrado.' });
    }

    await order.updateStatus('paid');
    
    // Notificar al bot de WhatsApp que el pedido está pagado
    await notifyWhatsAppBot('order.paid', order);

    res.json({ message: 'Pedido marcado como pagado manualmente.', order });
  } catch (error) {
    console.error('Error al pagar pedido manualmente:', error);
    res.status(500).json({ error: 'Error al marcar como pagado.' });
  }
});

/**
 * POST /api/orders/webhooks/mercadopago
 * PUBLIC: Mercado Pago Webhook / IPN listener.
 * Recibe la notificación de pago y actualiza el pedido a 'paid' si el pago fue aprobado.
 */
router.post('/webhooks/mercadopago', async (req, res) => {
  // Las notificaciones de Mercado Pago pueden venir con query params o body
  const id = req.query['data.id'] || req.body?.data?.id;
  const type = req.query.type || req.body?.type;

  console.log(`Mercado Pago Webhook recibido. Tipo: ${type}, ID: ${id}`);

  // Solo procesamos eventos del tipo 'payment'
  if (type === 'payment' && id) {
    try {
      const mpToken = await Settings.get('MERCADO_PAGO_ACCESS_TOKEN') || process.env.MERCADO_PAGO_ACCESS_TOKEN;
      if (!mpToken) {
        console.error('Mercado Pago Webhook Error: Token de acceso no configurado.');
        return res.sendStatus(500);
      }

      // Inicializar el SDK para inspeccionar el cobro
      // NOTA: Como la clase Payment del SDK v2.0+ requiere el cliente configurado
      const client = { accessToken: mpToken }; // Mock simplificado o clase del SDK
      // Usar fetch directo a MP es más confiable en ocasiones que la clase instanciada,
      // pero usaremos la API oficial. Hagamos una consulta directa por fetch para asegurar compatibilidad.
      const response = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
        headers: { Authorization: `Bearer ${mpToken}` }
      });

      if (!response.ok) {
        throw new Error(`Error en API de Mercado Pago al consultar pago: ${response.statusText}`);
      }

      const paymentData = await response.json();
      const orderId = Number(paymentData.external_reference);
      const status = paymentData.status;

      console.log(`Pago MP ID ${id} para Pedido #${orderId} tiene estado: ${status}`);

      if (orderId && status === 'approved') {
        const order = await Order.getById(orderId);
        if (order) {
          // Guardar el ID de pago de Mercado Pago
          order.mpPaymentId = String(id);
          // Marcar como pagado (esto resta automáticamente el inventario si no estaba pagado antes)
          await order.updateStatus('paid');

          // Notificar al bot de WhatsApp que el pedido está pagado
          await notifyWhatsAppBot('order.paid', order);
          
          console.log(`Pedido #${orderId} actualizado a PAGADO exitosamente.`);
        } else {
          console.warn(`Pedido #${orderId} no encontrado en la base de datos.`);
        }
      }
    } catch (error) {
      console.error('Error al procesar webhook de Mercado Pago:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  // Mercado Pago exige que respondamos HTTP 200/201 para confirmar recepción del webhook
  res.sendStatus(200);
});

export default router;
