import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { EMPTY, catchError, debounceTime, forkJoin, map, switchMap } from 'rxjs';
import { AnomalyOptions, AnomalyRow, ApiError, Dimension, TrendMoverRow } from '../../core/api.types';
import { CostApiService } from '../../core/cost-api.service';
import { DIMENSION_LABELS, FiltersStore } from '../../core/filters-store';
import { formatMoney, labelForFilterValue } from '../../core/currency';
import { PanelStateComponent, PanelStatus } from '../../shared/panel-state.component';
import { AnomalyEvent, DimensionAnomaly, clusterAnomalyEvents } from './anomaly-events';

const ANOMALY_DIMENSIONS: Dimension[] = ['service', 'compartment', 'environment', 'resource_name'];
const MOVER_DIMENSIONS: Dimension[] = ['service', 'compartment', 'environment'];

interface Panel<T> {
  status: PanelStatus;
  data: T | null;
  error: ApiError | null;
}

interface DimensionMover extends TrendMoverRow {
  dimension: Dimension;
}

@Component({
  selector: 'app-trends-highlights',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PanelStateComponent],
  template: `
    <section aria-labelledby="highlights-title">
      <div class="section-head">
        <div>
          <span class="eyebrow">Automatic analysis</span>
          <h2 id="highlights-title">What changed</h2>
        </div>
        <span class="scope">{{ currency() ?? 'Loading currency' }}</span>
      </div>

      <div class="stat-grid">
        <div class="card stat">
          <span class="eyebrow">Critical anomalies</span>
          <strong>{{ criticalRows().length }}</strong>
          <small>{{ money(criticalExcess()) }} total deviation</small>
        </div>
        <div class="card stat">
          <span class="eyebrow">Top riser</span>
          @if (topRiser(); as row) { <strong>{{ label(row.dimension_value) }}</strong><small>{{ signedMoney(row.change_amount ?? 0) }}</small> }
          @else { <strong>—</strong><small>No rising mover</small> }
        </div>
        <div class="card stat">
          <span class="eyebrow">Top faller</span>
          @if (topFaller(); as row) { <strong>{{ label(row.dimension_value) }}</strong><small>{{ signedMoney(row.change_amount ?? 0) }}</small> }
          @else { <strong>—</strong><small>No falling mover</small> }
        </div>
      </div>

      <div class="grid">
        <div class="card">
          <div class="panel-head"><h3>Notable anomaly events</h3><span>Top 5</span></div>
          <app-panel-state [status]="anomaliesPanel().status" [error]="anomaliesPanel().error">
            <div class="events">
              @for (event of events(); track event.dimension + event.dimensionValue + event.startDay + event.direction) {
                <article class="event" [class.drop]="event.direction === 'drop'">
                  <div>
                    <span class="pill">{{ event.direction }}</span>
                    <strong>{{ label(event.dimensionValue) }}</strong>
                    <small>{{ event.startDay }}@if (event.endDay !== event.startDay) { –{{ event.endDay }} }</small>
                  </div>
                  <div class="event-value">
                    <strong>{{ money(event.peak.cost) }}</strong>
                    <small>vs {{ money(event.peak.baseline) }} · z={{ event.peak.z_score }}</small>
                  </div>
                  @if (event.seenAt.length) {
                    <p>Seen at {{ event.seenAt.map(seenAtLabel).join(' · ') }}</p>
                  }
                  <button (click)="investigate.emit({ dimension: event.dimension, value: event.dimensionValue })">Investigate</button>
                </article>
              }
            </div>
          </app-panel-state>
        </div>

        <div class="card">
          <div class="panel-head"><h3>Top movers</h3><span>Current vs prior period</span></div>
          <app-panel-state [status]="moversPanel().status" [error]="moversPanel().error">
            <div class="movers">
              @for (bar of moverBars(); track bar.row.dimension_value) {
                <button class="mover" (click)="investigate.emit({ dimension: bar.row.dimension, value: bar.row.dimension_value })">
                  <span>{{ label(bar.row.dimension_value) }}</span>
                  <span class="bar"><i [class.negative]="bar.amount < 0" [style.width.%]="bar.width"></i></span>
                  <strong [class.negative]="bar.amount < 0">{{ signedMoney(bar.amount) }}</strong>
                </button>
              }
            </div>
          </app-panel-state>
        </div>
      </div>
    </section>
  `,
  styles: `
    :host { display: block; margin-bottom: 32px; } .section-head, .panel-head { display:flex; justify-content:space-between; align-items:end; gap:12px; }
    .section-head { margin-bottom:12px; } .section-head h2 { margin:0; } .scope, .panel-head span, small { color:var(--atd-grey-700); font-size:12px; }
    .stat-grid { display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:16px; margin-bottom:16px; } .stat { display:flex; flex-direction:column; gap:4px; }
    .stat strong { font-size:20px; color:var(--atd-distribution-blue); } .grid { display:grid; grid-template-columns:minmax(0, 1.3fr) minmax(0, 1fr); gap:16px; }
    .events { display:flex; flex-direction:column; gap:10px; } .event { display:grid; grid-template-columns:1fr auto; gap:4px 12px; padding:10px 0; border-bottom:1px solid var(--atd-grey-300); }
    .event:last-child { border:0; } .event div { display:flex; flex-direction:column; align-items:start; gap:2px; } .event-value { text-align:right; align-items:end !important; }
    .event p { grid-column:1 / -1; margin:0; font-size:12px; color:var(--atd-grey-700); } .event button { grid-column:2; justify-self:end; padding:3px 7px; font-size:12px; }
    .pill { background:#fdeceb; color:var(--atd-error); border-radius:99px; padding:1px 6px; font-size:11px; font-weight:700; text-transform:uppercase; } .drop .pill { background:#e1ebf4; color:var(--atd-pacific-blue); }
    .movers { display:flex; flex-direction:column; gap:10px; } .mover { display:grid; grid-template-columns:minmax(76px, 1fr) 1.7fr auto; align-items:center; gap:8px; border:0; padding:0; background:transparent; text-align:left; }
    .bar { height:8px; background:var(--atd-grey-050); border-radius:99px; overflow:hidden; } .bar i { display:block; height:100%; background:var(--atd-success); border-radius:inherit; } .bar i.negative, .negative { color:var(--atd-error); } .bar i.negative { background:var(--atd-red); }
    @media (max-width: 900px) { .grid { grid-template-columns:1fr; } } @media (max-width: 620px) { .stat-grid { grid-template-columns:1fr; } }
  `,
})
export class TrendsHighlightsComponent {
  readonly options = input.required<AnomalyOptions>();
  readonly investigate = output<{ dimension: Dimension; value: string }>();
  private readonly api = inject(CostApiService);
  private readonly filters = inject(FiltersStore);
  readonly anomaliesPanel = signal<Panel<DimensionAnomaly[]>>({ status: 'loading', data: null, error: null });
  readonly moversPanel = signal<Panel<DimensionMover[]>>({ status: 'loading', data: null, error: null });
  readonly currency = computed(() => this.filters.currency() ?? this.anomaliesPanel().data?.[0]?.currency ?? this.moversPanel().data?.[0]?.currency ?? null);
  readonly events = computed(() => clusterAnomalyEvents(this.anomaliesPanel().data ?? [], { currency: this.currency() }));
  readonly criticalRows = computed(() => (this.anomaliesPanel().data ?? []).filter((row) => row.currency === this.currency() && row.severity === 'critical'));
  readonly criticalExcess = computed(() => this.criticalRows().reduce((total, row) => total + Math.abs(row.deviation), 0));
  readonly foregroundMovers = computed(() => (this.moversPanel().data ?? []).filter((row) => row.currency === this.currency()));
  readonly topRiser = computed(() => this.foregroundMovers().filter((row) => row.direction === 'rising' || row.direction === 'new').sort((a, b) => (b.change_amount ?? 0) - (a.change_amount ?? 0))[0] ?? null);
  readonly topFaller = computed(() => this.foregroundMovers().filter((row) => row.direction === 'falling' || row.direction === 'gone').sort((a, b) => (a.change_amount ?? 0) - (b.change_amount ?? 0))[0] ?? null);
  readonly moverBars = computed(() => {
    const rows = [...this.foregroundMovers()].filter((row) => row.change_amount !== null).sort((a, b) => Math.abs(b.change_amount ?? 0) - Math.abs(a.change_amount ?? 0)).slice(0, 5);
    const max = Math.max(...rows.map((row) => Math.abs(row.change_amount ?? 0)), 1);
    return rows.map((row) => ({ row, amount: row.change_amount ?? 0, width: Math.abs(row.change_amount ?? 0) / max * 100 }));
  });

