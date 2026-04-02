/**
 * Single place for runtime asset URLs (resolved from `marble_roll/assets/`).
 * Import only from loaders / bootstrap — not from the HTML entry module.
 */

const ASSETS_ROOT = new URL('../../assets/', import.meta.url);

/**
 * @param {string} path Relative to `assets/` (e.g. `road/Road1_B.png`).
 * @returns {string} Absolute URL for fetch/TextureLoader/FBXLoader.
 */
export function assetUrl(path) {
  const p = path.startsWith('/') ? path.slice(1) : path;
  return new URL(p, ASSETS_ROOT).href;
}

/** Space Music Pack (`.wav` files under `assets/Space Music Pack/`). */
export const musicTrackUrls = Object.freeze([
  assetUrl('Space Music Pack/battle.wav'),
  assetUrl('Space Music Pack/meet-the-princess.wav'),
  assetUrl('Space Music Pack/in-the-wreckage.wav'),
  assetUrl('Space Music Pack/slow-travel.wav'),
  assetUrl('Space Music Pack/menu.wav'),
]);

/** Resolved paths used by the game. Add entries here as features need them. */
export const AssetSettings = {
  /** Background music: sequential playlist, independent of level (see `MusicPlaylist`). */
  music: {
    trackUrls: musicTrackUrls,
  },
  road: {
    straightDiffuse: assetUrl('road/Road1_B.png'),
    plazaDiffuse: assetUrl('road/Road6_B.png'),
  },
  /** Future player mesh (FBX/GLTF); not loaded while the player uses the marble sphere. */
  player: {
    hovercraftFbx: assetUrl('hovercraft/Car1.fbx'),
  },
};
