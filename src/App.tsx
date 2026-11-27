import { useEffect } from 'react';
import { Scene } from './scene/Scene';
import { Panel } from './ui/Panel';
import { Hud } from './ui/Hud';
import { useStore } from './store';

function useKeyboard() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select')) return;
      const s = useStore.getState();
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) s.redoMove();
        else s.undo();
        return;
      }
      if (mod) return;
      const moves: Record<string, [number, number, number]> = {
        ArrowLeft: [-1, 0, 0], ArrowRight: [1, 0, 0],
        ArrowUp: [0, -1, 0], ArrowDown: [0, 1, 0],
        PageUp: [0, 0, 1], PageDown: [0, 0, -1],
        e: [0, 0, 1], q: [0, 0, -1],
      };
      const m = moves[e.key];
      if (m) {
        e.preventDefault();
        s.moveCursor(...m);
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        s.placeSelected();
      } else if (e.key === 'Escape') {
        s.select(null);
      } else if (e.key === 'r') {
        s.resetView();
      } else if (e.key === 'l') {
        s.setLayers(!s.layers);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

export default function App() {
  useKeyboard();
  return (
    <div className="app">
      <main className="stage">
        <Scene />
        <Hud />
      </main>
      <Panel />
    </div>
  );
}
