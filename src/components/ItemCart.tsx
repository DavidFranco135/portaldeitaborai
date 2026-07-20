import React, { useState, useMemo } from 'react';
import { TimberItem, ProductItem, StockItem } from '../types';
import { calcDerived, newEmptyItem } from '../lib/calc';
import { useApp } from '../store/AppContext';
import {
  Plus, Minus, Trash2, Search, Package, X, TreePine, DoorOpen,
  ChevronDown, ChevronUp, Link2, Check,
} from 'lucide-react';

interface Props {
  timberItems: TimberItem[];
  onChangeTimber: (items: TimberItem[]) => void;
  productItems: ProductItem[];
  onChangeProducts: (items: ProductItem[]) => void;
  readOnly?: boolean;
}

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const UNITS = ['un', 'pc', 'par', 'm²', 'm³', 'm', 'cx', 'kg', 'jg', 'vb'];
const COMPS = [3, 4, 5, 6] as const;

/**
 * Carrinho unificado, estilo PDV — madeira e produtos (portas, batentes,
 * tijolos, etc.) na mesma lista, com botões +/- pra quantidade e busca
 * rápida no estoque. Substitui as duas tabelas separadas de antes.
 */
export const ItemCart: React.FC<Props> = ({
  timberItems, onChangeTimber, productItems, onChangeProducts, readOnly,
}) => {
  const { state } = useApp();
  const stockItems = state.stockItems || [];

  const [addOpen, setAddOpen] = useState(false);
  const [addTab, setAddTab] = useState<'madeira' | 'produto'>('madeira');
  const [search, setSearch] = useState('');
  const [justAddedId, setJustAddedId] = useState<string | null>(null);

  // Madeira form state (dentro do modal de adicionar)
  const [mEsp, setMEsp] = useState('');
  const [mLarg, setMLarg] = useState('');
  const [mComp, setMComp] = useState<typeof COMPS[number]>(3);
  const [mQty, setMQty] = useState('');
  const [mPreco, setMPreco] = useState('');
  const [mStockId, setMStockId] = useState<string | undefined>(undefined);

  const madeiraStock = stockItems.filter(s => s.categoria === 'madeira');
  const produtoStock = stockItems.filter(s => s.categoria !== 'madeira');

  // ── Totais combinados ──────────────────────────────────────────────────
  const timberTotals = useMemo(() => timberItems.reduce((acc, it) => {
    const d = calcDerived(it);
    acc.m3 += d.finalM3;
    acc.value += d.value;
    return acc;
  }, { m3: 0, value: 0 }), [timberItems]);

  const productTotal = useMemo(() =>
    productItems.reduce((s, it) => s + it.qty * it.priceUnit, 0),
    [productItems]
  );

  const grandTotal = timberTotals.value + productTotal;
  const totalItems = timberItems.length + productItems.length;

  // ── Ações: madeira ──────────────────────────────────────────────────────
  const removeTimber = (id: string) => onChangeTimber(timberItems.filter(it => it.id !== id));
  const bumpTimberQty = (item: TimberItem, delta: number) => {
    const comp = item.c3 ? 'c3' : item.c4 ? 'c4' : item.c5 ? 'c5' : item.c6 ? 'c6' : 'c3';
    const current = (item as any)[comp] || 0;
    onChangeTimber(timberItems.map(it => it.id === item.id ? { ...it, [comp]: Math.max(0, current + delta) } : it));
  };
  const setTimberQty = (item: TimberItem, value: number) => {
    const comp = item.c3 ? 'c3' : item.c4 ? 'c4' : item.c5 ? 'c5' : item.c6 ? 'c6' : 'c3';
    onChangeTimber(timberItems.map(it => it.id === item.id ? { ...it, [comp]: Math.max(0, value) } : it));
  };
  const updateTimberPrice = (id: string, price: number) =>
    onChangeTimber(timberItems.map(it => it.id === id ? { ...it, pricePerM3: price } : it));

  const confirmAddMadeira = () => {
    const esp = parseFloat(mEsp) || 0;
    const larg = parseFloat(mLarg) || 0;
    const qty = parseInt(mQty) || 0;
    const preco = parseFloat(mPreco) || 0;
    if (!esp || !larg || !qty) return;

    const item = newEmptyItem();
    item.espessura = esp;
    item.largura = larg;
    item.pricePerM3 = preco;
    (item as any)[`c${mComp}`] = qty;
    if (mStockId) (item as any).stockItemId = mStockId;

    onChangeTimber([...timberItems, item]);
    setJustAddedId(item.id);
    setTimeout(() => setJustAddedId(null), 1500);
    setMEsp(''); setMLarg(''); setMQty(''); setMPreco(''); setMStockId(undefined);
    setAddOpen(false);
  };

  const pickMadeiraStock = (s: StockItem) => {
    setMStockId(s.id);
    if (s.precoVenda) setMPreco(String(s.precoVenda));
  };

  // ── Ações: produtos ──────────────────────────────────────────────────────
  const removeProduct = (id: string) => onChangeProducts(productItems.filter(it => it.id !== id));
  const bumpProductQty = (item: ProductItem, delta: number) =>
    onChangeProducts(productItems.map(it => it.id === item.id ? { ...it, qty: Math.max(0, it.qty + delta) } : it));
  const setProductQty = (item: ProductItem, value: number) =>
    onChangeProducts(productItems.map(it => it.id === item.id ? { ...it, qty: Math.max(0, value) } : it));
  const updateProductPrice = (id: string, price: number) =>
    onChangeProducts(productItems.map(it => it.id === id ? { ...it, priceUnit: price } : it));

  const addFromProductStock = (s: StockItem) => {
    const item: ProductItem = {
      id: Math.random().toString(36).slice(2, 9),
      qty: 1,
      unit: s.unidade || 'un',
      desc: s.descricao,
      priceUnit: s.precoVenda || 0,
      stockItemId: s.id,
    };
    onChangeProducts([...productItems, item]);
    setJustAddedId(item.id);
    setTimeout(() => setJustAddedId(null), 1500);
    setAddOpen(false);
    setSearch('');
  };

  const [manualDesc, setManualDesc] = useState('');
  const [manualUnit, setManualUnit] = useState('un');
  const [manualQty, setManualQty] = useState('');
  const [manualPrice, setManualPrice] = useState('');

  const confirmAddManualProduct = () => {
    if (!manualDesc.trim()) return;
    const item: ProductItem = {
      id: Math.random().toString(36).slice(2, 9),
      qty: parseFloat(manualQty) || 1,
      unit: manualUnit,
      desc: manualDesc,
      priceUnit: parseFloat(manualPrice) || 0,
    };
    onChangeProducts([...productItems, item]);
    setJustAddedId(item.id);
    setTimeout(() => setJustAddedId(null), 1500);
    setManualDesc(''); setManualQty(''); setManualPrice('');
    setAddOpen(false);
  };

  const filteredMadeiraStock = madeiraStock.filter(s => !search || s.descricao.toLowerCase().includes(search.toLowerCase()));
  const filteredProdutoStock = produtoStock.filter(s => !search || s.descricao.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-3">
      {/* ── Lista unificada (cards, mobile-first) ── */}
      <div className="space-y-2">
        {timberItems.map(item => {
          const d = calcDerived(item);
          const comp = item.c3 ? 3 : item.c4 ? 4 : item.c5 ? 5 : item.c6 ? 6 : 0;
          const qty = item.c3 || item.c4 || item.c5 || item.c6 || 0;
          const isNew = item.id === justAddedId;
          return (
            <div key={item.id} className={[
              'bg-white border rounded-xl p-3 shadow-sm transition-all space-y-2.5',
              isNew ? 'border-green-400 bg-green-50 animate-pulse' : 'border-gray-200'
            ].join(' ')}>
              {/* Row 1: ícone + descrição + excluir */}
              <div className="flex items-start gap-2.5">
                <div className="w-9 h-9 bg-amber-50 text-amber-700 rounded-lg flex items-center justify-center flex-shrink-0 text-lg">
                  🪵
                </div>
                <div className="flex-1 min-w-0 pt-1">
                  <p className="font-bold text-gray-800 text-sm">
                    {item.espessura}×{item.largura}cm — {comp}m
                    {(item as any).stockItemId && <Link2 className="w-3 h-3 inline ml-1 text-purple-500" />}
                  </p>
                </div>
                {!readOnly && (
                  <button onClick={() => removeTimber(item.id)} className="p-1 text-gray-300 hover:text-red-500 transition-colors flex-shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Row 2: preço R$/m³ + M³ calculado */}
              <div className="flex items-center gap-2 pl-11">
                {!readOnly ? (
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <span className="text-[10px] text-gray-400 font-bold whitespace-nowrap">R$/m³</span>
                    <input type="number" value={item.pricePerM3 || ''}
                      onChange={e => updateTimberPrice(item.id, parseFloat(e.target.value) || 0)}
                      placeholder="0,00"
                      className="flex-1 min-w-0 text-sm font-bold border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-green-500" />
                  </div>
                ) : (
                  <span className="text-xs text-gray-400">{fmt(item.pricePerM3)}/m³</span>
                )}
                <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">{d.finalM3.toFixed(3)} m³</span>
              </div>

              {/* Row 3: quantidade (steppers) + valor total */}
              <div className="flex items-center justify-between gap-2 pl-11">
                {!readOnly && (
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button onClick={() => bumpTimberQty(item, -1)}
                      className="w-9 h-9 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 active:scale-90 transition-all flex-shrink-0">
                      <Minus className="w-4 h-4" />
                    </button>
                    <input type="number" value={qty || ''}
                      onChange={e => setTimberQty(item, parseInt(e.target.value) || 0)}
                      onFocus={e => e.target.select()}
                      className="w-16 text-center font-black text-gray-800 tabular-nums border border-gray-200 rounded-lg py-2 outline-none focus:border-green-500 focus:bg-green-50" />
                    <button onClick={() => bumpTimberQty(item, 1)}
                      className="w-9 h-9 rounded-lg bg-green-100 hover:bg-green-200 flex items-center justify-center text-green-700 active:scale-90 transition-all flex-shrink-0">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                )}
                <p className="font-black text-gray-900 text-base ml-auto">{fmt(d.value)}</p>
              </div>
            </div>
          );
        })}

        {productItems.map(item => {
          const isNew = item.id === justAddedId;
          return (
            <div key={item.id} className={[
              'bg-white border rounded-xl p-3 shadow-sm transition-all space-y-2.5',
              isNew ? 'border-green-400 bg-green-50 animate-pulse' : 'border-gray-200'
            ].join(' ')}>
              {/* Row 1: ícone + descrição + excluir */}
              <div className="flex items-start gap-2.5">
                <div className="w-9 h-9 bg-blue-50 text-blue-700 rounded-lg flex items-center justify-center flex-shrink-0 text-lg">
                  🚪
                </div>
                <div className="flex-1 min-w-0 pt-1">
                  <p className="font-bold text-gray-800 text-sm">
                    {item.desc || 'Sem descrição'}
                    {item.stockItemId && <Link2 className="w-3 h-3 inline ml-1 text-purple-500" />}
                  </p>
                </div>
                {!readOnly && (
                  <button onClick={() => removeProduct(item.id)} className="p-1 text-gray-300 hover:text-red-500 transition-colors flex-shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Row 2: preço unitário + unidade */}
              <div className="flex items-center gap-2 pl-11">
                {!readOnly ? (
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <span className="text-[10px] text-gray-400 font-bold whitespace-nowrap">R$/{item.unit}</span>
                    <input type="number" step="0.01" value={item.priceUnit || ''}
                      onChange={e => updateProductPrice(item.id, parseFloat(e.target.value) || 0)}
                      placeholder="0,00"
                      className="flex-1 min-w-0 text-sm font-bold border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-green-500" />
                  </div>
                ) : (
                  <span className="text-xs text-gray-400">{fmt(item.priceUnit)} / {item.unit}</span>
                )}
              </div>

              {/* Row 3: quantidade (steppers) + valor total */}
              <div className="flex items-center justify-between gap-2 pl-11">
                {!readOnly && (
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button onClick={() => bumpProductQty(item, -1)}
                      className="w-9 h-9 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 active:scale-90 transition-all flex-shrink-0">
                      <Minus className="w-4 h-4" />
                    </button>
                    <input type="number" step="0.01" value={item.qty || ''}
                      onChange={e => setProductQty(item, parseFloat(e.target.value) || 0)}
                      onFocus={e => e.target.select()}
                      className="w-16 text-center font-black text-gray-800 tabular-nums border border-gray-200 rounded-lg py-2 outline-none focus:border-green-500 focus:bg-green-50" />
                    <button onClick={() => bumpProductQty(item, 1)}
                      className="w-9 h-9 rounded-lg bg-green-100 hover:bg-green-200 flex items-center justify-center text-green-700 active:scale-90 transition-all flex-shrink-0">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                )}
                <p className="font-black text-gray-900 text-base ml-auto">{fmt(item.qty * item.priceUnit)}</p>
              </div>
            </div>
          );
        })}

        {totalItems === 0 && (
          <div className="text-center py-10 bg-white border border-dashed border-gray-200 rounded-xl text-gray-400 text-sm italic">
            Nenhum item ainda. Toque em "Adicionar Item" abaixo.
          </div>
        )}
      </div>

      {/* ── Total sticky ── */}
      {totalItems > 0 && (
        <div className="sticky bottom-2 bg-gray-900 text-white rounded-xl p-4 shadow-lg flex items-center justify-between">
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">
              {totalItems} ite{totalItems !== 1 ? 'ns' : 'm'}
              {timberTotals.m3 > 0 && <> · {timberTotals.m3.toFixed(3)} m³</>}
            </p>
            <p className="text-xl font-black text-yellow-300">{fmt(grandTotal)}</p>
          </div>
        </div>
      )}

      {!readOnly && (
        <button onClick={() => { setAddOpen(true); setSearch(''); }}
          className="w-full flex items-center justify-center gap-2 py-4 bg-green-700 text-white rounded-xl text-base font-black hover:bg-green-800 active:scale-95 transition-all shadow-md">
          <Plus className="w-5 h-5" /> Adicionar Item
        </button>
      )}

      {/* ── Modal: adicionar item ── */}
      {addOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center"
          onClick={() => setAddOpen(false)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[90vh] flex flex-col"
            onClick={e => e.stopPropagation()}>

            {/* Header + tabs */}
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-black text-gray-900">Adicionar Item</h2>
                <button onClick={() => setAddOpen(false)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => { setAddTab('madeira'); setSearch(''); }}
                  className={[
                    'py-3 rounded-xl text-sm font-bold border-2 transition-all flex items-center justify-center gap-2',
                    addTab === 'madeira' ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-gray-200 text-gray-400'
                  ].join(' ')}>
                  <TreePine className="w-4 h-4" /> Madeira
                </button>
                <button onClick={() => { setAddTab('produto'); setSearch(''); }}
                  className={[
                    'py-3 rounded-xl text-sm font-bold border-2 transition-all flex items-center justify-center gap-2',
                    addTab === 'produto' ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-gray-200 text-gray-400'
                  ].join(' ')}>
                  <DoorOpen className="w-4 h-4" /> Produtos / Outros
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 p-4">
              {addTab === 'madeira' ? (
                <div className="space-y-4">
                  {/* Stock quick-pick for madeira (fills price, still need dimensions) */}
                  {madeiraStock.length > 0 && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Preço rápido do estoque (opcional)</label>
                      <div className="flex flex-wrap gap-1.5">
                        {madeiraStock.map(s => (
                          <button key={s.id} onClick={() => pickMadeiraStock(s)}
                            className={[
                              'px-2.5 py-1.5 rounded-lg text-[11px] font-bold border-2 transition-all',
                              mStockId === s.id ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                            ].join(' ')}>
                            {s.descricao.slice(0, 24)} {s.precoVenda ? '· ' + fmt(s.precoVenda) : ''}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Bitola (cm)</label>
                      <input type="number" step="0.1" autoFocus value={mEsp} onChange={e => setMEsp(e.target.value)}
                        placeholder="1,8"
                        className="w-full p-3 border-2 border-gray-200 rounded-xl text-center text-lg font-bold focus:border-amber-500 outline-none" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Largura (cm)</label>
                      <input type="number" step="0.1" value={mLarg} onChange={e => setMLarg(e.target.value)}
                        placeholder="30"
                        className="w-full p-3 border-2 border-gray-200 rounded-xl text-center text-lg font-bold focus:border-amber-500 outline-none" />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Comprimento</label>
                    <div className="grid grid-cols-4 gap-2">
                      {COMPS.map(c => (
                        <button key={c} onClick={() => setMComp(c)}
                          className={[
                            'py-3 rounded-xl text-sm font-black border-2 transition-all',
                            mComp === c ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-gray-200 text-gray-400'
                          ].join(' ')}>
                          {c}m
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Qtd de Peças</label>
                      <input type="number" value={mQty} onChange={e => setMQty(e.target.value)}
                        placeholder="0"
                        className="w-full p-3 border-2 border-gray-200 rounded-xl text-center text-lg font-bold focus:border-amber-500 outline-none" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Preço R$/m³</label>
                      <input type="number" value={mPreco} onChange={e => setMPreco(e.target.value)}
                        placeholder="0,00"
                        className="w-full p-3 border-2 border-gray-200 rounded-xl text-center text-lg font-bold focus:border-amber-500 outline-none" />
                    </div>
                  </div>

                  {(parseFloat(mEsp) > 0 && parseFloat(mLarg) > 0 && parseInt(mQty) > 0) && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                      <p className="text-[10px] text-amber-600 font-bold uppercase">Prévia</p>
                      <p className="text-lg font-black text-amber-800">
                        {((parseFloat(mEsp) / 100) * (parseFloat(mLarg) / 100) * mComp * (parseInt(mQty) || 0)).toFixed(3)} m³
                        {mPreco && <> · {fmt((parseFloat(mEsp) / 100) * (parseFloat(mLarg) / 100) * mComp * (parseInt(mQty) || 0) * (parseFloat(mPreco) || 0))}</>}
                      </p>
                    </div>
                  )}

                  <button onClick={confirmAddMadeira}
                    disabled={!mEsp || !mLarg || !mQty}
                    className="w-full py-4 bg-amber-600 text-white rounded-xl text-base font-black hover:bg-amber-700 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                    Adicionar ao Pedido
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Search stock */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
                      placeholder="Buscar produto no estoque..."
                      className="w-full pl-9 pr-3 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-500" />
                  </div>

                  {filteredProdutoStock.length > 0 && (
                    <div className="space-y-1.5 max-h-56 overflow-y-auto">
                      {filteredProdutoStock.map(s => {
                        const isLow = (s.quantidadeMinima || 0) > 0 && s.quantidadeAtual <= (s.quantidadeMinima || 0);
                        return (
                          <button key={s.id} onClick={() => addFromProductStock(s)}
                            className="w-full text-left px-3 py-2.5 hover:bg-blue-50 active:bg-blue-100 border border-gray-100 rounded-xl transition-colors flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-bold text-gray-800 text-sm truncate">{s.descricao}</p>
                              <p className="text-xs text-gray-400">{s.precoVenda ? fmt(s.precoVenda) + ' / ' + s.unidade : s.unidade}</p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className={['font-bold text-sm', isLow ? 'text-red-600' : 'text-gray-700'].join(' ')}>
                                {s.quantidadeAtual} {s.unidade}
                              </p>
                              {isLow && <p className="text-[9px] text-red-500 font-bold">Baixo</p>}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="border-t border-gray-100 pt-4 space-y-3">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Ou adicionar item avulso</p>
                    <input value={manualDesc} onChange={e => setManualDesc(e.target.value)}
                      placeholder="Descrição do item..."
                      className="w-full p-3 border-2 border-gray-200 rounded-xl text-sm focus:border-blue-500 outline-none" />
                    <div className="grid grid-cols-3 gap-2">
                      <select value={manualUnit} onChange={e => setManualUnit(e.target.value)}
                        className="p-3 border-2 border-gray-200 rounded-xl text-sm text-center focus:border-blue-500 outline-none">
                        {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                      <input type="number" value={manualQty} onChange={e => setManualQty(e.target.value)}
                        placeholder="Qtd"
                        className="p-3 border-2 border-gray-200 rounded-xl text-center text-sm focus:border-blue-500 outline-none" />
                      <input type="number" step="0.01" value={manualPrice} onChange={e => setManualPrice(e.target.value)}
                        placeholder="R$"
                        className="p-3 border-2 border-gray-200 rounded-xl text-center text-sm focus:border-blue-500 outline-none" />
                    </div>
                    <button onClick={confirmAddManualProduct}
                      disabled={!manualDesc.trim()}
                      className="w-full py-3.5 bg-blue-600 text-white rounded-xl text-sm font-black hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                      Adicionar Item Avulso
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
