/**
 * 2D endless side-scrolling platformer.
 * Reuses all generic subsystems (GameLoop, GameStateMachine, FrameCommandQueue,
 * InputSystem, UISystem) and adds 2D-specific physics, rendering, and chunk streaming.
 * Rendering: HTML5 Canvas 2D — no WebGL.
 */
import { FrameCommandQueue } from './FrameCommandQueue.js';
import { GameLoop } from './GameLoop.js';
import { GameStateMachine } from './GameStateMachine.js';
import { LevelLoader } from './level/LevelLoader.js';
import { InputSystem } from './systems/InputSystem.js';
import { PhysicsSystem } from './systems/PhysicsSystem.js';
import { UISystem } from './systems/UISystem.js';
import { ControlSettings } from './config/ControlSettings.js';
import { generateProcgenDescriptor } from './procgen/generateProcgenDescriptor.js';

/** Canvas 2D platform colours by material key. */
const PLATFORM_COLORS = {
  plaza:    '#e8d48a',
  path:     '#5a7d8c',
  pathWide: '#6a8d9c',
  ramp:     '#52b788',
};

export class GameApplication2D {
  constructor() {
    /** @type {HTMLCanvasElement} */
    this.canvas = document.getElementById('game-canvas');
    /** @type {CanvasRenderingContext2D} */
    this.ctx = this.canvas.getContext('2d');

    this.queue  = new FrameCommandQueue();
    this.states = new GameStateMachine();
    this.input  = new InputSystem();
    this.ui     = new UISystem();
    this.physics = new PhysicsSystem();
    this.loader  = new LevelLoader();

    /** @type {object | null} Loaded settings.json */
    this._settings = null;

    this.session = { currentLevelIndex: 0, loadedLevelId: '' };

    /**
     * All active platforms in world space.
     * @type {Array<{x:number,y:number,w:number,h:number,materialKey:string,collision:boolean,lattice?:boolean}>}
     */
    this._platforms = [];

    /** Camera horizontal scroll offset (world px). */
    this._scrollX = 0;

    /** World X at which the current chunk ends (goal trigger). */
    this._chunkEndX = 0;

    /** Spawn position for the current chunk (used on restart). */
    this._spawn = { x: 0, y: 0 };

    /** Player Y below this value triggers fall death. */
    this._killPlaneY = 9999;

    this._devMode = false;

    this._loop = new GameLoop((dt) => this._onFrame(dt));

    this._onResizeBound = () => this._onResize();
    window.addEventListener('resize', this._onResizeBound);
  }

  async start() {
    await Promise.all([this._loadSettings(), this._loadBundle()]);
    this._applySettings();
    this._registerCommands();
    this._wireUi();
    this.ui.showMenu();
    this._onResize();
    this._loop.start();
  }

  // ─── Initialisation ────────────────────────────────────────────────────────

