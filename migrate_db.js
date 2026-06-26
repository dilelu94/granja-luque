import { initializeDatabase } from './backend/db/schema.js';

async function migrate() {
  console.log('Running schema migrations...');
  await initializeDatabase();
  console.log('Done.');
}

migrate();
