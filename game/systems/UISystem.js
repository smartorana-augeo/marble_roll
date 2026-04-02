import { DisplaySettings } from '../config/DisplaySettings.js';
import { GameplaySettings } from '../config/GameplaySettings.js';

/**
 * DOM overlays: menu, level complete, HUD. Does not own game logic.
 */
export class UISystem {
  constructor() {
    this.appRoot = document.getElementById('app');
    this.menu = document.getElementById('screen-menu');
    this.levelComplete = document.getElementById('screen-level-complete');
    this.runGameOver = document.getElementById('screen-run-game-over');
    this.runOverHint = document.getElementById('run-over-hint');
    this.runOverCoins = document.getElementById('run-over-coins');
    this.hud = document.getElementById('hud');
    this.hudLevelName = document.getElementById('hud-level-name');
    this.hudFallsRow = document.getElementById('hud-falls-row');
    this.hudCoinsLevel = document.getElementById('hud-coins-level');
    this.hudCoinsRun = document.getElementById('hud-coins-run');
    this.levelCompleteTitle = document.getElementById('level-complete-title');
    this.levelCompleteScores = document.getElementById('level-complete-scores');
    this.levelCompleteMsg = document.getElementById('level-complete-msg');
    this.btnNewGame = document.getElementById('btn-new-game');
    this.devModeCheckbox = document.getElementById('dev-mode');
    this.devBypassWrap = document.getElementById('dev-bypass-wrap');
    this.btnDevSkip = document.getElementById('btn-dev-skip-level');
    this.btnContinue = document.getElementById('btn-continue');
    this.marbleDead = document.getElementById('screen-marble-dead');
    this.btnTryAgain = document.getElementById('btn-try-again');
    this.btnRunRestart = document.getElementById('btn-run-restart');
    this.btnRunMenu = document.getElementById('btn-run-menu');
    this.runOverDevActions = document.getElementById('run-over-dev-actions');
    this.btnDevRunRestartCurrentLevel = document.getElementById('btn-dev-run-restart-current-level');
    this.loadingOverlay = document.getElementById('loading-overlay');
    this.loadingTitle = document.getElementById('loading-overlay-title');
    this.loadingPhase = document.getElementById('loading-phase');
    this.loadingProgress = document.getElementById('loading-progress');
    this.menuSubtitle = document.getElementById('menu-subtitle');
    this.hudControlsLegend = document.getElementById('hud-controls-legend');
    /** @type {string | null} */
    this._menuSubtitleDefault = null;
    this._fillHudControlLegend();
    this._applyDevFeatureVisibility();
  }

  /** Hides dev-only controls when {@link GameplaySettings.dev.enabled} is false. */
  _applyDevFeatureVisibility() {
    if (GameplaySettings.dev.enabled) return;
    const label = document.querySelector('.dev-mode-label');
    if (label) label.hidden = true;
    if (this.devModeCheckbox) {
      this.devModeCheckbox.checked = false;
      this.devModeCheckbox.disabled = true;
    }
    if (this.runOverDevActions) this.runOverDevActions.hidden = true;
    if (this.devBypassWrap) this.devBypassWrap.hidden = true;
  }

  _fillHudControlLegend() {
    const el = this.hudControlsLegend;
    if (!el || !DisplaySettings.controlBindings.length) return;
    el.replaceChildren();
    for (const { icon, action, keys } of DisplaySettings.controlBindings) {
      const line = document.createElement('span');
      line.className = 'hud-legend__line';
      const iconEl = document.createElement('span');
      iconEl.className = 'hud-legend__icon';
      iconEl.textContent = icon;
      const textEl = document.createElement('span');
      textEl.className = 'hud-legend__text';
      const labelStrong = document.createElement('strong');
      labelStrong.className = 'hud-legend__action';
      labelStrong.textContent = action;
      const keysEl = document.createElement('span');
      keysEl.className = 'hud-legend__keys';
      keysEl.textContent = keys;
      textEl.appendChild(labelStrong);
      textEl.appendChild(keysEl);
      line.appendChild(iconEl);
      line.appendChild(textEl);
      el.appendChild(line);
    }
  }

  /**
   * While the level manifest is fetching, show status. Do not disable the primary button: disabled
   * controls do not receive click events, so a stuck fetch would make “New game” appear dead.
   * @param {boolean} loading
   */
  setMenuManifestLoading(loading) {
    if (this.menuSubtitle && this._menuSubtitleDefault === null) {
      this._menuSubtitleDefault = this.menuSubtitle.textContent ?? '';
    }
    if (this.menuSubtitle) {
      this.menuSubtitle.textContent = loading
        ? 'Loading level list…'
        : (this._menuSubtitleDefault ?? '');
    }
    if (this.menu) {
      this.menu.setAttribute('aria-busy', loading ? 'true' : 'false');
    }
  }

