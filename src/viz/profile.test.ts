import { describe, it, expect } from 'vitest';
import { currentStopAtTime, depthAtTime } from './profile';
import type { ProfilePoint, StopEntry } from '../../engine';

// A synthetic but realistic shape: descend, hold bottom, ascend through three
// deco stops, surface.
const profile: ProfilePoint[] = [
  { time: 0, depth: 0 },
  { time: 2, depth: 36 }, // descent
  { time: 22, depth: 36 }, // bottom hold
  { time: 24, depth: 9 }, // ascent to first stop
  { time: 27, depth: 9 }, // 9 m stop
  { time: 28, depth: 6 },
  { time: 30, depth: 6 }, // 6 m stop
  { time: 31, depth: 3 },
  { time: 36, depth: 3 }, // 3 m stop
  { time: 37, depth: 0 }, // surface
];
const stops: StopEntry[] = [
  { depth: 9, duration: 3 },
  { depth: 6, duration: 2 },
  { depth: 3, duration: 5 },
];

describe('depthAtTime', () => {
  it('is exact at sample vertices', () => {
    expect(depthAtTime(profile, 0)).toBe(0);
    expect(depthAtTime(profile, 22)).toBe(36);
    expect(depthAtTime(profile, 37)).toBe(0);
  });

  it('interpolates linearly between samples', () => {
    expect(depthAtTime(profile, 1)).toBeCloseTo(18, 9); // halfway down
    expect(depthAtTime(profile, 23)).toBeCloseTo(22.5, 9); // mid-ascent 36→9
  });

  it('clamps outside the dive time range', () => {
    expect(depthAtTime(profile, -5)).toBe(0);
    expect(depthAtTime(profile, 999)).toBe(0);
  });
});

describe('currentStopAtTime', () => {
  it('flags the held stop on a plateau', () => {
    expect(currentStopAtTime(profile, stops, 25.5)?.depth).toBe(9);
    expect(currentStopAtTime(profile, stops, 29)?.depth).toBe(6);
    expect(currentStopAtTime(profile, stops, 34)?.depth).toBe(3);
  });

  it('returns null in transit and on the bottom', () => {
    expect(currentStopAtTime(profile, stops, 1)).toBeNull(); // descending
    expect(currentStopAtTime(profile, stops, 23)).toBeNull(); // ascending
    expect(currentStopAtTime(profile, stops, 15)).toBeNull(); // bottom — not a deco stop
  });
});
