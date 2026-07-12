import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { EMPTY } from 'rxjs';
import { CostApiService } from '../../core/cost-api.service';
import { FiltersStore } from '../../core/filters-store';
import { ResourcesComponent } from './resources.component';

describe('ResourcesComponent', () => {
  it('renders scope chips without ocid and clears a dismissed chip from the URL', async () => {
    const navigations: Array<{
      commands: unknown[];
      extras: { queryParams: Record<string, string> };
    }> = [];
    TestBed.configureTestingModule({
      providers: [
        { provide: CostApiService, useValue: { resources: () => EMPTY, groupedResources: () => EMPTY } },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParams: {} } } },
        {
          provide: Router,
          useValue: {
            navigate: (commands: unknown[], extras: { queryParams: Record<string, string> }) => {
              navigations.push({ commands, extras });
              return Promise.resolve(true);
            },
          },
        },
      ],
    });
    const filters = TestBed.inject(FiltersStore);
    filters.setFilter('compartment', 'prod');
    filters.setFilter('cost_center', '');
    filters.setFilter('ocid', 'ocid1.resource.example');
    const fixture = TestBed.createComponent(ResourcesComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();

    expect((component as any).chips()).toEqual([
      { key: 'cost_center', label: 'Cost Center', value: '' },
      { key: 'compartment', label: 'Compartment', value: 'prod' },
    ]);
    expect((component as any).labelFor((component as any).chips()[0].value)).toBe('(untagged)');
    (component as any).page.set(3);
    (component as any).dismiss('compartment');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(filters.filter('compartment')()).toBeNull();
    expect((component as any).page()).toBe(1);
    expect(navigations.at(-1)?.extras.queryParams).not.toHaveProperty('compartment');
  });

  it('carries active scope to a resource detail route', () => {
    const navigations: Array<{
      commands: unknown[];
      extras: { queryParams: Record<string, string> };
    }> = [];
    TestBed.configureTestingModule({
      providers: [
        { provide: CostApiService, useValue: { resources: () => EMPTY, groupedResources: () => EMPTY } },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParams: {} } } },
        {
          provide: Router,
          useValue: {
            navigate: (commands: unknown[], extras: { queryParams: Record<string, string> }) => {
              navigations.push({ commands, extras });
              return Promise.resolve(true);
            },
          },
        },
      ],
    });
    const filters = TestBed.inject(FiltersStore);
    filters.setFilter('compartment', 'prod');
    const component = TestBed.createComponent(ResourcesComponent).componentInstance;

    (component as any).open({ ocid: 'ocid1.resource.example' });

    expect(navigations.at(-1)).toEqual(
      expect.objectContaining({
        commands: ['/resources', 'ocid1.resource.example'],
        extras: { queryParams: expect.objectContaining({ compartment: 'prod' }) },
      }),
    );
  });

  it('uses the grouped table on a direct landing and keeps the flat table for resource scope', async () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: CostApiService, useValue: { resources: () => EMPTY, groupedResources: () => EMPTY } },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParams: {} } } },
        { provide: Router, useValue: { navigate: () => Promise.resolve(true) } },
      ],
    });
    const filters = TestBed.inject(FiltersStore);
    const fixture = TestBed.createComponent(ResourcesComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('app-grouped-resource-table')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('table[aria-label="Resources with cost"]')).toBeNull();

    filters.setFilter('resource_name', 'payments-api');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-grouped-resource-table')).toBeNull();
    expect(fixture.nativeElement.querySelector('.card')).not.toBeNull();
  });
});
