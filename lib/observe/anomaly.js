import { getObserveConfig } from './config.js';
import { getActionCountSince, getErrorActionNames, getErrorCountByName, getActionLogStats } from '../db/action-log.js';
import { insertAlert, hasRecentAlert } from '../db/anomaly-alerts.js';
import { getBudgetStatus } from '../security/budgets.js';
import { createNotification } from '../db/notifications.js';

/**
 * Run all anomaly checks.
 */
export function checkAnomalies() {
  const config = getObserveConfig();
  if (!config.anomaly.enabled) return;

  try {
    checkFrequencySpike(config);
    checkOffHoursActivity(config);
    checkRepeatedErrors(config);
    checkBudgetWarning(config);
  } catch (err) {
    console.error('[anomaly] Check failed:', err.message);
  }
}

/**
 * Check for frequency spikes — action count in last 15 min vs 7-day rolling average.
 */
function checkFrequencySpike(config) {
  const now = Date.now();
  const fifteenMin = 15 * 60 * 1000;
  const sevenDays = 7 * 24 * 60 * 60 * 1000;

  const recentCount = getActionCountSince(now - fifteenMin);
  if (recentCount <= 5) return; // Minimum threshold

  // Calculate 7-day average for same 15-min window
  const weekCount = getActionCountSince(now - sevenDays);
  // Number of 15-min windows in 7 days = 672
  const avgPer15Min = weekCount / 672;

  if (avgPer15Min > 0 && recentCount > avgPer15Min * config.anomaly.frequencyMultiplier) {
    if (hasRecentAlert('frequency_spike')) return;

    const alert = insertAlert({
      alertType: 'frequency_spike',
      severity: recentCount > avgPer15Min * config.anomaly.frequencyMultiplier * 2 ? 'critical' : 'warning',
      message: `Action frequency spike: ${recentCount} actions in last 15 min (avg: ${avgPer15Min.toFixed(1)})`,
      details: { recentCount, averagePer15Min: avgPer15Min, multiplier: config.anomaly.frequencyMultiplier },
    });

    if (alert.severity !== 'info') {
      createNotification(
        `[ANOMALY] ${alert.message}`,
        { type: 'anomaly', alertType: 'frequency_spike' }
      ).catch(() => {});
    }
  }
}

/**
 * Check for off-hours activity.
 */
function checkOffHoursActivity(config) {
  const now = new Date();
  const hour = now.getHours();
  const { start, end } = config.anomaly.normalHours;

  // Only check during off-hours
  if (hour >= start && hour < end) return;

  const oneHourAgo = Date.now() - 3600000;
  const count = getActionCountSince(oneHourAgo);

  if (count > config.anomaly.offHoursThreshold) {
    if (hasRecentAlert('unusual_hour')) return;

    const alert = insertAlert({
      alertType: 'unusual_hour',
      severity: 'warning',
      message: `Off-hours activity: ${count} actions at ${hour}:00 (normal hours: ${start}:00-${end}:00)`,
      details: { hour, count, threshold: config.anomaly.offHoursThreshold },
    });

    createNotification(
      `[ANOMALY] ${alert.message}`,
      { type: 'anomaly', alertType: 'unusual_hour' }
    ).catch(() => {});
  }
}

/**
 * Check for repeated errors from the same action name.
 */
function checkRepeatedErrors(config) {
  const oneHourAgo = Date.now() - 3600000;
  const errorNames = getErrorActionNames(oneHourAgo);

  for (const actionName of errorNames) {
    const errorCount = getErrorCountByName(actionName, oneHourAgo);

    if (errorCount >= config.anomaly.errorThreshold) {
      if (hasRecentAlert('repeated_error')) return;

      const alert = insertAlert({
        alertType: 'repeated_error',
        severity: errorCount >= config.anomaly.errorThreshold * 2 ? 'critical' : 'warning',
        message: `Repeated errors: "${actionName}" failed ${errorCount} times in the last hour`,
        details: { actionName, errorCount, threshold: config.anomaly.errorThreshold },
      });

      if (alert.severity !== 'info') {
        createNotification(
          `[ANOMALY] ${alert.message}`,
          { type: 'anomaly', alertType: 'repeated_error' }
        ).catch(() => {});
      }
    }
  }
}

/**
 * Check for budget types approaching exhaustion (>80% consumed).
 */
function checkBudgetWarning(config) {
  const budgets = getBudgetStatus();

  for (const [actionType, status] of Object.entries(budgets)) {
    if (status.limit === 0) continue;
    const pct = status.used / status.limit;

    if (pct >= 0.8) {
      const alertKey = `budget_warning_${actionType}`;
      if (hasRecentAlert('budget_warning')) continue;

      const alert = insertAlert({
        alertType: 'budget_warning',
        severity: pct >= 1.0 ? 'critical' : 'warning',
        message: `Budget warning: "${actionType}" at ${Math.round(pct * 100)}% (${status.used}/${status.limit})`,
        details: { actionType, used: status.used, limit: status.limit, resetsIn: status.resetsIn },
      });

      if (alert.severity !== 'info') {
        createNotification(
          `[ANOMALY] ${alert.message}`,
          { type: 'anomaly', alertType: 'budget_warning' }
        ).catch(() => {});
      }
    }
  }
}

/**
 * Start the periodic anomaly check timer.
 * Called from instrumentation.js.
 */
export function startAnomalyTimer() {
  const config = getObserveConfig();
  const interval = setInterval(checkAnomalies, config.anomaly.checkIntervalMs);
  interval.unref();
  console.log(`[anomaly] Detection started (interval: ${config.anomaly.checkIntervalMs / 1000}s)`);
}
