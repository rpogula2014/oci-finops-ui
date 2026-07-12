import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, InjectionToken, inject } from '@angular/core';
import { Observable, map, throwError } from 'rxjs';
import { ApiError, BreakdownRow, CostQuery, Dimension, Envelope, EnvelopeMeta, ExecSummary, FiltersRow, Freshness, Granularity, GroupedResourceDimension, GroupedResourceRow, LineItemsRow, ResourceDetail, ResourceRow, SummaryRow, TimeseriesRow } from './api.types';

/** Overridable for non-proxied deployments; default relies on the dev-server proxy. */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  factory: () => '',
});

export interface Unwrapped<T> {
  rows: T;
  meta: EnvelopeMeta;
}

/** The API treats "" as "unfiltered"; this sentinel selects rows where the dimension is empty. */
export const UNTAGGED_PARAM = '__untagged__';

function toParams(query: CostQuery, extra: Record<string, string | number | undefined> = {}): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries({ ...query, ...extra })) {
    if (value === undefined || value === null) continue;
    // UI-side "" means untagged — translate to the API's explicit sentinel
    params = params.set(key, value === '' ? UNTAGGED_PARAM : String(value));
  }
  return params;
}

@Injectable({ providedIn: 'root' })
export class CostApiService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);

  private unwrap<T>(source: Observable<Envelope<T>>, emptyValue?: T): Observable<Unwrapped<T>> {
    return source.pipe(
      map((envelope) => {
        if (envelope.error) throw new ApiError(envelope.error.code, envelope.error.message);
        if (envelope.data === null) {
          // zero-row list responses come back as data: null — treat as empty, not error
          if (emptyValue !== undefined) return { rows: emptyValue, meta: envelope.meta };
          throw new ApiError('HTTP_ERROR', 'Empty response data');
        }
        return { rows: envelope.data, meta: envelope.meta };
      }),
    );
  }

  /** List endpoints: null data unwraps to []. */
  private get<T extends unknown[]>(path: string, params?: HttpParams): Observable<Unwrapped<T>> {
    return this.unwrap(this.http.get<Envelope<T>>(`${this.base}${path}`, { params }), [] as unknown as T);
  }

  /** Object endpoints (/freshness, /exec-summary): null data is a real error. */
  private getObject<T>(path: string, params?: HttpParams): Observable<Unwrapped<T>> {
    return this.unwrap(this.http.get<Envelope<T>>(`${this.base}${path}`, { params }));
  }

  /** One-round-trip aggregate for the executive summary page. */
  execSummary(query: CostQuery, dimension: Dimension, top = 7): Observable<Unwrapped<ExecSummary>> {
    return this.getObject('/v1/costs/exec-summary', toParams(query, { dimension, top }));
  }

  summary(query: CostQuery): Observable<Unwrapped<SummaryRow[]>> {
    return this.get('/v1/costs/summary', toParams(query));
  }

  timeseries(query: CostQuery, granularity: Granularity): Observable<Unwrapped<TimeseriesRow[]>> {
    return this.get('/v1/costs/timeseries', toParams(query, { granularity }));
  }

  breakdown(query: CostQuery, dimension: Dimension, limit = 20, series = false, granularity: Granularity = 'day'): Observable<Unwrapped<BreakdownRow[]>> {
    return this.get('/v1/costs/breakdown', toParams(query, { dimension, limit, series: series ? 'true' : undefined, granularity }));
  }

  resources(query: CostQuery, page = 1, limit = 50, sort: 'cost' | 'resource_name' | 'service' | 'compartment' = 'cost', direction: 'asc' | 'desc' = 'desc'): Observable<Unwrapped<ResourceRow[]>> {
    return this.get('/v1/costs/resources', toParams(query, { page, limit, sort, direction }));
  }

  groupedResources(
    query: CostQuery,
    group1: GroupedResourceDimension,
    group2?: GroupedResourceDimension,
    opts: { group1Value?: string; group2Value?: string; q?: string; hideZero?: boolean } = {},
  ): Observable<Unwrapped<GroupedResourceRow[]>> {
    if (group1 === group2) {
      return throwError(() => new ApiError('VALIDATION_ERROR', 'Grouping dimensions must differ'));
    }
    return this.get(
      '/v1/costs/resources/grouped',
      toParams(query, {
        group1,
        group2,
        group1_value: opts.group1Value,
        group2_value: opts.group2Value,
        q: opts.q?.trim() || undefined,
        hide_zero: opts.hideZero ? 'true' : undefined,
        grain: 'month',
      }),
    );
  }

  resourceDetail(ocid: string, query: CostQuery = {}): Observable<Unwrapped<ResourceDetail[]>> {
    return this.get(`/v1/costs/resources/${encodeURIComponent(ocid)}`, toParams(query));
  }

  lineItems(ref: { resource_name: string } | { ocid: string } | undefined, granularity: Granularity = 'day', query: CostQuery = {}): Observable<Unwrapped<LineItemsRow[]>> {
    return this.get('/v1/costs/lineitems', toParams(query, { ...(ref ?? {}), granularity }));
  }

  filters(query: CostQuery = {}): Observable<Unwrapped<FiltersRow[]>> {
    return this.get('/v1/costs/filters', toParams(query));
  }

  freshness(): Observable<Unwrapped<Freshness>> {
    return this.getObject('/v1/costs/freshness');
  }
}
