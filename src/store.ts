import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CELLS, N, canPlay, replay, toCoord, toIndex, type GameState, type Player } from './game/engine';
import type { BotLevel } from './ai/bot';

/** Who controls a seat. */
export type Controller = 'human' | BotLevel;

export type Axis = 'x' | 'y' | 'z';
export interface Isolate { axis: Axis; index: number }

interface Store {
  moves: number[];
  redo: number[];
  game: GameState;

  hover: number | null;
  selected: number | null;

  players: Record<Player, Controller>;
  /** the bot has picked a cell and is about to place it (not persisted) */
  botThinking: boolean;

  explode: number; // 0..1
  layers: boolean; // split into 4 stacked boards
  isolate: Isolate | null;
  guides: boolean;
  projections: boolean; // floor + wall projections
  motion: boolean; // mouse parallax + idle wobble
  /** which side the projection walls are on (-1 or 1), following the camera; not persisted */
  wallSide: [sx: number, sz: number];
  viewResetToken: number;

  setHover: (i: number | null) => void;
  /** first click selects, second click on the same cell places */
  clickCell: (i: number) => void;
  select: (i: number | null) => void;
  placeSelected: () => void;
  /** places a move for the computer (bypasses the human-turn check) */
  botMove: (i: number) => void;
  /** X is always the human and moves first; this sets who plays O */
  setOpponent: (c: Controller) => void;
  setBotThinking: (v: boolean) => void;
  moveCursor: (dx: number, dy: number, dz: number) => void;
  undo: () => void;
  redoMove: () => void;
  newGame: () => void;
  loadMoves: (moves: number[]) => void;

  setExplode: (v: number) => void;
  setLayers: (v: boolean) => void;
  setIsolate: (v: Isolate | null) => void;
  setGuides: (v: boolean) => void;
  setProjections: (v: boolean) => void;
  setMotion: (v: boolean) => void;
  setWallSide: (v: [number, number]) => void;
  resetView: () => void;
}

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      moves: [],
      redo: [],
      game: replay([]),
      hover: null,
      selected: null,
      players: { 1: 'human', 2: 'human' },
      botThinking: false,
      explode: 0.35,
      layers: false,
      isolate: null,
      guides: true,
      projections: false,
      motion: true,
      wallSide: [-1, -1],
      viewResetToken: 0,

      setHover: (hover) => set({ hover }),
      select: (selected) => set({ selected }),

      clickCell: (i) => {
        const { selected, game } = get();
        if (!canPlay(game, i)) {
          set({ selected: i });
          return;
        }
        if (selected === i) get().placeSelected();
        else set({ selected: i });
      },

      placeSelected: () => {
        const { selected, game, moves, players } = get();
        if (players[game.current] !== 'human') return; // computer's turn
        if (selected === null || !canPlay(game, selected)) return;
        const next = [...moves, selected];
        set({ moves: next, redo: [], game: replay(next) });
      },

      botMove: (i) => {
        const { game, moves } = get();
        if (!canPlay(game, i)) return;
        const next = [...moves, i];
        set({ moves: next, redo: [], game: replay(next), botThinking: false, selected: null });
      },

      setOpponent: (c) => set({ players: { 1: 'human', 2: c } }),
      setBotThinking: (botThinking) => set({ botThinking }),

      moveCursor: (dx, dy, dz) => {
        const { selected, hover } = get();
        const start = selected ?? hover;
        if (start === null) {
          set({ selected: toIndex(0, 0, 0) });
          return;
        }
        const [x, y, z] = toCoord(start);
        const clamp = (v: number) => Math.max(0, Math.min(N - 1, v));
        set({ selected: toIndex(clamp(x + dx), clamp(y + dy), clamp(z + dz)) });
      },

      // Against the computer, undo/redo step back to the last human turn (your move and its reply).
      undo: () => {
        const { moves, redo, players } = get();
        if (!moves.length) return;
        const anyHuman = players[1] === 'human' || players[2] === 'human';
        let next = moves.slice(0, -1);
        let back = [moves[moves.length - 1], ...redo];
        while (anyHuman && next.length && players[replay(next).current] !== 'human') {
          back = [next[next.length - 1], ...back];
          next = next.slice(0, -1);
        }
        set({ moves: next, redo: back, game: replay(next), selected: back[0], botThinking: false });
      },

      redoMove: () => {
        const { moves, redo, players } = get();
        if (!redo.length) return;
        let next = [...moves, redo[0]];
        let rest = redo.slice(1);
        while (rest.length && players[replay(next).current] !== 'human') {
          next = [...next, rest[0]];
          rest = rest.slice(1);
        }
        set({ moves: next, redo: rest, game: replay(next), selected: null });
      },

      newGame: () => set({ moves: [], redo: [], game: replay([]), selected: null, botThinking: false }),

      loadMoves: (moves) => {
        if (!moves.every((m) => Number.isInteger(m) && m >= 0 && m < CELLS)) throw new Error('Moves must be cell indices 0–63');
        const game = replay(moves); // throws on illegal sequences
        set({ moves: [...moves], redo: [], game, selected: null });
      },

      setExplode: (explode) => set({ explode }),
      setLayers: (layers) => set({ layers }),
      setIsolate: (isolate) => set({ isolate }),
      setGuides: (guides) => set({ guides }),
      setProjections: (projections) => set({ projections }),
      setMotion: (motion) => set({ motion }),
      setWallSide: (wallSide) => set({ wallSide }),
      resetView: () => set((s) => ({ viewResetToken: s.viewResetToken + 1 })),
    }),
    {
      name: 'ttt-4x4x4',
      version: 2,
      // v2: projections became opt-in; reset the saved value once so everyone gets the new default
      migrate: (persisted, version) => {
        const p = (persisted ?? {}) as Record<string, unknown>;
        if (version < 2) p.projections = false;
        return p as never;
      },
      partialize: (s) => ({ moves: s.moves, redo: s.redo, players: s.players, explode: s.explode, layers: s.layers, guides: s.guides, projections: s.projections, motion: s.motion }),
      merge: (persisted, current) => {
        const p = persisted as Partial<Store>;
        try {
          // X is always human (older saves could put a bot on X)
          const players = { 1: 'human' as const, 2: p.players?.[2] ?? 'human' };
          return { ...current, ...p, players, game: replay(p.moves ?? []) };
        } catch {
          return current;
        }
      },
    },
  ),
);

/** The cell the UI is "focused" on: hover wins over selection. */
export const useFocus = () => useStore((s) => s.hover ?? s.selected);

export function isVisible(i: number, iso: Isolate | null): boolean {
  if (!iso) return true;
  const [x, y, z] = toCoord(i);
  return { x, y, z }[iso.axis] === iso.index;
}
