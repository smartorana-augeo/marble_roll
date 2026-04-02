/**
 * 2D turtle interpreter for the side-scrolling game mode.
 * Companion to `lSystemTurtlePlatforms.js` (3D); both consume the same spine string format
 * but emit different geometry.
 *
 * Coordinate system: X increases rightward (scroll direction), Y increases downward (canvas).
 * Platform `y` is the **top surface** Y coordinate.
 *
 * Symbol mapping (same alphabet as the 3D turtle — reinterpreted for 2D):
 *   F / G  — flat platform segment, advance cursor X by `tileW`
 *   r      — rising platform: place tile, advance X by `tileW`, decrease Y by `verticalStep` (rise)
 *   ^      — rise without placing: decrease platformY by `verticalStep`
 *   v      — drop without placing: increase platformY by `verticalStep` (clamped to `baselineY`)
 *   + / -  — gap: advance cursor X by `gapW`, no platform placed
 *   [ / ]  — push / pop turtle state (platformY)
 */

/**
 * @param {string} str Spine string (L-system output)
 * @param {{
 *   tileW: number,
 *   tileH: number,
 *   gapW: number,
 *   verticalStep: number,
 *   baselineY: number,
 * }} params
 * @returns {{
 *   platforms: Array<{x:number, y:number, w:number, h:number, materialKey:string, collision:boolean}>,
 *   spawn: {x:number, y:number},
 *   endX: number,
 *   bounds: {minY:number, maxY:number, maxX:number},
 * }}
 */
export function turtleBuildPlatforms2D(str, params) {
  const { tileW, tileH, gapW, verticalStep, baselineY } = params;

  let cursorX = 0;
  let platformY = baselineY;
  /** @type {{ cursorX: number, platformY: number }[]} */
  const stack = [];

  /** @type {Array<{x:number, y:number, w:number, h:number, materialKey:string, collision:boolean}>} */
  const platforms = [];

  // Spawn pad — twice tile width, centred on X=0
  const spawnW = tileW * 2;
  platforms.push({
    x: -(spawnW / 2),
    y: platformY,
    w: spawnW,
    h: tileH,
    materialKey: 'plaza',
    collision: true,
  });
  cursorX = spawnW / 2;

  let minY = platformY;
  let maxY = platformY + tileH;
  let maxX = cursorX;

  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    switch (c) {
      case 'F':
      case 'G':
        platforms.push({
          x: cursorX,
          y: platformY,
          w: tileW,
          h: tileH,
          materialKey: 'path',
          collision: true,
        });
        cursorX += tileW;
        maxX = Math.max(maxX, cursorX);
        maxY = Math.max(maxY, platformY + tileH);
        break;

      case 'r': {
        // Place tile at current level then rise
        platforms.push({
          x: cursorX,
          y: platformY,
          w: tileW,
          h: tileH,
          materialKey: 'ramp',
          collision: true,
        });
        cursorX += tileW;
        platformY -= verticalStep;
        minY = Math.min(minY, platformY);
        maxX = Math.max(maxX, cursorX);
        maxY = Math.max(maxY, platformY + tileH + verticalStep);
        break;
      }

      case '^':
        platformY -= verticalStep;
        minY = Math.min(minY, platformY);
        break;

      case 'v':
        platformY = Math.min(baselineY, platformY + verticalStep);
        maxY = Math.max(maxY, platformY + tileH);
        break;

      case '+':
      case '-':
        // Gap — advance without placing a platform
        cursorX += gapW;
        maxX = Math.max(maxX, cursorX);
        break;

      case '[':
        stack.push({ cursorX, platformY });
        break;

      case ']': {
        const frame = stack.pop();
        if (frame) {
          cursorX = frame.cursorX;
          platformY = frame.platformY;
        }
        break;
      }

      default:
        break;
    }
  }

  // Spawn: player feet rest on top of spawn pad
  const spawn = { x: 0, y: baselineY };

  return {
    platforms,
    spawn,
    endX: cursorX,
    bounds: { minY, maxY, maxX },
  };
}
