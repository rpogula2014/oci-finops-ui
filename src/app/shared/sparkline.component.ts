import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { BreakdownSeriesPoint } from '../core/api.types';
import { parseCost } from '../core/currency';

/** Lightweight inline chart used in tables; absent API series intentionally renders nothing. */
@Component({
  selector: 'app-sparkline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (points()) {
      <svg class="sparkline" viewBox="0 0 80 24" role="img" aria-label="Cost trend">
        <path [attr.d]="points()" />
      </svg>
    }
  `,
  styles: `
    .sparkline { width: 80px; height: 24px; overflow: visible; }
    path { fill: none; stroke: var(--atd-distribution-blue); stroke-width: 2; vector-effect: non-scaling-stroke; }
  `,
})
export class SparklineComponent {
  readonly series = input<BreakdownSeriesPoint[] | undefined>();
  protected readonly points = computed(() => {
    const series = this.series() ?? [];
    if (series.length < 2) return '';
    const values = series.map((point) => parseCost(point.cost));
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    return values
      .map((value, index) => `${index ? 'L' : 'M'}${(index * 80) / (values.length - 1)} ${22 - ((value - min) / range) * 20}`)
      .join(' ');
  });
}
