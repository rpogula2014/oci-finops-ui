import { describe, expect, it } from 'vitest';
import { FocusStep, nextFocusDimension, withFocus } from './focus-path';

describe('Trends focus path', () => {
  it('layers local focus over the shared baseline without mutating it', () => {
    const baseline = { service: 'DATABASE', cost_center: 'Treadsy' };
    const focus: FocusStep[] = [{ dimension: 'service', value: 'COMPUTE' }];
    expect(withFocus(baseline, focus)).toEqual({ service: 'COMPUTE', cost_center: 'Treadsy' });
    expect(baseline.service).toBe('DATABASE');
  });

  it('advances past dimensions already held in focus', () => {
    expect(nextFocusDimension('service', [{ dimension: 'service', value: 'COMPUTE' }])).toBe('compartment');
    expect(nextFocusDimension('compartment', [{ dimension: 'service', value: 'COMPUTE' }, { dimension: 'compartment', value: 'platform' }])).toBe('cost_center');
  });
});
