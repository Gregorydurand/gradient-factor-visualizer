// GF sets (up to 3) — each a GF Low/High pair with slider + numeric entry, an
// optional name, and a conservatism-encoded colour swatch (spec §6.3 / §10).
// Sliders drive live recompute through the store. GF Low is kept ≤ GF High.
import { MAX_GF_SETS } from '../../store/defaults';
import { useStore } from '../../store/useStore';
import { assignGFColors } from '../../theme/gfColors';
import { round } from '../../util';
import { IconButton, NumberField, Panel, Slider } from '../ui';

export function GFSetsEditor() {
  const gfSets = useStore((s) => s.gfSets);
  const addGFSet = useStore((s) => s.addGFSet);
  const updateGFSet = useStore((s) => s.updateGFSet);
  const removeGFSet = useStore((s) => s.removeGFSet);
  const colors = assignGFColors(gfSets);

  return (
    <Panel
      title="GF sets"
      subtitle={`${gfSets.length}/${MAX_GF_SETS}`}
      actions={
        <IconButton
          title="Add GF set"
          disabled={gfSets.length >= MAX_GF_SETS}
          onClick={addGFSet}
        >
          ＋
        </IconButton>
      }
    >
      <div className="gf-list">
        {gfSets.map((gf) => {
          const lo = round(gf.gfLow * 100);
          const hi = round(gf.gfHigh * 100);
          const color = colors[gf.id] ?? 'var(--gf-1)';
          return (
            <div className="gf-card" key={gf.id}>
              <div className="gf-card-head">
                <span className="gf-swatch" style={{ background: color }} />
                <input
                  className="gf-name"
                  value={gf.name ?? ''}
                  placeholder={`${lo}/${hi}`}
                  aria-label="GF set name"
                  onChange={(e) => updateGFSet(gf.id, { name: e.target.value })}
                />
                <IconButton
                  title="Remove GF set"
                  danger
                  disabled={gfSets.length <= 1}
                  onClick={() => removeGFSet(gf.id)}
                >
                  ✕
                </IconButton>
              </div>

              <div className="gf-slider-row">
                <span className="field-label gf-edge">Low</span>
                <Slider
                  value={lo}
                  min={0}
                  max={100}
                  color={color}
                  ariaLabel="GF Low"
                  onChange={(v) => updateGFSet(gf.id, { gfLow: Math.min(v, hi) / 100 })}
                />
                <NumberField
                  value={lo}
                  min={0}
                  max={hi}
                  suffix="%"
                  width={52}
                  onChange={(v) => updateGFSet(gf.id, { gfLow: v / 100 })}
                />
              </div>

              <div className="gf-slider-row">
                <span className="field-label gf-edge">High</span>
                <Slider
                  value={hi}
                  min={0}
                  max={100}
                  color={color}
                  ariaLabel="GF High"
                  onChange={(v) => updateGFSet(gf.id, { gfHigh: Math.max(v, lo) / 100 })}
                />
                <NumberField
                  value={hi}
                  min={lo}
                  max={100}
                  suffix="%"
                  width={52}
                  onChange={(v) => updateGFSet(gf.id, { gfHigh: v / 100 })}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
