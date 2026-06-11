// View 1 — Deco profile comparison (spec §7, priority 1). Depth (Y, downward) vs
// runtime (X), up to 3 GF-set curves overlaid on shared axes. The descent + bottom
// phase is identical across sets; the curves diverge only on ascent, with stops as
// horizontal plateaus. Hover reads out depth, runtime and current stop per set.
//
// All the axis/grid/hover scaffolding lives in TimeDepthChart; this view just
// supplies the curves, markers, read-out rows and legend.
import type { GFResult } from '../../../engine';
import { gfSetLabel } from '../../gfLabel';
import { round } from '../../util';
import { currentStopAtTime, depthAtTime } from '../../viz/profile';
import { TimeDepthChart, type ChartCtx } from './TimeDepthChart';

const pathFor = (r: GFResult, c: ChartCtx) =>
  r.profile
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${c.x.map(p.time)},${c.y.map(c.toDisp(p.depth))}`)
    .join('');

export function DecoProfileChart() {
  return (
    <TimeDepthChart
      title="Deco profile"
      renderPlot={(c) => (
        <>
          {c.results.map((r) => (
            <path
              key={r.gfSetId}
              className="profile-curve"
              d={pathFor(r, c)}
              fill="none"
              stroke={c.colors[r.gfSetId] ?? 'var(--gf-1)'}
            />
          ))}
          {c.results.map((r) => (
            <circle
              key={r.gfSetId}
              className="hover-dot"
              r={3.5}
              cx={c.x.map(c.time)}
              cy={c.y.map(c.toDisp(depthAtTime(r.profile, c.time)))}
              fill={c.colors[r.gfSetId] ?? 'var(--gf-1)'}
            />
          ))}
        </>
      )}
      renderReadout={(c) => {
        const t = c.time;
        return (
          <>
            <div className="chart-readout-time tabular">{round(t, 1)} min</div>
            {c.results.map((r) => {
              const stop = currentStopAtTime(r.profile, r.stops, t);
              return (
                <div className="chart-readout-row" key={r.gfSetId}>
                  <span className="dot" style={{ background: c.colors[r.gfSetId] ?? 'var(--gf-1)' }} />
                  <span className="chart-readout-name">
                    {gfSetLabel(c.gfSets.find((g) => g.id === r.gfSetId)!)}
                  </span>
                  <span className="tabular chart-readout-depth">
                    {round(c.toDisp(depthAtTime(r.profile, t)))} {c.du}
                  </span>
                  <span className="chart-readout-stop">
                    {stop ? `@${round(c.toDisp(stop.depth))} ${c.du}` : '—'}
                  </span>
                </div>
              );
            })}
          </>
        );
      }}
      renderLegend={(c) =>
        c.results.map((r) => (
          <li className="viz-legend-item" key={r.gfSetId}>
            <span className="dot" style={{ background: c.colors[r.gfSetId] ?? 'var(--gf-1)' }} />
            <span className="viz-legend-name">{gfSetLabel(c.gfSets.find((g) => g.id === r.gfSetId)!)}</span>
            <span className="viz-legend-metrics tabular">
              first {r.firstStopDepth > 0 ? `${round(c.toDisp(r.firstStopDepth))} ${c.du}` : 'none'}
              {' · '}deco {round(r.totalDecoTime)} min
              {' · '}TTS {round(r.tts, 1)} min
            </span>
          </li>
        ))
      }
    />
  );
}
