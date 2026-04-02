/**
 * DOM overlays: menu, level complete, HUD. Does not own game logic.
 */
export class UISystem {
  constructor() {
    this.appRoot = document.getElementById('app');
    this.menu = document.getElementById('screen-menu');
    this.levelComplete = document.getElementById('screen-level-complete');
    this.hud = document.getElementById('hud');
    this.hudLevelName = document.getElementById('hud-level-name');
    this.levelCompleteTitle = document.getElementById('level-complete-title');
    this.levelCompleteMsg = document.getElementById('level-complete-msg');
    this.btnNewGame = document.getElementById('btn-new-game');
    this.devModeCheckbox = document.getElementById('dev-mode');
    this.devBypassWrap = document.getElementById('dev-bypass-wrap');
    this.btnDevSkip = document.getElementById('btn-dev-skip-level');
    this.btnContinue = document.getElementById('btn-continue');
    this.marbleDead = document.getElementById('screen-marble-dead');
    this.btnTryAgain = document.getElementById('btn-try-again');
  }

  showMenu() {
    this.appRoot?.classList.remove('app--playing');
    if (this.menu) {
      this.menu.hidden = false;
      this.menu.classList.add('screen--visible');
    }
    if (this.levelComplete) this.levelComplete.hidden = true;
    if (this.marbleDead) this.marbleDead.hidden = true;
    if (this.hud) this.hud.hidden = true;
    if (this.devBypassWrap) this.devBypassWrap.hidden = true;
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
    if (this.hud) this.hud.hidden = false;
    if (this.hudLevelName) this.hudLevelName.textContent = levelDisplayName;
    if (this.devBypassWrap) this.devBypassWrap.hidden = !devMode;
  }

  /**
   * @param {string} title
   * @param {string} message
   * @param {boolean} isFinalLevel
   */
  showLevelComplete(title, message, isFinalLevel) {
    if (this.menu) {
      this.menu.hidden = true;
      this.menu.classList.remove('screen--visible');
    }
    if (this.marbleDead) this.marbleDead.hidden = true;
    if (this.levelComplete) this.levelComplete.hidden = false;
    if (this.hud) this.hud.hidden = true;
    if (this.devBypassWrap) this.devBypassWrap.hidden = true;
    if (this.levelCompleteTitle) this.levelCompleteTitle.textContent = title;
    if (this.levelCompleteMsg) {
      this.levelCompleteMsg.textContent = isFinalLevel
        ? 'Press Enter to return to the menu.'
        : message;
    }
  }

  showMarbleDead() {
    if (this.menu) {
      this.menu.hidden = true;
      this.menu.classList.remove('screen--visible');
    }
    if (this.levelComplete) this.levelComplete.hidden = true;
    if (this.marbleDead) this.marbleDead.hidden = false;
    if (this.hud) this.hud.hidden = true;
    if (this.devBypassWrap) this.devBypassWrap.hidden = true;
  }
}
