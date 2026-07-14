import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AnomalyOptions, Dimension, Granularity } from '../../core/api.types';
import { DIMENSION_TO_FILTER, FiltersStore } from '../../core/filters-store';
import { FocusStep, nextFocusDimension } from './focus-path';
import { TrendsDrilldownComponent } from './trends-drilldown.component';
import { TrendsHighlightsComponent } from './trends-highlights.component';

type SensitivityPreset = 'default' | 'strict' | 'loose';

const SENSITIVITY: Record<SensitivityPreset, AnomalyOptions> = {
  default: { window: 28, minZ: 3, minImpact: 50 },
  strict: { window: 28, minZ: 5, minImpact: 200 },
  loose: { window: 14, minZ: 2, minImpact: 10 },
};

@Component({
  selector: 'app-trends',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TrendsHighlightsComponent, TrendsDrilldownComponent],
  template: `
    <div class="title-row">
      <div><span class="eyebrow">Cost intelligence</span><h1>Cost trends</h1></div>
      <div class="title-actions">
        <label class="sensitivity"><span class="eyebrow">Anomaly sensitivity</span>
          <select [value]="sensitivity()" (change)="onSensitivity($event)" aria-label="Anomaly sensitivity">
            <option value="default">Default</option><option value="strict">Strict</option><option value="loose">Loose</option>
          </select>
        </label>
        <button class="reset-view" (click)="reset()">Reset view</button>
      </div>
    </div>
    <app-trends-highlights [options]="anomalyOptions()" (investigate)="investigate($event)" />
    <app-trends-drilldown [options]="anomalyOptions()" [focus]="focus()" [dimension]="drillDimension()" [grain]="grain()" [stackBy]="stackBy()" (focusChange)="focus.set($event)" (dimensionChange)="drillDimension.set($event)" (grainChange)="grain.set($event)" (stackByChange)="stackBy.set($event)" (openInExplorer)="openInExplorer()" />
  `,
  styles: `
    .title-row, .title-actions { display:flex; align-items:end; justify-content:space-between; gap:16px; } .title-row { margin-bottom:24px; }
    h1 { margin:0; } .sensitivity { display:flex; flex-direction:column; gap:4px; } .reset-view { margin-bottom:1px; } @media (max-width:620px) { .title-row, .title-actions { align-items:start; flex-direction:column; } }
  `,
})
export class TrendsComponent {
  private readonly filters = inject(FiltersStore);
  private readonly router = inject(Router);
  protected readonly sensitivity = signal<SensitivityPreset>('default');
  protected readonly drillDimension = signal<Dimension>('service');
  protected readonly focus = signal<FocusStep[]>([]);
  protected readonly grain = signal<Granularity>('day');
  protected readonly stackBy = signal<Dimension | ''>('');
  protected readonly anomalyOptions = () => SENSITIVITY[this.sensitivity()];

  protected onSensitivity(event: Event): void {
    this.sensitivity.set((event.target as HTMLSelectElement).value as SensitivityPreset);
  }

  protected reset(): void {
    this.sensitivity.set('default');
    this.focus.set([]);
    this.drillDimension.set('service');
    this.grain.set('day');
    this.stackBy.set('');
  }

  protected investigate({ dimension, value }: { dimension: Dimension; value: string }): void {
    const focus = [{ dimension, value }];
    this.focus.set(focus);
    this.drillDimension.set(nextFocusDimension(dimension, focus));
    document.getElementById('trends-drilldown')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  protected openInExplorer(): void {
    const focusParams = Object.fromEntries(this.focus().map((step) => [DIMENSION_TO_FILTER[step.dimension], step.value]));
    void this.router.navigate(['/explorer'], { queryParams: { ...this.filters.toFilterParams(), ...focusParams } });
  }
}
