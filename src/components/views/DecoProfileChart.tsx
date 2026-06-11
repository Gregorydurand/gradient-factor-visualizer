// View 1 — Deco profile comparison (spec §7, priority 1). Depth (Y, increasing
// downward) vs runtime (X, minutes), with up to 3 GF-set curves overlaid on
// shared axes. The descent + bottom phase is identical across sets; the curves
// diverge only on ascent. Stops fall out of the engine data as horizontal
// plateaus. Hover/scrub reads out depth, runtime and current stop per set.
//
// Bespoke SVG with hand-rolled linear scales (src/viz) — no chart library, in
// keeping with the dependency-minimal, instrument aesthetic (spec §10). The
// global scrubber that links Views 2–4 is Milestone 5; this view's hover is local.
import { useEffect, useRef, useState } from 'react';
import type { GFResult } from '../../../engine';
import { gfSetLabel } from '../../gfLabel';
import { useEngineResults } from '../../store/useEngineResults';
import { useStore } from '../../store/useStore';
import { assignGFColors } from '../../theme/gfColors';
import { depthToDisplay, depthUnitLabel } from '../../units';
import { round } from '../../util';
import { currentStopAtTime, depthAtTime } from '../../viz/profile';
import { linearScale, niceTicks } from '../../viz/scale';

const HEIGHT = 440;
const M = { top: 18, right: 18, bottom: 34, left: 46 }; // plot margins

/** Measure a container's width so the SVG can be drawn at crisp device pixels
 *  (no viewBox scaling) and pointer-x maps straight to plot coordinates. */
function useMeasuredWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => setWidth(entries[0]?.contentRect.width ?? 0));
    ro.observe(el);
    setWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

export function DecoProfileChart() {
  const res = useEngineResults();
  const gfSets = useStore((s) => s.gfSets);
  const units = useStore((s) => s.units);
  const [wrapRef, width] = useMeasuredWidth<HTMLDivElement>();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoverTime, setHoverTime] = useState<number | null>(null);

  if (!res.ok) {
    return <div className="viz-card viz-error">⚠ Engine error — {res.error}</div>;
  }

  const results = res.results;
  const colors = assignGFColors(gfSets);
  const du = depthUnitLabel(units);
  const toDisp = (m: number) => depthToDisplay(m, units);

  // Shared domains: descent reaches the same bottom and the runs end on surfacing.
  const maxTime = Math.max(1, ...results.map((r) => r.profile.at(-1)?.time ?? 0));
  const maxDepthM = Math.max(1, ...results.flatMap((r) => r.profile.map((p) => p.depth)));
  const maxDepthDisp = toDisp(maxDepthM);

  const plotW = Math.max(0, width - M.left - M.right);
  const x = linearScale([0, maxTime], [M.left, M.left + plotW]);
  const y = linearScale([0, maxDepthDisp], [M.top, HEIGHT - M.bottom]); // depth downward

  const xTicks = niceTicks(0, maxTime, 8);
  const yTicks = niceTicks(0, maxDepthDisp, 6);

  const pathFor = (r: GFResult) =>
    r.profile.map((p, i) => `${i === 0 ? 'M' : 'L'}${x.map(p.time)},${y.map(toDisp(p.depth))}`).join('');

  const onMove = (e: React.PointerEvent) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = e.clientX - rect.left;
    if (px < M.left || px > M.left + plotW) return setHoverTime(null);
    setHoverTime(Math.min(maxTime, Math.max(0, x.invert(px))));
  };

  const cursorX = hoverTime !== null ? x.map(hoverTime) : 0;
  const flip = cursorX > M.left + plotW * 0.62; // keep the readout on-canvas

  return (
    <div className="viz-card">
      <header className="viz-head">
        <span className="viz-title">Deco profile</span>
        <span className="viz-axis-note">depth ({du}) · runtime (min)</span>
      </header>

      <div className="chart" ref={wrapRef} style={{ height: HEIGHT }}>
        {width > 0 && (
          <svg
            ref={svgRef}
            className="chart-svg"
            width={width}
            height={HEIGHT}
            onPointerMove={onMove}
            onPointerLeave={() => setHoverTime(null)}
          >
            {/* gridlines + axis labels */}
            <g className="grid">
              {yTicks.map((t) => (
                <g key={`y${t}`}>
                  <line x1={M.left} x2={M.left + plotW} y1={y.map(t)} y2={y.map(t)} />
                  <text className="tick-label" x={M.left - 8} y={y.map(t)} dy="0.32em" textAnchor="end">
                    {t}
                  </text>
                </g>
              ))}
              {xTicks.map((t) => (
                <g key={`x${t}`}>
                  <line x1={x.map(t)} x2={x.map(t)} y1={M.top} y2={HEIGHT - M.bottom} />
                  <text className="tick-label" x={x.map(t)} y={HEIGHT - M.bottom + 16} textAnchor="middle">
                    {t}
                  </text>
                </g>
              ))}
            </g>

            {/* GF-set curves */}
            {results.map((r) => (
              <path
                key={r.gfSetId}
                className="profile-curve"
                d={pathFor(r)}
                fill="none"
                stroke={colors[r.gfSetId] ?? 'var(--gf-1)'}
              />
            ))}

            {/* hover cursor + per-set markers */}
            {hoverTime !== null && (
              <g className="cursor" pointerEvents="none">
                <line x1={cursorX} x2={cursorX} y1={M.top} y2={HEIGHT - M.bottom} />
                {results.map((r) => (
                  <circle
                    key={r.gfSetId}
                    r={3.5}
                    cx={cursorX}
                    cy={y.map(toDisp(depthAtTime(r.profile, hoverTime)))}
                    fill={colors[r.gfSetId] ?? 'var(--gf-1)'}
                  />
                ))}
              </g>
            )}
          </svg>
        )}

        {/* floating hover read-out (HTML overlay) */}
        {hoverTime !== null && (
          <div
            className={'chart-readout' + (flip ? ' is-flipped' : '')}
            style={{ left: cursorX }}
          >
            <div className="chart-readout-time tabular">{round(hoverTime, 1)} min</div>
            {results.map((r) => {
              const depth = depthAtTime(r.profile, hoverTime);
              const stop = currentStopAtTime(r.profile, r.stops, hoverTime);
              return (
                <div className="chart-readout-row" key={r.gfSetId}>
                  <span className="dot" style={{ background: colors[r.gfSetId] ?? 'var(--gf-1)' }} />
                  <span className="chart-readout-name">{gfSetLabel(gfSets.find((g) => g.id === r.gfSetId)!)}</span>
                  <span className="tabular chart-readout-depth">
                    {round(toDisp(depth))} {du}
                  </span>
                  <span className="chart-readout-stop">
                    {stop ? `@${round(toDisp(stop.depth))} ${du}` : '—'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* legend: name + key metrics per set (spec §7) */}
      <ul className="viz-legend">
        {results.map((r) => (
          <li className="viz-legend-item" key={r.gfSetId}>
            <span className="dot" style={{ background: colors[r.gfSetId] ?? 'var(--gf-1)' }} />
            <span className="viz-legend-name">{gfSetLabel(gfSets.find((g) => g.id === r.gfSetId)!)}</span>
            <span className="viz-legend-metrics tabular">
              first {r.firstStopDepth > 0 ? `${round(toDisp(r.firstStopDepth))} ${du}` : 'none'}
              {' · '}deco {round(r.totalDecoTime)} min
              {' · '}TTS {round(r.tts, 1)} min
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
