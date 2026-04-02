/**
 * Central place for control bindings and tuning. Marble and camera are separate.
 * Procedural path width and difficulty-adjacent geometry: `GameplaySettings.js`.
 */
export const ControlSettings = {
  marble: {
    /** Torque magnitude applied along world axes (cannon-es). */
    torqueStrength: 26,
    /**
     * Horizontal speed (|v.xz|) at which roll torque is scaled to ~50%. Tones down runaway spin-up at
     * high speed while leaving low-speed acceleration unchanged.
     */
    rollTorqueSpeedReference: 17,
    /**
     * Power on (speed / reference): higher = sharper knee. ~1.4–1.8 avoids feeling exponential late.
     */
    rollTorqueSpeedExponent: 1.55,
    /** Upward impulse (N·s) at the centre of mass when jumping (mass ≈ 2). ~13 → Δv ≈ 6.5 m/s with g = 28. */
    jumpImpulse: 13,
    /**
     * While Shift (brake) is held, roll torque is multiplied by this. Full torque plus brake caused a
     * stuck slow “strafe”; zero torque felt unresponsive. ~0.45–0.55 keeps steering without re-triggering that bug.
     */
    brakeSteerTorqueScale: 0.52,
    /** Exponential decay per second for linear (xz) and angular velocity while Shift is held. Lower = spongier, less snappy. */
    brakeLinearDecay: 7.45,
    brakeAngularDecay: 9.1,
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
  /**
   * When applying `descriptor.killPlaneY`, clamp so the plane never sits above
   * `spawn[1] - fallKillPlaneMarginBelowSpawn` (avoids bogus “out of bounds” if the value is corrupt).
   */
  fallKillPlaneMarginBelowSpawn: 2,
};
