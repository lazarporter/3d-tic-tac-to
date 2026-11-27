import { useEffect, useRef, type ReactNode } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { CameraControls, GizmoHelper, GizmoViewcube, Line } from '@react-three/drei';
import * as THREE from 'three';
import { N } from '../game/engine';
import { useStore } from '../store';
import { AXIS, bounds, framingDistance } from './layout';
import { TextSprite } from './TextSprite';

/** Shared handle on the camera controls, so the view cube can drive them. */
export const cameraControls: { current: CameraControls | null } = { current: null };

/** The camera only ever stays a little below the floor's horizon (turntable with a fixed up). */
const MAX_POLAR = Math.PI * 0.6;

export function Controls() {
  const ref = useRef<CameraControls>(null);
  const token = useStore((s) => s.viewResetToken);
  const layers = useStore((s) => s.layers);
  const explode = useStore((s) => s.explode);
  useEffect(() => {
    cameraControls.current = ref.current;
  });
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
      maxPolarAngle={MAX_POLAR}
      smoothTime={0.18}
      draggingSmoothTime={0.08}
    />
  );
}

/**
 * Autodesk-style view cube: rotates with the scene (indicator) and snaps the camera
 * to a face, edge or corner view when clicked (controller). Transitions animate.
 */
export function ViewCube() {
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const c = cameraControls.current;
    if (!c) return null;
    // faces are one mesh at the origin (use the face normal); edges/corners are offset boxes
    const dir = e.object.position.lengthSq() > 0 ? e.object.position.clone() : e.face!.normal.clone();
    dir.normalize();
    const target = c.getTarget(new THREE.Vector3());
    const d = c.distance;
    const pos = target.clone().addScaledVector(dir, d);
    // nudge pure top/bottom so the azimuth stays defined and "front" stays at the bottom of the screen
    if (Math.abs(dir.y) > 0.999) pos.z += 0.001 * d;
    c.setLookAt(pos.x, pos.y, pos.z, target.x, target.y, target.z, true);
    return null;
  };
  return (
    <GizmoHelper alignment="top-right" margin={[78, 78]} renderPriority={2}>
      <GizmoViewcube
        faces={['Right', 'Left', 'Top', 'Bottom', 'Front', 'Back']}
        color="#1b2344"
        hoverColor="#5468c4"
        textColor="#d6dcf5"
        strokeColor="#3d4a7e"
        opacity={0.95}
        onClick={onClick}
      />
    </GizmoHelper>
  );
}

function Arrow({ from, to, color, label }: { from: THREE.Vector3; to: THREE.Vector3; color: string; label: string }) {
  const dir = to.clone().sub(from).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  const tip = to.clone().addScaledVector(dir, 0.12);
  const lab = to.clone().addScaledVector(dir, 0.55);
  return (
    <>
      <Line points={[from, to]} color={color} lineWidth={2.4} />
      <mesh position={tip} quaternion={q} raycast={() => null}>
        <coneGeometry args={[0.09, 0.26, 16]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <TextSprite text={label} position={lab.toArray() as [number, number, number]} color={color} bold size={1.1} />
    </>
  );
}

/**
 * Asymmetric landmarks: an origin marker at cell (0,0,0)'s outer corner and colored
 * axis arrows running along the cube's edges. The same colors label the tables.
 */
export function AxisFrame() {
  const explode = useStore((s) => s.explode);
  const layers = useStore((s) => s.layers);
  const b = bounds(explode, layers);
  const o = new THREE.Vector3(-b.half, -b.halfY, -b.half);
  return (
    <group>
      <mesh position={o} raycast={() => null}>
        <sphereGeometry args={[0.1, 20, 12]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      <TextSprite text="0,0,0" position={[o.x - 0.5, o.y - 0.25, o.z - 0.2]} color="#e6eaff" size={0.9} />
      <Arrow from={o} to={new THREE.Vector3(b.half + 0.5, o.y, o.z)} color={AXIS.x} label="x" />
      <Arrow from={o} to={new THREE.Vector3(o.x, o.y, b.half + 0.5)} color={AXIS.y} label="y" />
      <Arrow from={o} to={new THREE.Vector3(o.x, b.halfY + 0.5, o.z)} color={AXIS.z} label="z" />
    </group>
  );
}

/** Coordinate labels: x/y along the near edges of the floor, z up the corner where the walls meet. */
export function Labels() {
  const explode = useStore((s) => s.explode);
  const layers = useStore((s) => s.layers);
  const [sx, sz] = useStore((s) => s.wallSide);
  const b = bounds(explode, layers);
  const items: ReactNode[] = [];
  const dim = (c: string) => c + 'b0';
  for (let k = 0; k < N; k++) {
    const c = (k - 1.5) * b.s;
    items.push(<TextSprite key={`x${k}`} text={`x=${k}`} color={dim(AXIS.x)} size={0.8}
      position={[c, b.floorY + 0.05, -sz * (b.half + 0.55)]} />);
    items.push(<TextSprite key={`y${k}`} text={`y=${k}`} color={dim(AXIS.y)} size={0.8}
      position={[-sx * (b.half + 0.6), b.floorY + 0.05, c]} />);
    items.push(<TextSprite key={`z${k}`} text={`z=${k}`} color={dim(AXIS.z)} size={0.8}
      position={[sx * (b.half + 0.45), (k - 1.5) * b.vs, sz * (b.half + 0.45)]} />);
  }
  return <>{items}</>;
}

/**
 * Motion cues: a small mouse-coupled tilt (cheap stand-in for head-coupled parallax)
 * and, after a few idle seconds, a gentle ±3° wobble (small rotations reveal 3D shape).
 */
export function MotionGroup({ children }: { children: ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  const motion = useStore((s) => s.motion);
  const gl = useThree((s) => s.gl);
  const state = useRef({ x: 0, y: 0, dragging: false, last: 0 });

  useEffect(() => {
    const el = gl.domElement;
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      state.current.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      state.current.y = ((e.clientY - r.top) / r.height) * 2 - 1;
      state.current.last = performance.now();
    };
    const down = () => (state.current.dragging = true);
    const up = () => (state.current.dragging = false);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerdown', down);
    window.addEventListener('pointerup', up);
    return () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerdown', down);
      window.removeEventListener('pointerup', up);
    };
  }, [gl]);

  const target = useRef({ rx: 0, ry: 0 });
  useFrame(({ clock }, dt) => {
    const g = ref.current;
    if (!g) return;
    const s = state.current;
    const t = target.current;
    if (!motion) {
      t.rx = 0;
      t.ry = 0;
    } else if (!s.dragging) {
      const inside = Math.abs(s.x) <= 1 && Math.abs(s.y) <= 1;
      t.ry = inside ? s.x * 0.035 : 0;
      t.rx = inside ? s.y * 0.022 : 0;
      if (performance.now() - s.last > 5000) {
        t.ry += Math.sin(clock.elapsedTime * 0.55) * 0.055;
        t.rx += Math.sin(clock.elapsedTime * 0.37) * 0.015;
      }
    }
    const k = 1 - Math.exp(-dt * 3);
    g.rotation.x += (t.rx - g.rotation.x) * k;
    g.rotation.y += (t.ry - g.rotation.y) * k;
  });

  return <group ref={ref}>{children}</group>;
}
