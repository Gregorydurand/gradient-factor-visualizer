// Outputs table (spec §8) — a compact, one-column-per-GF-set readout beside the
// graphs: first stop, total decompression time, time-to-surface, runtime, and the
// full stop schedule. Figures are tabular/monospace so the columns align like an
// instrument. Reads the same GFResult[] the chart does; surfaces an engine error
// instead of crashing on a half-edited input.
import { gfSetLabel } from '../gfLabel';
import { useEngineResults } from '../store/useEngineResults';
import { useStore } from '../store/useStore';
import { assignGFColors } from '../theme/gfColors';
import { depthToDisplay, depthUnitLabel } from '../units';
import { round } from '../util';

export function OutputsTable() {
  const gfSets = useStore((s) => s.gfSets);
  const units = useStore((s) => s.units);
  const res = useEngineResults();

  if (!res.ok) {
    return <div className="viz-card viz-error">⚠ Engine error — {res.error}</div>;
  }

  const results = res.results;
  const colors = assignGFColors(gfSets);
  const du = depthUnitLabel(units);
  const depth = (m: number) => `${round(depthToDisplay(m, units))} ${du}`;
  const setById = new Map(gfSets.map((g) => [g.id, g]));

  return (
    <div className="viz-card">
      <header className="viz-head">
        <span className="viz-title">Outputs</span>
        <span className="viz-axis-note">per GF set</span>
      </header>

      <table className="outputs">
        <thead>
          <tr>
            <th scope="col" className="outputs-corner" />
            {results.map((r) => (
              <th scope="col" key={r.gfSetId} style={{ color: colors[r.gfSetId] ?? 'var(--gf-1)' }}>
                <span className="dot" style={{ background: colors[r.gfSetId] ?? 'var(--gf-1)' }} />
                {gfSetLabel(setById.get(r.gfSetId)!)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">First stop</th>
            {results.map((r) => (
              <td className="tabular" key={r.gfSetId}>{r.firstStopDepth > 0 ? depth(r.firstStopDepth) : 'none'}</td>
            ))}
          </tr>
          <tr>
            <th scope="row">Total deco</th>
            {results.map((r) => (
              <td className="tabular" key={r.gfSetId}>{round(r.totalDecoTime)} min</td>
            ))}
          </tr>
          <tr>
            <th scope="row">TTS</th>
            {results.map((r) => (
              <td className="tabular" key={r.gfSetId}>{round(r.tts, 1)} min</td>
            ))}
          </tr>
          <tr>
            <th scope="row">Runtime</th>
            {results.map((r) => (
              <td className="tabular" key={r.gfSetId}>{round(r.runtime, 1)} min</td>
            ))}
          </tr>
          <tr className="outputs-schedule">
            <th scope="row">Stops<span className="outputs-sub">depth → min</span></th>
            {results.map((r) => (
              <td className="tabular" key={r.gfSetId}>
                {r.stops.length > 0 ? (
                  <ul className="outputs-stops">
                    {r.stops.map((s, i) => (
                      <li key={i}>
                        <span className="outputs-stop-depth">{depth(s.depth)}</span>
                        <span className="outputs-stop-arrow">→</span>
                        <span className="outputs-stop-min">{s.duration}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="outputs-none">no stops</span>
                )}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
