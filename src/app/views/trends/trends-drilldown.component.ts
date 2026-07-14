import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { EMPTY, catchError, debounceTime, forkJoin, map, of, switchMap } from 'rxjs';
import { NgxEchartsDirective } from 'ngx-echarts';
import type { EChartsOption } from 'echarts';
import { AnomalyOptions, AnomalyRow, ApiError, Dimension, Granularity, TimeseriesRow, TrendMoverRow } from '../../core/api.types';
import { CostApiService } from '../../core/cost-api.service';
import { DIMENSION_LABELS, DIMENSION_TO_FILTER, FiltersStore } from '../../core/filters-store';
import { formatMoney, labelForFilterValue, parseCost } from '../../core/currency';
import { BASE_CHART, CHART_RAMP, bucketLabel } from '../../shared/chart-theme';
import { PanelStateComponent, PanelStatus } from '../../shared/panel-state.component';
import { FocusStep, nextFocusDimension, withFocus } from './focus-path';

const DIMENSIONS: Dimension[] = ['service', 'compartment', 'environment', 'cost_center', 'component_type', 'resource_type', 'resource_name'];
const STACK_DIMENSIONS: { value: Dimension | ''; label: string }[] = [{ value: '', label: 'No stacking' }, ...DIMENSIONS.map((value) => ({ value, label: DIMENSION_LABELS[value] }))];
const TOP_SERIES = 5;

interface Panel<T> { status: PanelStatus; data: T | null; error: ApiError | null; }
interface Series { name: string; rows: TimeseriesRow[]; }

