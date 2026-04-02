/**
 * Easter egg: tap the menu build line ten times (within a short window) to open credits.
 * Fetches `/credits.md` and renders via {@link minimalMarkdownToHtml}.
 */

import { escapeHtml, minimalMarkdownToHtml } from '../../engine/markdown/minimalMarkdownToHtml.js';

/** Class names for the credits overlay panel (see `styles.css` `.credits-panel__*`). */
const CREDITS_MD_CLASSES = Object.freeze({
  paragraph: 'credits-panel__p',
  h2: 'credits-panel__h2',
  h3: 'credits-panel__h3',
  h4: 'credits-panel__h4',
  ul: 'credits-panel__ul',
  li: 'credits-panel__li',
  link: 'credits-panel__a',
  strong: 'credits-panel__strong',
});

let _loadedMarkdown = /** @type {string | null} */ (null);

async function fetchCreditsMarkdown() {
  if (_loadedMarkdown !== null) return _loadedMarkdown;
  const url = new URL('credits.md', window.location.href).href;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Could not load credits (${res.status})`);
  }
  _loadedMarkdown = await res.text();
  return _loadedMarkdown;
}

export function wireCreditsOverlay() {
  const screen = document.getElementById('screen-credits');
  const body = document.getElementById('credits-body');
  const closeBtn = document.getElementById('btn-credits-close');
  const build = document.getElementById('menu-build');
  const newGame = document.getElementById('btn-new-game');

  if (!screen || !body || !closeBtn) return;

  let loadPromise = /** @type {Promise<void> | null} */ (null);

  function hideCredits() {
    screen.hidden = true;
    screen.classList.remove('screen--visible');
    screen.setAttribute('aria-hidden', 'true');
  }

  function showCredits() {
    screen.hidden = false;
    screen.classList.add('screen--visible');
    screen.setAttribute('aria-hidden', 'false');
  }

  async function ensureCreditsRendered() {
    if (loadPromise) {
      await loadPromise;
      return;
    }
    loadPromise = (async () => {
      try {
        const md = await fetchCreditsMarkdown();
        body.innerHTML = minimalMarkdownToHtml(md, CREDITS_MD_CLASSES);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        body.innerHTML = `<p class="credits-panel__p credits-panel__p--error">${escapeHtml(msg)}</p>`;
      }
    })();
    await loadPromise;
  }

  async function openCredits() {
    showCredits();
    await ensureCreditsRendered();
    closeBtn.focus();
  }

  closeBtn.addEventListener('click', () => {
    hideCredits();
  });

  newGame?.addEventListener('click', () => {
    hideCredits();
  });

  document.addEventListener(
    'keydown',
    (e) => {
      if (e.key !== 'Escape') return;
      if (screen.hidden) return;
      hideCredits();
    },
    true,
  );

  /** Consecutive taps within this window count toward the Easter egg. */
  const TAP_GAP_MS = 2800;
  let tapCount = 0;
  let lastTapAt = 0;

  build?.addEventListener('click', (e) => {
    e.preventDefault();
    const now = Date.now();
    if (now - lastTapAt > TAP_GAP_MS) {
      tapCount = 0;
    }
    lastTapAt = now;
    tapCount += 1;
    if (tapCount >= 10) {
      tapCount = 0;
      void openCredits();
    }
  });
}
