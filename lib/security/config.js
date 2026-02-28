import fs from 'fs';
import { securityFile } from '../paths.js';

const DEFAULTS = {
  rateLimits: {
    enabled: true,
    tiers: {
      api: { maxRequests: 60, windowMs: 60000 },
      public: { maxRequests: 30, windowMs: 60000 },
      telegram: { maxRequests: 20, windowMs: 60000 },
    },
  },
  budgets: {
    enabled: true,
    limits: {
      agent: { maxActions: 10, windowMs: 3600000 },
      command: { maxActions: 60, windowMs: 3600000 },
      webhook: { maxActions: 120, windowMs: 3600000 },
      memory_summarize: { maxActions: 5, windowMs: 3600000 },
      voice: { maxActions: 30, windowMs: 3600000 },
    },
  },
  sanitization: {
    enabled: true,
    logBlocked: true,
    stripPatterns: [
      'ignore previous instructions',
      'ignore all previous',
      'disregard previous',
      'override system prompt',
      'you are now',
      'new instructions:',
      'system: ',
      '\\[INST\\]',
      '<<SYS>>',
      '<\\|im_start\\|>system',
    ],
  },
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
 * Load and cache security configuration.
 * Deep-merges user's SECURITY.json with hardcoded defaults.
 */
export function getSecurityConfig() {
  if (_cached) return _cached;

  let userConfig = {};
  try {
    if (fs.existsSync(securityFile)) {
      userConfig = JSON.parse(fs.readFileSync(securityFile, 'utf8'));
    }
  } catch (err) {
    console.error('Failed to read SECURITY.json, using defaults:', err.message);
  }

  _cached = deepMerge(structuredClone(DEFAULTS), userConfig);
  return _cached;
}

/** Force reload (useful for testing) */
export function reloadSecurityConfig() {
  _cached = null;
  return getSecurityConfig();
}
