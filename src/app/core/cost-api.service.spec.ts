import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CostApiService } from './cost-api.service';
import { ApiError } from './api.types';

describe('CostApiService', () => {
  let service: CostApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CostApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('unwraps a successful envelope into rows + meta', () => {
    let rows: unknown;
    service.summary({}).subscribe((r) => (rows = r.rows));
    http
      .expectOne((req) => req.url === '/v1/costs/summary')
      .flush({
        data: [{ currency: 'USD', cost: '12.34', resources: 1, line_items: 2 }],
        meta: { freshness: { data_through: 'x', loaded_at: 'y' } },
        error: null,
      });
    expect(rows).toEqual([{ currency: 'USD', cost: '12.34', resources: 1, line_items: 2 }]);
  });

  // Panels branch on error.code — envelope errors must become typed ApiErrors.
  it('maps envelope errors to typed ApiError with code', () => {
    let error: ApiError | undefined;
    service.breakdown({}, 'service').subscribe({ error: (e) => (error = e) });
    http
      .expectOne((req) => req.url === '/v1/costs/breakdown')
      .flush({
        data: null,
        meta: {},
        error: { code: 'VALIDATION_ERROR', message: 'unsupported dimension' },
      });
    expect(error).toBeInstanceOf(ApiError);
    expect(error!.code).toBe('VALIDATION_ERROR');
    expect(error!.message).toBe('unsupported dimension');
  });

  // UI "" (untagged) must become the API's __untagged__ sentinel — the API ignores empty params.
  it('translates empty-string filters to the untagged sentinel and drops unset ones', () => {
    service.summary({ env: '', service: 'COMPUTE' }).subscribe();
    const req = http.expectOne((r) => r.url === '/v1/costs/summary');
    expect(req.request.params.get('env')).toBe('__untagged__');
    expect(req.request.params.get('service')).toBe('COMPUTE');
    expect(req.request.params.has('compartment')).toBe(false);
    req.flush({ data: [], meta: {}, error: null });
  });

  it('passes filtered options and the optional breakdown series flag', () => {
    service.filters({ env: 'prod' }).subscribe();
    const filters = http.expectOne((r) => r.url === '/v1/costs/filters');
    expect(filters.request.params.get('env')).toBe('prod');
    filters.flush({ data: [], meta: {}, error: null });

    service.breakdown({}, 'service', 15, true, 'week').subscribe();
    const breakdown = http.expectOne((r) => r.url === '/v1/costs/breakdown');
    expect(breakdown.request.params.get('series')).toBe('true');
    expect(breakdown.request.params.get('granularity')).toBe('week');
    breakdown.flush({ data: [], meta: {}, error: null });
  });

  it('forwards analysis filters, range, dimension, and options', () => {
    service
      .anomalies({ start: '2026-07-01T00:00:00Z', end: '2026-07-13T00:00:00Z', service: 'COMPUTE', env: 'prod' }, 'service', { window: 14, minZ: 5, minImpact: 200 })
      .subscribe();
    const anomalies = http.expectOne((r) => r.url === '/v1/costs/anomalies');
    expect(anomalies.request.params.get('start')).toBe('2026-07-01T00:00:00Z');
    expect(anomalies.request.params.get('service')).toBe('COMPUTE');
    expect(anomalies.request.params.get('env')).toBe('prod');
    expect(anomalies.request.params.get('dimension')).toBe('service');
    expect(anomalies.request.params.get('window')).toBe('14');
    expect(anomalies.request.params.get('min_z')).toBe('5');
    expect(anomalies.request.params.get('min_impact')).toBe('200');
    anomalies.flush({ data: [], meta: {}, error: null });

    service.trendMovers({ service: 'COMPUTE' }, 'resource_name', { granularity: 'week' }).subscribe();
    const trends = http.expectOne((r) => r.url === '/v1/costs/trends');
    expect(trends.request.params.get('service')).toBe('COMPUTE');
    expect(trends.request.params.get('dimension')).toBe('resource_name');
    expect(trends.request.params.get('granularity')).toBe('week');
    trends.flush({ data: [], meta: {}, error: null });
  });

  // A 200 body without the envelope must still give panels a controlled error state.
  it('maps an empty or malformed analysis response to ApiError', () => {
    let error: unknown;
    service.anomalies({}, 'service').subscribe({ error: (value) => (error = value) });
    http.expectOne((r) => r.url === '/v1/costs/anomalies').flush(null);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).message).toBe('Invalid response envelope');
  });

  it('passes inherited scope to a resource-detail request', () => {
    service
      .resourceDetail('ocid1.resource.example', {
        start: '2026-06-01T00:00:00.000Z',
        end: '2026-06-30T00:00:00.000Z',
        compartment: 'prod',
      })
      .subscribe();
    const req = http.expectOne((r) => r.url === '/v1/costs/resources/ocid1.resource.example');
    expect(req.request.params.get('start')).toBe('2026-06-01T00:00:00.000Z');
    expect(req.request.params.get('compartment')).toBe('prod');
    req.flush({ data: [], meta: {}, error: null });
  });

  it('requests grouped resource children with parent scope, search, and fixed month grain', () => {
    let rows: unknown;
    service
      .groupedResources(
        { service: 'COMPUTE' },
        'environment',
        'cost_center',
        { group1Value: '', group2Value: 'platform', q: '  payments  ' },
      )
      .subscribe((result) => (rows = result.rows));
    const req = http.expectOne((r) => r.url === '/v1/costs/resources/grouped');
    expect(req.request.params.get('group1')).toBe('environment');
    expect(req.request.params.get('group2')).toBe('cost_center');
    expect(req.request.params.get('group1_value')).toBe('__untagged__');
    expect(req.request.params.get('group2_value')).toBe('platform');
    expect(req.request.params.get('q')).toBe('payments');
    expect(req.request.params.get('grain')).toBe('month');
    expect(req.request.params.get('service')).toBe('COMPUTE');
    req.flush({ data: [{ kind: 'group', depth: 1, group_value: 'platform', currency: 'USD', subtotal_cost: '12.34', row_count: 2 }], meta: {}, error: null });
    expect(rows).toEqual([{ kind: 'group', depth: 1, group_value: 'platform', currency: 'USD', subtotal_cost: '12.34', row_count: 2 }]);
  });

  it('rejects duplicate grouped dimensions before issuing a request', () => {
    let error: ApiError | undefined;
    service.groupedResources({}, 'environment', 'environment').subscribe({ error: (value) => (error = value) });
    expect(error).toBeInstanceOf(ApiError);
    expect(error?.code).toBe('VALIDATION_ERROR');
  });
});
