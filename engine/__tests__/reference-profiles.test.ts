// ─────────────────────────────────────────────────────────────────────────────
// Regression fixture for the three reference profiles (spec Section 12).
//
// Cross-checking against Subsurface (the reference implementation) is the
// validation arbiter. Subsurface cannot run in this environment, so this fixture:
//   1. computes all three profiles and prints a results table (the M1 deliverable),
//   2. asserts STRUCTURAL sanity (monotonic ascent, stop alignment, switch depths,
//      fresh ≠ salt), and
//   3. SNAPSHOTS the engine's output as the regression baseline so it cannot
//      silently drift (spec 12).
//
// The ±tolerance comparison AGAINST Subsurface (stops exact; per-stop ±1 min;
// TTS ±2 min) is wired below via SUBSURFACE_REFERENCE. Drop Subsurface's numbers
// in and the tolerance assertions activate automatically; any systematic offset
// and its cause must then be documented here.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { runEngine } from '../index';
import type { EngineInput, GFResult, GasMix } from '../types';
import { DEFAULT_ENV } from '../types';

// ── Gas definitions ──────────────────────────────────────────────────────────
const AIR: GasMix = { id: 'air', name: 'Air', fO2: 0.21, fHe: 0, role: 'bottom' };
const TX1845: GasMix = { id: 'tx1845', name: 'Tx 18/45', fO2: 0.18, fHe: 0.45, role: 'bottom' };
const TX2135: GasMix = { id: 'tx2135', name: 'Tx 21/35', fO2: 0.21, fHe: 0.35, role: 'bottom' };
const EAN50: GasMix = { id: 'ean50', name: 'EAN50', fO2: 0.5, fHe: 0, role: 'deco' };
const O2: GasMix = { id: 'o2', name: 'O2', fO2: 1.0, fHe: 0, role: 'deco' };

// ── The three reference profiles (spec Section 12) ──────────────────────────
const PROFILE_1: EngineInput = {
  segments: [{ id: 's1', depth: 45, time: 25, gasId: 'air' }],
  gases: [AIR],
  gfSets: [{ id: 'gf', name: '30/70', gfLow: 0.3, gfHigh: 0.7 }],
  env: { ...DEFAULT_ENV, water: 'salt' },
};

const PROFILE_2: EngineInput = {
  segments: [{ id: 's1', depth: 60, time: 20, gasId: 'tx1845' }],
  gases: [TX1845, EAN50, O2],
  gfSets: [{ id: 'gf', name: '30/85', gfLow: 0.3, gfHigh: 0.85 }],
  env: { ...DEFAULT_ENV, water: 'salt' },
};

const PROFILE_3: EngineInput = {
  segments: [{ id: 's1', depth: 50, time: 30, gasId: 'tx2135' }],
  gases: [TX2135, EAN50],
  gfSets: [{ id: 'gf', name: '40/75', gfLow: 0.4, gfHigh: 0.75 }],
  env: { ...DEFAULT_ENV, water: 'fresh' },
};

