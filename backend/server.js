import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Inicializar variables de entorno
dotenv.config();

// Forzar zona horaria a Argentina (Buenos Aires) para el servidor Oracle/Node
process.env.TZ = 'America/Argentina/Buenos_Aires';

import { initializeDatabase } from './db/schema.js';
import authRoutes from './routes/authRoutes.js';
import inventoryRoutes from './routes/inventoryRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import calendarRoutes from './routes/calendarRoutes.js';
import settingRoutes from './routes/settingRoutes.js';
import userRoutes from './routes/userRoutes.js';
import projectionsRoutes from './routes/projectionsRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// Configurar CORS para permitir peticiones en desarrollo desde el puerto de Vite (5173 por defecto)
app.use(cors({
  origin: '*', // En producción puedes limitarlo
  credentials: true
}));

// Servir body parsers
app.use(express.json());

// Iniciar base de datos
try {
  console.log('Inicializando la base de datos SQLite...');
  await initializeDatabase();
  console.log('Base de datos inicializada correctamente.');
} catch (error) {
  console.error('Error crítico al inicializar la base de datos:', error);
  process.exit(1);
}

// Rutas de la API
app.use('/api/auth', authRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/users', userRoutes);
app.use('/api/projections', projectionsRoutes);

// Servir frontend compilado en entorno de producción
const distPath = path.join(__dirname, '../frontend/dist');
app.use(express.static(distPath));

// Cualquier otra ruta no manejada por la API se redirige al index.html de React (SPA enrutamiento)
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// Levantar el servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor de la granja corriendo exitosamente en el puerto ${PORT}`);
  console.log(`- API disponible en: http://localhost:${PORT}/api/`);
});
