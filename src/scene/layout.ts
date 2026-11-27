import { toCoord } from '../game/engine';

export const COLORS = {
  x: '#38d6ff',
  o: '#ff4fa3',
  glass: '#8aa6ff',
  edge: '#5d6f9e',
  dead: '#6b7280',
  open: '#e5e9f5',
  bg: '#090c16',
} as const;

export const playerColor = (p: number) => (p === 1 ? COLORS.x : COLORS.o);

export const CELL_SIZE = 0.9;
export const LAYER_GAP = 2.4;

/**
 * Maps a game cell to a 3D position.
 * Game x → three X, game y → three Z (row 0 at the back), game z (layer) → three Y (up).
 */
export function cellPosition(i: number, explode: number, layers: boolean): [number, number, number] {
  const [x, y, z] = toCoord(i);
  const s = 1 + explode * 1.2;
  const vs = layers ? s + LAYER_GAP : s;
  return [(x - 1.5) * s, (z - 1.5) * vs, (y - 1.5) * s];
}

/** Camera distance that frames the current layout. */
export function framingDistance(explode: number, layers: boolean): number {
  const s = 1 + explode * 1.2;
  return 14 + s * 4.2 + (layers ? 8 : 0);
}

/** Axis colors shared by the 3D frame, view labels and the matrix tables. */
export const AXIS = { x: '#ff6b6b', y: '#5ee6a8', z: '#ffd166' } as const;

/** Light direction ("sun"), used by the key light, the sky glow and nothing else. */
export const SUN_DIR: [number, number, number] = [0.45, 0.82, 0.35];

export interface Bounds {
  s: number; // horizontal spacing between cell centers
  vs: number; // vertical spacing between layers
  half: number; // half-width of the cube footprint (x and three-Z)
  halfY: number; // half-height of the cube
  floorY: number; // y of the ground plane
  wall: number; // distance from center to a projection wall
}

export function bounds(explode: number, layers: boolean): Bounds {
  const s = 1 + explode * 1.2;
  const vs = layers ? s + LAYER_GAP : s;
  const half = 1.5 * s + CELL_SIZE / 2;
  const halfY = 1.5 * vs + CELL_SIZE / 2;
  return { s, vs, half, halfY, floorY: -halfY - 0.7, wall: half + 0.9 };
}
