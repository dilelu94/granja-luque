import express from 'express';
import jwt from 'jsonwebtoken';
import bcryptjs from 'bcryptjs';
import { getDatabaseConnection } from '../db/connection.js';
import { User } from '../models/User.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_change_me_in_production';

// Rate Limiting In-Memory Store
// Format: { 'ip_address': { count: number, lastAttempt: timestamp } }
const loginAttempts = {};
const MAX_ATTEMPTS = 3;
const LOCKOUT_TIME_MS = 60 * 1000; // 1 minute

async function sendTelegramAlert(ip, username) {
  // We use the credentials you already have for pm2-telegram-monitor
  const token = '8938142775:AAGIxh9PKRXIkbC_WeQ6JQ4LIE7a88jUEYY';
  const chatId = '252059583';

  const text = `🚨 *ALERTA DE SEGURIDAD* 🚨\nSe han detectado múltiples intentos fallidos de inicio de sesión.\n\n👤 *Usuario intentado:* ${username}\n🌐 *IP de Origen:* ${ip}\n⏱️ *Acción:* La IP ha sido bloqueada temporalmente.`;
  
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' })
    });
  } catch (err) {
    console.error('Error enviando alerta de Telegram:', err.message);
  }
}

/**
 * Middleware to authenticate JWT token.
 */
export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Format: "Bearer TOKEN"

  if (!token) {
    return res.status(401).json({ error: 'Acceso no autorizado. Token faltante.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido o expirado.' });
    }
    req.user = user;
    next();
  });
}

/**
 * POST /api/auth/login
 * Admin login endpoint.
 */
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  if (!username || !password) {
    return res.status(400).json({ error: 'Nombre de usuario y contraseña requeridos.' });
  }

  // Comprobar Rate Limit
  const now = Date.now();
  if (loginAttempts[ip]) {
    const { count, lastAttempt } = loginAttempts[ip];
    if (count >= MAX_ATTEMPTS) {
      if (now - lastAttempt < LOCKOUT_TIME_MS) {
        const remaining = Math.ceil((LOCKOUT_TIME_MS - (now - lastAttempt)) / 1000);
        return res.status(429).json({ error: `Demasiados intentos fallidos. Intenta de nuevo en ${remaining} segundos.` });
      } else {
        // Reset after lockout
        delete loginAttempts[ip];
      }
    }
  }

  const recordFailedAttempt = async () => {
    if (!loginAttempts[ip]) {
      loginAttempts[ip] = { count: 1, lastAttempt: now };
    } else {
      loginAttempts[ip].count += 1;
      loginAttempts[ip].lastAttempt = now;
    }
    
    if (loginAttempts[ip].count === MAX_ATTEMPTS) {
      // Trigger Telegram Alert on the 3rd fail
      await sendTelegramAlert(ip, username);
    }
  };

  try {
    const user = await User.findByUsername(username);

    if (!user) {
      await recordFailedAttempt();
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    const isMatch = await bcryptjs.compare(password, user.password);
    if (!isMatch) {
      await recordFailedAttempt();
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    // Success login -> reset attempts
    delete loginAttempts[ip];

    // Generar Token JWT incluyendo el rol
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ token, username: user.username, role: user.role });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

/**
 * GET /api/auth/verify
 * Verification route to check if token is still valid.
 */
router.get('/verify', authenticateToken, (req, res) => {
  res.json({ valid: true, username: req.user.username, role: req.user.role });
});

/**
 * POST /api/auth/change-password
 * Change password route for the current authenticated user.
 */
router.post('/change-password', authenticateToken, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Contraseña actual y nueva contraseña requeridas.' });
  }

  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    const isMatch = await bcryptjs.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'La contraseña actual ingresada es incorrecta.' });
    }

    await user.changePassword(newPassword);
    res.json({ message: 'Contraseña cambiada con éxito.' });
  } catch (error) {
    console.error('Error al cambiar contraseña:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

export default router;

