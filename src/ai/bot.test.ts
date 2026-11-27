import { describe, expect, it } from 'vitest';
import { canPlay, emptyState, isOver, play, replay, toIndex, type GameState } from '../game/engine';
import { chooseMove, rankMoves, threatsAfter, winningCells, type BotLevel } from './bot';

/** Deterministic RNG so the tests are repeatable. */
function seeded(seed: number) {
  const next = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let k = 0; k < 5; k++) next(); // small seeds give tiny first values; warm up
  return next;
}

/** Build a position by placing marks directly (bypassing turn order). */
function position(xs: number[], os: number[]) {
  const s = emptyState();
  for (const c of xs) s.board[c] = 1;
  for (const c of os) s.board[c] = 2;
  return s.board;
}

describe('tactics', () => {
  it('both levels take an immediate win', () => {
    const b = position([toIndex(0, 0, 0), toIndex(1, 0, 0), toIndex(2, 0, 0)], [toIndex(0, 3, 3), toIndex(1, 3, 3)]);
    for (const level of ['easy', 'medium'] as BotLevel[]) {
      expect(chooseMove(b, 1, level, seeded(1))).toBe(toIndex(3, 0, 0));
    }
  });

  it('medium always blocks an immediate loss', () => {
    const b = position([toIndex(0, 1, 2), toIndex(1, 1, 2), toIndex(2, 1, 2)], [toIndex(0, 3, 3)]);
    for (let seed = 1; seed < 20; seed++) expect(chooseMove(b, 2, 'medium', seeded(seed))).toBe(toIndex(3, 1, 2));
  });

  it('easy blocks only some of the time', () => {
    const b = position([toIndex(0, 1, 2), toIndex(1, 1, 2), toIndex(2, 1, 2)], [toIndex(0, 3, 3)]);
    const blocks = Array.from({ length: 200 }, (_, s) => chooseMove(b, 2, 'easy', seeded(s + 1))).filter(
      (m) => m === toIndex(3, 1, 2),
    ).length;
    expect(blocks).toBeGreaterThan(60);
    expect(blocks).toBeLessThan(180);
  });

  it('medium makes a fork when one is available', () => {
    // X has two pairs crossing at (3,3,0): playing there makes two threats
    const xs = [toIndex(1, 3, 0), toIndex(2, 3, 0), toIndex(3, 1, 0), toIndex(3, 2, 0)];
    const os = [toIndex(0, 0, 3), toIndex(1, 0, 3), toIndex(0, 1, 3), toIndex(2, 2, 2)];
    const b = position(xs, os);
    const m = chooseMove(b, 1, 'medium', seeded(3));
    expect(threatsAfter(b.slice(), 1, m)).toBeGreaterThanOrEqual(2);
  });

  it('medium stops the opponent from forking', () => {
    // O to move; X threatens the same fork at (3,3,0)
    const xs = [toIndex(1, 3, 0), toIndex(2, 3, 0), toIndex(3, 1, 0), toIndex(3, 2, 0)];
    const os = [toIndex(0, 0, 3), toIndex(1, 1, 2), toIndex(2, 0, 1)];
    const b = position(xs, os);
    const m = chooseMove(b, 2, 'medium', seeded(5));
    // after O's move, X must not have a fork that O can't answer
    b[m] = 2;
    const xForks = Array.from({ length: 64 }, (_, i) => i).filter((c) => b[c] === 0 && threatsAfter(b.slice(), 1, c) >= 2);
    const oWinsFirst = winningCells(b, 2).length > 0;
    expect(xForks.length === 0 || oWinsFirst).toBe(true);
  });
});

describe('search', () => {
  it('ranks the winning move first', () => {
    const b = position([toIndex(0, 0, 0), toIndex(1, 1, 1), toIndex(2, 2, 2)], [toIndex(0, 3, 0), toIndex(1, 3, 0)]);
    expect(rankMoves(b, 1)[0].cell).toBe(toIndex(3, 3, 3));
  });

  it('picks a medium move quickly on a busy board', () => {
    const s = replay([21, 42, 22, 0, 25, 63, 37, 5, 26, 9, 41, 54]);
    const t = performance.now();
    chooseMove(s.board, s.current, 'medium', seeded(1));
    expect(performance.now() - t).toBeLessThan(400);
  });
});

describe('full games', () => {
  function game(xLevel: BotLevel, oLevel: BotLevel, seed: number): GameState {
    const rng = seeded(seed);
    let s = emptyState();
    while (!isOver(s)) {
      const m = chooseMove(s.board, s.current, s.current === 1 ? xLevel : oLevel, rng);
      expect(canPlay(s, m)).toBe(true);
      s = play(s, m);
    }
    return s;
  }

  it('always plays legal moves to the end', () => {
    for (let seed = 1; seed <= 6; seed++) game('easy', 'easy', seed);
  });

  it('medium beats easy in nearly every game, from either side', () => {
    let mediumWins = 0;
    const n = 10;
    for (let seed = 1; seed <= n; seed++) {
      if (game('medium', 'easy', seed).winner === 1) mediumWins++;
      if (game('easy', 'medium', seed + 100).winner === 2) mediumWins++;
    }
    expect(mediumWins).toBeGreaterThanOrEqual(2 * n - 2);
  });
});
