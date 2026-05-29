import express from 'express';
import { CalendarEvent } from '../models/CalendarEvent.js';
import { authenticateToken } from './authRoutes.js';

const router = express.Router();

/**
 * GET /api/calendar/events
 * ADMIN ONLY: Get events (supports optional query params ?start=YYYY-MM-DD&end=YYYY-MM-DD).
 */
router.get('/events', authenticateToken, async (req, res) => {
  const { start, end } = req.query;

  try {
    let events;
    if (start && end) {
      events = await CalendarEvent.getByDateRange(start, end);
    } else {
      events = await CalendarEvent.getAll();
    }
    res.json(events);
  } catch (error) {
    console.error('Error al obtener eventos del calendario:', error);
    res.status(500).json({ error: 'Error al obtener eventos del calendario.' });
  }
});

/**
 * POST /api/calendar/events
 * ADMIN ONLY: Create a manual calendar event.
 */
router.post('/events', authenticateToken, async (req, res) => {
  const { title, description, eventDate, type } = req.body;

  if (!title || !eventDate || !type) {
    return res.status(400).json({ error: 'Campos requeridos faltantes (título, fecha de evento, tipo).' });
  }

  try {
    const event = new CalendarEvent({
      title,
      description,
      eventDate,
      type
    });

    await event.save();
    res.status(201).json({ message: 'Evento guardado con éxito.', event });
  } catch (error) {
    console.error('Error al crear evento del calendario:', error);
    res.status(500).json({ error: 'Error al crear evento.' });
  }
});

/**
 * DELETE /api/calendar/events/:id
 * ADMIN ONLY: Delete calendar event.
 */
router.delete('/events/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const event = await CalendarEvent.getById(Number(id));
    if (!event) {
      return res.status(404).json({ error: 'Evento no encontrado.' });
    }

    await event.delete();
    res.json({ message: 'Evento eliminado con éxito.' });
  } catch (error) {
    console.error('Error al eliminar evento del calendario:', error);
    res.status(500).json({ error: 'Error al eliminar evento.' });
  }
});

/**
 * POST /api/calendar/incubator
 * ADMIN ONLY: Register incubator start, scheduling stopping turn (Day 15) and hatch (Day 17).
 */
router.post('/incubator', authenticateToken, async (req, res) => {
  const { eggsCount, startDate } = req.body;

  if (!eggsCount || !startDate) {
    return res.status(400).json({ error: 'Faltan campos requeridos (cantidad de huevos y fecha de inicio).' });
  }

  try {
    const events = await CalendarEvent.registerIncubatorBatch(Number(eggsCount), startDate);
    res.status(201).json({
      message: 'Incubación registrada. Se han agendado los eventos automáticos en el calendario.',
      events
    });
  } catch (error) {
    console.error('Error al registrar incubadora:', error);
    res.status(500).json({ error: 'Error al agendar eventos de incubación.' });
  }
});

export default router;
