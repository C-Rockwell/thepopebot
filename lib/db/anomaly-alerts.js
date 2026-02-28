import { randomUUID } from 'crypto';
import { eq, desc, and, sql } from 'drizzle-orm';
import { getDb } from './index.js';
import { anomalyAlerts } from './schema.js';

/**
 * Insert a new anomaly alert.
 * @param {object} data
 * @returns {object} The created alert
 */
export function insertAlert(data) {
  const db = getDb();
  const row = {
    id: randomUUID(),
    alertType: data.alertType,
    severity: data.severity,
    message: data.message,
    details: data.details ? JSON.stringify(data.details) : null,
    acknowledged: 0,
    createdAt: Date.now(),
  };
  db.insert(anomalyAlerts).values(row).run();
  return row;
}

/**
 * Get alerts with optional filters.
 * @param {object} [filters]
 * @param {boolean} [filters.unacknowledgedOnly]
 * @param {number} [filters.limit=20]
 * @returns {object[]}
 */
export function getAlerts(filters = {}) {
  const db = getDb();
  const conditions = [];

  if (filters.unacknowledgedOnly) {
    conditions.push(eq(anomalyAlerts.acknowledged, 0));
  }

  let query = db.select().from(anomalyAlerts);
  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  return query
    .orderBy(desc(anomalyAlerts.createdAt))
    .limit(filters.limit || 20)
    .all()
    .map((row) => {
      if (row.details) try { row.details = JSON.parse(row.details); } catch {}
      return row;
    });
}

/**
 * Acknowledge a single alert.
 * @param {string} id
 */
export function acknowledgeAlert(id) {
  const db = getDb();
  db.update(anomalyAlerts)
    .set({ acknowledged: 1 })
    .where(eq(anomalyAlerts.id, id))
    .run();
}

/**
 * Acknowledge all unacknowledged alerts.
 */
export function acknowledgeAllAlerts() {
  const db = getDb();
  db.update(anomalyAlerts)
    .set({ acknowledged: 1 })
    .where(eq(anomalyAlerts.acknowledged, 0))
    .run();
}

/**
 * Get count of unacknowledged alerts.
 * @returns {number}
 */
export function getUnacknowledgedCount() {
  const db = getDb();
  const result = db
    .select({ count: sql`count(*)` })
    .from(anomalyAlerts)
    .where(eq(anomalyAlerts.acknowledged, 0))
    .get();
  return result?.count ?? 0;
}

/**
 * Check if an unacknowledged alert of the given type exists in the same hour.
 * Used for deduplication.
 * @param {string} alertType
 * @returns {boolean}
 */
export function hasRecentAlert(alertType) {
  const db = getDb();
  const sqlite = db._.session.client;
  const hourAgo = Date.now() - 3600000;

  const result = sqlite
    .prepare('SELECT count(*) as count FROM anomaly_alerts WHERE alert_type = ? AND acknowledged = 0 AND created_at >= ?')
    .get(alertType, hourAgo);
  return (result?.count ?? 0) > 0;
}
