import express from 'express';
import { authenticateToken } from './authRoutes.js';
import { User } from '../models/User.js';
import bcryptjs from 'bcryptjs';

const router = express.Router();

/**
 * Middleware to require super_admin role.
 */
function requireSuperAdmin(req, res, next) {
  if (req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Acceso denegado. Se requieren permisos de super_admin.' });
  }
  next();
}

/**
 * GET /api/users
 * Returns a list of all users. Accessible only by super_admin.
 */
router.get('/', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const users = await User.listAll();
    // Exclude password hashes from list
    const safeUsers = users.map(u => ({
      id: u.id,
      username: u.username,
      role: u.role
    }));
    res.json(safeUsers);
  } catch (error) {
    console.error('Error al listar usuarios:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

/**
 * POST /api/users
 * Creates a new user. Accessible only by super_admin.
 */
router.post('/', authenticateToken, requireSuperAdmin, async (req, res) => {
  const { username, password, role } = req.body;

  if (!username || !password || !role) {
    return res.status(400).json({ error: 'Todos los campos son requeridos (usuario, contraseña y rol).' });
  }

  if (role !== 'super_admin' && role !== 'admin') {
    return res.status(400).json({ error: 'Rol inválido. Los roles permitidos son super_admin y admin.' });
  }

  try {
    const existingUser = await User.findByUsername(username);
    if (existingUser) {
      return res.status(400).json({ error: 'El nombre de usuario ya está registrado.' });
    }

    const salt = await bcryptjs.genSalt(10);
    const hashedPassword = await bcryptjs.hash(password, salt);

    const newUser = new User({
      username,
      password: hashedPassword,
      role
    });

    await newUser.save();

    res.status(201).json({
      id: newUser.id,
      username: newUser.username,
      role: newUser.role
    });
  } catch (error) {
    console.error('Error al crear usuario:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

/**
 * PUT /api/users/:id
 * Updates an existing user. Accessible only by super_admin.
 */
router.put('/:id', authenticateToken, requireSuperAdmin, async (req, res) => {
  const userId = parseInt(req.params.id);
  const { username, password, role } = req.body;

  if (!username || !role) {
    return res.status(400).json({ error: 'Usuario y rol son requeridos.' });
  }

  if (role !== 'super_admin' && role !== 'admin') {
    return res.status(400).json({ error: 'Rol inválido. Los roles permitidos son super_admin y admin.' });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    // Check username availability
    const userByUsername = await User.findByUsername(username);
    if (userByUsername && userByUsername.id !== userId) {
      return res.status(400).json({ error: 'El nombre de usuario ya está en uso.' });
    }

    // No permitir que el super_admin se quite su propio rol de super_admin
    if (req.user.id === userId && role !== 'super_admin') {
      return res.status(400).json({ error: 'No puedes quitarte el rol de super_admin a ti mismo.' });
    }

    user.username = username;
    user.role = role;

    if (password) {
      const salt = await bcryptjs.genSalt(10);
      user.password = await bcryptjs.hash(password, salt);
    }

    await user.save();

    res.json({
      id: user.id,
      username: user.username,
      role: user.role
    });
  } catch (error) {
    console.error('Error al editar usuario:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

/**
 * DELETE /api/users/:id
 * Deletes a user. Accessible only by super_admin.
 */
router.delete('/:id', authenticateToken, requireSuperAdmin, async (req, res) => {
  const userId = parseInt(req.params.id);

  if (req.user.id === userId) {
    return res.status(400).json({ error: 'No puedes eliminarte a ti mismo.' });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    await User.delete(userId);
    res.json({ message: 'Usuario eliminado exitosamente.' });
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

export default router;
