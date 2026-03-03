/**
 * Application-wide configuration constants.
 * Centralises all magic numbers to avoid duplication and ease future tuning.
 */

/** PBKDF2 iteration count for AES-GCM key derivation (OWASP 2023 recommendation) */
export const PBKDF2_ITERATIONS = 310_000;

/** Session inactivity timeout in milliseconds (30 minutes) */
export const SESSION_TIMEOUT_MS = 30 * 60 * 1_000;

/** Debounce delay for API key encryption writes in milliseconds */
export const ENCRYPT_DEBOUNCE_MS = 300;

/** Maximum consecutive PIN unlock attempts before temporary lockout */
export const MAX_UNLOCK_ATTEMPTS = 5;

/** Duration of PIN lockout in milliseconds (30 seconds) */
export const LOCKOUT_DURATION_MS = 30_000;

/** Gemini generateContent API request timeout in milliseconds (5 minutes) */
export const API_TIMEOUT_MS = 300_000;

/** Token count API request timeout in milliseconds (30 seconds) */
export const COUNT_TOKENS_TIMEOUT_MS = 30_000;

/** Maximum number of lines retained in the debug log textarea */
export const MAX_DEBUG_LOG_LINES = 500;
