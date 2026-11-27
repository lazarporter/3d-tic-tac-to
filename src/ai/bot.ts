/**
 * Computer players and move hints. Pure functions over the engine's board, no UI.
 *
 * - Easy: takes a win, blocks only sometimes, otherwise a loosely weighted random move.
 * - Medium: depth-4 alpha-beta over the most promising candidates. That is deep enough to
 *   build its own double threats ("forks") and to stop yours, but not to see long forcing chains.
 */
import { CELLS, CELL_LINES, LINES, type CellValue, type Player } from '../game/engine';

export type BotLevel = 'easy' | 'medium';
export type Rng = () => number;

const WIN = 1_000_000;
const other = (p: Player): Player => (p === 1 ? 2 : 1);

/** Empty cells that would complete a line for `p` right now. */
export function winningCells(board: readonly CellValue[], p: Player): number[] {
  const out: number[] = [];
  for (const line of LINES) {
    let mine = 0, empty = -1, blocked = false;
    for (const c of line.cells) {
      const v = board[c];
      if (v === p) mine++;
      else if (v === 0) empty = c;
      else { blocked = true; break; }
    }
    if (!blocked && mine === 3 && empty >= 0 && !out.includes(empty)) out.push(empty);
  }
  return out;
}

/** How many distinct immediate-win cells `p` would have after playing `cell`. */
export function threatsAfter(board: CellValue[], p: Player, cell: number): number {
  board[cell] = p;
  const n = winningCells(board, p).length;
  board[cell] = 0;
  return n;
}

const ATTACK = [1, 4, 22, 0, 0];
const DEFEND = [1, 3, 16, 0, 0];

/** Quick positional value of `cell` for `p`: open lines through it, weighted by how full they are. */
export function cellScore(board: readonly CellValue[], p: Player, cell: number): number {
  let s = 0;
  for (const id of CELL_LINES[cell]) {
    let mine = 0, theirs = 0;
    for (const c of LINES[id].cells) {
      if (board[c] === p) mine++;
      else if (board[c] !== 0) theirs++;
    }
    if (theirs === 0) s += ATTACK[mine];
    if (mine === 0) s += DEFEND[theirs];
  }
  return s;
}

const VALUE = [0, 1, 7, 45, 0];

/** Static evaluation from `p`'s point of view. */
export function evaluate(board: readonly CellValue[], p: Player): number {
  let s = 0;
  for (const line of LINES) {
    let mine = 0, theirs = 0;
    for (const c of line.cells) {
      if (board[c] === p) mine++;
      else if (board[c] !== 0) theirs++;
    }
    if (theirs === 0) s += VALUE[mine];
    else if (mine === 0) s -= VALUE[theirs] * 1.1;
  }
  return s;
}

function candidates(board: readonly CellValue[], p: Player, limit: number): number[] {
  const scored: [number, number][] = [];
  for (let i = 0; i < CELLS; i++) if (board[i] === 0) scored.push([i, cellScore(board, p, i)]);
  scored.sort((a, b) => b[1] - a[1]);
  return scored.slice(0, limit).map(([i]) => i);
}

/** Negamax with alpha-beta. Forced replies (a single block) are the only moves considered. */
function negamax(board: CellValue[], p: Player, depth: number, alpha: number, beta: number, ply: number, width: number): number {
  if (winningCells(board, p).length) return WIN - ply;
  const threats = winningCells(board, other(p));
  if (threats.length >= 2) return -(WIN - ply - 1);
  if (depth === 0) return evaluate(board, p);
  const moves = threats.length === 1 ? threats : candidates(board, p, width);
  if (!moves.length) return 0;
  let best = -Infinity;
  for (const m of moves) {
    board[m] = p;
    const v = -negamax(board, other(p), depth - 1, -beta, -alpha, ply + 1, width);
    board[m] = 0;
    if (v > best) best = v;
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  return best;
}

export interface RankedMove {
  cell: number;
  score: number;
}

/** Search every promising move fully (no root pruning) so equal-best moves can be told apart. */
export function rankMoves(boardIn: readonly CellValue[], p: Player, depth = 4, width = 10, limit = 12): RankedMove[] {
  const board = boardIn.slice() as CellValue[];
  const o = other(p);
  const wins = winningCells(board, p);
  const blocks = winningCells(board, o);
  const roots = wins.length ? wins : blocks.length ? blocks : candidates(board, p, limit);
  const ranked = roots.map((cell) => {
    board[cell] = p;
    const score = wins.includes(cell) ? WIN : -negamax(board, o, depth - 1, -Infinity, Infinity, 1, width);
    board[cell] = 0;
    return { cell, score };
  });
  ranked.sort((a, b) => b.score - a.score || cellScore(board, p, b.cell) - cellScore(board, p, a.cell));
  return ranked;
}

export function chooseMove(board: readonly CellValue[], p: Player, level: BotLevel, rng: Rng = Math.random): number {
  const wins = winningCells(board, p);
  if (wins.length) return wins[0];
  if (level === 'medium') {
    const ranked = rankMoves(board, p);
    // pick randomly among moves tied for best, so games vary
    const top = ranked.filter((m) => m.score === ranked[0].score);
    return top[Math.floor(rng() * top.length)].cell;
  }
  // easy
  const blocks = winningCells(board, other(p));
  if (blocks.length && rng() < 0.55) return blocks[0];
  const pool = candidates(board, p, 14);
  const weights = pool.map((c) => Math.sqrt(cellScore(board, p, c) + 1));
  let r = rng() * weights.reduce((a, b) => a + b, 0);
  for (let k = 0; k < pool.length; k++) {
    r -= weights[k];
    if (r <= 0) return pool[k];
  }
  return pool[pool.length - 1];
}
