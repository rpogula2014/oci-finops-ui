import { labelForFilterValue, parseCost, partitionByCurrency, UNTAGGED_LABEL } from './currency';

describe('currency helpers', () => {
  it('parses decimal-string costs from the API', () => {
    expect(parseCost('39873.6840649587')).toBeCloseTo(39873.684, 3);
    expect(parseCost('not-a-number')).toBe(0);
  });

  // Currencies must never be summed together — core FinOps correctness rule.
  it('partitions by currency without cross-currency summing', () => {
    const rows = [
      { currency: 'USD', cost: '10.50' },
      { currency: 'USD', cost: '4.50' },
      { currency: 'EUR', cost: '7.00' },
    ];
    const result = partitionByCurrency(rows);
    expect(result).toEqual([
      { currency: 'USD', cost: 15 },
      { currency: 'EUR', cost: 7 },
    ]);
  });

  // "" from /filters is a real value (untagged) — label it, never drop it.
  it('labels empty filter values as untagged', () => {
    expect(labelForFilterValue('')).toBe(UNTAGGED_LABEL);
    expect(labelForFilterValue('dev')).toBe('dev');
  });
});
