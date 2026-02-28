import { getVoiceConfig } from './config.js';

const PROVIDER_URLS = {
  openai: 'https://api.openai.com/v1/audio/speech',
};

const PROVIDER_KEYS = {
  openai: () => process.env.OPENAI_API_KEY,
};

const FORMAT_MIME = {
  opus: 'audio/ogg',
  mp3: 'audio/mpeg',
  aac: 'audio/aac',
  flac: 'audio/flac',
  wav: 'audio/wav',
  pcm: 'audio/pcm',
};

/**
 * Check if TTS is enabled (voice enabled + provider has an API key)
 * @returns {boolean}
 */
export function isTtsEnabled() {
  const config = getVoiceConfig();
  if (!config.enabled) return false;

  const key = PROVIDER_KEYS[config.tts.provider]?.();
  return Boolean(key);
}

/**
 * Synthesize speech from text.
 * @param {string} text - Text to synthesize
 * @param {Object} [options] - Override voice, speed, format
 * @returns {Promise<{ buffer: Buffer, mimeType: string, format: string }>}
 */
export async function synthesize(text, options = {}) {
  const config = getVoiceConfig();
  const provider = config.tts.provider;
  const apiKey = PROVIDER_KEYS[provider]?.();

  if (!apiKey) {
    throw new Error(`TTS provider "${provider}" requires an API key`);
  }

  const url = PROVIDER_URLS[provider];
  if (!url) {
    throw new Error(`Unknown TTS provider: ${provider}`);
  }

  const voice = options.voice || config.tts.voice;
  const speed = options.speed || config.tts.speed;
  const format = options.format || config.tts.format;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.tts.model,
      input: text,
      voice,
      speed,
      response_format: format,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`TTS API error: ${response.status} ${error}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const mimeType = FORMAT_MIME[format] || 'audio/ogg';

  return { buffer, mimeType, format };
}
