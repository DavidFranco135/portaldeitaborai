interface PrecoRow {
  id: string;
  bitola: number;
  largura: number;
  comprimento: number;
  valorM3: number;
}

interface SimpleRow {
  id: string;
  descricao: string;
  unidade: string;
  valorUnitario: number;
}

interface TabelaPreco {
  id: string;
  nome: string;
  valorM3: number;
  rows: PrecoRow[];
  simpleRows?: SimpleRow[];
  descricao?: string;
  especie?: string;
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

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function calcRow(r: PrecoRow) {
  const m3Peca = r.bitola > 0 && r.largura > 0 && r.comprimento > 0
    ? (r.bitola / 100) * (r.largura / 100) * r.comprimento
    : 0;
  const qtdPorM3 = m3Peca > 0 ? Math.round(1 / m3Peca) : 0;
  const precoUnidade = r.valorM3 > 0 && m3Peca > 0 ? r.valorM3 * m3Peca : 0;
  return { m3Peca, qtdPorM3, precoUnidade };
}

// ── Modo econômico permanente — sem preenchimentos coloridos, apenas
// bordas e texto coloridos, para economizar tinta em qualquer PDF gerado. ──
const C_DARK = '#1B4332';
const C_GOLD = '#8a6d00';

const TH = 'border:2px solid ' + C_DARK + ';padding:5px 8px;text-align:center;font-weight:bold;font-size:13px;background:#fff;color:' + C_DARK;
const TD = 'border:1px solid #999;padding:4px 8px;text-align:center;font-size:13px;color:#000';
const TD_GRAY = 'border:1px solid #999;padding:4px 8px;text-align:center;font-size:13px;color:#333';

export function buildTabelaHTML(tabela: TabelaPreco, s: Settings): string {
  const today = new Date().toLocaleDateString('pt-BR');
  const isSimple = tabela.especie === 'porta' || tabela.especie === 'aduela' || tabela.especie === 'bloco';

  const tableRows = tabela.rows.map((r, i) => {
    const c = calcRow(r);
    const bg = i % 2 === 0 ? '#ffffff' : '#f7f7f7';
    return (
      '<tr style="background:' + bg + '">' +
      '<td style="' + TD_GRAY + '">' + r.bitola + '</td>' +
      '<td style="' + TD_GRAY + '">' + r.largura + '</td>' +
      '<td style="' + TD_GRAY + '">' + r.comprimento + '</td>' +
      '<td style="' + TD + ';font-weight:bold">' + (c.qtdPorM3 || '—') + '</td>' +
      '<td style="' + TD + ';font-weight:bold;color:#7a4d00">' + (c.precoUnidade > 0 ? fmt(c.precoUnidade) : '—') + '</td>' +
      '<td style="' + TD + '">' + r.comprimento.toFixed(2) + '</td>' +
      '<td style="border:1px solid ' + C_DARK + ';padding:4px 8px;text-align:center;font-size:13px;font-weight:bold;color:' + C_DARK + '">' + fmt(r.valorM3) + '</td>' +
      '<td style="border:1px solid ' + C_DARK + ';padding:4px 8px;text-align:center;font-size:13px;font-weight:bold;color:' + C_DARK + '">' + (c.m3Peca > 0 ? c.m3Peca.toFixed(4) : '—') + '</td>' +
      '</tr>'
    );
  }).join('');

  const simpleTableRows = (tabela.simpleRows || []).map((r, i) => {
    const bg = i % 2 === 0 ? '#ffffff' : '#f7f7f7';
    return (
      '<tr style="background:' + bg + '">' +
      '<td style="' + TD + ';text-align:left;padding-left:10px">' + (r.descricao || '—') + '</td>' +
      '<td style="' + TD_GRAY + '">' + r.unidade + '</td>' +
      '<td style="border:1px solid ' + C_DARK + ';padding:4px 8px;text-align:center;font-size:13px;font-weight:bold;color:' + C_DARK + '">' + (r.valorUnitario > 0 ? fmt(r.valorUnitario) : '—') + '</td>' +
      '</tr>'
    );
  }).join('');

  const priceTableHTML = isSimple
    ? '<table style="margin-bottom:16px">' +
      '<thead><tr>' +
      '<th style="' + TH + ';text-align:left;padding-left:10px">Descrição</th>' +
      '<th style="' + TH + '">Unidade</th>' +
      '<th style="' + TH + '">Preço Unit.</th>' +
      '</tr></thead>' +
      '<tbody>' + simpleTableRows + '</tbody>' +
      '<tfoot><tr>' +
      '<td colspan="3" style="border:1px solid #999;padding:5px 10px;font-size:12px;text-align:right;font-style:italic;color:#555">' +
      (tabela.simpleRows || []).length + ' itens' +
      '</td></tr></tfoot>' +
      '</table>'
    : '<table style="margin-bottom:16px">' +
      '<thead><tr>' +
      '<th style="' + TH + '">Bitola (cm)</th>' +
      '<th style="' + TH + '">Largura (cm)</th>' +
      '<th style="' + TH + '">Comprimento</th>' +
      '<th style="' + TH + '">QTD Peças/m³</th>' +
      '<th style="' + TH + '">Preço/Unidade</th>' +
      '<th style="' + TH + '">Metros Lin.</th>' +
      '<th style="' + TH + '">Valor m³</th>' +
      '<th style="' + TH + '">M³/Peça</th>' +
      '</tr></thead>' +
      '<tbody>' + tableRows + '</tbody>' +
      '<tfoot><tr>' +
      '<td colspan="8" style="border:1px solid #999;padding:5px 10px;font-size:12px;text-align:right;font-style:italic;color:#555">' +
      'valor em m³: <strong style="color:' + C_DARK + '">' + fmt(tabela.valorM3) + '</strong> | ' + tabela.rows.length + ' itens' +
      '</td></tr></tfoot>' +
      '</table>';

  return '<!DOCTYPE html>' +
    '<html lang="pt-BR"><head>' +
    '<meta charset="UTF-8"/>' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0"/>' +
    '<title>' + tabela.nome + '</title>' +
    '<style>' +
    '  @page { size: A4 portrait; margin: 0; }' +
    '  * { box-sizing: border-box; margin: 0; padding: 0; }' +
    '  html, body { height: 100%; }' +
    '  body { font-family: Arial, Helvetica, sans-serif; font-size: 18px; color: #000; background: #e8e8e8; }' +
    '  table { border-collapse: collapse; width: 100%; }' +
    '  @media screen {' +
    '    body { padding: 8px; }' +
    '    .doc-scaler { width: 700px; transform-origin: top left; transform: scale(var(--doc-scale,1)); }' +
    '    .page { background: #fff; box-shadow: 0 2px 16px rgba(0,0,0,0.15); padding: 20px; }' +
    '    .btn-wrap { width: 700px; transform-origin: top left; transform: scale(var(--doc-scale,1)); margin-bottom: 4px; }' +
    '    .print-btn { display: block; width: 100%; padding: 18px; background: ' + C_DARK + '; color: #fff; font-size: 23px; font-weight: bold; border: none; border-radius: 10px; cursor: pointer; }' +
    '    .print-btn:active { background: #123024; }' +
    '  }' +
    '  @media print {' +
    '    html, body { width: 210mm; height: 297mm; overflow: hidden !important; }' +
    '    body { padding: 0; background: #fff; font-size: 12px; }' +
    '    .btn-wrap, .print-btn { display: none !important; }' +
    '    .doc-scaler { position: absolute; top: 0; left: 0; width: 700px !important; transform-origin: top left !important; transform: scale(var(--print-scale,1)) !important; }' +
    '    .page { padding: 16px; }' +
    '  }' +
    '</style></head><body>' +
    '<div class="btn-wrap"><button class="print-btn" onclick="window.print()">&#8595; Salvar como PDF / Imprimir</button></div>' +
    '<div class="doc-scaler"><div class="page">' +

    // Header — sem preenchimento sólido, só borda e texto coloridos
    '<div style="border:2px solid ' + C_DARK + ';border-radius:6px 6px 0 0;padding:14px 16px">' +
    '<table><tr>' +
    '<td style="vertical-align:middle;width:60px;padding-right:12px">' +
    '<div style="width:50px;height:50px;border:2px solid ' + C_DARK + ';border-radius:8px;font-size:34px;text-align:center;line-height:46px">&#127794;</div>' +
    '</td>' +
    '<td style="vertical-align:middle">' +
    '<div style="font-size:21px;font-weight:900;color:' + C_DARK + ';text-transform:uppercase">' + s.companyName + '</div>' +
    '<div style="font-size:13px;color:' + C_DARK + ';font-weight:bold;text-transform:uppercase;letter-spacing:1px;margin-top:2px">' + s.companyNeighborhood + '</div>' +
    '<div style="font-size:12px;color:#333;margin-top:2px">' + s.companyAddress + ' — ' + s.companyCity + ' | CEP: ' + s.companyCEP + '</div>' +
    '<div style="font-size:12px;color:#333">TEL: ' + s.companyPhone + ' | CNPJ: ' + s.companyCNPJ + ' | ' + s.companyEmail + '</div>' +
    '</td>' +
    '<td style="vertical-align:middle;text-align:right;padding-left:12px;white-space:nowrap">' +
    '<div style="display:inline-block;border:2px solid ' + C_DARK + ';color:' + C_DARK + ';font-weight:900;font-size:14px;padding:4px 12px;text-transform:uppercase;border-radius:4px;letter-spacing:1px;margin-bottom:4px">TABELA DE PREÇOS</div>' +
    '<div style="color:' + C_DARK + ';font-size:13px;font-weight:bold">Emitido em: <span>' + today + '</span></div>' +
    '</td>' +
    '</tr></table></div>' +

    // Table title
    '<div style="border:1px solid ' + C_DARK + ';border-top:none;padding:8px 14px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center">' +
    '<div>' +
    '<span style="font-size:17px;font-weight:900;color:' + C_DARK + ';text-transform:uppercase">' + tabela.nome + '</span>' +
    (tabela.descricao ? '<div style="font-size:13px;color:#555;margin-top:2px">' + tabela.descricao + '</div>' : '') +
    '</div>' +
    (isSimple ? '' : '<span style="font-size:14px;font-weight:bold;color:#333;border:1px solid #999;padding:2px 10px;border-radius:4px">Valor m³: <strong style="color:' + C_DARK + '">' + fmt(tabela.valorM3) + '</strong></span>') +
    '</div>' +

    // Price table
    priceTableHTML +

    // Footer
    '<div style="border-top:1px solid #ccc;padding-top:8px;text-align:center;font-size:10px;color:#aaa">' +
    s.companyName + ' | ' + s.companyPhone + ' | ' + s.companyEmail + ' | Gerado em ' + today +
    '</div>' +

    '</div></div>' +
    '<script>' +
    'function scaleDoc() {' +
    '  var vw = window.innerWidth || document.documentElement.clientWidth;' +
    '  var screenScale = Math.min(1, (vw - 16) / 700);' +
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