// ── Subsurface reference values — FILL IN after running Subsurface ───────────
// Tolerances (spec 12): stop depths exact; per-stop time ±1 min; TTS ±2 min.
type SubsurfaceRef = {
  firstStopDepth: number;
  stops: { depth: number; duration: number }[];
  tts: number;
};
const SUBSURFACE_REFERENCE: Record<string, SubsurfaceRef | null> = {
  'Profile 1 — Air 45m/25min, GF 30/70, salt': null,
  'Profile 2 — Tx18/45 60m/20min, EAN50+O2, GF 30/85, salt': null,
  'Profile 3 — Tx21/35 50m/30min, EAN50, GF 40/75, fresh': null,
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function stopSchedule(r: GFResult): string {
  if (r.stops.length === 0) return '(no stops)';
  return r.stops.map((s) => `${s.depth}m→${s.duration}`).join(', ');
}

function summarize(label: string, r: GFResult): Record<string, string | number> {
  return {
    Profile: label,
    'First stop (m)': r.firstStopDepth,
    'Total deco (min)': r.totalDecoTime,
    'TTS (min)': round1(r.tts),
    'Runtime (min)': round1(r.runtime),
    'Stop schedule (depth→min)': stopSchedule(r),
  };
}

function assertStructuralSanity(r: GFResult, env: EngineInput['env']): void {
  const inc = env!.stopIncrement;
  const last = env!.lastStopDepth;

  // Profile is time-monotonic.
  for (let i = 1; i < r.profile.length; i++) {
    expect(r.profile[i]!.time).toBeGreaterThanOrEqual(r.profile[i - 1]!.time - 1e-9);
  }
  // Reaches the surface.
  expect(r.profile.at(-1)!.depth).toBeCloseTo(0, 6);

  if (r.firstStopDepth > 0) {
    // First stop is a positive multiple of the increment.
    expect(r.firstStopDepth % inc).toBeCloseTo(0, 9);
    // Stops are strictly shallowing, increment-aligned, none deeper than first stop,
    // none shallower than the last-stop depth.
    let prev = Infinity;
    for (const s of r.stops) {
      expect(s.depth % inc).toBeCloseTo(0, 9);
      expect(s.depth).toBeLessThan(prev);
      expect(s.depth).toBeLessThanOrEqual(r.firstStopDepth);
      expect(s.depth).toBeGreaterThanOrEqual(last);
      expect(s.duration).toBeGreaterThan(0);
      prev = s.depth;
    }
    // The shallowest recorded stop is the last-stop depth (the 3 m stop clears at GF_high).
    if (r.stops.length > 0) expect(r.stops.at(-1)!.depth).toBe(last);
  }

  // TTS and totalDecoTime are consistent and non-negative.
  expect(r.tts).toBeGreaterThan(0);
  expect(r.totalDecoTime).toBeGreaterThanOrEqual(0);
  expect(r.tts).toBeGreaterThanOrEqual(r.totalDecoTime - 1e-9);
}

function compareToSubsurface(label: string, r: GFResult): void {
  const ref = SUBSURFACE_REFERENCE[label];
  if (!ref) {
    // eslint-disable-next-line no-console
    console.warn(`  ⚠ No Subsurface reference for "${label}" yet — tolerance check skipped.`);
    return;
  }
  expect(r.firstStopDepth, 'first stop depth must match exactly').toBe(ref.firstStopDepth);
  expect(r.stops.map((s) => s.depth), 'stop depths must match exactly').toEqual(
    ref.stops.map((s) => s.depth),
  );
  for (let i = 0; i < ref.stops.length; i++) {
    expect(
      Math.abs(r.stops[i]!.duration - ref.stops[i]!.duration),
      `stop ${ref.stops[i]!.depth}m within ±1 min`,
    ).toBeLessThanOrEqual(1);
  }
  expect(Math.abs(r.tts - ref.tts), 'TTS within ±2 min').toBeLessThanOrEqual(2);
}

// ─────────────────────────────────────────────────────────────────────────────
describe('reference profiles (spec Section 12)', () => {
  const labels = [
    'Profile 1 — Air 45m/25min, GF 30/70, salt',
    'Profile 2 — Tx18/45 60m/20min, EAN50+O2, GF 30/85, salt',
    'Profile 3 — Tx21/35 50m/30min, EAN50, GF 40/75, fresh',
  ];
  const inputs = [PROFILE_1, PROFILE_2, PROFILE_3];
  const results = inputs.map((inp) => runEngine(inp).results[0]!);

  it('prints the results table', () => {
    const rows = results.map((r, i) => summarize(labels[i]!, r));
    // eslint-disable-next-line no-console
    console.log('\n========== GRADIENT FACTOR VISUALIZER — MILESTONE 1 RESULTS ==========');
    // eslint-disable-next-line no-console
    console.table(rows);
    for (let i = 0; i < results.length; i++) {
      // eslint-disable-next-line no-console
      console.log(`\n${labels[i]}`);
      // eslint-disable-next-line no-console
      console.log(`  first stop : ${results[i]!.firstStopDepth} m`);
      // eslint-disable-next-line no-console
      console.log(`  stops      : ${stopSchedule(results[i]!)}`);
      // eslint-disable-next-line no-console
      console.log(
        `  total deco : ${results[i]!.totalDecoTime} min   TTS: ${round1(results[i]!.tts)} min   runtime: ${round1(
          results[i]!.runtime,
        )} min`,
      );
    }
    expect(results).toHaveLength(3);
  });

  it('Profile 1 — Air 45/25 GF30/70 salt: structural sanity + baseline', () => {
    const r = results[0]!;
    assertStructuralSanity(r, PROFILE_1.env);
    compareToSubsurface(labels[0]!, r);
    expect({
      firstStop: r.firstStopDepth,
      stops: stopSchedule(r),
      totalDeco: r.totalDecoTime,
      tts: round1(r.tts),
    }).toMatchInlineSnapshot(`
      {
        "firstStop": 24,
        "stops": "21m→1, 18m→1, 15m→4, 12m→5, 9m→8, 6m→18, 3m→36",
        "totalDeco": 73,
        "tts": 78,
      }
    `);
  });

  it('Profile 2 — Tx18/45 60/20 EAN50+O2 GF30/85 salt: switches + baseline', () => {
    const r = results[1]!;
    assertStructuralSanity(r, PROFILE_2.env);
    // Trimix with ≥2 deco gas switches: EAN50 at 21 m, O2 at 6 m (acceptance criterion).
    const stopDepths = r.stops.map((s) => s.depth);
    expect(stopDepths).toContain(21); // EAN50 switch stop should carry deco time
    expect(stopDepths).toContain(6); // O2 switch stop should carry deco time
    compareToSubsurface(labels[1]!, r);
    expect({
      firstStop: r.firstStopDepth,
      stops: stopSchedule(r),
      totalDeco: r.totalDecoTime,
      tts: round1(r.tts),
    }).toMatchInlineSnapshot(`
      {
        "firstStop": 33,
        "stops": "27m→1, 24m→2, 21m→1, 18m→2, 15m→2, 12m→3, 9m→5, 6m→7, 3m→13",
        "totalDeco": 36,
        "tts": 42.7,
      }
    `);
  });

  it('Profile 3 — Tx21/35 50/30 EAN50 GF40/75 fresh: structural sanity + baseline', () => {
    const r = results[2]!;
    assertStructuralSanity(r, PROFILE_3.env);
    compareToSubsurface(labels[2]!, r);
    expect({
      firstStop: r.firstStopDepth,
      stops: stopSchedule(r),
      totalDeco: r.totalDecoTime,
      tts: round1(r.tts),
    }).toMatchInlineSnapshot(`
      {
        "firstStop": 24,
        "stops": "21m→1, 18m→2, 15m→2, 12m→4, 9m→5, 6m→10, 3m→20",
        "totalDeco": 44,
        "tts": 49.6,
      }
    `);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('acceptance: fresh vs salt measurably changes the schedule (spec 13)', () => {
  it('the same dive decompresses differently in fresh vs salt water', () => {
    const base: EngineInput = {
      segments: [{ id: 's1', depth: 45, time: 25, gasId: 'air' }],
      gases: [AIR],
      gfSets: [{ id: 'gf', name: '30/70', gfLow: 0.3, gfHigh: 0.7 }],
      env: { ...DEFAULT_ENV, water: 'salt' },
    };
    const salt = runEngine(base).results[0]!;
    const fresh = runEngine({ ...base, env: { ...DEFAULT_ENV, water: 'fresh' } }).results[0]!;
    // A measurable difference somewhere in the obligation.
    const differs =
      salt.firstStopDepth !== fresh.firstStopDepth ||
      salt.totalDecoTime !== fresh.totalDecoTime ||
      Math.abs(salt.tts - fresh.tts) > 1e-6;
    expect(differs).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('acceptance: lower GF is more conservative (spec 13)', () => {
  it('GF 30/70 requires at least as much deco as GF 85/85 for the same dive', () => {
    const base: EngineInput = {
      segments: [{ id: 's1', depth: 45, time: 25, gasId: 'air' }],
      gases: [AIR],
      gfSets: [
        { id: 'low', name: '30/70', gfLow: 0.3, gfHigh: 0.7 },
        { id: 'high', name: '85/85', gfLow: 0.85, gfHigh: 0.85 },
      ],
      env: { ...DEFAULT_ENV, water: 'salt' },
    };
    const { results } = runEngine(base);
    const conservative = results[0]!;
    const aggressive = results[1]!;
    expect(conservative.firstStopDepth).toBeGreaterThanOrEqual(aggressive.firstStopDepth);
    expect(conservative.tts).toBeGreaterThanOrEqual(aggressive.tts);
  });
});
