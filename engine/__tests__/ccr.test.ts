// CCR (closed-circuit rebreather) engine tests — the breathing model + a smoke test.
// The deco model is shared with OC (covered by engine.test.ts + reference-profiles);
// here we pin the CCR inspired-gas formula and that a CCR dive runs and differs from OC.
//
// TODO(validation): add Subsurface CCR reference profiles as a regression fixture
// once the user supplies the schedules — mirrors reference-profiles.test.ts for OC.
import { describe, expect, it } from 'vitest';
import { ccrBreathing, constants, depthToPressure, runEngine } from '../index';
import { DEFAULT_ENV } from '../types';
import type { EnvironmentConfig, GFSet, GasMix } from '../types';

const env = { ...DEFAULT_ENV };
const P_H2O = constants.P_H2O;

const air: GasMix = { id: 'air', name: 'Air', fO2: 0.21, fHe: 0, role: 'diluent' };
const tx1845: GasMix = { id: 'tx', name: 'Tx 18/45', fO2: 0.18, fHe: 0.45, role: 'diluent' };

describe('ccrBreathing (the loop model)', () => {
  it('holds ppO2 at the setpoint; inert is the remainder, all N₂ for air diluent', () => {
    const pAmb = depthToPressure(40, env);
    const { pN2, pHe } = ccrBreathing(air, 1.3).inspired(pAmb);
    expect(pHe).toBe(0);
    expect(pN2).toBeCloseTo(pAmb - P_H2O - 1.3, 9);
  });

  it('splits the inert by the trimix diluent N₂:He ratio', () => {
    const pAmb = depthToPressure(60, env);
    const { pN2, pHe } = ccrBreathing(tx1845, 1.3).inspired(pAmb);
    const inert = pAmb - P_H2O - 1.3;
    const fN2 = 1 - 0.18 - 0.45;
    const ratioN2 = fN2 / (fN2 + 0.45);
    expect(pN2).toBeCloseTo(inert * ratioN2, 9);
    expect(pHe).toBeCloseTo(inert * (1 - ratioN2), 9);
    expect(pN2 + pHe).toBeCloseTo(inert, 9);
  });

  it('caps ppO2 near the surface so inert clamps to 0 (never negative)', () => {
    const pAmb = depthToPressure(0, env); // surface: SP 1.3 exceeds what's achievable
    const { pN2, pHe } = ccrBreathing(air, 1.3).inspired(pAmb);
    expect(pN2).toBe(0);
    expect(pHe).toBe(0);
  });
});

describe('CCR engine (smoke)', () => {
  const segments = [{ id: 's1', depth: 45, time: 25, gasId: 'tx' }];
  const gfSets: GFSet[] = [{ id: 'g', gfLow: 0.3, gfHigh: 0.8 }];

  it('runs a CCR dive and returns a sensible profile distinct from OC', () => {
    const ccrEnv: EnvironmentConfig = { ...env, mode: 'ccr', setpointLow: 0.7, setpointHigh: 1.3 };
    const ocEnv: EnvironmentConfig = { ...env, mode: 'oc' };
    const ccr = runEngine({ segments, gases: [tx1845], gfSets, env: ccrEnv }).results[0]!;
    const oc = runEngine({ segments, gases: [tx1845], gfSets, env: ocEnv }).results[0]!;

    expect(ccr.runtime).toBeGreaterThan(0);
    expect(ccr.profile.length).toBeGreaterThan(2);
    expect(ccr.ceilingTimeline.length).toBe(ccr.profile.length);
    // Holding ppO2 at a setpoint changes the inert exposure vs a fixed OC mix, so the
    // computed decompression must actually differ.
    expect(ccr.totalDecoTime).not.toBe(oc.totalDecoTime);
  });
});

// Subsurface 6.0.5576 CCR reference (user-supplied 2026-06-11). Air diluent (21% O₂),
// 40 m / 20 min, GF 30/70, descent SP 0.7 → working SP 1.3 (switched on arrival at the
// bottom). Subsurface: descent 1 min, bottom 20 min, stops 12→1 / 9→2 / 6→3 / 3→4,
// total deco 10, runtime 34. This pinned the convention: the high setpoint governs the
// bottom hold + the whole ascent (low setpoint is descent-only).
//
// Tolerances (spec §12, as for OC): stop depths exact; per-stop times within ±1 min;
// total deco within ±3; runtime/TTS informational (Subsurface rounds the descent to
// 1 min and inter-stop ascents to 0, so it undercounts travel — not a deco error).
describe('CCR Subsurface reference (air diluent, 40 m / 20 min, GF 30/70, SP 0.7/1.3)', () => {
  const ccrEnv: EnvironmentConfig = { ...env, mode: 'ccr', setpointLow: 0.7, setpointHigh: 1.3 };
  const result = runEngine({
    segments: [{ id: 's1', depth: 40, time: 20, gasId: 'air' }],
    gases: [air],
    gfSets: [{ id: 'g', gfLow: 0.3, gfHigh: 0.7 }],
    env: ccrEnv,
  }).results[0]!;

  const SUBSURFACE = {
    firstStop: 12,
    stops: [
      { depth: 12, duration: 1 },
      { depth: 9, duration: 2 },
      { depth: 6, duration: 3 },
      { depth: 3, duration: 4 },
    ],
    totalDeco: 10,
  };

  it('matches the first stop and every stop depth exactly', () => {
    expect(result.firstStopDepth).toBe(SUBSURFACE.firstStop);
    expect(result.stops.map((s) => s.depth)).toEqual(SUBSURFACE.stops.map((s) => s.depth));
  });

  it('matches each per-stop time within ±1 min', () => {
    result.stops.forEach((s, i) => {
      expect(Math.abs(s.duration - SUBSURFACE.stops[i]!.duration)).toBeLessThanOrEqual(1);
    });
  });

  it('matches total decompression time within ±3 min', () => {
    expect(Math.abs(result.totalDecoTime - SUBSURFACE.totalDeco)).toBeLessThanOrEqual(3);
  });
});
