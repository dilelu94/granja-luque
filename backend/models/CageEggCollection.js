import { getDatabaseConnection } from '../db/connection.js';
import { EggCollection } from './EggCollection.js';

export class CageEggCollection {
  constructor(data) {
    this.id = data.id || null;
    this.date = data.date; // YYYY-MM-DD
    this.cageId = data.cage_id || data.cageId;
    this.cageName = data.cage_name || data.cageName || null;
    this.quantityCollected = data.quantity_collected || data.quantityCollected || 0;
    this.quantityBroken = data.quantity_broken || data.quantityBroken || 0;
    this.notes = data.notes || '';
  }

  /**
   * Saves a cage-specific egg collection.
   * Sums quantities if a record already exists for the given date and cage.
   * Sincroniza el acumulador global en egg_production.
   */
  static async saveCollection(date, cageId, quantityCollected, quantityBroken, notes) {
    const db = await getDatabaseConnection();

    // Check if there is already a record for this cage on this date
    const existing = await db.get(
      'SELECT * FROM cage_egg_production WHERE date = ? AND cage_id = ?',
      [date, cageId]
    );

    let isAddition = false;
    let finalCollected = quantityCollected;
    let finalBroken = quantityBroken;
    let finalNotes = notes || '';

    if (existing) {
      isAddition = true;
      finalCollected = existing.quantity_collected + quantityCollected;
      finalBroken = existing.quantity_broken + quantityBroken;
      finalNotes = existing.notes ? (existing.notes + '\n' + (notes || '')) : (notes || '');

      await db.run(
        `UPDATE cage_egg_production 
         SET quantity_collected = ?, quantity_broken = ?, notes = ?
         WHERE id = ?`,
        [finalCollected, finalBroken, finalNotes, existing.id]
      );
    } else {
      await db.run(
        `INSERT INTO cage_egg_production (date, cage_id, quantity_collected, quantity_broken, notes)
         VALUES (?, ?, ?, ?, ?)`,
        [date, cageId, quantityCollected, quantityBroken, notes || '']
      );
    }

    // Update the global EggCollection for the date
    let globalColl = await EggCollection.getByDate(date);
    if (globalColl) {
      // Just add the new collection parts to the daily global total
      globalColl.quantityCollected += quantityCollected;
      globalColl.quantityBroken += quantityBroken;
      if (notes) {
        globalColl.notes = globalColl.notes ? (globalColl.notes + '\n' + notes) : notes;
      }
      await globalColl.save();
    } else {
      // Fetch weather data for El Talar, Buenos Aires
      // LAT: -34.4754, LON: -58.6508
      let tempMin = null;
      let tempMax = null;
      let tempAvg = null;
      let humidity = null;
      let daylightDuration = null;
      let cloudCover = null;

      try {
        const weatherRes = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=-34.4754&longitude=-58.6508&daily=temperature_2m_max,temperature_2m_min,temperature_2m_mean,relative_humidity_2m_mean,daylight_duration,cloudcover_mean&timezone=America%2FArgentina%2FBuenos_Aires&start_date=${date}&end_date=${date}`
        );
        const weatherData = await weatherRes.json();
        
        if (weatherData && weatherData.daily && weatherData.daily.temperature_2m_max && weatherData.daily.temperature_2m_max.length > 0) {
          tempMax = weatherData.daily.temperature_2m_max[0];
          tempMin = weatherData.daily.temperature_2m_min[0];
          tempAvg = weatherData.daily.temperature_2m_mean[0];
          humidity = weatherData.daily.relative_humidity_2m_mean[0];
          if (weatherData.daily.daylight_duration) {
            daylightDuration = Math.round((weatherData.daily.daylight_duration[0] / 3600) * 10) / 10;
          }
          if (weatherData.daily.cloudcover_mean) {
            cloudCover = weatherData.daily.cloudcover_mean[0];
          }
        }
      } catch (err) {
        console.error('Error fetching weather data from Open-Meteo:', err.message);
      }

      globalColl = new EggCollection({
        date,
        quantityCollected,
        quantityBroken,
        notes: notes || '',
        temp_min: tempMin,
        temp_max: tempMax,
        temp_avg: tempAvg,
        humidity: humidity,
        daylight_duration: daylightDuration,
        cloud_cover: cloudCover
      });
      await globalColl.save();
    }

    return { isAddition, finalCollected, finalBroken };
  }

  /**
   * Retrieves cage-specific collection records for a given date.
   */
  static async getCageCollectionsByDate(date) {
    const db = await getDatabaseConnection();
    const rows = await db.all(`
      SELECT cec.*, c.name as cage_name 
      FROM cage_egg_production cec
      JOIN cages c ON cec.cage_id = c.id
      WHERE cec.date = ?
      ORDER BY c.name ASC
    `, [date]);
    return rows.map(row => new CageEggCollection(row));
  }

  /**
   * Retrieves all cage-specific collection records.
   */
  static async getAll() {
    const db = await getDatabaseConnection();
    const rows = await db.all(`
      SELECT cec.*, c.name as cage_name 
      FROM cage_egg_production cec
      JOIN cages c ON cec.cage_id = c.id
      ORDER BY cec.date DESC, c.name ASC
    `);
    return rows.map(row => new CageEggCollection(row));
  }
}
