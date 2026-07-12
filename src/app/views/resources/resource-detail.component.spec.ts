import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, provideRouter, RouterLink } from '@angular/router';
import { of } from 'rxjs';
import { CostApiService } from '../../core/cost-api.service';
import { ResourceDetailComponent } from './resource-detail.component';

describe('ResourceDetailComponent', () => {
  it('hydrates scope and sends it to both detail requests', async () => {
    const requests: Array<{ kind: string; query: Record<string, string> }> = [];
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParams: {
                compartment: 'prod',
                start: '2026-06-01T00:00:00.000Z',
                end: '2026-06-30T00:00:00.000Z',
              },
            },
          },
        },
        {
          provide: CostApiService,
          useValue: {
            resourceDetail: (_ocid: string, query: Record<string, string>) => {
              requests.push({ kind: 'detail', query });
              return of({ rows: [], meta: {} });
            },
            lineItems: (_ref: unknown, _grain: unknown, query: Record<string, string>) => {
              requests.push({ kind: 'lineitems', query });
              return of({ rows: [], meta: {} });
            },
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(ResourceDetailComponent);
    fixture.componentRef.setInput('ocid', 'ocid1.resource.example');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(requests).toEqual(
      expect.arrayContaining([
        {
          kind: 'detail',
          query: expect.objectContaining({
            compartment: 'prod',
            start: '2026-06-01T00:00:00.000Z',
          }),
        },
        {
          kind: 'lineitems',
          query: expect.objectContaining({
            compartment: 'prod',
            start: '2026-06-01T00:00:00.000Z',
          }),
        },
      ]),
    );
    expect(fixture.debugElement.query(By.directive(RouterLink)).injector.get(RouterLink).queryParamsHandling).toBe('preserve');
  });
});
