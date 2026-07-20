import React, { useMemo } from 'react';
import { TimberItem } from '../types';
import { calcDerived, newEmptyItem } from '../lib/calc';
import { Trash2, Plus, ArrowRightLeft } from 'lucide-react';
import { useApp } from '../store/AppContext';

interface Props {
  items: TimberItem[];
  onChange: (items: TimberItem[]) => void;
  readOnly?: boolean;
}

// Which comprimento column to use in m3→qty mode
type CompCol = 'c3' | 'c4' | 'c5' | 'c6';
const COMP_MAP: Record<CompCol, number> = { c3: 3, c4: 4, c5: 5, c6: 6 };

const NUM = 'w-full p-2 bg-transparent text-center focus:bg-green-50 focus:outline-none transition-colors tabular-nums text-sm';

function cn(...c: (string | boolean | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

export const TimberCalculator: React.FC<Props> = ({ items, onChange, readOnly }) => {
  const { state } = useApp();
  const stockOptions = (state.stockItems || []).filter(s => s.categoria === 'madeira');

  const update = (id: string, field: keyof TimberItem, val: any) =>
    onChange(items.map(it => (it.id === id ? { ...it, [field]: val } : it)));

  const toggleMode = (id: string) =>
    onChange(items.map(it =>
      it.id === id
        ? { ...it, calcMode: it.calcMode === 'qty_to_m3' ? 'm3_to_qty' : 'qty_to_m3' }
        : it
    ));

  // When user types M³ in m3_to_qty mode → auto-calculate qty for selected comprimento
  const handleCustomM3Change = (id: string, rawVal: string) => {
    const item = items.find(i => i.id === id);
    if (!item) return;

    const m3 = rawVal === '' ? null : parseFloat(rawVal);

    if (item.calcMode === 'm3_to_qty' && m3 !== null && m3 > 0) {
      // Find active comprimento column (default c3)
      const activeCol = (item as any).__compCol as CompCol || 'c3';
      const comp = COMP_MAP[activeCol];
      const m3PerPiece = (item.espessura / 100) * (item.largura / 100) * comp;
      const qty = m3PerPiece > 0 ? Math.round(m3 / m3PerPiece) : 0;

      // Zero all comprimentos then set the active one
      onChange(items.map(it => it.id === id
        ? { ...it, c3: 0, c4: 0, c5: 0, c6: 0, [activeCol]: qty, customM3: m3 }
        : it
      ));
    } else {
      update(id, 'customM3', m3);
    }
  };

  // Set which comprimento column is "active" for m3→qty mode
  const setCompCol = (id: string, col: CompCol) => {
    const item = items.find(i => i.id === id);
    if (!item) return;

    // Recalculate qty for new col if m3 is set
    const m3 = item.customM3;
    if (item.calcMode === 'm3_to_qty' && m3 && m3 > 0) {
      const comp = COMP_MAP[col];
      const m3PerPiece = (item.espessura / 100) * (item.largura / 100) * comp;
      const qty = m3PerPiece > 0 ? Math.round(m3 / m3PerPiece) : 0;
      onChange(items.map(it => it.id === id
        ? { ...it, c3: 0, c4: 0, c5: 0, c6: 0, [col]: qty, __compCol: col } as any
        : it
      ));
    } else {
      onChange(items.map(it => it.id === id ? { ...it, __compCol: col } as any : it));
    }
  };

  const addItem = () => onChange([...items, newEmptyItem()]);
  const remove = (id: string) => onChange(items.filter(it => it.id !== id));

  const totals = useMemo(() =>
    items.reduce((acc, it) => {
      const d = calcDerived(it);
      acc.m3 += d.finalM3;
      acc.value += d.value;
      acc.qty += d.qtyTotal;
      return acc;
    }, { m3: 0, value: 0, qty: 0 }),
    [items]
  );

  const fmtBRL = (n: number) =>
    n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="space-y-3 max-w-full">
      <div className="overflow-x-auto rounded border border-gray-300 bg-white shadow-sm" style={{ WebkitOverflowScrolling: "touch" }}>
        <table className="w-full border-collapse text-xs" style={{ minWidth: 860 }}>
          <thead>
            <tr className="bg-gray-100 border-b border-gray-300">
              <th rowSpan={2} className="border border-gray-300 px-2 py-1 text-center text-[10px] font-bold uppercase tracking-wider bg-gray-200 w-20">
                Modo
              </th>
              <th rowSpan={2} className="border border-gray-300 px-2 py-1 text-center text-[10px] font-bold uppercase">
                Bitola<br />(cm)
              </th>
              <th rowSpan={2} className="border border-gray-300 px-2 py-1 text-center text-[10px] font-bold uppercase">
                Largura<br />(cm)
              </th>
              <th colSpan={4} className="border border-gray-300 px-2 py-1 text-center text-[10px] font-bold uppercase bg-green-50">
                Comprimento (m) — Qtd Peças
              </th>
              <th rowSpan={2} className="border border-gray-300 px-2 py-1 text-center text-[10px] font-bold uppercase">
                Qtd<br />Total
              </th>
              <th rowSpan={2} className="border border-gray-300 px-2 py-1 text-center text-[10px] font-bold uppercase">
                Metros<br />Lin.
              </th>
              <th rowSpan={2} className="border border-gray-300 px-2 py-1 text-center text-[10px] font-bold uppercase">
                R$/m³
              </th>
              <th rowSpan={2} className="border border-gray-300 px-2 py-1 text-center text-[10px] font-bold uppercase">
                Preço<br />Unit.
              </th>
              <th rowSpan={2} className="border border-gray-300 px-2 py-1 text-center text-[10px] font-bold uppercase bg-green-100">
                M³
              </th>
              <th rowSpan={2} className="border border-gray-300 px-2 py-1 text-center text-[10px] font-bold uppercase bg-yellow-50">
                VALOR
              </th>
              {!readOnly && (
                <th rowSpan={2} className="border border-gray-300 px-1 py-1 text-center text-[9px] font-bold uppercase bg-purple-50 w-16" title="Vincular ao estoque para baixa automática">
                  Estoque
                </th>
              )}
              {!readOnly && <th rowSpan={2} className="w-8 border border-gray-300" />}
            </tr>
            <tr className="bg-green-50">
              {(['3,00', '4,00', '5,00', '6,00'] as const).map(l => (
                <th key={l} className="border border-gray-300 px-2 py-0.5 text-center text-[10px] font-bold">
                  {l}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-200">
            {items.map(item => {
              const d = calcDerived(item);
              const isM3Mode = item.calcMode === 'm3_to_qty';
              const activeCol: CompCol = (item as any).__compCol || 'c3';

              return (
                <tr key={item.id} className="hover:bg-gray-50">
                  {/* Mode toggle */}
                  <td className="border border-gray-300 text-center p-1">
                    {!readOnly && (
                      <button
                        onClick={() => toggleMode(item.id)}
                        title={isM3Mode ? 'Modo: M³ → Qtd' : 'Modo: Qtd → M³'}
                        className={cn(
                          'inline-flex items-center gap-1 px-1.5 py-1 rounded text-[9px] font-bold uppercase tracking-wider transition-all w-full justify-center',
                          isM3Mode ? 'bg-blue-600 text-white' : 'bg-green-700 text-white'
                        )}
                      >
                        <ArrowRightLeft className="w-2.5 h-2.5" />
                        {isM3Mode ? 'M³→QTD' : 'QTD→M³'}
                      </button>
                    )}
                  </td>

                  {/* Bitola */}
                  <td className="border border-gray-300">
                    <input type="number" step="0.1" value={item.espessura || ''}
                      onChange={e => update(item.id, 'espessura', parseFloat(e.target.value) || 0)}
                      disabled={readOnly} className={NUM} placeholder="ex: 1.8" />
                  </td>

                  {/* Largura */}
                  <td className="border border-gray-300">
                    <input type="number" step="0.1" value={item.largura || ''}
                      onChange={e => update(item.id, 'largura', parseFloat(e.target.value) || 0)}
                      disabled={readOnly} className={NUM} placeholder="ex: 30" />
                  </td>

                  {/* C3 C4 C5 C6 */}
                  {(['c3', 'c4', 'c5', 'c6'] as CompCol[]).map(ck => {
                    const isActive = isM3Mode && activeCol === ck;
                    return (
                      <td key={ck}
                        className={cn(
                          'border border-gray-300',
                          isM3Mode ? 'cursor-pointer' : 'bg-green-50/40'
                        )}
                        onClick={() => isM3Mode && !readOnly && setCompCol(item.id, ck)}
                        title={isM3Mode ? `Usar comprimento ${COMP_MAP[ck]}m para calcular qtd` : undefined}
                      >
                        {isM3Mode ? (
                          // In M3 mode: show selector button, not editable
                          <div className={cn(
                            'w-full h-full p-2 text-center text-xs font-bold transition-all select-none',
                            isActive
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-400 hover:bg-blue-100'
                          )}>
                            {isActive ? `✓ ${COMP_MAP[ck]}m` : `${COMP_MAP[ck]}m`}
                          </div>
                        ) : (
                          <input type="number" value={item[ck] || ''}
                            onChange={e => update(item.id, ck, parseInt(e.target.value) || 0)}
                            disabled={readOnly} className={NUM} />
                        )}
                      </td>
                    );
                  })}

                  {/* Qty total */}
                  <td className="border border-gray-300 text-center font-bold text-gray-700 bg-gray-50">
                    {d.qtyTotal || '–'}
                  </td>

                  {/* Linear meters */}
                  <td className="border border-gray-300 text-center text-gray-600">
                    {d.linearMeters.toFixed(3)}
                  </td>

                  {/* Price per M³ */}
                  <td className="border border-gray-300 bg-yellow-50/50">
                    <input type="number" value={item.pricePerM3 || ''}
                      onChange={e => update(item.id, 'pricePerM3', parseFloat(e.target.value) || 0)}
                      disabled={readOnly}
                      className={cn(NUM, 'font-bold text-green-800')}
                      placeholder="R$/m³" />
                  </td>

                  {/* Preço Unitário */}
                  <td className="border border-gray-300 text-center text-gray-700 font-bold tabular-nums text-[11px]">
                    {d.precoUnitario > 0 ? d.precoUnitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}
                  </td>

                  {/* M³ — in m3_to_qty mode this is the INPUT; in qty_to_m3 shows auto */}
                  <td className="border border-gray-300 bg-green-50">
                    {isM3Mode ? (
                      // M³ mode: user types desired M³ here, qty auto-calculates
                      <input
                        type="number" step="0.001"
                        value={item.customM3 !== null && item.customM3 !== undefined ? item.customM3 : ''}
                        placeholder="Digite M³"
                        onChange={e => handleCustomM3Change(item.id, e.target.value)}
                        disabled={readOnly}
                        className={cn(NUM, 'font-bold text-blue-700 placeholder:text-blue-300 placeholder:text-[10px]')}
                      />
                    ) : (
                      // QTD mode: user can override auto M³ or leave blank for auto
                      <input
                        type="number" step="0.0001"
                        value={item.customM3 !== null && item.customM3 !== undefined ? item.customM3 : ''}
                        placeholder={d.m3Auto.toFixed(3)}
                        onChange={e => update(item.id, 'customM3', e.target.value === '' ? null : parseFloat(e.target.value))}
                        disabled={readOnly}
                        className={cn(NUM, 'font-bold text-green-700 placeholder:opacity-40')}
                      />
                    )}
                  </td>

                  {/* Value */}
                  <td className="border border-gray-300 text-right px-2 font-bold text-gray-900 bg-yellow-50/60 tabular-nums">
                    {d.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </td>

                  {!readOnly && (
                    <td className="border border-gray-300 bg-purple-50/30">
                      <select value={(item as any).stockItemId || ''}
                        onChange={e => update(item.id, 'stockItemId' as keyof TimberItem, e.target.value || undefined)}
                        title="Vincular a item do estoque"
                        className="w-full p-1 bg-transparent text-center text-[9px] focus:outline-none focus:bg-purple-50 cursor-pointer">
                        <option value="">—</option>
                        {stockOptions.map(s => (
                          <option key={s.id} value={s.id}>{s.descricao.slice(0, 16)}</option>
                        ))}
                      </select>
                    </td>
                  )}

                  {!readOnly && (
                    <td className="border border-gray-300 text-center p-1">
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
                <td colSpan={15} className="text-center py-8 text-gray-400 italic text-sm border border-gray-300">
                  Nenhuma peça adicionada. Clique em "Adicionar Peça" abaixo.
                </td>
              </tr>
            )}
          </tbody>

          <tfoot>
            <tr className="bg-gray-800 text-white font-bold">
              <td colSpan={6} className="border border-gray-600 px-3 py-2 text-right text-xs uppercase tracking-wider opacity-70">
                Totais →
              </td>
              <td className="border border-gray-600 px-2 py-2 text-center tabular-nums">
                {totals.qty}
              </td>
              <td colSpan={3} className="border border-gray-600" />
              <td className="border border-gray-600 px-2 py-2 text-center text-green-300 tabular-nums font-bold">
                {totals.m3.toFixed(3)}
              </td>
              <td className="border border-gray-600 px-2 py-2 text-right tabular-nums text-yellow-300 font-bold">
                {totals.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </td>
              {!readOnly && <td className="border border-gray-600" />}
            </tr>
          </tfoot>
        </table>
      </div>

      {!readOnly && (
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={addItem}
            className="flex items-center gap-2 px-4 py-2 border border-green-700 text-green-800 rounded-lg text-xs font-bold hover:bg-green-50 transition-colors">
            <Plus className="w-4 h-4" /> Adicionar Peça
          </button>

          {state.settings.priceRefs.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider">Atalhos:</span>
              {state.settings.priceRefs.map(ref => (
                <button key={ref.id}
                  onClick={() => {
                    const ni = newEmptyItem();
                    onChange([...items, { ...ni, espessura: ref.espessura, largura: ref.largura, pricePerM3: ref.price }]);
                  }}
                  className="px-2 py-1 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded text-[10px] font-medium transition-colors">
                  {ref.desc}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Mode legend */}
      {!readOnly && (
        <div className="flex items-center gap-4 text-[10px] text-gray-400 px-1">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-green-700 inline-block" />
            <strong className="text-gray-600">QTD→M³:</strong> informe qtd de peças → calcula M³ automaticamente
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-blue-600 inline-block" />
            <strong className="text-gray-600">M³→QTD:</strong> clique no comprimento desejado → digite M³ → calcula qtd
          </span>
        </div>
      )}
    </div>
  );
};
