import { describe, it, expect } from 'vitest';
import { bottomEndTime, compartmentAtTime, controllingAtTime, firstStopArrivalTime } from './loading';
import type { CompartmentState, LoadingPoint, ProfilePoint } from '../../engine';

// Build a tiny 2-compartment timeline (only indices we assert need to be present).
function lp(time: number, c0: CompartmentState, c1: CompartmentState, controlling: number): LoadingPoint {
  return { time, compartments: [c0, c1], controlling };
}

const timeline: LoadingPoint[] = [
  lp(0, { pN2: 0.74, pHe: 0 }, { pN2: 0.74, pHe: 0 }, 0),
  lp(10, { pN2: 1.5, pHe: 0.5 }, { pN2: 1.0, pHe: 0.2 }, 0),
  lp(20, { pN2: 2.0, pHe: 1.0 }, { pN2: 1.4, pHe: 0.4 }, 1),
];

describe('compartmentAtTime', () => {
  it('is exact at vertices', () => {
    expect(compartmentAtTime(timeline, 0, 10)).toEqual({ pN2: 1.5, pHe: 0.5 });
    expect(compartmentAtTime(timeline, 1, 20)).toEqual({ pN2: 1.4, pHe: 0.4 });
  });

  it('interpolates both species linearly', () => {
    const r = compartmentAtTime(timeline, 0, 15); // halfway 10→20 for compartment 0
    expect(r.pN2).toBeCloseTo(1.75, 9);
    expect(r.pHe).toBeCloseTo(0.75, 9);
  });

  it('clamps outside the time range', () => {
    expect(compartmentAtTime(timeline, 0, -5)).toEqual({ pN2: 0.74, pHe: 0 });
    expect(compartmentAtTime(timeline, 0, 999)).toEqual({ pN2: 2.0, pHe: 1.0 });
  });
});

describe('controllingAtTime', () => {
  it('steps to the sample at or before t (no interpolation)', () => {
    expect(controllingAtTime(timeline, 0)).toBe(0);
    expect(controllingAtTime(timeline, 15)).toBe(0); // still sample @10
    expect(controllingAtTime(timeline, 20)).toBe(1);
    expect(controllingAtTime(timeline, 999)).toBe(1);
  });
});

const ascentProfile: ProfilePoint[] = [
  { time: 0, depth: 0 },
  { time: 2, depth: 40 },
  { time: 22, depth: 40 }, // last sample at the bottom
  { time: 24, depth: 21 }, // arrives at first stop (21 m)
  { time: 27, depth: 21 },
  { time: 30, depth: 0 },
];

describe('bottomEndTime', () => {
  it('returns the last time at max depth (start of ascent)', () => {
    expect(bottomEndTime(ascentProfile)).toBe(22);
  });
});

describe('firstStopArrivalTime', () => {
  it('returns the first time the diver reaches the first stop depth', () => {
    expect(firstStopArrivalTime(ascentProfile, 21)).toBe(24);
  });

  it('falls back to the end of the bottom when there is no deco', () => {
    expect(firstStopArrivalTime(ascentProfile, 0)).toBe(22);
  });
});
