import React, { useState } from 'react';
import { Plus, Trash2, Printer, ChevronDown, ChevronUp, Edit2, Check, X } from 'lucide-react';
import { useApp } from '../store/AppContext';
import { buildTabelaHTML } from '../lib/tabelaHTML';

// ── Types ────────────────────────────────────────────────────────────────────
type Especie = 'pinus' | 'eucalipto' | 'porta' | 'aduela' | 'bloco';
const SIMPLE_ESPECIES: Especie[] = ['porta', 'aduela', 'bloco'];

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
  collapsed: boolean;
  descricao?: string;
  especie: Especie;
}

function calcRow(r: PrecoRow) {
  const m3Peca = r.bitola > 0 && r.largura > 0 && r.comprimento > 0
    ? (r.bitola / 100) * (r.largura / 100) * r.comprimento
    : 0;
  const qtdPorM3 = m3Peca > 0 ? Math.round(1 / m3Peca) : 0;
  const precoUnidade = r.valorM3 > 0 && m3Peca > 0 ? r.valorM3 * m3Peca : 0;
  const ml = r.comprimento;
  return { m3Peca, qtdPorM3, precoUnidade, ml };
}

// Eucalipto: preço por metro corrido (linear) — sem conversão de M³.
// Valor = R$/m³ × (bitola × largura em m²) representa o preço de 1 metro corrido da peça.
function calcRowEucalipto(r: PrecoRow) {
  const areaM2 = r.bitola > 0 && r.largura > 0
    ? (r.bitola / 100) * (r.largura / 100)
    : 0;
  const valorMetroCorrido = r.valorM3 > 0 && areaM2 > 0 ? r.valorM3 * areaM2 : 0;
  return { areaM2, valorMetroCorrido };
}

function newRow(valorM3 = 1400, especie: Especie = 'pinus'): PrecoRow {
  return {
    id: Math.random().toString(36).slice(2, 9),
    bitola: 0,
    largura: 0,
    comprimento: especie === 'eucalipto' ? 1 : 3,
    valorM3,
  };
}

function newSimpleRow(): SimpleRow {
  return {
    id: Math.random().toString(36).slice(2, 9),
    descricao: '',
    unidade: 'un',
    valorUnitario: 0,
  };
}

const ESPECIE_LABEL: Record<Especie, string> = {
  pinus: 'Pinus',
  eucalipto: 'Eucalipto',
  porta: 'Porta',
  aduela: 'Aduela',
  bloco: 'Bloco de Tijolo',
};
const ESPECIE_EMOJI: Record<Especie, string> = {
  pinus: '🌲',
  eucalipto: '🌳',
  porta: '🚪',
  aduela: '🖼',
  bloco: '🧱',
};

function newTabela(valorM3 = 1400, especie: Especie = 'pinus'): TabelaPreco {
  if (SIMPLE_ESPECIES.includes(especie)) {
    return {
      id: Math.random().toString(36).slice(2, 9),
      nome: `${ESPECIE_LABEL[especie]} — Tabela de Preços`,
      valorM3: 0,
      collapsed: false,
      descricao: '',
      especie,
      rows: [],
      simpleRows: [newSimpleRow(), newSimpleRow(), newSimpleRow()],
    };
  }
  const comprimento = especie === 'eucalipto' ? 1 : 3;
  const nomeEspecie = ESPECIE_LABEL[especie];
  return {
    id: Math.random().toString(36).slice(2, 9),
    nome: `${nomeEspecie} — R$ ${valorM3.toLocaleString('pt-BR')}/m³`,
    valorM3,
    collapsed: false,
    descricao: '',
    especie,
    rows: [
      { id: '1', bitola: 1.7, largura: 30, comprimento, valorM3 },
      { id: '2', bitola: 1.7, largura: 28, comprimento, valorM3 },
      { id: '3', bitola: 1.8, largura: 30, comprimento, valorM3 },
    ],
  };
}

