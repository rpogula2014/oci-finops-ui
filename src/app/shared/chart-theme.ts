/** ATD chart ramp — shades of Distribution/Pacific Blue. Red reserved for overage/anomaly + hero KPI. */
export const CHART_RAMP = ['#142848', '#3a5680', '#6f89ad', '#a9bcd6', '#d9dada'];

export const CHART_TEXT = '#3D4444';
export const CHART_GRID = '#D9DADA';

/** Axis label for a time bucket: date only, except hourly grain which needs the hour to disambiguate. */
export function bucketLabel(bucket: string, granularity: string): string {
  return granularity === 'hour' ? bucket.slice(0, 16).replace('T', ' ') : bucket.slice(0, 10);
}

export const BASE_CHART = {
  color: CHART_RAMP,
  textStyle: { fontFamily: 'Poppins, Arial, sans-serif', color: CHART_TEXT },
  tooltip: { trigger: 'item' as const },
};
