import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, X, ChevronRight } from 'lucide-react';
import { TimberItem } from '../types';
import { calcDerived } from '../lib/calc';
import { ValidationWarning } from '../lib/importExcel';

interface Props {
  warnings: ValidationWarning[];
  items: TimberItem[];           // items with serraria M³ (customM3)
  onConfirm: (items: TimberItem[], useCalc: boolean) => void;
  onCancel: () => void;
  freight?: number;
  commissionValue?: number;
  totalMadeira?: number;
  totalAPagar?: number;
}

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtM3(n: number) {
  return n.toFixed(3) + ' m³';
}

export const ImportReview: React.FC<Props> = ({
  warnings, items, onConfirm, onCancel,
  freight = 0, commissionValue = 0, totalMadeira, totalAPagar,
}) => {
  const [useCalc, setUseCalc] = useState<boolean | null>(null);

  // Serraria values (customM3 set from Excel)
  const serrM3   = items.reduce((s, i) => s + (i.customM3 ?? 0), 0);
  const serrSub  = items.reduce((s, i) => s + (i.customM3 ?? 0) * i.pricePerM3, 0);
  // Comissão calculada sobre (subtotal − frete)
  const serrTot  = serrSub - freight - commissionValue;

  // Calculated values (auto from dimensions)
  const calcItems = items.map(i => ({ ...i, customM3: null }));
  const calcM3   = calcItems.reduce((s, i) => s + calcDerived(i).finalM3, 0);
  const calcSub  = calcItems.reduce((s, i) => s + calcDerived(i).value, 0);
  // Comissão sobre (subtotal − frete)
  const calcTot  = calcSub - freight - commissionValue;

  const diffM3  = Math.abs(serrM3 - calcM3);
  const diffSub = Math.abs(serrSub - calcSub);
  const diffTot = Math.abs(serrTot - calcTot);

  const Row: React.FC<{
    label: string;
    serr: string;
    calc: string;
    diff: string;
    hasDiff: boolean;
  }> = ({ label, serr, calc, diff, hasDiff }) => (
    <tr className={hasDiff ? 'bg-amber-50' : 'bg-white'}>
      <td className="px-3 py-2.5 text-xs font-bold text-gray-600">{label}</td>
      <td className="px-3 py-2.5 text-xs text-center font-mono text-gray-700">{serr}</td>
      <td className="px-3 py-2.5 text-xs text-center font-mono text-green-700 font-bold">{calc}</td>
      <td className="px-3 py-2.5 text-xs text-center">
        {hasDiff ? (
          <span className="inline-flex items-center gap-1 text-amber-700 font-bold">
            <AlertCircle className="w-3 h-3" /> {diff}
          </span>
        ) : (
          <span className="text-green-600 font-bold flex items-center justify-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> OK
          </span>
        )}
      </td>
    </tr>
  );

  // Per-item comparison
  const itemRows = items.map((item, i) => {
    const serrM3i = item.customM3 ?? 0;
    const calcM3i = calcDerived({ ...item, customM3: null }).finalM3;
    const diff = Math.abs(serrM3i - calcM3i);
    const qty = item.c3 || item.c4 || item.c5 || item.c6;
    const comp = item.c3 ? 3 : item.c4 ? 4 : item.c5 ? 5 : 6;
    return { item, serrM3i, calcM3i, diff, hasDiff: diff > 0.0001, qty, comp };
  });

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-4">

        {/* Header */}
        <div className="bg-amber-500 px-5 py-4 rounded-t-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-white flex-shrink-0" />
            <div>
              <h2 className="font-black text-white text-base">Divergência encontrada!</h2>
              <p className="text-amber-100 text-xs">
                {warnings.length} diferença{warnings.length > 1 ? 's' : ''} entre os cálculos da serraria e do sistema
              </p>
            </div>
          </div>
          <button onClick={onCancel} className="p-1.5 text-white hover:bg-amber-600 rounded-lg transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">

          {/* Summary comparison table */}
          <div>
            <p className="text-xs font-black text-gray-500 uppercase tracking-wider mb-2">Comparativo de Totais</p>
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100 text-[10px] font-black uppercase tracking-wider text-gray-500">
                    <th className="px-3 py-2 text-left"></th>
                    <th className="px-3 py-2 text-center">🏭 Serraria</th>
                    <th className="px-3 py-2 text-center">🖥 Sistema</th>
                    <th className="px-3 py-2 text-center">Diferença</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <Row
                    label="Total M³"
                    serr={fmtM3(serrM3)}
                    calc={fmtM3(calcM3)}
                    diff={fmtM3(diffM3)}
                    hasDiff={diffM3 > 0.0001}
                  />
                  <Row
                    label="Subtotal Madeira"
                    serr={fmt(serrSub)}
                    calc={fmt(calcSub)}
                    diff={fmt(diffSub)}
                    hasDiff={diffSub > 0.50}
                  />
                  <Row
                    label="– Frete"
                    serr={fmt(freight)}
                    calc={fmt(freight)}
                    diff="—"
                    hasDiff={false}
                  />
                  <Row
                    label="– Comissão"
                    serr={fmt(commissionValue)}
                    calc={fmt(commissionValue)}
                    diff="—"
                    hasDiff={false}
                  />
                  <tr className="bg-gray-800 text-white font-bold">
                    <td className="px-3 py-2.5 text-xs">Total a Pagar</td>
                    <td className="px-3 py-2.5 text-xs text-center font-mono">{fmt(serrTot)}</td>
                    <td className="px-3 py-2.5 text-xs text-center font-mono text-green-300">{fmt(calcTot)}</td>
                    <td className="px-3 py-2.5 text-xs text-center">
                      {diffTot > 1 ? (
                        <span className="text-amber-300 font-bold">{fmt(diffTot)}</span>
                      ) : (
                        <span className="text-green-300">✓ OK</span>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Per-item breakdown if M3 differs */}
          {itemRows.some(r => r.hasDiff) && (
            <div>
              <p className="text-xs font-black text-gray-500 uppercase tracking-wider mb-2">Detalhamento por Item</p>
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-100 text-[10px] font-black uppercase tracking-wider text-gray-500">
                      <th className="px-3 py-2 text-left">Peça</th>
                      <th className="px-3 py-2 text-center">Qtd</th>
                      <th className="px-3 py-2 text-center">M³ Serraria</th>
                      <th className="px-3 py-2 text-center">M³ Sistema</th>
                      <th className="px-3 py-2 text-center">Dif.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {itemRows.map(({ item, serrM3i, calcM3i, diff, hasDiff, qty, comp }, i) => (
                      <tr key={i} className={hasDiff ? 'bg-amber-50' : 'bg-white'}>
                        <td className="px-3 py-2 font-bold text-gray-700">
                          {item.espessura}×{item.largura}cm / {comp}m
                        </td>
                        <td className="px-3 py-2 text-center text-gray-600">{qty}</td>
                        <td className="px-3 py-2 text-center font-mono text-gray-700">{serrM3i.toFixed(3)}</td>
                        <td className="px-3 py-2 text-center font-mono text-green-700 font-bold">{calcM3i.toFixed(3)}</td>
                        <td className="px-3 py-2 text-center">
                          {hasDiff
                            ? <span className="text-amber-600 font-bold">{diff.toFixed(3)}</span>
                            : <span className="text-green-500">✓</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Choice */}
          <div>
            <p className="text-xs font-black text-gray-500 uppercase tracking-wider mb-3">
              Qual M³ usar no romaneio?
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setUseCalc(false)}
                className={[
                  'p-4 rounded-xl border-2 text-left transition-all',
                  useCalc === false
                    ? 'border-amber-500 bg-amber-50'
                    : 'border-gray-200 bg-white hover:border-amber-300'
                ].join(' ')}
              >
                <p className="text-sm font-black text-gray-800">🏭 Valores da Serraria</p>
                <p className="text-xs text-gray-500 mt-0.5">Usa o M³ que eles mandaram, mesmo com divergência</p>
                <p className="text-sm font-bold text-amber-700 mt-2">{fmtM3(serrM3)} · {fmt(serrSub)}</p>
              </button>
              <button
                onClick={() => setUseCalc(true)}
                className={[
                  'p-4 rounded-xl border-2 text-left transition-all',
                  useCalc === true
                    ? 'border-green-600 bg-green-50'
                    : 'border-gray-200 bg-white hover:border-green-400'
                ].join(' ')}
              >
                <p className="text-sm font-black text-gray-800">🖥 Recalculado pelo Sistema</p>
                <p className="text-xs text-gray-500 mt-0.5">Recalcula o M³ com base nas dimensões e quantidades</p>
                <p className="text-sm font-bold text-green-700 mt-2">{fmtM3(calcM3)} · {fmt(calcSub)}</p>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
          <button onClick={onCancel}
            className="px-4 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-sm font-bold hover:bg-gray-200 transition-all">
            Cancelar
          </button>
          <button
            onClick={() => useCalc !== null && onConfirm(useCalc ? calcItems : items, useCalc)}
            disabled={useCalc === null}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-700 text-white rounded-xl text-sm font-bold hover:bg-green-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <ChevronRight className="w-4 h-4" />
            {useCalc === null ? 'Escolha uma opção acima' : `Importar com valores ${useCalc ? 'do sistema' : 'da serraria'}`}
          </button>
        </div>
      </div>
    </div>
  );
};
