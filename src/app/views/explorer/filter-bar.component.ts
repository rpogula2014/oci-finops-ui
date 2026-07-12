import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { EMPTY, catchError, debounceTime, forkJoin, map, switchMap } from 'rxjs';
import { CostQuery, Dimension, FiltersRow, Granularity } from '../../core/api.types';
import { CostApiService } from '../../core/cost-api.service';
import { DEFAULT_HIERARCHY, DIMENSION_LABELS, DimensionFilterKey, FiltersStore } from '../../core/filters-store';
import { labelForFilterValue } from '../../core/currency';

interface FilterControl { key: DimensionFilterKey; label: string; options: string[]; }
const FILTER_FIELDS: Array<{ key: DimensionFilterKey; label: string; responseKey: keyof FiltersRow }> = [
  { key: 'env', label: 'Environment', responseKey: 'environments' },
  { key: 'cost_center', label: 'Cost Center', responseKey: 'cost_centers' },
  { key: 'component_type', label: 'Component', responseKey: 'component_types' },
  { key: 'compartment', label: 'Compartment', responseKey: 'compartments' },
  { key: 'service', label: 'Service', responseKey: 'services' },
  { key: 'resource_type', label: 'Resource Type', responseKey: 'resource_types' },
  { key: 'resource_name', label: 'Resource Name', responseKey: 'resource_names' },
];
const ALL_DIMENSIONS = Object.keys(DIMENSION_LABELS) as Dimension[];

