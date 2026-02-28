import { randomUUID } from 'crypto';
import { eq, and, lte, desc, sql } from 'drizzle-orm';
import { getDb } from './index.js';
import { memories, memoryAuditLog } from './schema.js';

/**
 * Insert a new memory.
 * @param {object} data
 * @returns {object} The created memory
 */
export function insertMemory(data) {
  const db = getDb();
  const now = Date.now();
  const row = {
    id: data.id || randomUUID(),
    content: data.content,
    summary: data.summary || null,
    trustLevel: data.trustLevel || 'user-direct',
    salienceScore: data.salienceScore ?? 1.0,
    sourceType: data.sourceType || 'manual',
    sourceId: data.sourceId || null,
    tags: data.tags ? JSON.stringify(data.tags) : null,
    embedding: data.embedding || null,
    createdAt: data.createdAt || now,
    lastAccessedAt: data.lastAccessedAt || now,
    decayAt: data.decayAt || null,
  };
  db.insert(memories).values(row).run();
  return row;
}

/**
 * Get a memory by ID.
 * @param {string} id
 * @returns {object|undefined}
 */
export function getMemoryById(id) {
  const db = getDb();
  const row = db.select().from(memories).where(eq(memories.id, id)).get();
  if (row && row.tags) {
    try { row.tags = JSON.parse(row.tags); } catch { /* leave as string */ }
  }
  return row;
}

/**
 * Update a memory.
 * @param {string} id
 * @param {object} data - Fields to update
 */
export function updateMemory(id, data) {
  const db = getDb();
  const updates = { ...data };
  if (updates.tags && typeof updates.tags !== 'string') {
    updates.tags = JSON.stringify(updates.tags);
  }
  db.update(memories).set(updates).where(eq(memories.id, id)).run();
}

/**
 * Delete a memory by ID.
 * @param {string} id
 */
export function deleteMemory(id) {
  const db = getDb();
  db.delete(memoryAuditLog).where(eq(memoryAuditLog.memoryId, id)).run();
  db.delete(memories).where(eq(memories.id, id)).run();
}

/**
 * Get memories by source type and optional source ID.
 * @param {string} sourceType
 * @param {string} [sourceId]
 * @returns {object[]}
 */
export function getMemoriesBySource(sourceType, sourceId) {
  const db = getDb();
  const conditions = [eq(memories.sourceType, sourceType)];
  if (sourceId) {
    conditions.push(eq(memories.sourceId, sourceId));
  }
  return db
    .select()
    .from(memories)
    .where(and(...conditions))
    .orderBy(desc(memories.createdAt))
    .all()
    .map((row) => {
      if (row.tags) try { row.tags = JSON.parse(row.tags); } catch {}
      return row;
    });
}

/**
 * Get memories with salience below a threshold.
 * @param {number} threshold
 * @returns {object[]}
 */
export function getDecayedMemories(threshold) {
  const db = getDb();
  return db
    .select()
    .from(memories)
    .where(lte(memories.salienceScore, threshold))
    .all();
}

/**
 * Get memory count and stats.
 * @returns {{ total: number, avgSalience: number, oldest: number|null, newest: number|null }}
 */
export function getMemoryStats() {
  const db = getDb();
  const result = db
    .select({
      total: sql`count(*)`,
      avgSalience: sql`avg(salience_score)`,
      oldest: sql`min(created_at)`,
      newest: sql`max(created_at)`,
    })
    .from(memories)
    .get();

  return {
    total: result?.total ?? 0,
    avgSalience: result?.avgSalience ? Number(result.avgSalience.toFixed(3)) : 0,
    oldest: result?.oldest ?? null,
    newest: result?.newest ?? null,
  };
}

/**
 * Get paginated memories with optional filters, ordered by salience descending.
 * @param {object} [filters]
 * @param {string} [filters.sourceType]
 * @param {number} [filters.limit=20]
 * @param {number} [filters.offset=0]
 * @returns {object[]}
 */
export function getMemories(filters = {}) {
  const db = getDb();
  const conditions = [];
  if (filters.sourceType) conditions.push(eq(memories.sourceType, filters.sourceType));
  const limit = filters.limit || 20;
  const offset = filters.offset || 0;
  let query = db.select({
    id: memories.id,
    content: memories.content,
    summary: memories.summary,
    salienceScore: memories.salienceScore,
    sourceType: memories.sourceType,
    sourceId: memories.sourceId,
    trustLevel: memories.trustLevel,
    tags: memories.tags,
    createdAt: memories.createdAt,
    lastAccessedAt: memories.lastAccessedAt,
  }).from(memories);
  if (conditions.length > 0) query = query.where(and(...conditions));
  return query.orderBy(desc(memories.salienceScore)).limit(limit).offset(offset).all()
    .map(row => { if (row.tags) try { row.tags = JSON.parse(row.tags); } catch {} return row; });
}

/**
 * Get memory count with optional filters.
 * @param {object} [filters]
 * @param {string} [filters.sourceType]
 * @returns {number}
 */
export function getMemoryCount(filters = {}) {
  const db = getDb();
  const conditions = [];
  if (filters.sourceType) conditions.push(eq(memories.sourceType, filters.sourceType));
  let query = db.select({ count: sql`count(*)` }).from(memories);
  if (conditions.length > 0) query = query.where(and(...conditions));
  return query.get()?.count ?? 0;
}

/**
 * Insert an audit log entry.
 * @param {object} data
 * @returns {object}
 */
export function insertAuditLog(data) {
  const db = getDb();
  const row = {
    id: randomUUID(),
    memoryId: data.memoryId,
    action: data.action,
    actor: data.actor || 'system',
    details: data.details ? JSON.stringify(data.details) : null,
    createdAt: Date.now(),
  };
  db.insert(memoryAuditLog).values(row).run();
  return row;
}

/**
 * Get audit log entries for a memory.
 * @param {string} memoryId
 * @returns {object[]}
 */
export function getAuditLogByMemory(memoryId) {
  const db = getDb();
  return db
    .select()
    .from(memoryAuditLog)
    .where(eq(memoryAuditLog.memoryId, memoryId))
    .orderBy(desc(memoryAuditLog.createdAt))
    .all()
    .map((row) => {
      if (row.details) try { row.details = JSON.parse(row.details); } catch {}
      return row;
    });
}

/**
 * Get all memory IDs (for batch operations like decay).
 * @returns {Array<{ id: string, salienceScore: number, createdAt: number, lastAccessedAt: number }>}
 */
export function getAllMemoriesForDecay() {
  const db = getDb();
  return db
    .select({
      id: memories.id,
      salienceScore: memories.salienceScore,
      createdAt: memories.createdAt,
      lastAccessedAt: memories.lastAccessedAt,
    })
    .from(memories)
    .all();
}

/**
 * FTS5 search — raw SQL query against the virtual table.
 * Note: Prefer using searchFts from lib/memory/fts.js which handles errors.
 * @param {string} query
 * @param {number} limit
 * @returns {object[]}
 */
export function searchMemoriesFts(query, limit = 10) {
  const db = getDb();
  const sqlite = db._.session.client;

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
      rank AS fts_rank
    FROM memories_fts
    JOIN memories m ON m.rowid = memories_fts.rowid
    WHERE memories_fts MATCH ?
    ORDER BY rank
    LIMIT ?
  `);

  return stmt.all(query, limit);
}
