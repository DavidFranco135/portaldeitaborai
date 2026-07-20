import React, { useState, useMemo } from 'react';
import {
  Plus, Trash2, Banknote, CreditCard, Smartphone, Building2, FileText,
  CheckCircle2, Circle, Wallet, Users,
} from 'lucide-react';

interface Payment {
  id: string;
  date: string;
  valor: number;
  method: 'dinheiro' | 'cheque' | 'pix' | 'deposito' | 'cartao' | 'outro';
  notes?: string;
}

interface Props {
  total: number;
  payments: Payment[];
  onChangePayments: (payments: Payment[]) => void;
  commission: number;
  myShareValue?: number;
  commissionPaid: boolean;
  onChangeCommissionPaid: (paid: boolean) => void | Promise<void>;
  partnerName?: string;
  partnerShareValue?: number;
  partnerPaid: boolean;
  onChangePartnerPaid: (paid: boolean) => void | Promise<void>;
}

const METHOD_INFO: Record<Payment['method'], { label: string; icon: any; color: string; bg: string }> = {
  dinheiro: { label: 'Dinheiro', icon: Banknote, color: 'text-green-700', bg: 'bg-green-50' },
  cheque: { label: 'Cheque', icon: FileText, color: 'text-blue-700', bg: 'bg-blue-50' },
  pix: { label: 'PIX', icon: Smartphone, color: 'text-teal-700', bg: 'bg-teal-50' },
  deposito: { label: 'Depósito', icon: Building2, color: 'text-purple-700', bg: 'bg-purple-50' },
  cartao: { label: 'Cartão', icon: CreditCard, color: 'text-amber-700', bg: 'bg-amber-50' },
  outro: { label: 'Outro', icon: Wallet, color: 'text-gray-700', bg: 'bg-gray-50' },
};

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function newPayment(): Payment {
  return {
    id: Math.random().toString(36).slice(2, 9),
    date: new Date().toISOString().split('T')[0],
    valor: 0,
    method: 'pix',
  };
}

