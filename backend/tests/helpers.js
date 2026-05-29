import { getDatabaseConnection, closeDatabaseConnection } from '../db/connection.js';
import { initializeDatabase } from '../db/schema.js';

/**
 * Sets up an in-memory SQLite database for testing, running migrations and schema setup.
 */
export async function setupTestDb() {
  process.env.NODE_ENV = 'test';
  // Asegurarnos de que no haya conexión abierta de antes
  await closeDatabaseConnection();
  
  const db = await getDatabaseConnection();
  await initializeDatabase();
  return db;
}

/**
 * Tears down the test database connection.
 */
export async function teardownTestDb() {
  await closeDatabaseConnection();
}
