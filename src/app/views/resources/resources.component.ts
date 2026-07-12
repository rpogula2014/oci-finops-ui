import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { EMPTY, catchError, debounceTime, map, switchMap } from 'rxjs';
import { ApiError, ResourceRow } from '../../core/api.types';
import { CostApiService } from '../../core/cost-api.service';
import { FiltersStore } from '../../core/filters-store';
import { labelForFilterValue } from '../../core/currency';
import { MoneyPipe } from '../../shared/money.pipe';
import { PanelStateComponent, PanelStatus } from '../../shared/panel-state.component';

type SortKey = 'cost' | 'resource_name' | 'service' | 'compartment';

const PAGE_SIZE = 50;

@Component({
  selector: 'app-resources',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MoneyPipe, PanelStateComponent],
  template: `
    <span class="eyebrow">Resources</span>
    <h1>Resource costs</h1>

    <div class="card">
      <app-panel-state [status]="panel().status" [error]="panel().error">
        <table class="data" aria-label="Resources with cost">
          <thead>
            <tr>
              @for (col of columns; track col.key) {
                <th scope="col" [class.num]="col.numeric">
                  @if (col.sort) {
                    <button
                      class="sort"
                      (click)="onSort(col.sort)"
                      [attr.aria-sort]="sort() === col.sort ? (direction() === 'asc' ? 'ascending' : 'descending') : null"
                    >
                      {{ col.label }}
                      @if (sort() === col.sort) {
                        <span aria-hidden="true">{{ direction() === 'asc' ? '▲' : '▼' }}</span>
                      }
                    </button>
                  } @else {
                    {{ col.label }}
                  }
                </th>
              }
            </tr>
          </thead>
          <tbody>
            @for (row of panel().data; track row.ocid) {
              <tr tabindex="0" (click)="open(row)" (keydown.enter)="open(row)">
                <td>{{ labelFor(row.resource_name) }}</td>
                <td>{{ row.service }}</td>
                <td>{{ row.compartment }}</td>
                <td>{{ row.region }}</td>
                <td>{{ labelFor(row.environment) }}</td>
                <td>{{ labelFor(row.cost_center) }}</td>
                <td class="num">{{ row.cost | money: row.currency }}</td>
              </tr>
            }
          </tbody>
        </table>
        <div class="pager">
          <button (click)="page.set(page() - 1)" [disabled]="page() <= 1">‹ Prev</button>
          <span>Page {{ page() }} of {{ pageCount() }} · {{ total() }} resources</span>
          <button (click)="page.set(page() + 1)" [disabled]="page() >= pageCount()">Next ›</button>
        </div>
      </app-panel-state>
    </div>
  `,
  styles: `
    th button.sort { border: none; background: none; font-weight: 700; color: var(--atd-distribution-blue); padding: 0; }
    td.num, th.num { text-align: right; }
    tbody tr { cursor: pointer; }
    .pager { display: flex; justify-content: space-between; align-items: center; padding-top: 12px; font-size: 13px; }
  `,
})
export class ResourcesComponent {
  private readonly api = inject(CostApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly filters = inject(FiltersStore);

  protected readonly columns = [
    { key: 'name', label: 'Resource name', sort: 'resource_name' as SortKey, numeric: false },
    { key: 'service', label: 'Service', sort: 'service' as SortKey, numeric: false },
    { key: 'compartment', label: 'Compartment', sort: 'compartment' as SortKey, numeric: false },
    { key: 'region', label: 'Region', sort: undefined, numeric: false },
    { key: 'env', label: 'Environment', sort: undefined, numeric: false },
    { key: 'cc', label: 'Cost center', sort: undefined, numeric: false },
    { key: 'cost', label: 'Cost', sort: 'cost' as SortKey, numeric: true },
  ];

  protected readonly page = signal(1);
  protected readonly sort = signal<SortKey>('cost');
  protected readonly direction = signal<'asc' | 'desc'>('desc');
  protected readonly total = signal(0);
  protected readonly panel = signal<{ status: PanelStatus; data: ResourceRow[] | null; error: ApiError | null }>({
    status: 'loading',
    data: null,
    error: null,
  });

  protected readonly pageCount = computed(() => Math.max(1, Math.ceil(this.total() / PAGE_SIZE)));
  protected labelFor = labelForFilterValue;

  constructor() {
    this.filters.hydrateFromParams(this.route.snapshot.queryParams);

    const key = computed(() => ({
      query: this.filters.query(),
      page: this.page(),
      sort: this.sort(),
      direction: this.direction(),
    }));
    toObservable(key)
      .pipe(
        debounceTime(200),
        switchMap(({ query, page, sort, direction }) => {
          this.panel.set({ status: 'loading', data: null, error: null });
          return this.api.resources(query, page, PAGE_SIZE, sort, direction).pipe(
            map(({ rows }) => {
              this.total.set(rows[0]?.total ?? 0);
              this.panel.set({ status: rows.length ? 'ready' : 'empty', data: rows, error: null });
            }),
            catchError((error: ApiError) => {
              this.panel.set({ status: 'error', data: null, error });
              return EMPTY;
            }),
          );
        }),
      )
      .subscribe();
  }

  protected onSort(key: SortKey): void {
    if (this.sort() === key) {
      this.direction.update((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sort.set(key);
      this.direction.set(key === 'cost' ? 'desc' : 'asc');
    }
    this.page.set(1);
  }

  protected open(row: ResourceRow): void {
    this.router.navigate(['/resources', row.ocid]);
  }
}
