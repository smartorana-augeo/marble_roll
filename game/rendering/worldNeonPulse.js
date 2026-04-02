import * as THREE from 'three';

/**
 * Per-tier tuning: smooth waves only (no random pops — “glitch” is layered sines + slow drift).
 * chromaLineAmp scales hue drift; pulseAmp scales emissive breathing.
 */
const TIER = {
  coin: {
    pulseAmp: 1.12,
    chromaLineAmp: 0.18,
    speed: 1.05,
    /** Follow speed for hologram drift target — lower = smoother, less “pop”. */
    holoGlitchLerp: 4.2,
  },
  zone: {
    pulseAmp: 0.58,
    chromaLineAmp: 0.065,
    speed: 0.52,
    hueWobble: 0.022,
  },
  platform: {
    pulseAmp: 0.4,
    chromaLineAmp: 0.034,
    speed: 0.54,
    hueWobble: 0.014,
  },
  marble: {
    pulseAmp: 0.36,
    chromaLineAmp: 0.03,
    speed: 0.58,
    hueWobble: 0.012,
  },
};

/**
 * Animates shared materials: soft coin hologram uniforms when present, otherwise
 * {@link THREE.MeshStandardMaterial} emissive for zones, platforms and marble.
 */
export class WorldNeonPulse {
  constructor() {
    this._t = 0;
    /** @type {object[]} */
    this._targets = [];
    /** Smoothed hologram glitch drive (coin) — avoids one-frame spikes. */
    this._holoGlitchSmoothed = 0;
  }

  /**
   * Snapshot base emissive from materials (call after materials are fully configured).
   * @param {Record<string, THREE.MeshStandardMaterial | import('three').ShaderMaterial>} materials
   */
  capture(materials) {
    this._targets = [];
    this._holoGlitchSmoothed = 0;

    /** @param {string} key @param {keyof typeof TIER} tierId @param {number} [phase] */
    const add = (key, tierId, phase) => {
      const m = materials[key];
      if (key === 'coin' && m && m.userData?.hologramUniforms) {
        const tier = TIER.coin;
        const ph =
          typeof phase === 'number'
            ? phase
            : key.split('').reduce((a, c) => a + c.charCodeAt(0), 0) * 0.01;
        this._targets.push({
          key: 'coin',
          tierId: 'coin',
          hologram: true,
          uniforms: m.userData.hologramUniforms,
          phase: ph,
          ...tier,
        });
        return;
      }
      if (!m || !(m instanceof THREE.MeshStandardMaterial)) return;
      const tier = TIER[tierId];
      const ph =
        typeof phase === 'number'
          ? phase
          : key.split('').reduce((a, c) => a + c.charCodeAt(0), 0) * 0.01;
      this._targets.push({
        key,
        tierId,
        intensity: m.emissiveIntensity,
        emissive: m.emissive.clone(),
        phase: ph,
        ...tier,
      });
    };

    add('coin', 'coin', 0);
    add('zoneStart', 'zone', 2.17);
    add('zoneEnd', 'zone', 4.31);

    for (const key of ['static', 'plaza', 'path', 'pathWide', 'ramp', 'lattice']) {
      add(key, 'platform');
    }

    add('marble', 'marble', 1.15);
  }

  /**
   * @param {number} dt
   * @param {Record<string, THREE.MeshStandardMaterial | import('three').ShaderMaterial>} materials
   */
  update(dt, materials) {
    if (!this._targets.length) return;
    this._t += dt;
    const t = this._t;

    for (const b of this._targets) {
      const m = materials[b.key];
      if (!m) continue;

      if (b.hologram && b.uniforms) {
        const u = b.uniforms;
        u.uTime.value = t;
        const ts = t * b.speed * 0.72;
        const wave = Math.sin(ts * 2.25 + b.phase);
        const wave2 = Math.sin(ts * 5.1 + b.phase * 1.3);
        const pulseCore = 0.62 * wave + 0.38 * wave2;
        const breathe = 0.72 + 0.28 * pulseCore * b.pulseAmp * 0.78;
        const micro =
          0.018 *
          Math.sin(ts * 6.5 + b.phase) *
          Math.sin(ts * 9.2 + b.phase * 0.6);
        u.uPulse.value = Math.min(1.1, Math.max(0.84, breathe + micro));

        u.uHueShift.value =
          b.chromaLineAmp *
          0.42 *
          (Math.sin(ts * 2.6 + b.phase) + 0.48 * Math.sin(ts * 4.4 + b.phase * 0.65));

        /** Slow, low-frequency beat only — no fast carriers that read as pop-in. */
        const gTarget =
          0.55 * Math.sin(ts * 1.9 + b.phase) * Math.sin(ts * 3.1 + b.phase * 0.42) +
          0.28 * Math.sin(ts * 4.8 + b.phase * 0.9);

        const lerp = b.holoGlitchLerp ?? 4.2;
        this._holoGlitchSmoothed += (gTarget - this._holoGlitchSmoothed) * Math.min(1, dt * lerp);
        u.uGlitch.value = this._holoGlitchSmoothed;
        continue;
      }

      const ts = t * b.speed;
      const wave = Math.sin(ts * 2.25 + b.phase);
      const wave2 = Math.sin(ts * 5.1 + b.phase * 1.3);
      const pulseCore = 0.62 * wave + 0.38 * wave2;
      const interference =
        0.05 *
        Math.sin(ts * 8.4 + b.phase) *
        Math.sin(ts * 12.9 + b.phase * 0.55);
      let pulse = 0.7 + 0.3 * pulseCore * b.pulseAmp + interference;
      pulse = Math.min(1.35, Math.max(0.55, pulse));
      m.emissiveIntensity = b.intensity * pulse;

      m.emissive.copy(b.emissive);
      const chroma =
        b.chromaLineAmp *
        (Math.sin(ts * 4.4 + b.phase) + 0.64 * Math.sin(ts * 7.15 + b.phase * 0.7));
      m.emissive.multiplyScalar(1 + chroma * 0.85);

      const hw = b.hueWobble ?? 0.018;
      const hue =
        hw *
        Math.sin(ts * 5.8 + b.phase) *
        Math.sin(ts * 3.4 + b.phase * 1.1);
      const sat = hue * 0.45;
      const light = hue * 0.38;
      m.emissive.offsetHSL(hue, sat, light);
    }
  }
}
