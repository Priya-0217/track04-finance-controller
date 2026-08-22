import { describe, it, expect } from 'vitest';
import { fmtINR, fmtPercent, fmtConfidence } from '../lib/format';

describe('Format Library (lib/format.ts)', () => {
  it('formats positive currency in Indian numbering system', () => {
    expect(fmtINR(1000)).toBe('₹1,000.00');
    expect(fmtINR(50000)).toBe('₹50,000.00');
    expect(fmtINR(1234567.89)).toBe('₹12,34,567.89');
  });

  it('formats negative currency correctly', () => {
    expect(fmtINR(-500)).toBe('-₹500.00');
    expect(fmtINR(-15000.5)).toBe('-₹15,000.50');
  });

  it('handles zero, null, undefined, and NaN gracefully', () => {
    expect(fmtINR(0)).toBe('₹0.00');
    expect(fmtINR(null)).toBe('₹0.00');
    expect(fmtINR(undefined)).toBe('₹0.00');
    expect(fmtINR(NaN)).toBe('₹0.00');
  });

  it('formats percentages and confidence accurately', () => {
    expect(fmtPercent(98.8912, 2)).toBe('98.89%');
    expect(fmtPercent(null)).toBe('0.0%');
    expect(fmtConfidence(0.954)).toBe('0.95');
    expect(fmtConfidence(undefined)).toBe('0.00');
  });
});
