import { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { CELLS, CELL_LINES, LINES, lineStatus } from '../game/engine';
import { useStore } from '../store';
import { Cell } from './Cell';
import { COLORS, LAYER_GAP, cellPosition, playerColor } from './layout';
import { Lights, Sky } from './Environment';
import { FloorGrid, Projections, WallSideWatcher } from './Projections';
import { AxisFrame, Controls, Labels, MotionGroup, ViewCube } from './Frame';

/** Endpoints of a line through its first and last cell, extended slightly past both ends. */
function lineEnds(cells: number[], explode: number, layers: boolean, extend = 0.45): [THREE.Vector3, THREE.Vector3] {
  const a = new THREE.Vector3(...cellPosition(cells[0], explode, layers));
  const b = new THREE.Vector3(...cellPosition(cells[cells.length - 1], explode, layers));
  const d = b.clone().sub(a).normalize().multiplyScalar(extend);
  return [a.sub(d), b.add(d)];
}

function Guides() {
  const focus = useStore((s) => s.hover ?? s.selected);
  const guides = useStore((s) => s.guides);
  const board = useStore((s) => s.game.board);
  const explode = useStore((s) => s.explode);
  const layers = useStore((s) => s.layers);
  if (!guides || focus === null) return null;
  return (
    <>
      {CELL_LINES[focus].map((id) => {
        const st = lineStatus(board, LINES[id]);
        const color =
          st.state === 'X' ? COLORS.x : st.state === 'O' ? COLORS.o : st.state === 'dead' ? COLORS.dead : COLORS.open;
        return (
          <Line
            key={id}
            points={lineEnds(LINES[id].cells, explode, layers)}
            color={color}
            lineWidth={st.state === 'dead' ? 1 : 1.8}
            transparent
            opacity={st.state === 'dead' ? 0.25 : 0.55}
            dashed={st.state === 'open'}
            dashSize={0.18}
            gapSize={0.12}
          />
        );
      })}
    </>
  );
}

function WinLine() {
  const win = useStore((s) => s.game.winLine);
  const winner = useStore((s) => s.game.winner);
  const explode = useStore((s) => s.explode);
  const layers = useStore((s) => s.layers);
  if (!win || !winner) return null;
  return (
    <Line
      points={lineEnds(win.cells, explode, layers, 0.7)}
      color={new THREE.Color(playerColor(winner)).multiplyScalar(2.5)}
      lineWidth={6}
      toneMapped={false}
    />
  );
}

export function Scene() {
  const cells = useMemo(() => Array.from({ length: CELLS }, (_, i) => i), []);
  return (
    <Canvas
      camera={{ position: [8, 7, 10], fov: 42, near: 0.1, far: 200 }}
      dpr={[1, 2]}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
    >
      <color attach="background" args={[COLORS.bg]} />
      <fog attach="fog" args={['#121833', 22, 60 + LAYER_GAP * 4]} />
      <Sky />
      <Lights />

      <MotionGroup>
        {cells.map((i) => (
          <Cell key={i} i={i} />
        ))}
        <Guides />
        <WinLine />
        <FloorGrid />
        <Projections />
        <AxisFrame />
        <Labels />
      </MotionGroup>

      <WallSideWatcher />
      <Controls />
      <ViewCube />

      <EffectComposer multisampling={4}>
        <Bloom mipmapBlur intensity={0.85} luminanceThreshold={1} luminanceSmoothing={0.2} />
        <Vignette eskil={false} offset={0.2} darkness={0.6} />
      </EffectComposer>
    </Canvas>
  );
}