const LS_KEY = 'edi_tabelas_preco_v2';

function loadTabelasFromLS(): TabelaPreco[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Compatibilidade: tabelas antigas sem campo "especie" viram Pinus por padrão
      return parsed.map((t: any) => ({ especie: 'pinus', rows: [], ...t }));
    }
  } catch {}
  return [newTabela(1400, 'pinus'), newTabela(1200, 'pinus')];
}

const INP_GRAY = 'w-full text-center text-xs bg-gray-100 border border-gray-200 rounded px-1 py-1.5 focus:bg-white focus:border-green-600 outline-none tabular-nums';
const INP_GREEN = 'w-full text-center text-xs bg-green-50 border border-green-200 rounded px-1 py-1.5 focus:bg-white focus:border-green-600 outline-none tabular-nums font-bold text-green-800';

// ── Component ────────────────────────────────────────────────────────────────
export const TabelaPrecos: React.FC = () => {
  const { state } = useApp();
  const [tabelas, setTabelas] = useState<TabelaPreco[]>(loadTabelasFromLS);
  const [editingNome, setEditingNome] = useState<string | null>(null);
  const [nomeTemp, setNomeTemp] = useState('');

  // Modal de criação de nova tabela — escolha de espécie + valor m³
  const [showNewModal, setShowNewModal] = useState(false);
  const [newEspecie, setNewEspecie] = useState<Especie>('pinus');
  const [newValorM3, setNewValorM3] = useState(1400);

  const save = (t: TabelaPreco[]) => {
    setTabelas(t);
    localStorage.setItem(LS_KEY, JSON.stringify(t));
  };

  const updateTabela = (id: string, patch: Partial<TabelaPreco>) =>
    save(tabelas.map(t => t.id === id ? { ...t, ...patch } : t));

  const deleteTabela = (id: string) => {
    if (!confirm('Excluir esta tabela?')) return;
    save(tabelas.filter(t => t.id !== id));
  };

  const openNewModal = () => {
    setNewEspecie('pinus');
    setNewValorM3(1400);
    setShowNewModal(true);
  };

  const confirmNewTabela = () => {
    save([...tabelas, newTabela(newValorM3 || 1400, newEspecie)]);
    setShowNewModal(false);
  };

  const updateRow = (tabelaId: string, rowId: string, field: keyof PrecoRow, val: number) =>
    save(tabelas.map(t => t.id === tabelaId
      ? { ...t, rows: t.rows.map(r => r.id === rowId ? { ...r, [field]: val, valorM3: field === 'valorM3' ? val : r.valorM3 } : r) }
      : t
    ));

  const addRow = (tabelaId: string) =>
    save(tabelas.map(t => t.id === tabelaId
      ? { ...t, rows: [...t.rows, newRow(t.valorM3, t.especie)] }
      : t
    ));

  const removeRow = (tabelaId: string, rowId: string) =>
    save(tabelas.map(t => t.id === tabelaId
      ? { ...t, rows: t.rows.filter(r => r.id !== rowId) }
      : t
    ));

  const updateSimpleRow = (tabelaId: string, rowId: string, patch: Partial<SimpleRow>) =>
    save(tabelas.map(t => t.id === tabelaId
      ? { ...t, simpleRows: (t.simpleRows || []).map(r => r.id === rowId ? { ...r, ...patch } : r) }
      : t
    ));

  const addSimpleRow = (tabelaId: string) =>
    save(tabelas.map(t => t.id === tabelaId
      ? { ...t, simpleRows: [...(t.simpleRows || []), newSimpleRow()] }
      : t
    ));

  const removeSimpleRow = (tabelaId: string, rowId: string) =>
    save(tabelas.map(t => t.id === tabelaId
      ? { ...t, simpleRows: (t.simpleRows || []).filter(r => r.id !== rowId) }
      : t
    ));

  const applyValorM3ToAll = (tabelaId: string, valorM3: number) =>
    save(tabelas.map(t => t.id === tabelaId
      ? {
          ...t,
          valorM3,
          nome: `${t.especie === 'eucalipto' ? 'Eucalipto' : 'Pinus'} — R$ ${valorM3.toLocaleString('pt-BR')}/m³`,
          rows: t.rows.map(r => ({ ...r, valorM3 })),
        }
      : t
    ));

  const handlePrint = (tabela: TabelaPreco) => {
    const win = window.open('', '_blank');
    if (!win) { alert('Permita pop-ups e tente novamente.'); return; }
    win.document.write(buildTabelaHTML(tabela as any, state.settings));
    win.document.close();
  };

  return (
    <div className="space-y-5 pb-24 md:pb-0">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-green-800">Tabelas de Preço</h1>
          <p className="text-gray-500 text-sm">Tabelas separadas por valor do m³ — salvas automaticamente</p>
        </div>
        <button onClick={openNewModal}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-green-700 text-white rounded-xl font-bold shadow-md hover:bg-green-800 transition-all active:scale-95">
          <Plus className="w-4 h-4" /> Nova Tabela
        </button>
      </div>

      {/* Modal: Nova Tabela — escolha de espécie */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => setShowNewModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-5"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-green-800">Nova Tabela de Preço</h2>
              <button onClick={() => setShowNewModal(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Categoria</label>
              <div className="grid grid-cols-3 gap-2">
                {(['pinus', 'eucalipto', 'porta', 'aduela', 'bloco'] as Especie[]).map(esp => (
                  <button key={esp} type="button" onClick={() => setNewEspecie(esp)}
                    className={[
                      'py-3 rounded-xl text-xs font-bold border-2 transition-all',
                      newEspecie === esp
                        ? 'border-amber-500 bg-amber-50 text-amber-700'
                        : 'border-gray-200 text-gray-400 hover:border-gray-300'
                    ].join(' ')}>
                    {ESPECIE_EMOJI[esp]} {ESPECIE_LABEL[esp]}
                  </button>
                ))}
              </div>
              {newEspecie === 'eucalipto' && (
                <p className="text-[10px] text-gray-400 pt-1">
                  Tabelas de eucalipto mostram o valor por <strong>1 metro corrido</strong>, sem as opções de 3/4/5/6m.
                </p>
              )}
              {SIMPLE_ESPECIES.includes(newEspecie) && (
                <p className="text-[10px] text-gray-400 pt-1">
                  Tabela simples — lista de descrição, unidade e preço, sem cálculo de m³.
                </p>
              )}
            </div>

            {!SIMPLE_ESPECIES.includes(newEspecie) && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Valor do m³ (R$)</label>
                <input type="number" value={newValorM3 || ''}
                  onChange={e => setNewValorM3(parseFloat(e.target.value) || 0)}
                  autoFocus
                  className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl text-base font-bold text-center outline-none focus:border-green-600" />
              </div>
            )}

            <button onClick={confirmNewTabela}
              className="w-full py-3 bg-green-700 text-white rounded-xl font-bold hover:bg-green-800 transition-all active:scale-95">
              Criar Tabela
            </button>
          </div>
        </div>
      )}

      {/* Tables */}
      {tabelas.map(tabela => {
        const isEucalipto = tabela.especie === 'eucalipto';
        const isSimple = SIMPLE_ESPECIES.includes(tabela.especie);
        const headerColor = isEucalipto ? 'bg-red-700' : isSimple ? 'bg-purple-700' : 'bg-green-700';
        return (
        <div key={tabela.id} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          {/* Table header */}
          <div className={[
            'flex items-center justify-between px-4 py-3 gap-3',
            headerColor
          ].join(' ')}>
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {editingNome === tabela.id ? (
                <div className="flex items-center gap-2 flex-1">
                  <input
                    value={nomeTemp}
                    onChange={e => setNomeTemp(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { updateTabela(tabela.id, { nome: nomeTemp }); setEditingNome(null); }
                      if (e.key === 'Escape') setEditingNome(null);
                    }}
                    autoFocus
                    className="flex-1 px-2 py-1 rounded text-sm font-bold text-gray-900 outline-none border-2 border-white"
                  />
                  <button onClick={() => { updateTabela(tabela.id, { nome: nomeTemp }); setEditingNome(null); }}
                    className="p-1 bg-white text-green-700 rounded hover:bg-green-50"><Check className="w-3.5 h-3.5" /></button>
                  <button onClick={() => setEditingNome(null)}
                    className="p-1 bg-white/20 text-white rounded hover:bg-white/30"><X className="w-3.5 h-3.5" /></button>
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-[9px] font-black uppercase tracking-wider bg-white/20 text-white px-1.5 py-0.5 rounded flex-shrink-0">
                    {ESPECIE_EMOJI[tabela.especie]} {ESPECIE_LABEL[tabela.especie]}
                  </span>
                  <h2 className="font-black text-white text-base truncate">{tabela.nome}</h2>
                  <button onClick={() => { setEditingNome(tabela.id); setNomeTemp(tabela.nome); }}
                    className="p-1 text-white/70 hover:text-white transition-colors flex-shrink-0">
                    <Edit2 className="w-3 h-3" />
                  </button>
                  <input
                    value={tabela.descricao || ''}
                    onChange={e => updateTabela(tabela.id, { descricao: e.target.value })}
                    placeholder="Observação / identificação..."
                    className="hidden md:block flex-1 min-w-0 px-2 py-1 bg-white/15 text-white placeholder:text-white/60 text-xs rounded border border-white/20 focus:border-white focus:bg-white/25 outline-none"
                  />
                </div>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button onClick={() => handlePrint(tabela)}
                className={[
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                  isEucalipto ? 'bg-white text-red-800 hover:bg-red-50' : 'bg-white text-green-800 hover:bg-green-50'
                ].join(' ')}>
                <Printer className="w-3.5 h-3.5" /> PDF
              </button>
              <button onClick={() => updateTabela(tabela.id, { collapsed: !tabela.collapsed })}
                className="p-1.5 text-white hover:bg-black/10 rounded-lg transition-all">
                {tabela.collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </button>
              <button onClick={() => deleteTabela(tabela.id)}
                className="p-1.5 text-red-100 hover:text-white hover:bg-red-500 rounded-lg transition-all">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Descricao mobile */}
          {!tabela.collapsed && (
            <div className={['md:hidden px-4 py-2 border-b', isEucalipto ? 'bg-red-600 border-red-500' : isSimple ? 'bg-purple-600 border-purple-500' : 'bg-green-600 border-green-500'].join(' ')}>
              <input
                value={tabela.descricao || ''}
                onChange={e => updateTabela(tabela.id, { descricao: e.target.value })}
                placeholder="Observação / identificação..."
                className="w-full px-2 py-1.5 bg-white/20 text-white placeholder:text-white/70 text-xs rounded border border-white/20 focus:border-white outline-none"
              />
            </div>
          )}

          {/* Valor m³ global control — só pra tabelas de madeira */}
          {!tabela.collapsed && !isSimple && (
            <div className={['flex items-center gap-3 px-4 py-2 border-b', isEucalipto ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'].join(' ')}>
              <span className={['text-xs font-bold uppercase tracking-wider whitespace-nowrap', isEucalipto ? 'text-red-700' : 'text-green-700'].join(' ')}>
                Valor m³ desta tabela:
              </span>
              <input type="number"
                value={tabela.valorM3 || ''}
                onChange={e => applyValorM3ToAll(tabela.id, parseFloat(e.target.value) || 0)}
                className={[
                  'w-28 px-2 py-1 text-sm font-black bg-white border-2 rounded-lg outline-none text-center',
                  isEucalipto ? 'text-red-800 border-red-300 focus:border-red-600' : 'text-green-800 border-green-300 focus:border-green-600'
                ].join(' ')}
              />
              <span className={['text-xs', isEucalipto ? 'text-red-600' : 'text-green-600'].join(' ')}>
                R$/m³ — aplicado a todas as linhas
              </span>
            </div>
          )}

          {/* Table body */}
          {!tabela.collapsed && (
            <div className="overflow-x-auto">
              {isSimple ? (
                // ── Tabela simples (Porta/Aduela/Bloco) — descrição + unidade + preço ──
                <table className="w-full border-collapse text-xs" style={{ minWidth: 420 }}>
                  <thead>
                    <tr className="bg-purple-50 border-b-2 border-purple-200">
                      <th className="border border-gray-200 px-2 py-2 text-left text-[11px] font-black text-gray-700">Descrição</th>
                      <th className="border border-gray-200 px-2 py-2 text-center text-[11px] font-black text-gray-600 bg-gray-100 w-24">Unidade</th>
                      <th className="border border-gray-200 px-2 py-2 text-center text-[11px] font-black text-purple-700 bg-purple-50 w-32">Preço Unit. (R$)</th>
                      <th className="border border-gray-200 w-7 bg-gray-50"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(tabela.simpleRows || []).map((row, i) => (
                      <tr key={row.id} className={i % 2 === 0 ? 'bg-white hover:bg-purple-50/20' : 'bg-gray-50/50 hover:bg-purple-50/20'}>
                        <td className="border border-gray-200 p-1">
                          <input value={row.descricao}
                            onChange={e => updateSimpleRow(tabela.id, row.id, { descricao: e.target.value })}
                            placeholder="Ex: Porta Mista 15 Almofadas 2,10x80"
                            className="w-full text-xs bg-gray-100 border border-gray-200 rounded px-2 py-1.5 focus:bg-white focus:border-purple-600 outline-none" />
                        </td>
                        <td className="border border-gray-200 p-1">
                          <input value={row.unidade}
                            onChange={e => updateSimpleRow(tabela.id, row.id, { unidade: e.target.value })}
                            className={INP_GRAY} placeholder="un" />
                        </td>
                        <td className="border border-gray-200 p-1 bg-purple-50">
                          <input type="number" step="0.01" value={row.valorUnitario || ''}
                            onChange={e => updateSimpleRow(tabela.id, row.id, { valorUnitario: parseFloat(e.target.value) || 0 })}
                            className="w-full text-center text-xs bg-white border border-purple-200 rounded px-1 py-1.5 focus:border-purple-600 outline-none tabular-nums font-bold text-purple-800" />
                        </td>
                        <td className="border border-gray-200 p-1 text-center">
                          <button onClick={() => removeSimpleRow(tabela.id, row.id)}
                            className="p-1 text-gray-300 hover:text-red-500 transition-colors">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {(tabela.simpleRows || []).length === 0 && (
                      <tr><td colSpan={4} className="text-center py-6 text-gray-400 italic text-sm">Nenhuma linha.</td></tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-purple-50 border-t-2 border-purple-200">
                      <td colSpan={4} className="px-3 py-2">
                        <button onClick={() => addSimpleRow(tabela.id)}
                          className="flex items-center gap-1.5 text-xs font-bold text-purple-700 hover:text-purple-900 transition-colors">
                          <Plus className="w-3.5 h-3.5" /> Adicionar linha
                        </button>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              ) : isEucalipto ? (
                // ── Tabela Eucalipto — apenas valor por 1 metro corrido ──────────
                <table className="w-full border-collapse text-xs" style={{ minWidth: 480 }}>
                  <thead>
                    <tr className="bg-red-50 border-b-2 border-red-200">
                      <th className="border border-gray-200 px-2 py-2 text-center text-[11px] font-black text-gray-600 bg-gray-100">Bitola (cm)</th>
                      <th className="border border-gray-200 px-2 py-2 text-center text-[11px] font-black text-gray-600 bg-gray-100">Largura (cm)</th>
                      <th className="border border-gray-200 px-2 py-2 text-center text-[11px] font-black text-gray-700">1 Metro Corrido</th>
                      <th className="border border-gray-200 px-2 py-2 text-center text-[11px] font-black text-red-700 bg-red-50">Valor m³</th>
                      <th className="border border-gray-200 px-2 py-2 text-center text-[11px] font-black text-red-700 bg-red-50">Valor Unit. (R$/m)</th>
                      <th className="border border-gray-200 w-7 bg-gray-50"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {tabela.rows.map((row, i) => {
                      const c = calcRowEucalipto(row);
                      return (
                        <tr key={row.id} className={i % 2 === 0 ? 'bg-white hover:bg-red-50/20' : 'bg-gray-50/50 hover:bg-red-50/20'}>
                          <td className="border border-gray-200 p-1">
                            <input type="number" step="0.1" value={row.bitola || ''}
                              onChange={e => updateRow(tabela.id, row.id, 'bitola', parseFloat(e.target.value) || 0)}
                              className={INP_GRAY} placeholder="7" />
                          </td>
                          <td className="border border-gray-200 p-1">
                            <input type="number" step="0.1" value={row.largura || ''}
                              onChange={e => updateRow(tabela.id, row.id, 'largura', parseFloat(e.target.value) || 0)}
                              className={INP_GRAY} placeholder="7" />
                          </td>
                          <td className="border border-gray-200 p-1.5 text-center font-bold text-gray-500">
                            1,00 m
                          </td>
                          <td className="border border-gray-200 p-1 bg-red-50">
                            <input type="number" value={row.valorM3 || ''}
                              onChange={e => updateRow(tabela.id, row.id, 'valorM3', parseFloat(e.target.value) || 0)}
                              className={INP_GREEN + ' !text-red-800'} />
                          </td>
                          <td className="border border-gray-200 p-1.5 text-center font-bold text-red-700 bg-red-50/50">
                            {c.valorMetroCorrido > 0 ? c.valorMetroCorrido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}
                          </td>
                          <td className="border border-gray-200 p-1 text-center">
                            <button onClick={() => removeRow(tabela.id, row.id)}
                              className="p-1 text-gray-300 hover:text-red-500 transition-colors">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {tabela.rows.length === 0 && (
                      <tr><td colSpan={6} className="text-center py-6 text-gray-400 italic text-sm">Nenhuma linha.</td></tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-red-50 border-t-2 border-red-200">
                      <td colSpan={6} className="px-3 py-2">
                        <button onClick={() => addRow(tabela.id)}
                          className="flex items-center gap-1.5 text-xs font-bold text-red-700 hover:text-red-900 transition-colors">
                          <Plus className="w-3.5 h-3.5" /> Adicionar linha
                        </button>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              ) : (
                // ── Tabela Pinus — como já era, com 3/4/5/6m ──────────────────────
                <table className="w-full border-collapse text-xs" style={{ minWidth: 680 }}>
                  <thead>
                    <tr className="bg-yellow-50 border-b-2 border-yellow-200">
                      <th className="border border-gray-200 px-2 py-2 text-center text-[11px] font-black text-gray-600 bg-gray-100">Bitola (cm)</th>
                      <th className="border border-gray-200 px-2 py-2 text-center text-[11px] font-black text-gray-600 bg-gray-100">Largura (cm)</th>
                      <th className="border border-gray-200 px-2 py-2 text-center text-[11px] font-black text-gray-600 bg-gray-100">Compr.</th>
                      <th className="border border-gray-200 px-2 py-2 text-center text-[11px] font-black text-gray-700">QTD Peças/m³</th>
                      <th className="border border-gray-200 px-2 py-2 text-center text-[11px] font-black text-gray-700">Preço/Unidade</th>
                      <th className="border border-gray-200 px-2 py-2 text-center text-[11px] font-black text-gray-700">Metros Lin.</th>
                      <th className="border border-gray-200 px-2 py-2 text-center text-[11px] font-black text-green-700 bg-green-50">Valor m³</th>
                      <th className="border border-gray-200 px-2 py-2 text-center text-[11px] font-black text-green-700 bg-green-50">M³/peça</th>
                      <th className="border border-gray-200 w-7 bg-gray-50"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {tabela.rows.map((row, i) => {
                      const c = calcRow(row);
                      return (
                        <tr key={row.id} className={i % 2 === 0 ? 'bg-white hover:bg-green-50/20' : 'bg-gray-50/50 hover:bg-green-50/20'}>
                          <td className="border border-gray-200 p-1">
                            <input type="number" step="0.1" value={row.bitola || ''}
                              onChange={e => updateRow(tabela.id, row.id, 'bitola', parseFloat(e.target.value) || 0)}
                              className={INP_GRAY} placeholder="1.8" />
                          </td>
                          <td className="border border-gray-200 p-1">
                            <input type="number" step="0.1" value={row.largura || ''}
                              onChange={e => updateRow(tabela.id, row.id, 'largura', parseFloat(e.target.value) || 0)}
                              className={INP_GRAY} placeholder="30" />
                          </td>
                          <td className="border border-gray-200 p-1">
                            <select value={row.comprimento}
                              onChange={e => updateRow(tabela.id, row.id, 'comprimento', parseFloat(e.target.value))}
                              className={INP_GRAY + ' cursor-pointer'}>
                              <option value={3}>3m</option>
                              <option value={4}>4m</option>
                              <option value={5}>5m</option>
                              <option value={6}>6m</option>
                            </select>
                          </td>
                          <td className="border border-gray-200 p-1.5 text-center font-bold text-gray-800">{c.qtdPorM3 || '—'}</td>
                          <td className="border border-gray-200 p-1.5 text-center font-bold text-gray-700">
                            {c.precoUnidade > 0 ? c.precoUnidade.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}
                          </td>
                          <td className="border border-gray-200 p-1.5 text-center text-gray-500">{c.ml.toFixed(2)}</td>
                          <td className="border border-gray-200 p-1 bg-green-50">
                            <input type="number" value={row.valorM3 || ''}
                              onChange={e => updateRow(tabela.id, row.id, 'valorM3', parseFloat(e.target.value) || 0)}
                              className={INP_GREEN} />
                          </td>
                          <td className="border border-gray-200 p-1.5 text-center font-bold text-green-700 bg-green-50/50">
                            {c.m3Peca > 0 ? c.m3Peca.toFixed(4) : '—'}
                          </td>
                          <td className="border border-gray-200 p-1 text-center">
                            <button onClick={() => removeRow(tabela.id, row.id)}
                              className="p-1 text-gray-300 hover:text-red-500 transition-colors">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {tabela.rows.length === 0 && (
                      <tr><td colSpan={9} className="text-center py-6 text-gray-400 italic text-sm">Nenhuma linha.</td></tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-yellow-50 border-t-2 border-yellow-200">
                      <td colSpan={9} className="px-3 py-2">
                        <button onClick={() => addRow(tabela.id)}
                          className="flex items-center gap-1.5 text-xs font-bold text-green-700 hover:text-green-900 transition-colors">
                          <Plus className="w-3.5 h-3.5" /> Adicionar linha
                        </button>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          )}
        </div>
        );
      })}

      {tabelas.length === 0 && (
        <div className="text-center py-16 bg-white border border-dashed border-gray-200 rounded-xl">
          <p className="text-gray-400 italic text-sm mb-3">Nenhuma tabela criada ainda.</p>
          <button onClick={openNewModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-700 text-white rounded-xl text-sm font-bold hover:bg-green-800">
            <Plus className="w-4 h-4" /> Nova Tabela
          </button>
        </div>
      )}
    </div>
  );
};
