import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { EMPTY, catchError, debounceTime, forkJoin, map, of, switchMap } from 'rxjs';
import {
  ApiError,
  BreakdownRow,
  Dimension,
  FiltersRow,
  Granularity,
  LineItemsRow,
} from '../../core/api.types';
import { CostApiService } from '../../core/cost-api.service';
import {
  DIMENSION_LABELS,
  DIMENSION_TO_FILTER,
  DimensionFilterKey,
  FiltersStore,
} from '../../core/filters-store';
import { labelForFilterValue, parseCost, partitionByCurrency } from '../../core/currency';
import { MoneyPipe } from '../../shared/money.pipe';
import { PanelStateComponent, PanelStatus } from '../../shared/panel-state.component';

interface Crumb {
  dimension: Dimension;
  value: string;
}

interface NodeDetail {
  value: string;
  cost: string;
  currency: string;
  resources: number;
  momDelta: number | null;
  lineItems: LineItemsRow[] | null;
}

/** drill URL param: dim~value|dim~value (values URI-encoded). */
function serializeCrumbs(crumbs: Crumb[]): string {
  return crumbs.map((c) => `${c.dimension}~${encodeURIComponent(c.value)}`).join('|');
}

function parseCrumbs(raw: string | undefined): Crumb[] {
  if (!raw) return [];
  return raw
    .split('|')
    .map((part) => {
      const idx = part.indexOf('~');
      return idx < 0 ? null : { dimension: part.slice(0, idx) as Dimension, value: decodeURIComponent(part.slice(idx + 1)) };
    })
    .filter((c): c is Crumb => c !== null && c.dimension in DIMENSION_TO_FILTER);
}

