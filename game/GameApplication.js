import { Vec3 } from 'cannon-es';
import { WorldRenderer } from '../engine/gfx/WorldRenderer.js';
import { SceneMesh } from '../engine/gfx/SceneMesh.js';
import { vec3Cross, vec3LengthSq, vec3Normalize, vec3Set } from '../engine/gfx/math/Vec3.js';
import { FrameCommandQueue } from './FrameCommandQueue.js';
import { GameLoop } from './GameLoop.js';
import { GameStateMachine } from './GameStateMachine.js';
import { LevelLoader } from './level/LevelLoader.js';
import { InputSystem } from './systems/InputSystem.js';
import { PhysicsSystem } from './systems/PhysicsSystem.js';
import { UISystem } from './systems/UISystem.js';
import { MusicPlaylist } from '../engine/audio/MusicPlaylist.js';
import { AssetSettings } from './config/AssetSettings.js';
import { AudioSettings, loadStoredMuted } from './config/AudioSettings.js';
import { ControlSettings } from './config/ControlSettings.js';
import { applyControlBindingsToMenuKeys, DisplaySettings } from './config/DisplaySettings.js';
import { GameplaySettings } from './config/GameplaySettings.js';
import { SceneLightingSettings } from './config/SceneLightingSettings.js';
import { VisualSettings } from './config/VisualSettings.js';
import { applyPixelWorldMapsToMaterials } from './rendering/pixelWorldMaps.js';
import { createMaterialPalette } from './rendering/MaterialPalette.js';
import { WorldNeonPulse } from './rendering/worldNeonPulse.js';
import { wireMuteButtons } from './ui/wireMuteButtons.js';
import { wireCreditsOverlay } from './ui/wireCredits.js';
import { generateProcgenDescriptor } from './procgen/generateProcgenDescriptor.js';
import { yieldToPaint } from './util/yieldToPaint.js';
import { CoinPickupRuntime } from './collectibles/CoinPickupRuntime.js';
import { RunCoinLedger } from './scoring/RunCoinLedger.js';
import {
  initEmbedHost,
  isEmbedActive,
  notifyFirstInteraction,
  notifyLevelComplete,
  notifyLevelLoaded,
  notifyReady,
  shouldAutostart,
} from './embed/EmbedHost.js';

/**
 * Win test: centre distance ≤ goal capture radius + marble radius (see gen/specs/SPEC.md §3.3).
 */
function isGoalReached(marblePos, goalCentre, goalRadius, marbleRadius) {
  const dx = marblePos.x - goalCentre.x;
  const dy = marblePos.y - goalCentre.y;
  const dz = marblePos.z - goalCentre.z;
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  return dist <= goalRadius + marbleRadius;
}

/**
 * Flat zone: horizontal overlap with a thin disc on the map (marble-sized footprint).
 * @param {import('cannon-es').Vec3} marblePos
 * @param {{ position: number[], radius: number }} zone
 * @param {number} marbleRadius
 */
/**
 * UI and descriptors always use 1-based numeric labels so progression can run without a manifest list.
 * @param {number} levelIndex
 */
function formatLevelLabel(levelIndex) {
  return String(levelIndex + 1);
}

function marbleTouchesZone(marblePos, zone, marbleRadius) {
  const px = zone.position[0];
  const py = zone.position[1];
  const pz = zone.position[2];
  const dx = marblePos.x - px;
  const dz = marblePos.z - pz;
  if (Math.hypot(dx, dz) > zone.radius + marbleRadius * 0.92) return false;
  return marblePos.y >= py - 0.45 && marblePos.y <= py + 3;
}

export class GameApplication {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.queue = new FrameCommandQueue();
    this.states = new GameStateMachine();
    this.input = new InputSystem();
    this.ui = new UISystem();
    this.physics = new PhysicsSystem();
    this.levelLoader = new LevelLoader();
    this.coinRuntime = new CoinPickupRuntime();
    this.coinLedger = new RunCoinLedger();

    this.music = new MusicPlaylist(AssetSettings.music.trackUrls, {
      initialMuted: loadStoredMuted(),
      onMutedChange: (muted) => {
        try {
          localStorage.setItem(AudioSettings.storageKey, muted ? '1' : '0');
        } catch (_) {
          /* ignore */
        }
      },
    });

    /** @type {{ schemaVersion: number, levels: object[] } | null} */
    this.bundle = null;
    this.session = {
      currentLevelIndex: 0,
      loadedLevelId: '',
    };

