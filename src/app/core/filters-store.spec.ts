import { TestBed } from '@angular/core/testing';
import { DEFAULT_HIERARCHY, FiltersStore, MAX_RANGE_DAYS } from './filters-store';

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
      hier: 'compartment,service',
      search: 'prod',
      open: 'prod-comp|COMPUTE',
      sel: 'prod-comp|COMPUTE',
    });
    expect(store.filter('env')()).toBe('dev');
    expect(store.granularity()).toBe('week');
    expect(store.query()).toEqual(
      expect.objectContaining({
        env: 'dev',
        service: 'COMPUTE',
        start: '2026-06-01T00:00:00.000Z',
      }),
    );
    expect(store.toQueryParams()).toEqual(
      expect.objectContaining({
        env: 'dev',
        service: 'COMPUTE',
        grain: 'week',
        hier: 'compartment,service',
        search: 'prod',
      }),
    );
    expect(store.expandedPaths()).toEqual(['prod-comp|COMPUTE']);
    expect(store.selectedPath()).toBe('prod-comp|COMPUTE');
  });

  it('keeps empty-string (untagged) filters in the query but not null ones', () => {
    store.setFilter('env', '');
    expect(store.query()['env']).toBe('');
    expect('cost_center' in store.query()).toBe(false);
  });

  it('serializes only shared filters for cross-view navigation', () => {
    store.hydrateFromParams({
      env: 'dev',
      start: '2026-06-01T00:00:00.000Z',
      end: '2026-06-30T00:00:00.000Z',
      grain: 'week',
      hier: 'service,compartment',
      search: 'boot',
      open: 'COMPUTE',
      sel: 'COMPUTE',
    });

    expect(store.toFilterParams()).toEqual({
      env: 'dev',
      start: '2026-06-01T00:00:00.000Z',
      end: '2026-06-30T00:00:00.000Z',
      grain: 'week',
    });
  });

  // API rejects ranges over 400 days — clamp client-side per spec.
  it('rejects ranges exceeding the API maximum', () => {
    const start = store.start();
    const tooFar = new Date(Date.now() + (MAX_RANGE_DAYS + 10) * 86_400_000).toISOString();
    store.setRange(start, tooFar);
    expect(store.end()).not.toBe(tooFar);
  });

  it('resets expansion when the hierarchy changes', () => {
    store.expandedPaths.set(['COMPUTE']);
    store.setHierarchy(['compartment', 'service']);
    expect(store.hierarchy()).toEqual(['compartment', 'service']);
    expect(store.expandedPaths()).toEqual([]);
  });

  it('starts with the cost-allocation hierarchy used by Explorer', () => {
    expect(store.hierarchy()).toEqual(DEFAULT_HIERARCHY);
    expect(store.hierarchy()).toEqual([
      'compartment',
      'cost_center',
      'component_type',
      'resource_type',
      'resource_name',
    ]);
  });
});
