import { CostQuery, Dimension } from '../../core/api.types';
import { DEFAULT_HIERARCHY, DIMENSION_TO_FILTER } from '../../core/filters-store';

export interface FocusStep {
  dimension: Dimension;
  value: string;
}

/** Local Trends focus overrides a matching shared baseline filter without mutating it. */
export function withFocus(baseline: CostQuery, focus: readonly FocusStep[]): CostQuery {
  return focus.reduce<CostQuery>((query, step) => ({ ...query, [DIMENSION_TO_FILTER[step.dimension]]: step.value }), { ...baseline });
}

export function nextFocusDimension(current: Dimension, focus: readonly FocusStep[]): Dimension {
  const hierarchy: Dimension[] = ['service', ...DEFAULT_HIERARCHY];
  const focused = new Set(focus.map((step) => step.dimension));
  return hierarchy.slice(Math.max(hierarchy.indexOf(current) + 1, 0)).find((dimension) => !focused.has(dimension)) ?? current;
}
