import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { EMPTY, of } from 'rxjs';
import { vi } from 'vitest';
import { CostApiService } from '../../core/cost-api.service';
import { FiltersStore } from '../../core/filters-store';
import { GroupedResourceTableComponent } from './grouped-resource-table.component';

const rootGroup = { kind: 'group' as const, depth: 0, group_value: 'dev', currency: 'USD', subtotal_cost: '20.00', row_count: 2 };
const childGroup = { kind: 'group' as const, depth: 1, group_value: 'platform', currency: 'USD', subtotal_cost: '20.00', row_count: 2 };
const otherGroup = { kind: 'other' as const, depth: 0, group_value: 'Other', currency: 'USD', subtotal_cost: '5.00', row_count: 1 };
const leaf = {
  kind: 'leaf' as const,
  period: '2026-01',
  environment: 'dev',
  cost_center: 'platform',
  component_type: 'app',
  compartment: 'prod',
  service: 'COMPUTE',
  resource_type: 'instance',
  resource_name: 'payments-api',
  ocid: 'ocid1.instance.example',
  currency: 'USD',
  cost: '20.00',
};

describe('GroupedResourceTableComponent', () => {
  function create(api: { groupedResources: ReturnType<typeof vi.fn> }) {
    TestBed.configureTestingModule({
      providers: [
        { provide: CostApiService, useValue: api },
        { provide: Router, useValue: { navigate: () => Promise.resolve(true) } },
      ],
    });
    const fixture = TestBed.createComponent(GroupedResourceTableComponent);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, filters: TestBed.inject(FiltersStore) };
  }

  it('prevents selecting the first dimension as the second dimension', () => {
    const { component } = create({ groupedResources: vi.fn(() => EMPTY) });
    (component as any).setGroup2({ target: { value: 'environment' } });
    expect((component as any).group2()).toBeNull();
    expect((component as any).secondDimensions()).not.toContain('environment');
  });

  it('expands with parent values and renders Other as terminal', async () => {
    const groupedResources = vi.fn((_query, _group1, _group2, opts) => of({ rows: opts?.group2Value ? [leaf] : opts?.group1Value ? [childGroup] : [rootGroup, otherGroup], meta: {} }));
    const { component } = create({ groupedResources });
    (component as any).roots.set((component as any).makeRows([rootGroup, otherGroup], 0, []));
    const [group, other] = (component as any).roots();

    expect((component as any).canExpand(other)).toBe(false);
    (component as any).toggle(group);
    await Promise.resolve();
    expect(groupedResources).toHaveBeenLastCalledWith(expect.any(Object), 'environment', 'cost_center', expect.objectContaining({ group1Value: 'dev' }));
    expect(group.children[0].row).toEqual(childGroup);
    (component as any).toggle(group.children[0]);
    await Promise.resolve();
    expect(groupedResources).toHaveBeenLastCalledWith(expect.any(Object), 'environment', 'cost_center', expect.objectContaining({ group1Value: 'dev', group2Value: 'platform' }));
    expect(group.children[0].children[0].row).toEqual(leaf);
  });

  it('sends the debounced search term to the grouped endpoint', async () => {
    vi.useFakeTimers();
    const groupedResources = vi.fn(() => of({ rows: [], meta: {} }));
    const { component, fixture } = create({ groupedResources });
    await vi.advanceTimersByTimeAsync(201);
    groupedResources.mockClear();
    (component as any).setSearch({ target: { value: 'payments' } });
    fixture.detectChanges();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(201);
    expect(groupedResources).toHaveBeenLastCalledWith(expect.any(Object), 'environment', 'cost_center', expect.objectContaining({ q: 'payments' }));
    vi.useRealTimers();
  });

  it('exports visible group and leaf rows as CSV', () => {
    const { component } = create({ groupedResources: vi.fn(() => EMPTY) });
    const root = (component as any).makeRows([rootGroup], 0, [])[0];
    root.children = (component as any).makeRows([leaf], 1, root.path);
    (component as any).roots.set([root]);
    (component as any).expanded.set([root.id]);
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:grouped');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    (component as any).exportCsv();

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:grouped');
    createObjectURL.mockRestore();
    revokeObjectURL.mockRestore();
    click.mockRestore();
  });
});
