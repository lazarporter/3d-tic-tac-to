import { useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Billboard, Edges } from '@react-three/drei';
import * as THREE from 'three';
import { CELL_LINES, canPlay } from '../game/engine';
import { isVisible, useStore } from '../store';
import { CELL_SIZE, COLORS, cellPosition, playerColor } from './layout';

const noRaycast = () => null;
const meshRaycast = THREE.Mesh.prototype.raycast;

export function Piece({ player, opacity = 1, scale = 1 }: { player: 1 | 2; opacity?: number; scale?: number }) {
  const color = playerColor(player);
  const mat = (
    <meshStandardMaterial
      color={color}
      emissive={color}
      emissiveIntensity={opacity < 1 ? 0.6 : 1.7}
      roughness={0.35}
      metalness={0.1}
      toneMapped={false}
      transparent={opacity < 1}
      opacity={opacity}
      depthWrite={opacity >= 1}
    />
  );
  return (
    <Billboard scale={scale}>
      {player === 1 ? (
        <>
          <mesh rotation={[0, 0, Math.PI / 4]} raycast={noRaycast}>
            <boxGeometry args={[0.66, 0.13, 0.13]} />
            {mat}
          </mesh>
          <mesh rotation={[0, 0, -Math.PI / 4]} raycast={noRaycast}>
            <boxGeometry args={[0.66, 0.13, 0.13]} />
            {mat}
          </mesh>
        </>
      ) : (
        <mesh raycast={noRaycast}>
          <torusGeometry args={[0.24, 0.075, 20, 48]} />
          {mat}
        </mesh>
      )}
    </Billboard>
  );
}

export function Cell({ i }: { i: number }) {
  const value = useStore((s) => s.game.board[i]);
  const current = useStore((s) => s.game.current);
  const playable = useStore((s) => canPlay(s.game, i));
  const hovered = useStore((s) => s.hover === i);
  const selected = useStore((s) => s.selected === i);
  const visible = useStore((s) => isVisible(i, s.isolate));
  const winning = useStore((s) => s.game.winLine?.cells.includes(i) ?? false);
  const onGuide = useStore((s) => {
    const f = s.hover ?? s.selected;
    if (!s.guides || f === null || f === i) return false;
    return CELL_LINES[f].some((id) => CELL_LINES[i].includes(id));
  });
  const explode = useStore((s) => s.explode);
  const layers = useStore((s) => s.layers);
  const setHover = useStore((s) => s.setHover);
  const clickCell = useStore((s) => s.clickCell);

  const group = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Group>(null);
  const target = useMemo(() => new THREE.Vector3(...cellPosition(i, explode, layers)), [i, explode, layers]);

  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    g.position.lerp(target, 1 - Math.exp(-dt * 9));
    const t = state.clock.elapsedTime;
    const pulse = winning ? 1 + Math.sin(t * 6) * 0.12 : selected ? 1 + Math.sin(t * 5) * 0.05 : 1;
    inner.current?.scale.setScalar(pulse);
  });

  const onOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHover(i);
  };
  const onOut = () => {
    if (useStore.getState().hover === i) setHover(null);
  };
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > 6) return; // that was a drag to rotate, not a click
    clickCell(i);
  };

  let glassColor: string = COLORS.glass;
  let glassOpacity = 0.05;
  let edgeColor: string = COLORS.edge;
  if (!visible) {
    glassOpacity = 0.01;
  } else if (selected) {
    glassColor = playable ? playerColor(current) : '#ffffff';
    glassOpacity = 0.22;
    edgeColor = '#ffffff';
  } else if (hovered) {
    glassColor = '#ffffff';
    glassOpacity = 0.14;
    edgeColor = '#dfe6ff';
  } else if (winning) {
    edgeColor = playerColor(value || 1);
    glassOpacity = 0.12;
    glassColor = playerColor(value || 1);
  } else if (onGuide) {
    glassOpacity = 0.09;
    edgeColor = '#8f9fcc';
  }

  return (
    <group ref={group} position={target.toArray()}>
      <mesh
        raycast={visible ? meshRaycast : noRaycast}
        onPointerOver={onOver}
        onPointerOut={onOut}
        onClick={onClick}
        renderOrder={1}
      >
        <boxGeometry args={[CELL_SIZE, CELL_SIZE, CELL_SIZE]} />
        <meshStandardMaterial
          color={glassColor}
          transparent
          opacity={glassOpacity}
          depthWrite={false}
          roughness={0.1}
        />
        {visible && <Edges color={edgeColor} threshold={15} />}
      </mesh>
      <group ref={inner}>
        {value !== 0 && <Piece player={value} opacity={visible ? 1 : 0.12} />}
        {value === 0 && selected && playable && <Piece player={current} opacity={0.4} scale={0.9} />}
      </group>
    </group>
  );
}
