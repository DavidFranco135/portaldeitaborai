import { Document, TimberItem, Bloco, ProductItem } from '../types';
import { calcDerived } from './calc';
import { Cheque } from './cheques';

// ── Palette: Deep Forest + Warm Gold ─────────────────────────────────────
const C_DARK   = '#1B4332';   // deep forest green — headers
const C_MED    = '#2D6A4F';   // medium green — sub-headers
const C_GOLD   = '#D4A017';   // warm gold — accent / VALOR
const C_SAGE   = '#F0F7F4';   // light sage — row alt bg
const C_WARM   = '#FAFAF8';   // warm white — row bg
const C_CHAR   = '#2D2D2D';   // charcoal — text
const C_GOLDBG = '#FDF8EC';   // soft gold bg — totals highlight

// TH is computed inside buildDocHTML using TH_BG/TH_TXT
const TH_BASE = 'padding:5px 6px;text-align:center;font-weight:bold;font-size:13px';
const TD = 'border:1px solid #ddd;padding:3px 6px;text-align:center;font-size:13px;color:' + C_CHAR;
const SUMTD = 'border:1px solid #e0e0e0;padding:7px 14px;font-size:14px;color:' + C_CHAR;

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

interface DocHTMLParams {
  doc: Partial<Document>;
  type: 'pedido' | 'romaneio';
  totals: { m3: number; subtotal: number };
  commission: number;
  total: number;
  displayDate: string;
  client: Record<string, any>;
  settings: Record<string, any>;
  cheques?: Cheque[];
  blocos?: Bloco[];
  eco?: boolean;
  extras?: Array<{ id: string; desc: string; valor: number; op: '+' | '-' }>;
  extrasTotal?: number;
  productItems?: ProductItem[];
}

