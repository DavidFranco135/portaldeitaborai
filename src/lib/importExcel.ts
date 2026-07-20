// xlsx loaded dynamically from CDN
declare const XLSX: any;
import { TimberItem } from '../types';

export interface ValidationWarning {
  field: string;
  expected: number;
  calculated: number;
  diff: number;
  message: string;
}

export interface ImportResult {
  items: TimberItem[];
  clientName?: string;
  motorista?: string;
  freight?: number;
  commissionValue?: number;
  commissionPct?: number;
  totalM3?: number;
  totalMadeira?: number;   // subtotal madeira from excel
  totalAPagar?: number;    // total a pagar from excel
  supplier?: string;
  notes?: string;
  rawRows: any[][];
  warnings: ValidationWarning[];
}

function round(n: number, dec = 4) {
  return Math.round(n * Math.pow(10, dec)) / Math.pow(10, dec);
}

function newItem(): TimberItem {
  return {
    id: Math.random().toString(36).slice(2, 9),
    espessura: 0,
    largura: 0,
    c3: 0, c4: 0, c5: 0, c6: 0,
    pricePerM3: 0,
    customM3: null,
    calcMode: 'qty_to_m3',
  };
}

/**
 * Try to parse a value as a positive number
 */
function asNum(v: any): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
  return isFinite(n) && n > 0 ? n : null;
}

/**
 * Normalize a header string for matching
 */
function norm(s: any): string {
  return String(s ?? '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Match column index by header keywords
 */
function findCol(headers: string[], ...keywords: string[]): number {
  return headers.findIndex(h => keywords.some(k => h.includes(k)));
}

async function loadXLSX(): Promise<void> {
  if (typeof XLSX !== 'undefined') return;
  await new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Falha ao carregar biblioteca XLSX'));
    document.head.appendChild(s);
  });
}

