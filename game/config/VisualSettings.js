/**
 * Single configuration for presentation: CRT overlay, HUD glow, cyber buttons, 3D pixel noise.
 * Tune here only — `applyVisualSettingsToDom` pushes values into CSS custom properties on `:root`.
 */

/**
 * @typedef {typeof visualSettingsDefaults} VisualSettingsShape
 */

const visualSettingsDefaults = Object.freeze({
  crt: Object.freeze({
    enabled: true,
    /**
     * Master strength for the whole `::after` stack (scanlines, tint, vignette).
     */
    overlayOpacity: 0.34,
    scanlineOpacity: 0.052,
    tint: Object.freeze({ r: 18, g: 20, b: 26, a: 0.068 }),
    vignetteStrong: 'rgba(0, 0, 0, 0.41)',
    overlayZ: 50,
    /** Scan-line drift — sole CRT motion in the perf build (`crtOverlay.css`). */
    rollDurationSec: 9,
    /**
     * Starfield layer (`#app::before`): drift + transform wobble + faint grain (`styles.css`).
     * Compositor-only (transform / opacity / background-position) — no game-thread or canvas cost.
     */
    backgroundWobble: Object.freeze({
      enabled: true,
      /** Slow drift keeps motion visible without busy keyframes. */
      driftDurationSec: 38,
      /** Gentle sub-pixel wobble; longer = calmer layer promotion. */
      wobbleDurationSec: 22,
      grainDriftDurationSec: 38,
      /** Faint grain strip — low alpha limits blend work from the repeating gradient. */
      grainOpacity: 0.014,
    }),
  }),
  hud: Object.freeze({
    /** Extra box-shadow layers on panel chrome (legend, scores, menu card, loading card, music mute HUD) */
    panelGlow:
      '0 0 12px rgba(93, 232, 255, 0.28), 0 0 28px rgba(255, 61, 168, 0.14), inset 0 0 20px rgba(93, 232, 255, 0.06)',
    panelGlowMenu:
      '0 0 10px rgba(93, 162, 240, 0.22), 0 0 22px rgba(242, 142, 43, 0.1), inset 0 0 16px rgba(93, 162, 240, 0.05)',
    /** When false, `html.vs-hud-fall-glitch-off` removes jitter on fall-count glyphs (`styles.css`). */
    fallGlitchEnabled: true,
  }),
  buttons: Object.freeze({
    /** When false, `html.vs-btn-glitch` is unset — no cyber/menu title keyframe glitch. */
    cyberGlitchEnabled: true,
    /** Slightly slower than the old default so bursts feel less frantic (still compositor-only). */
    cyberGlitchPeriodSec: 5.2,
  }),
  world3d: Object.freeze({
    /**
     * Backing-store pixels are at most (CSS px × DPR × this). Primary FPS lever for the CPU rasteriser
     * (cost ∝ pixels). Prefer ~0.5–0.55 for smooth play on the CPU rasteriser.
     */
    internalResolutionScale: 0.5,
    /**
     * Caps `devicePixelRatio` for the backing store; pairs with `internalResolutionScale`.
     */
    devicePixelRatioCap: 1.15,
    /**
     * Roughness “grain” texture sampled per shaded vertex — costs CPU; off keeps materials flat and cleaner.
     */
    pixelNoiseEnabled: false,
    /**
     * When false, platform / path / zone / marble materials keep static emissive (no sine waves each frame).
     */
    neonPulseSurfaces: false,
    /**
     * Fewer trig ops when hologram coins are animated — ignored while `coinHologramStatic` is true.
     */
    coinHologramReduced: true,
    /**
     * When true, coin hologram uniforms stay fixed (no in-world pulse / glitch drive). Glitch styling is UI-only.
     */
    coinHologramStatic: true,
    noiseTextureSize: 128,
    /** Shared UV repeat for roughness map grain */
    textureRepeat: 8,
    /**
     * Deviation from mid-grey (128) per texel, 0–127. Lower = subtler roughness modulation.
     */
    roughnessNoiseAmplitude: 12,
  }),
});

export const VisualSettings = visualSettingsDefaults;

/**
 * Applies {@link VisualSettings} to the document root as CSS variables (`--vs-*`).
 * Call once from the entry module before layout (e.g. `main.js`).
 * @param {HTMLElement} [root]
 */
export function applyVisualSettingsToDom(root = document.documentElement) {
  const c = VisualSettings.crt;
  const h = VisualSettings.hud;
  const b = VisualSettings.buttons;
  const t = c.tint;
  root.style.setProperty('--vs-crt-enabled', c.enabled ? '1' : '0');
  root.style.setProperty('--crt-overlay-opacity', String(c.overlayOpacity));
  root.style.setProperty('--crt-scanline-opacity', String(c.scanlineOpacity));
  root.style.setProperty('--crt-tint-bg', `rgba(${t.r}, ${t.g}, ${t.b}, ${t.a})`);
  root.style.setProperty('--crt-vignette-strong', c.vignetteStrong);
  root.style.setProperty('--crt-overlay-z', String(c.overlayZ));
  root.style.setProperty('--crt-roll-duration', `${c.rollDurationSec}s`);
  const bw = c.backgroundWobble;
  root.style.setProperty('--vs-crt-bg-wobble', bw.enabled ? '1' : '0');
  root.style.setProperty('--crt-bg-drift-duration', `${bw.driftDurationSec}s`);
  root.style.setProperty('--crt-bg-wobble-duration', `${bw.wobbleDurationSec}s`);
  root.style.setProperty('--crt-bg-grain-drift-duration', `${bw.grainDriftDurationSec}s`);
  root.style.setProperty('--crt-bg-grain-opacity', String(bw.grainOpacity));
  root.classList.toggle('vs-crt-bg-wobble-off', !bw.enabled);
  root.style.setProperty('--vs-hud-panel-glow', h.panelGlow);
  root.style.setProperty('--vs-hud-panel-glow-menu', h.panelGlowMenu);
  root.style.setProperty('--vs-btn-glitch-duration', `${b.cyberGlitchPeriodSec}s`);
  root.classList.toggle('vs-crt-off', !c.enabled);
  root.classList.toggle('vs-btn-glitch', b.cyberGlitchEnabled);
  root.classList.toggle('vs-hud-fall-glitch-off', !h.fallGlitchEnabled);
}
