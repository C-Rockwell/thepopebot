'use server';

import { auth } from '../auth/index.js';
import {
  createChat as dbCreateChat,
  getChatById,
  getMessagesByChatId,
  deleteChat as dbDeleteChat,
  deleteAllChatsByUser,
  updateChatTitle,
  toggleChatStarred,
} from '../db/chats.js';
import {
  getNotifications as dbGetNotifications,
  getUnreadCount as dbGetUnreadCount,
  markAllRead as dbMarkAllRead,
} from '../db/notifications.js';

/**
 * Get the authenticated user or throw.
 */
async function requireAuth() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }
  return session.user;
}

/**
 * Get all chats for the authenticated user (includes Telegram chats).
 * @returns {Promise<object[]>}
 */
export async function getChats() {
  const user = await requireAuth();
  const { or, eq, desc } = await import('drizzle-orm');
  const { getDb } = await import('../db/index.js');
  const { chats } = await import('../db/schema.js');
  const db = getDb();
  return db
    .select()
    .from(chats)
    .where(or(eq(chats.userId, user.id), eq(chats.userId, 'telegram')))
    .orderBy(desc(chats.updatedAt))
    .all();
}

/**
 * Get messages for a specific chat (with ownership check).
 * @param {string} chatId
 * @returns {Promise<object[]>}
 */
export async function getChatMessages(chatId) {
  const user = await requireAuth();
  const chat = getChatById(chatId);
  if (!chat || (chat.userId !== user.id && chat.userId !== 'telegram')) {
    return [];
  }
  return getMessagesByChatId(chatId);
}

/**
 * Create a new chat.
 * @param {string} [id] - Optional chat ID
 * @param {string} [title='New Chat']
 * @returns {Promise<object>}
 */
export async function createChat(id, title = 'New Chat') {
  const user = await requireAuth();
  return dbCreateChat(user.id, title, id);
}

/**
 * Delete a chat (with ownership check).
 * @param {string} chatId
 * @returns {Promise<{success: boolean}>}
 */
export async function deleteChat(chatId) {
  const user = await requireAuth();
  const chat = getChatById(chatId);
  if (!chat || chat.userId !== user.id) {
    return { success: false };
  }
  dbDeleteChat(chatId);
  return { success: true };
}

/**
 * Rename a chat (with ownership check).
 * @param {string} chatId
 * @param {string} title
 * @returns {Promise<{success: boolean}>}
 */
export async function renameChat(chatId, title) {
  const user = await requireAuth();
  const chat = getChatById(chatId);
  if (!chat || chat.userId !== user.id) {
    return { success: false };
  }
  updateChatTitle(chatId, title);
  return { success: true };
}

/**
 * Toggle a chat's starred status (with ownership check).
 * @param {string} chatId
 * @returns {Promise<{success: boolean, starred?: number}>}
 */
export async function starChat(chatId) {
  const user = await requireAuth();
  const chat = getChatById(chatId);
  if (!chat || chat.userId !== user.id) {
    return { success: false };
  }
  const starred = toggleChatStarred(chatId);
  return { success: true, starred };
}

/**
 * Delete all chats for the authenticated user.
 * @returns {Promise<{success: boolean}>}
 */
export async function deleteAllChats() {
  const user = await requireAuth();
  deleteAllChatsByUser(user.id);
  return { success: true };
}

/**
 * Get all notifications, newest first.
 * @returns {Promise<object[]>}
 */
export async function getNotifications() {
  await requireAuth();
  return dbGetNotifications();
}

/**
 * Get count of unread notifications.
 * @returns {Promise<number>}
 */
export async function getUnreadNotificationCount() {
  await requireAuth();
  return dbGetUnreadCount();
}

/**
 * Mark all notifications as read.
 * @returns {Promise<{success: boolean}>}
 */
