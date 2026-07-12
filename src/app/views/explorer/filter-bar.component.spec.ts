import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { CostApiService } from '../../core/cost-api.service';
import { FiltersStore } from '../../core/filters-store';
import { FilterBarComponent } from './filter-bar.component';

describe('FilterBarComponent', () => {
  it('clears dimensions, search, and selection without resetting explorer state', () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: CostApiService, useValue: { filters: () => of({ rows: [], meta: {} }) } },
      ],
    });
    const filters = TestBed.inject(FiltersStore);
    filters.setFilter('env', 'dev');
    filters.search.set('boot');
    filters.selectedPath.set('prod|boot');
    filters.expandedPaths.set(['prod']);
    filters.granularity.set('week');
    filters.hierarchy.set(['service', 'compartment']);
    const component = TestBed.createComponent(FilterBarComponent).componentInstance;

    (component as any).clearFilters();

    expect(filters.filter('env')()).toBeNull();
    expect(filters.search()).toBe('');
    expect(filters.selectedPath()).toBeNull();
    expect(filters.expandedPaths()).toEqual(['prod']);
    expect(filters.granularity()).toBe('week');
    expect(filters.hierarchy()).toEqual(['service', 'compartment']);
    expect((component as any).canClearFilters()).toBe(false);
  });
});
