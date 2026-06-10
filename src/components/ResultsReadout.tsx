// PROVISIONAL Milestone-2 read-out so the state→engine wiring is visibly live.
// The real outputs table (spec §8) is Milestone 3; this is a deliberate stand-in
// that proves recompute works as inputs change. Surfaces engine errors instead of
// crashing (a half-edited input shouldn't take the app down).
import { useStore } from '../store/useStore';
import { useEngineResults } from '../store/useEngineResults';
import { assignGFColors } from '../theme/gfColors';
import { depthToDisplay, depthUnitLabel } from '../units';
import { round } from '../util';

export function ResultsReadout() {
  const gfSets = useStore((s) => s.gfSets);
  const units = useStore((s) => s.units);
  const res = useEngineResults();
  const colors = assignGFColors(gfSets);
  const du = depthUnitLabel(units);
  const nameById = new Map(
    gfSets.map((g) => [g.id, g.name?.trim() || `${round(g.gfLow * 100)}/${round(g.gfHigh * 100)}`]),
  );

  if (!res.ok) {
    return <div className="readout readout--error">⚠ Engine error — {res.error}</div>;
  }

  return (
    <section className="readout">
      <header className="readout-head">
        <span className="readout-title">Live results</span>
        <span className="readout-note">provisional — the full outputs table arrives in Milestone 3</span>
      </header>
      <div className="readout-grid">
        {res.results.map((r) => {
          const color = colors[r.gfSetId] ?? 'var(--gf-1)';
          const name = nameById.get(r.gfSetId) ?? r.gfSetId;
          return (
            <article className="readout-card" key={r.gfSetId} style={{ borderTopColor: color }}>
              <div className="readout-card-name" style={{ color }}>
                {name}
              </div>
              <dl className="readout-metrics">
                <div>
                  <dt>First stop</dt>
                  <dd className="tabular">
                    {r.firstStopDepth > 0
                      ? `${round(depthToDisplay(r.firstStopDepth, units))} ${du}`
                      : 'none'}
                  </dd>
                </div>
                <div>
                  <dt>Total deco</dt>
                  <dd className="tabular">{round(r.totalDecoTime)} min</dd>
                </div>
                <div>
                  <dt>TTS</dt>
                  <dd className="tabular">{round(r.tts, 1)} min</dd>
                </div>
                <div>
                  <dt>Runtime</dt>
                  <dd className="tabular">{round(r.runtime, 1)} min</dd>
                </div>
              </dl>
              <div className="readout-stops tabular">
                {r.stops.length > 0
                  ? r.stops
                      .map((s) => `${round(depthToDisplay(s.depth, units))}→${s.duration}`)
                      .join('   ')
                  : 'no decompression stops'}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
