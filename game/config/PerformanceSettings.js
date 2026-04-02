/**
 * Runtime graphics and logging tunables for deployed builds.
 * Tweak here only — avoid scattering magic numbers across the game.
 */

const performanceDefaults = Object.freeze({
  /**
   * Caps canvas backing-store resolution. 1.25–1.5 is often enough on retina;
   * 2.0 multiplies fragment cost roughly quadratically versus 1.0.
   */
  maxPixelRatio: 1.6,
  /** Mild MSAA helps curved silhouettes (e.g. marble); still capped by `maxPixelRatio`. */
  rendererAntialias: true,
  /**
   * `pcf` is noticeably cheaper than `pcfsoft` (default Three soft shadows).
   * @type {'pcf' | 'pcfsoft' | 'basic'}
   */
  shadowMapType: 'pcf',
  /** Directional light shadow map resolution (per side). 1024 is a good deploy default. */
  shadowMapSize: 1024,
  /**
   * `SphereGeometry(widthSegments, heightSegments)` for the rolling marble.
   * Too low reads faceted; ~40×32 matches a smooth playground ball without excess verts.
   */
  marbleSphereSegments: Object.freeze({ width: 40, height: 32 }),
  /**
   * Roughness grain texture size (smaller = less VRAM and faster upload; slightly coarser grain).
   * Overrides `VisualSettings.world3d.noiseTextureSize` when set.
   */
  noiseTextureSize: 80,
});

export const PerformanceSettings = performanceDefaults;
