import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import { StockItem } from '../types';
import {
  Search, ArrowLeft, ShoppingCart, X, Package, FileText, AlertTriangle,
  LayoutGrid,
} from 'lucide-react';

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const CATEGORIAS = [
  { val: 'madeira', label: 'Madeira', emoji: '🪵', color: 'from-amber-500 to-amber-600' },
  { val: 'porta', label: 'Portas', emoji: '🚪', color: 'from-blue-500 to-blue-600' },
  { val: 'batente', label: 'Batentes', emoji: '🖼', color: 'from-purple-500 to-purple-600' },
  { val: 'outro', label: 'Outros', emoji: '📦', color: 'from-gray-500 to-gray-600' },
] as const;

/**
 * Catálogo — navegação visual do estoque, estilo PDV de loja física:
 * primeiro escolhe a categoria (grade grande, tipo "pastas"), depois vê
 * os produtos daquela categoria também em grade, com preço e estoque.
 * Toca no produto pra vender direto (nova Nota de Entrega ou Pedido).
 */
export const Catalogo: React.FC = () => {
  const { state } = useApp();
  const navigate = useNavigate();
  const items = state.stockItems || [];

  const [categoriaAberta, setCategoriaAberta] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [venderItem, setVenderItem] = useState<StockItem | null>(null);

  const contagemPorCategoria = useMemo(() => {
    const map: Record<string, { count: number; low: number }> = {};
    for (const c of CATEGORIAS) map[c.val] = { count: 0, low: 0 };
    for (const it of items) {
      if (!map[it.categoria]) map[it.categoria] = { count: 0, low: 0 };
      map[it.categoria].count++;
      if ((it.quantidadeMinima || 0) > 0 && it.quantidadeAtual <= (it.quantidadeMinima || 0)) {
        map[it.categoria].low++;
      }
    }
    return map;
  }, [items]);

  // Busca global — se tiver texto, ignora a categoria e busca em tudo
  const buscaAtiva = search.trim().length > 0;

  const itensExibidos = useMemo(() => {
    if (buscaAtiva) {
      return items.filter(it => it.descricao.toLowerCase().includes(search.toLowerCase()));
    }
    if (categoriaAberta) {
      return items.filter(it => it.categoria === categoriaAberta);
    }
    return [];
  }, [items, search, categoriaAberta, buscaAtiva]);

  const navigateToSell = (destino: 'notaentrega' | 'pedido') => {
    if (!venderItem) return;
    const rota = destino === 'notaentrega' ? '/notas-entrega/novo' : '/pedidos/novo';
    navigate(`${rota}?addStock=${venderItem.id}`);
    setVenderItem(null);
  };

  const catInfo = categoriaAberta ? CATEGORIAS.find(c => c.val === categoriaAberta) : null;

  return (
    <div className="space-y-5 pb-24 md:pb-0">
      <div className="flex items-center gap-3">
        {(categoriaAberta || buscaAtiva) && !buscaAtiva && (
          <button onClick={() => setCategoriaAberta(null)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0">
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </button>
        )}
        <div>
          <h1 className="text-2xl font-black text-green-800 flex items-center gap-2">
            <LayoutGrid className="w-6 h-6" />
            {catInfo && !buscaAtiva ? `${catInfo.emoji} ${catInfo.label}` : 'Catálogo'}
          </h1>
          <p className="text-gray-500 text-sm">Navegue pelo estoque e venda direto daqui</p>
        </div>
      </div>

      {/* Busca global */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar produto em todo o catálogo..."
          className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl outline-none focus:border-green-600 shadow-sm text-sm" />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Nível 1: grade de categorias (só quando não tem busca nem categoria aberta) */}
      {!buscaAtiva && !categoriaAberta && (
        <div className="grid grid-cols-2 gap-3">
          {CATEGORIAS.map(c => {
            const info = contagemPorCategoria[c.val] || { count: 0, low: 0 };
            return (
              <button key={c.val} onClick={() => setCategoriaAberta(c.val)}
                className={`relative bg-gradient-to-br ${c.color} rounded-2xl p-6 shadow-md hover:shadow-lg active:scale-95 transition-all text-left overflow-hidden`}>
                <div className="text-5xl mb-3">{c.emoji}</div>
                <p className="text-white font-black text-lg">{c.label}</p>
                <p className="text-white/80 text-xs font-bold mt-0.5">
                  {info.count} ite{info.count !== 1 ? 'ns' : 'm'}
                </p>
                {info.low > 0 && (
                  <div className="absolute top-3 right-3 bg-red-500 text-white text-[10px] font-black px-2 py-1 rounded-full flex items-center gap-1">
                    <AlertTriangle className="w-2.5 h-2.5" /> {info.low}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Nível 2: grade de produtos (categoria aberta OU busca ativa) */}
      {(categoriaAberta || buscaAtiva) && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {itensExibidos.map(item => {
            const isLow = (item.quantidadeMinima || 0) > 0 && item.quantidadeAtual <= (item.quantidadeMinima || 0);
            const cat = CATEGORIAS.find(c => c.val === item.categoria);
            return (
              <button key={item.id} onClick={() => setVenderItem(item)}
                className={[
                  'bg-white border-2 rounded-2xl p-3 text-left shadow-sm hover:shadow-md active:scale-95 transition-all flex flex-col',
                  isLow ? 'border-red-200' : 'border-gray-100'
                ].join(' ')}>
                <div className="text-2xl mb-1.5">{cat?.emoji || '📦'}</div>
                <p className="font-bold text-gray-800 text-xs leading-tight line-clamp-2 flex-1">{item.descricao}</p>
                <p className="font-black text-green-700 text-sm mt-2">
                  {item.precoVenda ? fmt(item.precoVenda) : '—'}
                </p>
                <div className="flex items-center justify-between mt-1">
                  <span className={['text-[10px] font-bold', isLow ? 'text-red-600' : 'text-gray-400'].join(' ')}>
                    {item.quantidadeAtual} {item.unidade}
                  </span>
                  {isLow && <AlertTriangle className="w-3 h-3 text-red-500" />}
                </div>
              </button>
            );
          })}

          {itensExibidos.length === 0 && (
            <div className="col-span-full text-center py-16 bg-white border border-dashed border-gray-200 rounded-xl">
              <Package className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-400 italic text-sm">Nenhum produto encontrado.</p>
            </div>
          )}
        </div>
      )}

      {/* Vender — mesma ação da tela de Estoque */}
      {venderItem && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center"
          onClick={() => setVenderItem(null)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-sm p-5 space-y-3"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-black text-gray-900">Adicionar a...</h2>
                <p className="text-xs text-gray-500 truncate">{venderItem.descricao}</p>
                <p className="text-sm font-black text-green-700 mt-0.5">
                  {venderItem.precoVenda ? fmt(venderItem.precoVenda) : '—'}
                  <span className="text-[10px] text-gray-400 font-normal"> /{venderItem.unidade}</span>
                </p>
              </div>
              <button onClick={() => setVenderItem(null)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg flex-shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>
            <button onClick={() => navigateToSell('notaentrega')}
              className="w-full flex items-center gap-3 p-3.5 bg-purple-50 hover:bg-purple-100 border-2 border-purple-200 rounded-xl transition-all text-left">
              <div className="w-10 h-10 bg-purple-600 text-white rounded-lg flex items-center justify-center flex-shrink-0">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-purple-800 text-sm">Nova Nota de Entrega</p>
                <p className="text-[11px] text-purple-500">Confirmação de itens entregues</p>
              </div>
            </button>
            <button onClick={() => navigateToSell('pedido')}
              className="w-full flex items-center gap-3 p-3.5 bg-amber-50 hover:bg-amber-100 border-2 border-amber-200 rounded-xl transition-all text-left">
              <div className="w-10 h-10 bg-amber-500 text-white rounded-lg flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-amber-800 text-sm">Novo Pedido / Orçamento</p>
                <p className="text-[11px] text-amber-500">Ordem de compra ou orçamento</p>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
