import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { catchError, debounceTime, forkJoin, map, of, switchMap } from 'rxjs';
import { NgxEchartsDirective } from 'ngx-echarts';
import type { EChartsOption } from 'echarts';
import { CostApiService } from '../../core/cost-api.service';
import { DIMENSION_FILTER_KEYS, DIMENSION_LABELS, DIMENSION_TO_FILTER, DimensionFilterKey, FiltersStore } from '../../core/filters-store';
import { ApiError, BreakdownRow, CostQuery, Dimension } from '../../core/api.types';
import { currenciesOf, formatMoney, labelForFilterValue, parseCost } from '../../core/currency';
import { PanelStateComponent, PanelStatus } from '../../shared/panel-state.component';
import { CHART_TEXT, BASE_CHART } from '../../shared/chart-theme';
import { RunRateComparison, SpendOverTime, StatCard, buildRunRate, buildSpendOverTime, buildStatCards } from './summary-metrics';

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

interface ServiceData {
  rows: BreakdownRow[];
  currency: string;
}

interface RunRateData {
  comparison: RunRateComparison;
  currency: string;
}

interface DataPanel<T> {
  status: PanelStatus;
  data: T | null;
  error: ApiError | null;
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

    <app-panel-state [status]="landingPanel().status" [error]="landingPanel().error">
      @if (landingPanel().data; as d) {
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

      }
    </app-panel-state>

    <div class="breakdown-grid">
      @if (landingPanel().data; as d) {
        <section class="card">
          <div class="panel-head">
            <h2>By {{ dimensionLabels[groupDim()].toLowerCase() }}</h2>
            <span class="sub">share of filtered spend — click a bar to filter</span>
          </div>
          <div class="resource-bars">
            @for (row of d.byResource; track row.dimension_value; let i = $index) {
              <button
                class="resource-bar"
                [class.active]="filterValue(filterKey()) === row.dimension_value"
                (click)="toggleResource(row.dimension_value)"
              >
                <span class="name">{{ labelFor(row.dimension_value) }}</span>
                <span class="track">
                  <span
                    class="fill"
                    [style.width.%]="barWidth(row, d.byResource)"
                    [style.background]="barColor(i)"
                  ></span>
                </span>
                <span class="amount">{{ fmt(row, d.currency) }}</span>
              </button>
            }
          </div>
        </section>
      }

      <section class="card">
        <div class="panel-head">
          <h2>By service</h2>
          <span class="sub">share of filtered spend — click a bar to filter</span>
        </div>
        <app-panel-state [status]="servicePanel().status" [error]="servicePanel().error">
          @if (servicePanel().data; as service) {
            <div class="resource-bars">
              @for (row of service.rows; track row.dimension_value; let i = $index) {
                <button
                  class="resource-bar"
                  [class.active]="filterValue('service') === row.dimension_value"
                  (click)="toggleFilter('service', row.dimension_value)"
                >
                  <span class="name">{{ labelFor(row.dimension_value) }}</span>
                  <span class="track">
                    <span
                      class="fill"
                      [style.width.%]="barWidth(row, service.rows)"
                      [style.background]="barColor(i)"
                    ></span>
                  </span>
                  <span class="amount">{{ fmt(row, service.currency) }}</span>
                </button>
              }
            </div>
          }
        </app-panel-state>
      </section>
    </div>

