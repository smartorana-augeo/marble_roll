/**
 * Phase C: farthest reachable cell as goal (strategy B), BFS main path, optional branch metadata.
 *
 * @param {object} layout  Output of `buildDrunkardGrid` from `./drunkardGrid.js`
 */
export function buildRoutePlan(layout) {
  const { width, height, tiles, startCell } = layout;
  const idx = (cx, cy) => cy * width + cx;

  const isFloor = (v) => v === 1 || v === 2;

  /** @type {{ cx: number, cy: number }[]} */
  const floorCells = [];
  for (let cy = 0; cy < height; cy++) {
    for (let cx = 0; cx < width; cx++) {
      if (isFloor(tiles[idx(cx, cy)])) {
        floorCells.push({ cx, cy });
      }
    }
  }

  if (floorCells.length === 0) {
    return { main: [startCell], branches: [], goalCell: startCell, maxDist: 0 };
  }

  const { dist, prev } = bfsFrom(width, height, tiles, startCell, isFloor, idx);

  let best = startCell;
  let bestD = dist[idx(startCell.cx, startCell.cy)] ?? -1;
  for (const c of floorCells) {
    const d = dist[idx(c.cx, c.cy)];
    if (d < 0) continue;
    if (d > bestD || (d === bestD && (c.cx < best.cx || (c.cx === best.cx && c.cy < best.cy)))) {
      bestD = d;
      best = c;
    }
  }

  const goalCell = best;
  const main = reconstructPath(width, height, startCell, goalCell, prev, idx);

  return {
    main,
    branches: [],
    goalCell,
    maxDist: bestD,
  };
}

/**
 * @param {number} width
 * @param {number} height
 * @param {Uint8Array} tiles
 * @param {{ cx: number, cy: number }} start
 * @param {(v: number) => boolean} isFloor
 * @param {(cx: number, cy: number) => number} idx
 */
function bfsFrom(width, height, tiles, start, isFloor, idx) {
  const n = width * height;
  const dist = new Int32Array(n);
  dist.fill(-1);
  const prev = new Int32Array(n);
  prev.fill(-1);

  const DX = [0, 1, 0, -1];
  const DY = [1, 0, -1, 0];

  const si = idx(start.cx, start.cy);
  dist[si] = 0;

  /** @type {number[]} */
  const q = [si];
  for (let head = 0; head < q.length; head++) {
    const cur = q[head];
    const cx = cur % width;
    const cy = (cur / width) | 0;
    for (let d = 0; d < 4; d++) {
      const nx = cx + DX[d];
      const ny = cy + DY[d];
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const ni = idx(nx, ny);
      if (!isFloor(tiles[ni])) continue;
      if (dist[ni] >= 0) continue;
      dist[ni] = dist[cur] + 1;
      prev[ni] = cur;
      q.push(ni);
    }
  }

  return { dist, prev };
}

/**
 * @param {number} width
 * @param {number} height
 * @param {{ cx: number, cy: number }} start
 * @param {{ cx: number, cy: number }} goal
 * @param {Int32Array} prev
 * @param {(cx: number, cy: number) => number} idx
 */
function reconstructPath(width, height, start, goal, prev, idx) {
  const gi = idx(goal.cx, goal.cy);
  const si = idx(start.cx, start.cy);
  if (prev[gi] < 0 && gi !== si) {
    return [start];
  }
  /** @type {{ cx: number, cy: number }[]} */
  const rev = [];
  let cur = gi;
  let guard = 0;
  while (cur !== si && guard++ < 65536) {
    const cxi = cur % width;
    const cyi = (cur / width) | 0;
    rev.push({ cx: cxi, cy: cyi });
    cur = prev[cur];
    if (cur < 0) break;
  }
  rev.push({ cx: start.cx, cy: start.cy });
  rev.reverse();
  return rev;
}
