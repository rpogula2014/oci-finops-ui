import { TestBed } from '@angular/core/testing';
import { FiltersStore, MAX_RANGE_DAYS } from './filters-store';

describe('FiltersStore', () => {
  let store: FiltersStore;

  beforeEach(() => {
    store = TestBed.inject(FiltersStore);
  });

  // Deep links are the contract for Explorer state — URL round-trip must be lossless.
  it('hydrates from URL params and serializes back', () => {
    store.hydrateFromParams({
      env: 'dev',
      service: 'COMPUTE',
      start: '2026-06-01T00:00:00.000Z',
      end: '2026-06-30T00:00:00.000Z',
      grain: 'week',
    });
    expect(store.filter('env')()).toBe('dev');
    expect(store.granularity()).toBe('week');
    expect(store.query()).toEqual(
      expect.objectContaining({ env: 'dev', service: 'COMPUTE', start: '2026-06-01T00:00:00.000Z' }),
    );
    expect(store.toQueryParams()).toEqual(
      expect.objectContaining({ env: 'dev', service: 'COMPUTE', grain: 'week' }),
    );
  });

  it('keeps empty-string (untagged) filters in the query but not null ones', () => {
    store.setFilter('env', '');
    expect(store.query()['env']).toBe('');
    expect('cost_center' in store.query()).toBe(false);
  });

  // API rejects ranges over 400 days — clamp client-side per spec.
  it('rejects ranges exceeding the API maximum', () => {
    const start = store.start();
    const tooFar = new Date(Date.now() + (MAX_RANGE_DAYS + 10) * 86_400_000).toISOString();
    store.setRange(start, tooFar);
    expect(store.end()).not.toBe(tooFar);
  });
});
