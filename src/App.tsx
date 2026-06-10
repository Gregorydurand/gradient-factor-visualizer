// App shell — dark instrument layout (spec §10 foundation): an input-panel column
// beside the stage, with the always-visible disclaimer footer (spec §1). The
// stage holds the provisional results read-out today; the four visualizations
// land in Milestones 3–6 and the full About/Limitations panel in M7.
import { ResultsReadout } from './components/ResultsReadout';
import { EnvironmentPanel } from './components/panels/EnvironmentPanel';
import { GasEditor } from './components/panels/GasEditor';
import { GFSetsEditor } from './components/panels/GFSetsEditor';
import { SegmentEditor } from './components/panels/SegmentEditor';
import { SegmentedControl } from './components/ui';
import { useStore } from './store/useStore';

const UNIT_OPTS = [
  { value: 'metric' as const, label: 'Metric' },
  { value: 'imperial' as const, label: 'Imperial' },
];

export function App() {
  const units = useStore((s) => s.units);
  const setUnits = useStore((s) => s.setUnits);

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark" />
          <h1 className="brand-title">Gradient Factor Visualizer</h1>
        </div>
        <div className="header-tools">
          <SegmentedControl options={UNIT_OPTS} value={units} ariaLabel="Units" onChange={setUnits} />
        </div>
      </header>

      <div className="app-body">
        <aside className="sidebar">
          <SegmentEditor />
          <GasEditor />
          <GFSetsEditor />
          <EnvironmentPanel />
        </aside>

        <main className="stage">
          <ResultsReadout />
          <div className="stage-placeholder">
            <p className="placeholder-title">Visualizations arrive next</p>
            <p className="placeholder-sub">
              View 1 (deco profile) + outputs table is Milestone 3; ceiling, the GF / M-value
              showpiece, and tissue loading follow in M4–M6.
            </p>
          </div>
        </main>
      </div>

      <footer className="app-footer">
        Educational visualization only — not a dive planner. Do not use to plan real dives.
      </footer>
    </div>
  );
}
