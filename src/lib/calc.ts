import { TimberItem } from '../types';

export interface DerivedItem {
  qtyTotal: number;
  linearMeters: number;
  avgLength: number;
  m3Auto: number;
  finalM3: number;
  value: number;
  precoUnitario: number;
}

export function calcDerived(item: TimberItem): DerivedItem {
  const qtyTotal = item.c3 + item.c4 + item.c5 + item.c6;
  const linearMeters = item.c3 * 3 + item.c4 * 4 + item.c5 * 5 + item.c6 * 6;
  const avgLength = qtyTotal > 0 ? linearMeters / qtyTotal : 0;

  // M³ = (espessura/100) × (largura/100) × metros lineares
  const m3Auto = (item.espessura / 100) * (item.largura / 100) * linearMeters;
  const finalM3 =
    item.customM3 !== null && item.customM3 !== undefined ? item.customM3 : m3Auto;
  const value = finalM3 * item.pricePerM3;

  // Preço unitário = valor total / quantidade de peças
  const precoUnitario = qtyTotal > 0 ? value / qtyTotal : 0;

  return { qtyTotal, linearMeters, avgLength, m3Auto, finalM3, value, precoUnitario };
}

/**
 * Given a target M³, reverse-calculate quantity for a specific comprimento.
 * Distributes qty proportionally to the lengths that are > 0.
 */
export function m3ToQty(
  targetM3: number,
  espessura: number,
  largura: number,
  comprimento: number
): number {
  if (!espessura || !largura || !comprimento) return 0;
  const m3PerPiece = (espessura / 100) * (largura / 100) * comprimento;
  if (!m3PerPiece) return 0;
  return Math.round(targetM3 / m3PerPiece);
}

export function totalM3(items: TimberItem[]): number {
  return items.reduce((s, i) => s + calcDerived(i).finalM3, 0);
}

export function totalValue(items: TimberItem[]): number {
  return items.reduce((s, i) => s + calcDerived(i).value, 0);
}

export function newEmptyItem(): TimberItem {
  return {
    id: Math.random().toString(36).slice(2, 9),
    espessura: 0,
    largura: 0,
    c3: 0,
    c4: 0,
    c5: 0,
    c6: 0,
    pricePerM3: 0,
    customM3: null,
    calcMode: 'qty_to_m3',
  };
}
