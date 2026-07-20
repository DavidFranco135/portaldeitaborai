import React, { useMemo } from 'react';
import { ProductItem } from '../types';
import { Trash2, Plus, Link2 } from 'lucide-react';
import { useApp } from '../store/AppContext';

interface Props {
  items: ProductItem[];
  onChange: (items: ProductItem[]) => void;
  readOnly?: boolean;
}

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function newItem(): ProductItem {
  return {
    id: Math.random().toString(36).slice(2, 9),
    qty: 0,
    unit: 'un',
    desc: '',
    priceUnit: 0,
  };
}

const UNITS = ['un', 'pc', 'par', 'm²', 'm³', 'm', 'cx', 'kg', 'jg', 'vb'];

const INP = 'w-full p-2 bg-transparent text-center focus:bg-green-50 focus:outline-none transition-colors tabular-nums text-sm';

export const ProductCalculator: React.FC<Props> = ({ items, onChange, readOnly }) => {
  const { state } = useApp();
  const stockOptions = (state.stockItems || []).filter(s => s.categoria === 'porta' || s.categoria === 'batente' || s.categoria === 'outro');

  const update = (id: string, field: keyof ProductItem, val: any) =>
    onChange(items.map(it => it.id === id ? { ...it, [field]: val } : it));

  const remove = (id: string) => onChange(items.filter(it => it.id !== id));

  const total = useMemo(() =>
    items.reduce((s, it) => s + it.qty * it.priceUnit, 0),
    [items]
  );

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded border border-gray-300 bg-white shadow-sm" style={{ WebkitOverflowScrolling: 'touch' }}>
        <table className="w-full border-collapse text-xs" style={{ minWidth: 700 }}>
          <thead>
            <tr className="bg-green-700 text-white">
              <th className="border border-green-600 px-3 py-2 text-center font-bold text-[11px] uppercase w-20">Qtd</th>
              <th className="border border-green-600 px-3 py-2 text-center font-bold text-[11px] uppercase w-20">Unid.</th>
              <th className="border border-green-600 px-3 py-2 text-left font-bold text-[11px] uppercase">Descrição do Produto</th>
              {!readOnly && (
                <th className="border border-green-600 px-2 py-2 text-center font-bold text-[11px] uppercase w-16" title="Vincular ao estoque para baixa automática">
                  <Link2 className="w-3.5 h-3.5 mx-auto" />
                </th>
              )}
              <th className="border border-green-600 px-3 py-2 text-center font-bold text-[11px] uppercase w-32">V. Unit (R$)</th>
              <th className="border border-green-600 px-3 py-2 text-right font-bold text-[11px] uppercase bg-amber-600 w-36">TOTAL</th>
              {!readOnly && <th className="w-8 border border-green-600" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((item, i) => {
              const lineTotal = item.qty * item.priceUnit;
              return (
                <tr key={item.id} className={i % 2 === 0 ? 'bg-white hover:bg-green-50/20' : 'bg-gray-50/50 hover:bg-green-50/20'}>
                  {/* Qty */}
                  <td className="border border-gray-200">
                    <input type="number" value={item.qty || ''}
                      onChange={e => update(item.id, 'qty', parseFloat(e.target.value) || 0)}
                      disabled={readOnly} className={INP} placeholder="0" />
                  </td>
                  {/* Unit */}
                  <td className="border border-gray-200">
                    {readOnly ? (
                      <span className="block text-center text-sm py-2">{item.unit}</span>
                    ) : (
                      <select value={item.unit}
                        onChange={e => update(item.id, 'unit', e.target.value)}
                        className="w-full p-2 bg-transparent text-center text-sm focus:outline-none focus:bg-green-50 cursor-pointer">
                        {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    )}
                  </td>
                  {/* Description */}
                  <td className="border border-gray-200">
                    <input type="text" value={item.desc}
                      onChange={e => update(item.id, 'desc', e.target.value)}
                      disabled={readOnly}
                      placeholder="Ex: Porta Mista 15 Almofadas 2,10x80..."
                      className="w-full p-2 bg-transparent focus:bg-green-50 focus:outline-none text-sm transition-colors min-w-0" />
                  </td>
                  {/* Stock link */}
                  {!readOnly && (
                    <td className="border border-gray-200 bg-purple-50/30">
                      <select value={item.stockItemId || ''}
                        onChange={e => update(item.id, 'stockItemId', e.target.value || undefined)}
                        title="Vincular a item do estoque"
                        className="w-full p-1.5 bg-transparent text-center text-[10px] focus:outline-none focus:bg-purple-50 cursor-pointer">
                        <option value="">—</option>
                        {stockOptions.map(s => (
                          <option key={s.id} value={s.id}>{s.descricao.slice(0, 20)}</option>
                        ))}
                      </select>
                    </td>
                  )}
                  {/* Price unit */}
                  <td className="border border-gray-200 bg-yellow-50/40">
                    <input type="number" step="0.01" value={item.priceUnit || ''}
                      onChange={e => update(item.id, 'priceUnit', parseFloat(e.target.value) || 0)}
                      disabled={readOnly}
                      className={INP + ' font-bold text-green-800'}
                      placeholder="0,00" />
                  </td>
                  {/* Total */}
                  <td className="border border-gray-200 text-right px-3 font-bold text-gray-900 bg-yellow-50/60 tabular-nums">
                    {fmt(lineTotal)}
                  </td>
                  {!readOnly && (
                    <td className="border border-gray-200 text-center p-1">
                      <button onClick={() => remove(item.id)}
                        className="p-1 text-gray-400 hover:text-red-600 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-8 text-gray-400 italic text-sm border border-gray-200">
                  Nenhum item adicionado. Clique em "Adicionar Item" abaixo.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="bg-gray-800 text-white font-bold">
              <td colSpan={readOnly ? 3 : 4} className="border border-gray-600 px-3 py-2 text-right text-xs uppercase tracking-wider opacity-70">
                Total Geral →
              </td>
              <td className="border border-gray-600 px-3 py-2 text-right tabular-nums text-yellow-300 text-sm">
                {fmt(total)}
              </td>
              {!readOnly && <td className="border border-gray-600" />}
            </tr>
          </tfoot>
        </table>
      </div>

      {!readOnly && (
        <button onClick={() => onChange([...items, newItem()])}
          className="flex items-center gap-2 px-4 py-2 border border-green-700 text-green-800 rounded-lg text-xs font-bold hover:bg-green-50 transition-colors">
          <Plus className="w-4 h-4" /> Adicionar Item
        </button>
      )}
    </div>
  );
};
