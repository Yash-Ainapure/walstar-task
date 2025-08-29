import * as SQLite from 'expo-sqlite';

let db;

// ✅ Proper async initialization function
export const initDB = async () => {
  if (!db) {
    db = await SQLite.openDatabaseAsync('locations.db');
  }

  // ✅ Use execAsync() for queries
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS locations (
      id INTEGER PRIMARY KEY NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      timestamp TEXT NOT NULL
    );
  `);
};

// ✅ Insert location
export const writeLocation = async (latitude, longitude, timestamp) => {
  if (!db) throw new Error('Database not initialized. Call initDB first.');
  const query = `
    INSERT INTO locations (latitude, longitude, timestamp)
    VALUES (?, ?, ?);
  `;
  await db.runAsync(query, [latitude, longitude, timestamp.toISOString()]);
};

// ✅ Get all locations
export const getLocations = async () => {
  if (!db) throw new Error('Database not initialized. Call initDB first.');
  const result = await db.getAllAsync('SELECT * FROM locations;');
  return result; // Returns an array of rows
};

// ✅ Delete all locations
export const deleteAllLocations = async () => {
  if (!db) throw new Error('Database not initialized. Call initDB first.');
  await db.runAsync('DELETE FROM locations;');
};
