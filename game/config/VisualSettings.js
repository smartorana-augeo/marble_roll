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
     * Master strength for the whole `::after` stack (scanlines, tint, vignette, flicker).
     * Flicker keyframes in `crtOverlay.css` multiply by this so dips stay proportional.
     */
    overlayOpacity: 0.42,
    /** Softens scanlines / tint so the stack reads as atmosphere, not crisp UI chrome. */
    overlayBlurPx: 0.45,
    scanlineOpacity: 0.065,
    tint: Object.freeze({ r: 18, g: 20, b: 26, a: 0.052 }),
    vignetteStrong: 'rgba(0, 0, 0, 0.4)',
    vignetteSoft: 'rgba(0, 0, 0, 0.16)',
    overlayZ: 50,
    rollDurationSec: 5.8,
    flickerDurationSec: 4.2,
    glitchDurationSec: 11,
    /**
     * Starfield layer (`#app::before`): drift + transform wobble + faint grain.
     * Tuned for few compositor-friendly properties (no animated filter).
     */
    backgroundWobble: Object.freeze({
      enabled: true,
      /** Background drift + grain slide (seconds). Longer = fewer keyframe updates per minute. */
      driftDurationSec: 26,
      /** Sub-pixel transform wobble (seconds). */
      wobbleDurationSec: 12,
      /** Reserved: opacity flutter is merged into drift keyframes (same duration). */
      grainDriftDurationSec: 26,
      /** Grain stripe strength — keep low (second layer costs a composite). */
      grainOpacity: 0.038,
    }),
  }),
  hud: Object.freeze({
    /** Extra box-shadow layers on panel chrome (legend, scores, menu card, loading card, music mute HUD) */
    panelGlow:
      '0 0 12px rgba(93, 232, 255, 0.28), 0 0 28px rgba(255, 61, 168, 0.14), inset 0 0 20px rgba(93, 232, 255, 0.06)',
    panelGlowMenu:
      '0 0 10px rgba(93, 162, 240, 0.22), 0 0 22px rgba(242, 142, 43, 0.1), inset 0 0 16px rgba(93, 162, 240, 0.05)',
  }),
  buttons: Object.freeze({
    cyberGlitchEnabled: true,
    cyberGlitchPeriodSec: 4.6,
  }),
  world3d: Object.freeze({
    pixelNoiseEnabled: true,
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
  root.style.setProperty('--crt-overlay-blur', `${c.overlayBlurPx}px`);
  root.style.setProperty('--crt-scanline-opacity', String(c.scanlineOpacity));
  root.style.setProperty('--crt-tint-bg', `rgba(${t.r}, ${t.g}, ${t.b}, ${t.a})`);
  root.style.setProperty('--crt-vignette-strong', c.vignetteStrong);
  root.style.setProperty('--crt-vignette-soft', c.vignetteSoft);
  root.style.setProperty('--crt-overlay-z', String(c.overlayZ));
  root.style.setProperty('--crt-roll-duration', `${c.rollDurationSec}s`);
  root.style.setProperty('--crt-flicker-duration', `${c.flickerDurationSec}s`);
  root.style.setProperty('--crt-glitch-duration', `${c.glitchDurationSec}s`);
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
}
