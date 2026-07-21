import { Document, Bloco, TimberItem, ProductItem } from '../types';

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

interface Settings {
  companyName: string;
  companyNeighborhood: string;
  companyAddress: string;
  companyCity: string;
  companyCEP: string;
  companyPhone: string;
  companyCNPJ: string;
  companyEmail: string;
}

function calcTimberRow(it: TimberItem) {
  const qty = (it.c3 || 0) + (it.c4 || 0) + (it.c5 || 0) + (it.c6 || 0);
  const comp = it.c3 ? 3 : it.c4 ? 4 : it.c5 ? 5 : it.c6 ? 6 : 0;
  const m3Auto = it.espessura && it.largura && comp
    ? (it.espessura / 100) * (it.largura / 100) * comp * qty
    : 0;
  const finalM3 = it.customM3 != null ? it.customM3 : m3Auto;
  const valor = finalM3 * (it.pricePerM3 || 0);
  const precoUnit = qty > 0 ? valor / qty : 0;
  return { qty, comp, finalM3, valor, precoUnit };
}

/**
 * Nota de Entrega — documento SIMPLES de confirmação de itens entregues,
 * com preço. Sem comissão, sem frete, sem cheques — mas SEMPRE mostra
 * preço unitário e valor de cada linha, madeira e produtos juntos na
 * mesma nota quando ambos existirem.
 */