  async _loadSettings() {
    const url = new URL('../settings.json', import.meta.url);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load settings.json: ${res.status}`);
    this._settings = await res.json();
  }

  async _loadBundle() {
    const url = new URL('../levels/levels.json', import.meta.url);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load levels.json: ${res.status}`);
    this._bundle = await res.json();
  }

  /** Populate all DOM text from settings.json. */
  _applySettings() {
    const s = this._settings;
    if (!s) return;

    document.title = s.title ?? document.title;

    const set = (id, text) => {
      const el = document.getElementById(id);
      if (el && text != null) el.textContent = text;
    };

    set('menu-heading',  s.menu?.heading);
    set('menu-subtitle', s.menu?.subtitle);
    set('menu-hint',     s.menu?.hint);
    set('menu-keys',     s.menu?.keys);
    set('btn-new-game',  s.menu?.btnNewGame);

    set('death-heading', s.death?.heading);
    set('death-hint',    s.death?.hint);
    set('btn-try-again', s.death?.btnTryAgain);

    set('btn-continue',  s.chunkComplete?.btnContinue);
  }

  // ─── Command queue ─────────────────────────────────────────────────────────

  _registerCommands() {
    this.queue.register('START_GAME', () => {
      this._devMode = !!this.ui.devModeCheckbox?.checked;
      this.session.currentLevelIndex = 0;
      this._chunkEndX = 0;
      this._loadChunk(0, 0);
      this.states.setState('playing');
      this._focusPlay();
    });

    this.queue.register('ADVANCE_LEVEL', () => {
      const next = this.session.currentLevelIndex + 1;
      this._loadChunk(next, this._chunkEndX);
      this.states.setState('playing');
      this._focusPlay();
    });

    this.queue.register('RESTART_LEVEL', () => {
      if (!this.states.is('playing') && !this.states.is('marbleDead')) return;
      this.physics.resetPlayer(this._spawn.x, this._spawn.y);
      if (this.states.is('marbleDead')) {
        this.states.setState('playing');
        this._focusPlay();
      }
    });

    this.queue.register('MARBLE_DIED', () => {
      if (!this.states.is('playing')) return;
      this.states.setState('marbleDead');
      this.ui.showMarbleDead();
    });

    this.queue.register('GOAL_REACHED', (payload) => {
      if (!this.states.is('playing')) return;
      if (typeof payload?.levelIndex === 'number' && payload.levelIndex !== this.session.currentLevelIndex) return;
      this.states.setState('levelComplete');
      const s = this._settings?.chunkComplete ?? {};
      const heading = s.heading ?? 'Chunk clear';
      const hint    = s.hint    ?? 'Press Enter to continue.';
      this.ui.showLevelComplete(heading, hint, false);
      if (this.ui.levelCompleteTitle) {
        this.ui.levelCompleteTitle.textContent = `${String(this.session.currentLevelIndex + 1)} — ${heading.toLowerCase()}`;
      }
    });

    this.queue.register('RETURN_TO_MENU', () => {
      this._platforms = [];
      this.physics.removePlayer();
      this.session.currentLevelIndex = 0;
      this._chunkEndX = 0;
      this._scrollX = 0;
      this.states.setState('menu');
      this.ui.showMenu();
    });
  }

  _wireUi() {
    this.ui.btnNewGame?.addEventListener('click',  () => this.queue.enqueue({ type: 'START_GAME' }));
    this.ui.btnContinue?.addEventListener('click', () => this.queue.enqueue({ type: 'ADVANCE_LEVEL' }));
    this.ui.btnTryAgain?.addEventListener('click', () => this.queue.enqueue({ type: 'RESTART_LEVEL' }));
    this.ui.btnDevSkip?.addEventListener('click',  () => {
      if (!this._devMode || !this.states.is('playing')) return;
      this.queue.enqueue({ type: 'GOAL_REACHED', payload: { levelIndex: this.session.currentLevelIndex } });
    });
  }

  _focusPlay() {
    const name = `${this._settings?.hud?.chunkPrefix ?? 'Chunk'} ${this.session.currentLevelIndex + 1}`;
    this.ui.showPlaying(name, this._devMode);
    this.canvas?.focus();
  }

  // ─── Chunk loading ─────────────────────────────────────────────────────────

  /**
   * Generate and register a new chunk, optionally trimming off-screen platforms.
   * @param {number} levelIndex
   * @param {number} worldOffsetX  X position where this chunk starts in world space
   */
  _loadChunk(levelIndex, worldOffsetX) {
    const descriptor = generateProcgenDescriptor(levelIndex, '2d');
    const built = this.loader.build2D(descriptor, worldOffsetX);

    if (levelIndex === 0) {
      this._platforms = built.platforms;
      this._spawn = { x: built.spawn.x, y: built.spawn.y };
      this._killPlaneY = built.killPlaneY;
      this.physics.createPlayer(this._spawn.x, this._spawn.y);
      this._scrollX = this._spawn.x - this.canvas.width * 0.35;
    } else {
      // Trim platforms that are well behind the player
      const player = this.physics.player;
      const trimX = player ? player.x - 400 : 0;
      this._platforms = this._platforms.filter((p) => p.x + p.w > trimX);
      this._platforms.push(...built.platforms);
    }

    this._chunkEndX = built.endX;
    this.session.loadedLevelId = descriptor.id;
    this.session.currentLevelIndex = levelIndex;
  }

  // ─── Per-frame update ──────────────────────────────────────────────────────

  /** @param {number} dt Seconds */
  _onFrame(dt) {
    this.input.poll();
    this._enqueueInputCommands();
    this.queue.drain(16);

    if (this.states.is('playing')) {
      this._applyPlayerInput();
      this.physics.step2D(dt, this._platforms);
      this._updateCamera();
      this._checkFall();
      this._checkGoal();
    }

    this._render();
  }

  _enqueueInputCommands() {
    const { input, states, queue } = this;

    if (states.is('menu')) {
      if (input.wasPressedEdge('Enter')) queue.enqueue({ type: 'START_GAME' });
      return;
    }
    if (states.is('levelComplete')) {
      if (input.wasPressedEdge('Enter'))  queue.enqueue({ type: 'ADVANCE_LEVEL' });
      if (input.wasPressedEdge('Escape')) queue.enqueue({ type: 'RETURN_TO_MENU' });
      return;
    }
    if (states.is('marbleDead')) {
      if (input.wasPressedEdge('Enter') || input.wasPressedEdge('KeyR')) queue.enqueue({ type: 'RESTART_LEVEL' });
      if (input.wasPressedEdge('Escape')) queue.enqueue({ type: 'RETURN_TO_MENU' });
      return;
    }
    if (states.is('playing')) {
      if (input.wasPressedEdge('KeyR'))   queue.enqueue({ type: 'RESTART_LEVEL' });
      if (input.wasPressedEdge('Escape')) queue.enqueue({ type: 'RETURN_TO_MENU' });
    }
  }

  _applyPlayerInput() {
    const player = this.physics.player;
    if (!player) return;
    const { keys, moveSpeed, jumpForce } = ControlSettings.player2d;

    let vx = 0;
    if (this.input.isDown(keys.left)  || this.input.isDown(keys.altLeft))  vx -= moveSpeed;
    if (this.input.isDown(keys.right) || this.input.isDown(keys.altRight)) vx += moveSpeed;
    player.vx = vx;

    if (this.input.wasPressedEdge(keys.jump) || this.input.wasPressedEdge(keys.altJump)) {
      this.physics.applyJump(jumpForce);
    }
  }

  _updateCamera() {
    const player = this.physics.player;
    if (!player) return;
    const target = player.x - this.canvas.width * 0.35;
    // Camera only scrolls right (never pulls back)
    if (target > this._scrollX) this._scrollX = target;
  }

  _checkFall() {
    const player = this.physics.player;
    if (!player) return;
    if (player.y > this._killPlaneY) {
      this.queue.enqueue({ type: 'MARBLE_DIED' });
    }
  }

  _checkGoal() {
    const player = this.physics.player;
    if (!player) return;
    if (player.x >= this._chunkEndX) {
      this.queue.enqueue({ type: 'GOAL_REACHED', payload: { levelIndex: this.session.currentLevelIndex } });
    }
  }

  // ─── Rendering ─────────────────────────────────────────────────────────────

  _onResize() {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  _render() {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;

    // Sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#87b8d8');
    sky.addColorStop(1, '#c8dff0');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    ctx.save();

    // Camera: shift world so world-X `scrollX` maps to screen-X 0;
    // baseline (world-Y 400) sits roughly at 60% screen height.
    const camX = -this._scrollX;
    const camY = H - 560;
    ctx.translate(camX, camY);

    // Cull bounds in world space
    const cullL = this._scrollX - 60;
    const cullR = this._scrollX + W + 60;

    // Platforms
    for (const plat of this._platforms) {
      if (plat.x + plat.w < cullL || plat.x > cullR) continue;
      if (plat.lattice) {
        ctx.fillStyle = 'rgba(138,156,175,0.35)';
        ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
      } else {
        ctx.fillStyle = PLATFORM_COLORS[plat.materialKey] ?? '#4a5d6b';
        ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
        // Top-edge highlight
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.fillRect(plat.x, plat.y, plat.w, 3);
      }
    }

    // Goal marker — vertical bar at chunk end
    if (this.states.is('playing') || this.states.is('levelComplete')) {
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(this._chunkEndX - 5, 200, 10, 240);
      ctx.fillStyle = 'rgba(251,191,36,0.25)';
      ctx.fillRect(this._chunkEndX - 20, 200, 40, 240);
    }

    // Player
    const player = this.physics.player;
    if (player) {
      // Body
      ctx.fillStyle = '#d4e8f5';
      ctx.fillRect(player.left, player.top, player.width, player.height);
      // Face highlight
      ctx.fillStyle = '#a0c4e8';
      ctx.fillRect(player.left + 4, player.top + 4, player.width - 8, 12);
    }

    ctx.restore();
  }
}