export const PaymentTracker: React.FC<Props> = ({
  total, payments, onChangePayments,
  commission, myShareValue, commissionPaid, onChangeCommissionPaid,
  partnerName, partnerShareValue, partnerPaid, onChangePartnerPaid,
}) => {
  const [showForm, setShowForm] = useState(false);
  const [savingCommission, setSavingCommission] = useState(false);
  const [savingPartner, setSavingPartner] = useState(false);

  const totalPaid = useMemo(() => payments.reduce((s, p) => s + p.valor, 0), [payments]);
  const remaining = total - totalPaid;
  const isFullyPaid = remaining <= 0.01;
  const pct = total > 0 ? Math.min(100, (totalPaid / total) * 100) : 0;

  const addPayment = () => {
    onChangePayments([...payments, newPayment()]);
    setShowForm(true);
  };

  const quitarPagamento = () => {
    if (remaining <= 0.01) return;
    if (!confirm(`Confirma quitação do valor restante de ${fmt(remaining)}?`)) return;
    onChangePayments([
      ...payments,
      {
        id: Math.random().toString(36).slice(2, 9),
        date: new Date().toISOString().split('T')[0],
        valor: Math.round(remaining * 100) / 100,
        method: 'dinheiro',
        notes: 'Quitação total',
      },
    ]);
  };

  const updatePayment = (id: string, patch: Partial<Payment>) =>
    onChangePayments(payments.map(p => p.id === id ? { ...p, ...patch } : p));

  const removePayment = (id: string) =>
    onChangePayments(payments.filter(p => p.id !== id));

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Status de Pagamento</p>
            <p className={[
              'text-lg font-black',
              isFullyPaid ? 'text-green-700' : 'text-amber-600'
            ].join(' ')}>
              {isFullyPaid ? '✓ Quitado' : `Falta ${fmt(remaining)}`}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400">Recebido</p>
            <p className="text-base font-bold text-gray-800">{fmt(totalPaid)} <span className="text-gray-400 font-normal">/ {fmt(total)}</span></p>
          </div>
        </div>

        {!isFullyPaid && total > 0 && (
          <button onClick={quitarPagamento}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-green-700 text-white rounded-lg text-sm font-bold hover:bg-green-800 active:scale-95 transition-all">
            <CheckCircle2 className="w-4 h-4" /> Quitar Pagamento ({fmt(remaining)})
          </button>
        )}

        {/* Progress bar visual */}
        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={[
              'h-full rounded-full transition-all duration-300',
              isFullyPaid ? 'bg-green-600' : 'bg-amber-500'
            ].join(' ')}
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Payments list */}
        {payments.length > 0 && (
          <div className="space-y-2 pt-1">
            {payments.map(p => {
              const info = METHOD_INFO[p.method];
              const Icon = info.icon;
              return (
                <div key={p.id} className="bg-gray-50 rounded-lg p-2 space-y-2">
                  {/* Row 1: icon + method + delete */}
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 ${info.bg} ${info.color} rounded-lg flex items-center justify-center flex-shrink-0`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <select
                      value={p.method}
                      onChange={e => updatePayment(p.id, { method: e.target.value as Payment['method'] })}
                      className="flex-1 text-xs font-bold border border-gray-200 rounded-lg px-2 py-1.5 bg-white outline-none focus:border-green-600"
                    >
                      {Object.entries(METHOD_INFO).map(([key, v]) => (
                        <option key={key} value={key}>{v.label}</option>
                      ))}
                    </select>
                    <button onClick={() => removePayment(p.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {/* Row 2: date + valor — valor gets much more room */}
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={p.date}
                      onChange={e => updatePayment(p.id, { date: e.target.value })}
                      className="w-[130px] flex-shrink-0 text-xs border border-gray-200 rounded-lg px-2 py-2 outline-none focus:border-green-600"
                    />
                    <input
                      type="number"
                      step="0.01"
                      inputMode="decimal"
                      value={p.valor || ''}
                      onChange={e => updatePayment(p.id, { valor: parseFloat(e.target.value) || 0 })}
                      placeholder="R$ 0,00"
                      className="flex-1 min-w-0 text-base font-bold text-right border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-green-600"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <button onClick={addPayment}
          className="w-full flex items-center justify-center gap-1.5 py-2 border-2 border-dashed border-gray-200 text-gray-500 hover:border-green-300 hover:text-green-700 rounded-lg text-xs font-bold transition-all">
          <Plus className="w-3.5 h-3.5" /> Registrar Pagamento Recebido
        </button>
      </div>

      {/* Commission settlement */}
      {commission > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Baixa de Comissão</p>

          <button
            onClick={async () => {
              setSavingCommission(true);
              await onChangeCommissionPaid(!commissionPaid);
              setSavingCommission(false);
            }}
            disabled={savingCommission}
            className={[
              'w-full flex items-center justify-between p-3 rounded-lg border-2 transition-all',
              commissionPaid
                ? 'border-green-500 bg-green-50'
                : 'border-gray-200 bg-white hover:border-green-300'
            ].join(' ')}
          >
            <div className="flex items-center gap-3">
              {commissionPaid
                ? <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                : <Circle className="w-5 h-5 text-gray-300 flex-shrink-0" />}
              <div className="text-left">
                <p className="text-sm font-bold text-gray-800">Minha comissão recebida</p>
                <p className="text-xs text-gray-400">{fmt(myShareValue ?? (commission - (partnerShareValue || 0)))}</p>
              </div>
            </div>
            <span className={[
              'text-[10px] font-black px-2 py-1 rounded-full',
              commissionPaid ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-400'
            ].join(' ')}>
              {savingCommission ? 'Salvando...' : commissionPaid ? 'PAGO' : 'PENDENTE'}
            </span>
          </button>

          {partnerName && (partnerShareValue || 0) > 0 && (
            <button
              onClick={async () => {
                setSavingPartner(true);
                await onChangePartnerPaid(!partnerPaid);
                setSavingPartner(false);
              }}
              disabled={savingPartner}
              className={[
                'w-full flex items-center justify-between p-3 rounded-lg border-2 transition-all',
                partnerPaid
                  ? 'border-purple-500 bg-purple-50'
                  : 'border-gray-200 bg-white hover:border-purple-300'
              ].join(' ')}
            >
              <div className="flex items-center gap-3">
                {partnerPaid
                  ? <CheckCircle2 className="w-5 h-5 text-purple-600 flex-shrink-0" />
                  : <Circle className="w-5 h-5 text-gray-300 flex-shrink-0" />}
                <div className="text-left">
                  <p className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-purple-500" /> Repasse para {partnerName}
                  </p>
                  <p className="text-xs text-gray-400">{fmt(partnerShareValue || 0)}</p>
                </div>
              </div>
              <span className={[
                'text-[10px] font-black px-2 py-1 rounded-full',
                partnerPaid ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-400'
              ].join(' ')}>
                {savingPartner ? 'Salvando...' : partnerPaid ? 'REPASSADO' : 'PENDENTE'}
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
