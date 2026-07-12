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
      .flush({ data: null, meta: {}, error: { code: 'VALIDATION_ERROR', message: 'unsupported dimension' } });
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
});
