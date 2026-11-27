import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Grid, Line } from '@react-three/drei';
import * as THREE from 'three';
import { CELLS, N, toCoord } from '../game/engine';
import { isVisible, useStore } from '../store';
import { CELL_SIZE, bounds, cellPosition, playerColor, type Bounds } from './layout';

/**
 * Orthographic "shadows" of the board on a floor and two walls (the scientific-plot
 * pattern). Every straight line in 3D stays a straight line in each projection, so
 * cross-layer threats show up as plain rows on a wall. Walls always sit on the far
 * side of the cube from the camera, so they never block the view.
 *
 * In every pane, a piece is drawn as a ring whose size grows with its distance from
 * the pane, like a shadow spreading the further it falls.
 */

type PaneKind = 'floor' | 'wallX' | 'wallZ';

interface Pane {
  kind: PaneKind;
  /** drop a 3D point onto the pane (nudged `lift` toward the cube) */
  project: (p: THREE.Vector3, lift?: number) => THREE.Vector3;
  rotation: [number, number, number];
  center: THREE.Vector3;
  size: [number, number];
  /** 0..3 distance index of a cell from this pane */
  depth: (i: number) => number;
}

function makePanes(b: Bounds, sx: number, sz: number): Pane[] {
  const top = b.halfY + 0.6;
  const wallH = top - b.floorY;
  const wallMidY = (top + b.floorY) / 2;
  const width = 2 * b.half + 1.2;
  return [
    {
      kind: 'floor',
      project: (p, lift = 0) => new THREE.Vector3(p.x, b.floorY + lift, p.z),
      rotation: [-Math.PI / 2, 0, 0],
      center: new THREE.Vector3(0, b.floorY, 0),
      size: [width, width],
      depth: (i) => toCoord(i)[2],
    },
    {
      kind: 'wallX',
      project: (p, lift = 0) => new THREE.Vector3(sx * (b.wall - lift), p.y, p.z),
      rotation: [0, Math.PI / 2, 0],
      center: new THREE.Vector3(sx * b.wall, wallMidY, 0),
      size: [width, wallH],
      depth: (i) => (sx < 0 ? toCoord(i)[0] : N - 1 - toCoord(i)[0]),
    },
    {
      kind: 'wallZ',
      project: (p, lift = 0) => new THREE.Vector3(p.x, p.y, sz * (b.wall - lift)),
      rotation: [0, 0, 0],
      center: new THREE.Vector3(0, wallMidY, sz * b.wall),
      size: [width, wallH],
      depth: (i) => (sz < 0 ? toCoord(i)[1] : N - 1 - toCoord(i)[1]),
    },
  ];
}

/** Keeps the walls on the far side of the cube. The swap happens when a wall is edge-on, so it's invisible. */
export function WallSideWatcher() {
  useFrame(({ camera }) => {
    const sx = camera.position.x > 0 ? -1 : 1;
    const sz = camera.position.z > 0 ? -1 : 1;
    const [cx, cz] = useStore.getState().wallSide;
    if (sx !== cx || sz !== cz) useStore.getState().setWallSide([sx, sz]);
  });
  return null;
}

/** Infinite fading floor grid aligned to cell boundaries: the always-on ground reference. */
export function FloorGrid() {
  const explode = useStore((s) => s.explode);
  const layers = useStore((s) => s.layers);
  const b = bounds(explode, layers);
  return (
    <Grid
      position={[2 * b.s, b.floorY - 0.003, 2 * b.s]}
      args={[10, 10]}
      cellSize={b.s}
      sectionSize={4 * b.s}
      cellThickness={0.6}
      sectionThickness={1.3}
      cellColor="#1d2646"
      sectionColor="#34407a"
      infiniteGrid
      fadeDistance={34}
      fadeStrength={2.2}
      fadeFrom={0}
      raycast={() => null}
    />
  );
}