    @if (runRatePanel().status !== 'empty') {
      <section class="card run-rate-panel">
        <div class="panel-head">
          <h2>Daily run rate</h2>
          @if (runRatePanel().data; as runRate) {
            <span class="sub">{{ runRate.comparison.currentMonth }} vs {{ runRate.comparison.previousMonth }}</span>
          }
        </div>
        <app-panel-state [status]="runRatePanel().status" [error]="runRatePanel().error">
          @if (runRatePanel().data) {
            <div
              echarts
              [options]="runRateChart()"
              class="run-rate-chart"
              role="img"
              aria-label="Cumulative daily spend for the current and previous month"
            ></div>
          }
        </app-panel-state>
      </section>
    }
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
    .breakdown-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px; }
    .run-rate-chart { height: 300px; width: 100%; }
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
    @media (max-width: 900px) {
      .breakdown-grid { grid-template-columns: 1fr; }
    }
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
  private readonly localFilterSignals = Object.fromEntries(
    DIMENSION_FILTER_KEYS.map((key) => [key, signal<string | null>(null)]),
  ) as Record<DimensionFilterKey, ReturnType<typeof signal<string | null>>>;

  protected readonly landingPanel = signal<DataPanel<LandingData>>({
    status: 'loading',
    data: null,
    error: null,
  });
  protected readonly servicePanel = signal<DataPanel<ServiceData>>({ status: 'loading', data: null, error: null });
  protected readonly runRatePanel = signal<DataPanel<RunRateData>>({ status: 'loading', data: null, error: null });

  private readonly summaryQuery = computed<CostQuery>(() => {
    const query: CostQuery = { ...this.filters.globalQuery() };
    for (const key of DIMENSION_FILTER_KEYS) {
      const value = this.localFilterSignals[key]();
      if (value !== null) query[key] = value;
    }
    return query;
  });

  constructor() {
    const key = computed(() => ({
      query: this.summaryQuery(),
      dim: this.groupDim(),
      currency: this.filters.currency(),
    }));
    toObservable(key)
      .pipe(
        debounceTime(200),
        switchMap(({ query, dim }) => {
          const now = new Date();
          this.landingPanel.set({ status: 'loading', data: null, error: null });
          this.servicePanel.set({ status: 'loading', data: null, error: null });
          this.runRatePanel.set({ status: 'loading', data: null, error: null });

          return forkJoin({
            landing: this.api.execSummary(query, dim, TOP_N).pipe(
              catchError((error: ApiError) => {
                this.landingPanel.set({ status: 'error', data: null, error });
                return of(null);
              }),
            ),
            service: this.api.breakdown(query, 'service', TOP_N, false, 'day').pipe(
              catchError((error: ApiError) => {
                this.servicePanel.set({ status: 'error', data: null, error });
                return of(null);
              }),
            ),
            runRate: this.api.timeseries(this.runRateQuery(query, now), 'day').pipe(
              catchError((error: ApiError) => {
                this.runRatePanel.set({ status: 'error', data: null, error });
                return of(null);
              }),
            ),
          }).pipe(
            map(({ landing, service, runRate }) => {
              const dataThrough = landing?.rows.freshness ? new Date(landing.rows.freshness.data_through) : now;
              if (landing) {
                const agg = landing.rows;
                const currency = this.foregroundCurrency(agg.summary);
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
                const hasData = byResource.length || spend.months.length;
                this.landingPanel.set({
                  status: hasData ? 'ready' : 'empty',
                  data: hasData ? data : null,
                  error: null,
                });
              }

              if (service) {
                const currency = this.foregroundCurrency(service.rows);
                const rows = service.rows.filter((row) => row.currency === currency);
                this.servicePanel.set({
                  status: rows.length ? 'ready' : 'empty',
                  data: { rows, currency },
                  error: null,
                });
              }

              if (runRate) {
                const currency = this.foregroundCurrency(runRate.rows);
                const comparison = buildRunRate(runRate.rows, currency, now, dataThrough);
                this.runRatePanel.set({
                  status: comparison ? 'ready' : 'empty',
                  data: comparison ? { comparison, currency } : null,
                  error: null,
                });
              }
            }),
          );
        }),
      )
      .subscribe();
  }

  private foregroundCurrency(rows: Array<{ currency: string }>): string {
    return this.filters.currency() ?? currenciesOf(rows)[0] ?? 'USD';
  }

  private runRateQuery(query: CostQuery, now: Date): CostQuery {
    return {
      ...query,
      start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)).toISOString(),
      end: now.toISOString(),
    };
  }

  protected readonly spendChart = computed<EChartsOption>(() => {
    const data = this.landingPanel().data;
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

  protected readonly runRateChart = computed<EChartsOption>(() => {
    const data = this.runRatePanel().data;
    if (!data) return {};
    const { comparison, currency } = data;
    return {
      ...BASE_CHART,
      tooltip: {
        trigger: 'axis',
        valueFormatter: (v) => formatMoney(Number(v), currency, 2),
      },
      legend: { bottom: 0, textStyle: { color: CHART_TEXT } },
      grid: { left: 80, right: 24, top: 16, bottom: 56 },
      xAxis: { type: 'category', data: comparison.days.map(String), name: 'Day of month' },
      yAxis: { type: 'value', axisLabel: { formatter: (v: number) => formatMoney(v, currency) } },
      series: [
        {
          name: comparison.currentMonth,
          type: 'line' as const,
          symbol: 'none',
          data: comparison.current,
          color: STACK_PALETTE[0],
        },
        {
          name: comparison.previousMonth,
          type: 'line' as const,
          symbol: 'none',
          data: comparison.previous,
          color: OTHER_COLOR,
          lineStyle: { color: OTHER_COLOR, type: 'dashed' },
        },
      ],
    };
  });

  /** Bars share the stack chart's palette: top-7 rows are the chart series (same order), the rest are "Other" grey. */
  protected barColor(index: number): string {
    return index < TOP_N ? STACK_PALETTE[index % STACK_PALETTE.length] : OTHER_COLOR;
  }

  protected barWidth(row: BreakdownRow, rows: BreakdownRow[]): number {
    const max = Math.max(...rows.map((r) => parseCost(r.cost)), 1);
    return (parseCost(row.cost) / max) * 100;
  }

  protected fmt(row: BreakdownRow, currency: string): string {
    return formatMoney(parseCost(row.cost), currency, 2);
  }

  protected onGroupDim(event: Event): void {
    this.groupDim.set((event.target as HTMLSelectElement).value as Dimension);
  }

  protected filterValue(key: DimensionFilterKey): string | null {
    return this.localFilterSignals[key]();
  }

  protected toggleFilter(key: DimensionFilterKey, value: string): void {
    const current = this.localFilterSignals[key]();
    this.localFilterSignals[key].set(current === value ? null : value);
  }

  protected toggleResource(value: string): void {
    this.toggleFilter(this.filterKey(), value);
  }
}
