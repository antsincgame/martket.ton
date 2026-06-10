import { describe, it, expect } from 'vitest';
import { computeReviewAggregate } from './reviews.js';

describe('computeReviewAggregate', () => {
  it('averages and builds a histogram', () => {
    const a = computeReviewAggregate([{ rating: 5 }, { rating: 4 }, { rating: 5 }, { rating: 1 }]);
    expect(a.count).toBe(4);
    expect(a.averageRating).toBe(3.8); // (5+4+5+1)/4 = 3.75 → 3.8
    expect(a.histogram).toEqual({ 1: 1, 2: 0, 3: 0, 4: 1, 5: 2 });
  });

  it('is zero on empty input', () => {
    const a = computeReviewAggregate([]);
    expect(a).toEqual({ averageRating: 0, count: 0, histogram: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } });
  });

  it('rounds fractional ratings to the nearest star and skips out-of-range', () => {
    const a = computeReviewAggregate([{ rating: 4.4 }, { rating: 4.6 }, { rating: 0 }, { rating: 9 }, { rating: NaN }]);
    // 4.4→4, 4.6→5; 0/9/NaN skipped
    expect(a.count).toBe(2);
    expect(a.averageRating).toBe(4.5);
    expect(a.histogram[4]).toBe(1);
    expect(a.histogram[5]).toBe(1);
  });
});
