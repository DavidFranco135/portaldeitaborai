import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import { Document } from '../types';
import {
  Clock, AlertTriangle, CheckCircle2, DollarSign, Search, ExternalLink,
} from 'lucide-react';

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function parseVencimento(v: string): Date | null {
  const [d, m, y] = (v || '').split('/').map(Number);
  if (!d || !m || !y) return null;
  return new Date(y, m - 1, d);
}

type Status = 'vencer' | 'vencido' | 'pago';

interface ParcelaRow {
  docId: string;
  docType: 'pedido' | 'romaneio';
  docNumber: string;
  clientName: string;
  chequeId: string;
  vencimento: string;
  vencimentoDate: Date | null;
  valor: number;
  status: Status;
}

/**
 * Financeiro — todas as parcelas/cheques/boletos de Pedidos e Vendas,
 * organizados por status (a vencer / vencido / pago), com nome do
 * cliente e data de vencimento. Dá pra ver rapidinho quem deve o quê e
 * quando.
 */
export const Financeiro: React.FC = () => {
  const { state } = useApp();
  const [tab, setTab] = useState<Status>('vencer');
  const [search, setSearch] = useState('');

  const parcelas = useMemo(() => {
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const rows: ParcelaRow[] = [];

    state.documents.forEach((doc: Document) => {
      if (doc.type !== 'pedido' && doc.type !== 'romaneio') return;
      const clientName = doc.clientName || doc.blocos?.[0]?.clientName || '—';
      (doc.cheques || []).forEach((c: any) => {
        const vencimentoDate = parseVencimento(c.vencimento);
        let status: Status = 'vencer';
        if (c.paid) status = 'pago';
        else if (vencimentoDate && vencimentoDate < hoje) status = 'vencido';

        rows.push({
          docId: doc.id,
          docType: doc.type as 'pedido' | 'romaneio',
          docNumber: doc.number,
          clientName,
          chequeId: c.id,
          vencimento: c.vencimento,
          vencimentoDate,
          valor: c.valor,
          status,
        });
      });
    });

    return rows.sort((a, b) => {
      if (!a.vencimentoDate) return 1;
      if (!b.vencimentoDate) return -1;
      return a.vencimentoDate.getTime() - b.vencimentoDate.getTime();
    });
  }, [state.documents]);

  const counts = useMemo(() => ({
    vencer: parcelas.filter(p => p.status === 'vencer'),
    vencido: parcelas.filter(p => p.status === 'vencido'),
    pago: parcelas.filter(p => p.status === 'pago'),
  }), [parcelas]);

  const filtered = useMemo(() => {
    return counts[tab].filter(p =>
      !search || p.clientName.toLowerCase().includes(search.toLowerCase())
    );
  }, [counts, tab, search]);

  const totalFiltered = filtered.reduce((s, p) => s + p.valor, 0);

  // Faturamento por cliente — soma de tudo (pago + a vencer + vencido)
  const faturamentoPorCliente = useMemo(() => {
    const map: Record<string, number> = {};
    parcelas.forEach(p => { map[p.clientName] = (map[p.clientName] || 0) + p.valor; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [parcelas]);

  const TABS: { val: Status; label: string; icon: any; color: string; bg: string }[] = [
    { val: 'vencer', label: 'A Vencer', icon: Clock, color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
    { val: 'vencido', label: 'Vencido', icon: AlertTriangle, color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
    { val: 'pago', label: 'Pago', icon: CheckCircle2, color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
  ];

  return (
    <div className="space-y-5 pb-24 md:pb-0">
      <div>
        <h1 className="text-2xl font-black text-green-800">Financeiro</h1>
        <p className="text-gray-500 text-sm">Parcelas, cheques e boletos de Orçamentos e Vendas</p>
      </div>

      {/* Cards de resumo por status */}
      <div className="grid grid-cols-3 gap-3">
        {TABS.map(t => {
          const rows = counts[t.val];
          const total = rows.reduce((s, p) => s + p.valor, 0);
          const Icon = t.icon;
          return (
            <button key={t.val} onClick={() => setTab(t.val)}
              className={[
                'text-left p-3 rounded-xl border-2 transition-all',
                tab === t.val ? t.bg + ' border-current ' + t.color : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300'
              ].join(' ')}>
              <Icon className="w-4 h-4 mb-1" />
              <p className="text-[10px] font-bold uppercase tracking-wider">{t.label}</p>
              <p className={['text-lg font-black', tab === t.val ? '' : 'text-gray-700'].join(' ')}>{fmt(total)}</p>
              <p className="text-[9px] opacity-70">{rows.length} parcela{rows.length !== 1 ? 's' : ''}</p>
            </button>
          );
        })}
      </div>

      {/* Busca por cliente */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por cliente..."
          className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl outline-none focus:border-green-600 shadow-sm text-sm" />
      </div>

      {/* Lista de parcelas do status selecionado */}
      <div className="space-y-2">
        {filtered.map(p => (
          <Link key={p.docId + '-' + p.chequeId} to={`/${p.docType === 'pedido' ? 'pedidos' : 'romaneios'}/${p.docId}`}
            className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-3 shadow-sm hover:shadow-md hover:border-green-300 transition-all">
            <div className={[
              'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
              p.status === 'pago' ? 'bg-green-50 text-green-600' : p.status === 'vencido' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
            ].join(' ')}>
              <DollarSign className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-900 text-sm truncate">{p.clientName}</p>
              <p className="text-[11px] text-gray-400">
                {p.docType === 'pedido' ? 'Orçamento' : 'Venda'} Nº {p.docNumber} · Vence {p.vencimento}
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="font-black text-gray-900">{fmt(p.valor)}</p>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
          </Link>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-12 bg-white border border-dashed border-gray-200 rounded-xl text-gray-400 text-sm italic">
            Nenhuma parcela {tab === 'vencer' ? 'a vencer' : tab === 'vencido' ? 'vencida' : 'paga'} encontrada.
          </div>
        )}

        {filtered.length > 0 && (
          <div className="bg-gray-900 text-white rounded-xl p-3 flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
              {filtered.length} parcela{filtered.length !== 1 ? 's' : ''}
            </p>
            <p className="text-lg font-black text-yellow-300">{fmt(totalFiltered)}</p>
          </div>
        )}
      </div>

      {/* Faturamento por cliente */}
      {faturamentoPorCliente.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm space-y-2">
          <h2 className="text-sm font-black text-gray-700 uppercase tracking-wider mb-2">💰 Faturamento por Cliente</h2>
          {faturamentoPorCliente.map(([name, total]) => (
            <div key={name} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
              <p className="text-sm text-gray-700">{name}</p>
              <p className="text-sm font-bold text-green-700">{fmt(total)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
