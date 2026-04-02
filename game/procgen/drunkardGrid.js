/**
 * Phases A–B: allocate a tile grid, run the drunkard walk, optional rooms, branch carving.
 *
 * Coordinate convention: **cx** → world **x**, **cy** → world **z** (row-major storage).
 * Cardinal directions 0–3: +z, +x, −z, −x.
 *
 * @param {object} spec  From `computeGridSpec` in `./gridSpec.js`
 * @param {() => number} rng
 */
export function buildDrunkardGrid(spec, rng) {
  const {
    width,
    height,
    mainSteps,
    pTurn,
    pRoom,
    roomPeriod,
    pBranch,
    roomHalfMin,
    roomHalfMax,
    roomUncarvedMinFraction,
    branchStepsMax,
    edgeMargin,
  } = spec;

  const tiles = new Uint8Array(width * height);
  const lo = edgeMargin;
  const hiX = width - 1 - edgeMargin;
  const hiY = height - 1 - edgeMargin;

  const startCx = lo;
  const startCy = Math.max(lo, Math.min(hiY, Math.floor(height / 2)));

  /** @type {{ cx: number, cy: number, dir: number }[]} */
  const branchSeeds = [];
  let roomsPlaced = 0;
  let branchCarveSteps = 0;

  const idx = (cx, cy) => cy * width + cx;
  const inCorridorBounds = (cx, cy) => cx >= lo && cx <= hiX && cy >= lo && cy <= hiY;

  /** @type {number[]} DX[dir], DY[dir] — cy is z */
  const DX = [0, 1, 0, -1];
  const DY = [1, 0, -1, 0];

  let cx = startCx;
  let cy = startCy;
  let dir = 0;

  const carveCorridor = (x, y) => {
    const i = idx(x, y);
    if (tiles[i] === 0) tiles[i] = 1;
  };

  const tryPlaceRoom = () => {
    const rw =
      roomHalfMin +
      Math.floor(rng() * (1 + Math.max(0, roomHalfMax - roomHalfMin)));
    const rh =
      roomHalfMin +
      Math.floor(rng() * (1 + Math.max(0, roomHalfMax - roomHalfMin)));
    const x0 = cx - rw;
    const x1 = cx + rw;
    const y0 = cy - rh;
    const y1 = cy + rh;
    if (x0 < lo || x1 > hiX || y0 < lo || y1 > hiY) return false;

    let uncarved = 0;
    const total = (x1 - x0 + 1) * (y1 - y0 + 1);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (tiles[idx(x, y)] === 0) uncarved++;
      }
    }
    if (uncarved < total * roomUncarvedMinFraction) return false;

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        tiles[idx(x, y)] = 2;
      }
    }
    roomsPlaced++;

    if (rng() < pBranch) {
      /** Doorway: border cell with a void neighbour outside the room. */
      const candidates = [];
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const onBorder = x === x0 || x === x1 || y === y0 || y === y1;
          if (!onBorder) continue;
          for (let d = 0; d < 4; d++) {
            const nx = x + DX[d];
            const ny = y + DY[d];
            if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
            if (nx >= x0 && nx <= x1 && ny >= y0 && ny <= y1) continue;
            if (tiles[idx(nx, ny)] === 0 && inCorridorBounds(nx, ny)) {
              candidates.push({ cx: x, cy: y, dir: d });
            }
          }
        }
      }
      if (candidates.length > 0) {
        const pick = candidates[Math.floor(rng() * candidates.length)];
        branchSeeds.push(pick);
      }
    }
    return true;
  };

  const pickMove = () => {
    if (rng() < pTurn) {
      dir = rng() < 0.5 ? (dir + 1) % 4 : (dir + 3) % 4;
    }
    const order = [0, 1, 2, 3].map((k) => (k + dir) % 4);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = order[i];
      order[i] = order[j];
      order[j] = t;
    }
    for (const d of order) {
      const nx = cx + DX[d];
      const ny = cy + DY[d];
      if (inCorridorBounds(nx, ny)) {
        dir = d;
        cx = nx;
        cy = ny;
        return;
      }
    }
  };

  for (let step = 0; step < mainSteps; step++) {
    carveCorridor(cx, cy);

    const periodHit =
      roomPeriod > 0 && step > 0 && step % roomPeriod === 0;
    if (periodHit || rng() < pRoom) {
      tryPlaceRoom();
    }

    pickMove();
  }

  carveCorridor(cx, cy);

  const drainBranchSeeds = () => {
    const seeds = branchSeeds.splice(0, branchSeeds.length);
    for (const seed of seeds) {
      let bx = seed.cx;
      let by = seed.cy;
      let bd = seed.dir;
      if (!inCorridorBounds(bx, by)) continue;
      for (let s = 0; s < branchStepsMax; s++) {
        const i = idx(bx, by);
        if (tiles[i] === 0) tiles[i] = 1;
        branchCarveSteps++;
        if (rng() < pTurn) {
          bd = rng() < 0.5 ? (bd + 1) % 4 : (bd + 3) % 4;
        }
        const nx = bx + DX[bd];
        const ny = by + DY[bd];
        if (inCorridorBounds(nx, ny)) {
          bx = nx;
          by = ny;
        } else {
          bd = Math.floor(rng() * 4);
        }
      }
    }
  };

  drainBranchSeeds();

  tiles[idx(startCx, startCy)] = tiles[idx(startCx, startCy)] === 0 ? 1 : tiles[idx(startCx, startCy)];

  return {
    width,
    height,
    tiles,
    startCell: { cx: startCx, cy: startCy },
    goalCell: null,
    branchSeeds,
    meta: {
      mainSteps,
      roomsPlaced,
      branchCarveSteps,
    },
  };
}