    /** @type {[number, number, number] | null} */
    this._spawn = null;
    /** @type {{ position: { x: number, y: number, z: number }, radius: number } | null} */
    this._goal = null;
    /** @type {{ start: object, end: object } | null} */
    this._zones = null;
    /** End zone only counts after the start pad has been touched (procgen levels). */
    this._startZoneTouched = false;
    /** Marble centre Y below this value means a fall death (set per level from spawn). */
    this._killPlaneY = -100;
    /** When true (start screen dev checkbox), in-run dev tools such as skip level are available. */
    this._devMode = false;
    /** Embed mode: first gameplay input reported to parent (see `EmbedHost`). Set in `start`. */
    this._embedFirstInteractionPending = false;
    /** @type {(() => void) | null} */
    this._onEmbedPointerDown = null;
    /** Prevents overlapping async level loads (New game / next level / debug load). */
    this._levelLoadInProgress = false;
    /** @type {{ sync: () => void } | null} */
    this._syncMuteUi = null;
    /** Falls this run; resets on new run or main menu (not on level advance). */
    this._fallCount = 0;

    this.worldRenderer = new WorldRenderer(this.canvas, SceneLightingSettings);
    const w3d = VisualSettings.world3d;
    this.worldRenderer.setDevicePixelRatioCap(w3d.devicePixelRatioCap);
    this.worldRenderer.setInternalResolutionScale(w3d.internalResolutionScale);
    this.worldRenderer.setClearColor(0, 0, 0, 0);

    this.renderMeshes = [];
    this.marbleSceneMesh = new SceneMesh();
    this.marbleSceneMesh.primitive = 'sphereLow';
    this.marbleSceneMesh.materialKey = 'marble';
    this.marbleSceneMesh.castShadow = true;
    this.marbleSceneMesh.receiveShadow = false;
    const mr = this.physics.marbleRadius;
    this.marbleSceneMesh.scale.x = mr;
    this.marbleSceneMesh.scale.y = mr;
    this.marbleSceneMesh.scale.z = mr;
    this.renderMeshes.push(this.marbleSceneMesh);

    this._materials = createMaterialPalette();

    this._pixelWorldNoiseTexture = applyPixelWorldMapsToMaterials(this._materials, this.worldRenderer);

    this._worldNeonPulse = new WorldNeonPulse();
    this._worldNeonPulse.capture(this._materials);

    /** Orbit angles (rad); independent of marble roll. */
    this._cameraYaw = ControlSettings.camera.initialYaw;
    this._cameraPitch = ControlSettings.camera.initialPitch;

    this._tmpVec = { x: 0, y: 0, z: 0 };
    this._camEye = { x: 0, y: 10, z: 16 };
    this._camTarget = { x: 0, y: 0, z: 0 };
    this._worldUp = { x: 0, y: 1, z: 0 };
    this._camForward = { x: 0, y: 0, z: 0 };
    this._camRight = { x: 0, y: 0, z: 0 };
    this._rollWant = { x: 0, y: 0, z: 0 };
    this._torqueAxis = { x: 0, y: 0, z: 0 };
    this._torque = new Vec3();

    /** Reused each frame — avoids allocating a camera descriptor for {@link WorldRenderer.render}. */
    this._renderCam = {
      fovDeg: 58,
      aspect: 1,
      near: 0.1,
      far: 200,
      eye: this._camEye,
      target: this._camTarget,
    };

    this._loop = new GameLoop((dt) => this._onFrame(dt));

    this._resize = () => this._onResize();
    window.addEventListener('resize', this._resize);

    this._onCanvasKeyDown = (e) => {
      if (e.code === 'Space') e.preventDefault();
    };
    this.canvas?.addEventListener('keydown', this._onCanvasKeyDown);