  /**
   * @param {string} message
   */
  setMenuSubtitle(message) {
    if (this.menuSubtitle) this.menuSubtitle.textContent = message;
  }

  /**
   * Full-screen load view during async procgen + mesh build.
   * @param {string} [title]
   */
  showLevelLoadingScreen(title = 'Generating course…') {
    if (this.loadingTitle) this.loadingTitle.textContent = title;
    if (this.loadingPhase) this.loadingPhase.textContent = '';
    this.setLevelLoadProgress(0, '');
    if (this.loadingOverlay) this.loadingOverlay.hidden = false;
    if (this.btnNewGame) this.btnNewGame.disabled = true;
    if (this.btnContinue) this.btnContinue.disabled = true;
    if (this.runGameOver) {
      this.runGameOver.hidden = true;
      this.runGameOver.classList.remove('screen--visible');
    }
  }

  hideLevelLoadingScreen() {
    if (this.loadingOverlay) this.loadingOverlay.hidden = true;
    if (this.btnNewGame) this.btnNewGame.disabled = false;
    if (this.btnContinue) this.btnContinue.disabled = false;
  }

  /**
   * @param {number} fraction01 Clamped 0–1 (overall bar: procgen + mesh bands mapped by caller).
   * @param {string} [phaseLabel] Short status line (e.g. current procgen phase).
   */
  setLevelLoadProgress(fraction01, phaseLabel = '') {
    const t = Math.min(1, Math.max(0, fraction01));
    const pct = Math.round(t * 100);
    if (this.loadingProgress) {
      this.loadingProgress.value = pct;
      this.loadingProgress.setAttribute('aria-valuenow', String(pct));
    }
    if (this.loadingPhase) {
      this.loadingPhase.textContent = phaseLabel || '';
    }
  }

  /**
   * @deprecated Prefer {@link showLevelLoadingScreen} / {@link hideLevelLoadingScreen}.
   * @param {boolean} visible
   * @param {string} [message]
   */
  setLevelLoading(visible, message = 'Generating level…') {
    if (visible) {
      this.showLevelLoadingScreen(message);
    } else {
      this.hideLevelLoadingScreen();
    }
  }

  showMenu() {
    this.appRoot?.classList.remove('app--playing');
    if (this.menu) {
      this.menu.hidden = false;
      this.menu.classList.add('screen--visible');
    }
    if (this.levelComplete) this.levelComplete.hidden = true;
    if (this.marbleDead) this.marbleDead.hidden = true;
    if (this.runGameOver) {
      this.runGameOver.hidden = true;
      this.runGameOver.classList.remove('screen--visible');
    }
    if (this.hud) this.hud.hidden = true;
    if (this.devBypassWrap) this.devBypassWrap.hidden = true;
  }

  /**
   * @param {number} fallCount Falls so far this run (0…{@link GameplaySettings.runMaxFalls}).
   */
  setFallHud(fallCount) {
    const max = GameplaySettings.runMaxFalls;
    const row = this.hudFallsRow;
    if (!row) return;
    const chars = row.querySelectorAll('.hud-fall-char');
    chars.forEach((el, i) => {
      el.classList.remove('hud-fall-char--pending', 'hud-fall-char--spent', 'hud-fall-char--terminal');
      if (fallCount >= max) {
        el.classList.add('hud-fall-char--terminal');
      } else if (i < fallCount) {
        el.classList.add('hud-fall-char--spent');
      } else {
        el.classList.add('hud-fall-char--pending');
      }
    });
  }

  /**
   * @param {number} levelCollected
   * @param {number} levelTotal
   * @param {number} runDisplayTotal
   */
  setPlayingCoinHud(levelCollected, levelTotal, runDisplayTotal) {
    if (this.hudCoinsLevel) {
      this.hudCoinsLevel.textContent =
        levelTotal > 0
          ? `Coins: ${levelCollected} / ${levelTotal}`
          : 'Coins: —';
    }
    if (this.hudCoinsRun) {
      this.hudCoinsRun.textContent = `Run: ${runDisplayTotal}`;
    }
  }

