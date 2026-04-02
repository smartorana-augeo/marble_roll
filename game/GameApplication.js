import * as THREE from 'three';
import { Vec3 } from 'cannon-es';
import { FrameCommandQueue } from './FrameCommandQueue.js';
import { GameLoop } from './GameLoop.js';
import { GameStateMachine } from './GameStateMachine.js';
import { LevelLoader } from './level/LevelLoader.js';
import { InputSystem } from './systems/InputSystem.js';
import { PhysicsSystem } from './systems/PhysicsSystem.js';
import { UISystem } from './systems/UISystem.js';
import { ControlSettings } from './config/ControlSettings.js';
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

    /** @type {{ schemaVersion: number, levels: object[] } | null} */
    this.bundle = null;
    this.session = {
      currentLevelIndex: 0,
      loadedLevelId: '',
    };

    /** @type {[number, number, number] | null} */
    this._spawn = null;
    /** @type {{ position: THREE.Vector3, radius: number } | null} */
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

    this.scene = new THREE.Scene();
    /** Sky colour comes from CSS starfield behind the canvas (`alpha: true`). */
    this.scene.background = null;
    this.scene.fog = new THREE.Fog(0x133e7c, 24, 92);

    this.camera = new THREE.PerspectiveCamera(58, 1, 0.1, 200);
    this.camera.position.set(0, 10, 16);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    /** Let CSS `#app::before` starfield show through the WebGL surface. */
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this._materials = {
      static: new THREE.MeshStandardMaterial({
        color: 0x711c91,
        roughness: 0.72,
        metalness: 0.18,
        emissive: 0x2a0d38,
        emissiveIntensity: 0.12,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
      }),
      plaza: new THREE.MeshStandardMaterial({
        color: 0x711c91,
        roughness: 0.68,
        metalness: 0.2,
        emissive: 0x3d1560,
        emissiveIntensity: 0.18,
        polygonOffset: true,
        polygonOffsetFactor: 3,
        polygonOffsetUnits: 1,
      }),
      path: new THREE.MeshStandardMaterial({
        color: 0x711c91,
        roughness: 0.7,
        metalness: 0.2,
        emissive: 0x2a0d38,
        emissiveIntensity: 0.1,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
      }),
      pathWide: new THREE.MeshStandardMaterial({
        color: 0xea00d9,
        roughness: 0.58,
        metalness: 0.28,
        emissive: 0x6b0062,
        emissiveIntensity: 0.22,
        polygonOffset: true,
        polygonOffsetFactor: 2,
        polygonOffsetUnits: 1,
      }),
      ramp: new THREE.MeshStandardMaterial({
        color: 0xea00d9,
        roughness: 0.6,
        metalness: 0.22,
        emissive: 0x5c0054,
        emissiveIntensity: 0.15,
        polygonOffset: true,
        polygonOffsetFactor: 2,
        polygonOffsetUnits: 1,
      }),
      goal: new THREE.MeshStandardMaterial({
        color: 0xff6b35,
        emissive: 0x8b2500,
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: 0.45,
        roughness: 0.35,
        metalness: 0.15,
        depthWrite: false,
      }),
      zoneStart: new THREE.MeshStandardMaterial({
        color: 0x0abdc6,
        emissive: 0x045a61,
        emissiveIntensity: 0.45,
        transparent: true,
        opacity: 0.58,
        roughness: 0.38,
        metalness: 0.22,
        depthWrite: false,
      }),
      zoneEnd: new THREE.MeshStandardMaterial({
        color: 0xff6b35,
        emissive: 0x8b2500,
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: 0.58,
        roughness: 0.34,
        metalness: 0.2,
        depthWrite: false,
      }),
      lattice: new THREE.MeshStandardMaterial({
        color: 0x0abdc6,
        wireframe: true,
        metalness: 0.35,
        roughness: 0.55,
        emissive: 0x045a61,
        emissiveIntensity: 0.25,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
      }),
      coin: new THREE.MeshStandardMaterial({
        color: 0xe0ffff,
        emissive: 0x00fff2,
        emissiveIntensity: 1.65,
        roughness: 0.12,
        metalness: 0.45,
        polygonOffset: true,
        polygonOffsetFactor: -0.8,
        polygonOffsetUnits: -1,
      }),
      marble: new THREE.MeshStandardMaterial({
        color: 0xfff59a,
        roughness: 0.14,
        metalness: 0.42,
        emissive: 0xffee00,
        emissiveIntensity: 1.1,
      }),
    };

    const marbleGeo = new THREE.SphereGeometry(this.physics.marbleRadius, 40, 32);
    this.marbleMesh = new THREE.Mesh(marbleGeo, this._materials.marble);
    this.marbleMesh.castShadow = true;
    this.marbleMesh.receiveShadow = false;
    this.scene.add(this.marbleMesh);

    const hemi = new THREE.HemisphereLight(0x4a2a6b, 0x091833, 0.48);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffe8ff, 0.92);
    sun.position.set(18, 32, 12);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 120;
    sun.shadow.camera.left = -40;
    sun.shadow.camera.right = 40;
    sun.shadow.camera.top = 40;
    sun.shadow.camera.bottom = -40;
    this.scene.add(sun);

    /** Orbit angles (rad); independent of marble roll. */
    this._cameraYaw = ControlSettings.camera.initialYaw;
    this._cameraPitch = ControlSettings.camera.initialPitch;

    this._tmpVec = new THREE.Vector3();
    this._worldUp = new THREE.Vector3(0, 1, 0);
    this._camForward = new THREE.Vector3();
    this._camRight = new THREE.Vector3();
    this._rollWant = new THREE.Vector3();
    this._torqueAxis = new THREE.Vector3();
    this._torque = new Vec3();

    this._loop = new GameLoop((dt) => this._onFrame(dt));

    this._resize = () => this._onResize();
    window.addEventListener('resize', this._resize);

    this._onCanvasKeyDown = (e) => {
      if (e.code === 'Space') e.preventDefault();
    };
    this.canvas?.addEventListener('keydown', this._onCanvasKeyDown);
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
    this._hydrateBundleFromInlineManifest();
    this.ui.setMenuManifestLoading(!this.bundle);
    this._loop.start();

    if (!this.bundle) {
      console.log('[marble] loading level manifest…');
      await this._loadLevelBundle();
    } else {
      console.log('[marble] level manifest from inline #marble-level-manifest (fetch skipped).');
    }
    console.log('[marble] ready — flat materials only; filter [procgen] or [level] for timings.');

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
        console.log('[marble] fetching manifest:', href);
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
      console.log('[marble:flow] ③ START_GAME handler', {
        loadInProgress: this._levelLoadInProgress,
        hasBundle: !!this.bundle,
        state: this.states.state,
      });
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
      this._devMode = !!this.ui.devModeCheckbox?.checked;
      this.coinLedger.startNewRun();
      this.session.currentLevelIndex = 0;
      console.log('[marble:flow] ④ calling _runLevelLoadFlow(0)');
      void this._runLevelLoadFlow(this.session.currentLevelIndex, () => {
        console.log('[marble:flow] ⑫ done callback: entering playing + focus');
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

    this.queue.register('MARBLE_DIED', () => {
      if (!this.states.is('playing')) return;
      this.states.setState('marbleDead');
      const body = this.physics.marbleBody;
      if (body) {
        body.velocity.set(0, 0, 0);
        body.angularVelocity.set(0, 0, 0);
      }
      this.ui.showMarbleDead();
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
        this.coinRuntime.clear();
        this.levelLoader.clear(this.physics.world, this.scene);
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
      this.coinRuntime.clear();
      this.levelLoader.clear(this.physics.world, this.scene);
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
    console.log('[marble:flow] enqueue', cmd.type);
    this.queue.enqueue(cmd);
    this.queue.drain(16);
    console.log('[marble:flow] enqueue returned after drain', cmd.type);
  }

  _wireUi() {
    if (!this.ui.btnNewGame) {
      console.error('[marble:flow] #btn-new-game is null — wireUi cannot attach listeners.');
    } else {
      console.log('[marble:flow] wiring #btn-new-game (click + pointerdown capture)');
    }
    this.ui.btnNewGame?.addEventListener(
      'pointerdown',
      () => {
        console.log('[marble:flow] ① pointerdown on New game (reaches button)');
      },
      true,
    );
    this.ui.btnNewGame?.addEventListener('click', () => {
      console.log('[marble:flow] ② click on New game');
      this._enqueueAndDrain({ type: 'START_GAME' });
    });
    this.ui.btnContinue?.addEventListener('click', () => {
      this._enqueueAndDrain({ type: 'ADVANCE_LEVEL' });
    });
    this.ui.btnTryAgain?.addEventListener('click', () => {
      this._enqueueAndDrain({ type: 'RESTART_LEVEL' });
    });
    this.ui.btnDevSkip?.addEventListener('click', () => {
      if (!this._devMode || !this.states.is('playing')) return;
      this._enqueueAndDrain({
        type: 'GOAL_REACHED',
        payload: { levelIndex: this.session.currentLevelIndex },
      });
    });
  }

  _focusPlay() {
    const name = formatLevelLabel(this.session.currentLevelIndex);
    this.ui.showPlaying(name, this._devMode);
    this._refreshCoinHud();
    this.canvas?.focus();
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
    console.log('[marble:flow] ⑤ _runLevelLoadFlow entry', { index });
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
      console.log('[marble:flow] ⑥ await yieldToPaint (loading overlay should paint)');
      await yieldToPaint();
      if (!this.bundle) {
        console.warn('[marble:flow] ⑥a abort: bundle cleared');
        return;
      }

      /** @type {object | undefined} */
      let descriptor;
      if (this.bundle.procgen) {
        console.log('[marble:flow] ⑦ await generateProcgenDescriptor…');
        descriptor = await generateProcgenDescriptor(index, {
          yieldForUi: () => yieldToPaint(),
          onProgress: (info) => {
            this.ui.setLevelLoadProgress(info.fraction * 0.75, info.label);
          },
        });
        console.log('[marble:flow] ⑧ generateProcgenDescriptor resolved', {
          id: descriptor?.id,
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
      console.log('[marble:flow] ⑨ _applyLoadedLevel (LevelLoader.build)…');
      const t0 = performance.now();
      this._applyLoadedLevel(descriptor, index);
      console.log(
        `[marble:flow] ⑩ level meshes ready in ${(performance.now() - t0).toFixed(1)}ms`,
      );
      console.log(
        `[level] index ${index} loaded in ${(performance.now() - t0).toFixed(1)}ms (procgen + meshes)`,
      );
      this.ui.setLevelLoadProgress(1, '');
      await yieldToPaint();
      console.log('[marble:flow] ⑪ invoking done() → playing state');
      done?.();
      if (isEmbedActive()) {
        notifyLevelLoaded({ levelIndex: this.session.currentLevelIndex });
      }
    } catch (err) {
      console.error('[marble:flow] load failed (catch)', err);
      console.error('[level] load failed', err);
    } finally {
      console.log('[marble:flow] ⑬ finally: hide loading overlay, clear load lock');
      this.ui.hideLevelLoadingScreen();
      this._levelLoadInProgress = false;
    }
  }

  _resetCameraOrbit() {
    this._cameraYaw = ControlSettings.camera.initialYaw;
    this._cameraPitch = ControlSettings.camera.initialPitch;
  }

  /**
   * Applies a ready descriptor: physics meshes, spawn, coins session for this level.
   * @param {object} descriptor
   * @param {number} index
   */
  _applyLoadedLevel(descriptor, index) {
    console.log('[marble:flow] ⑨a levelLoader.clear');
    this.levelLoader.clear(this.physics.world, this.scene);
    const tBuild = performance.now();
    console.log('[marble:flow] ⑨b levelLoader.build…');
    const built = this.levelLoader.build(this.physics.world, this.scene, this._materials, descriptor);
    console.log(`[marble:flow] ⑨c LevelLoader.build done ${(performance.now() - tBuild).toFixed(1)}ms`);
    console.log(`[level] LevelLoader.build ${(performance.now() - tBuild).toFixed(1)}ms`);
    this._spawn = /** @type {[number, number, number]} */ ([
      descriptor.spawn[0],
      descriptor.spawn[1],
      descriptor.spawn[2],
    ]);
    this._goal = built.goal;
    this._zones = built.zones;
    this._startZoneTouched = false;
    this._killPlaneY =
      typeof descriptor.killPlaneY === 'number'
        ? descriptor.killPlaneY
        : this._spawn[1] - ControlSettings.fallDeathBelowSpawn;
    this._resetCameraOrbit();
    this.session.loadedLevelId = descriptor.id;
    this.session.currentLevelIndex = index;

    this.physics.createMarble(this._spawn);
    this.coinRuntime.load(built.coinEntries ?? []);
    this.coinLedger.beginLevel(Array.isArray(descriptor.coins) ? descriptor.coins.length : 0);
    this._syncMarbleMesh();
    this._refreshCoinHud();
  }

  _onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  /**
   * @param {number} deltaSeconds
   */
  _onFrame(deltaSeconds) {
    this.input.poll();
    this._enqueueInputCommands();
    this.queue.drain(16);

    if (this.states.is('playing')) {
      this.physics.step(deltaSeconds);
    }

    if (this.states.is('playing')) {
      if (this._embedFirstInteractionPending) {
        if (this.input.hasAnyGameplayEdge()) {
          this._embedFirstInteractionPending = false;
          notifyFirstInteraction();
        }
      }
      this._applyCameraControls(deltaSeconds);
      this._updateCamera();
      this._applyMarbleControls(deltaSeconds);
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
    this.renderer.render(this.scene, this.camera);
  }

  _enqueueInputCommands() {
    const { input, states, queue } = this;

    if (states.is('menu')) {
      if (input.wasPressedEdge('Enter')) queue.enqueue({ type: 'START_GAME' });
      return;
    }

    if (states.is('levelComplete')) {
      if (input.wasPressedEdge('Enter')) queue.enqueue({ type: 'ADVANCE_LEVEL' });
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
    const { torqueStrength, keys } = marble;

    this.camera.getWorldDirection(this._camForward);
    this._camForward.y = 0;
    if (this._camForward.lengthSq() < 1e-10) {
      this._camForward.set(0, 0, -1);
    } else {
      this._camForward.normalize();
    }

    this._camRight.crossVectors(this._camForward, this._worldUp);
    if (this._camRight.lengthSq() < 1e-10) {
      this._camRight.set(1, 0, 0);
    } else {
      this._camRight.normalize();
    }

    this._rollWant.set(0, 0, 0);
    if (this.input.isDown(keys.forward)) this._rollWant.add(this._camForward);
    if (this.input.isDown(keys.back)) this._rollWant.sub(this._camForward);
    if (this.input.isDown(keys.left)) this._rollWant.sub(this._camRight);
    if (this.input.isDown(keys.right)) this._rollWant.add(this._camRight);

    if (this._rollWant.lengthSq() >= 1e-10) {
      this._rollWant.normalize();
      this._torqueAxis.crossVectors(this._worldUp, this._rollWant).multiplyScalar(torqueStrength);
      this._torque.set(this._torqueAxis.x, this._torqueAxis.y, this._torqueAxis.z);
      body.applyTorque(this._torque);
    }

    if (this.input.isBrakeActive()) {
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

    this.camera.position.set(px + this._tmpVec.x, py + this._tmpVec.y, pz + this._tmpVec.z);
    this.camera.lookAt(px, py, pz);
    this.camera.updateMatrixWorld(true);
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
    if (body.position.y < this._killPlaneY) {
      this.queue.enqueue({ type: 'MARBLE_DIED' });
    }
  }

  _syncMarbleMesh() {
    const body = this.physics.marbleBody;
    if (!body) {
      this.marbleMesh.visible = false;
      return;
    }
    this.marbleMesh.visible = true;
    this.marbleMesh.position.set(
      body.interpolatedPosition.x,
      body.interpolatedPosition.y,
      body.interpolatedPosition.z,
    );
    this.marbleMesh.quaternion.set(
      body.interpolatedQuaternion.x,
      body.interpolatedQuaternion.y,
      body.interpolatedQuaternion.z,
      body.interpolatedQuaternion.w,
    );
  }
}
