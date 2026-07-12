import { CostString } from './api.types';

/** Per-currency amount — KPIs/charts always take arrays of these, never a bare number (currencies are never summed). */
export interface CurrencyAmount {
  currency: string;
  cost: number;
}

/** Single parse seam for decimal-string costs (design D2). */
export function parseCost(cost: CostString): number {
  const n = Number(cost);
  return Number.isFinite(n) ? n : 0;
}

/** Partition rows by currency, summing within a currency only. */
export function partitionByCurrency<T extends { currency: string; cost: CostString }>(
  rows: T[],
): CurrencyAmount[] {
  const totals = new Map<string, number>();
  for (const row of rows) {
    // API emits stray rows with blank currency and zero cost — noise, drop them
    if (row.currency === '' && parseCost(row.cost) === 0) continue;
    totals.set(row.currency, (totals.get(row.currency) ?? 0) + parseCost(row.cost));
  }
  return [...totals.entries()].map(([currency, cost]) => ({ currency, cost }));
}

/** Distinct currencies present in a row set, stable order of first appearance. */
export function currenciesOf<T extends { currency: string }>(rows: T[]): string[] {
  return [...new Set(rows.map((r) => r.currency))];
}

/** "$88,394" for USD, "88,394 EUR" otherwise. */
export function formatMoney(value: number, currency: string, decimals = 0): string {
  const formatted = value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return currency === 'USD' ? `$${formatted}` : `${formatted} ${currency}`;
}

export const UNTAGGED_LABEL = '(untagged)';

/** Filter dropdowns: "" from /filters renders as "(untagged)" but is sent verbatim. */
export function labelForFilterValue(value: string): string {
  return value === '' ? UNTAGGED_LABEL : value;
}
