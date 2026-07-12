import { Pipe, PipeTransform } from '@angular/core';
import { CostString } from '../core/api.types';
import { parseCost } from '../core/currency';

/**
 * Formats a cost with thousands separators and its currency code, e.g. "39,873.68 USD".
 * Accepts the API's decimal strings or already-parsed numbers.
 */
@Pipe({ name: 'money' })
export class MoneyPipe implements PipeTransform {
  transform(value: CostString | number | null | undefined, currency = '', decimals = 2): string {
    if (value === null || value === undefined || value === '') return '—';
    const n = typeof value === 'number' ? value : parseCost(value);
    const formatted = n.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    return currency ? `${formatted} ${currency}` : formatted;
  }
}
