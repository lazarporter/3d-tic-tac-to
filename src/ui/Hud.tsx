import { PLAYER_LABEL, threats, toCoord } from '../game/engine';
import { useStore } from '../store';

export function Hud() {
  const game = useStore((s) => s.game);
  const selected = useStore((s) => s.selected);
  const hover = useStore((s) => s.hover);
  const focus = hover ?? selected;

  const xThreats = threats(game.board, 1).length;
  const oThreats = threats(game.board, 2).length;

  let status: React.ReactNode;
  if (game.winner) status = <><Mark p={game.winner} /> wins!</>;
  else if (game.draw) status = <>Draw: the board is full</>;
  else status = <><Mark p={game.current} /> to move</>;

  return (
    <div className="hud">
      <div className={`status ${game.winner ? 'won' : ''}`}>{status}</div>
      <div className="hud-sub">
        Move {game.moves.length} · threats X {xThreats} · O {oThreats}
        {focus !== null && <> · cell {fmt(focus)}</>}
      </div>
      <div className="hint">
        Drag to rotate · scroll to zoom · right-drag to pan · click a cell to select, click again or press Enter
        to place · arrows / Q E move the cursor · view cube (top right) snaps views · L layers · P projections · M motion · R reset view
      </div>
    </div>
  );
}

export function Mark({ p }: { p: 0 | 1 | 2 }) {
  return <span className={`mark mark-${p}`}>{PLAYER_LABEL[p]}</span>;
}

export const fmt = (i: number) => `(${toCoord(i).join(',')})`;
