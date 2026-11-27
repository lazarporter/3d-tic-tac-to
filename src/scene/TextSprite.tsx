import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

/** A text label drawn to a canvas texture, always facing the camera. */
export function TextSprite({
  text,
  position,
  color = '#8b95ba',
  size = 1,
  bold = false,
}: {
  text: string;
  position: [number, number, number];
  color?: string;
  size?: number;
  bold?: boolean;
}) {
  const texture = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 192;
    c.height = 64;
    const ctx = c.getContext('2d')!;
    ctx.font = `${bold ? 800 : 600} 36px ui-monospace, Menlo, monospace`;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 96, 32);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [text, color, bold]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <sprite position={position} scale={[1.05 * size, 0.35 * size, 1]} raycast={() => null}>
      <spriteMaterial map={texture} transparent depthWrite={false} fog={false} />
    </sprite>
  );
}
