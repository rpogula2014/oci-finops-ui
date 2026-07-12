import { PercentPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { EMPTY, catchError, debounceTime, firstValueFrom, map, switchMap } from 'rxjs';
import { ApiError, BreakdownRow, BreakdownSeriesPoint, CostQuery, Dimension } from '../../core/api.types';
import { CostApiService } from '../../core/cost-api.service';
import { DIMENSION_LABELS, DIMENSION_TO_FILTER, FiltersStore } from '../../core/filters-store';
import { labelForFilterValue, parseCost } from '../../core/currency';
import { MoneyPipe } from '../../shared/money.pipe';
import { PanelStateComponent, PanelStatus } from '../../shared/panel-state.component';
import { SparklineComponent } from '../../shared/sparkline.component';

export interface TreeRow {
  id: string;
  path: string[];
  ancestorFilters: Partial<CostQuery>;
  depth: number;
  dimension: Dimension;
  value: string;
  cost: string;
  currency: string;
  resources: number;
  share: number;
  series?: BreakdownSeriesPoint[];
  children?: TreeRow[];
  loading?: boolean;
  synthetic?: boolean;
}

function isZeroCost(cost: string): boolean {
  return /^[-+]?0+(?:\.0+)?$/.test(cost.trim());
}

@Component({
  selector: 'app-tree-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MoneyPipe, PercentPipe, PanelStateComponent, SparklineComponent],
  template: `
    <div class="tree-head">
      <span class="eyebrow">Cost hierarchy</span>
      <div>
        <button (click)="showAll.update((value) => !value)">{{ showAll() ? 'Hide noise' : 'Show all' }}</button>
        <button (click)="exportCsv()" [disabled]="!visibleRows().length">CSV ↧</button>
      </div>
    </div>
    <app-panel-state [status]="panel().status" [error]="panel().error">
      <table class="data tree" aria-label="Cost hierarchy">
        <thead><tr><th scope="col">Dimension</th><th scope="col" class="num">Cost</th><th scope="col">Share</th><th scope="col">Trend</th><th scope="col"></th></tr></thead>
        <tbody>
          @for (row of visibleRows(); track row.id) {
            <tr [class.selected]="filters.selectedPath() === row.id" (click)="select(row)" tabindex="0" (keydown.enter)="select(row)">
              <td [style.padding-left.px]="12 + row.depth * 24">
                @if (canExpand(row)) {
                  <button class="expander" (click)="toggle(row); $event.stopPropagation()" [attr.aria-label]="isExpanded(row) ? 'Collapse row' : 'Expand row'">
                    {{ isExpanded(row) ? '−' : '+' }}
                  </button>
                } @else { <span class="expander-placeholder"></span> }
                {{ labelFor(row.value) }}
                @if (row.loading) { <span class="loading">Loading…</span> }
              </td>
              <td class="num">{{ row.cost | money: row.currency }}</td>
              <td>
                <span class="share">{{ row.share | percent: '1.0-1' }}</span>
                <span class="share-bar"><i [style.width.%]="row.share * 100"></i></span>
              </td>
              <td><app-sparkline [series]="row.series" /></td>
              <td>
                @if (row.dimension === 'resource_name' && !row.synthetic) {
                  <button (click)="openResources(row); $event.stopPropagation()">Resources ›</button>
                }
              </td>
            </tr>
          }
        </tbody>
      </table>
    </app-panel-state>
  `,
  styles: `
    .tree-head { display: flex; justify-content: space-between; align-items: center; margin: 8px 0; }
    .tree-head div { display: flex; gap: 8px; }
    td.num, th.num { text-align: right; }
    tbody tr { cursor: pointer; } tbody tr.selected { background: var(--atd-logistics-blue); }
    .expander { width: 22px; padding: 0; border: none; background: transparent; font-size: 18px; color: var(--atd-distribution-blue); }
    .expander-placeholder { display: inline-block; width: 22px; }
    .loading { color: var(--atd-grey-700); font-size: 12px; margin-left: 6px; }
    .share { display: inline-block; min-width: 42px; font-variant-numeric: tabular-nums; }
    .share-bar { display: inline-block; vertical-align: middle; width: 72px; height: 6px; border-radius: 99px; overflow: hidden; background: var(--atd-grey-300); }
    .share-bar i { display: block; height: 100%; background: var(--atd-distribution-blue); }
  `,
})
export class TreeTableComponent {
  private readonly api = inject(CostApiService);
  private readonly router = inject(Router);
  protected readonly filters = inject(FiltersStore);
  readonly selected = output<TreeRow>();
  protected readonly labels = DIMENSION_LABELS;
  protected readonly showAll = signal(false);
  private readonly roots = signal<TreeRow[]>([]);
  protected readonly panel = signal<{ status: PanelStatus; error: ApiError | null }>({ status: 'loading', error: null });

  protected readonly visibleRows = computed(() => {
    const rows: TreeRow[] = [];
    const search = this.filters.search().trim().toLowerCase();
    const visit = (items: TreeRow[]) => {
      for (const row of items) {
        const childRows = row.children ?? [];
        const matches = !search || row.value.toLowerCase().includes(search) || childRows.some((child) => this.matches(child, search));
        if (!matches) continue;
        rows.push(row);
        if (this.isExpanded(row) && childRows.length) visit(childRows);
      }
    };
    visit(this.roots());
    return rows;
  });

  constructor() {
    const key = computed(() => ({ query: this.filters.query(), hierarchy: this.filters.hierarchy(), grain: this.filters.granularity(), showAll: this.showAll() }));
    toObservable(key)
      .pipe(
        debounceTime(150),
        switchMap(({ query, hierarchy, grain }) => {
          this.panel.set({ status: 'loading', error: null });
          return this.api.breakdown(query, hierarchy[0], 100, true, grain).pipe(
            map(({ rows }) => {
              const roots = this.makeRows(rows, 0, [], {});
              this.roots.set(roots);
              this.panel.set({ status: roots.length ? 'ready' : 'empty', error: null });
              void this.restoreExpanded(roots);
            }),
            catchError((error: ApiError) => {
              this.panel.set({ status: 'error', error });
              return EMPTY;
            }),
          );
        }),
      )
      .subscribe();
  }

  protected labelFor = labelForFilterValue;

  protected canExpand(row: TreeRow): boolean {
    return row.synthetic || row.depth < this.filters.hierarchy().length - 1;
  }

  protected isExpanded(row: TreeRow): boolean {
    return this.filters.expandedPaths().includes(row.id);
  }

  protected toggle(row: TreeRow): void {
    if (this.isExpanded(row)) {
      this.filters.expandedPaths.update((paths) => paths.filter((path) => path !== row.id));
      return;
    }
    this.filters.expandedPaths.update((paths) => [...paths, row.id]);
    if (!row.children && !row.synthetic) void this.loadChildren(row);
  }

  protected select(row: TreeRow): void {
    this.filters.selectedPath.set(row.id);
    this.selected.emit(row);
  }

  protected openResources(row: TreeRow): void {
    void this.router.navigate(['/resources'], { queryParams: { ...this.filters.toQueryParams(), resource_name: row.value } });
  }

  protected exportCsv(): void {
    const lines = [['Hierarchy path', 'Currency', 'Cost', 'Share'].join(',')];
    for (const row of this.visibleRows()) {
      lines.push([JSON.stringify(row.path.map(labelForFilterValue).join(' › ')), row.currency, row.cost, row.share.toFixed(4)].join(','));
    }
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'costscope-hierarchy.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  private makeRows(rows: BreakdownRow[], depth: number, parentPath: string[], ancestorFilters: Partial<CostQuery>): TreeRow[] {
    const nonZero = this.showAll() ? rows : rows.filter((row) => !isZeroCost(row.cost));
    const grouped = new Map<string, BreakdownRow[]>();
    for (const row of nonZero) grouped.set(row.currency, [...(grouped.get(row.currency) ?? []), row]);
    const result: TreeRow[] = [];
    for (const currencyRows of grouped.values()) {
      const shown = this.showAll() ? currencyRows : currencyRows.slice(0, 15);
      const total = currencyRows.reduce((sum, row) => sum + parseCost(row.cost), 0) || 1;
      result.push(...shown.map((row) => this.rowFrom(row, depth, parentPath, ancestorFilters, total)));
      const tail = currencyRows.slice(15);
      if (!this.showAll() && tail.length) {
        const cost = tail.reduce((sum, row) => sum + parseCost(row.cost), 0).toFixed(2);
        const path = [...parentPath, `Other (${tail.length})`];
        result.push({
          id: path.map(encodeURIComponent).join('|'), path, ancestorFilters, depth, dimension: this.filters.hierarchy()[depth],
          value: `Other (${tail.length})`, cost, currency: tail[0].currency, resources: tail.reduce((sum, row) => sum + row.resources, 0),
          share: parseCost(cost) / total, children: tail.map((row) => this.rowFrom(row, depth, parentPath, ancestorFilters, total)), synthetic: true,
        });
      }
    }
    return result;
  }

  private rowFrom(row: BreakdownRow, depth: number, parentPath: string[], ancestorFilters: Partial<CostQuery>, total: number): TreeRow {
    const path = [...parentPath, row.dimension_value];
    const dimension = this.filters.hierarchy()[depth];
    return {
      id: path.map(encodeURIComponent).join('|'), path, ancestorFilters, depth, dimension, value: row.dimension_value,
      cost: row.cost, currency: row.currency, resources: row.resources, share: parseCost(row.cost) / total, series: row.series,
    };
  }

  private async loadChildren(row: TreeRow): Promise<void> {
    if (row.loading || row.children || row.synthetic) return;
    row.loading = true;
    this.roots.update((roots) => [...roots]);
    const nextDimension = this.filters.hierarchy()[row.depth + 1];
    const query: CostQuery = { ...this.filters.query(), ...row.ancestorFilters, [DIMENSION_TO_FILTER[row.dimension]]: row.value };
    try {
      const { rows } = await firstValueFrom(this.api.breakdown(query, nextDimension, 100, true, this.filters.granularity()));
      row.children = this.makeRows(rows, row.depth + 1, row.path, { ...row.ancestorFilters, [DIMENSION_TO_FILTER[row.dimension]]: row.value });
    } catch {
      row.children = [];
    } finally {
      row.loading = false;
      this.roots.update((roots) => [...roots]);
    }
  }

  private async restoreExpanded(rows: TreeRow[]): Promise<void> {
    const open = this.filters.expandedPaths();
    for (const row of rows) {
      if (this.filters.selectedPath() === row.id) this.select(row);
      if (!open.some((path) => path === row.id || path.startsWith(`${row.id}|`))) continue;
      await this.loadChildren(row);
      if (row.children) await this.restoreExpanded(row.children);
    }
  }

  private matches(row: TreeRow, search: string): boolean {
    return row.value.toLowerCase().includes(search) || (row.children ?? []).some((child) => this.matches(child, search));
  }
}