@Component({
  selector: 'app-explorer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MoneyPipe, PanelStateComponent],
  template: `
    <span class="eyebrow">Cost Explorer</span>
    <h1>Explore costs</h1>

    <div class="explorer-grid">
      <aside class="rail card">
        <h3>Filters</h3>
        <label class="rail-field">
          <span class="eyebrow">Grain</span>
          <select (change)="onGrain($event)" aria-label="Granularity">
            @for (g of grains; track g) {
              <option [value]="g" [selected]="g === filters.granularity()">{{ g }}</option>
            }
          </select>
        </label>
        @for (control of filterControls(); track control.key) {
          <label class="rail-field">
            <span class="eyebrow">{{ control.label }}</span>
            <select (change)="onFilter(control.key, $event)" [attr.aria-label]="control.label">
              <option value="__any__" [selected]="filters.filter(control.key)() === null">Any</option>
              @for (option of control.options; track option) {
                <option [value]="option" [selected]="option === filters.filter(control.key)()">
                  {{ labelFor(option) }}
                </option>
              }
            </select>
          </label>
        }
        <button (click)="clearAll()">Clear all</button>
      </aside>

      <section class="main">
        <nav class="crumbs" aria-label="Drill path">
          <button class="crumb" (click)="resetDrill()">All costs</button>
          @for (crumb of crumbs(); track $index) {
            <span aria-hidden="true">›</span>
            <button class="crumb" (click)="popTo($index)">
              {{ dimensionLabels[crumb.dimension] }}: {{ labelFor(crumb.value) }}
            </button>
          }
        </nav>

        <div class="table-head">
          <label>
            <span class="eyebrow">Group by</span>
            <select (change)="onGroupBy($event)" aria-label="Group by dimension">
              @for (d of availableDimensions(); track d) {
                <option [value]="d" [selected]="d === groupBy()">{{ dimensionLabels[d] }}</option>
              }
            </select>
          </label>
          <button (click)="exportCsv()" [disabled]="!rows().data?.length">CSV ↧</button>
        </div>

        <div class="card">
          <app-panel-state [status]="rows().status" [error]="rows().error">
            <table class="data" aria-label="Cost by selected dimension">
              <thead>
                <tr>
                  <th scope="col">{{ dimensionLabels[groupBy()] }}</th>
                  <th scope="col" class="num">Cost</th>
                  <th scope="col" class="num">Resources</th>
                  <th scope="col"></th>
                </tr>
              </thead>
              <tbody>
                @for (row of rows().data; track row.dimension_value + row.currency) {
                  <tr
                    [class.selected]="selected()?.value === row.dimension_value"
                    (click)="select(row)"
                    tabindex="0"
                    (keydown.enter)="select(row)"
                  >
                    <td>{{ labelFor(row.dimension_value) }}</td>
                    <td class="num">{{ row.cost | money: row.currency }}</td>
                    <td class="num">{{ row.resources }}</td>
                    <td class="actions">
                      <button (click)="drillInto(row); $event.stopPropagation()">Drill ›</button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </app-panel-state>
        </div>
      </section>

      <aside class="detail card">
        @if (selected(); as node) {
          <span class="eyebrow">{{ dimensionLabels[groupBy()] }}</span>
          <h3>{{ labelFor(node.value) }}</h3>
          <div class="detail-row">
            <span>Cost</span><strong>{{ node.cost | money: node.currency }}</strong>
          </div>
          <div class="detail-row">
            <span>Resources</span><strong>{{ node.resources }}</strong>
          </div>
          @if (node.momDelta !== null) {
            <div class="detail-row">
              <span>MoM delta</span>
              <strong [class.overage]="node.momDelta > 0">
                {{ node.momDelta > 0 ? '+' : '' }}{{ node.momDelta | money: node.currency }}
              </strong>
            </div>
          }
          @if (node.lineItems; as items) {
            <h3 class="section">Line items ({{ filters.granularity() }})</h3>
            <div class="detail-row"><span>Total items</span><strong>{{ sumItems(items) }}</strong></div>
            <div class="detail-row">
              <span>Overage items</span>
              <strong [class.overage]="sumOverage(items) > 0">{{ sumOverage(items) }}</strong>
            </div>
            <div class="detail-row">
              <span>My cost</span><strong>{{ sumMyCost(items) | money: node.currency }}</strong>
            </div>
          }
          @if (groupBy() === 'resource_name') {
            <button (click)="openResources(node.value)">View resources ›</button>
          }
        } @else {
          <p class="hint">Select a row to see node detail.</p>
        }
      </aside>
    </div>
  `,
  styles: `
    .explorer-grid { display: grid; grid-template-columns: 220px 1fr 260px; gap: 16px; align-items: start; }
    .rail, .detail { display: flex; flex-direction: column; gap: 12px; }
    .rail-field { display: flex; flex-direction: column; gap: 4px; }
    .rail select { width: 100%; }
    .crumbs { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 12px; }
    .crumb { background: var(--atd-logistics-blue); border: none; color: var(--atd-distribution-blue); font-weight: 700; }
    .table-head { display: flex; justify-content: space-between; align-items: end; margin-bottom: 8px; }
    .table-head label { display: flex; flex-direction: column; gap: 4px; }
    td.num, th.num { text-align: right; }
    tbody tr { cursor: pointer; }
    tbody tr.selected { background: var(--atd-logistics-blue); }
    td.actions { text-align: right; }
    td.actions button { font-size: 12px; padding: 2px 8px; }
    .detail-row { display: flex; justify-content: space-between; font-size: 13px; }
    .detail-row .overage { color: var(--atd-error); }
    .detail h3.section { margin-top: 8px; }
    .hint { color: var(--atd-grey-700); font-size: 13px; }
    @media (max-width: 1100px) { .explorer-grid { grid-template-columns: 1fr; } }
  `,
})
export class ExplorerComponent {
  private readonly api = inject(CostApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly filters = inject(FiltersStore);

  protected readonly grains: Granularity[] = ['hour', 'day', 'week', 'month'];
  protected readonly dimensionLabels = DIMENSION_LABELS;

  protected readonly groupBy = signal<Dimension>('service');
  protected readonly crumbs = signal<Crumb[]>([]);
  protected readonly filterOptions = signal<FiltersRow | null>(null);
  protected readonly rows = signal<{ status: PanelStatus; data: BreakdownRow[] | null; error: ApiError | null }>({
    status: 'loading',
    data: null,
    error: null,
  });
  protected readonly selected = signal<NodeDetail | null>(null);

  constructor() {
    // hydrate filters + drill state from URL (deep links)
    const params = this.route.snapshot.queryParams;
    this.filters.hydrateFromParams(params);
    this.crumbs.set(parseCrumbs(params['drill']));
    const groupBy = params['groupBy'];
    if (groupBy && groupBy in DIMENSION_TO_FILTER) this.groupBy.set(groupBy);

    this.api.filters().subscribe(({ rows }) => this.filterOptions.set(rows[0] ?? null));

    const key = computed(() => ({ query: this.filters.query(), dimension: this.groupBy() }));
    toObservable(key)
      .pipe(
        debounceTime(200),
        switchMap(({ query, dimension }) => {
          this.rows.set({ status: 'loading', data: null, error: null });
          this.selected.set(null);
          this.syncUrl();
          return this.api.breakdown(query, dimension, 20).pipe(
            map(({ rows }) =>
              this.rows.set({ status: rows.length ? 'ready' : 'empty', data: rows, error: null }),
            ),
            catchError((error: ApiError) => {
              this.rows.set({ status: 'error', data: null, error });
              return EMPTY;
            }),
          );
        }),
      )
      .subscribe();
  }

  protected labelFor = labelForFilterValue;

  protected readonly filterControls = computed(() => {
    const options = this.filterOptions();
    if (!options) return [];
    return [
      { key: 'env' as const, label: 'Environment', options: options.environments },
      { key: 'cost_center' as const, label: 'Cost Center', options: options.cost_centers },
      { key: 'component_type' as const, label: 'Component Type', options: options.component_types },
      { key: 'compartment' as const, label: 'Compartment', options: options.compartments },
      { key: 'service' as const, label: 'Service', options: options.services },
      { key: 'resource_type' as const, label: 'Resource Type', options: options.resource_types },
      { key: 'resource_name' as const, label: 'Resource Name', options: options.resource_names },
    ];
  });

  /** Dimensions not already consumed by a crumb. */
  protected readonly availableDimensions = computed<Dimension[]>(() => {
    const used = new Set(this.crumbs().map((c) => c.dimension));
    return (Object.keys(DIMENSION_TO_FILTER) as Dimension[]).filter((d) => !used.has(d) || d === this.groupBy());
  });

  protected onGrain(event: Event): void {
    this.filters.granularity.set((event.target as HTMLSelectElement).value as Granularity);
    this.syncUrl();
  }

  protected onFilter(key: DimensionFilterKey, event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.filters.setFilter(key, value === '__any__' ? null : value);
  }

  protected onGroupBy(event: Event): void {
    this.groupBy.set((event.target as HTMLSelectElement).value as Dimension);
  }

  protected clearAll(): void {
    this.filters.clearFilters();
    this.crumbs.set([]);
    this.groupBy.set('service');
  }

  protected drillInto(row: BreakdownRow): void {
    const dimension = this.groupBy();
    this.crumbs.update((crumbs) => [...crumbs, { dimension, value: row.dimension_value }]);
    this.filters.setFilter(DIMENSION_TO_FILTER[dimension], row.dimension_value);
    const next = this.availableDimensions().find((d) => d !== dimension);
    if (next) this.groupBy.set(next);
  }

  protected popTo(index: number): void {
    const removed = this.crumbs().slice(index);
    for (const crumb of removed) this.filters.setFilter(DIMENSION_TO_FILTER[crumb.dimension], null);
    this.crumbs.update((crumbs) => crumbs.slice(0, index));
    if (removed.length) this.groupBy.set(removed[0].dimension);
  }

  protected resetDrill(): void {
    this.popTo(0);
  }

  protected select(row: BreakdownRow): void {
    const dimension = this.groupBy();
    const base: NodeDetail = {
      value: row.dimension_value,
      cost: row.cost,
      currency: row.currency,
      resources: row.resources,
      momDelta: null,
      lineItems: null,
    };
    this.selected.set(base);

    // MoM: this month-to-date vs same window last month, for this node
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const prevStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const prevEnd = new Date(prevStart.getTime() + (now.getTime() - monthStart.getTime()));
    const nodeQuery = { ...this.filters.query(), [DIMENSION_TO_FILTER[dimension]]: row.dimension_value };

    forkJoin({
      current: this.api.summary({ ...nodeQuery, start: monthStart.toISOString(), end: now.toISOString() }),
      previous: this.api.summary({ ...nodeQuery, start: prevStart.toISOString(), end: prevEnd.toISOString() }),
      lineItems:
        dimension === 'resource_name' && row.dimension_value
          ? this.api.lineItems({ resource_name: row.dimension_value }, this.filters.granularity(), this.filters.query())
          : of(null),
    })
      .pipe(
        catchError(() => EMPTY),
      )
      .subscribe(({ current, previous, lineItems }) => {
        const cur = partitionByCurrency(current.rows).find((a) => a.currency === row.currency)?.cost ?? 0;
        const prev = partitionByCurrency(previous.rows).find((a) => a.currency === row.currency)?.cost ?? 0;
        this.selected.set({ ...base, momDelta: cur - prev, lineItems: lineItems?.rows ?? null });
      });
  }

  protected sumItems = (items: LineItemsRow[]) => items.reduce((sum, i) => sum + i.line_items, 0);
  protected sumOverage = (items: LineItemsRow[]) => items.reduce((sum, i) => sum + i.overage_items, 0);
  protected sumMyCost = (items: LineItemsRow[]) => items.reduce((sum, i) => sum + parseCost(i.my_cost), 0);

  protected openResources(resourceName: string): void {
    this.router.navigate(['/resources'], { queryParams: { resource_name: resourceName } });
  }

  protected exportCsv(): void {
    const data = this.rows().data ?? [];
    const dimension = this.dimensionLabels[this.groupBy()];
    const lines = [
      [dimension, 'Currency', 'Cost', 'Resources'].join(','),
      ...data.map((r) =>
        [JSON.stringify(labelForFilterValue(r.dimension_value)), r.currency, r.cost, r.resources].join(','),
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `costscope-${this.groupBy()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private syncUrl(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        ...this.filters.toQueryParams(),
        groupBy: this.groupBy(),
        drill: this.crumbs().length ? serializeCrumbs(this.crumbs()) : undefined,
      },
      replaceUrl: true,
    });
  }
}
