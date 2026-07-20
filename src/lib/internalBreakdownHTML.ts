import { Document } from '../types';

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDate(d?: string) {
  if (!d) return '—';
  try { return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR'); }
  catch { return d; }
}

interface Settings {
  companyName: string;
  companyPhone: string;
  companyEmail: string;
}

interface BreakdownData {
  totals: { subtotal: number; m3: number };
  freight: number;
  serrariaBaseValue: number;
  totalAPagarBruto: number;
  diferencaVenda: number;
  commission: number;
  commissionPct: number;
  temParceiro: boolean;
  partnerName?: string;
  partnerCommissionShare: number;
  partnerMarkup: number;
  ownerMarkup: number;
  myShareValue: number;
  partnerShareValue: number;
  total: number;
}

export function buildInternalBreakdownHTML(doc: Document, data: BreakdownData, s: Settings): string {
  // Modo econômico permanente — sem preenchimentos coloridos.
  const C_DARK = '#1B4332';
  const C_PURPLE = '#6D28D9';
  const C_GREEN = '#15803d';
  const C_AMBER = '#a16207';
  const C_RED = '#b91c1c';

  const today = new Date().toLocaleDateString('pt-BR');
  const clientName = doc.clientName || (doc.blocos?.[0]?.clientName) || '—';

  const row = (label: string, value: string, opts?: { bold?: boolean; color?: string; indent?: boolean }) =>
    '<tr>' +
    '<td style="border:1px solid #ccc;padding:7px 10px;font-size:14px;' +
    (opts?.bold ? 'font-weight:900;' : '') +
    (opts?.indent ? 'padding-left:24px;color:#666;' : '') +
    '">' + label + '</td>' +
    '<td style="border:1px solid #ccc;padding:7px 10px;font-size:14px;text-align:right;font-weight:bold;' +
    'color:' + (opts?.color || '#000') + ';' +
    (opts?.bold ? 'font-size:17px;' : '') +
    '">' + value + '</td>' +
    '</tr>';

  const sectionTitle = (label: string) =>
    '<tr><td colspan="2" style="background:' + C_DARK + ';color:#fff;padding:6px 10px;font-size:13px;font-weight:900;text-transform:uppercase;letter-spacing:0.5px">' + label + '</td></tr>';

  let rows = '';
  rows += sectionTitle('Valores do Romaneio');
  rows += row('Subtotal Madeira', fmt(data.totals.subtotal));
  rows += row('Frete', '– ' + fmt(data.freight));
  rows += row('Total a Pagar Bruto (subtotal − frete)', fmt(data.totalAPagarBruto), { bold: true });

  if (data.serrariaBaseValue > 0) {
    rows += sectionTitle('Negociação com a Serraria');
    rows += row('Valor Negociado com a Serraria (bruto)', fmt(data.serrariaBaseValue));
    rows += row('Diferença vendida a mais (bruto − negociado)', fmt(data.diferencaVenda));
    rows += row(data.temParceiro ? 'Diferença pertence a' : 'Diferença pertence a', data.temParceiro ? (data.partnerName || 'Parceiro') : 'Você (100%)', { indent: true, color: data.temParceiro ? C_PURPLE : C_GREEN });
  }

  rows += sectionTitle('Comissão');
  rows += row('Comissão (' + data.commissionPct + '%)', fmt(data.commission));

  if (data.temParceiro) {
    rows += row('Sua parte da comissão', fmt(data.commission - data.partnerCommissionShare), { indent: true, color: C_GREEN });
    rows += row((data.partnerName || 'Parceiro') + ' — parte da comissão', fmt(data.partnerCommissionShare), { indent: true, color: C_PURPLE });
  }

  rows += sectionTitle('Resumo — Quem Fica com o Quê');
  rows += row('💰 Você recebe (comissão' + (data.ownerMarkup > 0 ? ' + diferença' : '') + ')', fmt(data.myShareValue), { bold: true, color: C_GREEN });
  if (data.temParceiro && data.partnerShareValue > 0) {
    rows += row('👥 ' + (data.partnerName || 'Parceiro') + ' recebe (comissão + diferença)', fmt(data.partnerShareValue), { bold: true, color: C_PURPLE });
  }
  rows += row('🏭 Vai para a Serraria (líquido)', fmt(data.total), { bold: true, color: C_AMBER });

  return '<!DOCTYPE html>' +
    '<html lang="pt-BR"><head>' +
    '<meta charset="UTF-8"/>' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0"/>' +
    '<title>Detalhamento Interno — Romaneio ' + doc.number + '</title>' +
    '<style>' +
    '  @page { size: A4 portrait; margin: 10mm; }' +
    '  * { box-sizing: border-box; margin: 0; padding: 0; }' +
    '  body { font-family: Arial, Helvetica, sans-serif; font-size: 17px; color: #000; background: #e8e8e8; }' +
    '  table { border-collapse: collapse; width: 100%; }' +
    '  .page { background: #fff; width: 100%; max-width: 700px; margin: 0 auto; padding: 20px; }' +
    '  .print-btn { display: block; width: 100%; max-width: 700px; margin: 0 auto 12px; padding: 16px; background: ' + C_DARK + '; color: #fff; font-size: 21px; font-weight: bold; border: none; border-radius: 10px; cursor: pointer; }' +
    '  @media screen {' +
    '    body { padding: 8px; }' +
    '    .page { box-shadow: 0 2px 16px rgba(0,0,0,0.15); border-radius: 8px; }' +
    '  }' +
    '  @media print {' +
    '    body { padding: 0; background: #fff; }' +
    '    .print-btn { display: none !important; }' +
    '    .page { padding: 0; max-width: 100%; }' +
    '  }' +
    '</style></head><body>' +
    '<button class="print-btn" onclick="window.print()">&#8595; Salvar como PDF / Imprimir</button>' +
    '<div class="page">' +

    '<div style="border:2px solid ' + C_AMBER + ';background:#fffbeb;padding:10px 14px;border-radius:8px;margin-bottom:14px;text-align:center">' +
    '<span style="font-size:14px;font-weight:900;color:' + C_AMBER + '">⚠ DOCUMENTO INTERNO — NÃO ENVIAR AO CLIENTE OU À SERRARIA</span>' +
    '</div>' +

    '<div style="border:2px solid ' + C_DARK + ';padding:14px 16px;border-radius:8px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">' +
    '<div>' +
    '<div style="font-size:21px;font-weight:900;color:' + C_DARK + '">DETALHAMENTO INTERNO</div>' +
    '<div style="font-size:14px;color:#555;margin-top:2px">Romaneio Nº ' + doc.number + ' — ' + clientName + '</div>' +
    '</div>' +
    '<div style="text-align:right;font-size:12px;color:#666">Data do romaneio<br/><strong style="color:' + C_DARK + ';font-size:16px">' + fmtDate(doc.date) + '</strong></div>' +
    '</div>' +

    '<table style="margin-bottom:16px">' + rows + '</table>' +

    '<div style="border-top:2px solid #999;margin-top:16px;padding-top:10px;text-align:center;font-size:12px;color:#999">' +
    s.companyName + ' | ' + s.companyPhone + ' | ' + s.companyEmail + ' | Gerado em ' + today +
    '</div>' +

    '</div>' +
    '</body></html>';
}
