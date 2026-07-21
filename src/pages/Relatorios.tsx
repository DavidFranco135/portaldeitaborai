import { endOfDay, endOfMonth, format, isWithinInterval, parseISO, startOfDay, startOfMonth } from 'date-fns';
import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import { Link } from 'react-router-dom';
import { FileText, Truck, Trash2, ExternalLink, Search, Calendar, CheckCircle2, Clock, DollarSign, AlertCircle, Package } from 'lucide-react';
import { PartnerDetail } from '../components/PartnerDetail';
import { buildPartnerReportHTML } from '../lib/partnerReportHTML';
import { AnimatePresence } from 'motion/react';

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

type TypeFilter = 'todos' | 'pedido' | 'romaneio' | 'notaentrega';
type StatusFilter = 'todos' | 'andamento' | 'concluido';
type PaymentFilter = 'todos' | 'aberto' | 'quitado';
type CategoriaFilter = 'todos' | 'madeira' | 'porta' | 'batente' | 'aduela' | 'bloco' | 'outro';
type CommissionFilter = 'todos' | 'pendente' | 'recebida';
type PurposeFilter = 'todos' | 'cliente' | 'serraria';

export const Relatorios: React.FC = () => {
  const { state, deleteDocument, saveDocument, adjustStock } = useApp();
  const [searchParams] = useSearchParams();

  const [typeFilter, setTypeFilter] = useState<TypeFilter>((searchParams.get('type') as TypeFilter) || 'todos');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>((searchParams.get('status') as StatusFilter) || 'todos');
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>((searchParams.get('payment') as PaymentFilter) || 'todos');
  const [categoriaFilter, setCategoriaFilter] = useState<CategoriaFilter>('todos');
  const [commissionFilter, setCommissionFilter] = useState<CommissionFilter>((searchParams.get('commission') as CommissionFilter) || 'todos');
  const [purposeFilter, setPurposeFilter] = useState<PurposeFilter>('todos');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [partnerDetail, setPartnerDetail] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return state.documents.filter(d => {
      if (typeFilter !== 'todos' && d.type !== typeFilter) return false;
      if (categoriaFilter !== 'todos' && !(d.categorias || []).includes(categoriaFilter)) return false;
      if (purposeFilter !== 'todos' && d.type === 'pedido' && (d.docPurpose || 'cliente') !== purposeFilter) return false;
      if (statusFilter === 'andamento' && d.status === 'concluido') return false;
      if (statusFilter === 'concluido' && d.status !== 'concluido') return false;
      if (d.type === 'romaneio' && commissionFilter !== 'todos') {
        const hasCommission = (d.commissionValue || 0) > 0
          ? (d.myShareValue ?? d.commissionValue ?? 0) > 0
          : (d.settlement || 0) > 0;
        if (commissionFilter === 'pendente' && (d.commissionPaid || !hasCommission)) return false;
        if (commissionFilter === 'recebida' && !d.commissionPaid) return false;
      }
      if (d.type === 'romaneio' && paymentFilter !== 'todos') {
        const paid = (d.payments || []).reduce((s, p) => s + p.valor, 0);
        const isQuitado = paid >= d.total - 0.01;
        if (paymentFilter === 'quitado' && !isQuitado) return false;
        if (paymentFilter === 'aberto' && isQuitado) return false;
      }
      if (search &&
        !d.clientName.toLowerCase().includes(search.toLowerCase()) &&
        !d.number.includes(search)) return false;
      if (dateFrom || dateTo) {
        const docDate = parseISO(d.date + 'T12:00:00');
        if (dateFrom && dateTo) {
          if (!isWithinInterval(docDate, {
            start: startOfDay(parseISO(dateFrom)),
            end: endOfDay(parseISO(dateTo)),
          })) return false;
        } else if (dateFrom && docDate < startOfDay(parseISO(dateFrom))) return false;
        else if (dateTo && docDate > endOfDay(parseISO(dateTo))) return false;
      }
      return true;
    });
  }, [state.documents, typeFilter, statusFilter, search, dateFrom, dateTo, paymentFilter, categoriaFilter, commissionFilter, purposeFilter]);

  const summary = useMemo(() => filtered.reduce(
    (acc, d) => {
      acc.total += d.total;
      acc.m3 += d.totalM3;
      // Comissão só existe em romaneios — pedidos nunca entram nesse cálculo
      if (d.type === 'romaneio') {
        // Se o romaneio tem comissão formal (%), soma só a sua parte dela
        // (a lógica de parceiro já cuida da divisão). Se NÃO tem comissão
        // nenhuma configurada mas tem um "Acerto Escritório" preenchido,
        // esse valor conta como se fosse sua comissão — é como o
        // ganho está sendo registrado nesse caso mais simples.
        const myShare = (d.commissionValue || 0) > 0
          ? (d.myShareValue ?? d.commissionValue ?? 0)
          : (d.settlement || 0);
        acc.commission += myShare;
        acc.commissionGross += (d.commissionValue || 0);
        if (d.commissionPaid) {
          acc.commissionRecebida += myShare;
        } else {
          acc.commissionAReceber += myShare;
        }
        // Repasse ao parceiro só conta como "feito" se partnerPaid = true
        if ((d.partnerShareValue || 0) > 0) {
          if (d.partnerPaid) {
            acc.partnerShareRepassado += d.partnerShareValue || 0;
          } else {
            acc.partnerShareAPagar += d.partnerShareValue || 0;
          }
        }
      }
      return acc;
    },
    { total: 0, m3: 0, commission: 0, commissionGross: 0, partnerShareRepassado: 0, partnerShareAPagar: 0, commissionRecebida: 0, commissionAReceber: 0 }
  ), [filtered]);

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este documento?')) return;
    await deleteDocument(id);
  };

  /**
   * Alterna o status entre "Em Andamento" e "Concluído". Quando o
   * documento tem itens vinculados a itens de estoque (stockItemId), a
   * baixa acontece automaticamente ao marcar como Concluído — e é
   * revertida (soma de volta) se for reaberto. O campo `stockBaixado`
   * evita descontar duas vezes o mesmo documento.
   */
  const toggleStatus = async (doc: any) => {
    const indoConcluido = doc.status !== 'concluido';
    const newStatus = indoConcluido ? 'concluido' : 'andamento';

    // Reúne todos os itens com vínculo de estoque (madeira + produtos, em todos os blocos)
    const itensComEstoque: Array<{ stockItemId: string; qty: number }> = [];
    (doc.blocos || []).forEach((bloco: any) => {
      (bloco.items || []).forEach((it: any) => {
        if (it.stockItemId) {
          const qty = (it.c3 || 0) + (it.c4 || 0) + (it.c5 || 0) + (it.c6 || 0);
          if (qty > 0) itensComEstoque.push({ stockItemId: it.stockItemId, qty });
        }
      });
    });
    (doc.productItems || []).forEach((it: any) => {
      if (it.stockItemId && it.qty > 0) {
        itensComEstoque.push({ stockItemId: it.stockItemId, qty: it.qty });
      }
    });

    if (indoConcluido && itensComEstoque.length > 0 && !doc.stockBaixado) {
      // Concluindo agora e ainda não baixou — desconta do estoque
      for (const it of itensComEstoque) {
        await adjustStock(
          it.stockItemId,
          -it.qty,
          `${doc.type === 'romaneio' ? 'Venda' : doc.type === 'notaentrega' ? 'Nota de Entrega' : 'Orçamento'} Nº ${doc.number}`,
          { id: doc.id, number: doc.number, type: doc.type }
        );
      }
      await saveDocument({ ...doc, status: newStatus, stockBaixado: true, updatedAt: new Date().toISOString() });
    } else if (!indoConcluido && doc.stockBaixado && itensComEstoque.length > 0) {
      // Reabrindo um documento que já tinha baixado — devolve ao estoque
      for (const it of itensComEstoque) {
        await adjustStock(
          it.stockItemId,
          it.qty,
          `Estorno — ${doc.type === 'romaneio' ? 'Venda' : doc.type === 'notaentrega' ? 'Nota de Entrega' : 'Orçamento'} Nº ${doc.number} reaberto`,
          { id: doc.id, number: doc.number, type: doc.type }
        );
      }
      await saveDocument({ ...doc, status: newStatus, stockBaixado: false, updatedAt: new Date().toISOString() });
    } else {
      await saveDocument({ ...doc, status: newStatus, updatedAt: new Date().toISOString() });
    }
  };

  // Normaliza nomes para comparação tolerante (evita espaço extra, maiúscula/minúscula)
  const normPartner = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

  const partnerDocs = partnerDetail
    ? state.documents.filter(d =>
        d.type === 'romaneio' &&
        d.partnerName &&
        normPartner(d.partnerName) === normPartner(partnerDetail)
      )
    : [];

  const handlePrintPartner = () => {
    if (!partnerDetail) return;
    const win = window.open('', '_blank');
    if (!win) { alert('Pop-up bloqueado. Permita pop-ups e tente novamente.'); return; }
    win.document.write(buildPartnerReportHTML(partnerDetail, partnerDocs, state.settings));
    win.document.close();
  };

  return (
    <div className="space-y-5 pb-24 md:pb-0">
      <AnimatePresence>
        {partnerDetail && (
          <PartnerDetail
            partnerName={partnerDetail}
            docs={partnerDocs}
            onClose={() => setPartnerDetail(null)}
            onPrint={handlePrintPartner}
          />
        )}
      </AnimatePresence>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-green-800">Documentos</h1>
          <p className="text-gray-500 text-sm">Histórico de pedidos e romaneios</p>
        </div>
      </div>

      {/* Primary filters — segmented buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-0.5 p-0.5 bg-white border border-gray-200 rounded-lg">
          {(['todos', 'pedido', 'romaneio', 'notaentrega'] as TypeFilter[]).map(f => (
            <button key={f} onClick={() => setTypeFilter(f)}
              className={['px-3 py-1.5 rounded-md text-[11px] font-bold transition-all',
                typeFilter === f ? 'bg-green-700 text-white shadow' : 'text-gray-500 hover:bg-gray-100'].join(' ')}
            >{f === 'notaentrega' ? 'Nota Entrega' : f === 'todos' ? 'Todos' : f === 'pedido' ? 'Orçamento' : f === 'romaneio' ? 'Venda' : f}</button>
          ))}
        </div>

        <div className="flex gap-0.5 p-0.5 bg-white border border-gray-200 rounded-lg overflow-x-auto">
          {([
            { val: 'todos', label: 'Categoria', emoji: '' },
            { val: 'madeira', label: 'Madeira', emoji: '🪵' },
            { val: 'porta', label: 'Porta', emoji: '🚪' },
            { val: 'batente', label: 'Batente', emoji: '🖼' },
            { val: 'aduela', label: 'Aduela', emoji: '🖼' },
            { val: 'bloco', label: 'Bloco', emoji: '🧱' },
            { val: 'outro', label: 'Outro', emoji: '📦' },
          ] as { val: CategoriaFilter; label: string; emoji: string }[]).map(f => (
            <button key={f.val} onClick={() => setCategoriaFilter(f.val)}
              className={['px-2.5 py-1.5 rounded-md text-[11px] font-bold transition-all whitespace-nowrap',
                categoriaFilter === f.val ? 'bg-gray-700 text-white shadow' : 'text-gray-500 hover:bg-gray-100'].join(' ')}
            >{f.emoji} {f.label}</button>
          ))}
        </div>
      </div>

      {/* Secondary filters — dropdowns, compact on any screen */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {(typeFilter === 'romaneio' || typeFilter === 'todos') && (
          <>
            <div className="space-y-0.5">
              <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider px-0.5">Pagamento</label>
              <select value={paymentFilter} onChange={e => setPaymentFilter(e.target.value as PaymentFilter)}
                className={['w-full px-2.5 py-2 rounded-lg text-xs font-bold border outline-none transition-all',
                  paymentFilter === 'aberto' ? 'bg-red-50 border-red-300 text-red-800'
                    : paymentFilter === 'quitado' ? 'bg-green-50 border-green-300 text-green-800'
                    : 'bg-white border-gray-200 text-gray-600'].join(' ')}>
                <option value="todos">Todos Pagamentos</option>
                <option value="aberto">⚠ Em Aberto</option>
                <option value="quitado">✓ Quitados</option>
              </select>
            </div>
          </>
        )}

        {(typeFilter === 'pedido' || typeFilter === 'notaentrega' || typeFilter === 'todos') && (
          <div className="space-y-0.5">
            <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider px-0.5">Status</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as StatusFilter)}
              className={['w-full px-2.5 py-2 rounded-lg text-xs font-bold border outline-none transition-all',
                statusFilter === 'andamento' ? 'bg-amber-50 border-amber-300 text-amber-800'
                  : statusFilter === 'concluido' ? 'bg-green-50 border-green-300 text-green-800'
                  : 'bg-white border-gray-200 text-gray-600'].join(' ')}>
              <option value="todos">Todos Status</option>
              <option value="andamento">⏱ Em Andamento / Pendente</option>
              <option value="concluido">✓ Concluídos / Entregues</option>
            </select>
          </div>
        )}
      </div>

      {/* Search + date filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar cliente ou Nº..."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-green-600" />
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="flex-1 p-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-green-600" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 flex-shrink-0">até</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="flex-1 p-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-green-600" />
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(''); setDateTo(''); }}
              className="text-xs text-red-500 font-bold whitespace-nowrap">limpar</button>
          )}
        </div>
      </div>

      {/* Summary */}
      {filtered.length > 0 && summary.commissionGross > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-3">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
              <span className="text-[10px] font-bold text-green-600 uppercase tracking-wider">Comissão Já Recebida</span>
            </div>
            <p className="text-xl font-black text-green-700">{fmt(summary.commissionRecebida)}</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Comissão a Receber</span>
            </div>
            <p className="text-xl font-black text-amber-700">{fmt(summary.commissionAReceber)}</p>
          </div>
          {(summary.partnerShareRepassado > 0 || summary.partnerShareAPagar > 0) && (
            <div className="md:col-span-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 px-2">
              <span>Comissão bruta total: {fmt(summary.commissionGross)}</span>
              <span>✓ Já repassado a parceiros: <strong className="text-green-600">{fmt(summary.partnerShareRepassado)}</strong></span>
              {summary.partnerShareAPagar > 0 && (
                <span>⏳ A repassar: <strong className="text-amber-600">{fmt(summary.partnerShareAPagar)}</strong></span>
              )}
            </div>
          )}
        </div>
      )}

      {/* List */}
      <div className="space-y-3">
        {filtered.map(doc => (
          <div key={doc.id}
            className={['group flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4 p-4 md:p-5 bg-white border rounded-xl hover:shadow-md transition-all',
              doc.status === 'concluido' ? 'border-green-200 bg-green-50/30' : 'border-gray-200'].join(' ')}
          >
            <div className="flex items-center gap-4">
              <div className={['w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0',
                doc.type === 'pedido' ? 'bg-amber-50 text-amber-600'
                  : doc.type === 'notaentrega' ? 'bg-purple-50 text-purple-600'
                  : 'bg-blue-50 text-blue-600'].join(' ')}>
                {doc.type === 'pedido' ? <FileText className="w-5 h-5" />
                  : doc.type === 'notaentrega' ? <Package className="w-5 h-5" />
                  : <Truck className="w-5 h-5" />}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                    {doc.type === 'notaentrega' ? 'Nota de Entrega' : doc.type} Nº {doc.number}
                  </span>
                  {(doc.categorias || []).map(cat => {
                    const CAT_STYLE: Record<string, string> = {
                      madeira: 'bg-amber-100 text-amber-700',
                      porta: 'bg-blue-100 text-blue-700',
                      batente: 'bg-purple-100 text-purple-700',
                      aduela: 'bg-purple-100 text-purple-700',
                      bloco: 'bg-orange-100 text-orange-700',
                      outro: 'bg-gray-100 text-gray-600',
                    };
                    return (
                      <span key={cat} className={['text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase', CAT_STYLE[cat] || CAT_STYLE.outro].join(' ')}>
                        {cat}
                      </span>
                    );
                  })}
                  <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded flex items-center gap-1">
                    <Calendar className="w-2.5 h-2.5" />
                    {doc.date ? format(parseISO(doc.date + 'T12:00:00'), 'dd/MM/yyyy') : '—'}
                  </span>
                  {(doc.type === 'pedido' || doc.type === 'notaentrega') && (
                    <span className={['text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1',
                      doc.status === 'concluido'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-amber-100 text-amber-700'].join(' ')}>
                      {doc.status === 'concluido'
                        ? <><CheckCircle2 className="w-2.5 h-2.5" /> {doc.type === 'notaentrega' ? 'Entregue' : 'Concluído'}</>
                        : <><Clock className="w-2.5 h-2.5" /> {doc.type === 'notaentrega' ? 'Pendente' : 'Em andamento'}</>}
                    </span>
                  )}
                </div>
                <p className="font-black text-gray-900 group-hover:text-green-800 transition-colors">
                  {doc.clientName}
                </p>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                  <span>{doc.totalM3.toFixed(3)} m³</span>
                  <span className="font-bold text-green-700">{fmt(doc.total)}</span>
                  {doc.partnerName && (doc.partnerShareValue || 0) > 0 && (
                    <button
                      onClick={e => { e.preventDefault(); e.stopPropagation(); setPartnerDetail(doc.partnerName!); }}
                      className="text-[10px] bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded-full font-bold hover:bg-purple-100 transition-colors"
                    >
                      ÷ {doc.partnerName}
                    </button>
                  )}
                  {doc.type === 'romaneio' && (() => {
                    const paid = (doc.payments || []).reduce((s, p) => s + p.valor, 0);
                    const isQuitado = paid >= doc.total - 0.01;
                    return isQuitado ? (
                      <span className="text-[10px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded-full font-bold">
                        ✓ Quitado
                      </span>
                    ) : paid > 0 ? (
                      <span className="text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded-full font-bold">
                        {fmt(paid)} recebido
                      </span>
                    ) : (
                      <span className="text-[10px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded-full font-bold">
                        Não pago
                      </span>
                    );
                  })()}
                  {doc.type === 'romaneio' && doc.commissionPaid && (
                    <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-full font-bold">
                      Comissão ✓
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 flex-shrink-0">
              {doc.type === 'pedido' && doc.status !== 'concluido' && (
                <Link
                  to={`/romaneios/novo?from=${doc.id}`}
                  className="flex items-center justify-center gap-1 px-3 py-2 sm:py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-all"
                >
                  <Truck className="w-3 h-3" /> Criar Venda
                </Link>
              )}
              {(doc.type === 'pedido' || doc.type === 'notaentrega') && (
                <button
                  onClick={() => toggleStatus(doc)}
                  className={['flex items-center justify-center gap-1 px-3 py-2 sm:py-1.5 rounded-lg text-xs font-bold transition-all',
                    doc.status === 'concluido'
                      ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      : 'bg-green-100 text-green-700 hover:bg-green-200'].join(' ')}
                >
                  <CheckCircle2 className="w-3 h-3" />
                  {doc.status === 'concluido' ? 'Reabrir' : (doc.type === 'notaentrega' ? 'Entregar' : 'Concluir')}
                </button>
              )}
              <Link
                to={`/${doc.type === 'pedido' ? 'pedidos' : doc.type === 'notaentrega' ? 'notas-entrega' : 'romaneios'}/${doc.id}`}
                className="flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold transition-all"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Abrir
              </Link>
              <button onClick={() => handleDelete(doc.id)}
                className="flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 sm:px-2 text-gray-500 sm:text-gray-400 bg-red-50 sm:bg-transparent hover:text-red-600 hover:bg-red-50 rounded-lg text-xs font-bold sm:font-normal transition-all">
                <Trash2 className="w-3.5 h-3.5" /> <span className="sm:hidden">Excluir</span>
              </button>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-16 bg-white border border-dashed border-gray-200 rounded-xl text-gray-400 italic">
            Nenhum documento encontrado.
          </div>
        )}
      </div>
    </div>
  );
};
