// ─────────────────────────────────────────────────────────────────────────────
// Public engine API barrel.
//
// The engine is a pure, dependency-free TypeScript module. It imports nothing
// from the app (`src/`), the DOM, or React — it is just functions over plain
// data, so it stays unit-testable and portable (spec Section 3).
// ─────────────────────────────────────────────────────────────────────────────

export { runEngine } from './engine';
export { computeProfileForGFSet } from './ascent';

// Physics / model primitives (exported for unit tests, UI read-outs, and audit).
export {
  barPerMetre,
  depthToPressure,
  pressureToDepth,
} from './pressure';
export {
  fN2,
  inspiredInert,
  modDepth,
  gasSwitchDepth,
  roundToStop,
  bestGasAtDepth,
  ppO2AtDepth,
} from './gas';
export {
  initialTissueState,
  cloneTissue,
  applyConstantDepth,
  applyDepthChange,
  combinedAB,
} from './tissue';
export {
  mValue,
  mValueGF,
  toleratedAmbient,
  gfAtDepth,
  ceilingAtGF,
} from './mvalue';
export type { CeilingResult } from './mvalue';

// Constants (exported so reviewers/tests can audit them against spec 4.1).
export * as constants from './constants';

// Types (spec Section 5).
export type {
  GasMix,
  DiveSegment,
  GFSet,
  EnvironmentConfig,
  ProfilePoint,
  CompartmentState,
  StopEntry,
  CeilingPoint,
  LoadingPoint,
  GFResult,
  EngineInput,
  EngineOutput,
  TissueState,
} from './types';
export { DEFAULT_ENV } from './types';
