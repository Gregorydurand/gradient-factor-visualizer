import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// ─────────────────────────────────────────────────────────────────────────────
// MILESTONE 1 SCAFFOLD ONLY.
//
// Per the build plan, no UI / views / panels / styling are built in Milestone 1.
// The engine (`/engine`) is the deliverable and is fully decoupled from this
// entry point — it imports nothing from `src/`. This placeholder exists only so
// the React 18 + Vite toolchain is real and `npm run dev` works. View/panel work
// begins at Milestone 2.
// ─────────────────────────────────────────────────────────────────────────────

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <main style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', maxWidth: 640 }}>
        <h1 style={{ margin: 0, fontSize: '1.1rem' }}>Gradient Factor Visualizer</h1>
        <p style={{ color: '#888' }}>
          Milestone 1 (decompression engine) is complete. UI is not built yet —
          see <code>engine/</code> and run <code>npm test</code> for the regression fixture.
        </p>
        <p style={{ color: '#888', fontSize: '0.85rem' }}>
          Educational visualization only — not a dive planner. Do not use to plan real dives.
        </p>
      </main>
    </StrictMode>,
  );
}
