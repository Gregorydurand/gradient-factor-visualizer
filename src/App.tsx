// App shell — dark instrument layout (spec §10 foundation): an input-panel column
// beside the stage, with the always-visible disclaimer footer (spec §1). The stage
// holds the global scrubber + all four views (deco profile, ceiling, GF/M-value
// pressure plot, tissue loading) and the outputs table; the full About/Limitations
// panel lands in M7.
import { OutputsTable } from './components/OutputsTable';
import { Scrubber } from './components/Scrubber';
import { CeilingChart } from './components/views/CeilingChart';
import { DecoProfileChart } from './components/views/DecoProfileChart';
import { PressurePlot } from './components/views/PressurePlot';
import { TissueLoadingChart } from './components/views/TissueLoadingChart';
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
          <Scrubber />
          <DecoProfileChart />
          <CeilingChart />
          <PressurePlot />
          <TissueLoadingChart />
          <OutputsTable />
        </main>
      </div>

      <footer className="app-footer">
        Educational visualization only — not a dive planner. Do not use to plan real dives.
      </footer>
    </div>
  );
}
