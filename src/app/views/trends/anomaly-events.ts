import { AnomalyRow, Dimension } from '../../core/api.types';

export interface DimensionAnomaly extends AnomalyRow {
  dimension: Dimension;
}

export interface AnomalyEvent {
  currency: string;
  direction: AnomalyRow['direction'];
  dimension: Dimension;
  dimensionValue: string;
  startDay: string;
  endDay: string;
  peak: AnomalyRow;
  totalDeviation: number;
  seenAt: { dimension: Dimension; value: string }[];
}

export interface ClusterOptions {
  currency?: string | null;
  limit?: number;
}

function isNextDay(previous: string, current: string): boolean {
  return Date.parse(`${current}T00:00:00Z`) - Date.parse(`${previous}T00:00:00Z`) === 86_400_000;
}

/** Collapses server-scored rows into correlated primary-dimension events for the highlights cards. */
export function clusterAnomalyEvents(rows: readonly DimensionAnomaly[], options: ClusterOptions = {}): AnomalyEvent[] {
  const eligible = rows.filter((row) => options.currency === undefined || options.currency === null || row.currency === options.currency);
  const primary = new Map<string, DimensionAnomaly[]>();

  for (const row of eligible) {
    const key = `${row.currency}\u0000${row.direction}\u0000${row.day}`;
    const forDay = primary.get(key) ?? [];
    forDay.push(row);
    primary.set(key, forDay);
  }

  const candidates = [...primary.values()].flatMap((forDay) => {
    const services = forDay.filter((row) => row.dimension === 'service');
    const compartments = forDay.filter((row) => row.dimension === 'compartment');
    return services.length ? services : compartments.length ? compartments : forDay;
  });
  const grouped = new Map<string, DimensionAnomaly[]>();
  for (const row of candidates) {
    const key = `${row.currency}\u0000${row.direction}\u0000${row.dimension}\u0000${row.dimension_value}`;
    const group = grouped.get(key) ?? [];
    group.push(row);
    grouped.set(key, group);
  }

  const events: AnomalyEvent[] = [];
  for (const group of grouped.values()) {
    const sorted = [...group].sort((a, b) => a.day.localeCompare(b.day));
    let run: DimensionAnomaly[] = [];
    for (const row of sorted) {
      if (run.length && !isNextDay(run.at(-1)!.day, row.day)) {
        events.push(toEvent(run, eligible));
        run = [];
      }
      run.push(row);
    }
    if (run.length) events.push(toEvent(run, eligible));
  }
  return events.sort((a, b) => b.totalDeviation - a.totalDeviation).slice(0, options.limit ?? 5);
}

function toEvent(rows: readonly DimensionAnomaly[], allRows: readonly DimensionAnomaly[]): AnomalyEvent {
  const first = rows[0];
  const days = new Set(rows.map((row) => row.day));
  const seenAt = allRows
    .filter((row) => row.currency === first.currency && row.direction === first.direction && days.has(row.day))
    .filter((row) => row.dimension !== first.dimension || row.dimension_value !== first.dimension_value)
    .map((row) => ({ dimension: row.dimension, value: row.dimension_value }));
  const uniqueSeenAt = [...new Map(seenAt.map((row) => [`${row.dimension}\u0000${row.value}`, row])).values()];
  const peak = rows.reduce((best, row) => (Math.abs(row.deviation) > Math.abs(best.deviation) ? row : best));
  return {
    currency: first.currency,
    direction: first.direction,
    dimension: first.dimension,
    dimensionValue: first.dimension_value,
    startDay: rows[0].day,
    endDay: rows.at(-1)!.day,
    peak,
    totalDeviation: rows.reduce((total, row) => total + Math.abs(row.deviation), 0),
    seenAt: uniqueSeenAt,
  };
}
