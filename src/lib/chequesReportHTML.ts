import { BouncedCheck } from '../types';

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

export function buildChequesReportHTML(checks: BouncedCheck[], s: Settings, filterLabel: string): string {
  // Modo econômico permanente — sem preenchimentos coloridos.
  const C_DARK = '#1B4332';
  const C_GREEN = '#15803d';
  const C_RED = '#b91c1c';
  const C_AMBER = '#92400e';

  const totalAguardando = checks.filter(c => c.status === 'aguardando').reduce((s, c) => s + c.valor, 0);
  const totalPago = checks.filter(c => c.status === 'pago').reduce((s, c) => s + c.valor, 0);
  const today = new Date().toLocaleDateString('pt-BR');

  const checkBlocks = checks.map((c, i) => {
    const allPhotos = [
      ...(c.photos || []),
      ...(c.photoData && !(c.photos || []).some(p => p.data === c.photoData)
        ? [{ id: 'legacy', data: c.photoData, label: 'Cheque' }] : []),
    ];

    const cols = allPhotos.length >= 3 ? 3 : allPhotos.length;
    const photosHTML = allPhotos.length > 0
      ? '<div style="margin-top:10px;display:grid;grid-template-columns:repeat(' + cols + ',1fr);gap:8px">' +
        allPhotos.map(p =>
          '<div>' +
          (p.label ? '<div style="font-size:10px;color:#666;margin-bottom:3px;font-weight:bold;text-transform:uppercase;text-align:center">' + p.label + '</div>' : '') +
          '<img src="' + p.data + '" style="width:100%;height:auto;max-height:260px;object-fit:contain;border-radius:6px;border:1px solid #ccc;display:block;background:#fafafa" />' +
          '</div>'
        ).join('') +
        '</div>'
      : '<p style="font-size:12px;color:#aaa;font-style:italic;margin-top:6px">Nenhuma foto anexada</p>';

    const statusBadge = c.status === 'pago'
      ? '<span style="border:1px solid ' + C_GREEN + ';color:' + C_GREEN + ';padding:3px 10px;border-radius:12px;font-size:12px;font-weight:900">✓ PAGO</span>'
      : '<span style="border:1px solid ' + C_RED + ';color:' + C_RED + ';padding:3px 10px;border-radius:12px;font-size:12px;font-weight:900">AGUARDANDO</span>';

    return (
      '<div style="border:1px solid #999;border-radius:8px;padding:12px 14px;margin-bottom:12px;background:' + (i % 2 === 0 ? '#fff' : '#f7f7f7') + '">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">' +
      '<div>' +
      '<div style="font-size:16px;font-weight:900;color:' + C_DARK + ';text-transform:uppercase">' + c.clientName + '</div>' +
      '<div style="font-size:12px;color:#666;margin-top:2px">' +
      (c.numero ? 'Cheque Nº ' + c.numero + ' • ' : '') + (c.banco || '—') +
      '</div>' +
      '</div>' +
      '<div style="text-align:right">' +
      statusBadge +
      '<div style="font-size:18px;font-weight:900;color:' + C_DARK + ';margin-top:4px">' + fmt(c.valor) + '</div>' +
      '</div>' +
      '</div>' +
      '<div style="display:flex;gap:16px;font-size:12px;color:#666;margin-bottom:4px">' +
      '<span><strong>Emissão:</strong> ' + fmtDate(c.dataEmissao) + '</span>' +
      '<span><strong>Devolução:</strong> ' + fmtDate(c.dataDevolucao) + '</span>' +
      (c.status === 'pago' ? '<span><strong>Pagamento:</strong> ' + fmtDate(c.dataPagamento) + '</span>' : '') +
      '</div>' +
      '<div style="font-size:12px;color:' + C_AMBER + ';border:1px solid ' + C_AMBER + ';display:inline-block;padding:2px 8px;border-radius:10px;font-weight:bold">' +
      '⚠ ' + c.motivo +
      '</div>' +
      (c.notes ? '<p style="font-size:12px;color:#666;margin-top:6px;font-style:italic">' + c.notes + '</p>' : '') +
      photosHTML +
      '</div>'
    );
  }).join('');

  return '<!DOCTYPE html>' +
    '<html lang="pt-BR"><head>' +
    '<meta charset="UTF-8"/>' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0"/>' +
    '<title>Relatório de Cheques Devolvidos</title>' +
    '<style>' +
    '  @page { size: A4 portrait; margin: 0; }' +
    '  * { box-sizing: border-box; margin: 0; padding: 0; }' +
    '  html, body { height: 100%; }' +
    '  body { font-family: Arial, Helvetica, sans-serif; font-size: 16px; color: #000; background: #e8e8e8; }' +
    '  @media screen {' +
    '    body { padding: 12px; }' +
    '    .doc-scaler { width: 800px; transform-origin: top left; transform: scale(var(--doc-scale,1)); }' +
    '    .page { background: #fff; border-radius: 8px; box-shadow: 0 2px 16px rgba(0,0,0,0.15); padding: 24px; }' +
    '    .btn-wrap { width: 800px; transform-origin: top left; transform: scale(var(--doc-scale,1)); margin-bottom: 4px; }' +
    '    .print-btn { display: block; width: 100%; padding: 16px; background: ' + C_DARK + '; color: #fff; font-size: 21px; font-weight: bold; border: none; border-radius: 10px; cursor: pointer; }' +
    '  }' +
    '  @media print {' +
    '    html, body { width: 210mm; height: 297mm; overflow: hidden !important; }' +
    '    body { padding: 0; background: #fff; }' +
    '    .btn-wrap, .print-btn { display: none !important; }' +
    '    .doc-scaler {' +
    '      position: absolute; top: 0; left: 0;' +
    '      width: 800px !important;' +
    '      transform-origin: top left !important;' +
    '      transform: scale(var(--print-scale,1)) !important;' +
    '    }' +
    '    .page { padding: 16px; }' +
    '  }' +
    '</style></head><body>' +
    '<div class="btn-wrap"><button class="print-btn" onclick="window.print()">&#8595; Salvar como PDF / Imprimir</button></div>' +
    '<div class="doc-scaler"><div class="page">' +

    '<div style="border:2px solid ' + C_DARK + ';padding:16px 20px;border-radius:8px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center">' +
    '<div>' +
    '<div style="font-size:23px;font-weight:900;color:' + C_DARK + '">RELATÓRIO DE CHEQUES DEVOLVIDOS</div>' +
    '<div style="font-size:13px;color:#555;margin-top:2px">' + s.companyName + ' • ' + filterLabel + '</div>' +
    '</div>' +
    '<div style="text-align:right;font-size:13px;color:#555">Emitido em<br/><strong style="color:' + C_DARK + ';font-size:17px">' + today + '</strong></div>' +
    '</div>' +

    '<div style="display:flex;gap:12px;margin-bottom:20px">' +
    '<div style="flex:1;border:1px solid ' + C_RED + ';border-radius:8px;padding:12px;text-align:center">' +
    '<div style="font-size:12px;color:' + C_RED + ';font-weight:bold;text-transform:uppercase">Aguardando</div>' +
    '<div style="font-size:23px;font-weight:900;color:' + C_RED + ';margin-top:2px">' + fmt(totalAguardando) + '</div>' +
    '<div style="font-size:12px;color:' + C_RED + '">' + checks.filter(c => c.status === 'aguardando').length + ' cheque(s)</div>' +
    '</div>' +
    '<div style="flex:1;border:1px solid ' + C_GREEN + ';border-radius:8px;padding:12px;text-align:center">' +
    '<div style="font-size:12px;color:' + C_GREEN + ';font-weight:bold;text-transform:uppercase">Pagos</div>' +
    '<div style="font-size:23px;font-weight:900;color:' + C_GREEN + ';margin-top:2px">' + fmt(totalPago) + '</div>' +
    '<div style="font-size:12px;color:' + C_GREEN + '">' + checks.filter(c => c.status === 'pago').length + ' cheque(s)</div>' +
    '</div>' +
    '</div>' +

    (checks.length > 0 ? checkBlocks : '<p style="text-align:center;color:#999;font-style:italic;padding:40px 0">Nenhum cheque encontrado para os filtros selecionados.</p>') +

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
