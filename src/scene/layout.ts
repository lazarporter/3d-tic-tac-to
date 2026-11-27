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
  return 12 + s * 3.5 + (layers ? 8 : 0);
}
