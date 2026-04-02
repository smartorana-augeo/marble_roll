/**
 * Binds menu + HUD mute toggles to one music playlist instance.
 * @param {import('../../engine/audio/MusicPlaylist.js').MusicPlaylist} music
 * @returns {{ sync: () => void }}
 */
export function wireMuteButtons(music) {
  const menuBtn = document.getElementById('btn-menu-music-mute');
  const hudBtn = document.getElementById('btn-hud-music-mute');
  const menuTip = document.getElementById('tooltip-menu-mute');
  const hudTip = document.getElementById('tooltip-hud-mute');

  function syncButtons() {
    const muted = music.isMuted();
    const tipText = muted ? 'Unmute' : 'Mute';
    /** ASCII: sound on `|>`, muted `|x` */
    const icon = muted ? '|x' : '|>';

    if (menuBtn) {
      menuBtn.setAttribute('aria-pressed', muted ? 'true' : 'false');
      menuBtn.setAttribute('aria-label', muted ? 'Unmute music' : 'Mute music');
      const label = menuBtn.querySelector('.btn-mute__label');
      if (label) label.textContent = icon;
      if (menuTip) menuTip.textContent = tipText;
    }
    if (hudBtn) {
      hudBtn.setAttribute('aria-pressed', muted ? 'true' : 'false');
      hudBtn.setAttribute('aria-label', muted ? 'Unmute music' : 'Mute music');
      const label = hudBtn.querySelector('.btn-mute__label');
      if (label) label.textContent = icon;
      if (hudTip) hudTip.textContent = tipText;
    }
  }

  /**
   * @param {MouseEvent} e
   */
  function onToggle(e) {
    music.toggleMuted();
    syncButtons();
    music.ensurePlayback();
    const t = e.currentTarget;
    if (t instanceof HTMLElement) t.blur();
  }

  for (const btn of [menuBtn, hudBtn]) {
    if (!btn) continue;
    btn.addEventListener('click', onToggle);
  }

  if (!menuBtn || !hudBtn) {
    console.warn('[music] mute button elements missing', {
      menu: !!menuBtn,
      hud: !!hudBtn,
    });
  }

  syncButtons();
  return { sync: syncButtons };
}
