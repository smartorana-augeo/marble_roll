/**
 * Encore / Grove iframe and DigitaService-style integration: URL parameters, postMessage to parent.
 * Parent pages should verify `event.source` and `event.data.source === 'marble-roll'` before trusting payloads.
 */

const MSG_SOURCE = 'marble-roll';

/** @type {boolean} */
let _inited = false;
/** @type {boolean} */
let _active = false;
/** @type {string | null} */
let _sessionUid = null;
/** @type {boolean} */
let _autostart = false;
/** @type {boolean} */
let _firstInteractionSent = false;

/**
 * @param {unknown} data
 * @param {string} [targetOrigin]
 */
function postToParent(data, targetOrigin = '*') {
  if (typeof window === 'undefined') return;
  if (window.parent === window) return;
  try {
    window.parent.postMessage({ source: MSG_SOURCE, ...data }, targetOrigin);
  } catch {
    /* ignore */
  }
}

export function initEmbedHost() {
  if (_inited) return;
  _inited = true;

  const params = new URLSearchParams(window.location.search);
  const explicit =
    params.get('embed') === '1' ||
    params.get('embed') === 'true' ||
    params.get('embedded') === '1';
  const inFrame = (() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  })();

  _active = explicit || inFrame;
  if (!_active) return;

  _sessionUid = params.get('session_uid') ?? params.get('session') ?? null;
  _autostart = params.get('autostart') === '1' || params.get('autostart') === 'true';

  document.body.classList.add('embed');
  if (_autostart) document.body.classList.add('embed-autostart');

  window.addEventListener('message', (event) => {
    const d = event.data;
    if (!d || typeof d !== 'object') return;
    if (d.type === 'MARBLE_ROLL_PING') {
      postToParent({ type: 'pong', innerWidth: window.innerWidth, innerHeight: window.innerHeight });
    }
  });
}

export function isEmbedActive() {
  return _active;
}

export function shouldAutostart() {
  return _active && _autostart;
}

export function getSessionUid() {
  return _sessionUid;
}

export function notifyReady() {
  if (!_active) return;
  postToParent({
    type: 'ready',
    sessionUid: _sessionUid,
  });
}

/**
 * Fired after procgen / LevelLoader for a level (gameplay can begin).
 * @param {{ levelIndex: number }} payload
 */
export function notifyLevelLoaded(payload) {
  if (!_active) return;
  postToParent({
    type: 'levelLoaded',
    sessionUid: _sessionUid,
    levelIndex: payload.levelIndex,
  });
}

/**
 * First meaningful gameplay input (keyboard edge or pointer on canvas). Mirrors Drimify-style first interaction.
 */
export function notifyFirstInteraction() {
  if (!_active || _firstInteractionSent) return;
  _firstInteractionSent = true;
  postToParent({
    type: 'firstInteraction',
    sessionUid: _sessionUid,
  });
}

/**
 * Goal reached; payload shaped loosely like DigitaService widget `onComplete` (`credentials` + `gameMetrics`).
 * @param {{
 *   levelIndex: number,
 *   levelScore: number,
 *   runTotal: number,
 *   gameFinished: boolean,
 *   userWon: boolean,
 * }} payload
 */
export function notifyLevelComplete(payload) {
  if (!_active) return;
  const sessionID = _sessionUid ?? '';
  postToParent({
    type: 'complete',
    sessionUid: _sessionUid,
    data: {
      credentials: {
        sessionID,
        projectID: null,
        isPreviewMode: false,
      },
      gameMetrics: {
        userWon: payload.userWon,
        score: payload.runTotal,
        levelScore: payload.levelScore,
        levelIndex: payload.levelIndex,
        gameFinished: payload.gameFinished,
        prizeID: null,
        prizeImage: null,
      },
    },
  });
}
