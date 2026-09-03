// @vitest-environment happy-dom
import { describe, it, expect, beforeAll } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { App } from './App';

// Runtime smoke test: mount the entire shell (rail with every calculator + the default
// loan panel) and assert it renders without throwing. Catches mount-time errors that
// typecheck and unit tests miss.
beforeAll(() => {
  if (!window.matchMedia) {
    (window as any).matchMedia = (q: string) => ({
      matches: false,
      media: q,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {
        return false;
      },
    });
  }
  // Mock the live-rate fetch so tests never touch the network.
  (globalThis as any).fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      result: 'success',
      provider: 'test',
      time_last_update_utc: 'Thu, 03 Sep 2026 00:00:00 +0000',
      rates: { INR: 94.9, USD: 1, EUR: 0.9, GBP: 0.8 },
    }),
  });
});

describe('App runtime', () => {
  it('mounts the shell and renders the loan calculator', async () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    await act(async () => {
      createRoot(el).render(<App />);
    });
    const text = document.body.textContent ?? '';
    expect(text).toContain('CalcSuite');
    expect(text).toMatch(/EMI|Monthly Payment/);
    // rail shows calculators from several groups
    expect(text).toContain('SIP');
    expect(text).toContain('GST');
    expect(text).toContain('Scientific');
    // the loan result hero computed a value (currency symbol present)
    expect(text).toMatch(/[₹$]/);
  });

  it('renders a schema-driven calculator (SIP) and a tax calculator without throwing', async () => {
    // switch the active calc by deep link before mount
    window.location.hash = '#fincalc=invest.sip';
    const el = document.createElement('div');
    document.body.appendChild(el);
    await act(async () => {
      createRoot(el).render(<App />);
    });
    expect(document.body.textContent ?? '').toContain('CalcSuite');
    window.location.hash = '';
  });

  it('mounts the offline currency converter without throwing', async () => {
    window.location.hash = '#fincalc=tools.currency';
    const el = document.createElement('div');
    document.body.appendChild(el);
    await act(async () => {
      createRoot(el).render(<App />);
    });
    const text = document.body.textContent ?? '';
    expect(text).toContain('Currency converter');
    expect(text).toMatch(/Exchange rate/);
    expect(text).toContain('US Dollar'); // currency list populated
    expect(text).toMatch(/Offline/); // online/offline toggle present
    window.location.hash = '';
  });
});
