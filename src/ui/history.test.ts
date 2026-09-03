// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { saveHistory, clearHistory } from './history';

const KEY = 'calcsuite:history';
const read = () => JSON.parse(localStorage.getItem(KEY) || '[]');

describe('history store (shared, persisted)', () => {
  beforeEach(() => clearHistory());

  it('saves an item to localStorage', () => {
    saveHistory({ id: 'loan.emi', title: 'Loan — ₹21,933.51/mo', primary: '₹21,933.51', values: { principal: '2500000' } });
    const items = read();
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('loan.emi');
    expect(items[0].primary).toBe('₹21,933.51');
    expect(typeof items[0].at).toBe('number');
  });

  it('newest first, and clear empties it', () => {
    saveHistory({ id: 'a', title: 'A', primary: '1', values: {} });
    saveHistory({ id: 'b', title: 'B', primary: '2', values: {} });
    expect(read()[0].id).toBe('b');
    clearHistory();
    expect(read()).toHaveLength(0);
  });
});
