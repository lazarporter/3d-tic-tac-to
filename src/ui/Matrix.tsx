import { useState } from 'react';
import { CELL_LINES, N, PLAYER_LABEL, toIndex, toNested, type CellValue } from '../game/engine';
import { isVisible, useStore } from '../store';

type Tab = 'layers' | 'nested' | 'flat';

export function Matrix() {
  const [tab, setTab] = useState<Tab>('layers');
  return (
    <section>
      <div className="section-head">
        <h2>Board as arrays</h2>
        <div className="tabs">
          {(['layers', 'nested', 'flat'] as Tab[]).map((t) => (
            <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
              {t}
            </button>
          ))}
        </div>
      </div>
      {tab === 'layers' && <LayerTables />}
      {tab === 'nested' && <Nested />}
      {tab === 'flat' && <Flat />}
    </section>
  );
}

/** Shared per-cell highlight classes, so tables and the 3D view highlight the same cells. */
function useCellClass() {
  const hover = useStore((s) => s.hover);
  const selected = useStore((s) => s.selected);
  const win = useStore((s) => s.game.winLine);
  const guides = useStore((s) => s.guides);
  const isolate = useStore((s) => s.isolate);
  const focus = hover ?? selected;
  return (i: number) => {
    const cls: string[] = [];
    if (i === hover) cls.push('hover');
    if (i === selected) cls.push('selected');
    if (win?.cells.includes(i)) cls.push('win');
    if (guides && focus !== null && focus !== i && CELL_LINES[focus].some((id) => CELL_LINES[i].includes(id)))
      cls.push('guide');
    if (!isVisible(i, isolate)) cls.push('dim');
    return cls.join(' ');
  };
}

function useCellHandlers(i: number) {
  const setHover = useStore((s) => s.setHover);
  const clickCell = useStore((s) => s.clickCell);
  return {
    onMouseEnter: () => setHover(i),
    onMouseLeave: () => useStore.getState().hover === i && setHover(null),
    onClick: () => clickCell(i),
  };
}

function TableCell({ i, v, cls, showIndex }: { i: number; v: CellValue; cls: string; showIndex?: boolean }) {
  const h = useCellHandlers(i);
  return (
    <td className={`cell v${v} ${cls}`} {...h} title={`index ${i}`}>
      {showIndex ? <><b>{v}</b><small>{i}</small></> : PLAYER_LABEL[v]}
    </td>
  );
}

function LayerTables() {
  const board = useStore((s) => s.game.board);
  const cellClass = useCellClass();
  return (
    <>
      <p className="note">
        <code>board[z][y][x]</code>: one 4×4 table per layer. Rows are <code>y</code>, columns are <code>x</code>.
        Hover or click here or in 3D.
      </p>
      <div className="layers">
        {Array.from({ length: N }, (_, z) => (
          <div key={z} className="layer">
            <div className="layer-title">z = {z}{z === 0 ? ' (bottom)' : z === N - 1 ? ' (top)' : ''}</div>
            <table>
              <thead>
                <tr>
                  <th />
                  {Array.from({ length: N }, (_, x) => <th key={x}>x{x}</th>)}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: N }, (_, y) => (
                  <tr key={y}>
                    <th>y{y}</th>
                    {Array.from({ length: N }, (_, x) => {
                      const i = toIndex(x, y, z);
                      return <TableCell key={x} i={i} v={board[i]} cls={cellClass(i)} />;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </>
  );
}

function Nested() {
  const board = useStore((s) => s.game.board);
  const nested = toNested(board);
  const text =
    '[\n' +
    nested
      .map(
        (layer, z) =>
          `  [ // z=${z}\n` + layer.map((row) => `    [${row.join(', ')}]`).join(',\n') + `\n  ]`,
      )
      .join(',\n') +
    '\n]';
  return (
    <>
      <p className="note">
        Nested array <code>board[z][y][x]</code>. <code>0</code> = empty, <code>1</code> = X, <code>2</code> = O.
      </p>
      <pre className="code">{text}</pre>
    </>
  );
}

function Flat() {
  const board = useStore((s) => s.game.board);
  const cellClass = useCellClass();
  return (
    <>
      <p className="note">
        Flat <code>Int8Array(64)</code>, index = <code>x + 4·y + 16·z</code>. Each row below is one layer (16 cells).
      </p>
      <table className="flat">
        <tbody>
          {Array.from({ length: N }, (_, z) => (
            <tr key={z}>
              <th>z{z}</th>
              {Array.from({ length: N * N }, (_, k) => {
                const i = z * N * N + k;
                return <TableCell key={i} i={i} v={board[i]} cls={cellClass(i)} showIndex />;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
