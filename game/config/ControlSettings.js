/**
 * Central place for control bindings and tuning. Marble and camera are separate.
 * Procedural path width and difficulty-adjacent geometry: `GameplaySettings.js`.
 */
export const ControlSettings = {
  marble: {
    /** Torque magnitude applied along world axes (cannon-es). */
    torqueStrength: 24,
    /** Upward impulse (N·s) at the centre of mass when jumping (mass ≈ 2). ~13 → Δv ≈ 6.5 m/s with g = 28. */
    jumpImpulse: 13,
    /** Exponential decay per second for linear (xz) and angular velocity while Shift is held. */
    brakeLinearDecay: 8.35,
    brakeAngularDecay: 10.2,
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
     * After load, yaw is overridden when an end position exists (see `endZoneClockYawOffsetRad`).
     */
    initialYaw: 0,
    initialPitch: 0.52,
    /**
     * Added to horizontal yaw aimed from spawn toward the end zone so the goal sits ~2 o’clock
     * (upper-right) instead of dead centre. Tune if the framing feels off.
     */
    endZoneClockYawOffsetRad: -Math.PI / 6,
    keys: {
      yawLeft: 'ArrowLeft',
      yawRight: 'ArrowRight',
      pitchUp: 'ArrowUp',
      pitchDown: 'ArrowDown',
    },
  },

  /** Marble centre Y below spawn Y minus this value triggers a fall death. */
  fallDeathBelowSpawn: 12,
};
