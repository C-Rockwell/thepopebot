import fs from 'fs';
import { observeFile } from '../paths.js';

const DEFAULTS = {
  logger: { enabled: true, retentionDays: 30 },
  anomaly: {
    enabled: true,
    checkIntervalMs: 900000,
    frequencyMultiplier: 3.0,
    offHoursThreshold: 5,
    normalHours: { start: 6, end: 23 },
    errorThreshold: 3,
  },
  dashboard: { refreshIntervalMs: 10000, actionLogPageSize: 20 },
};

/** Deep-merge source into target (mutates target) */
function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === 'object' &&
      !Array.isArray(target[key])
    ) {
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

let _cached = null;

/**
 * Load and cache observe configuration.
 * Deep-merges user's OBSERVE.json with hardcoded defaults.
 */
export function getObserveConfig() {
  if (_cached) return _cached;

  let userConfig = {};
  try {
    if (fs.existsSync(observeFile)) {
      userConfig = JSON.parse(fs.readFileSync(observeFile, 'utf8'));
    }
  } catch (err) {
    console.error('Failed to read OBSERVE.json, using defaults:', err.message);
  }

  _cached = deepMerge(structuredClone(DEFAULTS), userConfig);
  return _cached;
}

/** Force reload (useful for testing) */
export function reloadObserveConfig() {
  _cached = null;
  return getObserveConfig();
}
