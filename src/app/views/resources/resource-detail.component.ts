import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { EMPTY, catchError, map } from 'rxjs';
import { NgxEchartsDirective } from 'ngx-echarts';
import type { EChartsOption } from 'echarts';
import { ApiError, Granularity, LineItemsRow, ResourceDetail } from '../../core/api.types';
import { CostApiService } from '../../core/cost-api.service';
import { labelForFilterValue, parseCost } from '../../core/currency';
import { FiltersStore } from '../../core/filters-store';
import { BASE_CHART, CHART_RAMP } from '../../shared/chart-theme';
import { MoneyPipe } from '../../shared/money.pipe';
import { PanelStateComponent, PanelStatus } from '../../shared/panel-state.component';

@Component({
  selector: 'app-resource-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MoneyPipe, RouterLink, NgxEchartsDirective, PanelStateComponent],
  template: `
    <a class="back" routerLink="/resources" queryParamsHandling="preserve">‹ All resources</a>
    <app-panel-state [status]="panel().status" [error]="panel().error">
      @if (panel().data; as r) {
        <span class="eyebrow">{{ r.service }} · {{ r.resource_type || 'Resource' }}</span>
        <h1>{{ labelFor(r.resource_name) }}</h1>
        <div class="card trend">
          <div class="panel-head">
            <h2>Cost trend</h2>
            <div class="grain-toggle" role="group" aria-label="Granularity">
              @for (g of grains; track g) {
                <button [class.on]="grain() === g" (click)="grain.set(g)">{{ g }}</button>
              }
            </div>
          </div>
          <div class="head-metrics">
            <span class="big">{{ r.cost | money: r.currency }}</span>
            @if (overageTotal() > 0) {
              <span class="overage">{{ overageTotal() }} overage items</span>
            }
          </div>
          <app-panel-state [status]="trendPanel().status" [error]="trendPanel().error">
            @if (trendPanel().status === 'ready') {
              <div echarts [options]="trendChart()" class="chart" role="img" aria-label="Line item cost trend for this resource"></div>
            }
          </app-panel-state>
        </div>
        <div class="card fields">
          @for (field of fieldsOf(r); track field.label) {
            <div class="field-row">
              <span class="eyebrow">{{ field.label }}</span>
              <span class="value" [class.mono]="field.mono">{{ field.value }}</span>
            </div>
          }
        </div>
      }
    </app-panel-state>
  `,
  styles: `
    .back {
      margin-right: 10px;
    }
    .trend {
      margin-top: 16px;
    }
    .fields {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 12px 24px;
      margin-top: 16px;
    }
    .field-row {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .field-row .value {
      font-size: 13px;
    }
    .field-row .value.mono {
      font-family: monospace;
      font-size: 11px;
      word-break: break-all;
    }
    .panel-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .grain-toggle button.on {
      background: var(--atd-logistics-blue);
      font-weight: 700;
    }
    .head-metrics {
      display: flex;
      align-items: baseline;
      gap: 16px;
      margin-bottom: 8px;
    }
    .head-metrics .big {
      font-weight: 800;
      font-size: 22px;
      color: var(--atd-distribution-blue);
    }
    .head-metrics .overage {
      color: var(--atd-error);
      font-weight: 700;
      font-size: 13px;
    }
    .chart {
      height: 380px;
      width: 100%;
    }
  `,
})
export class ResourceDetailComponent {
  readonly ocid = input.required<string>();

  private readonly api = inject(CostApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly filters = inject(FiltersStore);
  protected readonly grains: Granularity[] = ['day', 'week', 'month'];
  protected readonly grain = signal<Granularity>('day');
  // Path OCID uniquely identifies the resource; a stale resource_name/ocid
  // filter must not blank a valid detail URL. Keep date + other dimensions.
  private readonly scopedQuery = computed(() => {
    const { resource_name: _rn, ocid: _oc, ...rest } = this.filters.query();
    return rest;
  });
  protected labelFor = labelForFilterValue;

  protected readonly panel = signal<{
    status: PanelStatus;
    data: ResourceDetail | null;
    error: ApiError | null;
  }>({
    status: 'loading',
    data: null,
    error: null,
  });
  protected readonly trendPanel = signal<{
    status: PanelStatus;
    data: LineItemsRow[] | null;
    error: ApiError | null;
  }>({ status: 'loading', data: null, error: null });

  constructor() {
    this.filters.hydrateFromParams(this.route.snapshot.queryParams);

    effect(() => {
      const ocid = this.ocid();
      const query = this.scopedQuery();
      this.panel.set({ status: 'loading', data: null, error: null });
      this.api
        .resourceDetail(ocid, query)
        .pipe(
          map(({ rows }) => this.panel.set(rows.length ? { status: 'ready', data: rows[0], error: null } : { status: 'empty', data: null, error: null })),
          catchError((error: ApiError) => {
            this.panel.set({ status: 'error', data: null, error });
            return EMPTY;
          }),
        )
        .subscribe();
    });

    effect(() => {
      const ocid = this.ocid();
      const granularity = this.grain();
      const query = this.scopedQuery();
      this.trendPanel.set({ status: 'loading', data: null, error: null });
      this.api
        .lineItems({ ocid }, granularity, query)
        .pipe(
          map(({ rows }) =>
            this.trendPanel.set({
              status: rows.length ? 'ready' : 'empty',
              data: rows,
              error: null,
            }),
          ),
          catchError((error: ApiError) => {
            this.trendPanel.set({ status: 'error', data: null, error });
            return EMPTY;
          }),
        )
        .subscribe();
    });
  }

  protected fieldsOf(r: ResourceDetail) {
    return [
      { label: 'Description', value: r.description || '—', mono: false },
      { label: 'OCID', value: r.ocid, mono: true },
      { label: 'Compartment', value: r.compartment, mono: false },
      { label: 'Compartment ID', value: r.compartment_id, mono: true },
      { label: 'Region', value: r.region, mono: false },
      { label: 'Availability domain', value: r.availability_domain || '—', mono: false },
      { label: 'Environment', value: labelForFilterValue(r.environment), mono: false },
      { label: 'Cost center', value: labelForFilterValue(r.cost_center), mono: false },
      { label: 'Component type', value: labelForFilterValue(r.component_type), mono: false },
      { label: 'First seen', value: r.first_seen, mono: false },
      { label: 'Last seen', value: r.last_seen, mono: false },
    ];
  }

  protected readonly overageTotal = computed(() => (this.trendPanel().data ?? []).reduce((sum, row) => sum + row.overage_items, 0));

  protected readonly trendChart = computed<EChartsOption>(() => {
    const rows = [...(this.trendPanel().data ?? [])].sort((a, b) => a.bucket.localeCompare(b.bucket));
    return {
      ...BASE_CHART,
      tooltip: { trigger: 'axis' },
      grid: { left: 60, right: 24, top: 48, bottom: 36, containLabel: false },
      legend: { data: ['Cost', 'My cost'], top: 8, right: 8 },
      xAxis: { type: 'category', data: rows.map((r) => r.bucket.slice(0, 10)) },
      yAxis: { type: 'value' },
      series: [
        {
          name: 'Cost',
          type: 'line',
          symbol: 'none',
          data: rows.map((r) => parseCost(r.cost)),
          color: CHART_RAMP[0],
        },
        {
          name: 'My cost',
          type: 'line',
          symbol: 'none',
          data: rows.map((r) => parseCost(r.my_cost)),
          color: CHART_RAMP[2],
        },
      ],
    };
  });
}
