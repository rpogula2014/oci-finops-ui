import { describe, expect, it } from 'vitest';
import { DimensionAnomaly, clusterAnomalyEvents } from './anomaly-events';

function row(overrides: Partial<DimensionAnomaly> = {}): DimensionAnomaly {
  return {
    dimension: 'service', dimension_value: 'COMPUTE', currency: 'USD', day: '2026-07-07',
    cost: 1_286, baseline: 318, deviation: 968, z_score: 22.8, severity: 'critical', direction: 'spike',
    ...overrides,
  };
}

describe('clusterAnomalyEvents', () => {
  // Consecutive alert days are one operational event, rather than three duplicate cards.
  it('collapses a multi-day primary spike into one event', () => {
    const events = clusterAnomalyEvents([row(), row({ day: '2026-07-08', deviation: 800 }), row({ day: '2026-07-09', deviation: 1_000 })]);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ startDay: '2026-07-07', endDay: '2026-07-09', totalDeviation: 2_768 });
    expect(events[0].peak.day).toBe('2026-07-09');
  });

  it('adds same-day non-primary rows as correlation context', () => {
    const events = clusterAnomalyEvents([
      row(),
      row({ dimension: 'compartment', dimension_value: 'production' }),
      row({ dimension: 'resource_name', dimension_value: 'api-01' }),
    ]);
    expect(events[0].seenAt).toEqual([
      { dimension: 'compartment', value: 'production' },
      { dimension: 'resource_name', value: 'api-01' },
    ]);
  });

  it('keeps drops and spikes as separate events', () => {
    const events = clusterAnomalyEvents([row(), row({ direction: 'drop', day: '2026-07-08', deviation: -968 })]);
    expect(events.map((event) => event.direction).sort()).toEqual(['drop', 'spike']);
  });

  it('partitions currencies and renders only the foreground currency', () => {
    const events = clusterAnomalyEvents([row(), row({ currency: 'EUR', deviation: 2_000 })], { currency: 'USD' });
    expect(events).toHaveLength(1);
    expect(events[0].currency).toBe('USD');
  });
});
