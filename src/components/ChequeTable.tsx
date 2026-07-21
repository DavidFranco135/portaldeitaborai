import React, { useEffect, useRef } from 'react';
import { Cheque, generateCheques, parsePrazos } from '../lib/cheques';
import { RefreshCw } from 'lucide-react';

interface Props {
  cheques: Cheque[];
  onChange: (cheques: Cheque[]) => void;
  total: number;
  paymentTerms: string;
  docDate: string;
  readOnly?: boolean;
  paymentMethod?: 'cheque' | 'dinheiro' | 'boleto';
}

function fmtBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const METHOD_LABELS: Record<string, { title: string; item: string }> = {
  cheque: { title: 'Cheques / Parcelas', item: 'cheque' },
  dinheiro: { title: 'Parcelas em Dinheiro', item: 'parcela' },
  boleto: { title: 'Boletos', item: 'boleto' },
};

export const ChequeTable: React.FC<Props> = ({
  cheques,
  onChange,
  total,
  paymentTerms,
  docDate,
  readOnly,
  paymentMethod = 'cheque',
}) => {
  const { title: label, item: itemLabel } = METHOD_LABELS[paymentMethod] || METHOD_LABELS.cheque;
  const prevTerms = useRef('');
  const prevTotal = useRef(0);

  // Auto-generate when paymentTerms or total changes
  useEffect(() => {
    const prazos = parsePrazos(paymentTerms);
    if (prazos.length === 0) {
      if (cheques.length > 0) onChange([]);
      return;
    }
    // Only regenerate if terms or total changed meaningfully
    if (paymentTerms === prevTerms.current && Math.abs(total - prevTotal.current) < 0.01) return;
    prevTerms.current = paymentTerms;
    prevTotal.current = total;

    const generated = generateCheques(total, paymentTerms, docDate || new Date().toISOString().split('T')[0]);
    onChange(generated);
  }, [paymentTerms, total, docDate]);

  const regenerate = () => {
    const generated = generateCheques(total, paymentTerms, docDate || new Date().toISOString().split('T')[0]);
    onChange(generated);
  };

  const updateCheque = (id: string, field: 'vencimento' | 'valor', val: string) => {
    onChange(cheques.map(c =>
      c.id === id
        ? { ...c, [field]: field === 'valor' ? parseFloat(val) || 0 : val }
        : c
    ));
  };

  const prazos = parsePrazos(paymentTerms);
  const isVista = prazos.length === 0;

  if (isVista) {
    const methodName = paymentMethod === 'boleto' ? 'Boleto' : paymentMethod === 'dinheiro' ? 'Dinheiro' : 'Cheque';
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2 text-xs text-green-700 font-bold">
        Pagamento à vista — {methodName}, sem parcelamento
      </div>
    );
  }

  if (cheques.length === 0) return null;

  const totalCheques = cheques.reduce((s, c) => s + c.valor, 0);
  const diff = Math.abs(total - totalCheques);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h4 className="text-xs font-black text-gray-700 uppercase tracking-wider">
            {label}
          </h4>
          <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
            {cheques.length}x
          </span>
        </div>
        {!readOnly && (
          <button
            onClick={regenerate}
            className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-gray-500 hover:text-green-700 hover:bg-green-50 rounded transition-all"
            title="Recalcular cheques"
          >
            <RefreshCw className="w-3 h-3" /> Recalcular
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-green-700 text-white">
              <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider w-12">Nº</th>
              <th className="px-3 py-2 text-center text-xs font-bold uppercase tracking-wider">Prazo</th>
              <th className="px-3 py-2 text-center text-xs font-bold uppercase tracking-wider">Vencimento</th>
              <th className="px-3 py-2 text-right text-xs font-bold uppercase tracking-wider">Valor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {cheques.map((cheque, i) => (
              <tr key={cheque.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-3 py-2 text-xs font-bold text-gray-500">{String(i + 1).padStart(2, '0')}</td>
                <td className="px-3 py-2 text-center text-xs text-gray-500">{cheque.dias} dias</td>
                <td className="px-3 py-2 text-center">
                  {readOnly ? (
                    <span className="text-sm font-bold">{cheque.vencimento}</span>
                  ) : (
                    <input
                      type="text"
                      value={cheque.vencimento}
                      onChange={e => updateCheque(cheque.id, 'vencimento', e.target.value)}
                      className="w-28 text-center text-sm font-bold border-b border-dashed border-gray-300 bg-transparent focus:border-green-600 outline-none py-0.5"
                      placeholder="dd/MM/yyyy"
                    />
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  {readOnly ? (
                    <span className="text-sm font-bold text-green-700">{fmtBRL(cheque.valor)}</span>
                  ) : (
                    <input
                      type="number"
                      step="0.01"
                      value={cheque.valor || ''}
                      onChange={e => updateCheque(cheque.id, 'valor', e.target.value)}
                      className="w-32 text-right text-sm font-bold border-b border-dashed border-gray-300 bg-transparent focus:border-green-600 outline-none py-0.5 tabular-nums"
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-green-700 text-white font-bold">
              <td colSpan={3} className="px-3 py-2 text-sm">
                Total {cheques.length} {itemLabel}{cheques.length > 1 ? 's' : ''}
                {diff > 0.01 && (
                  <span className="ml-2 text-yellow-300 text-xs">
                    (dif: {fmtBRL(diff)})
                  </span>
                )}
              </td>
              <td className="px-3 py-2 text-right text-sm tabular-nums">
                {fmtBRL(totalCheques)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};
