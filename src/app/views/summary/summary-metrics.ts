import { BreakdownRow, Freshness, SummaryRow, TimeseriesRow } from '../../core/api.types';
import { parseCost } from '../../core/currency';

export interface StatCard {
  label: string;
  value: string;
  subs: string[];
}

export interface MonthlySeries {
  name: string;
  /** cost per month bucket, aligned to `months` */
  values: number[];
}

export interface SpendOverTime {
  months: string[]; // "2026-06-01T00:00:00Z" bucket keys
  series: MonthlySeries[]; // top-N resource names + "Other"
}

const DAY_MS = 86_400_000;

function monthLabelOf(bucket: string): string {
  return bucket.slice(0, 7); // "2026-06"
}

function daysInMonth(bucket: string): number {
  const d = new Date(bucket);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
}

/** Total across rows of one currency (caller pre-filters currency). */
function sumCost(rows: { cost: string }[]): number {
  return rows.reduce((sum, r) => sum + parseCost(r.cost), 0);
}

export function buildStatCards(input: {
  summaryRows: SummaryRow[];
  monthly: TimeseriesRow[];
  costCenters: BreakdownRow[];
  environments: BreakdownRow[];
  topResources: BreakdownRow[];
  /** UI label of the group-by dimension, e.g. "Compartment" — used for the "Top …" card. */
  topLabel: string;
  freshness: Freshness | null;
  start: string;
  end: string;
  currency: string;
}): StatCard[] {
  const { summaryRows, monthly, environments, topResources, topLabel, freshness, start, end, currency } =
    input;
  const forCurrency = <T extends { currency: string }>(rows: T[]) => rows.filter((r) => r.currency === currency);

  const total = sumCost(forCurrency(summaryRows));
  const rangeDays = Math.max(1, Math.round((new Date(end).getTime() - new Date(start).getTime()) / DAY_MS));

  const months = forCurrency(monthly).sort((a, b) => a.bucket.localeCompare(b.bucket));
  const dataThrough = freshness ? new Date(freshness.data_through) : new Date(end);
  const last = months[months.length - 1];
  const lastIsPartial =
    !!last &&
    monthLabelOf(last.bucket) === dataThrough.toISOString().slice(0, 7) &&
    dataThrough.getUTCDate() < daysInMonth(last.bucket);
  const lastIsCurrentMonth = !!last && monthLabelOf(last.bucket) === new Date().toISOString().slice(0, 7);

  const complete = lastIsPartial ? months.slice(0, -1) : months;
  const prev = complete[complete.length - 1];
  const prev2 = complete[complete.length - 2];
  const mom =
    prev && prev2 && parseCost(prev2.cost) > 0
      ? ((parseCost(prev.cost) - parseCost(prev2.cost)) / parseCost(prev2.cost)) * 100
      : null;

  // forecast: run-rate of the partial month extrapolated to full month
  let forecastCard: StatCard | null = null;
  if (last && lastIsPartial && prev) {
    const monthStart = new Date(last.bucket);
    const elapsedDays = Math.max(0.5, (dataThrough.getTime() - monthStart.getTime()) / DAY_MS);
    const forecast = (parseCost(last.cost) / elapsedDays) * daysInMonth(last.bucket);
    const prevActual = parseCost(prev.cost);
    const deltaPct = prevActual > 0 ? ((forecast - prevActual) / prevActual) * 100 : null;
    forecastCard = {
      label: `Forecast ${monthLabelOf(last.bucket)}`,
      value: money(forecast, currency),
      subs: [
        `vs ${monthLabelOf(prev.bucket)} actual ${money(prevActual, currency)}` +
          (deltaPct !== null ? ` (${sign(deltaPct)}${Math.abs(deltaPct).toFixed(1)}%)` : ''),
      ],
    };
  }

  const envRows = forCurrency(environments).filter((r) => r.dimension_value !== '');
  const tagged = sumCost(envRows);
  const prod = sumCost(envRows.filter((r) => r.dimension_value === 'prod'));
  const nonProd = tagged - prod;

  const top = forCurrency(topResources)[0];
  const topShare = top && total > 0 ? (parseCost(top.cost) / total) * 100 : null;

  const cards: StatCard[] = [
    { label: 'Total (filtered range)', value: money(total, currency), subs: [`${rangeDays} days of data`] },
  ];
  if (last) {
    cards.push({
      label: lastIsCurrentMonth ? 'Current month' : 'Latest month',
      value: money(parseCost(last.cost), currency),
      subs: [monthLabelOf(last.bucket)],
    });
  }
  if (mom !== null && prev && prev2) {
    cards.push({
      label: 'MoM (complete months)',
      value: `${sign(mom)}${Math.abs(mom).toFixed(1)}%`,
      subs: [`${monthLabelOf(prev2.bucket)} → ${monthLabelOf(prev.bucket)}`],
    });
  }
  if (forecastCard) cards.push(forecastCard);
  if (tagged > 0) {
    cards.push({
      label: 'Non-prod share (of tagged)',
      value: `${((nonProd / tagged) * 100).toFixed(0)}%`,
      subs: [`non-prod ${money(nonProd, currency)} vs prod ${money(prod, currency)}`],
    });
  }
  if (top && topShare !== null) {
    cards.push({
      label: `Top ${topLabel.toLowerCase()}`,
      value: `${topShare.toFixed(0)}%`,
      subs: [top.dimension_value || '(untagged)'],
    });
  }
  return cards;
}

export function buildSpendOverTime(
  topNames: string[],
  perName: TimeseriesRow[][],
  totalMonthly: TimeseriesRow[],
  currency: string,
): SpendOverTime {
  const only = (rows: TimeseriesRow[]) => rows.filter((r) => r.currency === currency);
  const months = [...new Set(only(totalMonthly).map((r) => r.bucket))].sort();
  const index = new Map(months.map((m, i) => [m, i]));

  const series: MonthlySeries[] = topNames.map((name, i) => {
    const values = new Array(months.length).fill(0);
    for (const row of only(perName[i])) {
      const at = index.get(row.bucket);
      if (at !== undefined) values[at] += parseCost(row.cost);
    }
    return { name: name || '(untagged)', values };
  });

  const other = new Array(months.length).fill(0);
  for (const row of only(totalMonthly)) {
    const at = index.get(row.bucket)!;
    other[at] = parseCost(row.cost) - series.reduce((s, sr) => s + sr.values[at], 0);
  }
  series.push({ name: 'Other', values: other.map((v) => Math.max(0, v)) });
  return { months, series };
}

function money(value: number, currency: string): string {
  const formatted = Math.round(value).toLocaleString('en-US');
  return currency === 'USD' ? `$${formatted}` : `${formatted} ${currency}`;
}

function sign(n: number): string {
  return n >= 0 ? '+' : '−';
}
