/**
 * Player-facing copy only. Repo, package, and embed identifiers stay lowercase (e.g. marble_roll, marble-roll).
 * Keep the document title and #menu-heading in index.html in sync for the first paint before JS runs.
 */
export const DisplaySettings = {
  /** Main menu title and browser tab title */
  gameTitle: 'nova roll',
  /** Label above the control lines on the start screen */
  menuTagline: 'CONTROLS',
  /**
   * Canonical control copy: drives the title-screen key list and the in-game HUD legend.
   * `icon` is ASCII-only, shown in the HUD legend.
   * @type {ReadonlyArray<{ icon: string, action: string, keys: string }>}
   */
  controlBindings: Object.freeze([
    { icon: '<->', action: 'Move', keys: 'WASD' },
    { icon: '/\\', action: 'Jump', keys: 'Space' },
    { icon: '[=]', action: 'Brake', keys: 'Shift' },
    { icon: '[@]', action: 'Camera', keys: 'arrows' },
    { icon: '[*]', action: 'Restart', keys: 'R' },
  ]),
  /**
   * Shown only on the start-screen key list — not in the in-game HUD legend.
   * @type {ReadonlyArray<{ action: string, keys: string }>}
   */
  menuOnlyControlBindings: Object.freeze([{ action: 'Mute', keys: 'M' }]),
};

/**
 * One line per control on the title screen (#menu-keys).
 * @param {HTMLElement | null} el
 */
export function applyControlBindingsToMenuKeys(el) {
  if (!el || !DisplaySettings.controlBindings.length) return;
  el.replaceChildren();
  function appendLine(action, keys) {
    const line = document.createElement('span');
    line.className = 'keys__line';
    const actionEl = document.createElement('strong');
    actionEl.className = 'keys__action';
    actionEl.textContent = action;
    const keysEl = document.createElement('span');
    keysEl.className = 'keys__binding';
    keysEl.textContent = keys;
    line.appendChild(actionEl);
    line.appendChild(keysEl);
    el.appendChild(line);
  }
  for (const { action, keys } of DisplaySettings.controlBindings) {
    appendLine(action, keys);
  }
  for (const { action, keys } of DisplaySettings.menuOnlyControlBindings) {
    appendLine(action, keys);
  }
}
