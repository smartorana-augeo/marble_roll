/**
 * Music mute default and persistence. Used by `MusicPlaylist` + mute controls.
 */

export const AudioSettings = Object.freeze({
  /**
   * Bumped when default behaviour should apply to everyone again (e.g. default = muted).
   * Absent key ⇒ use `defaultMuted`.
   */
  storageKey: 'marble_roll_music_muted_v2',
  /** When no preference is stored, music starts muted (user unmutes with M or the control). */
  defaultMuted: true,
});

/**
 * @returns {boolean} True if the user has chosen muted; false means music on (default).
 */
export function loadStoredMuted() {
  try {
    const raw = localStorage.getItem(AudioSettings.storageKey);
    if (raw == null) return AudioSettings.defaultMuted;
    return raw === '1' || raw === 'true';
  } catch {
    return AudioSettings.defaultMuted;
  }
}
