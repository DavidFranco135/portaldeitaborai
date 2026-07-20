import { Document } from '../types';

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const METHOD_LABELS: Record<string, string> = {
  dinheiro: 'Dinheiro',
  cheque: 'Cheque',
  pix: 'PIX',
  deposito: 'Depósito',
  cartao: 'Cartão',
  outro: 'Outro',
};

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

export function buildPaymentReportHTML(doc: Document, s: Settings): string {
  // Modo econômico permanente — sem preenchimentos coloridos.
  const C_DARK = '#1B4332';
  const C_GREEN = '#15803d';
  const C_RED = '#b91c1c';
  const C_AMBER = '#a16207';

  const payments = doc.payments || [];
  const totalPaid = payments.reduce((s, p) => s + p.valor, 0);
  const remaining = doc.total - totalPaid;
  const isQuitado = remaining <= 0.01;
  const today = new Date().toLocaleDateString('pt-BR');
  const clientName = doc.clientName || (doc.blocos?.[0]?.clientName) || '—';

  const paymentRows = payments
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((p, i) => {
      const dateFmt = p.date ? new Date(p.date + 'T12:00:00').toLocaleDateString('pt-BR') : '—';
      return (
        '<tr style="background:' + (i % 2 === 0 ? '#fff' : '#f7f7f7') + '">' +
        '<td style="border:1px solid #ccc;padding:6px 10px;text-align:center;font-size:14px">' + (i + 1) + '</td>' +
        '<td style="border:1px solid #ccc;padding:6px 10px;text-align:center;font-size:14px;font-weight:bold">' + dateFmt + '</td>' +
        '<td style="border:1px solid #ccc;padding:6px 10px;text-align:center;font-size:14px">' + (METHOD_LABELS[p.method] || p.method) + '</td>' +
        '<td style="border:1px solid #ccc;padding:6px 10px;font-size:13px;color:#555">' + (p.notes || '—') + '</td>' +
        '<td style="border:1px solid #ccc;padding:6px 10px;text-align:right;font-size:16px;font-weight:bold;color:' + C_DARK + '">' + fmt(p.valor) + '</td>' +
        '</tr>'
      );
    }).join('');

  return '<!DOCTYPE html>' +
    '<html lang="pt-BR"><head>' +
    '<meta charset="UTF-8"/>' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0"/>' +
    '<title>Relatório de Pagamento — Romaneio ' + doc.number + '</title>' +
    '<style>' +
    '  @page { size: A4 portrait; margin: 0; }' +
    '  * { box-sizing: border-box; margin: 0; padding: 0; }' +
    '  html, body { height: 100%; }' +
    '  body { font-family: Arial, Helvetica, sans-serif; font-size: 18px; color: #000; background: #e8e8e8; }' +
    '  table { border-collapse: collapse; width: 100%; }' +
    '  @media screen {' +
    '    body { padding: 8px; }' +
    '    .doc-scaler { width: 800px; transform-origin: top left; transform: scale(var(--doc-scale,1)); }' +
    '    .page { background: #fff; box-shadow: 0 2px 16px rgba(0,0,0,0.15); padding: 20px; }' +
    '    .btn-wrap { width: 800px; transform-origin: top left; transform: scale(var(--doc-scale,1)); margin-bottom: 4px; }' +
    '    .print-btn { display: block; width: 100%; padding: 16px; background: ' + C_DARK + '; color: #fff; font-size: 21px; font-weight: bold; border: none; border-radius: 10px; cursor: pointer; }' +
    '  }' +
    '  @media print {' +
    '    html, body { width: 210mm; height: 297mm; overflow: hidden !important; }' +
    '    body { padding: 0; background: #fff; }' +
    '    .btn-wrap, .print-btn { display: none !important; }' +
    '    .doc-scaler { position: absolute; top: 0; left: 0; width: 800px !important; transform-origin: top left !important; transform: scale(var(--print-scale,1)) !important; }' +
    '    .page { padding: 16px; }' +
    '  }' +
    '</style></head><body>' +
    '<div class="btn-wrap"><button class="print-btn" onclick="window.print()">&#8595; Salvar como PDF / Imprimir</button></div>' +
    '<div class="doc-scaler"><div class="page">' +

    // Header — borda em vez de preenchimento
    '<div style="border:2px solid ' + C_DARK + ';padding:16px 18px;border-radius:8px 8px 0 0">' +
    '<table><tr>' +
    '<td style="vertical-align:middle;width:60px;padding-right:12px">' +
    '<div style="width:50px;height:50px;border:2px solid ' + C_DARK + ';border-radius:8px;font-size:34px;text-align:center;line-height:46px">&#127794;</div>' +
    '</td>' +
    '<td style="vertical-align:middle">' +
    '<div style="font-size:21px;font-weight:900;color:' + C_DARK + ';text-transform:uppercase">' + s.companyName + '</div>' +
    '<div style="font-size:12px;color:#333;margin-top:3px">' + s.companyPhone + ' | ' + s.companyEmail + '</div>' +
    '</td>' +
    '<td style="vertical-align:middle;text-align:right;padding-left:12px;white-space:nowrap">' +
    '<div style="display:inline-block;border:2px solid ' + C_DARK + ';color:' + C_DARK + ';font-weight:900;font-size:17px;padding:5px 14px;text-transform:uppercase;border-radius:6px;letter-spacing:1px">RELATÓRIO DE PAGAMENTO</div>' +
    '<div style="color:' + C_DARK + ';font-size:13px;font-weight:bold;margin-top:4px">ROMANEIO Nº <span style="font-size:17px">' + doc.number + '</span></div>' +
    '</td>' +
    '</tr></table></div>' +

    // Client + status
    '<div style="border:1px solid #999;border-top:none;padding:12px 16px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center">' +
    '<div>' +
    '<div style="font-size:12px;color:#666;text-transform:uppercase;letter-spacing:1px;font-weight:bold">Cliente</div>' +
    '<div style="font-size:18px;font-weight:900;color:' + C_DARK + ';text-transform:uppercase">' + clientName + '</div>' +
    '</div>' +
    '<div style="text-align:right">' +
    '<div style="display:inline-block;padding:5px 14px;border-radius:20px;font-size:14px;font-weight:900;border:2px solid ' + (isQuitado ? C_GREEN : C_AMBER) + ';color:' + (isQuitado ? C_GREEN : C_AMBER) + '">' +
    (isQuitado ? '✓ QUITADO' : 'EM ABERTO') + '</div>' +
    '</div>' +
    '</div>' +

    // Summary cards — bordas coloridas, sem preenchimento
    '<table style="margin-bottom:16px"><tr>' +
    '<td style="width:33%;padding:4px"><div style="border:1px solid ' + C_DARK + ';border-radius:8px;padding:12px;text-align:center">' +
    '<div style="font-size:12px;color:#555;text-transform:uppercase;font-weight:bold">Valor Total</div>' +
    '<div style="font-size:21px;font-weight:900;color:' + C_DARK + ';margin-top:2px">' + fmt(doc.total) + '</div>' +
    '</div></td>' +
    '<td style="width:33%;padding:4px"><div style="border:1px solid ' + C_GREEN + ';border-radius:8px;padding:12px;text-align:center">' +
    '<div style="font-size:12px;color:' + C_GREEN + ';text-transform:uppercase;font-weight:bold">Recebido</div>' +
    '<div style="font-size:21px;font-weight:900;color:' + C_GREEN + ';margin-top:2px">' + fmt(totalPaid) + '</div>' +
    '</div></td>' +
    '<td style="width:33%;padding:4px"><div style="border:1px solid ' + (isQuitado ? C_GREEN : C_RED) + ';border-radius:8px;padding:12px;text-align:center">' +
    '<div style="font-size:12px;color:' + (isQuitado ? C_GREEN : C_RED) + ';text-transform:uppercase;font-weight:bold">Saldo</div>' +
    '<div style="font-size:21px;font-weight:900;color:' + (isQuitado ? C_GREEN : C_RED) + ';margin-top:2px">' + fmt(Math.max(0, remaining)) + '</div>' +
    '</div></td>' +
    '</tr></table>' +

    // Payments table
    '<div style="font-size:14px;font-weight:900;color:' + C_DARK + ';text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">Histórico de Recebimentos</div>' +
    (payments.length > 0 ?
      '<table style="margin-bottom:16px">' +
      '<thead><tr>' +
      '<th style="border:2px solid ' + C_DARK + ';padding:7px;text-align:center;font-size:13px;color:' + C_DARK + '">Nº</th>' +
      '<th style="border:2px solid ' + C_DARK + ';padding:7px;text-align:center;font-size:13px;color:' + C_DARK + '">Data</th>' +
      '<th style="border:2px solid ' + C_DARK + ';padding:7px;text-align:center;font-size:13px;color:' + C_DARK + '">Forma</th>' +
      '<th style="border:2px solid ' + C_DARK + ';padding:7px;text-align:left;font-size:13px;color:' + C_DARK + '">Observação</th>' +
      '<th style="border:2px solid ' + C_DARK + ';padding:7px;text-align:right;font-size:13px;color:' + C_DARK + '">Valor</th>' +
      '</tr></thead>' +
      '<tbody>' + paymentRows + '</tbody>' +
      '<tfoot><tr>' +
      '<td colspan="4" style="border:1px solid #999;padding:8px;font-size:16px;font-weight:900">TOTAL RECEBIDO</td>' +
      '<td style="border:2px solid ' + C_DARK + ';padding:8px;text-align:right;font-size:17px;font-weight:900;color:' + C_DARK + '">' + fmt(totalPaid) + '</td>' +
      '</tr></tfoot></table>'
      : '<p style="font-size:14px;color:#999;font-style:italic;padding:12px 0">Nenhum pagamento registrado ainda.</p>'
    ) +

    // Footer
    '<div style="border-top:2px solid #999;margin-top:16px;padding-top:10px;text-align:center;font-size:12px;color:#999">' +
    s.companyName + ' | ' + s.companyPhone + ' | ' + s.companyEmail + ' | Relatório gerado em ' + today +
    '</div>' +

    '</div></div>' +
    '<script>' +
    'function scaleDoc() {' +
    '  var vw = window.innerWidth || document.documentElement.clientWidth;' +
    '  var screenScale = Math.min(1, (vw - 16) / 800);' +
    '  document.documentElement.style.setProperty("--doc-scale", screenScale);' +
    '  var scaler = document.querySelector(".doc-scaler");' +
    '  var btnWrap = document.querySelector(".btn-wrap");' +
    '  if (scaler) { scaler.style.marginBottom = (scaler.offsetHeight * screenScale - scaler.offsetHeight) + "px"; }' +
    '  if (btnWrap) { btnWrap.style.marginBottom = (btnWrap.offsetHeight * screenScale - btnWrap.offsetHeight + 8) + "px"; }' +
    '  var A4_H = 1123;' +
    '  var contentH = scaler ? scaler.scrollHeight : 0;' +
    '  var printScale = contentH > 0 ? Math.min(1, A4_H / contentH) : 1;' +
    '  document.documentElement.style.setProperty("--print-scale", printScale);' +
    '}' +
    'window.addEventListener("load", scaleDoc);' +
    'window.addEventListener("resize", scaleDoc);' +
    '</script>' +
    '</body></html>';
}
