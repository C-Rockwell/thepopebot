import fs from 'fs';
import { voiceFile } from '../paths.js';

const DEFAULTS = {
  enabled: false,
  stt: {
    provider: 'groq',
    model: 'whisper-large-v3-turbo',
    fallbackProvider: 'openai',
    fallbackModel: 'whisper-1',
    maxAudioSizeMb: 25,
  },
  tts: {
    provider: 'openai',
    model: 'tts-1',
    voice: 'alloy',
    speed: 1.0,
    format: 'opus',
  },
  channels: {
    telegram: { ttsEnabled: false },
    web: { ttsEnabled: false, sttEnabled: false },
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
 * Load and cache voice configuration.
 * Deep-merges user's VOICE.json with hardcoded defaults.
 */
export function getVoiceConfig() {
  if (_cached) return _cached;

  let userConfig = {};
  try {
    if (fs.existsSync(voiceFile)) {
      userConfig = JSON.parse(fs.readFileSync(voiceFile, 'utf8'));
    }
  } catch (err) {
    console.error('Failed to read VOICE.json, using defaults:', err.message);
  }

  _cached = deepMerge(structuredClone(DEFAULTS), userConfig);
  return _cached;
}

/** Force reload (useful for testing) */
export function reloadVoiceConfig() {
  _cached = null;
  return getVoiceConfig();
}
