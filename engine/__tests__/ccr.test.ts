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

describe.skip('CCR Subsurface reference profiles (pending user schedules)', () => {
  it('matches Subsurface within §12 tolerances', () => {
    // Fill in once Subsurface CCR schedules are supplied (stop depths + per-stop min).
  });
});
