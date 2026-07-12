import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { EMPTY, catchError, debounceTime, firstValueFrom, map, switchMap } from 'rxjs';
import { ChevronDown, ChevronRight, Download, LucideAngularModule } from 'lucide-angular';
import { ApiError, CostQuery, GROUPED_DIMENSION_LABELS, GroupedResourceDimension, GroupedResourceGroupRow, GroupedResourceRow } from '../../core/api.types';
import { CostApiService } from '../../core/cost-api.service';
import { FiltersStore } from '../../core/filters-store';
import { labelForFilterValue } from '../../core/currency';
import { MoneyPipe } from '../../shared/money.pipe';
import { PanelStateComponent, PanelStatus } from '../../shared/panel-state.component';

interface ResourceTreeRow {
  id: string;
  path: string[];
  depth: number;
  row: GroupedResourceRow;
  children?: ResourceTreeRow[];
  loading?: boolean;
}

function csvCell(value: string | number): string {
  return JSON.stringify(String(value));
}

@Component({
  selector: 'app-grouped-resource-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, MoneyPipe, PanelStateComponent],
  template: `
    <div class="grouped-controls">
      <label>
        <span>Group</span>
        <select [value]="group1()" (change)="setGroup1($event)" aria-label="First grouping dimension">
          @for (dimension of dimensions; track dimension) {
            <option [value]="dimension">{{ dimensionLabel(dimension) }}</option>
          }
        </select>
      </label>
      <label>
        <span>Then</span>
        <select [value]="group2() ?? ''" (change)="setGroup2($event)" aria-label="Second grouping dimension">
          <option value="">None</option>
          @for (dimension of secondDimensions(); track dimension) {
            <option [value]="dimension">{{ dimensionLabel(dimension) }}</option>
          }
        </select>
      </label>
      <label class="search">
        <span>Search</span>
        <input [value]="search()" (input)="setSearch($event)" type="search" />
      </label>
      <button class="toggle" type="button" (click)="showAll.update((v) => !v)" [attr.aria-pressed]="!showAll()" title="Hide rows that cost $0">
        {{ showAll() ? 'Hide noise' : 'Show all' }}
      </button>
      <button class="csv" type="button" (click)="exportCsv()" [disabled]="!visibleRows().length" title="Export visible rows as CSV">
        <lucide-icon [img]="icons.download" [size]="16" aria-hidden="true" />
        CSV
      </button>
    </div>

    <app-panel-state [status]="panel().status" [error]="panel().error">
      <div class="table-wrap">
        <table class="data grouped" aria-label="Grouped resource costs">
          <thead>
            <tr>
              <th scope="col">Group</th>
              <th scope="col">Period</th>
              <th scope="col">Environment</th>
              <th scope="col">Cost center</th>
              <th scope="col">Component</th>
              <th scope="col">Compartment</th>
              <th scope="col">Service</th>
              <th scope="col">Resource type</th>
              <th scope="col">Resource name</th>
              <th scope="col">OCID</th>
              <th scope="col" class="num">Cost</th>
            </tr>
          </thead>
          <tbody>
            @for (tree of visibleRows(); track tree.id) {
              <tr [class.leaf]="tree.row.kind === 'leaf'">
                <td [style.padding-left.px]="12 + tree.depth * 20">
                  @if (canExpand(tree)) {
                    <button class="expander" type="button" (click)="toggle(tree)" [attr.aria-label]="isExpanded(tree) ? 'Collapse group' : 'Expand group'" [title]="isExpanded(tree) ? 'Collapse group' : 'Expand group'">
                      <lucide-icon [img]="isExpanded(tree) ? icons.down : icons.right" [size]="16" aria-hidden="true" />
                    </button>
                  } @else {
                    <span class="expander-placeholder"></span>
                  }
                  @if (tree.row.kind === 'leaf') {
                    {{ groupPath(tree) }}
                  } @else {
                    {{ groupLabel(tree.row) }}
                  }
                  @if (tree.loading) {
                    <span class="loading">Loading</span>
                  }
                </td>
                @if (tree.row.kind === 'leaf') {
                  <td>{{ tree.row.period }}</td>
                  <td>{{ labelFor(tree.row.environment) }}</td>
                  <td>{{ labelFor(tree.row.cost_center) }}</td>
                  <td>{{ labelFor(tree.row.component_type) }}</td>
                  <td>{{ tree.row.compartment }}</td>
                  <td>{{ tree.row.service }}</td>
                  <td>{{ labelFor(tree.row.resource_type) }}</td>
                  <td><button class="resource-link" type="button" (click)="open(tree.row)">{{ labelFor(tree.row.resource_name) }}</button></td>
                  <td class="ocid">{{ tree.row.ocid }}</td>
                  <td class="num">{{ tree.row.cost | money: tree.row.currency }}</td>
                } @else {
                  <td>{{ tree.row.row_count }} rows</td>
                  <td colspan="8"></td>
                  <td class="num">{{ tree.row.subtotal_cost | money: tree.row.currency }}</td>
                }
              </tr>
            }
          </tbody>
        </table>
      </div>
    </app-panel-state>
  `,
  styles: `
    .grouped-controls {
      display: flex;
      align-items: end;
      flex-wrap: wrap;
      gap: 12px;
      margin: 8px 0 12px;
    }
    label { display: grid; gap: 4px; font-size: 12px; font-weight: 700; }
    select, input { min-height: 34px; }
    .search { min-width: 220px; flex: 1 1 220px; }
    .csv { display: inline-flex; align-items: center; gap: 6px; min-height: 34px; }
    .table-wrap { overflow-x: auto; }
    .grouped { min-width: 1360px; }
    .num { text-align: right; }
    .expander, .resource-link {
      border: 0;
      background: transparent;
      color: var(--atd-distribution-blue);
      padding: 0;
    }
    .expander { display: inline-flex; width: 20px; vertical-align: middle; }
    .expander-placeholder { display: inline-block; width: 20px; }
    .resource-link { text-align: left; text-decoration: underline; }
    .ocid { max-width: 260px; overflow-wrap: anywhere; font-family: monospace; font-size: 12px; }
    .loading { margin-left: 6px; color: var(--atd-grey-700); font-size: 12px; }
    @media (max-width: 640px) {
      .grouped-controls { align-items: stretch; }
      .grouped-controls label { flex: 1 1 145px; }
      .csv { justify-content: center; }
    }
  `,
})
export class GroupedResourceTableComponent {
  private readonly api = inject(CostApiService);
  private readonly router = inject(Router);
  private readonly filters = inject(FiltersStore);