  /**
   * @param {string} levelDisplayName
   * @param {boolean} [devMode] when true, show the in-run dev bypass control (top right)
   */
  showPlaying(levelDisplayName, devMode = false) {
    this.appRoot?.classList.add('app--playing');
    if (this.menu) {
      this.menu.hidden = true;
      this.menu.classList.remove('screen--visible');
    }
    if (this.levelComplete) this.levelComplete.hidden = true;
    if (this.marbleDead) this.marbleDead.hidden = true;
    if (this.runGameOver) {
      this.runGameOver.hidden = true;
      this.runGameOver.classList.remove('screen--visible');
    }
    if (this.hud) this.hud.hidden = false;
    if (this.hudLevelName) this.hudLevelName.textContent = levelDisplayName;
    if (this.devBypassWrap) this.devBypassWrap.hidden = !devMode;
  }

  /**
   * @param {string} title
   * @param {string} message
   * @param {boolean} isFinalLevel
   * @param {{ levelScore: number, runTotal: number } | null} [scores]
   */
  showLevelComplete(title, message, isFinalLevel, scores = null) {
    if (this.menu) {
      this.menu.hidden = true;
      this.menu.classList.remove('screen--visible');
    }
    if (this.marbleDead) this.marbleDead.hidden = true;
    if (this.runGameOver) {
      this.runGameOver.hidden = true;
      this.runGameOver.classList.remove('screen--visible');
    }
    if (this.levelComplete) this.levelComplete.hidden = false;
    if (this.hud) this.hud.hidden = true;
    if (this.devBypassWrap) this.devBypassWrap.hidden = true;
    if (this.levelCompleteTitle) this.levelCompleteTitle.textContent = title;
    if (this.levelCompleteScores) {
      if (scores && typeof scores.levelScore === 'number' && typeof scores.runTotal === 'number') {
        this.levelCompleteScores.hidden = false;
        this.levelCompleteScores.textContent = `Level score: ${scores.levelScore}\nRun total: ${scores.runTotal}`;
      } else {
        this.levelCompleteScores.hidden = true;
        this.levelCompleteScores.textContent = '';
      }
    }
    if (this.levelCompleteMsg) {
      this.levelCompleteMsg.textContent = isFinalLevel
        ? 'Press Enter to return to the menu.'
        : message;
    }
  }

  /**
   * Reads the menu “dev mode” checkbox so it stays correct after toggling mid-run.
   */
  _devModeFromCheckbox() {
    return !!GameplaySettings.dev.enabled && !!this.devModeCheckbox?.checked;
  }

  showMarbleDead() {
    if (this.menu) {
      this.menu.hidden = true;
      this.menu.classList.remove('screen--visible');
    }
    if (this.levelComplete) this.levelComplete.hidden = true;
    if (this.marbleDead) this.marbleDead.hidden = false;
    if (this.runGameOver) {
      this.runGameOver.hidden = true;
      this.runGameOver.classList.remove('screen--visible');
    }
    if (this.hud) this.hud.hidden = true;
    if (this.devBypassWrap) this.devBypassWrap.hidden = true;
  }

  /**
   * @param {{ coinsCollected: number, coinsPossible: number }} [stats]
   */
  showRunGameOver(stats) {
    this.appRoot?.classList.remove('app--playing');
    if (this.menu) {
      this.menu.hidden = true;
      this.menu.classList.remove('screen--visible');
    }
    if (this.levelComplete) this.levelComplete.hidden = true;
    if (this.marbleDead) this.marbleDead.hidden = true;
    if (this.runGameOver) {
      this.runGameOver.hidden = false;
      this.runGameOver.classList.add('screen--visible');
    }
    const maxFalls = GameplaySettings.runMaxFalls;
    if (this.runOverHint) {
      this.runOverHint.textContent = `${maxFalls} ${maxFalls === 1 ? 'fall' : 'falls'} — this run has ended. Press Enter to restart from level 1, or Escape for the main menu.`;
    }
    if (this.runOverCoins) {
      if (stats && stats.coinsPossible > 0) {
        const pct = Math.round((stats.coinsCollected / stats.coinsPossible) * 100);
        this.runOverCoins.textContent = `Coins this run: ${stats.coinsCollected} / ${stats.coinsPossible} (${pct}%).`;
        this.runOverCoins.hidden = false;
      } else {
        this.runOverCoins.textContent = '';
        this.runOverCoins.hidden = true;
      }
    }
    const showRestartCurrentLevel =
      this._devModeFromCheckbox() &&
      GameplaySettings.dev.runGameOverRestartCurrentLevelClearsFalls;
    if (this.runOverDevActions) {
      this.runOverDevActions.hidden = !showRestartCurrentLevel;
    }
    /** Keep HUD visible so terminal (pink) fall markers stay readable above the scrim. */
    if (this.devBypassWrap) this.devBypassWrap.hidden = true;
  }
}
