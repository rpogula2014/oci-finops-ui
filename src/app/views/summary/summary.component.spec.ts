import { TestBed } from '@angular/core/testing';
import { NEVER } from 'rxjs';
import { CostApiService } from '../../core/cost-api.service';
import { FiltersStore } from '../../core/filters-store';
import { SummaryComponent } from './summary.component';

describe('SummaryComponent', () => {
  it('uses global context and keeps Summary bar filters out of FiltersStore', () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: CostApiService,
          useValue: {
            execSummary: () => NEVER,
            breakdown: () => NEVER,
            timeseries: () => NEVER,
          },
        },
      ],
    });
    const filters = TestBed.inject(FiltersStore);
    filters.setFilter('service', 'COMPUTE');
    const component = TestBed.createComponent(SummaryComponent).componentInstance as any;

    expect(component.summaryQuery()).toEqual({ start: filters.start(), end: filters.end() });

    component.toggleFilter('service', 'Object Storage');

    expect(filters.filter('service')()).toBe('COMPUTE');
    expect(component.filterValue('service')).toBe('Object Storage');
    expect(component.summaryQuery()).toEqual({
      start: filters.start(),
      end: filters.end(),
      service: 'Object Storage',
    });
  });
});
