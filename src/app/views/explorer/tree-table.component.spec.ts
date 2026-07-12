import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { CostApiService } from '../../core/cost-api.service';
import { FiltersStore } from '../../core/filters-store';
import { TreeRow, TreeTableComponent } from './tree-table.component';

describe('TreeTableComponent', () => {
  it('keeps ancestor scope when drilling into resources', () => {
    const navigations: Array<{ commands: unknown[]; extras: { queryParams: unknown } }> = [];
    TestBed.configureTestingModule({
      providers: [
        { provide: CostApiService, useValue: { breakdown: () => of({ rows: [], meta: {} }) } },
        {
          provide: Router,
          useValue: {
            navigate: (commands: unknown[], extras: { queryParams: unknown }) => {
              navigations.push({ commands, extras });
              return Promise.resolve(true);
            },
          },
        },
      ],
    });
    const filters = TestBed.inject(FiltersStore);
    filters.setFilter('env', 'dev');
    filters.hierarchy.set(['compartment', 'resource_name']);
    filters.search.set('boot');
    const component = TestBed.createComponent(TreeTableComponent).componentInstance;
    const row: TreeRow = {
      id: 'prod|boot volume',
      path: ['prod', 'boot volume'],
      ancestorFilters: { compartment: 'prod' },
      depth: 1,
      dimension: 'resource_name',
      value: 'boot volume',
      cost: '1',
      currency: 'USD',
      resources: 1,
      share: 1,
    };

    (component as any).openResources(row);

    expect(navigations).toEqual([
      {
        commands: ['/resources'],
        extras: {
          queryParams: expect.objectContaining({
            env: 'dev',
            compartment: 'prod',
            resource_name: 'boot volume',
          }),
        },
      },
    ]);
    expect(navigations[0].extras.queryParams).not.toEqual(
      expect.objectContaining({ hier: expect.anything(), search: expect.anything() }),
    );
  });
});