function footprintGeometry(pane: Pane, explode: number, layers: boolean) {
  const pts: number[] = [];
  const seen = new Set<string>();
  const h = CELL_SIZE / 2;
  for (let i = 0; i < CELLS; i++) {
    const c = pane.project(new THREE.Vector3(...cellPosition(i, explode, layers)), 0.004);
    const key = c.toArray().map((v) => v.toFixed(3)).join();
    if (seen.has(key)) continue;
    seen.add(key);
    // square corners in the pane's own 2D axes
    const corners =
      pane.kind === 'floor'
        ? [[-h, 0, -h], [h, 0, -h], [h, 0, h], [-h, 0, h]]
        : pane.kind === 'wallX'
          ? [[0, -h, -h], [0, -h, h], [0, h, h], [0, h, -h]]
          : [[-h, -h, 0], [h, -h, 0], [h, h, 0], [-h, h, 0]];
    for (let k = 0; k < 4; k++) {
      const a = corners[k], b = corners[(k + 1) % 4];
      pts.push(c.x + a[0], c.y + a[1], c.z + a[2], c.x + b[0], c.y + b[1], c.z + b[2]);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return g;
}

function PaneView({ pane }: { pane: Pane }) {
  const explode = useStore((s) => s.explode);
  const layers = useStore((s) => s.layers);
  const board = useStore((s) => s.game.board);
  const win = useStore((s) => s.game.winLine);
  const winner = useStore((s) => s.game.winner);
  const isolate = useStore((s) => s.isolate);
  const focus = useStore((s) => s.hover ?? s.selected);

  const footprints = useMemo(() => footprintGeometry(pane, explode, layers), [pane, explode, layers]);
  const pos = (i: number) => new THREE.Vector3(...cellPosition(i, explode, layers));

  return (
    <group>
      {pane.kind !== 'floor' && (
        <mesh position={pane.center} rotation={pane.rotation} raycast={() => null} renderOrder={-1}>
          <planeGeometry args={pane.size} />
          <meshBasicMaterial color="#141c38" transparent opacity={0.45} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      )}
      <lineSegments geometry={footprints} raycast={() => null}>
        <lineBasicMaterial color="#2c3866" transparent opacity={0.9} />
      </lineSegments>

      {board.map((v, i) => {
        if (!v) return null;
        const r = 0.09 + pane.depth(i) * 0.08;
        return (
          <mesh
            key={i}
            position={pane.project(pos(i), 0.01 + pane.depth(i) * 0.002)}
            rotation={pane.rotation}
            raycast={() => null}
          >
            <ringGeometry args={[r, r + 0.055, 40]} />
            <meshBasicMaterial
              color={playerColor(v)}
              transparent
              opacity={isVisible(i, isolate) ? 0.9 : 0.25}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
        );
      })}

      {focus !== null && (
        <>
          <mesh position={pane.project(pos(focus), 0.006)} rotation={pane.rotation} raycast={() => null}>
            <planeGeometry args={[CELL_SIZE, CELL_SIZE]} />
            <meshBasicMaterial color="#dfe6ff" transparent opacity={0.16} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
          <Line
            points={[pos(focus), pane.project(pos(focus), 0.01)]}
            color="#dfe6ff"
            lineWidth={1}
            dashed
            dashSize={0.12}
            gapSize={0.1}
            transparent
            opacity={0.55}
          />
        </>
      )}

      {win && winner && (
        <Line
          points={[pane.project(pos(win.cells[0]), 0.02), pane.project(pos(win.cells[N - 1]), 0.02)]}
          color={playerColor(winner)}
          lineWidth={2}
          transparent
          opacity={0.7}
        />
      )}
    </group>
  );
}

export function Projections() {
  const on = useStore((s) => s.projections);
  const explode = useStore((s) => s.explode);
  const layers = useStore((s) => s.layers);
  const [sx, sz] = useStore((s) => s.wallSide);
  const panes = useMemo(() => makePanes(bounds(explode, layers), sx, sz), [explode, layers, sx, sz]);
  if (!on) return null;
  return (
    <>
      {panes.map((p) => (
        <PaneView key={p.kind} pane={p} />
      ))}
    </>
  );
}
