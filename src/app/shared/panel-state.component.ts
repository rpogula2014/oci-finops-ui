import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ApiError } from '../core/api.types';

export type PanelStatus = 'loading' | 'empty' | 'error' | 'ready';

/**
 * Wraps every data panel with loading skeleton / empty / envelope-error states.
 * Content is projected and shown only when status is 'ready'.
 */
@Component({
  selector: 'app-panel-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (status()) {
      @case ('loading') {
        <div class="panel-skeleton" role="status" aria-label="Loading">
          <div class="skeleton" style="width: 40%; height: 14px;"></div>
          <div class="skeleton" style="width: 100%; height: 96px;"></div>
        </div>
      }
      @case ('error') {
        <div class="panel-error" role="alert">
          <span class="code">{{ error()?.code ?? 'ERROR' }}</span>
          <span>{{ error()?.message ?? 'Something went wrong loading this panel.' }}</span>
        </div>
      }
      @case ('empty') {
        <div class="panel-empty">No data for the selected range and filters.</div>
      }
      @default {
        <ng-content />
      }
    }
  `,
  styles: `
    .panel-skeleton { display: flex; flex-direction: column; gap: 8px; }
    .panel-error {
      display: flex; gap: 8px; align-items: baseline;
      background: #fdeceb; border: 1px solid var(--atd-error);
      border-radius: var(--radius-md); padding: 8px 12px; font-size: 13px;
    }
    .panel-error .code { font-weight: 700; color: var(--atd-error); }
    .panel-empty { color: var(--atd-grey-700); font-size: 13px; padding: 16px 0; }
  `,
})
export class PanelStateComponent {
  readonly status = input.required<PanelStatus>();
  readonly error = input<ApiError | null>(null);
}
