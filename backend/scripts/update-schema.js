import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';

async function updateSchema() {
  const db = await open({
    filename: './database.sqlite',
    driver: sqlite3.Database
  });

  const row = await db.get("SELECT sql FROM sqlite_master WHERE type='table' AND name='calendar_events';");
  const newSql = row.sql.replace("'manual'))", "'manual', 'temperature'))");

  await db.run("PRAGMA writable_schema=ON;");
  await db.run("UPDATE sqlite_master SET sql = ? WHERE type='table' AND name='calendar_events';", [newSql]);
  await db.run("PRAGMA writable_schema=OFF;");
  
  console.log("Schema updated.");
  await db.close();
}

updateSchema().catch(console.error);
