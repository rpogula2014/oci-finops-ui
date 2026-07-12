import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { EMPTY, catchError, forkJoin } from 'rxjs';
import { LineItemsRow } from '../../core/api.types';
import { CostApiService } from '../../core/cost-api.service';
import { DIMENSION_TO_FILTER, FiltersStore } from '../../core/filters-store';
import { labelForFilterValue, parseCost, partitionByCurrency } from '../../core/currency';
import { MoneyPipe } from '../../shared/money.pipe';
import { FilterBarComponent } from './filter-bar.component';
import { TreeRow, TreeTableComponent } from './tree-table.component';

interface NodeDetail {
  row: TreeRow;
  momDelta: number | null;
  lineItems: LineItemsRow[] | null;
}

@Component({
  selector: 'app-explorer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FilterBarComponent, TreeTableComponent, MoneyPipe],
  template: `
    <span class="eyebrow">Cost Explorer</span>
    <h1>Explore costs</h1>
    <app-explorer-filter-bar />
    <div class="explorer-grid">
      <section class="main card"><app-tree-table (selected)="select($event)" /></section>
      <aside class="detail card">
        @if (selected(); as node) {
          <span class="eyebrow">{{ node.row.path.map(labelFor).join(' › ') }}</span>
          <h3>{{ labelFor(node.row.value) }}</h3>
          <div class="detail-row"><span>Cost</span><strong>{{ node.row.cost | money: node.row.currency }}</strong></div>
          <div class="detail-row"><span>Resources</span><strong>{{ node.row.resources }}</strong></div>
          @if (node.momDelta !== null) {
            <div class="detail-row"><span>MoM delta</span><strong [class.overage]="node.momDelta > 0">{{ node.momDelta > 0 ? '+' : '' }}{{ node.momDelta | money: node.row.currency }}</strong></div>
          }
          @if (node.lineItems; as items) {
            <h3 class="section">Line items ({{ filters.granularity() }})</h3>
            <div class="detail-row"><span>Total items</span><strong>{{ sumItems(items) }}</strong></div>
            <div class="detail-row"><span>Overage items</span><strong [class.overage]="sumOverage(items) > 0">{{ sumOverage(items) }}</strong></div>
            <div class="detail-row"><span>My cost</span><strong>{{ sumMyCost(items) | money: node.row.currency }}</strong></div>
          } @else { <p class="hint">Line-item detail is available for resource-name rows.</p> }
          @if (node.row.dimension === 'resource_name') { <button (click)="openResources(node.row.value)">View resources ›</button> }
        } @else { <p class="hint">Select a row to see its ancestor path and cost detail.</p> }
      </aside>
    </div>
  `,
  styles: `
    .explorer-grid { display: grid; grid-template-columns: minmax(0, 1fr) 270px; gap: 16px; align-items: start; }
    .detail { display: flex; flex-direction: column; gap: 12px; }.detail-row { display: flex; justify-content: space-between; font-size: 13px; }
    .detail .overage { color: var(--atd-error); }.detail h3.section { margin-top: 8px; }.hint { color: var(--atd-grey-700); font-size: 13px; }
    @media (max-width: 1100px) { .explorer-grid { grid-template-columns: 1fr; } }
  `,
})
export class ExplorerComponent {
  private readonly api = inject(CostApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly filters = inject(FiltersStore);
  protected readonly selected = signal<NodeDetail | null>(null);
  protected labelFor = labelForFilterValue;

  constructor() {
    this.filters.hydrateFromParams(this.route.snapshot.queryParams);
    // A global query or hierarchy change invalidates any previously selected tree row.
    // A deep-link restore emits the new selection after its rows have loaded.
    effect(() => {
      this.filters.query();
      this.filters.hierarchy();
      this.selected.set(null);
    });
    effect(() => {
      const queryParams = this.filters.toQueryParams();
      void this.router.navigate([], { relativeTo: this.route, queryParams, replaceUrl: true });
    });
  }

  protected select(row: TreeRow): void {
    const base: NodeDetail = { row, momDelta: null, lineItems: null };
    this.selected.set(base);
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const prevStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const prevEnd = new Date(prevStart.getTime() + (now.getTime() - monthStart.getTime()));
    const nodeQuery = { ...this.filters.query(), ...row.ancestorFilters, [DIMENSION_TO_FILTER[row.dimension]]: row.value };
    forkJoin({
      current: this.api.summary({ ...nodeQuery, start: monthStart.toISOString(), end: now.toISOString() }),
      previous: this.api.summary({ ...nodeQuery, start: prevStart.toISOString(), end: prevEnd.toISOString() }),
      lineItems: this.api.lineItems(
        row.dimension === 'resource_name' ? { resource_name: row.value } : undefined,
        this.filters.granularity(),
        nodeQuery,
      ),
    }).pipe(catchError(() => EMPTY)).subscribe(({ current, previous, lineItems }) => {
      const currentCost = partitionByCurrency(current.rows).find((amount) => amount.currency === row.currency)?.cost ?? 0;
      const previousCost = partitionByCurrency(previous.rows).find((amount) => amount.currency === row.currency)?.cost ?? 0;
      this.selected.set({ ...base, momDelta: currentCost - previousCost, lineItems: lineItems?.rows ?? null });
    });
  }

  protected sumItems = (items: LineItemsRow[]) => items.reduce((sum, item) => sum + item.line_items, 0);
  protected sumOverage = (items: LineItemsRow[]) => items.reduce((sum, item) => sum + item.overage_items, 0);
  protected sumMyCost = (items: LineItemsRow[]) => items.reduce((sum, item) => sum + parseCost(item.my_cost), 0);
  protected openResources(resourceName: string): void { void this.router.navigate(['/resources'], { queryParams: { resource_name: resourceName } }); }
}