@Component({
  selector: 'app-trends-drilldown',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgxEchartsDirective, PanelStateComponent],
  template: `
    <section id="trends-drilldown" aria-labelledby="drilldown-title">
      <div class="section-head">
        <div><span class="eyebrow">Investigate</span><h2 id="drilldown-title">Dimension drilldown</h2></div>
        <label><span class="eyebrow">Dimension</span>
          <select [value]="dimension()" (change)="onDimension($event)" aria-label="Analysis dimension">
            @for (option of dimensions; track option) { <option [value]="option" [disabled]="isFocused(option)">{{ labels[option] }}</option> }
          </select>
        </label>
      </div>
      @if (focus().length) {
        <div class="focus-path" aria-label="Drilldown focus">
          <span class="eyebrow">Focus</span><strong>{{ focus().map(focusLabel).join(' › ') }}</strong>
          <button (click)="backFocus()">Back</button><button (click)="clearFocus()">Clear focus</button><button (click)="openInExplorer.emit()">Open in Cost Explorer</button>
        </div>
      }

      <div class="analysis-grid">
        <div class="card"><div class="panel-head"><h3>Movers</h3><span>Click a row to drill in</span></div>
          <app-panel-state [status]="moversPanel().status" [error]="moversPanel().error">
            <table class="data"><thead><tr><th>{{ labels[dimension()] }}</th><th>Current</th><th>Previous</th><th>Change</th></tr></thead><tbody>
              @for (row of moversPanel().data; track row.dimension_value) { <tr (click)="drill(row.dimension_value)"><td>{{ label(row.dimension_value) }}</td><td>{{ money(row.current_cost, row.currency) }}</td><td>{{ money(row.previous_cost, row.currency) }}</td><td [class.negative]="(row.change_amount ?? 0) < 0">{{ signedMoney(row.change_amount, row.currency) }}</td></tr> }
            </tbody></table>
          </app-panel-state>
        </div>
        <div class="card"><div class="panel-head"><h3>Anomalies</h3><span>Cost vs baseline</span></div>
          <app-panel-state [status]="anomaliesPanel().status" [error]="anomaliesPanel().error">
            <table class="data"><thead><tr><th>Day</th><th>Cost</th><th>Baseline</th><th>z</th></tr></thead><tbody>
              @for (row of foregroundAnomalies(); track row.day + row.dimension_value) { <tr (click)="drill(row.dimension_value)"><td><span class="severity" [class.critical]="row.severity === 'critical'">{{ row.severity }}</span> {{ row.day }}</td><td>{{ money(row.cost, row.currency) }}</td><td>{{ money(row.baseline, row.currency) }}</td><td>{{ row.z_score }}</td></tr> }
            </tbody></table>
          </app-panel-state>
        </div>
      </div>

      <div class="card chart-card">
        <div class="panel-head"><h3>Cost over time</h3>
          <div class="controls"><div class="grain-toggle" role="group" aria-label="Granularity">@for (grainValue of grains; track grainValue) { <button [class.on]="grain() === grainValue" (click)="grainChange.emit(grainValue)">{{ grainValue }}</button> }</div>
          <select (change)="onStack($event)" aria-label="Stack by dimension">@for (option of stackOptions; track option.value) { <option [value]="option.value" [selected]="option.value === stackBy()">{{ option.label }}</option> }</select></div>
        </div>
        <app-panel-state [status]="chartPanel().status" [error]="chartPanel().error">
          @if (chartPanel().status === 'ready') { <div echarts [options]="chart()" class="chart" role="img" aria-label="Cost trend with anomaly markers"></div> }
        </app-panel-state>
      </div>
    </section>
  `,
  styles: `
    :host { display:block; } .section-head, .panel-head, .controls { display:flex; align-items:end; justify-content:space-between; gap:12px; } .section-head { margin-bottom:12px; } h2 { margin:0; }
    .section-head label { display:flex; flex-direction:column; gap:4px; } .focus-path { display:flex; align-items:center; flex-wrap:wrap; gap:8px; margin:0 0 16px; padding:8px 10px; background:var(--atd-logistics-blue); border-radius:var(--radius-md); } .focus-path strong { color:var(--atd-distribution-blue); font-size:13px; } .focus-path button { padding:3px 7px; font-size:12px; } .analysis-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px; } tr { cursor:pointer; } .negative { color:var(--atd-error); }
    .severity { color:var(--atd-warning); font-size:11px; font-weight:700; text-transform:uppercase; } .severity.critical { color:var(--atd-error); } .chart-card { margin-top:16px; } .chart { height:420px; width:100%; }
    .grain-toggle button.on { background:var(--atd-logistics-blue); font-weight:700; } @media (max-width: 900px) { .analysis-grid { grid-template-columns:1fr; } .panel-head { align-items:flex-start; flex-direction:column; } }
  `,
})
export class TrendsDrilldownComponent {
  readonly options = input.required<AnomalyOptions>();
  readonly focus = input<readonly FocusStep[]>([]);
  readonly dimension = input<Dimension>('service');
  readonly grain = input<Granularity>('day');
  readonly stackBy = input<Dimension | ''>('');
  readonly focusChange = output<FocusStep[]>();
  readonly dimensionChange = output<Dimension>();
  readonly grainChange = output<Granularity>();
  readonly stackByChange = output<Dimension | ''>();
  readonly openInExplorer = output<void>();
  private readonly api = inject(CostApiService);
  protected readonly filters = inject(FiltersStore);
  protected readonly dimensions = DIMENSIONS;
  protected readonly labels = DIMENSION_LABELS;
  protected readonly grains: Granularity[] = ['hour', 'day', 'week', 'month'];
  protected readonly stackOptions = STACK_DIMENSIONS;
  readonly moversPanel = signal<Panel<TrendMoverRow[]>>({ status: 'loading', data: null, error: null });
  readonly anomaliesPanel = signal<Panel<AnomalyRow[]>>({ status: 'loading', data: null, error: null });
  readonly chartPanel = signal<Panel<Series[]>>({ status: 'loading', data: null, error: null });
  readonly currency = computed(() => this.filters.currency() ?? this.anomaliesPanel().data?.[0]?.currency ?? this.moversPanel().data?.[0]?.currency ?? null);
  readonly foregroundAnomalies = computed(() => (this.anomaliesPanel().data ?? []).filter((row) => row.currency === this.currency()));

