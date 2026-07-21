import React, { useState, useMemo } from 'react';
import { TimberItem, ProductItem, StockItem } from '../types';
import { calcDerived, newEmptyItem } from '../lib/calc';
import { useApp } from '../store/AppContext';
import {
  Plus, Minus, Trash2, Search, Package, X,
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

  /**
   * Verifica se a quantidade pedida de um item vinculado ao estoque passa
   * do que está disponível. Não bloqueia (pode ser uma encomenda), só
   * avisa visualmente.
   */
  const getStockWarning = (stockItemId: string | undefined, requestedQty: number) => {
    if (!stockItemId) return null;
    const s = stockItems.find(x => x.id === stockItemId);
    if (!s) return null;
    if (requestedQty > s.quantidadeAtual) {
      return { disponivel: s.quantidadeAtual, unidade: s.unidade };
    }
    return null;
  };

  const [addOpen, setAddOpen] = useState(false);
  const [catBrowsing, setCatBrowsing] = useState<'madeira' | 'porta' | 'batente' | 'outro' | null>(null);
  const [search, setSearch] = useState('');
  const [justAddedId, setJustAddedId] = useState<string | null>(null);

  // Madeira form state (dentro do modal de adicionar)
  const [mEsp, setMEsp] = useState('');
  const [mDesc, setMDesc] = useState('');
  const [mLarg, setMLarg] = useState('');
  const [mComp, setMComp] = useState<typeof COMPS[number]>(3);
  const [mQty, setMQty] = useState('');
  const [mPreco, setMPreco] = useState('');
  const [mPrecoPeca, setMPrecoPeca] = useState('');
  const [mPriceMode, setMPriceMode] = useState<'m3' | 'peca'>('m3');
  const [mStockId, setMStockId] = useState<string | undefined>(undefined);

  const madeiraStock = stockItems.filter(s => s.categoria === 'madeira');
  const produtoStock = stockItems.filter(s => s.categoria !== 'madeira');

  // Navegação por categoria dentro do modal — igual ao Catálogo, pra
  // facilitar achar o produto certo entre vários itens cadastrados.
  const [addedFlash, setAddedFlash] = useState<string | null>(null);

  // Vínculo automático: se a bitola + largura digitadas baterem com um
  // item cadastrado no estoque (com essas medidas exatas), vincula sozinho
  // — sem precisar tocar num atalho manualmente. Isso é o que garante a
  // baixa automática do estoque ao concluir o pedido.
  const autoMatchedStock = useMemo(() => {
    const esp = parseFloat(mEsp);
    const larg = parseFloat(mLarg);
    if (!esp || !larg) return null;
    return madeiraStock.find(s => s.espessura === esp && s.largura === larg) || null;
  }, [mEsp, mLarg, madeiraStock]);

  React.useEffect(() => {
    if (autoMatchedStock) {
      setMStockId(autoMatchedStock.id);
      if (autoMatchedStock.precoVenda && !mPreco) setMPreco(String(autoMatchedStock.precoVenda));
      if (!mDesc) setMDesc(autoMatchedStock.descricao);
    } else if (mStockId && !madeiraStock.some(s => s.id === mStockId)) {
      setMStockId(undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoMatchedStock]);

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
  const stockWarningCount = useMemo(() => {
    const timberQty = (it: TimberItem) => it.c3 || it.c4 || it.c5 || it.c6 || 0;
    const timberCount = timberItems.filter(it => getStockWarning((it as any).stockItemId, timberQty(it))).length;
    const productCount = productItems.filter(it => getStockWarning(it.stockItemId, it.qty)).length;
    return timberCount + productCount;
  }, [timberItems, productItems, stockItems]);

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
    if (!esp || !larg || !qty) return;

    // Se o vendedor digitou o preço da PEÇA (uma tábua), converte pra
    // R$/m³ internamente — é isso que o sistema usa em todos os cálculos,
    // no PDF e na baixa de estoque.
    const m3PorPeca = (esp / 100) * (larg / 100) * mComp;
    const preco = mPriceMode === 'peca'
      ? (m3PorPeca > 0 ? (parseFloat(mPrecoPeca) || 0) / m3PorPeca : 0)
      : (parseFloat(mPreco) || 0);

    const item = newEmptyItem();
    item.espessura = esp;
    item.largura = larg;
    item.pricePerM3 = preco;
    item.desc = mDesc.trim() || undefined;
    (item as any)[`c${mComp}`] = qty;
    if (mStockId) (item as any).stockItemId = mStockId;

    onChangeTimber([...timberItems, item]);
    setJustAddedId(item.id);
    setTimeout(() => setJustAddedId(null), 1500);
    setMEsp(''); setMLarg(''); setMQty(''); setMPreco(''); setMPrecoPeca(''); setMStockId(undefined); setMDesc('');
    setAddOpen(false);
  };

  /**
   * Adiciona madeira direto do estoque, tocando na grade — 1 peça, no
   * comprimento selecionado, com o preço já cadastrado. Modal continua
   * aberto (igual produtos), pra adicionar vários itens seguidos. A
   * quantidade e o preço ficam livres pra ajustar depois, direto no
   * carrinho.
   */
  const addFromMadeiraStock = (s: StockItem) => {
    if (!s.espessura || !s.largura) return;
    const item = newEmptyItem();
    item.espessura = s.espessura;
    item.largura = s.largura;
    item.desc = s.descricao;
    item.pricePerM3 = s.precoVenda || 0;
    item.stockItemId = s.id;
    (item as any)[`c${mComp}`] = 1;

    onChangeTimber([...timberItems, item]);
    setJustAddedId(item.id);
    setTimeout(() => setJustAddedId(null), 1500);
    setAddedFlash(s.descricao);
    setTimeout(() => setAddedFlash(null), 1200);
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
    // Modal continua aberto — mostra uma confirmação rápida em vez de
    // fechar, assim dá pra adicionar vários itens seguidos sem reabrir.
    setAddedFlash(s.descricao);
    setTimeout(() => setAddedFlash(null), 1200);
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
  const buscaProdutoAtiva = search.trim().length > 0;
  const filteredProdutoStock = produtoStock.filter(s => {
    if (buscaProdutoAtiva) return s.descricao.toLowerCase().includes(search.toLowerCase());
    if (catBrowsing) return s.categoria === catBrowsing;
    return false; // sem busca nem categoria escolhida — mostra as pastas
  });

  const PRODUTO_CATEGORIAS = [
    { val: 'porta' as const, label: 'Portas', emoji: '🚪', color: 'from-blue-500 to-blue-600' },
    { val: 'batente' as const, label: 'Batentes', emoji: '🖼', color: 'from-purple-500 to-purple-600' },
    { val: 'outro' as const, label: 'Outros', emoji: '📦', color: 'from-gray-500 to-gray-600' },
  ];
  const contagemProdutoCategoria = useMemo(() => {
    const map: Record<string, number> = { porta: 0, batente: 0, outro: 0 };
    for (const s of produtoStock) map[s.categoria] = (map[s.categoria] || 0) + 1;
    return map;
  }, [produtoStock]);

  // Todas as categorias juntas — madeira + produtos — mostradas como uma
  // grade única no topo do modal, igual a página Catálogo.
  const TODAS_CATEGORIAS = [
    { val: 'madeira' as const, label: 'Madeira', emoji: '🪵', color: 'from-amber-500 to-amber-600', count: madeiraStock.length },
    ...PRODUTO_CATEGORIAS.map(c => ({ ...c, count: contagemProdutoCategoria[c.val] || 0 })),
  ];

  return (
    <div className="space-y-3">
      {/* ── Lista unificada (cards, mobile-first) ── */}
      <div className="space-y-2">
        {timberItems.map(item => {
          const d = calcDerived(item);
          const comp = item.c3 ? 3 : item.c4 ? 4 : item.c5 ? 5 : item.c6 ? 6 : 0;
          const qty = item.c3 || item.c4 || item.c5 || item.c6 || 0;
          const timberStockWarning = getStockWarning((item as any).stockItemId, qty);
          const isNew = item.id === justAddedId;
          return (
            <div key={item.id} className={[
              'bg-white border rounded-xl p-3 shadow-sm transition-all space-y-2.5',
              isNew ? 'border-green-400 bg-green-50 animate-pulse'
                : timberStockWarning ? 'border-red-300' : 'border-gray-200'
            ].join(' ')}>
              {/* Row 1: ícone + descrição + excluir */}
              <div className="flex items-start gap-2.5">
                <div className="w-9 h-9 bg-amber-50 text-amber-700 rounded-lg flex items-center justify-center flex-shrink-0 text-lg">
                  🪵
                </div>
                <div className="flex-1 min-w-0 pt-1">
                  <p className="font-bold text-gray-800 text-sm">
                    {item.desc || `${item.espessura}×${item.largura}cm — ${comp}m`}
                    {(item as any).stockItemId && <Link2 className="w-3 h-3 inline ml-1 text-purple-500" />}
                  </p>
                  {item.desc && (
                    <p className="text-[10px] text-gray-400">{item.espessura}×{item.largura}cm — {comp}m</p>
                  )}
                  {timberStockWarning && (
                    <p className="text-[10px] text-red-600 font-bold flex items-center gap-1 mt-0.5">
                      ⚠ Estoque insuficiente — disponível: {timberStockWarning.disponivel} {timberStockWarning.unidade}
                    </p>
                  )}
                </div>
                {!readOnly && (
                  <button onClick={() => removeTimber(item.id)} className="p-1 text-gray-300 hover:text-red-500 transition-colors flex-shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Row 2: preço R$/m³ + valor unitário (por peça) + M³ calculado */}
              <div className="flex items-center gap-2 pl-11 flex-wrap">
                {!readOnly ? (
                  <div className="flex items-center gap-1.5 flex-1 min-w-[120px]">
                    <span className="text-[10px] text-gray-400 font-bold whitespace-nowrap">R$/m³</span>
                    <input type="number" value={item.pricePerM3 || ''}
                      onChange={e => updateTimberPrice(item.id, parseFloat(e.target.value) || 0)}
                      placeholder="0,00"
                      className="flex-1 min-w-0 text-sm font-bold border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-green-500" />
                  </div>
                ) : (
                  <span className="text-xs text-gray-400">{fmt(item.pricePerM3)}/m³</span>
                )}
                {qty > 0 && (
                  <span className="text-[10px] text-amber-600 font-bold bg-amber-50 px-2 py-1 rounded-lg whitespace-nowrap">
                    Unit.: {fmt(d.value / qty)}
                  </span>
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
          const productStockWarning = getStockWarning(item.stockItemId, item.qty);
          return (
            <div key={item.id} className={[
              'bg-white border rounded-xl p-3 shadow-sm transition-all space-y-2.5',
              isNew ? 'border-green-400 bg-green-50 animate-pulse'
                : productStockWarning ? 'border-red-300' : 'border-gray-200'
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
                  {productStockWarning && (
                    <p className="text-[10px] text-red-600 font-bold flex items-center gap-1 mt-0.5">
                      ⚠ Estoque insuficiente — disponível: {productStockWarning.disponivel} {productStockWarning.unidade}
                    </p>
                  )}
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
          {stockWarningCount > 0 && (
            <div className="bg-red-500 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1 flex-shrink-0">
              ⚠ {stockWarningCount} sem estoque
            </div>
          )}
        </div>
      )}

      {!readOnly && (
        <button onClick={() => { setAddOpen(true); setSearch(''); setCatBrowsing(null); }}
          className="w-full flex items-center justify-center gap-2 py-4 bg-green-700 text-white rounded-xl text-base font-black hover:bg-green-800 active:scale-95 transition-all shadow-md">
          <Plus className="w-5 h-5" /> Adicionar Item
        </button>
      )}

      {/* ── Modal: adicionar item ── */}
      {addOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center"
          onClick={() => { setAddOpen(false); setCatBrowsing(null); setSearch(''); }}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[90vh] flex flex-col"
            onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-black text-gray-900">
                  {catBrowsing ? TODAS_CATEGORIAS.find(c => c.val === catBrowsing)?.label || 'Adicionar Item' : 'Adicionar Item'}
                </h2>
                <button onClick={() => { setAddOpen(false); setCatBrowsing(null); setSearch(''); }} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 p-4 space-y-4">
              {/* Confirmação rápida — modal continua aberto, comum a todas as categorias */}
              {addedFlash && (
                <div className="bg-green-600 text-white rounded-xl p-3 flex items-center gap-2 animate-pulse">
                  <Check className="w-4 h-4 flex-shrink-0" />
                  <p className="text-xs font-bold truncate">"{addedFlash}" adicionado — pode continuar escolhendo</p>
                </div>
              )}

              {/* Nível 1: grade única de categorias (madeira + produtos), igual ao Catálogo */}
              {!catBrowsing && (
                <div className="grid grid-cols-2 gap-2.5">
                  {TODAS_CATEGORIAS.map(c => (
                    <button key={c.val} onClick={() => setCatBrowsing(c.val)}
                      className={`bg-gradient-to-br ${c.color} rounded-2xl p-4 text-left shadow-sm hover:shadow-md active:scale-95 transition-all`}>
                      <div className="text-3xl mb-1.5">{c.emoji}</div>
                      <p className="text-white font-black text-sm">{c.label}</p>
                      <p className="text-white/70 text-[10px] font-bold">{c.count} ite{c.count !== 1 ? 'ns' : 'm'}</p>
                    </button>
                  ))}
                </div>
              )}

              {/* Botão voltar — categoria escolhida */}
              {catBrowsing && (
                <button onClick={() => { setCatBrowsing(null); setSearch(''); }}
                  className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-800 transition-colors">
                  <ChevronDown className="w-3.5 h-3.5 rotate-90" /> Voltar às categorias
                </button>
              )}

              {/* Categoria: Madeira */}
              {catBrowsing === 'madeira' && (
                <div className="space-y-4">
                  {/* Comprimento aplicado ao próximo item tocado na grade */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Comprimento (aplica ao tocar)</label>
                    <div className="grid grid-cols-4 gap-2">
                      {COMPS.map(c => (
                        <button key={c} onClick={() => setMComp(c)}
                          className={[
                            'py-2.5 rounded-xl text-sm font-black border-2 transition-all',
                            mComp === c ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-gray-200 text-gray-400'
                          ].join(' ')}>
                          {c}m
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Busca */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input value={search} onChange={e => setSearch(e.target.value)}
                      placeholder="Buscar madeira no estoque..."
                      className="w-full pl-9 pr-3 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-amber-500" />
                  </div>

                  {/* Grade do estoque — toca e adiciona direto, sem fechar o modal */}
                  {filteredMadeiraStock.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {filteredMadeiraStock.map(s => {
                        const isLow = (s.quantidadeMinima || 0) > 0 && s.quantidadeAtual <= (s.quantidadeMinima || 0);
                        return (
                          <button key={s.id} onClick={() => addFromMadeiraStock(s)}
                            className="text-left p-2.5 rounded-xl border-2 border-gray-200 bg-white hover:border-amber-400 active:scale-95 transition-all">
                            <p className="text-[11px] font-bold text-gray-700 leading-tight line-clamp-2">{s.descricao}</p>
                            {s.espessura && s.largura && (
                              <p className="text-[9px] text-gray-400 mt-0.5">{s.espessura}×{s.largura}cm</p>
                            )}
                            <p className="text-sm font-black text-green-700 mt-1">
                              {s.precoVenda ? fmt(s.precoVenda) : '—'}
                            </p>
                            <div className="flex items-center justify-between">
                              <p className="text-[8px] text-gray-400">/m³</p>
                              <p className={['text-[9px] font-bold', isLow ? 'text-red-500' : 'text-gray-400'].join(' ')}>
                                {s.quantidadeAtual} disp.
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-center text-gray-400 text-xs py-4">
                      Nenhuma madeira {search ? 'encontrada' : 'cadastrada no estoque ainda'}. {!search && <>Cadastre em <strong>Estoque → Novo Item</strong>, ou adicione com medida customizada abaixo.</>}
                    </p>
                  )}

                  {/* Item avulso — medida customizada, fora do estoque */}
                  <div className="border-t border-gray-100 pt-4 space-y-3">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Ou adicionar com medida customizada</p>

                    <div className="space-y-1">
                      <input value={mDesc} onChange={e => setMDesc(e.target.value)}
                        placeholder="Nome / descrição (opcional) — Ex: Tábua Pinus 30x1,8"
                        className="w-full p-3 border-2 border-gray-200 rounded-xl text-sm font-bold focus:border-amber-500 outline-none" />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Bitola (cm)</label>
                        <input type="number" step="0.1" value={mEsp} onChange={e => setMEsp(e.target.value)}
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

                    {autoMatchedStock && (
                      <div className="bg-purple-50 border border-purple-200 rounded-xl p-2.5 flex items-center gap-2">
                        <Link2 className="w-4 h-4 text-purple-600 flex-shrink-0" />
                        <p className="text-[11px] text-purple-700 font-bold">
                          Vinculado automaticamente a "{autoMatchedStock.descricao}" — vai descontar do estoque ao concluir
                        </p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Qtd de Peças</label>
                        <input type="number" value={mQty} onChange={e => setMQty(e.target.value)}
                          placeholder="0"
                          className="w-full p-3 border-2 border-gray-200 rounded-xl text-center text-lg font-bold focus:border-amber-500 outline-none" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Preço</label>
                          <div className="flex gap-0.5 p-0.5 bg-gray-100 rounded-md">
                            <button type="button" onClick={() => setMPriceMode('m3')}
                              className={['px-1.5 py-0.5 rounded text-[9px] font-bold transition-all',
                                mPriceMode === 'm3' ? 'bg-white text-amber-700 shadow-sm' : 'text-gray-400'].join(' ')}>
                              R$/m³
                            </button>
                            <button type="button" onClick={() => setMPriceMode('peca')}
                              className={['px-1.5 py-0.5 rounded text-[9px] font-bold transition-all',
                                mPriceMode === 'peca' ? 'bg-white text-amber-700 shadow-sm' : 'text-gray-400'].join(' ')}>
                              R$/peça
                            </button>
                          </div>
                        </div>
                        {mPriceMode === 'm3' ? (
                          <input type="number" value={mPreco} onChange={e => setMPreco(e.target.value)}
                            placeholder="0,00"
                            className="w-full p-3 border-2 border-gray-200 rounded-xl text-center text-lg font-bold focus:border-amber-500 outline-none" />
                        ) : (
                          <input type="number" value={mPrecoPeca} onChange={e => setMPrecoPeca(e.target.value)}
                            placeholder="0,00"
                            className="w-full p-3 border-2 border-gray-200 rounded-xl text-center text-lg font-bold focus:border-amber-500 outline-none" />
                        )}
                      </div>
                    </div>

                    {(parseFloat(mEsp) > 0 && parseFloat(mLarg) > 0 && parseInt(mQty) > 0) && (() => {
                      const esp = parseFloat(mEsp), larg = parseFloat(mLarg), qty = parseInt(mQty) || 0;
                      const m3Peca = (esp / 100) * (larg / 100) * mComp;
                      const m3Total = m3Peca * qty;
                      const precoM3 = mPriceMode === 'peca'
                        ? (m3Peca > 0 ? (parseFloat(mPrecoPeca) || 0) / m3Peca : 0)
                        : (parseFloat(mPreco) || 0);
                      const valorPeca = m3Peca * precoM3;
                      const valorTotal = m3Total * precoM3;
                      return (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-1">
                          <p className="text-[10px] text-amber-600 font-bold uppercase text-center">Prévia</p>
                          <div className="grid grid-cols-2 gap-2 text-center">
                            <div>
                              <p className="text-[9px] text-amber-500">Valor da peça</p>
                              <p className="text-sm font-black text-amber-800">{valorPeca > 0 ? fmt(valorPeca) : '—'}</p>
                            </div>
                            <div>
                              <p className="text-[9px] text-amber-500">Total ({qty} peças)</p>
                              <p className="text-sm font-black text-amber-800">{valorTotal > 0 ? fmt(valorTotal) : '—'}</p>
                            </div>
                          </div>
                          <p className="text-[10px] text-amber-600 text-center">
                            {m3Total.toFixed(3)} m³ · {fmt(precoM3)}/m³
                          </p>
                        </div>
                      );
                    })()}

                    <button onClick={confirmAddMadeira}
                      disabled={!mEsp || !mLarg || !mQty}
                      className="w-full py-3.5 bg-amber-600 text-white rounded-xl text-sm font-black hover:bg-amber-700 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                      Adicionar Medida Customizada
                    </button>
                  </div>
                </div>
              )}

              {/* Categorias de produto: Porta / Batente / Outro */}
              {(catBrowsing === 'porta' || catBrowsing === 'batente' || catBrowsing === 'outro') && (
                <div className="space-y-4">
                  {/* Busca */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
                      placeholder="Buscar produto no estoque..."
                      className="w-full pl-9 pr-3 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-500" />
                  </div>

                  {filteredProdutoStock.length > 0 ? (
                    <div className="space-y-1.5 max-h-56 overflow-y-auto">
                      {filteredProdutoStock.map(s => {
                        const isLow = (s.quantidadeMinima || 0) > 0 && s.quantidadeAtual <= (s.quantidadeMinima || 0);
                        return (
                          <button key={s.id} onClick={() => addFromProductStock(s)}
                            className="w-full text-left px-3 py-2.5 hover:bg-blue-50 active:bg-blue-100 border border-gray-100 rounded-xl transition-colors flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="font-bold text-gray-800 text-sm truncate">{s.descricao}</p>
                              <p className={['font-black text-base mt-0.5', isLow ? 'text-red-500' : 'text-green-700'].join(' ')}>
                                {s.precoVenda ? fmt(s.precoVenda) : '—'} <span className="text-[10px] text-gray-400 font-normal">/{s.unidade}</span>
                              </p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className={['font-bold text-xs', isLow ? 'text-red-600' : 'text-gray-500'].join(' ')}>
                                {s.quantidadeAtual} {s.unidade}
                              </p>
                              {isLow && <p className="text-[9px] text-red-500 font-bold">Baixo</p>}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-center text-gray-400 text-xs py-6">Nenhum produto encontrado.</p>
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
