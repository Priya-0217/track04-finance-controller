import { describe, it, expect } from 'vitest';
import { getHealthVariant, getSeverityClasses, getTierLabel } from '../components/Badge';

describe('Badge Threshold & Label Tests (components/Badge.tsx)', () => {
  it('assigns correct color variants based on health score thresholds', () => {
    // >= 90: Emerald
    const topTier = getHealthVariant(95);
    expect(topTier.bg).toContain('bg-emerald-50');
    expect(topTier.text).toContain('text-emerald-800');

    // 70 - 89: Amber
    const midTier = getHealthVariant(75);
    expect(midTier.bg).toContain('bg-amber-50');
    expect(midTier.text).toContain('text-amber-800');

    // < 70: Rose
    const lowTier = getHealthVariant(50);
    expect(lowTier.bg).toContain('bg-rose-50');
    expect(lowTier.text).toContain('text-rose-800');
  });

  it('assigns correct styles for audit severity levels', () => {
    expect(getSeverityClasses('CRITICAL')).toContain('bg-black text-white');
    expect(getSeverityClasses('WARNING')).toContain('bg-amber-50 text-amber-800');
    expect(getSeverityClasses('INFO')).toContain('bg-gray-100 text-gray-800');
  });

  it('resolves match tier labels properly', () => {
    expect(getTierLabel('tier1_exact')).toBe('T1 Exact');
    expect(getTierLabel('tier2_fuzzy')).toBe('T2 Fuzzy');
    expect(getTierLabel('tier3_semantic')).toBe('T3 Semantic');
    expect(getTierLabel('tier4_exception')).toBe('T4 Exception');
  });
});
