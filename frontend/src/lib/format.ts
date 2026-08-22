/**
 * Precision Indian Rupee (INR) and date formatting utility.
 */

export function fmtINR(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) {
    return '₹0.00';
  }

  const isNegative = val < 0;
  const absVal = Math.abs(val);
  const formatted = absVal.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return isNegative ? `-₹${formatted}` : `₹${formatted}`;
}

export function fmtPercent(val: number | null | undefined, decimals = 1): string {
  if (val === null || val === undefined || isNaN(val)) {
    return '0.0%';
  }
  return `${val.toFixed(decimals)}%`;
}

export function fmtConfidence(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) {
    return '0.00';
  }
  return val.toFixed(2);
}

export function fmtDate(val: string | null | undefined): string {
  if (!val) return '--';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return val;
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return val;
  }
}