export async function markNotificationsRead() {
  await requireAuth();
  dbMarkAllRead();
  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// App info actions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get the installed package version and update status (auth-gated, never in client bundle).
 * @returns {Promise<{ version: string, updateAvailable: string|null }>}
 */
export async function getAppVersion() {
  await requireAuth();
  const { getInstalledVersion } = await import('../cron.js');
  const { getAvailableVersion, getReleaseNotes } = await import('../db/update-check.js');
  return {
    version: getInstalledVersion(),
    updateAvailable: getAvailableVersion(),
    changelog: getReleaseNotes(),
  };
}

/**
 * Trigger the upgrade-event-handler workflow via GitHub Actions.
 * @returns {Promise<{ success: boolean }>}
 */
export async function triggerUpgrade() {
  await requireAuth();
  const { triggerWorkflowDispatch } = await import('../tools/github.js');
  const { getAvailableVersion } = await import('../db/update-check.js');
  const targetVersion = getAvailableVersion();
  await triggerWorkflowDispatch('upgrade-event-handler.yml', 'main', {
    target_version: targetVersion || '',
  });
  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// API Key actions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create (or replace) the API key.
 * @returns {Promise<{ key: string, record: object } | { error: string }>}
 */
export async function createNewApiKey() {
  const user = await requireAuth();
  try {
    const { createApiKeyRecord } = await import('../db/api-keys.js');
    return createApiKeyRecord(user.id);
  } catch (err) {
    console.error('Failed to create API key:', err);
    return { error: 'Failed to create API key' };
  }
}

/**
 * Get the current API key metadata (no hash).
 * @returns {Promise<object|null>}
 */
export async function getApiKeys() {
  await requireAuth();
  try {
    const { getApiKey } = await import('../db/api-keys.js');
    return getApiKey();
  } catch (err) {
    console.error('Failed to get API key:', err);
    return null;
  }
}

/**
 * Delete the API key.
 * @returns {Promise<{ success: boolean } | { error: string }>}
 */
export async function deleteApiKey() {
  await requireAuth();
  try {
    const mod = await import('../db/api-keys.js');
    mod.deleteApiKey();
    return { success: true };
  } catch (err) {
    console.error('Failed to delete API key:', err);
    return { error: 'Failed to delete API key' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Mission Control (Dashboard) actions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get aggregated dashboard data for initial load.
 * @returns {Promise<object>}
 */
export async function getDashboardData() {
  await requireAuth();
  try {
    const { getBudgetStatus } = await import('../security/budgets.js');
    const { queryActionLog, getActionLogStats } = await import('../db/action-log.js');
    const { getAlerts, getUnacknowledgedCount } = await import('../db/anomaly-alerts.js');
    const { getKillSwitchStatus } = await import('../observe/killswitch.js');
    const { getMemoryStats } = await import('../db/memories.js');
    const { getCronCount } = await import('../cron.js');

    const now = Date.now();
    const oneHourAgo = now - 3600000;

    // Read crons + triggers counts
    const fs = await import('fs');
    const { cronsFile, triggersFile } = await import('../paths.js');
    let cronCount = 0;
    let triggerCount = 0;
    try {
      const crons = JSON.parse(fs.readFileSync(cronsFile, 'utf8'));
      cronCount = crons.filter(c => c.enabled !== false).length;
    } catch {}
    try {
      const triggers = JSON.parse(fs.readFileSync(triggersFile, 'utf8'));
      triggerCount = triggers.filter(t => t.enabled !== false).length;
    } catch {}

    return {
      budgets: getBudgetStatus(),
      recentActions: queryActionLog({ limit: 10 }),
      alerts: getAlerts({ unacknowledgedOnly: true, limit: 5 }),
      unacknowledgedAlertCount: getUnacknowledgedCount(),
      killSwitch: getKillSwitchStatus(),
      memoryStats: getMemoryStats(),
      cronCount,
      triggerCount,
      actionStats: getActionLogStats(oneHourAgo),
    };
  } catch (err) {
    console.error('Failed to get dashboard data:', err);
    return { error: 'Failed to load dashboard data' };
  }
}

/**
 * Get paginated action log with optional filters.
 * @param {number} [page=1]
 * @param {object} [filters]
 * @returns {Promise<{ entries: object[], total: number, page: number, pageSize: number }>}
 */
export async function getActionLog(page = 1, filters = {}) {
  await requireAuth();
  try {
    const { queryActionLog, getActionLogCount } = await import('../db/action-log.js');
    const { getObserveConfig } = await import('../observe/config.js');
    const config = getObserveConfig();
    const pageSize = config.dashboard.actionLogPageSize;
    const offset = (page - 1) * pageSize;

    const entries = queryActionLog({ ...filters, limit: pageSize, offset });
    const total = getActionLogCount(filters);

    return { entries, total, page, pageSize };
  } catch (err) {
    console.error('Failed to get action log:', err);
    return { entries: [], total: 0, page, pageSize: 20 };
  }
}

/**
 * Toggle kill switch on/off.
 * @returns {Promise<{ active: boolean }>}
 */
export async function toggleKillSwitch() {
  const user = await requireAuth();
  try {
    const { isKilled, activateKillSwitch, deactivateKillSwitch } = await import('../observe/killswitch.js');
    if (isKilled()) {
      await deactivateKillSwitch(user.id);
    } else {
      await activateKillSwitch(user.id);
    }
    return { active: isKilled() };
  } catch (err) {
    console.error('Failed to toggle kill switch:', err);
    return { error: 'Failed to toggle kill switch' };
  }
}

/**
 * Acknowledge a single anomaly alert.
 * @param {string} alertId
 * @returns {Promise<{ success: boolean }>}
 */
export async function acknowledgeAnomaly(alertId) {
  await requireAuth();
  try {
    const { acknowledgeAlert } = await import('../db/anomaly-alerts.js');
    acknowledgeAlert(alertId);
    return { success: true };
  } catch (err) {
    console.error('Failed to acknowledge alert:', err);
    return { success: false };
  }
}

/**
 * Acknowledge all unacknowledged anomaly alerts.
 * @returns {Promise<{ success: boolean }>}
 */
export async function acknowledgeAllAnomalies() {
  await requireAuth();
  try {
    const { acknowledgeAllAlerts } = await import('../db/anomaly-alerts.js');
    acknowledgeAllAlerts();
    return { success: true };
  } catch (err) {
    console.error('Failed to acknowledge all alerts:', err);
    return { success: false };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Swarm actions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get swarm status (active + completed jobs with counts).
 * @returns {Promise<object>}
 */
export async function getSwarmStatus(page = 1) {
  await requireAuth();
  try {
    const { getSwarmStatus: fetchStatus } = await import('../tools/github.js');
    return await fetchStatus(page);
  } catch (err) {
    console.error('Failed to get swarm status:', err);
    return { error: 'Failed to get swarm status', runs: [], hasMore: false };
  }
}

/**
 * Get swarm config (crons + triggers).
 * @returns {Promise<{ crons: object[], triggers: object[] }>}
 */
export async function getSwarmConfig() {
  await requireAuth();
  const { cronsFile, triggersFile } = await import('../paths.js');
  const fs = await import('fs');
  let crons = [];
  let triggers = [];
  try { crons = JSON.parse(fs.readFileSync(cronsFile, 'utf8')); } catch {}
  try { triggers = JSON.parse(fs.readFileSync(triggersFile, 'utf8')); } catch {}
  return { crons, triggers };
}

