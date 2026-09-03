import { useRef } from 'react';
import { useSettings } from '../settings/SettingsContext';
import { makeFormatter } from '../core/format';
import type { Grouping, RoundingMode } from '../settings/settings';
import { D } from '../core/decimal';
import { ACCENTS, FONTS } from './themePresets';
import { IntegrationPanel } from './IntegrationPanel';

// Live settings surface (§8.1). Every numeric-format control shows a live preview of the
// same sample number so the effect is immediate. Import/export as JSON, reset per app.
const SAMPLE = '1234567.891';

export function SettingsPanel() {
  const { settings, update, setRegion, reset, replace } = useSettings();
  const fileRef = useRef<HTMLInputElement>(null);
  const preview = makeFormatter(settings).money(D(SAMPLE));

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'calcsuite-settings.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJson = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        replace(JSON.parse(String(reader.result)));
      } catch {
        alert('Could not read that settings file.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="settings">
      <div className="panel-head">
        <h2>Settings</h2>
        <p>Everything below updates the numbers live. Sample: <strong className="num">{preview}</strong></p>
      </div>

      <Section title="Region & currency">
        <Row label="Region">
          <div className="seg">
            <button aria-pressed={settings.region === 'IN'} onClick={() => setRegion('IN')}>🇮🇳 India</button>
            <button aria-pressed={settings.region === 'US'} onClick={() => setRegion('US')}>🇺🇸 United States</button>
          </div>
        </Row>
        <Row label="Currency symbol">
          <input className="mini" value={settings.currency.symbol} onChange={(e) => update({ currency: { symbol: e.target.value } })} />
        </Row>
        <Row label="Symbol position">
          <Select value={settings.currency.symbolPosition} onChange={(v) => update({ currency: { symbolPosition: v as 'prefix' | 'suffix' } })}
            options={[['prefix', 'Prefix ₹100'], ['suffix', 'Suffix 100₹']]} />
        </Row>
      </Section>

      <Section title="Number format">
        <Row label="Grouping">
          <Select value={settings.numberFormat.grouping} onChange={(v) => update({ numberFormat: { grouping: v as Grouping } })}
            options={[['indian', 'Indian 12,34,567'], ['western', 'Western 1,234,567'], ['european', 'European 1.234.567'], ['swiss', "Swiss 1'234'567"], ['plain', 'Plain 1234567']]} />
        </Row>
        <Row label="Decimal places">
          <div className="seg">
            {[0, 1, 2, 3, 4].map((n) => (
              <button key={n} aria-pressed={settings.numberFormat.decimalPlaces === n} onClick={() => update({ numberFormat: { decimalPlaces: n as 0 } })}>{n}</button>
            ))}
          </div>
        </Row>
        <Row label="Abbreviate (12.5 L / 1.2 Cr)">
          <Toggle on={settings.numberFormat.abbreviate} onClick={() => update({ numberFormat: { abbreviate: !settings.numberFormat.abbreviate } })} />
        </Row>
        <Row label="Abbreviation scale">
          <Select value={settings.numberFormat.abbreviationScale} onChange={(v) => update({ numberFormat: { abbreviationScale: v as 'indian' | 'western' } })}
            options={[['indian', 'Lakh / Crore'], ['western', 'K / M / B']]} />
        </Row>
        <Row label="Negatives">
          <Select value={settings.numberFormat.negativeFormat} onChange={(v) => update({ numberFormat: { negativeFormat: v as 'minus' | 'parentheses' } })}
            options={[['minus', '-1,000'], ['parentheses', '(1,000)']]} />
        </Row>
      </Section>

      <Section title="Calculation">
        <Row label="Rounding mode">
          <Select value={settings.rounding.mode} onChange={(v) => update({ rounding: { mode: v as RoundingMode } })}
            options={[['HALF_UP', 'Half up'], ['HALF_EVEN', 'Half even (banker’s)'], ['HALF_DOWN', 'Half down'], ['UP', 'Up'], ['DOWN', 'Down'], ['CEIL', 'Ceil'], ['FLOOR', 'Floor']]} />
        </Row>
        <Row label="Day-count convention">
          <Select value={settings.dayCount} onChange={(v) => update({ dayCount: v as any })}
            options={[['30/360', '30/360'], ['ACT/365', 'ACT/365'], ['ACT/360', 'ACT/360'], ['ACT/ACT', 'ACT/ACT'], ['30E/360', '30E/360']]} />
        </Row>
      </Section>

      <Section title="Appearance">
        <Row label="Theme">
          <Select value={settings.ui.theme} onChange={(v) => update({ ui: { theme: v as any } })}
            options={[['system', 'System'], ['light', 'Light'], ['dark', 'Dark'], ['highContrast', 'High contrast']]} />
        </Row>
        <Row label="Accent colour">
          <div className="swatches">
            {ACCENTS.map((a) => {
              const active = settings.ui.accent.toLowerCase() === a.main.toLowerCase();
              return (
                <button
                  key={a.id}
                  type="button"
                  className={`swatch ${active ? 'active' : ''}`}
                  style={{ background: a.main }}
                  aria-label={a.label}
                  aria-pressed={active}
                  title={a.label}
                  onClick={() => update({ ui: { accent: a.main } })}
                />
              );
            })}
          </div>
        </Row>
        <Row label="Font">
          <Select
            value={settings.ui.fontFamily}
            onChange={(v) => update({ ui: { fontFamily: v } })}
            options={FONTS.map((f) => [f.id, f.label] as [string, string])}
          />
        </Row>
        <Row label="Density">
          <Select value={settings.ui.density} onChange={(v) => update({ ui: { density: v as any } })}
            options={[['comfortable', 'Comfortable'], ['compact', 'Compact']]} />
        </Row>
        <Row label="Show formulas">
          <Toggle on={settings.ui.showFormulas} onClick={() => update({ ui: { showFormulas: !settings.ui.showFormulas } })} />
        </Row>
        <Row label="Show assumptions">
          <Toggle on={settings.ui.showAssumptions} onClick={() => update({ ui: { showAssumptions: !settings.ui.showAssumptions } })} />
        </Row>
      </Section>

      <Section title="Compliance">
        <Row label="Show disclaimer">
          <Toggle on={settings.compliance.showDisclaimer} onClick={() => update({ compliance: { showDisclaimer: !settings.compliance.showDisclaimer } })} />
        </Row>
      </Section>

      <Section title="File upload & server API">
        <Row label="Save & upload to your server">
          <Toggle on={settings.features.integrationPanel} onClick={() => update({ features: { integrationPanel: !settings.features.integrationPanel } })} />
        </Row>
        {!settings.features.integrationPanel && (
          <p style={{ fontSize: 12, color: 'var(--fc-slate)', margin: '8px 0 0' }}>
            Turn this on to configure your <strong>upload URL, authentication, and payload</strong> — so exports (PDF/CSV/…) and saved
            calculations post directly to your own server. No secret is ever stored by the app.
          </p>
        )}
      </Section>

      {settings.features.integrationPanel && <IntegrationPanel />}

      <div className="actions-row">
        <button className="icon-btn" onClick={exportJson}>Export settings</button>
        <button className="icon-btn" onClick={() => fileRef.current?.click()}>Import settings</button>
        <button className="icon-btn" onClick={reset}>Reset to defaults</button>
        <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])} />
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card settings-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="settings-row">
      <span className="lbl">{label}</span>
      <div>{children}</div>
    </div>
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: Array<[string, string]> }) {
  return (
    <div className="input-wrap mini-wrap">
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
    </div>
  );
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} className={`toggle ${on ? 'on' : ''}`} onClick={onClick}>
      <span className="knob" />
    </button>
  );
}
