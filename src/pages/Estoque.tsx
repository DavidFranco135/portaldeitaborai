import React, { useState, useMemo } from 'react';
import { useApp } from '../store/AppContext';
import { StockItem, StockMovement } from '../types';
import {
  Plus, Search, Trash2, Edit2, X, Package, AlertTriangle, TrendingUp,
  TrendingDown, History, ChevronDown, ChevronUp,
} from 'lucide-react';

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const CATEGORIAS = [
  { val: 'madeira', label: '🪵 Madeira', color: 'amber' },
  { val: 'porta', label: '🚪 Porta', color: 'blue' },
  { val: 'batente', label: '🖼 Batente', color: 'purple' },
  { val: 'outro', label: '📦 Outro', color: 'gray' },
] as const;

const UNIDADES = ['m³', 'un', 'pc', 'par', 'm', 'm²', 'cx'];

const EMPTY: Partial<StockItem> = {
  categoria: 'madeira',
  unidade: 'un',
  quantidadeAtual: 0,
};

export const Estoque: React.FC = () => {
  const { state, saveStockItem, deleteStockItem, adjustStock } = useApp();
  const [search, setSearch] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState<'todos' | StockItem['categoria']>('todos');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<StockItem>>(EMPTY);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [adjustModal, setAdjustModal] = useState<{ item: StockItem; tipo: 'entrada' | 'saida' } | null>(null);
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustMotivo, setAdjustMotivo] = useState('');

  const items = state.stockItems || [];

  const filtered = useMemo(() => {
    return items
      .filter(i => categoriaFiltro === 'todos' || i.categoria === categoriaFiltro)
      .filter(i => !search || i.descricao.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => a.descricao.localeCompare(b.descricao, 'pt-BR'));
  }, [items, search, categoriaFiltro]);

  const alertaBaixo = items.filter(i => (i.quantidadeMinima || 0) > 0 && i.quantidadeAtual <= (i.quantidadeMinima || 0));

  const openNew = () => { setForm(EMPTY); setEditId(null); setShowForm(true); };
  const openEdit = (item: StockItem) => { setForm({ ...item }); setEditId(item.id); setShowForm(true); };
  const close = () => { setShowForm(false); setForm(EMPTY); setEditId(null); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.descricao) return;
    const now = new Date().toISOString();
    const item: StockItem = {
      ...form,
      id: editId || Math.random().toString(36).slice(2, 11),
      descricao: form.descricao!,
      categoria: form.categoria || 'madeira',
      unidade: form.unidade || 'un',
      quantidadeAtual: form.quantidadeAtual || 0,
      movements: editId ? (items.find(i => i.id === editId)?.movements || []) : [],
      createdAt: editId ? (items.find(i => i.id === editId)?.createdAt || now) : now,
      updatedAt: now,
    } as StockItem;
    await saveStockItem(item);
    close();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este item do estoque? O histórico de movimentações será perdido.')) return;
    await deleteStockItem(id);
  };

  const openAdjust = (item: StockItem, tipo: 'entrada' | 'saida') => {
    setAdjustModal({ item, tipo });
    setAdjustQty('');
    setAdjustMotivo(tipo === 'entrada' ? 'Compra' : 'Ajuste manual');
  };

  const confirmAdjust = async () => {
    if (!adjustModal) return;
    const qty = parseFloat(adjustQty) || 0;
    if (qty <= 0) return;
    const delta = adjustModal.tipo === 'entrada' ? qty : -qty;
    await adjustStock(adjustModal.item.id, delta, adjustMotivo || 'Ajuste manual');
    setAdjustModal(null);
  };

  return (
    <div className="space-y-5 pb-24 md:pb-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-green-800">Estoque</h1>
          <p className="text-gray-500 text-sm">
            {items.length} ite{items.length !== 1 ? 'ns' : 'm'} cadastrado{items.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button onClick={openNew}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-green-700 text-white rounded-xl font-bold shadow-md hover:bg-green-800 transition-all">
          <Plus className="w-4 h-4" /> Novo Item
        </button>
      </div>

      {/* Low stock alert */}
      {alertaBaixo.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <p className="text-xs font-bold text-red-700 uppercase tracking-wider">
              {alertaBaixo.length} ite{alertaBaixo.length !== 1 ? 'ns' : 'm'} com estoque baixo
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {alertaBaixo.map(i => (
              <span key={i.id} className="text-[11px] bg-white border border-red-200 text-red-700 px-2 py-1 rounded-lg font-bold">
                {i.descricao}: {i.quantidadeAtual} {i.unidade}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar item..."
            className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl outline-none focus:border-green-600 shadow-sm text-sm" />
        </div>
        <div className="flex gap-1 p-1 bg-white border border-gray-200 rounded-xl overflow-x-auto">
          <button onClick={() => setCategoriaFiltro('todos')}
            className={['px-3 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap',
              categoriaFiltro === 'todos' ? 'bg-green-700 text-white shadow' : 'text-gray-500 hover:bg-gray-100'].join(' ')}>
            Todos
          </button>
          {CATEGORIAS.map(c => (
            <button key={c.val} onClick={() => setCategoriaFiltro(c.val)}
              className={['px-3 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap',
                categoriaFiltro === c.val ? 'bg-green-700 text-white shadow' : 'text-gray-500 hover:bg-gray-100'].join(' ')}>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={close}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-green-800">{editId ? 'Editar Item' : 'Novo Item de Estoque'}</h2>
              <button onClick={close} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Categoria</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {CATEGORIAS.map(c => (
                    <button key={c.val} type="button" onClick={() => setForm(p => ({ ...p, categoria: c.val }))}
                      className={[
                        'py-2 rounded-lg text-[10px] font-bold border-2 transition-all',
                        form.categoria === c.val ? 'border-green-600 bg-green-50 text-green-800' : 'border-gray-200 text-gray-400'
                      ].join(' ')}>
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Descrição *</label>
                <input required value={form.descricao || ''} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))}
                  placeholder="Ex: Tábua Pinus 30x1,8cm ou Porta Mista 15 Almofadas 2,10x80"
                  className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:border-green-600 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Unidade</label>
                  <select value={form.unidade || 'un'} onChange={e => setForm(p => ({ ...p, unidade: e.target.value }))}
                    className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:border-green-600 outline-none">
                    {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Quantidade Atual</label>
                  <input type="number" step="0.001" value={form.quantidadeAtual ?? ''}
                    onChange={e => setForm(p => ({ ...p, quantidadeAtual: parseFloat(e.target.value) || 0 }))}
                    className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:border-green-600 outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Qtd. Mínima</label>
                  <input type="number" step="0.001" value={form.quantidadeMinima ?? ''}
                    onChange={e => setForm(p => ({ ...p, quantidadeMinima: parseFloat(e.target.value) || 0 }))}
                    placeholder="Alerta"
                    className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:border-green-600 outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Preço Custo</label>
                  <input type="number" step="0.01" value={form.precoCusto ?? ''}
                    onChange={e => setForm(p => ({ ...p, precoCusto: parseFloat(e.target.value) || 0 }))}
                    className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:border-green-600 outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Preço Venda</label>
                  <input type="number" step="0.01" value={form.precoVenda ?? ''}
                    onChange={e => setForm(p => ({ ...p, precoVenda: parseFloat(e.target.value) || 0 }))}
                    className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:border-green-600 outline-none" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 bg-green-700 text-white py-2.5 rounded-xl font-bold hover:bg-green-800 transition-colors">
                  {editId ? 'Atualizar' : 'Salvar Item'}
                </button>
                <button type="button" onClick={close} className="px-6 py-2.5 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-colors">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Adjust stock modal */}
      {adjustModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setAdjustModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
              {adjustModal.tipo === 'entrada'
                ? <><TrendingUp className="w-5 h-5 text-green-600" /> Registrar Entrada</>
                : <><TrendingDown className="w-5 h-5 text-red-600" /> Registrar Saída</>}
            </h2>
            <p className="text-sm text-gray-500">{adjustModal.item.descricao}</p>
            <p className="text-xs text-gray-400">Estoque atual: <strong>{adjustModal.item.quantidadeAtual} {adjustModal.item.unidade}</strong></p>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Quantidade</label>
              <input type="number" step="0.001" autoFocus value={adjustQty} onChange={e => setAdjustQty(e.target.value)}
                className="w-full p-2.5 border-2 border-gray-300 rounded-lg text-base font-bold text-center focus:border-green-600 outline-none" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Motivo</label>
              <input value={adjustMotivo} onChange={e => setAdjustMotivo(e.target.value)}
                className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:border-green-600 outline-none" />
            </div>
            <div className="flex gap-3">
              <button onClick={confirmAdjust}
                className={['flex-1 py-2.5 rounded-xl font-bold text-white transition-colors',
                  adjustModal.tipo === 'entrada' ? 'bg-green-700 hover:bg-green-800' : 'bg-red-600 hover:bg-red-700'].join(' ')}>
                Confirmar
              </button>
              <button onClick={() => setAdjustModal(null)} className="px-6 py-2.5 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* List */}
      <div className="space-y-3">
        {filtered.map(item => {
          const isLow = (item.quantidadeMinima || 0) > 0 && item.quantidadeAtual <= (item.quantidadeMinima || 0);
          const cat = CATEGORIAS.find(c => c.val === item.categoria);
          const isExpanded = expandedId === item.id;
          return (
            <div key={item.id} className={[
              'bg-white border rounded-xl shadow-sm overflow-hidden',
              isLow ? 'border-red-200' : 'border-gray-200'
            ].join(' ')}>
              <div className="p-4 flex items-center gap-3">
                <div className="w-11 h-11 bg-gray-50 rounded-xl flex items-center justify-center flex-shrink-0 text-lg">
                  {cat?.label.split(' ')[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 truncate">{item.descricao}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={['text-lg font-black', isLow ? 'text-red-600' : 'text-gray-800'].join(' ')}>
                      {item.quantidadeAtual}
                    </span>
                    <span className="text-xs text-gray-400">{item.unidade}</span>
                    {isLow && (
                      <span className="text-[9px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-bold flex items-center gap-0.5">
                        <AlertTriangle className="w-2.5 h-2.5" /> Baixo
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => openAdjust(item, 'entrada')} title="Registrar entrada"
                    className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-all">
                    <TrendingUp className="w-4 h-4" />
                  </button>
                  <button onClick={() => openAdjust(item, 'saida')} title="Registrar saída"
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all">
                    <TrendingDown className="w-4 h-4" />
                  </button>
                  <button onClick={() => setExpandedId(isExpanded ? null : item.id)} title="Histórico"
                    className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-all">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <History className="w-4 h-4" />}
                  </button>
                  <button onClick={() => openEdit(item)} className="p-2 text-gray-400 hover:text-green-700 hover:bg-green-50 rounded-lg transition-all">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(item.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-gray-100 bg-gray-50 p-4">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Histórico de Movimentações</p>
                  {(item.movements || []).length === 0 ? (
                    <p className="text-xs text-gray-400 italic">Nenhuma movimentação registrada ainda.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {(item.movements || []).map((m: StockMovement) => (
                        <div key={m.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 text-xs">
                          <div className="flex items-center gap-2">
                            {m.tipo === 'entrada'
                              ? <TrendingUp className="w-3.5 h-3.5 text-green-600" />
                              : <TrendingDown className="w-3.5 h-3.5 text-red-600" />}
                            <div>
                              <p className="font-bold text-gray-700">{m.motivo || (m.tipo === 'entrada' ? 'Entrada' : 'Saída')}</p>
                              {m.documentNumber && (
                                <p className="text-[10px] text-gray-400">
                                  {m.documentType === 'romaneio' ? 'Romaneio' : m.documentType === 'notaentrega' ? 'Nota' : 'Pedido'} Nº {m.documentNumber}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={['font-bold', m.tipo === 'entrada' ? 'text-green-600' : 'text-red-600'].join(' ')}>
                              {m.tipo === 'entrada' ? '+' : '−'}{m.quantidade} {item.unidade}
                            </p>
                            <p className="text-[9px] text-gray-400">{new Date(m.date + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-16 bg-white border border-dashed border-gray-200 rounded-xl">
            <Package className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-400 italic text-sm">Nenhum item de estoque encontrado.</p>
          </div>
        )}
      </div>
    </div>
  );
};
