// Pure read helpers over an engine GFResult's profile/stops, for the chart's
// hover read-out (spec §7). No DOM, no React — just interpolation over the dense,
// time-ordered ProfilePoint[] the engine already produces.
import type { ProfilePoint, StopEntry } from '../../engine';

/**
 * Depth (m) at runtime `t` (min), linearly interpolated between samples. The
 * engine profile is densely sub-sampled and strictly increasing in time, so a
 * linear scan is exact at vertices and smooth between. Clamps to the endpoints
 * outside the dive's time range.
 */
export function depthAtTime(profile: ProfilePoint[], t: number): number {
  if (profile.length === 0) return 0;
  const first = profile[0]!;
  const last = profile[profile.length - 1]!;
  if (t <= first.time) return first.depth;
  if (t >= last.time) return last.depth;
  // A single dive is a few hundred points; a scan is plenty. Upgrade to a binary
  // search only if a profile ever grows large.
  for (let i = 1; i < profile.length; i++) {
    const b = profile[i]!;
    if (t <= b.time) {
      const a = profile[i - 1]!;
      const span = b.time - a.time;
      if (span <= 0) return b.depth;
      return a.depth + ((t - a.time) / span) * (b.depth - a.depth);
    }
  }
  return last.depth;
}

/**
 * The decompression stop the diver is holding at runtime `t`, or null when in
 * transit or on the bottom. A held stop shows as a depth plateau in the profile,
 * so we flag it only when the depth at `t` is flat (constant in a small
 * neighbourhood) AND matches a stop depth — the bottom plateau is deeper than any
 * deco stop, so it never matches.
 */
export function currentStopAtTime(
  profile: ProfilePoint[],
  stops: StopEntry[],
  t: number,
  tol = 0.25,
): StopEntry | null {
  if (stops.length === 0) return null;
  const flat = Math.abs(depthAtTime(profile, t + 0.05) - depthAtTime(profile, t - 0.05)) < 1e-3;
  if (!flat) return null;
  const d = depthAtTime(profile, t);
  let best: StopEntry | null = null;
  let bestErr = tol;
  for (const s of stops) {
    const err = Math.abs(s.depth - d);
    if (err <= bestErr) {
      bestErr = err;
      best = s;
    }
  }
  return best;
}
