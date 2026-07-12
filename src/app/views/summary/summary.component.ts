import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { EMPTY, catchError, debounceTime, map, switchMap } from 'rxjs';
import { NgxEchartsDirective } from 'ngx-echarts';
import type { EChartsOption } from 'echarts';
import { CostApiService } from '../../core/cost-api.service';
import { DIMENSION_LABELS, DIMENSION_TO_FILTER, FiltersStore } from '../../core/filters-store';
import { ApiError, BreakdownRow, Dimension } from '../../core/api.types';
import { currenciesOf, formatMoney, labelForFilterValue, parseCost } from '../../core/currency';
import { PanelStateComponent, PanelStatus } from '../../shared/panel-state.component';
import { CHART_TEXT, BASE_CHART } from '../../shared/chart-theme';
import { SpendOverTime, StatCard, buildSpendOverTime, buildStatCards } from './summary-metrics';

const TOP_N = 7;

/** Group-by choices offered on the landing page. */
const GROUP_DIMENSIONS: Dimension[] = [
  'cost_center',
  'compartment',
  'component_type',
  'resource_name',
  'service',
  'environment',
];

/** Categorical palette for resource-name stacks; grey is reserved for "Other". */
const STACK_PALETTE = ['#0076BE', '#F5730C', '#00853E', '#142848', '#E72300', '#8a5a2c', '#6fb1e0'];
const OTHER_COLOR = '#A5AAAA';

interface LandingData {
  cards: StatCard[];
  spend: SpendOverTime;
  byResource: BreakdownRow[];
  currency: string;
}

@Component({
  selector: 'app-summary',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgxEchartsDirective, PanelStateComponent],
  template: `
    <div class="page-head">
      <div>
        <span class="eyebrow">Cost Summary</span>
        <h1>Cost overview</h1>
      </div>
      <label class="group-pick">
        <span class="eyebrow">Group by</span>
        <select (change)="onGroupDim($event)" aria-label="Group by dimension">
          @for (d of groupDimensions; track d) {
            <option [value]="d" [selected]="d === groupDim()">{{ dimensionLabels[d] }}</option>
          }
        </select>
      </label>
    </div>

    <app-panel-state [status]="panel().status" [error]="panel().error">
      @if (panel().data; as d) {
        <div class="stat-band">
          @for (card of d.cards; track card.label) {
            <div class="card stat">
              <span class="eyebrow">{{ card.label }}</span>
              <span class="value">{{ card.value }}</span>
              @for (sub of card.subs; track sub) {
                <span class="sub">{{ sub }}</span>
              }
            </div>
          }
        </div>

        <section class="card">
          <div class="panel-head">
            <h2>Spend over time</h2>
            <span class="sub">
              {{ d.spend.months.length }} month buckets · stacked by {{ dimensionLabels[groupDim()].toLowerCase() }}
            </span>
          </div>
          <div
            echarts
            [options]="spendChart()"
            class="chart"
            role="img"
            [attr.aria-label]="'Monthly spend stacked by ' + dimensionLabels[groupDim()]"
          ></div>
        </section>

        <section class="card">
          <div class="panel-head">
            <h2>By {{ dimensionLabels[groupDim()].toLowerCase() }}</h2>
            <span class="sub">share of filtered spend — click a bar to filter</span>
          </div>
          <div class="resource-bars">
            @for (row of d.byResource; track row.dimension_value; let i = $index) {
              <button
                class="resource-bar"
                [class.active]="filters.filter(filterKey())() === row.dimension_value"
                (click)="toggleResource(row.dimension_value)"
              >
                <span class="name">{{ labelFor(row.dimension_value) }}</span>
                <span class="track">
                  <span
                    class="fill"
                    [style.width.%]="barWidth(row, d)"
                    [style.background]="barColor(i)"
                  ></span>
                </span>
                <span class="amount">{{ fmt(row, d.currency) }}</span>
              </button>
            }
          </div>
        </section>
      }
    </app-panel-state>
  `,
  styles: `
    section { margin-bottom: 24px; }
    .page-head { display: flex; justify-content: space-between; align-items: end; margin-bottom: 8px; }
    .group-pick { display: flex; flex-direction: column; gap: 4px; margin-bottom: 8px; }
    .stat-band {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(148px, 1fr));
      gap: 12px;
      margin-bottom: 24px;
    }
    .stat { display: flex; flex-direction: column; gap: 2px; padding: 14px 16px; }
    .stat .value { font-weight: 800; font-size: 24px; color: var(--atd-distribution-blue); }
    .stat .sub { font-size: 12px; color: var(--atd-grey-700); }
    .panel-head { display: flex; align-items: baseline; gap: 12px; margin-bottom: 8px; }
    .panel-head .sub { font-size: 12px; color: var(--atd-grey-700); }
    .chart { height: 380px; width: 100%; }
    .resource-bars { display: flex; flex-direction: column; gap: 6px; }
    .resource-bar {
      display: grid;
      grid-template-columns: 220px 1fr 110px;
      align-items: center;
      gap: 12px;
      border: none;
      background: none;
      padding: 4px 6px;
      border-radius: var(--radius-md);
      text-align: left;
      font-size: 13px;
    }
    .resource-bar:hover { background: var(--atd-grey-050); }
    .resource-bar.active { background: var(--atd-logistics-blue); }
    .resource-bar .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .resource-bar .track { height: 10px; background: var(--atd-grey-050); border-radius: 5px; overflow: hidden; }
    .resource-bar .fill { display: block; height: 100%; border-radius: 5px; }
    .resource-bar .amount { text-align: right; font-weight: 700; color: var(--atd-distribution-blue); }
  `,
})
export class SummaryComponent {
  private readonly api = inject(CostApiService);
  protected readonly filters = inject(FiltersStore);
  protected labelFor = labelForFilterValue;