export function buildDeliveryNoteHTML(doc: Document, client: Record<string, any>, s: Settings): string {
  const C_DARK = '#1B4332';
  const C_GOLD = '#D4A017';
  const C_SAGE = '#F0F7F4';

  const today = new Date().toLocaleDateString('pt-BR');
  const displayDate = doc.date ? new Date(doc.date + 'T12:00:00').toLocaleDateString('pt-BR') : today;
  const clientName = doc.clientName || doc.blocos?.[0]?.clientName || client.name || '—';

  const blocos: Bloco[] = doc.blocos && doc.blocos.length > 0 ? doc.blocos : [];
  const timberItems = blocos.flatMap(b => b.items || []).filter(it => (it.c3 || it.c4 || it.c5 || it.c6));
  const productItems = doc.productItems || [];

  // ── Tabela de madeira — COM preço unitário e valor ──────────────────────
  const timberRows = timberItems.map((it: TimberItem, i: number) => {
    const c = calcTimberRow(it);
    const bg = i % 2 === 0 ? '#fff' : C_SAGE;
    return (
      '<tr style="background:' + bg + '">' +
      '<td style="border:1px solid #ccc;padding:6px 8px;text-align:left;font-size:12px;font-weight:bold">' + (it.desc || '—') + '</td>' +
      '<td style="border:1px solid #ccc;padding:6px 8px;text-align:center;font-size:12px">' + it.espessura + '</td>' +
      '<td style="border:1px solid #ccc;padding:6px 8px;text-align:center;font-size:12px">' + it.largura + '</td>' +
      '<td style="border:1px solid #ccc;padding:6px 8px;text-align:center;font-size:12px">' + c.comp + 'm</td>' +
      '<td style="border:1px solid #ccc;padding:6px 8px;text-align:center;font-size:12px;font-weight:bold">' + c.qty + '</td>' +
      '<td style="border:1px solid #ccc;padding:6px 8px;text-align:center;font-size:12px">' + fmt(it.pricePerM3 || 0) + '</td>' +
      '<td style="border:1px solid #ccc;padding:6px 8px;text-align:center;font-size:12px">' + fmt(c.precoUnit) + '</td>' +
      '<td style="border:1px solid ' + C_DARK + ';padding:6px 8px;text-align:center;font-size:12px;font-weight:bold;color:' + C_DARK + '">' + c.finalM3.toFixed(3) + '</td>' +
      '<td style="border:1px solid #e8d090;padding:6px 8px;text-align:right;font-size:12px;font-weight:bold;background:#FDF8EC">' + fmt(c.valor) + '</td>' +
      '</tr>'
    );
  }).join('');

  const timberM3Total = timberItems.reduce((s, it) => s + calcTimberRow(it).finalM3, 0);
  const timberValueTotal = timberItems.reduce((s, it) => s + calcTimberRow(it).valor, 0);

  // ── Tabela de produtos — COM preço unitário e valor (já tinha, mantido) ──
  const productRows = productItems.map((it: ProductItem, i: number) => {
    const bg = i % 2 === 0 ? '#fff' : C_SAGE;
    const lineTotal = it.qty * it.priceUnit;
    return (
      '<tr style="background:' + bg + '">' +
      '<td style="border:1px solid #ccc;padding:6px 8px;text-align:center;font-size:12px;font-weight:bold">' + it.qty + '</td>' +
      '<td style="border:1px solid #ccc;padding:6px 8px;text-align:center;font-size:12px">' + it.unit + '</td>' +
      '<td style="border:1px solid #ccc;padding:6px 8px;text-align:left;font-size:12px">' + it.desc + '</td>' +
      '<td style="border:1px solid #ccc;padding:6px 8px;text-align:center;font-size:12px">' + fmt(it.priceUnit) + '</td>' +
      '<td style="border:1px solid #e8d090;padding:6px 8px;text-align:right;font-size:12px;font-weight:bold;background:#FDF8EC">' + fmt(lineTotal) + '</td>' +
      '</tr>'
    );
  }).join('');

  const productValueTotal = productItems.reduce((s, it) => s + it.qty * it.priceUnit, 0);
  const grandTotal = timberValueTotal + productValueTotal;

  const timberTableHTML = timberItems.length > 0
    ? '<div style="font-size:11px;font-weight:900;color:' + C_DARK + ';text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">🪵 Madeira</div>' +
      '<table style="margin-bottom:16px">' +
      '<thead><tr style="background:' + C_DARK + ';color:#fff">' +
      '<th style="padding:7px 6px;font-size:11px;text-align:left;padding-left:8px">Descrição</th>' +
      '<th style="padding:7px 6px;font-size:11px">Bitola<br/>(cm)</th>' +
      '<th style="padding:7px 6px;font-size:11px">Larg.<br/>(cm)</th>' +
      '<th style="padding:7px 6px;font-size:11px">Compr.</th>' +
      '<th style="padding:7px 6px;font-size:11px">Qtd<br/>Peças</th>' +
      '<th style="padding:7px 6px;font-size:11px">R$/m³</th>' +
      '<th style="padding:7px 6px;font-size:11px">Preço<br/>Unit.</th>' +
      '<th style="padding:7px 6px;font-size:11px;background:' + C_GOLD + ';color:' + C_DARK + '">M³</th>' +
      '<th style="padding:7px 6px;font-size:11px;background:' + C_GOLD + ';color:' + C_DARK + '">VALOR</th>' +
      '</tr></thead>' +
      '<tbody>' + timberRows + '</tbody>' +
      '<tfoot><tr style="background:' + C_DARK + ';color:#fff;font-weight:900;border-top:3px solid ' + C_GOLD + '">' +
      '<td colspan="7" style="padding:7px 8px;text-align:right;font-size:12px">TOTAL MADEIRA →</td>' +
      '<td style="padding:7px 8px;text-align:center;font-size:13px;background:' + C_GOLD + ';color:' + C_DARK + '">' + timberM3Total.toFixed(3) + '</td>' +
      '<td style="padding:7px 8px;text-align:right;font-size:13px;background:' + C_GOLD + ';color:' + C_DARK + '">' + fmt(timberValueTotal) + '</td>' +
      '</tr></tfoot>' +
      '</table>'
    : '';

  const productTableHTML = productItems.length > 0
    ? '<div style="font-size:11px;font-weight:900;color:' + C_DARK + ';text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">🚪 Produtos</div>' +
      '<table style="margin-bottom:16px">' +
      '<thead><tr style="background:' + C_DARK + ';color:#fff">' +
      '<th style="padding:7px 8px;font-size:11px">Qtd</th>' +
      '<th style="padding:7px 8px;font-size:11px">Unid.</th>' +
      '<th style="padding:7px 8px;font-size:11px;text-align:left">Descrição do Produto</th>' +
      '<th style="padding:7px 8px;font-size:11px">V. Unit.</th>' +
      '<th style="padding:7px 8px;font-size:11px;background:' + C_GOLD + ';color:' + C_DARK + '">VALOR</th>' +
      '</tr></thead>' +
      '<tbody>' + productRows + '</tbody>' +
      '<tfoot><tr style="background:' + C_DARK + ';color:#fff;font-weight:900;border-top:3px solid ' + C_GOLD + '">' +
      '<td colspan="4" style="padding:7px 8px;text-align:right;font-size:12px">TOTAL PRODUTOS →</td>' +
      '<td style="padding:7px 8px;text-align:right;font-size:13px;background:' + C_GOLD + ';color:' + C_DARK + '">' + fmt(productValueTotal) + '</td>' +
      '</tr></tfoot>' +
      '</table>'
    : '';

  return '<!DOCTYPE html>' +
    '<html lang="pt-BR"><head>' +
    '<meta charset="UTF-8"/>' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0"/>' +
    '<title>Nota de Entrega Nº ' + doc.number + '</title>' +
    '<style>' +
    '  @page { size: A4 portrait; margin: 10mm; }' +
    '  * { box-sizing: border-box; margin: 0; padding: 0; }' +
    '  body { font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #000; background: #e8e8e8; }' +
    '  table { border-collapse: collapse; width: 100%; }' +
    '  .page { background: #fff; width: 100%; max-width: 760px; margin: 0 auto; padding: 20px; }' +
    '  .print-btn { display: block; width: 100%; max-width: 760px; margin: 0 auto 12px; padding: 16px; background: ' + C_DARK + '; color: #fff; font-size: 18px; font-weight: bold; border: none; border-radius: 10px; cursor: pointer; }' +
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

    // Header
    '<div style="border:2px solid ' + C_DARK + ';padding:14px 16px;border-radius:8px 8px 0 0">' +
    '<table><tr>' +
    '<td style="vertical-align:middle;width:60px;padding-right:12px">' +
    '<div style="width:50px;height:50px;border:2px solid ' + C_DARK + ';border-radius:8px;font-size:26px;text-align:center;line-height:46px">&#128230;</div>' +
    '</td>' +
    '<td style="vertical-align:middle">' +
    '<div style="font-size:19px;font-weight:900;color:' + C_DARK + ';text-transform:uppercase">' + s.companyName + '</div>' +
    '<div style="font-size:11px;color:#333;margin-top:2px">' + s.companyAddress + ' — ' + s.companyCity + '</div>' +
    '<div style="font-size:11px;color:#333">' + s.companyPhone + ' | ' + s.companyCNPJ + '</div>' +
    '</td>' +
    '<td style="vertical-align:middle;text-align:right;white-space:nowrap">' +
    '<div style="display:inline-block;border:2px solid ' + C_DARK + ';color:' + C_DARK + ';font-weight:900;font-size:13px;padding:5px 14px;text-transform:uppercase;border-radius:6px;letter-spacing:1px">NOTA DE ENTREGA</div>' +
    '<div style="color:' + C_DARK + ';font-size:12px;font-weight:bold;margin-top:4px">DATA: <span>' + displayDate + '</span></div>' +
    '<div style="color:' + C_DARK + ';font-size:12px;font-weight:bold">Nº <span style="font-size:16px">' + doc.number + '</span></div>' +
    '</td>' +
    '</tr></table></div>' +

    // Client
    '<div style="border:1px solid #999;border-top:none;padding:10px 14px;margin-bottom:12px">' +
    '<div style="font-size:11px"><strong>CLIENTE:</strong> <span style="color:' + C_DARK + ';font-weight:900;text-transform:uppercase">' + clientName + '</span></div>' +
    (client.address ? '<div style="font-size:11px">ENDEREÇO: ' + client.address + (client.neighborhood ? ', ' + client.neighborhood : '') + '</div>' : '') +
    (client.city ? '<div style="font-size:11px">MUNICÍPIO: ' + client.city + (client.state ? ' — ' + client.state : '') + '</div>' : '') +
    (doc.motorista ? '<div style="font-size:11px"><strong>MOTORISTA:</strong> ' + doc.motorista + '</div>' : '') +
    '</div>' +

    (doc.notes ? '<div style="background:#FDF8EC;border-left:4px solid ' + C_GOLD + ';padding:8px 12px;margin-bottom:12px;font-size:11px;font-weight:bold;color:#7a5c00">' + doc.notes + '</div>' : '') +

    // Tabelas — madeira e produtos juntas, quando existirem
    timberTableHTML + productTableHTML +

    (timberItems.length > 0 && productItems.length > 0
      ? '<div style="background:' + C_DARK + ';color:#fff;padding:10px 16px;border-radius:8px;display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;border:2px solid ' + C_GOLD + '">' +
        '<span style="font-size:13px;font-weight:900;text-transform:uppercase">TOTAL GERAL DA NOTA</span>' +
        '<span style="font-size:19px;font-weight:900;color:' + C_GOLD + '">' + fmt(grandTotal) + '</span>' +
        '</div>'
      : '') +

    // Signatures
    '<div style="border-top:3px solid ' + C_GOLD + ';margin-top:16px;padding-top:12px">' +
    '<table><tr>' +
    '<td style="width:48%;padding-right:8px">' +
    '<div style="background:' + C_SAGE + ';border:1px solid ' + C_DARK + ';border-left:3px solid ' + C_GOLD + ';border-radius:4px;padding:10px 12px">' +
    '<div style="font-size:10px;font-weight:bold;text-transform:uppercase;color:' + C_DARK + ';letter-spacing:1.5px;margin-bottom:3px">Entregue por</div>' +
    '<div style="font-weight:900;font-size:13px;color:' + C_DARK + '">' + (doc.motorista || s.companyName) + '</div>' +
    '<div style="margin-top:20px;border-top:1px solid #999;padding-top:4px;font-size:9px;color:#666">Assinatura</div>' +
    '</div>' +
    '</td>' +
    '<td style="width:48%;padding-left:8px">' +
    '<div style="background:' + C_SAGE + ';border:1px solid ' + C_DARK + ';border-left:3px solid ' + C_GOLD + ';border-radius:4px;padding:10px 12px">' +
    '<div style="font-size:10px;font-weight:bold;text-transform:uppercase;color:' + C_DARK + ';letter-spacing:1.5px;margin-bottom:3px">Recebido por</div>' +
    '<div style="font-weight:900;font-size:13px;color:' + C_DARK + '">' + clientName + '</div>' +
    '<div style="margin-top:20px;border-top:1px solid #999;padding-top:4px;font-size:9px;color:#666">Assinatura / Data</div>' +
    '</div>' +
    '</td>' +
    '</tr></table>' +
    '</div>' +

    '<div style="text-align:center;margin-top:10px;font-size:11px;color:#999">' +
    s.companyName + ' | ' + s.companyPhone + ' | ' + s.companyEmail + ' | Emitido em ' + today +
    '</div>' +

    '</div></body></html>';
}
