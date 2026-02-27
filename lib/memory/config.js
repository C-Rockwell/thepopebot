import fs from 'fs';
import { memoryFile } from '../paths.js';

const DEFAULTS = {
  enabled: true,
  tier1: {
    maxMemories: 10000,
    defaultSalienceScore: 1.0,
    decay: {
      curve: 'exponential',
      halfLifeMs: 604800000, // 7 days
      minScore: 0.1,
      reinforceAmount: 0.3,
    },
    search: {
      maxResults: 10,
      minSalienceScore: 0.2,
    },
  },
  tier2: {
    enabled: true,
    provider: 'openai',
    model: 'text-embedding-3-small',
    dimensions: 1536,
  },
  autoCapture: {
    conversations: true,
    jobSummaries: true,
    minExchanges: 3,
  },
  poisonDetection: {
    enabled: true,
    patterns: [
      'ignore previous',
      'you are now',
      'system:',
      'ignore all',
      'disregard previous',
      'override system prompt',
      'new instructions:',
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
 * Load and cache memory configuration.
 * Deep-merges user's MEMORY.json with hardcoded defaults.
 */
export function getMemoryConfig() {
  if (_cached) return _cached;

  let userConfig = {};
  try {
    if (fs.existsSync(memoryFile)) {
      userConfig = JSON.parse(fs.readFileSync(memoryFile, 'utf8'));
    }
  } catch (err) {
    console.error('Failed to read MEMORY.json, using defaults:', err.message);
  }

  _cached = deepMerge(structuredClone(DEFAULTS), userConfig);
  return _cached;
}

/** Force reload (useful for testing) */
export function reloadMemoryConfig() {
  _cached = null;
  return getMemoryConfig();
}
