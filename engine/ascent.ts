// ─────────────────────────────────────────────────────────────────────────────
// Ascent / stop-finding algorithm + gas switching — spec Sections 4.9 & 4.10.
//
// Computes one GFResult for a single GF set over the shared exposure. The exposure
// (segments + gases + env) is identical across GF sets; only gfLow/gfHigh differ.
//
// CONVENTIONS (documented per spec "match Subsurface and document the choice"):
//  • GF evaluated at the NEXT/shallower stop. To leave a stop we test the ceiling
//    using GF(target_depth) — spec 4.9 step 3 ("evaluated for the shallower target
//    depth"). Matches Subsurface.
//  • First stop = GF_low ceiling rounded UP to the next stopIncrement (4.9 step 2);
//    it anchors the GF slope for the whole ascent.
//  • Stop time accrues in 1-minute granularity; only stops with ≥1 min are recorded.
//  • Gas switch happens on ARRIVAL at the switch stop (the hold there is on the new
//    gas); travel into a stop uses the gas active at the deeper stop. Switch depth =
//    MOD rounded to nearest stop (see gas.ts), with manual override. No artificial
//    mandatory switch-stop delay is added — the deco obligation governs the time.
// ─────────────────────────────────────────────────────────────────────────────

import { COMPARTMENT_COUNT } from './constants';
import { bestGasAtDepth } from './gas';
import { ceilingAtGF, gfAtDepth } from './mvalue';
import { applyConstantDepth, applyDepthChange, cloneTissue, initialTissueState } from './tissue';
import type {
  CeilingPoint,
  EnvironmentConfig,
  GFResult,
  GFSet,
  GasMix,
  LoadingPoint,
  ProfilePoint,
  StopEntry,
  TissueState,
} from './types';

const TRAVEL_SUBSTEP_MIN = 0.1; // travel integration granularity (spec 4.9)
const STOP_STEP_MIN = 1; // stop hold granularity (spec 4.9)
const EPS = 1e-6;
const MAX_STOP_MINUTES = 100000; // safety cap against a runaway stop loop

/** One recorded instant of the dive: time, depth and a tissue snapshot. The
 *  ceiling/loading timelines are derived from these once first_stop_depth is
 *  known (so the GF slope can be applied consistently). */
type Sample = { time: number; depth: number; tissue: TissueState };

/** Internal mutable integration context threaded through the phases. */
type Ctx = {
  state: TissueState;
  clock: number;
  depth: number;
  samples: Sample[];
  env: EnvironmentConfig;
};

function record(ctx: Ctx): void {
  ctx.samples.push({ time: ctx.clock, depth: ctx.depth, tissue: cloneTissue(ctx.state) });
}

/** Travel from current depth to `toDepth` at the given rate (m/min, positive),
 *  breathing `gas`, sub-sampling at TRAVEL_SUBSTEP_MIN. Schreiner is exact for a
 *  constant rate, so sub-stepping only adds timeline resolution. */
function travelTo(ctx: Ctx, toDepth: number, rateMPerMin: number, gas: GasMix): void {
  const fromDepth = ctx.depth;
  if (Math.abs(toDepth - fromDepth) < EPS) return;
  const totalTime = Math.abs(toDepth - fromDepth) / rateMPerMin;
  const steps = Math.max(1, Math.ceil(totalTime / TRAVEL_SUBSTEP_MIN));
  for (let s = 0; s < steps; s++) {
    const t0 = (s / steps) * totalTime;
    const t1 = ((s + 1) / steps) * totalTime;
    const d0 = fromDepth + ((toDepth - fromDepth) * t0) / totalTime;
    const d1 = fromDepth + ((toDepth - fromDepth) * t1) / totalTime;
    ctx.state = applyDepthChange(ctx.state, d0, d1, t1 - t0, gas, ctx.env);
    ctx.clock += t1 - t0;
    ctx.depth = d1;
    record(ctx);
  }
  ctx.depth = toDepth;
}

/** Hold at the current depth for `minutes`, breathing `gas`, sampling at
 *  STOP_STEP_MIN. Returns nothing; mutates ctx. */
function holdFor(ctx: Ctx, minutes: number, gas: GasMix): void {
  let remaining = minutes;
  while (remaining > EPS) {
    const step = Math.min(STOP_STEP_MIN, remaining);
    ctx.state = applyConstantDepth(ctx.state, ctx.depth, step, gas, ctx.env);
    ctx.clock += step;
    remaining -= step;
    record(ctx);
  }
}

/**
 * Compute one GFResult for a single GF set over the shared exposure.
 *
 * @param segments ordered dive segments (fixed exposure)
 * @param gases    bottom + deco gases
 * @param gfSet    the GF Low/High pair for this result
 * @param env      environment config (already merged with defaults)
 */
