import { useState } from 'react';
import { CELL_LINES, LINES, describeDirection, lineStatus, toCoord } from '../game/engine';
import { useFocus, useStore, type Axis } from '../store';
import { Matrix } from './Matrix';
import { Mark, fmt } from './Hud';

export function Panel() {
  return (
    <aside className="panel">
      <header className="panel-head">
        <h1>4×4×4 Tic-Tac-Toe</h1>
        <GameButtons />
      </header>
      <ViewControls />
      <Matrix />
      <LineDetails />
      <MoveList />
      <SaveLoad />
    </aside>
  );
}

function GameButtons() {
  const { newGame, undo, redoMove } = useStore.getState();
  const canUndo = useStore((s) => s.moves.length > 0);
  const canRedo = useStore((s) => s.redo.length > 0);
  const inProgress = useStore((s) => s.moves.length > 0 && !s.game.winner && !s.game.draw);
  // Two-step confirm in the page itself (native confirm() dialogs are blocked in some embedded browsers).
  const [armed, setArmed] = useState(false);
  const onNew = () => {
    if (inProgress && !armed) {
      setArmed(true);
      setTimeout(() => setArmed(false), 3000);
      return;
    }
    setArmed(false);
    newGame();
  };
  return (
    <div className="row">
      <button onClick={onNew} className={armed ? 'warn' : ''}>
        {armed ? 'Click again to discard game' : 'New game'}
      </button>
      <button onClick={undo} disabled={!canUndo} title="Ctrl/Cmd+Z">Undo</button>
      <button onClick={redoMove} disabled={!canRedo} title="Ctrl/Cmd+Shift+Z">Redo</button>
    </div>
  );
}

function ViewControls() {
  const s = useStore();
  const axes: (Axis | 'none')[] = ['none', 'x', 'y', 'z'];
  return (
    <section>
      <h2>View</h2>
      <label className="slider">
        <span>Explode</span>
        <input
          type="range" min={0} max={1} step={0.01} value={s.explode}
          onChange={(e) => s.setExplode(Number(e.target.value))}
        />
      </label>
      <div className="row">
        <button className={s.layers ? 'on' : ''} onClick={() => s.setLayers(!s.layers)} title="L">
          {s.layers ? 'Layers: split' : 'Layers: stacked'}
        </button>
        <button className={s.guides ? 'on' : ''} onClick={() => s.setGuides(!s.guides)}>
          Guide lines {s.guides ? 'on' : 'off'}
        </button>
        <button onClick={s.resetView} title="R">Reset view</button>
      </div>
      <div className="row">
        <button className={s.projections ? 'on' : ''} onClick={() => s.setProjections(!s.projections)} title="P">
          Projections {s.projections ? 'on' : 'off'}
        </button>
        <button className={s.motion ? 'on' : ''} onClick={() => s.setMotion(!s.motion)} title="M">
          Motion cues {s.motion ? 'on' : 'off'}
        </button>
      </div>
      <div className="row isolate">
        <span>Isolate</span>
        {axes.map((a) => (
          <button
            key={a}
            className={(a === 'none' ? s.isolate === null : s.isolate?.axis === a) ? 'on' : ''}
            onClick={() => s.setIsolate(a === 'none' ? null : { axis: a, index: s.isolate?.index ?? 0 })}
          >
            {a}
          </button>
        ))}
        {s.isolate && (
          <>
            <span>=</span>
            {[0, 1, 2, 3].map((k) => (
              <button
                key={k}
                className={s.isolate?.index === k ? 'on' : ''}
                onClick={() => s.setIsolate({ axis: s.isolate!.axis, index: k })}
              >
                {k}
              </button>
            ))}
          </>
        )}
      </div>
    </section>
  );
}

function LineDetails() {
  const focus = useFocus();
  const board = useStore((s) => s.game.board);
  if (focus === null) {
    return (
      <section>
        <h2>Lines through cell</h2>
        <p className="note">Hover or select a cell to see every winning line through it.</p>
      </section>
    );
  }
  const ids = CELL_LINES[focus];
  return (
    <section>
      <h2>
        Lines through {fmt(focus)} <small>index {focus} · {ids.length} lines</small>
      </h2>
      <table className="lines">
        <thead>
          <tr><th>#</th><th>type</th><th>cells</th><th>X</th><th>O</th><th>status</th></tr>
        </thead>
        <tbody>
          {ids.map((id) => {
            const st = lineStatus(board, LINES[id]);
            return (
              <tr key={id} className={`st-${st.state}`}>
                <td>{id}</td>
                <td>{describeDirection(LINES[id].dir)}</td>
                <td className="mono">{LINES[id].cells.map((c) => toCoord(c).join('')).join(' ')}</td>
                <td>{st.x}</td>
                <td>{st.o}</td>
                <td>{st.state === 'X' || st.state === 'O' ? `${st.state} only` : st.state}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

function MoveList() {
  const moves = useStore((s) => s.moves);
  const select = useStore((s) => s.select);
  return (
    <section>
      <h2>Moves <small>{moves.length}</small></h2>
      {moves.length === 0 ? (
        <p className="note">No moves yet. X goes first.</p>
      ) : (
        <ol className="moves">
          {moves.map((m, k) => (
            <li key={k} onClick={() => select(m)}>
              <Mark p={k % 2 === 0 ? 1 : 2} /> {fmt(m)} <small>#{m}</small>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function SaveLoad() {
  const [text, setText] = useState('');
  const [msg, setMsg] = useState('');
  const loadMoves = useStore((s) => s.loadMoves);
  const exportJson = () => {
    const { moves, game } = useStore.getState();
    const json = JSON.stringify({ format: 'ttt-4x4x4', version: 1, moves, board: game.board }, null, 0);
    setText(json);
    navigator.clipboard?.writeText(json).then(
      () => setMsg('Copied to clipboard.'),
      () => setMsg('Exported below.'),
    );
  };
  const importJson = () => {
    try {
      const data = JSON.parse(text);
      const moves = Array.isArray(data) ? data : data.moves;
      if (!Array.isArray(moves)) throw new Error('Expected { "moves": [...] } or an array of indices');
      loadMoves(moves);
      setMsg(`Loaded ${moves.length} moves.`);
    } catch (e) {
      setMsg(`Import failed: ${(e as Error).message}`);
    }
  };
  return (
    <section>
      <h2>Save / load</h2>
      <div className="row">
        <button onClick={exportJson}>Export JSON</button>
        <button onClick={importJson} disabled={!text.trim()}>Import JSON</button>
        <span className="note">{msg}</span>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder='{"moves":[21,42,22,...]}'
        rows={3}
        spellCheck={false}
      />
    </section>
  );
}
