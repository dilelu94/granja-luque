import { QuailBatch } from '../models/QuailBatch.js';
import { getDatabaseConnection } from '../db/connection.js';

async function run() {
  try {
    const batches = await QuailBatch.getAll();
    console.log(`Encontrados ${batches.length} lotes de aves.`);
    let found = false;
    for (const b of batches) {
      console.log(`- Lote: "${b.name}" (tipo: ${b.type}, estado: ${b.status})`);
      if (b.name.toLowerCase().includes('rodrigo')) {
        console.log(`Actualizando eventos para el lote: ${b.name}`);
        await b.save();
        found = true;
      }
    }
    if (!found) {
      console.log("No se encontró ningún lote con 'Rodrigo' en el nombre.");
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
