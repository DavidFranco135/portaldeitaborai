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

export function buildPartnerReportHTML(partnerName: string, docs: Document[], s: Settings): string {
  // Modo econômico permanente — sem preenchimentos coloridos.
  const C_DARK = '#1B4332';
  const C_PURPLE = '#6D28D9';
  const C_GREEN = '#15803d';
  const C_AMBER = '#a16207';

  const totalShare = docs.reduce((sum, d) => sum + (d.partnerShareValue || 0), 0);
  const totalPaid = docs.filter(d => d.partnerPaid).reduce((sum, d) => sum + (d.partnerShareValue || 0), 0);
  const totalPending = totalShare - totalPaid;
  const today = new Date().toLocaleDateString('pt-BR');

  const sorted = [...docs].sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  const rows = sorted.map((doc, i) => {
    const bg = i % 2 === 0 ? '#fff' : '#f7f7f7';
    const statusBadge = doc.partnerPaid
      ? '<span style="border:1px solid ' + C_GREEN + ';color:' + C_GREEN + ';padding:2px 8px;border-radius:10px;font-size:12px;font-weight:900">✓ REPASSADO</span>'
      : '<span style="border:1px solid ' + C_AMBER + ';color:' + C_AMBER + ';padding:2px 8px;border-radius:10px;font-size:12px;font-weight:900">PENDENTE</span>';
    return (
      '<tr style="background:' + bg + '">' +
      '<td style="border:1px solid #ccc;padding:6px 8px;font-size:13px">' + fmtDate(doc.date) + '</td>' +
      '<td style="border:1px solid #ccc;padding:6px 8px;font-size:13px;font-weight:bold">Nº ' + doc.number + '</td>' +
      '<td style="border:1px solid #ccc;padding:6px 8px;font-size:13px">' + (doc.clientName || '—') + '</td>' +
      '<td style="border:1px solid #ccc;padding:6px 8px;font-size:13px;text-align:right;font-weight:bold">' + fmt(doc.commissionValue || 0) + '</td>' +
      '<td style="border:1px solid #ccc;padding:6px 8px;font-size:13px;text-align:right;font-weight:bold;color:' + C_PURPLE + '">' + fmt(doc.partnerShareValue || 0) + '</td>' +
      '<td style="border:1px solid #ccc;padding:6px 8px;text-align:center">' + statusBadge + '</td>' +
      '</tr>'
    );
  }).join('');

  return '<!DOCTYPE html>' +
    '<html lang="pt-BR"><head>' +
    '<meta charset="UTF-8"/>' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0"/>' +
    '<title>Extrato — ' + partnerName + '</title>' +
    '<style>' +
    '  @page { size: A4 portrait; margin: 0; }' +
    '  * { box-sizing: border-box; margin: 0; padding: 0; }' +
    '  html, body { height: 100%; }' +
    '  body { font-family: Arial, Helvetica, sans-serif; font-size: 16px; color: #000; background: #e8e8e8; }' +
    '  table { border-collapse: collapse; width: 100%; }' +
    '  @media screen {' +
    '    body { padding: 12px; }' +
    '    .doc-scaler { width: 800px; transform-origin: top left; transform: scale(var(--doc-scale,1)); }' +
    '    .page { background: #fff; box-shadow: 0 2px 16px rgba(0,0,0,0.15); padding: 24px; }' +
    '    .btn-wrap { width: 800px; transform-origin: top left; transform: scale(var(--doc-scale,1)); margin-bottom: 4px; }' +
    '    .print-btn { display: block; width: 100%; padding: 16px; background: ' + C_PURPLE + '; color: #fff; font-size: 21px; font-weight: bold; border: none; border-radius: 10px; cursor: pointer; }' +
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

    '<div style="border:2px solid ' + C_PURPLE + ';padding:16px 20px;border-radius:8px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center">' +
    '<div>' +
    '<div style="font-size:23px;font-weight:900;color:' + C_PURPLE + '">EXTRATO DE COMISSÃO — PARCEIRO</div>' +
    '<div style="font-size:16px;color:' + C_PURPLE + ';margin-top:2px;font-weight:bold">' + partnerName + '</div>' +
    '</div>' +
    '<div style="text-align:right;font-size:13px;color:#666">Emitido em<br/><strong style="color:' + C_PURPLE + ';font-size:17px">' + today + '</strong></div>' +
    '</div>' +

    '<div style="display:flex;gap:10px;margin-bottom:18px">' +
    '<div style="flex:1;border:1px solid #999;border-radius:8px;padding:12px;text-align:center">' +
    '<div style="font-size:12px;color:#555;font-weight:bold;text-transform:uppercase">Total Gerado</div>' +
    '<div style="font-size:21px;font-weight:900;color:#333;margin-top:2px">' + fmt(totalShare) + '</div>' +
    '</div>' +
    '<div style="flex:1;border:1px solid ' + C_GREEN + ';border-radius:8px;padding:12px;text-align:center">' +
    '<div style="font-size:12px;color:' + C_GREEN + ';font-weight:bold;text-transform:uppercase">Já Repassado</div>' +
    '<div style="font-size:21px;font-weight:900;color:' + C_GREEN + ';margin-top:2px">' + fmt(totalPaid) + '</div>' +
    '</div>' +
    '<div style="flex:1;border:1px solid ' + C_AMBER + ';border-radius:8px;padding:12px;text-align:center">' +
    '<div style="font-size:12px;color:' + C_AMBER + ';font-weight:bold;text-transform:uppercase">A Repassar</div>' +
    '<div style="font-size:21px;font-weight:900;color:' + C_AMBER + ';margin-top:2px">' + fmt(totalPending) + '</div>' +
    '</div>' +
    '</div>' +

    (docs.length > 0
      ? '<table>' +
        '<thead><tr>' +
        '<th style="border:2px solid ' + C_DARK + ';padding:7px 8px;text-align:left;font-size:13px;color:' + C_DARK + '">Data</th>' +
        '<th style="border:2px solid ' + C_DARK + ';padding:7px 8px;text-align:left;font-size:13px;color:' + C_DARK + '">Romaneio</th>' +
        '<th style="border:2px solid ' + C_DARK + ';padding:7px 8px;text-align:left;font-size:13px;color:' + C_DARK + '">Cliente</th>' +
        '<th style="border:2px solid ' + C_DARK + ';padding:7px 8px;text-align:right;font-size:13px;color:' + C_DARK + '">Comissão Total</th>' +
        '<th style="border:2px solid ' + C_DARK + ';padding:7px 8px;text-align:right;font-size:13px;color:' + C_DARK + '">Parte Parceiro</th>' +
        '<th style="border:2px solid ' + C_DARK + ';padding:7px 8px;text-align:center;font-size:13px;color:' + C_DARK + '">Status</th>' +
        '</tr></thead>' +
        '<tbody>' + rows + '</tbody>' +
        '<tfoot><tr>' +
        '<td colspan="4" style="border:1px solid #999;padding:8px;font-size:14px;text-align:right;font-weight:900">TOTAL —></td>' +
        '<td style="border:2px solid ' + C_PURPLE + ';padding:8px;text-align:right;font-size:16px;font-weight:900;color:' + C_PURPLE + '">' + fmt(totalShare) + '</td>' +
        '<td style="border:1px solid #999"></td>' +
        '</tr></tfoot></table>'
      : '<p style="text-align:center;color:#999;font-style:italic;padding:40px 0">Nenhum romaneio encontrado para este parceiro.</p>'
    ) +

    '<div style="border-top:2px solid #999;margin-top:16px;padding-top:10px;text-align:center;font-size:12px;color:#999">' +
    s.companyName + ' | ' + s.companyPhone + ' | ' + s.companyEmail +
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
