import React, { useState, useMemo } from 'react';
import { useApp } from '../store/AppContext';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Users, FileText, Truck, ArrowRight, Clock, CheckCircle2, ChevronDown, Package, LayoutGrid } from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ── Component ────────────────────────────────────────────────────────────────
export const Dashboard: React.FC = () => {
  const { state, saveDocument } = useApp();
  const navigate = useNavigate();
  const [showPedidos, setShowPedidos] = useState(false);
  const [showRomaneios, setShowRomaneios] = useState(false);
  const [periodoVendas, setPeriodoVendas] = useState<'hoje' | 'semana' | 'mes'>('hoje');

  // Orçamentos em andamento (era "Pedidos")
  const pedidosAndamento = state.documents.filter(
    d => d.type === 'pedido' && d.status !== 'concluido'
  );

  const romaneiosAberto = state.documents.filter(d => {
    if (d.type !== 'romaneio') return false;
    const paid = (d.payments || []).reduce((s, p) => s + p.valor, 0);
    return paid < d.total - 0.01;
  });

  // Vendas (romaneios) por período — Hoje / Semana / Mês
  const now = new Date();
  const vendasNoPeriodo = useMemo(() => {
    const range = periodoVendas === 'hoje'
      ? { start: startOfDay(now), end: endOfDay(now) }
      : periodoVendas === 'semana'
      ? { start: startOfWeek(now, { weekStartsOn: 0 }), end: endOfWeek(now, { weekStartsOn: 0 }) }
      : { start: startOfMonth(now), end: endOfMonth(now) };
    return state.documents.filter(d => {
      if (d.type !== 'romaneio') return false;
      try {
        return isWithinInterval(parseISO(d.date + 'T12:00:00'), range);
      } catch { return false; }
    });
  }, [state.documents, periodoVendas]);

  const totalVendasPeriodo = vendasNoPeriodo.reduce((s, d) => s + d.total, 0);
  const m3VendasPeriodo = vendasNoPeriodo.reduce((s, d) => s + (d.totalM3 || 0), 0);

  const marcarConcluido = async (id: string) => {
    const doc = state.documents.find(d => d.id === id);
    if (!doc) return;
    await saveDocument({ ...doc, status: 'concluido', updatedAt: new Date().toISOString() });
  };

  return (
    <div className="space-y-6 pb-24 md:pb-0">
      <div>
        <h1 className="text-2xl font-black text-green-800">Bem-vindo!</h1>
        <p className="text-gray-500 text-sm">Portal de Itaboraí — Gestão Comercial</p>
      </div>

      {/* Vendas — Hoje / Semana / Mês */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-gray-700 uppercase tracking-wider">💰 Vendas</h2>
          <div className="flex gap-0.5 p-0.5 bg-gray-100 rounded-lg">
            {([
              { val: 'hoje', label: 'Hoje' },
              { val: 'semana', label: 'Semana' },
              { val: 'mes', label: 'Mês' },
            ] as { val: 'hoje' | 'semana' | 'mes'; label: string }[]).map(p => (
              <button key={p.val} onClick={() => setPeriodoVendas(p.val)}
                className={['px-3 py-1.5 rounded-md text-xs font-bold transition-all',
                  periodoVendas === p.val ? 'bg-green-700 text-white shadow' : 'text-gray-500 hover:bg-gray-200'].join(' ')}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Total Vendido</p>
            <p className="text-xl font-black text-green-700">{fmt(totalVendasPeriodo)}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Vendas</p>
            <p className="text-xl font-black text-gray-900">{vendasNoPeriodo.length}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">M³ Vendidos</p>
            <p className="text-xl font-black text-gray-900">{m3VendasPeriodo.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <Link to="/relatorios?type=pedido">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md hover:border-amber-300 transition-all cursor-pointer h-full">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Orçamentos em Andamento</p>
            <p className="text-2xl font-black text-gray-900">{pedidosAndamento.length}</p>
            <p className="text-[10px] text-gray-400">aguardando confirmação</p>
          </motion.div>
        </Link>
        <Link to="/relatorios?type=romaneio">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md hover:border-blue-300 transition-all cursor-pointer h-full">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Vendas em Aberto</p>
            <p className="text-2xl font-black text-gray-900">{romaneiosAberto.length}</p>
            <p className="text-[10px] text-gray-400">pagamento pendente</p>
          </motion.div>
        </Link>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {[
          { to: '/pedidos/novo', icon: FileText, label: 'Orçamento', sub: 'Proposta para o cliente', color: 'text-amber-600', bg: 'bg-amber-50' },
          { to: '/romaneios/novo', icon: Truck, label: 'Nova Venda', sub: 'Venda com entrega', color: 'text-blue-600', bg: 'bg-blue-50' },
          { to: '/notas-entrega/novo', icon: Package, label: 'Nota de Entrega', sub: 'Confirmação de itens', color: 'text-purple-600', bg: 'bg-purple-50' },
          { to: '/catalogo', icon: LayoutGrid, label: 'Catálogo', sub: 'Vender pelo estoque', color: 'text-orange-600', bg: 'bg-orange-50' },
          { to: '/clientes', icon: Users, label: 'Clientes', sub: 'Gestão de contatos', color: 'text-green-700', bg: 'bg-green-50' },
        ].map(item => (
          <Link key={item.to} to={item.to}
            className="group flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md hover:border-green-300 transition-all">
            <div className={`w-11 h-11 ${item.bg} ${item.color} rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform flex-shrink-0`}>
              <item.icon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-black text-gray-900 text-sm whitespace-nowrap">{item.label}</p>
              <p className="text-[11px] text-gray-400 truncate">{item.sub}</p>
            </div>
            <Plus className="w-4 h-4 text-gray-300 group-hover:text-green-600 transition-colors flex-shrink-0" />
          </Link>
        ))}
      </div>

      {/* Pedidos em andamento */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setShowPedidos(v => !v)}
            className="flex items-center gap-2 group"
          >
            <h2 className="text-lg font-black text-gray-800">Orçamentos em Andamento</h2>
            {pedidosAndamento.length > 0 && (
              <span className="bg-amber-100 text-amber-700 text-xs font-black px-2 py-0.5 rounded-full">
                {pedidosAndamento.length}
              </span>
            )}
            <motion.span
              animate={{ rotate: showPedidos ? 0 : -90 }}
              transition={{ duration: 0.2 }}
              className="text-gray-400 group-hover:text-gray-600"
            >
              <ChevronDown className="w-4 h-4" />
            </motion.span>
          </button>
          <Link to="/relatorios?status=andamento"
            className="flex items-center gap-1 text-xs font-bold text-green-700 hover:underline">
            Ver todos <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <AnimatePresence initial={false}>
          {showPedidos && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              {pedidosAndamento.length === 0 ? (
                <div className="bg-white border border-dashed border-gray-200 rounded-xl p-8 text-center">
                  <CheckCircle2 className="w-10 h-10 text-green-300 mx-auto mb-2" />
                  <p className="text-gray-400 italic text-sm">Nenhum pedido em andamento.</p>
                  <Link to="/pedidos/novo"
                    className="inline-flex items-center gap-1 mt-3 text-xs font-bold text-green-700 hover:underline">
                    <Plus className="w-3 h-3" /> Criar novo pedido
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {pedidosAndamento.slice(0, 5).map((doc, i) => (
                    <motion.div key={doc.id}
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                      className="bg-white border border-amber-200 rounded-xl overflow-hidden shadow-sm">
                      <div className="flex items-center justify-between p-4 border-b border-amber-100">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-amber-50 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Clock className="w-4 h-4 text-amber-600" />
                          </div>
                          <div>
                            <p className="font-black text-gray-900 text-sm">{doc.clientName || '—'}</p>
                            <p className="text-[10px] text-gray-400 uppercase tracking-wider">
                              Pedido Nº {doc.number} •{' '}
                              {doc.date ? format(parseISO(doc.date + 'T12:00:00'), 'dd/MM/yyyy') : '—'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-green-700 text-sm">{fmt(doc.total)}</p>
                          <p className="text-[10px] text-gray-400">{doc.totalM3.toFixed(3)} m³</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 px-4 py-2 bg-amber-50/50">
                        <Link to={`/pedidos/${doc.id}`}
                          className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-50 transition-all">
                          <FileText className="w-3 h-3" /> Ver Pedido
                        </Link>
                        <Link to={`/romaneios/novo?from=${doc.id}`}
                          className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-all">
                          <Truck className="w-3 h-3" /> Criar Romaneio
                        </Link>
                        <button onClick={() => marcarConcluido(doc.id)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-green-700 text-white rounded-lg text-xs font-bold hover:bg-green-800 transition-all ml-auto">
                          <CheckCircle2 className="w-3 h-3" /> Concluído
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Romaneios em Aberto (não quitados) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setShowRomaneios(v => !v)}
            className="flex items-center gap-2 group"
          >
            <h2 className="text-lg font-black text-gray-800">Vendas em Aberto</h2>
            {romaneiosAberto.length > 0 && (
              <span className="bg-red-100 text-red-700 text-xs font-black px-2 py-0.5 rounded-full">
                {romaneiosAberto.length}
              </span>
            )}
            <motion.span
              animate={{ rotate: showRomaneios ? 0 : -90 }}
              transition={{ duration: 0.2 }}
              className="text-gray-400 group-hover:text-gray-600"
            >
              <ChevronDown className="w-4 h-4" />
            </motion.span>
          </button>
          <Link to="/relatorios?type=romaneio&payment=aberto"
            className="flex items-center gap-1 text-xs font-bold text-green-700 hover:underline">
            Ver todos <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <AnimatePresence initial={false}>
          {showRomaneios && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              {romaneiosAberto.length === 0 ? (
                <div className="bg-white border border-dashed border-gray-200 rounded-xl p-8 text-center">
                  <CheckCircle2 className="w-10 h-10 text-green-300 mx-auto mb-2" />
                  <p className="text-gray-400 italic text-sm">Todos os romaneios estão quitados!</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {romaneiosAberto.slice(0, 5).map((doc, i) => {
                    const paid = (doc.payments || []).reduce((s, p) => s + p.valor, 0);
                    const remaining = doc.total - paid;
                    return (
                      <Link
                        key={doc.id}
                        to={`/romaneios/${doc.id}`}
                        className="flex items-center justify-between p-4 bg-white border border-red-100 rounded-xl hover:shadow-md transition-all"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 bg-red-50 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Truck className="w-4 h-4 text-red-600" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-black text-gray-900 text-sm truncate">{doc.clientName || '—'}</p>
                            <p className="text-[10px] text-gray-400 uppercase tracking-wider">
                              Romaneio Nº {doc.number} •{' '}
                              {doc.date ? format(parseISO(doc.date + 'T12:00:00'), 'dd/MM/yyyy') : '—'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-bold text-red-600 text-sm">Falta {fmt(remaining)}</p>
                          <p className="text-[10px] text-gray-400">{fmt(paid)} de {fmt(doc.total)}</p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