  constructor() {
    const request = computed(() => ({ query: this.filters.query(), options: this.options() }));
    toObservable(request).pipe(debounceTime(200), switchMap(({ query, options }) => {
      this.anomaliesPanel.set({ status: 'loading', data: null, error: null });
      return forkJoin(ANOMALY_DIMENSIONS.map((dimension) => this.api.anomalies(query, dimension, options).pipe(map(({ rows }) => rows.map((row) => ({ ...row, dimension })))))).pipe(
        map((sets) => this.anomaliesPanel.set({ status: sets.flat().length ? 'ready' : 'empty', data: sets.flat(), error: null })),
        catchError((error: ApiError) => { this.anomaliesPanel.set({ status: 'error', data: null, error }); return EMPTY; }),
      );
    })).subscribe();
    toObservable(request).pipe(debounceTime(200), switchMap(({ query }) => {
      this.moversPanel.set({ status: 'loading', data: null, error: null });
      return forkJoin(MOVER_DIMENSIONS.map((dimension) => this.api.trendMovers(query, dimension).pipe(map(({ rows }) => rows.map((row) => ({ ...row, dimension })))))).pipe(
        map((sets) => this.moversPanel.set({ status: sets.flat().length ? 'ready' : 'empty', data: sets.flat(), error: null })),
        catchError((error: ApiError) => { this.moversPanel.set({ status: 'error', data: null, error }); return EMPTY; }),
      );
    })).subscribe();
  }

  protected label(value: string): string { return labelForFilterValue(value); }
  protected seenAtLabel = (row: { dimension: Dimension; value: string }) => `${DIMENSION_LABELS[row.dimension]} ${this.label(row.value)}`;
  protected money(value: number): string { return formatMoney(value, this.currency() ?? 'USD'); }
  protected signedMoney(value: number): string { return `${value >= 0 ? '+' : '−'}${this.money(Math.abs(value))}`; }
}
