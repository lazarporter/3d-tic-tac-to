import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CELLS, N, canPlay, replay, toCoord, toIndex, type GameState } from './game/engine';

export type Axis = 'x' | 'y' | 'z';
export interface Isolate { axis: Axis; index: number }

interface Store {
  moves: number[];
  redo: number[];
  game: GameState;

  hover: number | null;
  selected: number | null;

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
      explode: 0.35,
      layers: false,
      isolate: null,
      guides: true,
      projections: true,
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
        const { selected, game, moves } = get();
        if (selected === null || !canPlay(game, selected)) return;
        const next = [...moves, selected];
        set({ moves: next, redo: [], game: replay(next) });
      },

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

      undo: () => {
        const { moves, redo } = get();
        if (!moves.length) return;
        const last = moves[moves.length - 1];
        const next = moves.slice(0, -1);
        set({ moves: next, redo: [last, ...redo], game: replay(next), selected: last });
      },

      redoMove: () => {
        const { moves, redo } = get();
        if (!redo.length) return;
        const next = [...moves, redo[0]];
        set({ moves: next, redo: redo.slice(1), game: replay(next), selected: null });
      },

      newGame: () => set({ moves: [], redo: [], game: replay([]), selected: null }),

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
      version: 1,
      partialize: (s) => ({ moves: s.moves, redo: s.redo, explode: s.explode, layers: s.layers, guides: s.guides, projections: s.projections, motion: s.motion }),
      merge: (persisted, current) => {
        const p = persisted as Partial<Store>;
        try {
          return { ...current, ...p, game: replay(p.moves ?? []) };
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
