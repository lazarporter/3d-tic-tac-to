import { describe, expect, it } from 'vitest';
import {
  CELLS, CELL_LINES, DIRECTIONS, LINES, N, canPlay, emptyState, lineStatus, play, replay,
  threats, toCoord, toIndex, toNested,
} from './engine';

/** Play X on `xs` and O on filler cells that don't interfere. */
function playX(xs: number[], os: number[]) {
  const moves: number[] = [];
  xs.forEach((x, i) => {
    moves.push(x);
    if (i < xs.length - 1) moves.push(os[i]);
  });
  return replay(moves);
}

describe('board geometry', () => {
  it('has 64 cells and round-trips coordinates', () => {
    expect(CELLS).toBe(64);
    for (let i = 0; i < CELLS; i++) {
      const [x, y, z] = toCoord(i);
      expect(toIndex(x, y, z)).toBe(i);
    }
    expect(toIndex(1, 2, 3)).toBe(1 + 4 * 2 + 16 * 3);
  });

  it('has 13 directions and 76 winning lines', () => {
    expect(DIRECTIONS).toHaveLength(13);
    expect(LINES).toHaveLength(76); // ((N+2)^3 - N^3) / 2
    expect(LINES.length).toBe(((N + 2) ** 3 - N ** 3) / 2);
  });

  it('has no duplicate lines', () => {
    const keys = new Set(LINES.map((l) => [...l.cells].sort((a, b) => a - b).join(',')));
    expect(keys.size).toBe(LINES.length);
  });

  it('line breakdown: 48 straight, 24 planar diagonals, 4 space diagonals', () => {
    const nz = (l: (typeof LINES)[number]) => l.dir.filter((c) => c !== 0).length;
    expect(LINES.filter((l) => nz(l) === 1)).toHaveLength(48);
    expect(LINES.filter((l) => nz(l) === 2)).toHaveLength(24);
    expect(LINES.filter((l) => nz(l) === 3)).toHaveLength(4);
  });

  it('corners and inner cells lie on 7 lines, others on 4', () => {
    expect(CELL_LINES[toIndex(0, 0, 0)]).toHaveLength(7);
    expect(CELL_LINES[toIndex(1, 1, 1)]).toHaveLength(7);
    expect(CELL_LINES[toIndex(1, 0, 0)]).toHaveLength(4);
    const total = CELL_LINES.reduce((s, l) => s + l.length, 0);
    expect(total).toBe(76 * 4);
  });
});

describe('rules', () => {
  it('alternates players and rejects occupied cells', () => {
    let s = emptyState();
    s = play(s, 0);
    expect(s.board[0]).toBe(1);
    expect(s.current).toBe(2);
    expect(canPlay(s, 0)).toBe(false);
    expect(() => play(s, 0)).toThrow();
  });

  it('detects a straight row win', () => {
    const xs = [0, 1, 2, 3].map((x) => toIndex(x, 0, 0));
    const os = [0, 1, 2].map((x) => toIndex(x, 3, 3));
    const s = playX(xs, os);
    expect(s.winner).toBe(1);
    expect(s.winLine?.cells.sort((a, b) => a - b)).toEqual(xs);
    expect(canPlay(s, toIndex(3, 3, 3))).toBe(false);
  });

  it('detects a pillar win', () => {
    const xs = [0, 1, 2, 3].map((z) => toIndex(2, 1, z));
    const os = [0, 1, 2].map((x) => toIndex(x, 3, 0));
    expect(playX(xs, os).winner).toBe(1);
  });

  it('detects a planar diagonal across layers', () => {
    const xs = [0, 1, 2, 3].map((k) => toIndex(k, 2, 3 - k));
    const os = [0, 1, 2].map((x) => toIndex(x, 0, 0));
    expect(playX(xs, os).winner).toBe(1);
  });

  it('detects all four space diagonals', () => {
    const diags = [
      (k: number) => toIndex(k, k, k),
      (k: number) => toIndex(k, k, 3 - k),
      (k: number) => toIndex(k, 3 - k, k),
      (k: number) => toIndex(3 - k, k, k),
    ];
    for (const d of diags) {
      const xs = [0, 1, 2, 3].map(d);
      const os = [0, 1, 2].map((x) => toIndex(x, 1, 0)).filter((c) => !xs.includes(c));
      const fillers = os.length === 3 ? os : [toIndex(0, 3, 1), toIndex(1, 3, 1), toIndex(2, 3, 1)];
      expect(playX(xs, fillers).winner).toBe(1);
    }
  });

  it('O can win too', () => {
    const os = [0, 1, 2, 3].map((y) => toIndex(3, y, 1));
    const xs = [toIndex(0, 0, 0), toIndex(1, 0, 2), toIndex(0, 2, 3), toIndex(2, 3, 0)];
    const moves = xs.flatMap((x, i) => [x, os[i]]);
    const s = replay(moves);
    expect(s.winner).toBe(2);
  });

  it('declares a draw when the board fills with no line', () => {
    // A known drawn pattern: colour by parity of (x + y + 2z) mod 4 split in a way that
    // blocks every line. Instead of relying on a pattern, search for a fill greedily.
    const pattern = findDrawPattern();
    expect(pattern).not.toBeNull();
    const xs = pattern!.flatMap((v, i) => (v === 1 ? [i] : []));
    const os = pattern!.flatMap((v, i) => (v === 2 ? [i] : []));
    expect(xs).toHaveLength(32);
    const moves = xs.flatMap((x, i) => [x, os[i]]);
    const s = replay(moves);
    expect(s.winner).toBeNull();
    expect(s.draw).toBe(true);
  });
});

describe('analysis helpers', () => {
  it('reports line status and threats', () => {
    const s = replay([toIndex(0, 0, 0), toIndex(0, 3, 3), toIndex(1, 0, 0), toIndex(1, 3, 3), toIndex(2, 0, 0)]);
    const row = LINES.find((l) => l.cells.includes(toIndex(0, 0, 0)) && l.cells.includes(toIndex(3, 0, 0)))!;
    expect(lineStatus(s.board, row)).toMatchObject({ x: 3, o: 0, empty: 1, state: 'X' });
    expect(threats(s.board, 1).map((l) => l.id)).toContain(row.id);
    expect(threats(s.board, 2)).toHaveLength(0);
  });

  it('nests as board[z][y][x]', () => {
    const s = replay([toIndex(1, 2, 3)]);
    expect(toNested(s.board)[3][2][1]).toBe(1);
  });
});

/** Randomised search for a 32/32 fill with no complete line (deterministic seed). */
function findDrawPattern(): number[] | null {
  let seed = 12345;
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  const complete = (b: number[]) => LINES.filter((l) => l.cells.every((c) => b[c] === b[l.cells[0]])).length;
  for (let attempt = 0; attempt < 50; attempt++) {
    const b: number[] = Array.from({ length: CELLS }, (_, i) => (i < 32 ? 1 : 2));
    for (let i = b.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [b[i], b[j]] = [b[j], b[i]];
    }
    let score = complete(b);
    for (let step = 0; step < 20000 && score > 0; step++) {
      const i = Math.floor(rand() * CELLS), j = Math.floor(rand() * CELLS);
      if (b[i] === b[j]) continue;
      [b[i], b[j]] = [b[j], b[i]];
      const next = complete(b);
      if (next <= score) score = next;
      else [b[i], b[j]] = [b[j], b[i]];
    }
    if (score === 0) return b;
  }
  return null;
}
