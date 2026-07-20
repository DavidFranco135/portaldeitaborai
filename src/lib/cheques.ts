import { addDays, format } from 'date-fns';

export interface Cheque {
  id: string;
  dias: number;
  vencimento: string; // dd/MM/yyyy
  valor: number;
}

/**
 * Parse payment terms like "30/60/90", "30/45/60/90/120", "à vista", "30 dias"
 * Returns array of day intervals, or [] for à vista
 */
export function parsePrazos(paymentTerms: string): number[] {
  if (!paymentTerms) return [];
  const lower = paymentTerms.toLowerCase().trim();
  if (lower.includes('vista') || lower === '0') return [];

  // Match patterns like 30/60/90 or 30-60-90 or 30,60,90
  const matches = paymentTerms.match(/\d+/g);
  if (!matches) return [];

  const nums = matches.map(Number).filter(n => n > 0);
  if (nums.length === 0) return [];

  // If single number like "30 dias", treat as single installment
  return nums;
}

/**
 * Generate cheques from total value and payment terms
 */
export function generateCheques(
  total: number,
  paymentTerms: string,
  baseDate: string // YYYY-MM-DD
): Cheque[] {
  const prazos = parsePrazos(paymentTerms);
  if (prazos.length === 0) return []; // à vista — no cheques

  const base = new Date(baseDate + 'T12:00:00');
  const valorPorCheque = total / prazos.length;

  return prazos.map((dias, i) => ({
    id: `cheque-${i}`,
    dias,
    vencimento: format(addDays(base, dias), 'dd/MM/yyyy'),
    valor: Math.round(valorPorCheque * 100) / 100,
  }));
}
