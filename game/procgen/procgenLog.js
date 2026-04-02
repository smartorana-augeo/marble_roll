/**
 * Namespaced console logging for procedural generation (filter devtools on `[procgen]`).
 */

/**
 * @param {string} message
 * @param {Record<string, unknown>} [data]
 */
export function procgenLogInfo(message, data) {
  if (data !== undefined) {
    console.log(`[procgen] ${message}`, data);
  } else {
    console.log(`[procgen] ${message}`);
  }
}