export function computeProfileForGFSet(
  segments: import('./types').DiveSegment[],
  gases: GasMix[],
  gfSet: GFSet,
  env: EnvironmentConfig,
): GFResult {
  const gasById = new Map(gases.map((g) => [g.id, g] as const));
  const ctx: Ctx = {
    state: initialTissueState(env),
    clock: 0,
    depth: 0,
    samples: [],
    env,
  };
  record(ctx); // t=0 at the surface

  // ── 1. Descent + bottom (and any multi-level legs) ────────────────────────
  for (const seg of segments) {
    const gas = gasById.get(seg.gasId);
    if (!gas) throw new Error(`computeProfileForGFSet: unknown gasId "${seg.gasId}"`);
    if (Math.abs(seg.depth - ctx.depth) > EPS) {
      const descending = seg.depth > ctx.depth;
      const rate = descending ? env.descentRate : env.ascentRate;
      travelTo(ctx, seg.depth, rate, gas);
    }
    if (seg.time > 0) holdFor(ctx, seg.time, gas);
  }

  const leaveBottomTime = ctx.clock;

  // ── 2. First stop: GF_low-limited ceiling, rounded UP to a stop ───────────
  const cLow = ceilingAtGF(ctx.state, gfSet.gfLow, env);
  let firstStopDepth = 0;
  if (cLow.ceilingDepth > EPS) {
    firstStopDepth = Math.ceil(cLow.ceilingDepth / env.stopIncrement - EPS) * env.stopIncrement;
  }

  const stops: StopEntry[] = [];

  if (firstStopDepth <= EPS) {
    // No decompression obligation — ascend straight to the surface.
    travelTo(ctx, 0, env.ascentRate, bestGasAtDepth(ctx.depth, gases, env));
  } else {
    // ── 3. Ascend to the first stop, then stop-to-stop to the last stop ─────
    travelTo(ctx, firstStopDepth, env.ascentRate, bestGasAtDepth(ctx.depth, gases, env));

    // Build the ordered list of stop depths: first → … → lastStopDepth.
    const stopDepths: number[] = [];
    for (let d = firstStopDepth; d >= env.lastStopDepth - EPS; d -= env.stopIncrement) {
      stopDepths.push(Number(d.toFixed(6)));
    }

    for (let i = 0; i < stopDepths.length; i++) {
      const stopDepth = stopDepths[i]!;
      const target = i + 1 < stopDepths.length ? stopDepths[i + 1]! : 0; // surface after last stop
      const gas = bestGasAtDepth(stopDepth, gases, env); // switch applied on arrival
      const gfTarget = gfAtDepth(target, firstStopDepth, gfSet.gfLow, gfSet.gfHigh);

      // Hold (1-min steps) until the GF(target) ceiling permits ascending to target.
      let minutes = 0;
      while (true) {
        const c = ceilingAtGF(ctx.state, gfTarget, env);
        if (c.ceilingDepth <= target + EPS) break;
        holdFor(ctx, STOP_STEP_MIN, gas);
        minutes += STOP_STEP_MIN;
        if (minutes > MAX_STOP_MINUTES) {
          throw new Error(`Stop at ${stopDepth} m did not clear within cap — check inputs`);
        }
      }
      if (minutes > 0) stops.push({ depth: stopDepth, duration: minutes });

      // Travel to the next target on the gas active at this (deeper) stop.
      travelTo(ctx, target, env.ascentRate, gas);
    }
  }

  const runtime = ctx.clock;
  const tts = runtime - leaveBottomTime;
  const totalDecoTime = stops.reduce((sum, s) => sum + s.duration, 0);

  // ── 4. Derive output timelines from the samples ───────────────────────────
  const profile: ProfilePoint[] = ctx.samples.map((s) => ({ time: s.time, depth: s.depth }));
  const ceilingTimeline: CeilingPoint[] = [];
  const loadingTimeline: LoadingPoint[] = [];
  for (const s of ctx.samples) {
    const gf = gfAtDepth(s.depth, firstStopDepth, gfSet.gfLow, gfSet.gfHigh);
    const c = ceilingAtGF(s.tissue, gf, env);
    ceilingTimeline.push({ time: s.time, ceiling: Math.max(0, c.ceilingDepth) });
    const compartments = new Array(COMPARTMENT_COUNT).fill(null).map((_, i) => ({
      pN2: s.tissue.pN2[i]!,
      pHe: s.tissue.pHe[i]!,
    }));
    loadingTimeline.push({ time: s.time, compartments, controlling: c.controlling });
  }

  return {
    gfSetId: gfSet.id,
    profile,
    stops,
    firstStopDepth,
    totalDecoTime,
    tts,
    runtime,
    ceilingTimeline,
    loadingTimeline,
  };
}
