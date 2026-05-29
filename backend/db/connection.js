import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let dbConnection = null;

/**
 * Returns the single active SQLite database connection (Singleton).
 * @returns {Promise<import('sqlite').Database>}
 */
export async function getDatabaseConnection() {
  if (dbConnection) {
    return dbConnection;
  }

  // Si estamos en un entorno de test, podemos usar una base de datos en memoria o un archivo de test
  const dbPath = process.env.NODE_ENV === 'test' 
    ? ':memory:' 
    : path.join(__dirname, '../../database.sqlite');

  dbConnection = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  // Habilitar claves foráneas para integridad referencial
  await dbConnection.run('PRAGMA foreign_keys = ON');

  return dbConnection;
}

/**
 * Closes the database connection. Useful for tests.
 */
export async function closeDatabaseConnection() {
  if (dbConnection) {
    await dbConnection.close();
    dbConnection = null;
  }
}