  constructor() {
    const analysisRequest = computed(() => ({ query: withFocus(this.filters.query(), this.focus()), dimension: this.dimension(), options: this.options(), grain: this.grain() }));
    toObservable(analysisRequest).pipe(debounceTime(200), switchMap(({ query, dimension, grain }) => {
      this.moversPanel.set({ status: 'loading', data: null, error: null });
      return this.api.trendMovers(query, dimension, { granularity: grain === 'hour' ? 'day' : grain }).pipe(
        map(({ rows }) => this.moversPanel.set({ status: rows.length ? 'ready' : 'empty', data: rows, error: null })),
        catchError((error: ApiError) => { this.moversPanel.set({ status: 'error', data: null, error }); return EMPTY; }),
      );
    })).subscribe();
    toObservable(analysisRequest).pipe(debounceTime(200), switchMap(({ query, dimension, options }) => {
      this.anomaliesPanel.set({ status: 'loading', data: null, error: null });
      return this.api.anomalies(query, dimension, options).pipe(
        map(({ rows }) => this.anomaliesPanel.set({ status: rows.length ? 'ready' : 'empty', data: rows, error: null })),
        catchError((error: ApiError) => { this.anomaliesPanel.set({ status: 'error', data: null, error }); return EMPTY; }),
      );
    })).subscribe();
    const chartRequest = computed(() => ({ query: withFocus(this.filters.query(), this.focus()), grain: this.grain(), stack: this.stackBy() }));
    toObservable(chartRequest).pipe(debounceTime(200), switchMap(({ query, grain, stack }) => {
      this.chartPanel.set({ status: 'loading', data: null, error: null });
      const series$ = stack ? this.api.breakdown(query, stack, TOP_SERIES).pipe(switchMap(({ rows }) => rows.length ? forkJoin(rows.map((row) => this.api.timeseries({ ...query, [DIMENSION_TO_FILTER[stack]]: row.dimension_value }, grain).pipe(map(({ rows: seriesRows }) => ({ name: labelForFilterValue(row.dimension_value), rows: seriesRows }))))) : of([] as Series[]))) : this.api.timeseries(query, grain).pipe(map(({ rows }) => [{ name: 'Total', rows }]));
      return series$.pipe(
        map((series) => this.chartPanel.set({ status: series.some((item) => item.rows.length) ? 'ready' : 'empty', data: series, error: null })),
        catchError((error: ApiError) => { this.chartPanel.set({ status: 'error', data: null, error }); return EMPTY; }),
      );
    })).subscribe();
  }

  protected onDimension(event: Event): void { this.dimensionChange.emit((event.target as HTMLSelectElement).value as Dimension); }
  protected onStack(event: Event): void { this.stackByChange.emit((event.target as HTMLSelectElement).value as Dimension | ''); }
  protected drill(value: string): void {
    const current = this.dimension();
    const focus = [...this.focus(), { dimension: current, value }];
    this.focusChange.emit(focus);
    this.dimensionChange.emit(nextFocusDimension(current, focus));
  }
  protected backFocus(): void {
    const last = this.focus().at(-1);
    if (!last) return;
    this.focusChange.emit(this.focus().slice(0, -1));
    this.dimensionChange.emit(last.dimension);
  }
  protected clearFocus(): void {
    this.focusChange.emit([]);
    this.dimensionChange.emit('service');
  }
  protected isFocused(dimension: Dimension): boolean { return this.focus().some((step) => step.dimension === dimension); }
  protected label(value: string): string { return labelForFilterValue(value); }
  protected focusLabel = (step: FocusStep) => `${DIMENSION_LABELS[step.dimension]} = ${this.label(step.value)}`;
  protected money(value: number | null, currency: string): string { return value === null ? '—' : formatMoney(value, currency); }
  protected signedMoney(value: number | null, currency: string): string { return value === null ? '—' : `${value >= 0 ? '+' : '−'}${formatMoney(Math.abs(value), currency)}`; }
  protected readonly chart = computed<EChartsOption>(() => {
    const series = this.chartPanel().data ?? [];
    const buckets = [...new Set(series.flatMap((item) => item.rows.map((row) => row.bucket)))].sort();
    const stacked = series.length > 1;
    const markers = this.grain() === 'day' ? this.foregroundAnomalies().map((row) => ({
      name: row.dimension_value, coord: [bucketLabel(row.day, 'day'), row.cost], value: row.severity, symbol: 'circle', symbolSize: 11,
      itemStyle: { color: row.severity === 'critical' ? '#E72300' : '#F5730C' },
      tooltip: { formatter: `${formatMoney(row.cost, row.currency)} vs ${formatMoney(row.baseline, row.currency)} baseline · z=${row.z_score}` },
    })) : [];
    return { ...BASE_CHART, tooltip: { trigger: 'axis' }, legend: stacked ? { data: series.map((item) => item.name), top: 0 } : undefined, grid: { left: 60, right: 16, top: 48, bottom: 40 }, xAxis: { type: 'category', data: buckets.map((bucket) => bucketLabel(bucket, this.grain())) }, yAxis: { type: 'value' }, series: series.map((item, index) => {
      const byBucket = new Map(item.rows.map((row) => [row.bucket, parseCost(row.cost)]));
      return { name: item.name, type: 'line' as const, symbol: 'none', stack: stacked ? 'total' : undefined, areaStyle: { opacity: stacked ? 0.35 : 0.15 }, data: buckets.map((bucket) => byBucket.get(bucket) ?? 0), color: CHART_RAMP[index % CHART_RAMP.length], markPoint: index === 0 && markers.length ? { data: markers } : undefined };
    }) } as EChartsOption;
  });
}
