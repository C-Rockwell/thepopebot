import { randomUUID } from 'crypto';
import { eq, desc, lt, and, sql } from 'drizzle-orm';
import { getDb } from './index.js';
import { actionLog } from './schema.js';

/**
 * Insert an action log entry.
 * @param {object} data
 * @returns {object} The created row
 */
export function insertActionLog(data) {
  const db = getDb();
  const row = {
    id: randomUUID(),
    actionType: data.actionType,
    actionName: data.actionName || null,
    source: data.source,
    trustLevel: data.trustLevel || null,
    input: data.input ? JSON.stringify(data.input) : null,
    result: data.result || null,
    status: data.status || 'success',
    error: data.error || null,
    durationMs: data.durationMs || null,
    metadata: data.metadata ? JSON.stringify(data.metadata) : null,
    createdAt: Date.now(),
  };
  db.insert(actionLog).values(row).run();
  return row;
}

/**
 * Query action log with optional filters + pagination.
 * @param {object} [filters]
 * @param {string} [filters.actionType]
 * @param {string} [filters.status]
 * @param {string} [filters.source]
 * @param {number} [filters.limit=20]
 * @param {number} [filters.offset=0]
 * @returns {object[]}
 */
export function queryActionLog(filters = {}) {
  const db = getDb();
  const conditions = [];

  if (filters.actionType) conditions.push(eq(actionLog.actionType, filters.actionType));
  if (filters.status) conditions.push(eq(actionLog.status, filters.status));
  if (filters.source) conditions.push(eq(actionLog.source, filters.source));

  const limit = filters.limit || 20;
  const offset = filters.offset || 0;

  let query = db.select().from(actionLog);
  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  return query
    .orderBy(desc(actionLog.createdAt))
    .limit(limit)
    .offset(offset)
    .all();
}

/**
 * Get action log statistics since a given timestamp.
 * @param {number} since - Timestamp (ms)
 * @returns {{ total: number, byType: object, byStatus: object }}
 */
export function getActionLogStats(since) {
  const db = getDb();
  const sqlite = db._.session.client;

  const total = sqlite
    .prepare('SELECT count(*) as count FROM action_log WHERE created_at >= ?')
    .get(since);

  const byType = sqlite
    .prepare('SELECT action_type, count(*) as count FROM action_log WHERE created_at >= ? GROUP BY action_type')
    .all(since);

  const byStatus = sqlite
    .prepare('SELECT status, count(*) as count FROM action_log WHERE created_at >= ? GROUP BY status')
    .all(since);

  return {
    total: total?.count ?? 0,
    byType: Object.fromEntries(byType.map(r => [r.action_type, r.count])),
    byStatus: Object.fromEntries(byStatus.map(r => [r.status, r.count])),
  };
}

/**
 * Delete action log entries older than a given timestamp.
 * @param {number} timestamp - Cutoff timestamp (ms)
 * @returns {number} Number of deleted rows
 */
export function deleteActionLogBefore(timestamp) {
  const db = getDb();
  const result = db.delete(actionLog).where(lt(actionLog.createdAt, timestamp)).run();
  return result.changes;
}

/**
 * Get action count within a time window, optionally grouped by hour.
 * @param {number} since - Timestamp (ms)
 * @param {string} [actionName] - Optional action name filter
 * @returns {number}
 */
export function getActionCountSince(since, actionName) {
  const db = getDb();
  const sqlite = db._.session.client;

  if (actionName) {
    const result = sqlite
      .prepare('SELECT count(*) as count FROM action_log WHERE created_at >= ? AND action_name = ?')
      .get(since, actionName);
    return result?.count ?? 0;
  }

  const result = sqlite
    .prepare('SELECT count(*) as count FROM action_log WHERE created_at >= ?')
    .get(since);
  return result?.count ?? 0;
}

/**
 * Get error count for a specific action name within a time window.
 * @param {string} actionName
 * @param {number} since - Timestamp (ms)
 * @returns {number}
 */
export function getErrorCountByName(actionName, since) {
  const db = getDb();
  const sqlite = db._.session.client;

  const result = sqlite
    .prepare('SELECT count(*) as count FROM action_log WHERE action_name = ? AND status = ? AND created_at >= ?')
    .get(actionName, 'error', since);
  return result?.count ?? 0;
}

/**
 * Get distinct action names that had errors in a time window.
 * @param {number} since
 * @returns {string[]}
 */
export function getErrorActionNames(since) {
  const db = getDb();
  const sqlite = db._.session.client;

  const rows = sqlite
    .prepare('SELECT DISTINCT action_name FROM action_log WHERE status = ? AND created_at >= ? AND action_name IS NOT NULL')
    .all('error', since);
  return rows.map(r => r.action_name);
}

/**
 * Get total action log count (for pagination).
 * @param {object} [filters]
 * @returns {number}
 */
export function getActionLogCount(filters = {}) {
  const db = getDb();
  const conditions = [];

  if (filters.actionType) conditions.push(eq(actionLog.actionType, filters.actionType));
  if (filters.status) conditions.push(eq(actionLog.status, filters.status));
  if (filters.source) conditions.push(eq(actionLog.source, filters.source));

  let query = db.select({ count: sql`count(*)` }).from(actionLog);
  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  const result = query.get();
  return result?.count ?? 0;
}