  protected readonly dimensions = Object.keys(GROUPED_DIMENSION_LABELS) as GroupedResourceDimension[];
  protected readonly icons = { down: ChevronDown, right: ChevronRight, download: Download };
  protected readonly group1 = signal<GroupedResourceDimension>('environment');
  protected readonly group2 = signal<GroupedResourceDimension | null>('cost_center');
  protected readonly search = signal('');
  // Hide-noise default: $0 rows are hidden until the user opts to show all.
  protected readonly showAll = signal(false);
  private readonly roots = signal<ResourceTreeRow[]>([]);
  private readonly expanded = signal<string[]>([]);
  protected readonly panel = signal<{ status: PanelStatus; error: ApiError | null }>({ status: 'loading', error: null });

  protected readonly secondDimensions = computed(() => this.dimensions.filter((dimension) => dimension !== this.group1()));
  protected readonly visibleRows = computed(() => {
    const rows: ResourceTreeRow[] = [];
    const visit = (items: ResourceTreeRow[]) => {
      for (const item of items) {
        rows.push(item);
        if (this.isExpanded(item) && item.children) visit(item.children);
      }
    };
    visit(this.roots());
    return rows;
  });

  constructor() {
    const key = computed(() => ({
      query: this.filters.query(),
      group1: this.group1(),
      group2: this.group2(),
      q: this.search(),
      hideZero: !this.showAll(),
    }));
    toObservable(key)
      .pipe(
        debounceTime(200),
        switchMap(({ query, group1, group2, q, hideZero }) => {
          this.panel.set({ status: 'loading', error: null });
          return this.api.groupedResources(query, group1, group2 ?? undefined, { q, hideZero }).pipe(
            map(({ rows }) => {
              const roots = this.makeRows(rows, 0, []);
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

  protected setGroup1(event: Event): void {
    const group1 = (event.target as HTMLSelectElement).value as GroupedResourceDimension;
    this.group1.set(group1);
    if (this.group2() === group1) this.group2.set(null);
    this.expanded.set([]);
  }

  protected setGroup2(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as GroupedResourceDimension | '';
    this.group2.set(value && value !== this.group1() ? value : null);
    this.expanded.set([]);
  }

  protected setSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  protected dimensionLabel(dimension: GroupedResourceDimension): string {
    return GROUPED_DIMENSION_LABELS[dimension];
  }

  protected labelFor = labelForFilterValue;

  protected canExpand(tree: ResourceTreeRow): tree is ResourceTreeRow & { row: GroupedResourceGroupRow } {
    return tree.row.kind === 'group';
  }

  protected isExpanded(tree: ResourceTreeRow): boolean {
    return this.expanded().includes(tree.id);
  }

  protected toggle(tree: ResourceTreeRow): void {
    if (!this.canExpand(tree)) return;
    if (this.isExpanded(tree)) {
      this.expanded.update((ids) => ids.filter((id) => id !== tree.id));
      return;
    }
    this.expanded.update((ids) => [...ids, tree.id]);
    if (!tree.children) void this.loadChildren(tree);
  }

  protected groupLabel(row: GroupedResourceGroupRow): string {
    return row.kind === 'other' ? `Other (${row.row_count})` : labelForFilterValue(row.group_value);
  }

  protected groupPath(tree: ResourceTreeRow): string {
    return tree.path.slice(0, -1).map(labelForFilterValue).join(' / ');
  }

  protected open(row: Extract<GroupedResourceRow, { kind: 'leaf' }>): void {
    void this.router.navigate(['/resources', row.ocid], { queryParams: this.filters.toFilterParams() });
  }

  protected exportCsv(): void {
    const header = ['Group path', 'Kind', 'Period', 'Environment', 'Cost center', 'Component', 'Compartment', 'Service', 'Resource type', 'Resource name', 'OCID', 'Currency', 'Cost'];
    const lines = [header.map(csvCell).join(',')];
    for (const tree of this.visibleRows()) {
      const row = tree.row;
      if (row.kind === 'leaf') {
        lines.push([tree.path.slice(0, -1).map(labelForFilterValue).join(' / '), row.kind, row.period, labelForFilterValue(row.environment), labelForFilterValue(row.cost_center), labelForFilterValue(row.component_type), row.compartment, row.service, labelForFilterValue(row.resource_type), labelForFilterValue(row.resource_name), row.ocid, row.currency, row.cost].map(csvCell).join(','));
      } else {
        lines.push([tree.path.map(labelForFilterValue).join(' / '), row.kind, '', '', '', '', '', '', '', '', '', row.currency, row.subtotal_cost].map(csvCell).join(','));
      }
    }
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'grouped-resources.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  private makeRows(rows: GroupedResourceRow[], depth: number, parentPath: string[]): ResourceTreeRow[] {
    return rows.map((row) => {
      const value = row.kind === 'leaf' ? `${row.period}|${row.ocid}` : row.group_value;
      const path = [...parentPath, value];
      return { id: path.map(encodeURIComponent).join('|'), path, depth, row };
    });
  }

  private async loadChildren(tree: ResourceTreeRow & { row: GroupedResourceGroupRow }): Promise<void> {
    if (tree.loading || tree.children) return;
    tree.loading = true;
    this.roots.update((rows) => [...rows]);
    const group2 = this.group2();
    // Empty-tag groups come back with group_value "" ; the backend selects them
    // via the "__untagged__" sentinel, so map "" → sentinel when scoping expansion.
    const scope = (value: string) => (value === '' ? '__untagged__' : value);
    const opts = tree.depth === 0
      ? { group1Value: scope(tree.row.group_value), q: this.search(), hideZero: !this.showAll() }
      : { group1Value: scope(tree.path[0]), group2Value: scope(tree.row.group_value), q: this.search(), hideZero: !this.showAll() };
    try {
      const { rows } = await firstValueFrom(this.api.groupedResources(this.filters.query(), this.group1(), group2 ?? undefined, opts));
      tree.children = this.makeRows(rows, tree.depth + 1, tree.path);
    } catch {
      tree.children = [];
    } finally {
      tree.loading = false;
      this.roots.update((rows) => [...rows]);
    }
  }

  private async restoreExpanded(rows: ResourceTreeRow[]): Promise<void> {
    const expanded = this.expanded();
    for (const row of rows) {
      if (!this.canExpand(row) || !expanded.some((id) => id === row.id || id.startsWith(`${row.id}|`))) continue;
      await this.loadChildren(row);
      if (row.children) await this.restoreExpanded(row.children);
    }
  }
}