export function buildDocHTML(p: DocHTMLParams): string {
  const { doc, type, totals, commission, total, displayDate, client, settings: s, cheques = [], blocos = [], eco = false, extras = [], extrasTotal = 0, productItems = [] } = p;

  // Nome de exibição do tipo de documento (o valor interno "pedido"/
  // "romaneio" continua igual em todo o sistema, só o texto mostrado muda)
  const typeLabel = type === 'pedido' ? 'ORÇAMENTO' : type === 'romaneio' ? 'VENDA' : String(type).toUpperCase();

  // Eco overrides — white backgrounds, only text/borders in color
  const H_BG   = eco ? '#fff' : C_DARK;      // header bg
  const H_TXT  = eco ? C_DARK : '#fff';       // header text
  const TH_BG  = eco ? '#fff' : C_DARK;       // table header bg
  const TH_TXT = eco ? C_DARK : '#fff';       // table header text
  const TH_MED = eco ? '#fff' : C_MED;        // sub-header bg
  const ROW1   = eco ? '#fff' : C_WARM;       // row bg
  const ROW2   = eco ? '#fff' : C_SAGE;       // row alt bg
  const GOLD_B = eco ? '#fff' : C_GOLD;       // gold badge bg
  const GOLD_T = eco ? C_DARK : C_DARK;       // gold badge text
  const VAL_BG = eco ? '#fff' : C_GOLDBG;    // valor cell bg
  const M3_BG  = eco ? '#fff' : '#f0faf4';   // m3 cell bg
  const SUM_BG = eco ? '#fff' : C_SAGE;      // summary row bg
  const TOT_BG = eco ? '#fff' : C_DARK;      // total row bg
  const TOT_T  = eco ? C_DARK : '#fff';      // total row text
  const TPAY_BG= eco ? '#fff' : C_GOLD;      // total a pagar bg
  const TPAY_T = eco ? C_DARK : C_DARK;      // total a pagar text
  const BLOC_BG= eco ? '#fff' : C_DARK;      // bloco header bg
  const BLOC_T = eco ? C_DARK : '#fff';      // bloco header text
  const BLOC_G = eco ? C_DARK : C_GOLD;      // bloco gold accent
  const FOOT_BG= eco ? '#fff' : C_SAGE;      // footer box bg

  // Dynamic TH/TD using eco-aware vars
  const TH = 'border:1px solid ' + C_MED + ';' + TH_BASE + ';background:' + TH_BG + ';color:' + TH_TXT;

  function buildItemRows(items: TimberItem[]): string {
    const rows = items.map((item: TimberItem, i: number) => {
      const d = calcDerived(item);
      const bg = i % 2 === 0 ? ROW1 : ROW2;
      return (
        '<tr style="background:' + bg + '">' +
        '<td style="' + TD + ';text-align:left;padding-left:8px;font-weight:bold">' + (item.desc || '—') + '</td>' +
        '<td style="' + TD + '">' + item.espessura + '</td>' +
        '<td style="' + TD + '">' + item.largura + '</td>' +
        '<td style="' + TD + ';background:#e8f5ee">' + (item.c3 || '') + '</td>' +
        '<td style="' + TD + ';background:#e8f5ee">' + (item.c4 || '') + '</td>' +
        '<td style="' + TD + ';background:#e8f5ee">' + (item.c5 || '') + '</td>' +
        '<td style="' + TD + ';background:#e8f5ee">' + (item.c6 || '') + '</td>' +
        '<td style="' + TD + ';font-weight:bold">' + (d.qtyTotal || '') + '</td>' +
        '<td style="' + TD + '">' + d.linearMeters.toFixed(3) + '</td>' +
        '<td style="' + TD + ';font-weight:bold">' + (item.pricePerM3 ? fmt(item.pricePerM3) : '') + '</td>' +
        '<td style="' + TD + ';font-weight:bold;color:#444">' + (d.precoUnitario > 0 ? d.precoUnitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—') + '</td>' +
        '<td style="border:1px solid #c8e6d8;padding:3px 6px;text-align:center;font-size:13px;font-weight:bold;color:' + C_DARK + ';background:' + M3_BG + '">' + d.finalM3.toFixed(3) + '</td>' +
        '<td style="border:1px solid #e8d090;padding:3px 6px;text-align:right;font-size:13px;color:' + C_DARK + ';font-weight:bold;background:' + VAL_BG + '">' + fmt(d.value) + '</td>' +
        '</tr>'
      );
    });
    const minEmpty = Math.max(0, 5 - rows.length);
    const empty = Array.from({ length: minEmpty }).map((_, i) => {
      const bg = (rows.length + i) % 2 === 0 ? ROW1 : ROW2;
      return '<tr style="background:' + bg + '">' +
        Array.from({ length: 13 }).map(() => '<td style="' + TD + ';height:20px"></td>').join('') +
        '</tr>';
    });
    return rows.join('') + empty.join('');
  }

  // Use blocos if available, otherwise fall back to legacy items
  const activeBlocos: Bloco[] = blocos.length > 0
    ? blocos
    : [{ id: 'main', label: '', clientName: doc.clientName || '', items: doc.items || [] }];

  const isMultiBloco = activeBlocos.length > 1;

  const hasTimberItems = activeBlocos.some((b: Bloco) =>
    (b.items || []).some((it: TimberItem) => calcDerived(it).qtyTotal > 0)
  );

  // Build table section(s)
  function buildTableSection(items: TimberItem[]): string {
    const qtyT = items.reduce((s: number, it: TimberItem) => s + calcDerived(it).qtyTotal, 0);
    const m3T = items.reduce((s: number, it: TimberItem) => s + calcDerived(it).finalM3, 0);
    const valT = items.reduce((s: number, it: TimberItem) => s + calcDerived(it).value, 0);
    return (
      '<table style="margin-bottom:4px;font-size:12px">' +
      '<thead>' +
      '<tr style="background:' + TH_BG + ';color:' + TH_TXT + '">' +
      '<th style="' + TH + ';text-align:left;padding-left:8px" rowspan="2">Descrição</th>' +
      '<th style="' + TH + '" rowspan="2">Bitola<br>(cm)</th>' +
      '<th style="' + TH + '" rowspan="2">Larg.<br>(cm)</th>' +
      '<th style="' + TH + ';background:' + TH_MED + ';color:' + TH_TXT + ';font-size:10px;letter-spacing:0.5px" colspan="4">Comprimento (m) — Qtd de Peças</th>' +
      '<th style="' + TH + '" rowspan="2">Qtd<br>Pcs</th>' +
      '<th style="' + TH + '" rowspan="2">Metros<br>Lin.</th>' +
      '<th style="' + TH + '" rowspan="2">R$/m3</th>' +
      '<th style="' + TH + '" rowspan="2">Preco<br>Unit.</th>' +
      '<th style="border:1px solid ' + C_MED + ';padding:5px 6px;text-align:center;font-weight:bold;font-size:13px;background:' + TH_MED + ';color:' + TH_TXT + '" rowspan="2">M³</th>' +
      '<th style="border:1px solid ' + C_GOLD + ';padding:5px 6px;text-align:center;font-weight:bold;font-size:13px;background:' + C_GOLD + ';color:' + C_DARK + '" rowspan="2">VALOR</th>' +
      '</tr>' +
      '<tr style="background:' + TH_MED + ';color:' + TH_TXT + '">' +
      '<th style="' + TH + '">3,00</th><th style="' + TH + '">4,00</th><th style="' + TH + '">5,00</th><th style="' + TH + '">6,00</th>' +
      '</tr></thead>' +
      '<tbody>' + buildItemRows(items) + '</tbody>' +
      '<tfoot><tr style="background:' + TOT_BG + ';color:' + TOT_T + ';font-weight:bold;border-top:3px solid ' + C_GOLD + '">' +
      '<td colspan="7" style="' + TD + '"></td>' +
      '<td style="' + TD + ';text-align:center;font-size:14px">' + qtyT + '</td>' +
      '<td colspan="3" style="' + TD + '"></td>' +
      '<td style="border:1px solid rgba(255,255,255,0.2);padding:3px 6px;text-align:right;font-size:12px;color:' + (eco ? '#555' : 'rgba(255,255,255,0.7)') + '">Total m³: <span style="color:' + TOT_T + ';font-weight:900;font-size:16px">' + m3T.toFixed(3) + '</span></td>' +
      '<td style="border:1px solid ' + C_GOLD + ';padding:3px 6px;text-align:right;font-size:16px;font-weight:900;background:' + C_GOLD + ';color:' + C_DARK + '">' + fmt(valT) + '</td>' +
      '</tr></tfoot></table>'
    );
  }

  // ── Product table (portas/batentes/outros) — mostra sempre que houver itens ──
  const productTableHTML: string = productItems.length > 0 ? (() => {
    const rows = productItems.map((it: ProductItem, i: number) => {
      const lineTotal = it.qty * it.priceUnit;
      const bg = i % 2 === 0 ? (eco ? '#fff' : C_WARM) : (eco ? '#fff' : C_SAGE);
      return (
        '<tr style="background:' + bg + '">' +
        '<td style="' + TD + ';font-weight:bold">' + it.qty + '</td>' +
        '<td style="' + TD + '">' + it.unit + '</td>' +
        '<td style="' + TD + ';text-align:left;padding-left:8px">' + it.desc + '</td>' +
        '<td style="' + TD + ';font-weight:bold;color:#92400e">' + fmt(it.priceUnit) + '</td>' +
        '<td style="border:1px solid #e8d090;padding:3px 6px;text-align:right;font-weight:bold;background:' + VAL_BG + '">' + fmt(lineTotal) + '</td>' +
        '</tr>'
      );
    });
    const grandTotal = productItems.reduce((s: number, it: ProductItem) => s + it.qty * it.priceUnit, 0);
    return (
      '<table style="margin-bottom:4px;font-size:12px">' +
      '<thead><tr style="background:' + TH_BG + ';color:' + TH_TXT + '">' +
      '<th style="' + TH + ';width:60px">Qtd</th>' +
      '<th style="' + TH + ';width:50px">Unid.</th>' +
      '<th style="' + TH + ';text-align:left;padding-left:8px">Descrição do Produto</th>' +
      '<th style="' + TH + ';width:100px">V. Unit</th>' +
      '<th style="border:1px solid ' + C_GOLD + ';padding:5px 6px;text-align:right;font-weight:bold;font-size:13px;background:' + C_GOLD + ';color:' + C_DARK + ';width:110px">TOTAL</th>' +
      '</tr></thead>' +
      '<tbody>' + rows.join('') + '</tbody>' +
      '<tfoot><tr style="background:' + TOT_BG + ';color:' + TOT_T + ';font-weight:bold;border-top:3px solid ' + C_GOLD + '">' +
      '<td colspan="4" style="' + TD + ';text-align:right;font-size:13px;letter-spacing:0.5px">TOTAL GERAL →</td>' +
      '<td style="border:1px solid ' + C_GOLD + ';padding:5px 6px;text-align:right;font-size:17px;font-weight:900;background:' + TPAY_BG + ';color:' + TPAY_T + '">' + fmt(grandTotal) + '</td>' +
      '</tr></tfoot></table>'
    );
  })() : '';

  // ── Timber bloco sections ────────────────────────────────────────────────
  // Build all bloco sections
  const tablesSections = activeBlocos.map((bloco: Bloco) => {
    const bc = bloco.clientData as any || {};
    const blocoClient = bc;
    const blocoHeader = isMultiBloco
      ? '<div style="background:' + BLOC_BG + ';border:1px solid ' + C_DARK + ';border-radius:6px 6px 0 0;padding:6px 12px;margin-top:10px;display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid ' + C_GOLD + '">' +
        '<span style="font-weight:900;font-size:14px;color:' + BLOC_T + ';text-transform:uppercase;letter-spacing:1px">&#127970; ' + (bloco.label || 'Bloco') + '</span>' +
        '<span style="font-size:13px;color:' + BLOC_G + ';font-weight:bold">' + (bloco.clientName || '') + (blocoClient.city ? ' — ' + blocoClient.city : '') + '</span>' +
        '</div>'
      : '';
    return blocoHeader + buildTableSection(bloco.items);
  }).join('');

  const qtyTotal = activeBlocos.reduce((s: number, b: Bloco) =>
    s + b.items.reduce((ss: number, it: TimberItem) => ss + calcDerived(it).qtyTotal, 0), 0);

  // Conditional rows
  // Extras rows
  const extrasRows = extras.filter(e => e.valor > 0).map(e =>
    '<tr style="background:' + (eco ? '#fff' : '#f8f8ff') + '"><td style="' + SUMTD + '">' +
    (e.op === '+' ? '+ ' : '– ') + (e.desc || 'Extra') +
    '</td><td style="' + SUMTD + ';font-weight:bold;text-align:right;color:' + (e.op === '+' ? '#1B4332' : '#b91c1c') + '">' +
    (e.op === '-' ? '– ' : '+ ') + fmt(e.valor) +
    '</td></tr>'
  ).join('');

  const icmsFreteRow = (type === 'romaneio' && (doc.freightIcms || 0) > 0)
    ? '<tr style="background:' + (eco ? '#fff' : '#eff6ff') + '"><td style="' + SUMTD + ';color:#1d4ed8">ICMS Frete <span style="font-size:10px;color:#93c5fd">(pago separadamente)</span></td><td style="' + SUMTD + ';font-weight:bold;text-align:right;color:#1d4ed8">' + fmt(doc.freightIcms || 0) + '</td></tr>'
    : '';

  const freteRow = (type === 'romaneio' && (doc.freight || 0) > 0)
    ? '<tr style="background:' + (eco ? '#fff' : '#fff8f0') + '"><td style="' + SUMTD + '">– Frete</td><td style="' + SUMTD + ';font-weight:bold;text-align:right;color:#b45309">' + fmt(doc.freight || 0) + '</td></tr>'
    : '';
  // Quando há parceiro com valor negociado (settlementInfoOnly), a
  // comissão já está embutida dentro do Acerto Escritório — mostrar as
  // duas linhas juntas passaria a impressão errada de que a comissão é
  // descontada duas vezes. Por isso a linha de comissão separada só
  // aparece quando NÃO há esse cenário de parceiro.
  const commRow = (type === 'romaneio' && commission > 0 && !doc.settlementInfoOnly)
    ? '<tr style="background:' + (eco ? '#fff' : '#fffbeb') + '"><td style="' + SUMTD + '">– Comissão</td><td style="' + SUMTD + ';font-weight:bold;text-align:right;color:#92400e">' + fmt(commission) + '</td></tr>'
    : '';
  const settlRow = (type === 'romaneio' && (doc.settlement || 0) > 0)
    ? (doc.settlementInfoOnly
        ? '<tr style="background:' + (eco ? '#fff' : '#f5f3ff') + '"><td style="' + SUMTD + '">– Acerto Escritório</td><td style="' + SUMTD + ';font-weight:bold;text-align:right;color:#7c3aed">' + fmt(doc.settlement || 0) + '</td></tr>'
        : '<tr style="background:' + (eco ? '#fff' : '#fff0f0') + '"><td style="' + SUMTD + '">– Acerto escritório</td><td style="' + SUMTD + ';font-weight:bold;text-align:right;color:#b91c1c">' + fmt(doc.settlement || 0) + '</td></tr>')
    : '';


  // Format notes: preserve line breaks, support *bold*
  const formatNotes = (text: string): string => {
    return text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => {
        // Replace *text* with bold
        const bolded = line.replace(/\*([^*]+)\*/g, '<strong>$1</strong>');
        return '<div style="margin-bottom:2px">' + bolded + '</div>';
      })
      .join('');
  };

  const notesBar = doc.notes
    ? '<div style="background:' + C_GOLDBG + ';border-left:4px solid ' + C_GOLD + ';padding:8px 12px;font-size:12px;font-weight:bold;color:#7a5c00;margin-bottom:6px;line-height:1.6">' + formatNotes(doc.notes) + '</div>'
    : '';

  const supplierRow = doc.supplier
    ? '<div><strong>FORNECEDOR:</strong> <span style="font-weight:bold;text-transform:uppercase">' + doc.supplier + '</span></div>'
    : '';
  const phoneRow = client.phone ? '<div style="font-size:12px"><strong>FONE:</strong> ' + client.phone + '</div>' : '';
  const addrRow = client.address ? '<div style="font-size:12px"><strong>ENDEREÇO:</strong> ' + client.address + (client.neighborhood ? ', ' + client.neighborhood : '') + '</div>' : '';
  const cityRow = client.city ? '<div style="font-size:12px"><strong>MUNICÍPIO:</strong> ' + client.city + (client.state ? ' — ' + client.state : '') + '</div>' : '';
  const cepRow = client.cep ? '<div><strong>CEP:</strong> ' + client.cep + '</div>' : '';
  const cnpjRow = client.cnpj ? '<div style="font-size:12px"><strong>CNPJ/CPF:</strong> ' + client.cnpj + '</div>' : '';
  const ieRow = client.ie ? '<div style="font-size:12px"><strong>INS. EST.:</strong> ' + client.ie + '</div>' : '';
  const clientPhone = client.phone ? '<div style="font-size:12px;color:#666;margin-top:2px">' + client.phone + '</div>' : '';


  const emittedDate = new Date().toLocaleDateString('pt-BR');

  let html = '<!DOCTYPE html>\n' +
    '<html lang="pt-BR">\n' +
    '<head>\n' +
    '<meta charset="UTF-8"/>\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0"/>\n' +
    '<title>' + typeLabel + ' No ' + doc.number + '</title>\n' +
    '<style>\n' +
    '  @page { size: A4 portrait; margin: 8mm; }\n' +
    '  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 0; padding: 0; }\n' +
    '  html { height: 100%; }\n' +
    '  body { font-family: Arial, Helvetica, sans-serif; color: #000; background: #e8e8e8; }\n' +
    '  table { border-collapse: collapse; width: 100%; }\n' +
    '  @media screen {\n' +
    '    body { padding: 8px; font-size: 20px; }\n' +
    '    .doc-scaler { width: 794px; transform-origin: top left; transform: scale(var(--doc-scale,1)); }\n' +
    '    .page { background: #fff; box-shadow: 0 2px 16px rgba(0,0,0,0.15); padding: 20px; }\n' +
    '    .btn-wrap { width: 794px; transform-origin: top left; transform: scale(var(--doc-scale,1)); margin-bottom: 4px; }\n' +
    '    .print-btn { display: block; width: 100%; padding: 16px; background: #1a5c34; color: #fff; font-size: 21px; font-weight: bold; border: none; border-radius: 10px; cursor: pointer; }\n' +
    '    .print-btn:active { background: #155228; }\n' +
    '  }\n' +
    '  @media print {\n' +
    '    html, body { width: 210mm; height: 297mm; overflow: hidden !important; }\n' +
    '    body { padding: 0; background: #fff; font-size: 12px; }\n' +
    '    .btn-wrap, .print-btn { display: none !important; }\n' +
    '    .doc-scaler {\n' +
    '      position: absolute; top: 0; left: 0;\n' +
    '      width: 794px !important;\n' +
    '      transform-origin: top left !important;\n' +
    '      transform: scale(var(--print-scale,1)) !important;\n' +
    '    }\n' +
    '    .page { padding: 0; box-shadow: none; border-radius: 0; }\n' +
    '  }\n' +
    '</style>\n' +
    '</head>\n' +
    '<body>\n' +
    '<div class="btn-wrap"><button class="print-btn" onclick="window.print()">&#8595; Salvar como PDF / Imprimir</button></div>\n' +
    '<div class="doc-scaler"><div class="page"><div class="content">\n' +

    // Header
    '<div style="background:' + H_BG + ';padding:16px 18px;border-radius:8px 8px 0 0;border-bottom:3px solid ' + C_GOLD + '">' +
    '<table><tr>' +
    '<td style="vertical-align:middle;width:70px;padding-right:12px"><div style="width:62px;height:62px;background:#fff;border-radius:8px;font-size:47px;text-align:center;line-height:62px">&#127794;</div></td>' +
    '<td style="vertical-align:middle">' +
    '<div style="font-size:23px;font-weight:900;color:' + H_TXT + ';text-transform:uppercase">' + s.companyName + '</div>' +
    '<div style="font-size:13px;color:' + (eco ? C_MED : '#a7f3c0') + ';font-weight:bold;text-transform:uppercase;letter-spacing:2px;margin-top:2px">' + s.companyNeighborhood + '</div>' +
    '<div style="font-size:12px;color:' + (eco ? '#555' : '#d1fae5') + ';margin-top:3px">' + s.companyAddress + ' — ' + s.companyCity + ' | CEP: ' + s.companyCEP + '</div>' +
    '<div style="font-size:12px;color:' + (eco ? '#555' : '#d1fae5') + '">TEL: ' + s.companyPhone + ' | CNPJ: ' + s.companyCNPJ + ' | ' + s.companyEmail + '</div>' +
    '</td>' +
    '<td style="vertical-align:middle;text-align:right;padding-left:12px;white-space:nowrap">' +
    '<div style="display:inline-block;background:#fff;color:#1a5c34;font-weight:900;font-size:26px;padding:6px 18px;text-transform:uppercase;border-radius:6px;margin-bottom:6px">' + typeLabel + '</div>' +
    '<div style="color:' + (eco ? C_MED : '#a7f3c0') + ';font-size:13px;font-weight:bold">DATA: <span style="color:' + H_TXT + '">' + displayDate + '</span></div>' +
    '<div style="color:' + (eco ? C_MED : '#a7f3c0') + ';font-size:13px;font-weight:bold">N&ordm; <span style="color:' + H_TXT + ';font-size:21px;font-weight:900">' + doc.number + '</span></div>' +
    '</td></tr></table></div>' +

    // Client data
    '<div style="border:1px solid #d0e8d8;border-top:none;padding:10px 14px;margin-bottom:6px;background:' + (eco ? '#fff' : C_WARM) + '">' +
    '<table><tr>' +
    '<td style="width:58%;vertical-align:top;padding-right:12px">' +
    '<div style="font-size:12px;margin-bottom:2px"><strong>CLIENTE:</strong> <span style="text-transform:uppercase;font-weight:900;color:#1a5c34">' + (doc.clientName || client.name || '—') + '</span></div>' +
    addrRow + cityRow + cepRow + cnpjRow + ieRow +
    '</td>' +
    '<td style="vertical-align:top;border-left:1px dashed #ccc;padding-left:12px">' +
    supplierRow + phoneRow +
    '<div style="font-size:12px"><strong>COND. PAGTO:</strong> ' + (doc.paymentTerms || '—') + '</div>' +
    '<div style="font-size:12px"><strong>FRETE:</strong> ' + (doc.freight ? 'R$ ' + doc.freight.toLocaleString('pt-BR',{minimumFractionDigits:2}) : 'INCLUSO') + '</div>' +
    '</td></tr></table></div>' +

    notesBar +
    '<div style="margin-top:24px"></div>' +
    // Tables — product or timber mode
    (hasTimberItems ? tablesSections : '') + (productTableHTML ? '<div style="margin-top:16px"></div>' + productTableHTML : '');

  // Build cheques HTML string
  const isDinheiro = doc.paymentMethod === 'dinheiro';
  const chequesHTML: string = cheques.length > 0 ? (
    '<table style="width:100%;border-collapse:collapse;font-size:12px">' +
    '<thead><tr style="background:' + (eco ? "#fff" : "#1a5c34") + ';color:' + (eco ? C_DARK : "#fff") + ';border-bottom:2px solid ' + C_DARK + '">' +
    '<th style="padding:3px 5px;text-align:left;font-size:10px">No</th>' +
    '<th style="padding:3px 5px;text-align:center;font-size:10px">Prazo</th>' +
    '<th style="padding:3px 5px;text-align:center;font-size:10px">Vencimento</th>' +
    '<th style="padding:3px 5px;text-align:right;font-size:10px">Valor</th>' +
    '</tr></thead><tbody>' +
    cheques.map((c: Cheque, i: number) =>
      '<tr style="background:' + (i % 2 === 0 || eco ? '#fff' : '#f0faf4') + '">' +
      '<td style="padding:2px 5px;font-size:10px;color:#555">' + String(i + 1).padStart(2, '0') + '</td>' +
      '<td style="padding:2px 5px;text-align:center;font-size:10px;color:#555">' + c.dias + 'd</td>' +
      '<td style="padding:2px 5px;text-align:center;font-weight:bold;font-size:12px">' + c.vencimento + '</td>' +
      '<td style="padding:2px 5px;text-align:right;font-weight:bold;font-size:12px;color:#1a5c34">' + fmt(c.valor) + '</td>' +
      '</tr>'
    ).join('') +
    '</tbody><tfoot><tr style="background:' + (eco ? "#fff" : "#1a5c34") + ';color:' + (eco ? C_DARK : "#fff") + ';border-top:2px solid ' + C_DARK + '">' +
    '<td colspan="3" style="padding:2px 5px;font-size:10px;font-weight:bold">' + cheques.length + (isDinheiro ? ' parcela' : ' cheque') + (cheques.length > 1 ? 's' : '') + '</td>' +
    '<td style="padding:2px 5px;text-align:right;font-weight:bold;font-size:12px">' + fmt(cheques.reduce((acc: number, c: Cheque) => acc + c.valor, 0)) + '</td>' +
    '</tr></tfoot></table>'
  ) : '';

    // Totals + obs + cheques
  html +=
    '<div style="margin-top:28px"></div>' +
    '<table style="margin-top:0;margin-bottom:8px"><tr>' +
    (chequesHTML ? ('<td style="width:55%;vertical-align:top;padding-right:12px">' +
      '<div style="font-size:10px;font-weight:bold;text-transform:uppercase;color:#555;letter-spacing:1px;margin-bottom:4px">' + (isDinheiro ? 'Parcelas em Dinheiro' : 'Cheques / Parcelas') + '</div>' +
      chequesHTML + '</td>') : '') +
    '<td style="vertical-align:top;' + (chequesHTML ? 'width:45%' : 'width:100%') + '">' +
    '<table style="border:2px solid ' + C_DARK + ';border-radius:6px;overflow:hidden;font-size:13px">' +
    '<tr style="background:' + SUM_BG + '"><td style="' + SUMTD + '"><strong style="color:' + C_DARK + '">Total em M³</strong></td><td style="' + SUMTD + ';font-weight:bold;color:' + C_DARK + ';text-align:right;font-size:17px">' + totals.m3.toFixed(3) + ' m³</td></tr>' +
    '<tr><td style="' + SUMTD + '">Subtotal Madeira</td><td style="' + SUMTD + ';font-weight:bold;text-align:right">' + fmt(totals.subtotal) + '</td></tr>' +
    freteRow + icmsFreteRow + commRow + settlRow + extrasRows +
    '<tr style="background:' + TOT_BG + ';border-top:3px solid ' + C_GOLD + '"><td style="' + SUMTD + ';color:' + TOT_T + ';font-weight:900;font-size:17px;letter-spacing:0.5px">TOTAL A PAGAR</td><td style="border:1px solid ' + C_GOLD + ';padding:7px 14px;font-size:22px;font-weight:900;text-align:right;background:' + TPAY_BG + ';color:' + TPAY_T + '">' + fmt(total) + '</td></tr>' +
    '</table></td></tr></table>' +

    // Footer names
    '<div style="border-top:3px solid ' + C_GOLD + ';margin-top:12px;padding-top:10px">' +
    '<table><tr>' +
    '<td style="width:33%;padding:6px 10px"><div style="background:' + FOOT_BG + ';border:1px solid ' + C_DARK + ';border-radius:6px;padding:8px 10px">' +
    '<div style="font-size:10px;font-weight:bold;text-transform:uppercase;color:' + C_MED + ';letter-spacing:1.5px;margin-bottom:3px">Cliente</div>' +
    '<div style="font-weight:900;font-size:14px;text-transform:uppercase;color:' + C_DARK + '">' + (doc.clientName || client.name || '—') + '</div>' +
    clientPhone + '</div></td>' +
    '<td style="width:34%;padding:6px 10px"><div style="background:' + FOOT_BG + ';border:1px solid ' + C_DARK + ';border-radius:6px;padding:8px 10px">' +
    '<div style="font-size:10px;font-weight:bold;text-transform:uppercase;color:' + C_MED + ';letter-spacing:1.5px;margin-bottom:3px">Fornecedor / Fábrica</div>' +
    '<div style="font-weight:900;font-size:14px;text-transform:uppercase;color:' + C_DARK + '">' + (doc.supplier || '—') + '</div>' +
    '</div></td>' +
    '<td style="width:33%;padding:6px 10px"><div style="background:' + FOOT_BG + ';border:1px solid ' + C_DARK + ';border-radius:6px;padding:8px 10px">' +
    '<div style="font-size:10px;font-weight:bold;text-transform:uppercase;color:' + C_MED + ';letter-spacing:1.5px;margin-bottom:3px">Motorista</div>' +
    '<div style="font-weight:900;font-size:14px;text-transform:uppercase;color:' + C_DARK + '">' + (doc.motorista || '—') + '</div>' +
    '</div></td>' +
    '</tr></table>' +
    '<div style="text-align:center;margin-top:8px;font-size:10px;color:#999;letter-spacing:0.5px">' + s.companyName + ' &nbsp;|&nbsp; ' + s.companyPhone + ' &nbsp;|&nbsp; ' + s.companyEmail + ' &nbsp;|&nbsp; Emitido em ' + emittedDate + '</div>' +
    '</div>' +

    '</div></div></div>' +
    '<script>\n' +
    'function scaleDoc() {\n' +
    '  var vw = window.innerWidth || document.documentElement.clientWidth;\n' +
    '  var screenScale = Math.min(1, (vw - 16) / 794);\n' +
    '  document.documentElement.style.setProperty("--doc-scale", screenScale);\n' +
    '  var scaler = document.querySelector(".doc-scaler");\n' +
    '  var btnWrap = document.querySelector(".btn-wrap");\n' +
    '  if (scaler) { scaler.style.marginBottom = (scaler.offsetHeight * screenScale - scaler.offsetHeight) + "px"; }\n' +
    '  if (btnWrap) { btnWrap.style.marginBottom = (btnWrap.offsetHeight * screenScale - btnWrap.offsetHeight + 8) + "px"; }\n' +
    '  var A4_H = 1123;\n' +
    '  var contentH = scaler ? scaler.scrollHeight : 0;\n' +
    '  var printScale = contentH > 0 ? Math.min(1, A4_H / contentH) : 1;\n' +
    '  document.documentElement.style.setProperty("--print-scale", printScale);\n' +
    '}\n' +
    'window.addEventListener("load", scaleDoc);\n' +
    'window.addEventListener("resize", scaleDoc);\n' +
    '</script>' +
    '</body></html>';
  return html;
}