    this._onResize();
  }

  async start() {
    initEmbedHost();
    this._embedFirstInteractionPending = isEmbedActive();
    if (this._embedFirstInteractionPending && this.canvas) {
      this._onEmbedPointerDown = () => {
        if (!this._embedFirstInteractionPending) return;
        this._embedFirstInteractionPending = false;
        notifyFirstInteraction();
      };
      this.canvas.addEventListener('pointerdown', this._onEmbedPointerDown);
    }
    this._registerCommands();
    this._wireUi();
    this._syncMuteUi = wireMuteButtons(this.music);
    wireCreditsOverlay();
    /** Load first playlist track; playback still needs a user gesture (see unlock listener below). */
    this.music.ensureInitialTrack();
    this._hydrateBundleFromInlineManifest();
    this._applyDisplayBranding();
    this.ui.setMenuManifestLoading(!this.bundle);
    this._loop.start();

    if (!this.bundle) {
      await this._loadLevelBundle();
    }

    this.ui.setMenuManifestLoading(false);
    this.ui.showMenu();
    this._onResize();
    if (shouldAutostart()) {
      this.queue.enqueue({ type: 'START_GAME' });
    }
    notifyReady();
  }

  /**
   * Parsed from `index.html` so the game can boot even when `fetch('levels/levels.json')` never runs.
   */
  _applyDisplayBranding() {
    if (typeof document === 'undefined') return;
    document.title = DisplaySettings.gameTitle;
    const heading = document.getElementById('menu-heading');
    if (heading) heading.textContent = DisplaySettings.gameTitle;
    const tagline = document.getElementById('menu-subtitle');
    if (tagline) tagline.textContent = DisplaySettings.menuTagline;
    applyControlBindingsToMenuKeys(document.getElementById('menu-keys'));
  }

  _hydrateBundleFromInlineManifest() {
    const el = document.getElementById('marble-level-manifest');
    const raw = el?.textContent?.trim();
    if (!raw) return;
    try {
      const data = JSON.parse(raw);
      if (data && typeof data.schemaVersion === 'number') {
        this.bundle = data;
      }
    } catch (e) {
      console.warn('[marble] inline #marble-level-manifest is not valid JSON.', e);
    }
  }

  async _loadLevelBundle() {
    const origins = new Set();
    try {
      origins.add(new URL('../levels/levels.json', import.meta.url).href);
    } catch {
      /* ignore */
    }
    origins.add(new URL('/levels/levels.json', window.location.origin).href);
    try {
      origins.add(new URL('levels/levels.json', window.location.href).href);
    } catch {
      /* ignore */
    }

    const urls = [...origins];
    let lastErr = /** @type {Error | null} */ (null);

    for (const href of urls) {
      const ctrl = new AbortController();
      const t = window.setTimeout(() => ctrl.abort(), 20000);
      try {
        const res = await fetch(href, { signal: ctrl.signal, cache: 'no-store' });
        if (!res.ok) {
          lastErr = new Error(`Failed to load levels: ${res.status}`);
          continue;
        }
        this.bundle = await res.json();
        if (this.bundle.schemaVersion !== 2 || !this.bundle.procgen) {
          console.warn('levels.json should use schemaVersion 2 with procgen: true.');
        }
        return;
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        lastErr = err;
        console.warn('[marble] manifest fetch failed:', href, err.message);
      } finally {
        window.clearTimeout(t);
      }
    }

    throw lastErr ?? new Error('Could not load levels.json from any known URL.');
  }

  _registerCommands() {
    this.queue.register('START_GAME', () => {
      if (this._levelLoadInProgress) {
        console.warn('[marble:flow] ③a abort: _levelLoadInProgress');
        return;
      }
      if (!this.bundle) {
        this.ui.setMenuSubtitle('Still loading level list… try again in a moment.');
        console.warn(
          '[marble:flow] ③b abort: no bundle (manifest).',
        );
        return;
      }
      this._syncDevModeFromCheckbox();
      this.coinLedger.startNewRun();
      this._fallCount = 0;
      this.session.currentLevelIndex = 0;
      void this._runLevelLoadFlow(this.session.currentLevelIndex, () => {
        this.states.setState('playing');
        this._focusPlay();
      });
    });

    this.queue.register('LOAD_LEVEL', (payload) => {
      if (this._levelLoadInProgress) return;
      if (!payload || typeof payload.index !== 'number') return;
      void this._runLevelLoadFlow(payload.index, () => {
        this.states.setState('playing');
        this._focusPlay();
      });
    });

    this.queue.register('RESTART_LEVEL', () => {
      if (!this.states.is('playing') && !this.states.is('marbleDead')) return;
      if (!this._spawn) return;
      this.coinLedger.resetLevelProgress();
      this.coinRuntime.resetLevel();
      this._refreshCoinHud();
      this.physics.resetMarble(this._spawn);
      this._startZoneTouched = false;
      if (this.states.is('marbleDead')) {
        this.states.setState('playing');
        this._resetCameraOrbit();
        this._focusPlay();
      }
    });

    this.queue.register('RESTART_RUN', () => {
      if (!this.states.is('runGameOver')) return;
      if (!this.bundle) return;
      if (this._levelLoadInProgress) return;
      this._fallCount = 0;
      this.coinLedger.startNewRun();
      this.session.currentLevelIndex = 0;
      void this._runLevelLoadFlow(this.session.currentLevelIndex, () => {
        this.states.setState('playing');
        this._focusPlay();
      });
    });

    this.queue.register('DEV_RESTART_RUN_AT_CURRENT_LEVEL', () => {
      if (!GameplaySettings.dev.runGameOverRestartCurrentLevelClearsFalls) return;
      this._syncDevModeFromCheckbox();
      if (!this._devMode) return;
      if (!this.states.is('runGameOver')) return;
      if (!this.bundle) return;
      if (this._levelLoadInProgress) return;
      const idx = this.session.currentLevelIndex;
      this._fallCount = 0;
      this.coinLedger.startNewRun();
      void this._runLevelLoadFlow(idx, () => {
        this.states.setState('playing');
        this._focusPlay();
      });
    });

    this.queue.register('ADVANCE_LEVEL', () => {
      if (!this.bundle) return;
      const count = this.bundle.levelCount ?? this.bundle.levels?.length ?? 0;
      const infinite =
        this.bundle.procgen === true && this.bundle.infiniteLevels === true;
      const next = this.session.currentLevelIndex + 1;
      if (infinite || next < count) {
        if (this._levelLoadInProgress) return;
        this.session.currentLevelIndex = next;
        void this._runLevelLoadFlow(this.session.currentLevelIndex, () => {
          this.states.setState('playing');
          this._focusPlay();
        });
      } else {
        this.session.currentLevelIndex = 0;
        this.coinLedger.startNewRun();
        this._fallCount = 0;
        this.coinRuntime.clear();
        this.levelLoader.clear(this.physics.world, this.renderMeshes);
        this.physics.removeMarble();
        this._spawn = null;
        this._goal = null;
        this._zones = null;
        this._startZoneTouched = false;
        this.states.setState('menu');
        this.ui.showMenu();
      }
    });


    this.queue.register('GOAL_REACHED', (payload) => {
      if (!this.states.is('playing')) return;
      if (!this.bundle) return;
      const idx = payload?.levelIndex;
      if (typeof idx === 'number' && idx !== this.session.currentLevelIndex) return;

      this.states.setState('levelComplete');
      const levelName = formatLevelLabel(this.session.currentLevelIndex);
      const count = this.bundle.levelCount ?? this.bundle.levels?.length ?? 1;
      const infinite =
        this.bundle.procgen === true && this.bundle.infiniteLevels === true;
      const isFinal =
        !infinite && this.session.currentLevelIndex >= count - 1;
      const { levelScore, runTotalAfter } = this.coinLedger.bankForLevelComplete();
      this.ui.showLevelComplete(
        'Level complete',
        'Press Enter to continue.',
        isFinal,
        { levelScore, runTotal: runTotalAfter },
      );
      if (levelName && this.ui.levelCompleteTitle) {
        this.ui.levelCompleteTitle.textContent = `${levelName} — complete`;
      }
      notifyLevelComplete({
        levelIndex: this.session.currentLevelIndex,
        levelScore,
        runTotal: runTotalAfter,
        gameFinished: isFinal,
        userWon: true,
      });
    });

    this.queue.register('RETURN_TO_MENU', () => {
      this.coinLedger.startNewRun();
      this._fallCount = 0;
      this.coinRuntime.clear();
      this.levelLoader.clear(this.physics.world, this.renderMeshes);
      this.physics.removeMarble();
      this._spawn = null;
      this._goal = null;
      this._zones = null;
      this._startZoneTouched = false;
      this.session.currentLevelIndex = 0;
      this.states.setState('menu');
      this.ui.showMenu();
    });
  }

  /**
   * Runs the command in the same turn so a menu click is not lost waiting for the next animation frame.
   * @param {{ type: string, payload?: object }} cmd
   */
  _enqueueAndDrain(cmd) {
    this.queue.enqueue(cmd);
    this.queue.drain(16);
  }

  _wireUi() {
    if (!this.ui.btnNewGame) {
      console.error('[marble:flow] #btn-new-game is null — wireUi cannot attach listeners.');
    } else {
      /** Primary pointer starts the run on `pointerdown` so the first tap always registers (click can lag or be swallowed after audio unlock / touch). Keyboard uses `click` only — see skip flag below. */
      let newGameActivatedByPointer = false;
      const startNewGame = () => {
        this.music.ensurePlayback();
        this._enqueueAndDrain({ type: 'START_GAME' });
      };
      this.ui.btnNewGame.addEventListener('pointerdown', (e) => {
        if (this.ui.btnNewGame?.disabled) return;
        if (e.button !== 0) return;
        newGameActivatedByPointer = true;
        startNewGame();
      });
      this.ui.btnNewGame.addEventListener('click', () => {
        if (newGameActivatedByPointer) {
          newGameActivatedByPointer = false;
          return;
        }
        if (this.ui.btnNewGame?.disabled) return;
        startNewGame();
      });
    }
    this.ui.btnContinue?.addEventListener('click', () => {
      this._enqueueAndDrain({ type: 'ADVANCE_LEVEL' });
    });
    this.ui.btnTryAgain?.addEventListener('click', () => {
      this._enqueueAndDrain({ type: 'RESTART_LEVEL' });
    });
    this.ui.btnRunRestart?.addEventListener('click', () => {
      this.music.ensurePlayback();
      this._enqueueAndDrain({ type: 'RESTART_RUN' });
    });
    this.ui.btnRunMenu?.addEventListener('click', () => {
      this._enqueueAndDrain({ type: 'RETURN_TO_MENU' });
    });
    this.ui.btnDevRunRestartCurrentLevel?.addEventListener('click', () => {
      this.music.ensurePlayback();
      this._enqueueAndDrain({ type: 'DEV_RESTART_RUN_AT_CURRENT_LEVEL' });
    });
    this.ui.btnDevSkip?.addEventListener('click', () => {
      if (!this._devMode || !this.states.is('playing')) return;
      this._enqueueAndDrain({
        type: 'GOAL_REACHED',
        payload: { levelIndex: this.session.currentLevelIndex },
      });
    });
  }

  _syncDevModeFromCheckbox() {
    this._devMode = !!GameplaySettings.dev.enabled && !!this.ui.devModeCheckbox?.checked;
  }

  _focusPlay() {
    this._syncDevModeFromCheckbox();
    const name = formatLevelLabel(this.session.currentLevelIndex);
    this.ui.showPlaying(name, this._devMode);
    this._refreshCoinHud();
    this._refreshFallHud();
    this.canvas?.focus();
  }

  _refreshFallHud() {
    this.ui.setFallHud(this._fallCount);
  }

  _refreshCoinHud() {
    this.ui.setPlayingCoinHud(
      this.coinLedger.getLevelCollected(),
      this.coinLedger.getLevelTotal(),
      this.coinLedger.getRunDisplayTotal(),
    );
  }

  /**
   * Async level load: full-screen progress bar during procgen yields and mesh build.
   * @param {number} index
   * @param {() => void} [done]
   */
  async _runLevelLoadFlow(index, done) {
    if (this._levelLoadInProgress) {
      console.warn('[marble:flow] ⑤a abort: already in progress');
      return;
    }
    if (!this.bundle) {
      console.warn('[marble:flow] ⑤b abort: no bundle');
      return;
    }
    this._levelLoadInProgress = true;
    const levelLabel = formatLevelLabel(index);
    this.ui.showLevelLoadingScreen(`Generating level ${levelLabel}…`);
    try {
      await yieldToPaint();
      if (!this.bundle) {
        console.warn('[marble:flow] ⑥a abort: bundle cleared');
        return;
      }

      /** @type {object | undefined} */
      let descriptor;
      if (this.bundle.procgen) {
        descriptor = await generateProcgenDescriptor(index, {
          yieldForUi: () => yieldToPaint(),
          onProgress: (info) => {
            this.ui.setLevelLoadProgress(info.fraction * 0.75, info.label);
          },
        });
      } else {
        this.ui.setLevelLoadProgress(0.25, 'Loading level data…');
        await yieldToPaint();
        descriptor = this.bundle.levels?.[index];
        if (!descriptor) {
          console.warn(`[level] no descriptor for index ${index}`);
          return;
        }
        this.ui.setLevelLoadProgress(0.75, 'Building meshes…');
        await yieldToPaint();
      }

      if (!descriptor) {
        console.warn('[marble:flow] ⑧a abort: no descriptor', index);
        return;
      }

      this.ui.setLevelLoadProgress(0.75, 'Building meshes…');
      await yieldToPaint();
      this._applyLoadedLevel(descriptor, index);
      this.ui.setLevelLoadProgress(1, '');
      await yieldToPaint();
      done?.();
      if (isEmbedActive()) {
        notifyLevelLoaded({ levelIndex: this.session.currentLevelIndex });
      }
    } catch (err) {
      console.error('[marble:flow] load failed (catch)', err);
      console.error('[level] load failed', err);
    } finally {
      this.ui.hideLevelLoadingScreen();
      this._levelLoadInProgress = false;
    }
  }

  _resetCameraOrbit() {
    const cam = ControlSettings.camera;
    this._cameraPitch = cam.initialPitch;

    if (!this._goal || !this._spawn) {
      this._cameraYaw = cam.initialYaw;
      return;
    }

    const sx = this._spawn[0];
    const sz = this._spawn[2];
    const gx = this._goal.position.x;
    const gz = this._goal.position.z;
    const dx = gx - sx;
    const dz = gz - sz;
    const len = Math.hypot(dx, dz);
    if (len < 1e-3) {
      this._cameraYaw = cam.initialYaw;
      return;
    }

    const nx = dx / len;
    const nz = dz / len;
    /** Horizontal yaw so orbit sits opposite course direction (camera looks past marble toward end). */
    const yawAlongCourse = Math.atan2(nx, nz);
    this._cameraYaw = yawAlongCourse + cam.endZoneClockYawOffsetRad;
  }

  /**
   * Applies a ready descriptor: physics meshes, spawn, coins session for this level.
   * @param {object} descriptor
   * @param {number} index
   */
  _applyLoadedLevel(descriptor, index) {
    this.levelLoader.clear(this.physics.world, this.renderMeshes);
    const built = this.levelLoader.build(this.physics.world, this.renderMeshes, this._materials, descriptor);
    this._spawn = /** @type {[number, number, number]} */ ([
      descriptor.spawn[0],
      descriptor.spawn[1],
      descriptor.spawn[2],
    ]);
    this._goal = built.goal;
    this._zones = built.zones;
    this._startZoneTouched = false;
    {
      const fallback = this._spawn[1] - ControlSettings.fallDeathBelowSpawn;
      let k =
        typeof descriptor.killPlaneY === 'number' &&
        Number.isFinite(descriptor.killPlaneY)
          ? descriptor.killPlaneY
          : fallback;
      if (!Number.isFinite(k)) k = fallback;
      const maxKillY =
        this._spawn[1] - ControlSettings.fallKillPlaneMarginBelowSpawn;
      let plane = Math.min(k, maxKillY);
      if (!Number.isFinite(plane)) plane = fallback;
      this._killPlaneY = plane;
    }
    this._resetCameraOrbit();
    this.session.loadedLevelId = descriptor.id;
    this.session.currentLevelIndex = index;

    this.physics.createMarble(this._spawn);
    this.coinRuntime.load(built.coinEntries ?? []);
    this.coinLedger.beginLevel(Array.isArray(descriptor.coins) ? descriptor.coins.length : 0);
    this._syncMarbleMesh();
    this._refreshCoinHud();
    this.music.ensurePlayback();
  }

  _onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this._viewAspect = w / Math.max(1, h);
    this.worldRenderer.setSize(w, h);
  }

  /**
   * @param {number} deltaSeconds
   */
  _onFrame(deltaSeconds) {
    this.input.poll();
    this._enqueueInputCommands();
    this.queue.drain(16);

    if (this._worldNeonPulse.needsPulseUpdate) {
      this._worldNeonPulse.update(deltaSeconds, this._materials);
    }

    if (this.states.is('playing')) {
      if (this._embedFirstInteractionPending) {
        if (this.input.hasAnyGameplayEdge()) {
          this._embedFirstInteractionPending = false;
          notifyFirstInteraction();
        }
      }
      /** Orbit input before follow; roll torque / brake / jump must run *before* {@link PhysicsSystem.step}. */
      this._applyCameraControls(deltaSeconds);
      this._applyMarbleControls(deltaSeconds);
      this.physics.step(deltaSeconds);
      this._updateCamera();
      this._checkWinCondition();
      this._checkFall();
      const body = this.physics.marbleBody;
      if (body) {
        const picked = this.coinRuntime.update(
          body.interpolatedPosition,
          this.physics.marbleRadius,
          deltaSeconds,
        );
        if (picked > 0) {
          this.coinLedger.collect(picked);
          this._refreshCoinHud();
        }
      }
    }

    this._syncMarbleMesh();
    this._renderCam.aspect = this._viewAspect;
    this.worldRenderer.render(this._renderCam, this.renderMeshes, this._materials);
  }

  _enqueueInputCommands() {
    const { input, states, queue } = this;

    if (
      input.wasPressedEdge('KeyM') &&
      (states.is('menu') ||
        states.is('playing') ||
        states.is('marbleDead') ||
        states.is('runGameOver') ||
        states.is('levelComplete'))
    ) {
      this.music.toggleMuted();
      this._syncMuteUi?.sync();
      this.music.ensurePlayback();
    }

    if (states.is('menu')) {
      if (input.wasPressedEdge('Enter')) queue.enqueue({ type: 'START_GAME' });
      return;
    }

    if (states.is('levelComplete')) {
      if (input.wasPressedEdge('Enter')) queue.enqueue({ type: 'ADVANCE_LEVEL' });
      if (input.wasPressedEdge('Escape')) queue.enqueue({ type: 'RETURN_TO_MENU' });
      return;
    }

    if (states.is('runGameOver')) {
      if (input.wasPressedEdge('Enter')) queue.enqueue({ type: 'RESTART_RUN' });
      if (input.wasPressedEdge('Escape')) queue.enqueue({ type: 'RETURN_TO_MENU' });
      return;
    }

    if (states.is('marbleDead')) {
      if (input.wasPressedEdge('Enter') || input.wasPressedEdge('KeyR')) {
        queue.enqueue({ type: 'RESTART_LEVEL' });
      }
      if (input.wasPressedEdge('Escape')) queue.enqueue({ type: 'RETURN_TO_MENU' });
      return;
    }

    if (states.is('playing')) {
      if (input.wasPressedEdge('KeyR')) queue.enqueue({ type: 'RESTART_LEVEL' });
      if (input.wasPressedEdge('Escape')) queue.enqueue({ type: 'RETURN_TO_MENU' });
    }
  }

  /**
   * Roll torque is aligned to the camera on the ground plane: W moves into the view, not along world Z.
   * Axis: worldUp × desiredRollDirection (horizontal), in world space for cannon-es.
   * @param {number} deltaSeconds
   */
  _applyMarbleControls(deltaSeconds) {
    const body = this.physics.marbleBody;
    if (!body) return;

    const marble = ControlSettings.marble;
    const { torqueStrength, keys, brakeSteerTorqueScale, rollTorqueSpeedReference, rollTorqueSpeedExponent } =
      marble;

    this._camForward.x = this._camTarget.x - this._camEye.x;
    this._camForward.y = 0;
    this._camForward.z = this._camTarget.z - this._camEye.z;
    let fLen = Math.hypot(this._camForward.x, this._camForward.z);
    if (fLen < 1e-10) {
      vec3Set(this._camForward, 0, 0, -1);
    } else {
      this._camForward.x /= fLen;
      this._camForward.z /= fLen;
    }

    vec3Cross(this._camRight, this._camForward, this._worldUp);
    if (vec3LengthSq(this._camRight) < 1e-10) {
      vec3Set(this._camRight, 1, 0, 0);
    } else {
      vec3Normalize(this._camRight);
    }

    vec3Set(this._rollWant, 0, 0, 0);
    if (this.input.isDown(keys.forward)) {
      this._rollWant.x += this._camForward.x;
      this._rollWant.z += this._camForward.z;
    }
    if (this.input.isDown(keys.back)) {
      this._rollWant.x -= this._camForward.x;
      this._rollWant.z -= this._camForward.z;
    }
    if (this.input.isDown(keys.left)) {
      this._rollWant.x -= this._camRight.x;
      this._rollWant.z -= this._camRight.z;
    }
    if (this.input.isDown(keys.right)) {
      this._rollWant.x += this._camRight.x;
      this._rollWant.z += this._camRight.z;
    }

    const braking = this.input.isBrakeActive();
    const torqueMul = braking ? brakeSteerTorqueScale : 1;

    /** Sublinear torque vs horizontal speed — same inputs at low speed; less “exponential” feel when already fast. */
    const vx = body.velocity.x;
    const vz = body.velocity.z;
    const speedXZ = Math.hypot(vx, vz);
    const ref = rollTorqueSpeedReference ?? 17;
    const exp = rollTorqueSpeedExponent ?? 1.55;
    const speedAtten = 1 / (1 + Math.pow(speedXZ / Math.max(0.001, ref), exp));

    if (vec3LengthSq(this._rollWant) >= 1e-10) {
      vec3Normalize(this._rollWant);
      vec3Cross(this._torqueAxis, this._worldUp, this._rollWant);
      const ts = torqueStrength * torqueMul * speedAtten;
      this._torqueAxis.x *= ts;
      this._torqueAxis.y *= ts;
      this._torqueAxis.z *= ts;
      this._torque.set(this._torqueAxis.x, this._torqueAxis.y, this._torqueAxis.z);
      body.applyTorque(this._torque);
    }

    if (braking) {
      const kl = Math.exp(-marble.brakeLinearDecay * deltaSeconds);
      const ka = Math.exp(-marble.brakeAngularDecay * deltaSeconds);
      body.velocity.x *= kl;
      body.velocity.z *= kl;
      body.angularVelocity.x *= ka;
      body.angularVelocity.y *= ka;
      body.angularVelocity.z *= ka;
    }

    if (this.input.wasPressedEdge(keys.jump)) {
      this.physics.applyMarbleJump(marble.jumpImpulse);
    }
  }

  /**
   * Arrow keys orbit the camera around the marble; does not use marble orientation.
   * @param {number} deltaSeconds
   */
  _applyCameraControls(deltaSeconds) {
    const cam = ControlSettings.camera;
    const k = cam.keys;
    if (this.input.isDown(k.yawLeft)) this._cameraYaw += cam.yawSpeed * deltaSeconds;
    if (this.input.isDown(k.yawRight)) this._cameraYaw -= cam.yawSpeed * deltaSeconds;
    if (this.input.isDown(k.pitchUp)) this._cameraPitch += cam.pitchSpeed * deltaSeconds;
    if (this.input.isDown(k.pitchDown)) this._cameraPitch -= cam.pitchSpeed * deltaSeconds;
    this._cameraPitch = Math.max(cam.pitchMin, Math.min(cam.pitchMax, this._cameraPitch));
  }

  /**
   * Third-person camera from yaw/pitch orbit; marble rotation does not affect the rig.
   */
  _updateCamera() {
    const body = this.physics.marbleBody;
    if (!body) return;

    const px = body.interpolatedPosition.x;
    const py = body.interpolatedPosition.y;
    const pz = body.interpolatedPosition.z;

    const d = ControlSettings.camera.distance;
    const cp = Math.cos(this._cameraPitch);
    const sp = Math.sin(this._cameraPitch);
    const sy = Math.sin(this._cameraYaw);
    const cy = Math.cos(this._cameraYaw);

    /** Orbit behind the marble when yaw = 0: track runs toward +Z, so offset Z must be negative. */
    this._tmpVec.x = -d * cp * sy;
    this._tmpVec.y = d * sp;
    this._tmpVec.z = -d * cp * cy;

    this._camEye.x = px + this._tmpVec.x;
    this._camEye.y = py + this._tmpVec.y;
    this._camEye.z = pz + this._tmpVec.z;
    this._camTarget.x = px;
    this._camTarget.y = py;
    this._camTarget.z = pz;
  }

  _checkWinCondition() {
    const body = this.physics.marbleBody;
    if (!body) return;
    const mr = this.physics.marbleRadius;

    if (this._zones) {
      if (marbleTouchesZone(body.position, this._zones.start, mr)) {
        this._startZoneTouched = true;
      }
      if (
        this._startZoneTouched &&
        marbleTouchesZone(body.position, this._zones.end, mr)
      ) {
        this.queue.enqueue({
          type: 'GOAL_REACHED',
          payload: { levelIndex: this.session.currentLevelIndex },
        });
      }
      return;
    }

    const goal = this._goal;
    if (!goal) return;
    if (isGoalReached(body.position, goal.position, goal.radius, mr)) {
      this.queue.enqueue({
        type: 'GOAL_REACHED',
        payload: { levelIndex: this.session.currentLevelIndex },
      });
    }
  }

  /**
   * Authoritative position (not interpolated): if the marble drops too far below the spawn height, it is lost.
   */
  _checkFall() {
    const body = this.physics.marbleBody;
    if (!body) return;
    const y = body.position.y;
    if (!Number.isFinite(y) || !Number.isFinite(this._killPlaneY)) return;
    if (y >= this._killPlaneY) return;
    /**
     * Apply immediately — do not enqueue `MARBLE_DIED`. Several events can drain in one batch; the
     * first sets `marbleDead`, so later copies see `!playing` and skip, under-counting falls.
     */
    this._handleMarbleFallDeath();
  }

  /**
   * Run-wide fall: increments count, run game over at {@link GameplaySettings.runMaxFalls}, else marble dead UI.
   */
  _handleMarbleFallDeath() {
    if (!this.states.is('playing')) return;
    this._fallCount += 1;
    this.ui.setFallHud(this._fallCount);
    const body = this.physics.marbleBody;
    if (body) {
      body.velocity.set(0, 0, 0);
      body.angularVelocity.set(0, 0, 0);
    }
    const max = GameplaySettings.runMaxFalls;
    if (this._fallCount >= max) {
      this.states.setState('runGameOver');
      this.ui.showRunGameOver({
        coinsCollected: this.coinLedger.getRunGameOverTotal(),
        coinsPossible: this.coinLedger.getRunPossibleTotal?.() ?? 0,
      });
      return;
    }
    this.states.setState('marbleDead');
    this.ui.showMarbleDead();
  }

  _syncMarbleMesh() {
    const body = this.physics.marbleBody;
    if (!body) {
      this.marbleSceneMesh.visible = false;
      return;
    }
    this.marbleSceneMesh.visible = true;
    this.marbleSceneMesh.position.x = body.interpolatedPosition.x;
    this.marbleSceneMesh.position.y = body.interpolatedPosition.y;
    this.marbleSceneMesh.position.z = body.interpolatedPosition.z;
    this.marbleSceneMesh.quaternion.x = body.interpolatedQuaternion.x;
    this.marbleSceneMesh.quaternion.y = body.interpolatedQuaternion.y;
    this.marbleSceneMesh.quaternion.z = body.interpolatedQuaternion.z;
    this.marbleSceneMesh.quaternion.w = body.interpolatedQuaternion.w;
  }
}
