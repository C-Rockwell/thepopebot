import { getDb } from '../db/index.js';

let _initialized = false;

/**
 * Initialize the FTS5 virtual table and sync triggers.
 * Safe to call multiple times — only creates if not exists.
 */
export function initFts() {
  if (_initialized) return;

  const db = getDb();
  // Access the underlying better-sqlite3 instance for raw SQL
  const sqlite = db._.session.client;

  // Create FTS5 virtual table for full-text search on memory content + summary
  sqlite.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
      content,
      summary,
      content='memories',
      content_rowid='rowid'
    );
  `);

  // Triggers to keep FTS5 in sync with the memories table
  sqlite.exec(`
    CREATE TRIGGER IF NOT EXISTS memories_fts_insert AFTER INSERT ON memories BEGIN
      INSERT INTO memories_fts(rowid, content, summary)
      VALUES (NEW.rowid, NEW.content, NEW.summary);
    END;
  `);

  sqlite.exec(`
    CREATE TRIGGER IF NOT EXISTS memories_fts_delete AFTER DELETE ON memories BEGIN
      INSERT INTO memories_fts(memories_fts, rowid, content, summary)
      VALUES ('delete', OLD.rowid, OLD.content, OLD.summary);
    END;
  `);

  sqlite.exec(`
    CREATE TRIGGER IF NOT EXISTS memories_fts_update AFTER UPDATE OF content, summary ON memories BEGIN
      INSERT INTO memories_fts(memories_fts, rowid, content, summary)
      VALUES ('delete', OLD.rowid, OLD.content, OLD.summary);
      INSERT INTO memories_fts(rowid, content, summary)
      VALUES (NEW.rowid, NEW.content, NEW.summary);
    END;
  `);

  _initialized = true;
}

/**
 * Search memories using FTS5 full-text search.
 * Returns results ranked by FTS5 relevance score.
 *
 * @param {string} query - Search query (FTS5 syntax supported)
 * @param {object} [options]
 * @param {number} [options.limit=10] - Max results
 * @param {number} [options.minSalience=0] - Min salience score filter
 * @returns {Array<{ id: string, content: string, summary: string, salienceScore: number, rank: number, snippet: string }>}
 */
export function searchFts(query, options = {}) {
  const { limit = 10, minSalience = 0 } = options;

  const db = getDb();
  const sqlite = db._.session.client;

  // Use FTS5 MATCH with bm25 ranking, joined back to memories for salience filtering
  const stmt = sqlite.prepare(`
    SELECT
      m.id,
      m.content,
      m.summary,
      m.salience_score,
      m.trust_level,
      m.source_type,
      m.source_id,
      m.tags,
      m.created_at,
      m.last_accessed_at,
      rank AS fts_rank,
      snippet(memories_fts, 0, '<mark>', '</mark>', '...', 32) AS snippet
    FROM memories_fts
    JOIN memories m ON m.rowid = memories_fts.rowid
    WHERE memories_fts MATCH ?
      AND m.salience_score >= ?
    ORDER BY rank
    LIMIT ?
  `);

  try {
    return stmt.all(query, minSalience, limit).map((row) => ({
      id: row.id,
      content: row.content,
      summary: row.summary,
      salienceScore: row.salience_score,
      trustLevel: row.trust_level,
      sourceType: row.source_type,
      sourceId: row.source_id,
      tags: row.tags ? JSON.parse(row.tags) : null,
      createdAt: row.created_at,
      lastAccessedAt: row.last_accessed_at,
      ftsRank: row.fts_rank,
      snippet: row.snippet,
    }));
  } catch (err) {
    // FTS5 MATCH can throw on invalid query syntax — return empty
    if (err.message?.includes('fts5')) {
      console.error('[FTS5] Search error:', err.message);
      return [];
    }
    throw err;
  }
}

/**
 * Rebuild the FTS5 index from the memories table.
 * Useful after bulk operations or if index gets out of sync.
 */
export function rebuildFtsIndex() {
  const db = getDb();
  const sqlite = db._.session.client;
  sqlite.exec(`INSERT INTO memories_fts(memories_fts) VALUES ('rebuild');`);
}
