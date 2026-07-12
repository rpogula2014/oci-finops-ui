import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import {
  Boxes,
  Compass,
  LayoutDashboard,
  LucideAngularModule,
  TrendingUp,
} from 'lucide-angular';
import { CostApiService } from './core/cost-api.service';
import { FiltersStore } from './core/filters-store';
import { Freshness } from './core/api.types';
import { currenciesOf } from './core/currency';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, LucideAngularModule, DatePipe],
  template: `
    <header class="topbar">
      <span class="wordmark">ATD  <span class="sub">OCI FINOPS</span></span>
      <div class="controls">
        <select class="preset" (change)="onPreset($event)" aria-label="Date range preset">
          @for (p of presets; track p.id) {
            <option [value]="p.id" [selected]="p.id === preset()">{{ p.label }}</option>
          }
        </select>
        @if (preset() === 'custom') {
          <label class="range">
            <span class="eyebrow">From</span>
            <input type="date" [value]="startDate()" (change)="onStartChange($event)" aria-label="Start date" />
          </label>
          <label class="range">
            <span class="eyebrow">To</span>
            <input type="date" [value]="endDate()" (change)="onEndChange($event)" aria-label="End date" />
          </label>
        } @else {
          <span class="range-echo">{{ startDate() }} → {{ endDate() }}</span>
        }
        @if (currencies().length > 1) {
          <select (change)="onCurrencyChange($event)" aria-label="Currency">
            @for (c of currencies(); track c) {
              <option [value]="c" [selected]="c === filters.currency()">{{ c }}</option>
            }
          </select>
        } @else if (currencies().length === 1) {
          <span class="currency-label">{{ currencies()[0] }}</span>
        }
        @if (freshness(); as f) {
          <span class="freshness" title="Loaded {{ f.loaded_at | date: 'medium' }}">
            Data through {{ f.data_through | date: 'MMM d, HH:mm' }} UTC
          </span>
        }
      </div>
    </header>

    <div class="layout">
      <nav class="sidenav" aria-label="Main navigation">
        <a routerLink="/summary" routerLinkActive="active">
          <lucide-icon [img]="icons.summary" [size]="18" aria-hidden="true" />Executive Summary
        </a>
        <a routerLink="/explorer" routerLinkActive="active">
          <lucide-icon [img]="icons.explorer" [size]="18" aria-hidden="true" />Cost Explorer
        </a>
        <a routerLink="/resources" routerLinkActive="active">
          <lucide-icon [img]="icons.resources" [size]="18" aria-hidden="true" />Resources
        </a>
        <a routerLink="/trends" routerLinkActive="active">
          <lucide-icon [img]="icons.trends" [size]="18" aria-hidden="true" />Trends
        </a>
      </nav>
      <main class="content">
        <router-outlet />
      </main>
    </div>
  `,
  styles: `
    :host { display: block; height: 100%; }
    .topbar {
      height: var(--header-height);
      background: var(--atd-distribution-blue);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 24px;
      position: sticky;
      top: 0;
      z-index: 10;
    }
    .wordmark { font-weight: 800; font-size: 18px; letter-spacing: 0.02em; }
    .wordmark .divider { color: var(--atd-red); margin: 0 4px; }
    .wordmark .sub { font-weight: 700; font-size: 12px; letter-spacing: 0.12em; }
    .controls { display: flex; align-items: center; gap: 16px; }
    .range { display: flex; align-items: center; gap: 6px; }
    .range .eyebrow { color: var(--atd-grey-500); }
    .preset { font-weight: 700; }
    .range-echo { font-size: 12px; color: var(--atd-grey-300); }
    .currency-label { font-weight: 700; font-size: 13px; }
    .freshness { font-size: 12px; color: var(--atd-grey-300); }
    .layout { display: flex; min-height: calc(100% - var(--header-height)); }
    .sidenav {
      width: var(--sidebar-width);
      background: #fff;
      padding: 16px 8px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      flex-shrink: 0;
    }
    .sidenav a {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      border-radius: var(--radius-md);
      color: var(--atd-concrete-grey);
      font-size: 14px;
      transition: background 160ms var(--ease-calm);
    }
    .sidenav a:hover { background: var(--atd-grey-050); text-decoration: none; }
    .sidenav a.active {
      background: var(--atd-logistics-blue);
      color: var(--atd-distribution-blue);
      font-weight: 700;
    }
    .content {
      flex: 1;
      max-width: var(--container-max);
      padding: 24px;
      width: 100%;
    }
  `,
})
export class App {
  protected readonly filters = inject(FiltersStore);
  private readonly api = inject(CostApiService);

  protected readonly icons = {
    summary: LayoutDashboard,
    explorer: Compass,
    resources: Boxes,
    trends: TrendingUp,
  };

  protected readonly freshness = signal<Freshness | null>(null);
  protected readonly currencies = signal<string[]>([]);

  protected readonly presets = [
    { id: 'last6m', label: 'Last 6 months' },
    { id: 'current_month', label: 'Current month' },
    { id: 'last_month', label: 'Last month' },
    { id: 'this_quarter', label: 'This quarter' },
    { id: 'this_year', label: 'This year' },
    { id: 'custom', label: 'Custom range' },
  ] as const;
  protected readonly preset = signal<(typeof this.presets)[number]['id']>('last6m');

  protected readonly startDate = () => this.filters.start().slice(0, 10);
  protected readonly endDate = () => this.filters.end().slice(0, 10);

  constructor() {
    this.api.freshness().subscribe({
      next: ({ rows }) => this.freshness.set(rows),
      error: () => this.freshness.set(null),
    });
    // learn available currencies once, for the top-bar selector (design D1)
    this.api.summary(this.filters.query()).subscribe({
      next: ({ rows }) => this.currencies.set(currenciesOf(rows)),
      error: () => this.currencies.set([]),
    });
  }

  protected onPreset(event: Event): void {
    const id = (event.target as HTMLSelectElement).value as (typeof this.presets)[number]['id'];
    this.preset.set(id);
    if (id === 'custom') return; // keep current range, let the user edit it
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth();
    const ranges: Record<string, [Date, Date]> = {
      last6m: [new Date(Date.UTC(y, m - 6, now.getUTCDate())), now],
      current_month: [new Date(Date.UTC(y, m, 1)), now],
      last_month: [new Date(Date.UTC(y, m - 1, 1)), new Date(Date.UTC(y, m, 1))],
      this_quarter: [new Date(Date.UTC(y, Math.floor(m / 3) * 3, 1)), now],
      this_year: [new Date(Date.UTC(y, 0, 1)), now],
    };
    const [start, end] = ranges[id];
    this.filters.setRange(start.toISOString(), end.toISOString());
  }

  protected onStartChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (value) this.filters.setRange(new Date(value).toISOString(), this.filters.end());
  }

  protected onEndChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (value) this.filters.setRange(this.filters.start(), new Date(value + 'T23:59:59Z').toISOString());
  }

  protected onCurrencyChange(event: Event): void {
    this.filters.currency.set((event.target as HTMLSelectElement).value);
  }
}
