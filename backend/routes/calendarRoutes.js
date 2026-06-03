import express from 'express';
import { CalendarEvent } from '../models/CalendarEvent.js';
import { Incubation } from '../models/Incubation.js';
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
 * GET /api/calendar/incubations
 * ADMIN ONLY: Get list of all incubation batches.
 */
router.get('/incubations', authenticateToken, async (req, res) => {
  try {
    const list = await Incubation.getAll();
    res.json(list);
  } catch (error) {
    console.error('Error al obtener incubaciones:', error);
    res.status(500).json({ error: 'Error al obtener las tandas de incubación.' });
  }
});

/**
 * POST /api/calendar/incubations
 * ADMIN ONLY: Create a new incubation batch.
 */
router.post('/incubations', authenticateToken, async (req, res) => {
  const { eggsCount, startDate, notes } = req.body;

  if (!eggsCount || !startDate) {
    return res.status(400).json({ error: 'Faltan campos requeridos (cantidad de huevos y fecha de inicio).' });
  }

  try {
    const incubation = new Incubation({
      eggsCount: Number(eggsCount),
      startDate,
      notes,
      status: 'active'
    });
    await incubation.save();
    res.status(201).json({
      message: 'Incubación registrada con éxito. Hitos del calendario agendados.',
      incubation
    });
  } catch (error) {
    console.error('Error al crear incubación:', error);
    res.status(500).json({ error: 'Error al registrar la incubación.' });
  }
});

/**
 * PUT /api/calendar/incubations/:id
 * ADMIN ONLY: Edit details or change status of an incubation batch.
 */
router.put('/incubations/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { eggsCount, startDate, status, notes } = req.body;

  try {
    const incubation = await Incubation.getById(Number(id));
    if (!incubation) {
      return res.status(404).json({ error: 'Incubación no encontrada.' });
    }

    if (eggsCount !== undefined) incubation.eggsCount = Number(eggsCount);
    if (startDate !== undefined) incubation.startDate = startDate;
    if (status !== undefined) incubation.status = status;
    if (notes !== undefined) incubation.notes = notes;

    await incubation.save();
    res.json({ message: 'Incubación actualizada con éxito.', incubation });
  } catch (error) {
    console.error('Error al actualizar incubación:', error);
    res.status(500).json({ error: 'Error al actualizar la incubación.' });
  }
});

/**
 * DELETE /api/calendar/incubations/:id
 * ADMIN ONLY: Delete an incubation batch.
 */
router.delete('/incubations/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const incubation = await Incubation.getById(Number(id));
    if (!incubation) {
      return res.status(404).json({ error: 'Incubación no encontrada.' });
    }

    await incubation.delete();
    res.json({ message: 'Incubación eliminada con éxito junto con sus eventos vinculados.' });
  } catch (error) {
    console.error('Error al eliminar incubación:', error);
    res.status(500).json({ error: 'Error al eliminar la incubación.' });
  }
});

/**
 * POST /api/calendar/incubator
 * DEPRECATED / COMPATIBILITY: Register incubator start, scheduling stopping turn (Day 15) and hatch (Day 17).
 */
router.post('/incubator', authenticateToken, async (req, res) => {
  const { eggsCount, startDate } = req.body;

  if (!eggsCount || !startDate) {
    return res.status(400).json({ error: 'Faltan campos requeridos (cantidad de huevos y fecha de inicio).' });
  }

  try {
    // Si viene solo fecha (10 caracteres YYYY-MM-DD), agregar hora por defecto 00:10
    let fullStartDate = startDate;
    if (startDate.length === 10) {
      fullStartDate = `${startDate} 00:10`;
    }
    
    const incubation = new Incubation({
      eggsCount: Number(eggsCount),
      startDate: fullStartDate,
      status: 'active'
    });
    await incubation.save();
    
    res.status(201).json({
      message: 'Incubación registrada. Se han agendado los eventos automáticos en el calendario.',
      events: {} // para retrocompatibilidad
    });
  } catch (error) {
    console.error('Error al registrar incubadora:', error);
    res.status(500).json({ error: 'Error al agendar eventos de incubación.' });
  }
});

export default router;
