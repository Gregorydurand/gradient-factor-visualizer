// App shell — dark instrument layout (spec §10 foundation): an input-panel column
// beside the stage, with the always-visible disclaimer footer (spec §1). The
// stage now holds View 1 (deco profile) + the outputs table (Milestone 3); the
// remaining views land in M4–M6 and the full About/Limitations panel in M7.
import { OutputsTable } from './components/OutputsTable';
import { DecoProfileChart } from './components/views/DecoProfileChart';
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
          <DecoProfileChart />
          <OutputsTable />
        </main>
      </div>

      <footer className="app-footer">
        Educational visualization only — not a dive planner. Do not use to plan real dives.
      </footer>
    </div>
  );
}
