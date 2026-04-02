/**
 * Central place for control bindings and tuning. Marble and camera are separate.
 * Procedural path width and difficulty-adjacent geometry: `GameplaySettings.js`.
 */
export const ControlSettings = {
  marble: {
    /** Torque magnitude applied along world axes (cannon-es). */
    torqueStrength: 20,
    /** Upward impulse (N·s) at the centre of mass when jumping (mass ≈ 2). ~13 → Δv ≈ 6.5 m/s with g = 28. */
    jumpImpulse: 13,
    /** Exponential decay per second for linear (xz) and angular velocity while Shift is held. */
    brakeLinearDecay: 9,
    brakeAngularDecay: 11,
    keys: {
      forward: 'KeyW',
      back: 'KeyS',
      left: 'KeyA',
      right: 'KeyD',
      jump: 'Space',
    },
  },

  camera: {
    /** Orbit radius from marble centre. */
    distance: 13,
    /** Vertical orbit angle (radians), clamped to [pitchMin, pitchMax]. */
    pitchMin: 0.12,
    pitchMax: 1.45,
    /** Radians per second when an arrow key is held. */
    yawSpeed: 2.1,
    pitchSpeed: 1.5,
    /**
     * Starting yaw (radians). Orbit offset XZ is **negated** in `GameApplication._updateCamera`, so
     * **yaw 0** puts the camera on **−Z** (behind the marble) when the course runs toward **+Z**.
     */
    initialYaw: 0,
    initialPitch: 0.52,
    keys: {
      yawLeft: 'ArrowLeft',
      yawRight: 'ArrowRight',
      pitchUp: 'ArrowUp',
      pitchDown: 'ArrowDown',
    },
  },

  /** Marble centre Y below spawn Y minus this value triggers a fall death. */
  fallDeathBelowSpawn: 12,

  /** 2D side-runner player controls. */
  player2d: {
    /** Horizontal movement speed (world px / s). */
    moveSpeed: 220,
    /** Initial vertical velocity applied on jump (negative = upward in canvas coords). */
    jumpForce: -530,
    keys: {
      left: 'ArrowLeft',
      right: 'ArrowRight',
      jump: 'Space',
      altLeft: 'KeyA',
      altRight: 'KeyD',
      altJump: 'KeyW',
    },
  },

  /** Gravity acceleration for 2D physics (world px / s²). */
  gravity2d: 1400,

  /** Player Y below this many world px below spawn triggers fall death (2D). */
  fallDeathBelowSpawn2d: 420,
};
