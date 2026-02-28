import { getVoiceConfig } from './config.js';

const PROVIDER_URLS = {
  groq: 'https://api.groq.com/openai/v1/audio/transcriptions',
  openai: 'https://api.openai.com/v1/audio/transcriptions',
};

const PROVIDER_KEYS = {
  groq: () => process.env.GROQ_API_KEY,
  openai: () => process.env.OPENAI_API_KEY,
};

/**
 * Check if STT is enabled (voice enabled + at least one provider has an API key)
 * @returns {boolean}
 */
export function isSttEnabled() {
  const config = getVoiceConfig();
  if (!config.enabled) return false;

  const primaryKey = PROVIDER_KEYS[config.stt.provider]?.();
  const fallbackKey = PROVIDER_KEYS[config.stt.fallbackProvider]?.();
  return Boolean(primaryKey || fallbackKey);
}

/**
 * Transcribe audio using the configured provider with fallback.
 * @param {Buffer} audioBuffer - Audio file buffer
 * @param {string} filename - Original filename (e.g., "voice.ogg")
 * @returns {Promise<string>} Transcribed text
 */
export async function transcribe(audioBuffer, filename) {
  const config = getVoiceConfig();

  // Validate file size
  const maxBytes = (config.stt.maxAudioSizeMb || 25) * 1024 * 1024;
  if (audioBuffer.length > maxBytes) {
    throw new Error(`Audio file too large (${(audioBuffer.length / 1024 / 1024).toFixed(1)}MB, max ${config.stt.maxAudioSizeMb}MB)`);
  }

  const primaryKey = PROVIDER_KEYS[config.stt.provider]?.();
  const fallbackKey = PROVIDER_KEYS[config.stt.fallbackProvider]?.();

  // Try primary provider
  if (primaryKey) {
    try {
      return await transcribeWith(
        PROVIDER_URLS[config.stt.provider],
        primaryKey,
        config.stt.model,
        audioBuffer,
        filename
      );
    } catch (err) {
      console.error(`[voice/stt] ${config.stt.provider} failed, trying fallback:`, err.message);
      if (!fallbackKey) throw err;
    }
  }

  // Try fallback provider
  if (fallbackKey) {
    return await transcribeWith(
      PROVIDER_URLS[config.stt.fallbackProvider],
      fallbackKey,
      config.stt.fallbackModel,
      audioBuffer,
      filename
    );
  }

  throw new Error('No STT provider available — set GROQ_API_KEY or OPENAI_API_KEY');
}

/**
 * Transcribe audio with a specific provider.
 * @param {string} url - Provider API URL
 * @param {string} apiKey - API key
 * @param {string} model - Model name
 * @param {Buffer} audioBuffer - Audio file buffer
 * @param {string} filename - Original filename
 * @returns {Promise<string>}
 */
async function transcribeWith(url, apiKey, model, audioBuffer, filename) {
  const formData = new FormData();
  formData.append('file', new Blob([audioBuffer]), filename);
  formData.append('model', model);

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}` },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`STT API error: ${response.status} ${error}`);
  }

  const result = await response.json();
  return result.text;
}