export async function importFromExcel(file: File): Promise<ImportResult> {
  await loadXLSX();
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

  const result: ImportResult = {
    items: [],
    rawRows: raw,
    warnings: [],
  };

  // ── 1. Extract header fields (client, motorista, supplier, etc.) ──────────
  for (let i = 0; i < Math.min(15, raw.length); i++) {
    const row = raw[i];
    const joined = row.map(c => String(c ?? '')).join(' ').toLowerCase();

    // Supplier (serraria name — usually row 1 or 2)
    if (i <= 2 && !result.supplier) {
      const text = row.filter(Boolean).join(' ').trim();
      if (text && text.length > 5 && !joined.includes('romaneio') && !joined.includes('data')) {
        result.supplier = text;
      }
    }

    // Client
    if (joined.includes('cliente')) {
      const val = row.find((c, ci) => ci > 0 && c && !String(c).toLowerCase().includes('cliente'));
      if (val) result.clientName = String(val).trim();
    }

    // Motorista / Descarga
    if (joined.includes('motorista') || joined.includes('descarga')) {
      const val = row.find((c, ci) => ci > 0 && c && String(c).trim().length > 1);
      if (val) result.motorista = String(val).trim();
    }

    // Frete
    if (joined.includes('frete') && !joined.includes('subtotal')) {
      const nums = row.map(asNum).filter(n => n !== null) as number[];
      if (nums.length) result.freight = Math.abs(nums[0]);
    }

    // Comissão
    if (joined.includes('comiss')) {
      const nums = row.map(asNum).filter(n => n !== null) as number[];
      if (nums.length) result.commissionValue = Math.abs(nums[0]);
    }

    // Total madeira / subtotal
    if (joined.includes('subtotal') || (joined.includes('total') && joined.includes('madeir'))) {
      const nums = row.map(asNum).filter(n => n !== null) as number[];
      if (nums.length) result.totalMadeira = nums[nums.length - 1];
    }

    // Total a receber / total a pagar
    if (joined.includes('totalreceber') || joined.includes('totalpagar') ||
        (joined.includes('total') && joined.includes('receber'))) {
      const nums = row.map(asNum).filter(n => n !== null) as number[];
      if (nums.length) result.totalAPagar = nums[nums.length - 1];
    }
  }

  // ── 2. Find the data header row ───────────────────────────────────────────
  let headerRowIdx = -1;
  let colMap = { qty: -1, largura: -1, espessura: -1, comp: -1, preco: -1, m3: -1 };

  for (let i = 0; i < raw.length; i++) {
    const row = raw[i];
    const headers = row.map(norm);

    const qty     = findCol(headers, 'qtpecas', 'qtdpecas', 'qtpeças', 'qtdpeças', 'qtpecas', 'pecas', 'quantidade', 'qtd');
    const largura = findCol(headers, 'largura', 'larg');
    const esp     = findCol(headers, 'espessura', 'bitola', 'espess', 'bitol');
    const comp    = findCol(headers, 'comp', 'comprimento', 'metros');
    const preco   = findCol(headers, 'custom3', 'valorm3', 'precom3', 'custom', 'rm3', 'vlrm3', 'preco');
    const m3      = findCol(headers, 'qtdm3', 'totalm3', 'm3', 'metros3', 'cubagem');

    // Need at least qty + (largura or espessura)
    if (qty >= 0 && (largura >= 0 || esp >= 0)) {
      headerRowIdx = i;
      colMap = { qty, largura, espessura: esp, comp, preco, m3 };
      break;
    }
  }

  if (headerRowIdx < 0) {
    // Fallback: try to detect positionally from a row that looks like numbers
    for (let i = 5; i < raw.length; i++) {
      const row = raw[i];
      const nums = row.map(asNum);
      const numCount = nums.filter(n => n !== null).length;
      if (numCount >= 4) {
        // Guess columns positionally: qty, largura, espessura, comp, preco
        colMap = { qty: 0, largura: 1, espessura: 2, comp: 3, preco: 4, m3: 5 };
        headerRowIdx = i - 1;
        break;
      }
    }
  }

  if (headerRowIdx < 0) {
    throw new Error('Não foi possível encontrar as colunas de dados no arquivo. Verifique se o Excel tem colunas de Qtd Peças, Largura, Espessura e Comprimento.');
  }

  // ── 3. Parse data rows ────────────────────────────────────────────────────
  let totalM3acc = 0;

  for (let i = headerRowIdx + 1; i < raw.length; i++) {
    const row = raw[i];
    if (!row || row.every(c => c === null || c === '')) continue;

    const qty   = asNum(colMap.qty >= 0 ? row[colMap.qty] : null);
    const larg  = asNum(colMap.largura >= 0 ? row[colMap.largura] : null);
    const esp   = asNum(colMap.espessura >= 0 ? row[colMap.espessura] : null);
    const comp  = asNum(colMap.comp >= 0 ? row[colMap.comp] : null);
    const preco = asNum(colMap.preco >= 0 ? row[colMap.preco] : null);
    const m3val = asNum(colMap.m3 >= 0 ? row[colMap.m3] : null);

    // Must have qty and at least dimensions
    if (!qty || (!larg && !esp)) continue;

    // Stop if we hit total/frete/subtotal rows
    const rowText = row.map(c => String(c ?? '').toLowerCase()).join(' ');
    if (['total', 'frete', 'subtotal', 'comiss', 'pagamento'].some(k => rowText.includes(k))) break;

    const item = newItem();

    // Convert meters → cm if value < 1 (serraria sends in meters)
    item.espessura = esp ? (esp < 1 ? round(esp * 100, 2) : esp) : 0;
    item.largura   = larg ? (larg < 1 ? round(larg * 100, 2) : larg) : 0;
    item.pricePerM3 = preco || 0;

    // Set quantity in the right comprimento column
    const compVal = comp ? Math.round(comp) : 3;
    if (compVal === 3) item.c3 = Math.round(qty);
    else if (compVal === 4) item.c4 = Math.round(qty);
    else if (compVal === 5) item.c5 = Math.round(qty);
    else if (compVal === 6) item.c6 = Math.round(qty);
    else item.c3 = Math.round(qty); // default 3m

    // Use serraria's M³ value if available (more precise)
    if (m3val && m3val > 0) {
      item.customM3 = round(m3val);
      totalM3acc += m3val;
    }

    result.items.push(item);
  }

  if (result.items.length === 0) {
    throw new Error('Nenhuma linha de madeira encontrada no arquivo. Verifique o formato.');
  }

  if (totalM3acc > 0) result.totalM3 = round(totalM3acc);

  // ── Validation: compare Excel values vs our calculations ─────────────────
  const calcSubtotal = result.items.reduce((s, item) => {
    const m3 = item.customM3 ?? 0;
    return s + m3 * item.pricePerM3;
  }, 0);

  const calcM3 = result.items.reduce((s, item) => s + (item.customM3 ?? 0), 0);

  // Check M³ total
  if (result.totalM3 && Math.abs(calcM3 - result.totalM3) > 0.01) {
    result.warnings.push({
      field: 'Total M³',
      expected: result.totalM3,
      calculated: round(calcM3),
      diff: round(Math.abs(calcM3 - result.totalM3)),
      message: `M³ total da serraria (${result.totalM3.toFixed(4)}) difere do calculado (${round(calcM3).toFixed(4)}). Diferença: ${round(Math.abs(calcM3 - result.totalM3)).toFixed(4)} m³`,
    });
  }

  // Check subtotal madeira
  if (result.totalMadeira && Math.abs(calcSubtotal - result.totalMadeira) > 0.50) {
    result.warnings.push({
      field: 'Subtotal Madeira',
      expected: result.totalMadeira,
      calculated: round(calcSubtotal, 2),
      diff: round(Math.abs(calcSubtotal - result.totalMadeira), 2),
      message: `Subtotal da serraria (R$ ${result.totalMadeira.toFixed(2)}) difere do calculado (R$ ${calcSubtotal.toFixed(2)}). Diferença: R$ ${Math.abs(calcSubtotal - result.totalMadeira).toFixed(2)}`,
    });
  }

  // Check total a pagar: comissão calculada sobre (subtotal − frete)
  if (result.totalAPagar) {
    const baseComiss = calcSubtotal - (result.freight || 0);
    const commCalc = result.commissionValue || 0; // usar valor da serraria para comparar
    const calcTotal = calcSubtotal - (result.freight || 0) - commCalc;
    if (Math.abs(calcTotal - result.totalAPagar) > 1) {
      result.warnings.push({
        field: 'Total a Pagar',
        expected: result.totalAPagar,
        calculated: round(calcTotal, 2),
        diff: round(Math.abs(calcTotal - result.totalAPagar), 2),
        message: `Total a receber da serraria (R$ ${result.totalAPagar.toFixed(2)}) difere do recalculado (R$ ${calcTotal.toFixed(2)}). Verifique frete e comissão.`,
      });
    }
  }

  return result;
}
