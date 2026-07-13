import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildRunRate, buildStatCards } from './summary-metrics';

const base = {
  summaryRows: [{ currency: 'USD', cost: '100', resources: 1, line_items: 1 }],
  costCenters: [],
  environments: [],
  topResources: [],
  topLabel: 'Resource name',
  freshness: { data_through: '2026-07-11T00:00:00Z', loaded_at: '2026-07-11T00:00:00Z' },
  start: '2026-01-01T00:00:00Z',
  end: '2026-07-12T00:00:00Z',
  currency: 'USD',
};

describe('buildStatCards', () => {
  afterEach(() => vi.useRealTimers());

  it('labels the current calendar-month bucket without a partiality suffix', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-12T12:00:00Z'));

    const cards = buildStatCards({ ...base, monthly: [{ bucket: '2026-07-01T00:00:00Z', currency: 'USD', cost: '42' }] });

    expect(cards).toContainEqual(expect.objectContaining({ label: 'Current month', subs: ['2026-07'] }));
  });

  it('keeps the latest-month label when the newest bucket is older than the current month', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-12T12:00:00Z'));

    const cards = buildStatCards({ ...base, monthly: [{ bucket: '2026-06-01T00:00:00Z', currency: 'USD', cost: '42' }] });

    expect(cards).toContainEqual(expect.objectContaining({ label: 'Latest month', subs: ['2026-06'] }));
  });

  it('does not render an untagged cost-center card', () => {
    const cards = buildStatCards({
      ...base,
      monthly: [{ bucket: '2026-06-01T00:00:00Z', currency: 'USD', cost: '42' }],
      costCenters: [{ dimension_value: '', currency: 'USD', cost: '42', resources: 1 }],
    });

    expect(cards.map((card) => card.label)).not.toContain('Untagged (no cost center)');
  });
});

describe('buildRunRate', () => {
  it('aligns cumulative current and previous month spend by day of month', () => {
    const comparison = buildRunRate(
      [
        { bucket: '2026-06-01T00:00:00Z', currency: 'USD', cost: '10' },
        { bucket: '2026-06-02T00:00:00Z', currency: 'USD', cost: '5' },
        { bucket: '2026-07-01T00:00:00Z', currency: 'USD', cost: '3' },
        { bucket: '2026-07-02T00:00:00Z', currency: 'USD', cost: '7' },
      ],
      'USD',
      new Date('2026-07-12T12:00:00Z'),
    );

    expect(comparison).not.toBeNull();
    expect(comparison?.days).toHaveLength(30);
    expect(comparison?.current.slice(0, 3)).toEqual([3, 10, 10]);
    expect(comparison?.previous.slice(0, 3)).toEqual([10, 15, 15]);
    expect(comparison?.current[29]).toBeNull();
  });

  it('returns null when the current month has no rows', () => {
    expect(
      buildRunRate(
        [{ bucket: '2026-06-01T00:00:00Z', currency: 'USD', cost: '10' }],
        'USD',
        new Date('2026-07-12T12:00:00Z'),
      ),
    ).toBeNull();
  });

  it('stops the current line at the freshness cutoff instead of plotting a stale plateau', () => {
    const comparison = buildRunRate(
      [
        { bucket: '2026-07-01T00:00:00Z', currency: 'USD', cost: '3' },
        { bucket: '2026-07-02T00:00:00Z', currency: 'USD', cost: '7' },
        { bucket: '2026-07-11T00:00:00Z', currency: 'USD', cost: '100' },
      ],
      'USD',
      new Date('2026-07-12T12:00:00Z'),
      new Date('2026-07-10T00:00:00Z'),
    );

    expect(comparison?.current.slice(0, 12)).toEqual([
      3,
      10,
      10,
      10,
      10,
      10,
      10,
      10,
      10,
      10,
      null,
      null,
    ]);
  });

  it('pads the previous line with nulls when the current month is longer', () => {
    const comparison = buildRunRate(
      [
        { bucket: '2026-02-28T00:00:00Z', currency: 'USD', cost: '20' },
        { bucket: '2026-03-01T00:00:00Z', currency: 'USD', cost: '5' },
      ],
      'USD',
      new Date('2026-03-31T12:00:00Z'),
    );

    expect(comparison?.days).toHaveLength(31);
    expect(comparison?.previous.at(-3)).toBeNull();
    expect(comparison?.previous.at(-2)).toBeNull();
    expect(comparison?.previous.at(-1)).toBeNull();
  });
});
