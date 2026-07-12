import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { EMPTY, catchError, debounceTime, forkJoin, map, of, switchMap } from 'rxjs';
import { NgxEchartsDirective } from 'ngx-echarts';
import type { EChartsOption } from 'echarts';
import { ApiError, Dimension, Granularity, TimeseriesRow } from '../../core/api.types';
import { CostApiService } from '../../core/cost-api.service';
import { DimensionFilterKey, FiltersStore } from '../../core/filters-store';
import { labelForFilterValue, parseCost } from '../../core/currency';
import { BASE_CHART, CHART_RAMP, bucketLabel } from '../../shared/chart-theme';
import { PanelStateComponent, PanelStatus } from '../../shared/panel-state.component';

const STACK_DIMENSIONS: { value: Dimension | ''; label: string }[] = [
  { value: '', label: 'No stacking' },
  { value: 'service', label: 'Service' },
  { value: 'compartment', label: 'Compartment' },
  { value: 'environment', label: 'Environment' },
  { value: 'cost_center', label: 'Cost Center' },
  { value: 'component_type', label: 'Component Type' },
];

const DIMENSION_TO_FILTER: Record<string, DimensionFilterKey> = {
  service: 'service',
  compartment: 'compartment',
  environment: 'env',
  cost_center: 'cost_center',
  component_type: 'component_type',
};

const TOP_SERIES = 5;

interface Series {
  name: string;
  rows: TimeseriesRow[];
}

@Component({
  selector: 'app-trends',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgxEchartsDirective, PanelStateComponent],
  template: `
    <span class="eyebrow">Trends</span>
    <h1>Cost trends</h1>

    <div class="card">
      <div class="panel-head">
        <div class="grain-toggle" role="group" aria-label="Granularity">
          @for (g of grains; track g) {
            <button [class.on]="filters.granularity() === g" (click)="filters.granularity.set(g)">{{ g }}</button>
          }
        </div>
        <label>
          <span class="eyebrow">Stack by</span>
          <select (change)="onStack($event)" aria-label="Stack by dimension">
            @for (option of stackOptions; track option.value) {
              <option [value]="option.value" [selected]="option.value === stackBy()">{{ option.label }}</option>
            }
          </select>
        </label>
      </div>
      <app-panel-state [status]="panel().status" [error]="panel().error">
        @if (panel().status === 'ready') {
          <div
            echarts
            [options]="chart()"
            class="chart"
            role="img"
            aria-label="Cost trend over time, optionally stacked by dimension"
          ></div>
        }
      </app-panel-state>
    </div>
  `,
  styles: `
    .panel-head { display: flex; justify-content: space-between; align-items: end; margin-bottom: 12px; }
    .panel-head label { display: flex; flex-direction: column; gap: 4px; }
    .grain-toggle button.on { background: var(--atd-logistics-blue); font-weight: 700; }
    .chart { height: 420px; width: 100%; }
  `,
})
export class TrendsComponent {
  private readonly api = inject(CostApiService);
  protected readonly filters = inject(FiltersStore);

  protected readonly grains: Granularity[] = ['hour', 'day', 'week', 'month'];
  protected readonly stackOptions = STACK_DIMENSIONS;
  protected readonly stackBy = signal<Dimension | ''>('');
  protected readonly panel = signal<{ status: PanelStatus; data: Series[] | null; error: ApiError | null }>({
    status: 'loading',
    data: null,
    error: null,
  });

  constructor() {
    const key = computed(() => ({
      query: this.filters.query(),
      grain: this.filters.granularity(),
      stack: this.stackBy(),
    }));
    toObservable(key)
      .pipe(
        debounceTime(200),
        switchMap(({ query, grain, stack }) => {
          this.panel.set({ status: 'loading', data: null, error: null });
          const series$ = stack
            ? // top-N values of the stack dimension, then one timeseries per value
              this.api.breakdown(query, stack, TOP_SERIES).pipe(
                switchMap(({ rows }) => {
                  if (!rows.length) return of([] as Series[]);
                  return forkJoin(
                    rows.map((row) =>
                      this.api
                        .timeseries({ ...query, [DIMENSION_TO_FILTER[stack]]: row.dimension_value }, grain)
                        .pipe(
                          map((r) => ({ name: labelForFilterValue(row.dimension_value), rows: r.rows })),
                        ),
                    ),
                  );
                }),
              )
            : this.api.timeseries(query, grain).pipe(map((r) => [{ name: 'Total', rows: r.rows }]));
          return series$.pipe(
            map((series) => {
              const hasData = series.some((s) => s.rows.length);
              this.panel.set({ status: hasData ? 'ready' : 'empty', data: series, error: null });
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

  protected onStack(event: Event): void {
    this.stackBy.set((event.target as HTMLSelectElement).value as Dimension | '');
  }

  protected readonly chart = computed<EChartsOption>(() => {
    const series = this.panel().data ?? [];
    const buckets = [...new Set(series.flatMap((s) => s.rows.map((r) => r.bucket)))].sort();
    const stacked = series.length > 1;
    return {
      ...BASE_CHART,
      tooltip: { trigger: 'axis' },
      legend: stacked ? { data: series.map((s) => s.name), top: 0 } : undefined,
      grid: { left: 60, right: 16, top: 48, bottom: 40 },
      xAxis: { type: 'category', data: buckets.map((b) => bucketLabel(b, this.filters.granularity())) },
      yAxis: { type: 'value' },
      series: series.map((s, i) => {
        const byBucket = new Map(s.rows.map((r) => [r.bucket, parseCost(r.cost)]));
        return {
          name: s.name,
          type: 'line' as const,
          symbol: 'none',
          stack: stacked ? 'total' : undefined,
          areaStyle: { opacity: stacked ? 0.35 : 0.15 },
          data: buckets.map((b) => byBucket.get(b) ?? 0),
          color: CHART_RAMP[i % CHART_RAMP.length],
        };
      }),
    };
  });
}
