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

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87b8d8);
    this.scene.fog = new THREE.Fog(0x87b8d8, 28, 90);

    this.camera = new THREE.PerspectiveCamera(58, 1, 0.1, 200);
    this.camera.position.set(0, 10, 16);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this._materials = {
      static: new THREE.MeshStandardMaterial({
        color: 0x4a5d6b,
        roughness: 0.85,
        metalness: 0.05,
      }),
      plaza: new THREE.MeshStandardMaterial({
        color: 0xe8d48a,
        roughness: 0.78,
        metalness: 0.04,
      }),
      path: new THREE.MeshStandardMaterial({
        color: 0x5a7d8c,
        roughness: 0.82,
        metalness: 0.06,
      }),
      pathWide: new THREE.MeshStandardMaterial({
        color: 0x6a8d9c,
        roughness: 0.8,
        metalness: 0.06,
      }),
      ramp: new THREE.MeshStandardMaterial({
        color: 0x52b788,
        roughness: 0.75,
        metalness: 0.05,
      }),
      goal: new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0c4a6e,
        emissiveIntensity: 0.55,
        transparent: true,
        opacity: 0.42,
        roughness: 0.35,
        metalness: 0.1,
        depthWrite: false,
      }),
      zoneStart: new THREE.MeshStandardMaterial({
        color: 0x4ade80,
        emissive: 0x14532d,
        emissiveIntensity: 0.35,
        transparent: true,
        opacity: 0.55,
        roughness: 0.4,
        metalness: 0.15,
        depthWrite: false,
      }),
      zoneEnd: new THREE.MeshStandardMaterial({
        color: 0xfbbf24,
        emissive: 0x78350f,
        emissiveIntensity: 0.45,
        transparent: true,
        opacity: 0.55,
        roughness: 0.35,
        metalness: 0.2,
        depthWrite: false,
      }),
      lattice: new THREE.MeshStandardMaterial({
        color: 0x8a9caf,
        wireframe: true,
        metalness: 0.12,
        roughness: 0.8,
      }),
      marble: new THREE.MeshStandardMaterial({
        color: 0xd4e8f5,
        roughness: 0.25,
        metalness: 0.65,
      }),
    };

    const marbleGeo = new THREE.SphereGeometry(this.physics.marbleRadius, 40, 32);
    this.marbleMesh = new THREE.Mesh(marbleGeo, this._materials.marble);
    this.marbleMesh.castShadow = true;
    this.marbleMesh.receiveShadow = false;
    this.scene.add(this.marbleMesh);

    const hemi = new THREE.HemisphereLight(0xddeeff, 0x334455, 0.55);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffffff, 1.05);
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
    console.log('[marble] loading level manifest…');
    await this._loadLevelBundle();
    console.log('[marble] ready — flat materials only; filter [procgen] or [level] for timings.');
    this._registerCommands();
    this._wireUi();
    this.ui.showMenu();
    this._onResize();
    this._loop.start();
  }

  async _loadLevelBundle() {
    const url = new URL('../levels/levels.json', import.meta.url);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load levels: ${res.status}`);
    this.bundle = await res.json();
    if (this.bundle.schemaVersion !== 2 || !this.bundle.procgen) {
      console.warn('levels.json should use schemaVersion 2 with procgen: true.');
    }
  }

  _registerCommands() {
    this.queue.register('START_GAME', () => {
      this._devMode = !!this.ui.devModeCheckbox?.checked;
      this.session.currentLevelIndex = 0;
      this._runLevelLoadDeferred(this.session.currentLevelIndex, () => {
        this.states.setState('playing');
        this._focusPlay();
      });
    });

    this.queue.register('LOAD_LEVEL', (payload) => {
      if (!payload || typeof payload.index !== 'number') return;
      this._runLevelLoadDeferred(payload.index, () => {
        this.states.setState('playing');
        this._focusPlay();
      });
    });

    this.queue.register('RESTART_LEVEL', () => {
      if (!this.states.is('playing') && !this.states.is('marbleDead')) return;
      if (!this._spawn) return;
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
        this.session.currentLevelIndex = next;
        this._runLevelLoadDeferred(this.session.currentLevelIndex, () => {
          this.states.setState('playing');
          this._focusPlay();
        });
      } else {
        this.session.currentLevelIndex = 0;
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
      this.ui.showLevelComplete(
        'Level complete',
        'Press Enter to continue.',
        isFinal,
      );
      if (levelName && this.ui.levelCompleteTitle) {
        this.ui.levelCompleteTitle.textContent = `${levelName} — complete`;
      }
    });

    this.queue.register('RETURN_TO_MENU', () => {
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

  _wireUi() {
    this.ui.btnNewGame?.addEventListener('click', () => {
      this.queue.enqueue({ type: 'START_GAME' });
    });
    this.ui.btnContinue?.addEventListener('click', () => {
      this.queue.enqueue({ type: 'ADVANCE_LEVEL' });
    });
    this.ui.btnTryAgain?.addEventListener('click', () => {
      this.queue.enqueue({ type: 'RESTART_LEVEL' });
    });
    this.ui.btnDevSkip?.addEventListener('click', () => {
      if (!this._devMode || !this.states.is('playing')) return;
      this.queue.enqueue({
        type: 'GOAL_REACHED',
        payload: { levelIndex: this.session.currentLevelIndex },
      });
    });
  }

  _focusPlay() {
    const name = formatLevelLabel(this.session.currentLevelIndex);
    this.ui.showPlaying(name, this._devMode);
    this.canvas?.focus();
  }

  /**
   * Yields two animation frames so the browser can paint a loading state before heavy procgen / mesh build.
   * @param {number} index
   * @param {() => void} [done]
   */
  _runLevelLoadDeferred(index, done) {
    this.ui.setLevelLoading(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        try {
          const t0 = performance.now();
          this._loadLevelAtIndex(index);
          console.log(`[level] index ${index} loaded in ${(performance.now() - t0).toFixed(1)}ms (procgen + meshes)`);
        } catch (err) {
          console.error('[level] load failed', err);
        } finally {
          this.ui.setLevelLoading(false);
        }
        done?.();
      });
    });
  }

  _resetCameraOrbit() {
    this._cameraYaw = ControlSettings.camera.initialYaw;
    this._cameraPitch = ControlSettings.camera.initialPitch;
  }

  /**
   * @param {number} index
   */
  _loadLevelAtIndex(index) {
    if (!this.bundle) return;

    let descriptor;
    if (this.bundle.procgen) {
      descriptor = generateProcgenDescriptor(index);
    } else {
      descriptor = this.bundle.levels?.[index];
    }
    if (!descriptor) return;

    this.levelLoader.clear(this.physics.world, this.scene);
    const tBuild = performance.now();
    const built = this.levelLoader.build(this.physics.world, this.scene, this._materials, descriptor);
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
    this._syncMarbleMesh();
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
      this._applyCameraControls(deltaSeconds);
      this._updateCamera();
      this._applyMarbleControls(deltaSeconds);
      this._checkWinCondition();
      this._checkFall();
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
