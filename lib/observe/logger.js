import { getObserveConfig } from './config.js';
import { insertActionLog, deleteActionLogBefore } from '../db/action-log.js';

/**
 * Log a dispatched action.
 * @param {object} data
 * @param {string} data.actionType - agent|command|webhook|voice
 * @param {string} [data.actionName] - cron name, trigger name, or 'manual'
 * @param {string} data.source - cron|trigger|api|chat
 * @param {string} [data.trustLevel]
 * @param {object} [data.input] - Action config (no secrets)
 * @param {string} [data.result]
 * @param {string} [data.status] - success|error|blocked
 * @param {string} [data.error]
 * @param {number} [data.durationMs]
 * @param {object} [data.metadata]
 */
export function logAction(data) {
  const config = getObserveConfig();
  if (!config.logger.enabled) return;

  try {
    insertActionLog(data);
  } catch (err) {
    console.error('[observe] Failed to log action:', err.message);
  }
}

/**
 * Delete action log entries older than retentionDays.
 */
export function pruneActionLog() {
  const config = getObserveConfig();
  const cutoff = Date.now() - config.logger.retentionDays * 24 * 60 * 60 * 1000;

  try {
    const deleted = deleteActionLogBefore(cutoff);
    if (deleted > 0) {
      console.log(`[observe] Pruned ${deleted} action log entries`);
    }
  } catch (err) {
    console.error('[observe] Failed to prune action log:', err.message);
  }
}
