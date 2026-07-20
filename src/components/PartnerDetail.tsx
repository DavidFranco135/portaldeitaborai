import React from 'react';
import { Link } from 'react-router-dom';
import { X, Users, CheckCircle2, Clock, Truck, Calendar, Printer } from 'lucide-react';
import { Document } from '../types';
import { motion } from 'motion/react';

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

interface Props {
  partnerName: string;
  docs: Document[];  // all romaneios with this partnerName
  onClose: () => void;
  onPrint?: () => void;
}

export const PartnerDetail: React.FC<Props> = ({ partnerName, docs, onClose, onPrint }) => {
  const sorted = [...docs].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const totalShare = docs.reduce((s, d) => s + (d.partnerShareValue || 0), 0);
  const totalPaid = docs.filter(d => d.partnerPaid).reduce((s, d) => s + (d.partnerShareValue || 0), 0);
  const totalPending = totalShare - totalPaid;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 pt-12 overflow-y-auto"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden mb-8"
      >
        {/* Header */}
        <div className="bg-purple-700 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-black text-white text-lg">{partnerName}</h2>
              <p className="text-purple-200 text-xs">Vendedor Parceiro — Extrato de Comissão</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-purple-200 hover:text-white hover:bg-purple-600 rounded-lg transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100">
          <div className="p-4 text-center">
            <p className="text-lg font-black text-gray-900">{fmt(totalShare)}</p>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Gerado</p>
          </div>
          <div className="p-4 text-center bg-green-50">
            <p className="text-lg font-black text-green-700">{fmt(totalPaid)}</p>
            <p className="text-[10px] font-bold text-green-500 uppercase tracking-wider">Já Repassado</p>
          </div>
          <div className="p-4 text-center bg-amber-50">
            <p className="text-lg font-black text-amber-700">{fmt(totalPending)}</p>
            <p className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">A Repassar</p>
          </div>
        </div>

        {/* List */}
        {sorted.length === 0 ? (
          <div className="p-12 text-center text-gray-400 italic text-sm">
            Nenhum romaneio encontrado para este parceiro.
          </div>
        ) : (
          <div className="divide-y divide-gray-100 max-h-[55vh] overflow-y-auto">
            {sorted.map(doc => (
              <Link
                key={doc.id}
                to={`/romaneios/${doc.id}`}
                onClick={onClose}
                className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={[
                    'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0',
                    doc.partnerPaid ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'
                  ].join(' ')}>
                    <Truck className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-800 truncate">{doc.clientName || '—'}</p>
                    <p className="text-[10px] text-gray-400 flex items-center gap-1.5">
                      <span>Romaneio Nº {doc.number}</span>
                      <Calendar className="w-2.5 h-2.5" />
                      {doc.date ? new Date(doc.date + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}
                    </p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={['font-bold text-sm', doc.partnerPaid ? 'text-green-600' : 'text-amber-600'].join(' ')}>
                    {fmt(doc.partnerShareValue || 0)}
                  </p>
                  <p className="text-[10px] flex items-center justify-end gap-1">
                    {doc.partnerPaid
                      ? <><CheckCircle2 className="w-2.5 h-2.5 text-green-500" /> <span className="text-green-500">Repassado</span></>
                      : <><Clock className="w-2.5 h-2.5 text-amber-500" /> <span className="text-amber-500">Pendente</span></>}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Footer */}
        {onPrint && (
          <div className="px-5 py-3 border-t border-gray-100">
            <button onClick={onPrint}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-purple-50 text-purple-700 rounded-lg text-sm font-bold hover:bg-purple-100 transition-all">
              <Printer className="w-4 h-4" /> Imprimir Relatório do Parceiro
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};
