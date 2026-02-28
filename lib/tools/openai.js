/**
 * OpenAI Whisper — backward-compatible re-exports from lib/voice/stt.js
 *
 * Legacy code importing { isWhisperEnabled, transcribeAudio } from this file
 * will continue to work. New code should import from '../voice/stt.js' directly.
 */
export { isSttEnabled as isWhisperEnabled, transcribe as transcribeAudio } from '../voice/stt.js';
