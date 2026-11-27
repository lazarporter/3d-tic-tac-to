import { useMemo } from 'react';
import { Stars } from '@react-three/drei';
import * as THREE from 'three';
import { SUN_DIR } from './layout';

/**
 * World-fixed frame of reference: a sky that is lighter above and darker below,
 * a horizon band, a "sun" glow in the key light's direction (which breaks the cube's
 * 90° symmetry), and distant stars that visibly swing past as the camera orbits.
 */
export function Sky() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          top: { value: new THREE.Color('#1d2a52') },
          horizon: { value: new THREE.Color('#2a2f55') },
          bottom: { value: new THREE.Color('#05070d') },
          sunDir: { value: new THREE.Vector3(...SUN_DIR).normalize() },
          sunColor: { value: new THREE.Color('#ffd9a8') },
        },
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 top, horizon, bottom, sunDir, sunColor;
          varying vec3 vDir;
          void main() {
            vec3 d = normalize(vDir);
            float h = d.y;
            vec3 col = h > 0.0
              ? mix(horizon, top, smoothstep(0.0, 0.55, h))
              : mix(horizon * 0.55, bottom, smoothstep(0.0, 0.25, -h));
            col += horizon * 0.35 * exp(-abs(h) * 14.0);          // glowing horizon band
            float sd = max(dot(d, sunDir), 0.0);
            col += sunColor * (pow(sd, 900.0) * 1.2 + pow(sd, 40.0) * 0.18 + pow(sd, 6.0) * 0.05);
            gl_FragColor = vec4(col, 1.0);
          }`,
      }),
    [],
  );
  return (
    <>
      <mesh material={material} renderOrder={-10} raycast={() => null}>
        <sphereGeometry args={[95, 48, 24]} />
      </mesh>
      <Stars radius={70} depth={12} count={1400} factor={2.6} saturation={0} fade speed={0} />
    </>
  );
}

/** Light consistently from above: sky/ground hemisphere + a warm key light from the sun. */
export function Lights() {
  const sun = new THREE.Vector3(...SUN_DIR).normalize().multiplyScalar(30);
  return (
    <>
      <hemisphereLight args={['#c9d4ff', '#1c1526', 1.1]} />
      <directionalLight position={sun.toArray()} intensity={1.7} color="#fff1dc" />
      <directionalLight position={[-sun.x, -6, -sun.z]} intensity={0.18} color="#6f7cff" />
    </>
  );
}
