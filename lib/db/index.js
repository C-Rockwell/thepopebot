import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { thepopebotDb, dataDir, PROJECT_ROOT } from '../paths.js';
import * as schema from './schema.js';

const require = createRequire(import.meta.url);

let _db = null;

/**
 * Attempt to load the sqlite-vec extension for vector search.
 * Fails silently if the extension is not available.
 * @param {import('better-sqlite3').Database} sqlite
 */
function loadSqliteVec(sqlite) {
  try {
    const sqliteVec = require('sqlite-vec');
    sqliteVec.load(sqlite);
  } catch {
    // sqlite-vec not available — vector search will use brute-force fallback
  }
}

/**
 * Get or create the Drizzle database instance (lazy singleton).
 * @returns {import('drizzle-orm/better-sqlite3').BetterSQLite3Database}
 */
export function getDb() {
  if (!_db) {
    // Ensure data directory exists
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const sqlite = new Database(thepopebotDb);
    sqlite.pragma('journal_mode = WAL');
    loadSqliteVec(sqlite);
    _db = drizzle(sqlite, { schema });
  }
  return _db;
}

/**
 * Initialize the database — apply pending migrations.
 * Called from instrumentation.js at server startup.
 * Uses Drizzle Kit migrations from the package's drizzle/ folder.
 */
export function initDatabase() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const sqlite = new Database(thepopebotDb);
  sqlite.pragma('journal_mode = WAL');
  const db = drizzle(sqlite, { schema });

  // Resolve migrations folder from the installed package.
  // import.meta.url doesn't survive webpack bundling, so resolve from PROJECT_ROOT.
  const migrationsFolder = path.join(PROJECT_ROOT, 'node_modules', 'thepopebot', 'drizzle');

  migrate(db, { migrationsFolder });

  sqlite.close();

  // Force re-creation of drizzle instance on next getDb() call
  _db = null;
}
