import { useEffect, useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { CameraControls, GizmoHelper, GizmoViewport, Line } from '@react-three/drei';
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { CELLS, CELL_LINES, LINES, N, lineStatus, toIndex } from '../game/engine';
import { useStore } from '../store';
import { Cell } from './Cell';
import { COLORS, LAYER_GAP, cellPosition, framingDistance, playerColor } from './layout';

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

/** A text label drawn to a canvas texture, always facing the camera. */
function TextSprite({ text, position }: { text: string; position: [number, number, number] }) {
  const texture = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 48;
    const ctx = c.getContext('2d')!;
    ctx.font = '600 30px ui-monospace, Menlo, monospace';
    ctx.fillStyle = '#8b95ba';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 64, 24);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [text]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <sprite position={position} scale={[0.85, 0.32, 1]} raycast={() => null}>
      <spriteMaterial map={texture} transparent depthWrite={false} />
    </sprite>
  );
}

/** Small floating labels for layer numbers and axis directions. */
function Labels() {
  const explode = useStore((s) => s.explode);
  const layers = useStore((s) => s.layers);
  const s = 1 + explode * 1.2;
  const label = (text: string, pos: [number, number, number], key: string) => (
    <TextSprite key={key} text={text} position={pos} />
  );
  const items = [];
  for (let z = 0; z < N; z++) {
    const [, y] = cellPosition(toIndex(0, 0, z), explode, layers);
    items.push(label(`z=${z}`, [-2.2 * s - 0.6, y, -1.5 * s], `z${z}`));
  }
  const [, y0] = cellPosition(0, explode, layers);
  const below = y0 - 0.9;
  for (let k = 0; k < N; k++) {
    items.push(label(`x=${k}`, [(k - 1.5) * s, below, 1.5 * s + 1], `x${k}`));
    items.push(label(`y=${k}`, [1.5 * s + 1, below, (k - 1.5) * s], `y${k}`));
  }
  return <>{items}</>;
}

function Controls() {
  const ref = useRef<CameraControls>(null);
  const token = useStore((s) => s.viewResetToken);
  const layers = useStore((s) => s.layers);
  const explode = useStore((s) => s.explode);
  useEffect(() => {
    const d = framingDistance(useStore.getState().explode, layers);
    const dir = new THREE.Vector3(0.62, 0.5, 0.78).normalize().multiplyScalar(d);
    ref.current?.setLookAt(dir.x, dir.y, dir.z, 0, 0, 0, token > 0 || layers);
  }, [token, layers]);
  return (
    <CameraControls
      ref={ref}
      makeDefault
      minDistance={4}
      maxDistance={framingDistance(explode, true) * 2}
      smoothTime={0.18}
      draggingSmoothTime={0.08}
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
      <fog attach="fog" args={[COLORS.bg, 18, 48 + LAYER_GAP * 4]} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[6, 10, 8]} intensity={1.4} />
      <directionalLight position={[-8, -4, -6]} intensity={0.4} color="#7f8cff" />
      <pointLight position={[0, 0, 0]} intensity={4} distance={8} color="#6d7cff" />

      {cells.map((i) => (
        <Cell key={i} i={i} />
      ))}
      <Guides />
      <WinLine />
      <Labels />
      <Controls />

      <GizmoHelper alignment="bottom-left" margin={[70, 90]} renderPriority={2}>
        <GizmoViewport
          axisColors={['#ff6b6b', '#ffd166', '#5ee6a8']}
          labels={['x', 'z', 'y']}
          labelColor="#0b0f1a"
        />
      </GizmoHelper>

      <EffectComposer multisampling={4}>
        <Bloom mipmapBlur intensity={0.85} luminanceThreshold={1} luminanceSmoothing={0.2} />
        <Vignette eskil={false} offset={0.2} darkness={0.6} />
      </EffectComposer>
    </Canvas>
  );
}
