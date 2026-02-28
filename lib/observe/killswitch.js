import { randomUUID } from 'crypto';
import { eq, and } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { settings } from '../db/schema.js';
import { logAction } from './logger.js';
import { createNotification } from '../db/notifications.js';

let _killed = false;
let _activatedAt = null;
let _activatedBy = null;

const SETTING_TYPE = 'system';
const SETTING_KEY = 'killswitch';

/**
 * Persist kill switch state to the settings table.
 */
function persistState(active, userId) {
  const db = getDb();
  const existing = db
    .select()
    .from(settings)
    .where(and(eq(settings.type, SETTING_TYPE), eq(settings.key, SETTING_KEY)))
    .get();

  const value = JSON.stringify({ active, activatedAt: _activatedAt, activatedBy: _activatedBy });
  const now = Date.now();

  if (existing) {
    db.update(settings)
      .set({ value, updatedAt: now })
      .where(eq(settings.id, existing.id))
      .run();
  } else {
    db.insert(settings)
      .values({
        id: randomUUID(),
        type: SETTING_TYPE,
        key: SETTING_KEY,
        value,
        createdBy: userId || 'system',
        createdAt: now,
        updatedAt: now,
      })
      .run();
  }
}

/**
 * Activate the kill switch — stops all crons, blocks actions.
 * @param {string} [userId]
 */
export async function activateKillSwitch(userId) {
  _killed = true;
  _activatedAt = Date.now();
  _activatedBy = userId || 'system';

  persistState(true, userId);

  // Stop all crons
  try {
    const { stopAllCrons } = await import('../cron.js');
    stopAllCrons();
  } catch (err) {
    console.error('[killswitch] Failed to stop crons:', err.message);
  }

  logAction({
    actionType: 'command',
    actionName: 'killswitch',
    source: 'api',
    status: 'success',
    result: 'Kill switch activated',
    metadata: { activatedBy: _activatedBy },
  });

  await createNotification(
    '[KILL SWITCH] All agent actions have been paused.',
    { type: 'killswitch', action: 'activated', activatedBy: _activatedBy }
  ).catch(() => {});
}

/**
 * Deactivate the kill switch — restarts crons, unblocks actions.
 * @param {string} [userId]
 */
export async function deactivateKillSwitch(userId) {
  _killed = false;
  _activatedAt = null;
  _activatedBy = null;

  persistState(false, userId);

  // Restart crons
  try {
    const { restartCrons } = await import('../cron.js');
    restartCrons();
  } catch (err) {
    console.error('[killswitch] Failed to restart crons:', err.message);
  }

  logAction({
    actionType: 'command',
    actionName: 'killswitch',
    source: 'api',
    status: 'success',
    result: 'Kill switch deactivated',
    metadata: { deactivatedBy: userId || 'system' },
  });

  await createNotification(
    '[KILL SWITCH] Agent actions have been resumed.',
    { type: 'killswitch', action: 'deactivated', deactivatedBy: userId || 'system' }
  ).catch(() => {});
}

/**
 * Check if the kill switch is active.
 * @returns {boolean}
 */
export function isKilled() {
  return _killed;
}

/**
 * Get full kill switch status.
 * @returns {{ active: boolean, activatedAt: number|null, activatedBy: string|null }}
 */
export function getKillSwitchStatus() {
  return {
    active: _killed,
    activatedAt: _activatedAt,
    activatedBy: _activatedBy,
  };
}

/**
 * Initialize kill switch from persisted state.
 * Called from instrumentation.js at startup.
 */
export function initKillSwitch() {
  try {
    const db = getDb();
    const row = db
      .select()
      .from(settings)
      .where(and(eq(settings.type, SETTING_TYPE), eq(settings.key, SETTING_KEY)))
      .get();

    if (row) {
      const state = JSON.parse(row.value);
      _killed = state.active || false;
      _activatedAt = state.activatedAt || null;
      _activatedBy = state.activatedBy || null;

      if (_killed) {
        console.log('[killswitch] Kill switch is ACTIVE (persisted state)');
      }
    }
  } catch (err) {
    console.error('[killswitch] Failed to read persisted state:', err.message);
  }
}
