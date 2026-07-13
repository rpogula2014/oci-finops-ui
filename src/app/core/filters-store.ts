import { Injectable, computed, signal } from '@angular/core';
import { Params } from '@angular/router';
import { CostQuery, Dimension, Granularity } from './api.types';

export const DIMENSION_FILTER_KEYS = ['env', 'cost_center', 'component_type', 'compartment', 'service', 'resource_type', 'resource_name', 'ocid'] as const;

export type DimensionFilterKey = (typeof DIMENSION_FILTER_KEYS)[number];

/** breakdown `dimension` value → filter query param name. */
export const DIMENSION_TO_FILTER: Record<Dimension, DimensionFilterKey> = {
  service: 'service',
  compartment: 'compartment',
  environment: 'env',
  cost_center: 'cost_center',
  component_type: 'component_type',
  resource_type: 'resource_type',
  resource_name: 'resource_name',
};

export const DIMENSION_LABELS: Record<Dimension, string> = {
  service: 'Service',
  compartment: 'Compartment',
  environment: 'Environment',
  cost_center: 'Cost Center',
  component_type: 'Component Type',
  resource_type: 'Resource Type',
  resource_name: 'Resource Name',
};

/** API max range is 400 days. */
export const MAX_RANGE_DAYS = 400;
export const DEFAULT_HIERARCHY: Dimension[] = ['compartment', 'cost_center', 'component_type', 'resource_type', 'resource_name'];

function defaultRange(): { start: string; end: string } {
  const end = new Date();
  const start = new Date(end);
  // 6 months so the landing has enough complete months for MoM/forecast cards
  start.setMonth(start.getMonth() - 6);
  return { start: start.toISOString(), end: end.toISOString() };
}

/**
 * Shared query state (design D3). Signals only; URL is hydrated in and
 * serialized out so Explorer state stays deep-linkable.
 */
@Injectable({ providedIn: 'root' })
export class FiltersStore {
  private readonly initial = defaultRange();

  readonly start = signal<string>(this.initial.start);
  readonly end = signal<string>(this.initial.end);
  readonly granularity = signal<Granularity>('day');
  readonly currency = signal<string | null>(null); // foregrounded segment when >1 currency
  readonly hierarchy = signal<Dimension[]>([...DEFAULT_HIERARCHY]);
  readonly search = signal('');
  /** Each path contains URI-encoded row labels joined by `|`. */
  readonly expandedPaths = signal<string[]>([]);
  readonly selectedPath = signal<string | null>(null);

  private readonly filterSignals = Object.fromEntries(DIMENSION_FILTER_KEYS.map((key) => [key, signal<string | null>(null)])) as Record<DimensionFilterKey, ReturnType<typeof signal<string | null>>>;

  filter(key: DimensionFilterKey) {
    return this.filterSignals[key].asReadonly();
  }

  setFilter(key: DimensionFilterKey, value: string | null): void {
    this.filterSignals[key].set(value);
  }

  setRange(start: string, end: string): void {
    const ms = new Date(end).getTime() - new Date(start).getTime();
    if (ms < 0 || ms > MAX_RANGE_DAYS * 86_400_000) return; // clamp: reject invalid/over-max ranges
    this.start.set(start);
    this.end.set(end);
  }

  clearFilters(): void {
    for (const key of DIMENSION_FILTER_KEYS) this.filterSignals[key].set(null);
  }

  setHierarchy(hierarchy: Dimension[]): void {
    const valid = hierarchy.filter((dimension, index) => dimension in DIMENSION_TO_FILTER && hierarchy.indexOf(dimension) === index);
    this.hierarchy.set(valid.length ? valid : [...DEFAULT_HIERARCHY]);
    this.expandedPaths.set([]);
    this.selectedPath.set(null);
  }

  /** Query object for CostApiService. "" is kept (untagged); null means unset. */
  readonly query = computed<CostQuery>(() => {
    const query: CostQuery = { start: this.start(), end: this.end() };
    for (const key of DIMENSION_FILTER_KEYS) {
      const value = this.filterSignals[key]();
      if (value !== null) query[key] = value;
    }
    return query;
  });

  /** Query object for views that should ignore Explorer-scoped dimension filters. */
  readonly globalQuery = computed<CostQuery>(() => ({ start: this.start(), end: this.end() }));

  /** Router query params representing current Explorer state. */
  toQueryParams(): Params {
    const params = this.toFilterParams();
    params['hier'] = this.hierarchy().join(',');
    if (this.search()) params['search'] = this.search();
    if (this.expandedPaths().length) params['open'] = this.expandedPaths().join(',');
    if (this.selectedPath()) params['sel'] = this.selectedPath();
    return params;
  }

  /** Nav params for cross-view drilldown: range, grain, and dimension filters only. */
  toFilterParams(): Params {
    const params: Params = {
      start: this.start(),
      end: this.end(),
      grain: this.granularity(),
    };
    for (const key of DIMENSION_FILTER_KEYS) {
      const value = this.filterSignals[key]();
      if (value !== null) params[key] = value;
    }
    return params;
  }

  /** Hydrate from URL params (deep links, back/forward). Unknown keys ignored. */
  hydrateFromParams(params: Params): void {
    for (const key of DIMENSION_FILTER_KEYS) {
      if (params[key] !== undefined) this.filterSignals[key].set(params[key]);
    }
    if (params['start'] && params['end']) this.setRange(params['start'], params['end']);
    const grain = params['grain'];
    if (grain === 'hour' || grain === 'day' || grain === 'week' || grain === 'month') {
      this.granularity.set(grain);
    }
    const hierarchy = String(params['hier'] ?? '')
      .split(',')
      .filter((dimension): dimension is Dimension => dimension in DIMENSION_TO_FILTER);
    if (hierarchy.length) this.hierarchy.set([...new Set(hierarchy)]);
    if (params['search'] !== undefined) this.search.set(String(params['search']));
    if (params['open'] !== undefined) this.expandedPaths.set(String(params['open']).split(',').filter(Boolean));
    if (params['sel'] !== undefined) this.selectedPath.set(String(params['sel']) || null);
  }
}
