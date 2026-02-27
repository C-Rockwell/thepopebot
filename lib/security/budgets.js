import { getSecurityConfig } from './config.js';
import { createNotification } from '../db/notifications.js';

/** @type {Map<string, { count: number, windowStart: number }>} */
const counters = new Map();

/**
 * Check if an action type is within its budget.
 * Throws if budget is exhausted.
 * @param {string} actionType - 'agent', 'command', or 'webhook'
 */
export async function checkBudget(actionType) {
  const config = getSecurityConfig();
  if (!config.budgets.enabled) return;

  const limitConfig = config.budgets.limits[actionType];
  if (!limitConfig) return;

  const { maxActions, windowMs } = limitConfig;
  const now = Date.now();
  let entry = counters.get(actionType);

  // Reset window if expired
  if (!entry || now - entry.windowStart >= windowMs) {
    entry = { count: 0, windowStart: now };
    counters.set(actionType, entry);
  }

  if (entry.count >= maxActions) {
    const remaining = Math.ceil((entry.windowStart + windowMs - now) / 1000);
    const message = `[SECURITY] Action budget exhausted for "${actionType}": ${maxActions} actions in ${windowMs / 60000} min window. Resets in ${remaining}s.`;

    // Notify via existing notification system (fire-and-forget)
    createNotification(message, {
      type: 'budget_exhausted',
      actionType,
      limit: maxActions,
      windowMs,
      resetsIn: remaining,
    }).catch((err) => {
      console.error('Failed to create budget notification:', err);
    });

    throw new Error(message);
  }
}

/**
 * Record a successful action execution.
 * @param {string} actionType - 'agent', 'command', or 'webhook'
 */
export function recordAction(actionType) {
  const config = getSecurityConfig();
  if (!config.budgets.enabled) return;

  const limitConfig = config.budgets.limits[actionType];
  if (!limitConfig) return;

  const now = Date.now();
  let entry = counters.get(actionType);

  // Reset window if expired
  if (!entry || now - entry.windowStart >= limitConfig.windowMs) {
    entry = { count: 0, windowStart: now };
    counters.set(actionType, entry);
  }

  entry.count++;
}

/**
 * Get current budget status for all action types.
 * @returns {Object} { agent: { used, limit, resetsIn }, ... }
 */
export function getBudgetStatus() {
  const config = getSecurityConfig();
  const status = {};
  const now = Date.now();

  for (const [actionType, limitConfig] of Object.entries(config.budgets.limits)) {
    const entry = counters.get(actionType);
    if (!entry || now - entry.windowStart >= limitConfig.windowMs) {
      status[actionType] = { used: 0, limit: limitConfig.maxActions, resetsIn: 0 };
    } else {
      const remaining = Math.ceil((entry.windowStart + limitConfig.windowMs - now) / 1000);
      status[actionType] = {
        used: entry.count,
        limit: limitConfig.maxActions,
        resetsIn: remaining,
      };
    }
  }

  return status;
}
