/**
 * Pure game engine for 4×4×4 tic-tac-toe. No UI code here.
 *
 * Board model: a flat array of 64 cells, value 0 = empty, 1 = X, 2 = O.
 * Cell (x, y, z) lives at index x + N*y + N*N*z.
 * Nested view: board[z][y][x] (z = layer, y = row, x = column).
 */

export const N = 4;
export const CELLS = N * N * N;

export type Player = 1 | 2;
export type CellValue = 0 | Player;
export type Coord = readonly [x: number, y: number, z: number];

export const PLAYER_LABEL: Record<CellValue, string> = { 0: '·', 1: 'X', 2: 'O' };

export const toIndex = (x: number, y: number, z: number): number => x + N * y + N * N * z;

export const toCoord = (i: number): Coord => [i % N, Math.floor(i / N) % N, Math.floor(i / (N * N))];

export const inBounds = (x: number, y: number, z: number): boolean =>
  x >= 0 && x < N && y >= 0 && y < N && z >= 0 && z < N;

export interface Line {
  id: number;
  /** canonical direction (first non-zero component is positive) */
  dir: Coord;
  /** the N cell indices along this line, in order */
  cells: number[];
}

/** The 13 canonical directions: every non-zero {-1,0,1}^3 vector, counting d and -d once. */
export const DIRECTIONS: Coord[] = (() => {
  const dirs: Coord[] = [];
  for (let dx = -1; dx <= 1; dx++)
    for (let dy = -1; dy <= 1; dy++)
      for (let dz = -1; dz <= 1; dz++) {
        const v = [dx, dy, dz] as const;
        const first = v.find((c) => c !== 0);
        if (first !== undefined && first > 0) dirs.push(v);
      }
  return dirs;
})();

/** Every winning line on the board (76 for N = 4). */
export const LINES: Line[] = (() => {
  const lines: Line[] = [];
  for (const dir of DIRECTIONS) {
    const [dx, dy, dz] = dir;
    for (let z = 0; z < N; z++)
      for (let y = 0; y < N; y++)
        for (let x = 0; x < N; x++) {
          // only start a line where stepping backwards would leave the board
          if (inBounds(x - dx, y - dy, z - dz)) continue;
          const cells: number[] = [];
          for (let k = 0; k < N; k++) {
            const cx = x + k * dx, cy = y + k * dy, cz = z + k * dz;
            if (!inBounds(cx, cy, cz)) break;
            cells.push(toIndex(cx, cy, cz));
          }
          if (cells.length === N) lines.push({ id: lines.length, dir, cells });
        }
  }
  return lines;
})();

/** For each cell index, the ids of the lines that pass through it. */
export const CELL_LINES: number[][] = (() => {
  const map: number[][] = Array.from({ length: CELLS }, () => []);
  for (const line of LINES) for (const c of line.cells) map[c].push(line.id);
  return map;
})();

export function describeDirection([dx, dy, dz]: Coord): string {
  const nonZero = [dx, dy, dz].filter((c) => c !== 0).length;
  if (nonZero === 1) return dx ? 'row (x)' : dy ? 'column (y)' : 'pillar (z)';
  if (nonZero === 2) {
    const plane = !dz ? 'xy' : !dy ? 'xz' : 'yz';
    return `${plane} diagonal`;
  }
  return 'space diagonal';
}

export interface GameState {
  board: CellValue[];
  moves: number[];
  current: Player;
  winner: Player | null;
  winLine: Line | null;
  draw: boolean;
}

export const emptyState = (): GameState => ({
  board: new Array<CellValue>(CELLS).fill(0),
  moves: [],
  current: 1,
  winner: null,
  winLine: null,
  draw: false,
});

export const isOver = (s: GameState): boolean => s.winner !== null || s.draw;

export function canPlay(s: GameState, index: number): boolean {
  return !isOver(s) && index >= 0 && index < CELLS && s.board[index] === 0;
}

/** Checks only the lines through the cell just played. */
export function findWin(board: CellValue[], index: number): Line | null {
  const p = board[index];
  if (!p) return null;
  for (const id of CELL_LINES[index]) {
    const line = LINES[id];
    if (line.cells.every((c) => board[c] === p)) return line;
  }
  return null;
}

/** Returns a new state with the move applied. Throws on an illegal move. */
export function play(s: GameState, index: number): GameState {
  if (!canPlay(s, index)) throw new Error(`Illegal move at index ${index}`);
  const board = s.board.slice();
  board[index] = s.current;
  const moves = [...s.moves, index];
  const winLine = findWin(board, index);
  return {
    board,
    moves,
    current: s.current === 1 ? 2 : 1,
    winner: winLine ? s.current : null,
    winLine,
    draw: !winLine && moves.length === CELLS,
  };
}

/** Rebuilds a state from a move list (used for undo/redo, persistence and import). */
export function replay(moves: readonly number[]): GameState {
  return moves.reduce(play, emptyState());
}

export interface LineStatus {
  line: Line;
  x: number;
  o: number;
  empty: number;
  /** 'open' = nobody yet, 'X'/'O' = only that player, 'dead' = both, 'won' = complete */
  state: 'open' | 'X' | 'O' | 'dead' | 'won';
}

export function lineStatus(board: CellValue[], line: Line): LineStatus {
  let x = 0, o = 0;
  for (const c of line.cells) {
    if (board[c] === 1) x++;
    else if (board[c] === 2) o++;
  }
  const empty = N - x - o;
  const state = x === N || o === N ? 'won' : x && o ? 'dead' : x ? 'X' : o ? 'O' : 'open';
  return { line, x, o, empty, state };
}

/** Lines where a player has N-1 marks and the last cell is empty (an immediate win next move). */
export function threats(board: CellValue[], player: Player): Line[] {
  return LINES.filter((line) => {
    const st = lineStatus(board, line);
    return st.empty === 1 && (player === 1 ? st.x : st.o) === N - 1;
  });
}

/** board[z][y][x] nested representation. */
export function toNested(board: CellValue[]): CellValue[][][] {
  return Array.from({ length: N }, (_, z) =>
    Array.from({ length: N }, (_, y) => Array.from({ length: N }, (_, x) => board[toIndex(x, y, z)])),
  );
}