  protected readonly groupDimensions = GROUP_DIMENSIONS;
  protected readonly dimensionLabels = DIMENSION_LABELS;
  protected readonly groupDim = signal<Dimension>('cost_center');
  protected readonly filterKey = computed(() => DIMENSION_TO_FILTER[this.groupDim()]);

  protected readonly panel = signal<{ status: PanelStatus; data: LandingData | null; error: ApiError | null }>({
    status: 'loading',
    data: null,
    error: null,
  });

  constructor() {
    const key = computed(() => ({ query: this.filters.query(), dim: this.groupDim() }));
    toObservable(key)
      .pipe(
        debounceTime(200),
        switchMap(({ query, dim }) => {
          this.panel.set({ status: 'loading', data: null, error: null });
          return this.api.execSummary(query, dim, TOP_N).pipe(
            map(({ rows: agg }) => {
              const currency =
                this.filters.currency() ?? currenciesOf(agg.summary.filter((r) => r.currency))[0] ?? 'USD';
              const cards = buildStatCards({
                summaryRows: agg.summary,
                monthly: agg.monthly,
                costCenters: agg.cost_centers,
                environments: agg.environments,
                topResources: agg.top_breakdown,
                topLabel: DIMENSION_LABELS[dim],
                freshness: agg.freshness,
                start: query.start ?? new Date().toISOString(),
                end: query.end ?? new Date().toISOString(),
                currency,
              });
              const spend = buildSpendOverTime(
                agg.top_series.map((s) => s.name),
                agg.top_series.map((s) => s.rows),
                agg.monthly,
                currency,
              );
              const byResource = agg.top_breakdown.filter((r) => r.currency === currency);
              const data: LandingData = { cards, spend, byResource, currency };
              this.panel.set({
                status: byResource.length || spend.months.length ? 'ready' : 'empty',
                data,
                error: null,
              });
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

  protected readonly spendChart = computed<EChartsOption>(() => {
    const data = this.panel().data;
    if (!data) return {};
    const { spend, currency } = data;
    const labels = spend.months.map((m) => {
      const d = new Date(m);
      return `${d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })} ’${String(d.getUTCFullYear()).slice(2)}`;
    });
    return {
      ...BASE_CHART,
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        valueFormatter: (v) => formatMoney(Number(v), currency, 2),
      },
      legend: { bottom: 0, textStyle: { color: CHART_TEXT } },
      grid: { left: 80, right: 24, top: 16, bottom: 56 },
      xAxis: { type: 'category', data: labels },
      yAxis: { type: 'value', axisLabel: { formatter: (v: number) => formatMoney(v, currency) } },
      series: spend.series.map((s, i) => ({
        name: s.name,
        type: 'bar' as const,
        stack: 'total',
        barMaxWidth: 48,
        data: s.values,
        color: s.name === 'Other' ? OTHER_COLOR : STACK_PALETTE[i % STACK_PALETTE.length],
      })),
    };
  });

  /** Bars share the stack chart's palette: top-7 rows are the chart series (same order), the rest are "Other" grey. */
  protected barColor(index: number): string {
    return index < TOP_N ? STACK_PALETTE[index % STACK_PALETTE.length] : OTHER_COLOR;
  }

  protected barWidth(row: BreakdownRow, d: LandingData): number {
    const max = Math.max(...d.byResource.map((r) => parseCost(r.cost)), 1);
    return (parseCost(row.cost) / max) * 100;
  }

  protected fmt(row: BreakdownRow, currency: string): string {
    return formatMoney(parseCost(row.cost), currency, 2);
  }

  protected onGroupDim(event: Event): void {
    this.groupDim.set((event.target as HTMLSelectElement).value as Dimension);
  }

  protected toggleResource(value: string): void {
    const key = this.filterKey();
    const current = this.filters.filter(key)();
    this.filters.setFilter(key, current === value ? null : value);
  }
}