@Component({
  selector: 'app-explorer-filter-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="filter-bar card" aria-label="Cost filters">
      <div class="controls">
        @for (control of controls(); track control.key) {
          <label><span class="eyebrow">{{ control.label }}</span>
            <select (change)="setFilter(control.key, $event)" [attr.aria-label]="control.label">
              <option value="__any__" [selected]="filters.filter(control.key)() === null">All</option>
              @for (option of control.options; track option) { <option [value]="option" [selected]="filters.filter(control.key)() === option">{{ labelFor(option) }}</option> }
            </select>
          </label>
        }
        <label><span class="eyebrow">Name contains</span><input [value]="filters.search()" (input)="filters.search.set(searchValue($event))" placeholder="Searches loaded rows" /></label>
        <label><span class="eyebrow">Start</span><input type="date" [value]="datePart(filters.start())" (change)="setDate('start', $event)" /></label>
        <label><span class="eyebrow">End</span><input type="date" [value]="datePart(filters.end())" (change)="setDate('end', $event)" /></label>
        <label><span class="eyebrow">Grain</span><select (change)="setGrain($event)">@for (grain of grains; track grain) { <option [value]="grain" [selected]="grain === filters.granularity()">{{ grain }}</option> }</select></label>
      </div>
      <div class="hierarchy"><span class="eyebrow">Hierarchy</span>
        @for (dimension of filters.hierarchy(); track dimension; let index = $index) {
          <span class="chip">{{ labels[dimension] }} <button (click)="move(index, -1)" [disabled]="index === 0">↑</button><button (click)="move(index, 1)" [disabled]="index === filters.hierarchy().length - 1">↓</button><button (click)="remove(index)" [disabled]="filters.hierarchy().length === 1">×</button></span>
        }
        <select (change)="addDimension($event)" aria-label="Add hierarchy dimension"><option value="">Add dimension…</option>@for (dimension of remainingDimensions(); track dimension) { <option [value]="dimension">{{ labels[dimension] }}</option> }</select>
        <button (click)="filters.setHierarchy(DEFAULT_HIERARCHY)">Reset hierarchy</button>
      </div>
    </section>
  `,
  styles: `
    .filter-bar { display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px; }
    .controls { display: grid; grid-template-columns: repeat(auto-fit, minmax(145px, 1fr)); align-items: end; gap: 10px; width: 100%; }
    .hierarchy { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
    label { display: flex; flex-direction: column; min-width: 0; gap: 3px; font-size: 12px; }
    select, input { width: 100%; min-width: 0; box-sizing: border-box; }
    .chip { display: inline-flex; align-items: center; gap: 2px; background: var(--atd-logistics-blue); border-radius: 16px; padding: 3px 7px; font-size: 12px; }
    .chip button { padding: 0 3px; border: none; background: transparent; }
    @media (max-width: 700px) { .controls { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 420px) { .controls { grid-template-columns: 1fr; } }
  `,
})
export class FilterBarComponent {
  private readonly api = inject(CostApiService);
  protected readonly filters = inject(FiltersStore);
  protected readonly labels = DIMENSION_LABELS;
  protected readonly grains: Granularity[] = ['hour', 'day', 'week', 'month'];
  protected readonly DEFAULT_HIERARCHY = DEFAULT_HIERARCHY;
  private readonly options = signal<Record<DimensionFilterKey, string[]>>({
    env: [], cost_center: [], component_type: [], compartment: [], service: [], resource_type: [], resource_name: [], ocid: [],
  });
  protected readonly controls = computed<FilterControl[]>(() => FILTER_FIELDS.map((field) => ({ ...field, options: this.options()[field.key] })));
  protected readonly remainingDimensions = computed(() => ALL_DIMENSIONS.filter((dimension) => !this.filters.hierarchy().includes(dimension)));
  protected labelFor = labelForFilterValue;

  constructor() {
    const key = computed(() => ({ query: this.filters.query(), start: this.filters.start(), end: this.filters.end() }));
    toObservable(key).pipe(
      debounceTime(150),
      switchMap(({ query }) => forkJoin(this.optionRequests(query)).pipe(
        map((responses) => {
          const options = { ...this.options() };
          for (const { fields, row } of responses) {
            for (const field of fields) options[field.key] = row?.[field.responseKey] ?? [];
          }
          this.options.set(options);
          for (const field of FILTER_FIELDS) {
            const selected = this.filters.filter(field.key)();
            if (selected !== null && !options[field.key].includes(selected)) this.filters.setFilter(field.key, null);
          }
        }),
        catchError(() => EMPTY),
      )),
    ).subscribe();
  }

  protected setFilter(key: DimensionFilterKey, event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.filters.setFilter(key, value === '__any__' ? null : value);
  }
  protected searchValue(event: Event): string { return (event.target as HTMLInputElement).value; }
  protected datePart(value: string): string { return value.slice(0, 10); }
  protected setDate(which: 'start' | 'end', event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (!value) return;
    const start = which === 'start' ? new Date(`${value}T00:00:00.000Z`).toISOString() : this.filters.start();
    const end = which === 'end' ? new Date(`${value}T23:59:59.999Z`).toISOString() : this.filters.end();
    this.filters.setRange(start, end);
  }
  protected setGrain(event: Event): void { this.filters.granularity.set((event.target as HTMLSelectElement).value as Granularity); }
  protected addDimension(event: Event): void {
    const dimension = (event.target as HTMLSelectElement).value as Dimension;
    if (dimension) this.filters.setHierarchy([...this.filters.hierarchy(), dimension]);
    (event.target as HTMLSelectElement).value = '';
  }
  protected remove(index: number): void { this.filters.setHierarchy(this.filters.hierarchy().filter((_, current) => current !== index)); }
  protected move(index: number, by: number): void {
    const next = index + by;
    if (next < 0 || next >= this.filters.hierarchy().length) return;
    const hierarchy = [...this.filters.hierarchy()];
    [hierarchy[index], hierarchy[next]] = [hierarchy[next], hierarchy[index]];
    this.filters.setHierarchy(hierarchy);
  }
  private upstreamQuery(query: CostQuery, index: number): CostQuery {
    const upstream: CostQuery = { start: query.start, end: query.end };
    for (const field of FILTER_FIELDS.slice(0, index)) {
      const value = query[field.key];
      if (value !== undefined) upstream[field.key] = value;
    }
    return upstream;
  }

  /**
   * Several controls share the same upstream constraints (all controls do on
   * first load). Fetch each distinct `/filters` query once, then fan its
   * response out locally instead of opening seven concurrent API requests.
   */
  private optionRequests(query: CostQuery) {
    const groups = new Map<string, { query: CostQuery; fields: typeof FILTER_FIELDS }>();
    for (const [index, field] of FILTER_FIELDS.entries()) {
      const upstream = this.upstreamQuery(query, index);
      const key = JSON.stringify(upstream);
      const group = groups.get(key);
      if (group) group.fields.push(field);
      else groups.set(key, { query: upstream, fields: [field] });
    }
    return [...groups.values()].map(({ query: upstream, fields }) =>
      this.api.filters(upstream).pipe(map(({ rows }) => ({ fields, row: rows[0] }))),
    );
  }
}
