import React, { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import {
  Users, FileText, Truck, BarChart3, Settings,
  Cloud, CloudOff, RefreshCw, Menu, X, Home,
  Table2, ChevronLeft, ChevronRight, Banknote, LogOut, Package, Archive,
} from 'lucide-react';
import { useApp } from '../store/AppContext';
import { logout } from './Login';
import { motion, AnimatePresence } from 'motion/react';

function cn(...c: (string | boolean | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

const nav = [
  { path: '/', icon: Home, label: 'Dashboard', exact: true },
  { path: '/clientes', icon: Users, label: 'Clientes' },
  { path: '/pedidos/novo', icon: FileText, label: 'Novo Pedido' },
  { path: '/romaneios/novo', icon: Truck, label: 'Novo Romaneio' },
  { path: '/relatorios', icon: BarChart3, label: 'Relatórios' },
  { path: '/notas-entrega/novo', icon: Package, label: 'Nova Nota de Entrega' },
  { path: '/estoque', icon: Archive, label: 'Estoque' },
  { path: '/tabela-precos', icon: Table2, label: 'Tabela Preços' },
  { path: '/cheques-devolvidos', icon: Banknote, label: 'Cheques Devolvidos' },
  { path: '/configuracoes', icon: Settings, label: 'Configurações' },
];

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { state, syncFromFirebase } = useApp();
  const [mobile, setMobile] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-100 overflow-x-hidden">

      {/* ── Sidebar Desktop ── */}
      <aside
        className={cn(
          'hidden md:flex flex-col bg-white border-r border-gray-200 sticky top-0 h-screen transition-all duration-200 flex-shrink-0',
          collapsed ? 'w-14' : 'w-56'
        )}
      >
        {/* Logo */}
        <div className={cn('flex items-center border-b border-gray-200 h-14 flex-shrink-0', collapsed ? 'justify-center px-0' : 'px-4 gap-2')}>
          {!collapsed && (
            <Link to="/" className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-lg flex-shrink-0">🌲</span>
              <div className="min-w-0">
                <p className="text-sm font-black text-green-800 leading-tight truncate">Portal de Itaboraí</p>
                <p className="text-[9px] text-gray-400 uppercase tracking-widest leading-tight">Gestão Comercial</p>
              </div>
            </Link>
          )}
          {collapsed && (
            <Link to="/" className="text-lg">🌲</Link>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto overflow-x-hidden">
          {nav.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.exact}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                cn(
                  'flex items-center rounded-lg transition-all duration-150 group',
                  collapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5',
                  isActive
                    ? 'bg-green-700 text-white shadow-sm'
                    : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                )
              }
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              {!collapsed && <span className="text-sm font-medium truncate">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Firebase status */}
        {!collapsed && (
          <div className="px-4 py-3 border-t border-gray-200 space-y-1">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-gray-400">
              <div className="flex items-center gap-1.5">
                {state.isFirebaseReady
                  ? <Cloud className="w-3.5 h-3.5 text-green-600" />
                  : <CloudOff className="w-3.5 h-3.5 text-red-400" />}
                {state.isFirebaseReady ? 'Firebase ativo' : 'Local apenas'}
              </div>
              <button onClick={syncFromFirebase} disabled={state.isSyncing}
                className="p-1 hover:text-green-700 transition-colors disabled:opacity-40">
                <RefreshCw className={cn('w-3 h-3', state.isSyncing && 'animate-spin')} />
              </button>
            </div>
            {state.lastSync && (
              <p className="text-[9px] text-gray-300 text-center">
                Sync: {new Date(state.lastSync).toLocaleTimeString('pt-BR')}
              </p>
            )}
            <button onClick={() => { if (confirm('Deseja sair do sistema?')) logout(); }}
              className="w-full flex items-center justify-center gap-1.5 mt-2 py-1.5 text-[10px] font-bold text-gray-400 hover:text-red-600 transition-colors">
              <LogOut className="w-3 h-3" /> Sair
            </button>
          </div>
        )}
        {collapsed && (
          <div className="py-3 border-t border-gray-200 flex flex-col items-center gap-2">
            <button onClick={syncFromFirebase} disabled={state.isSyncing}
              title="Sincronizar"
              className="p-2 text-gray-400 hover:text-green-700 transition-colors disabled:opacity-40">
              <RefreshCw className={cn('w-3.5 h-3.5', state.isSyncing && 'animate-spin')} />
            </button>
            <button onClick={() => { if (confirm('Deseja sair do sistema?')) logout(); }}
              title="Sair"
              className="p-2 text-gray-400 hover:text-red-600 transition-colors">
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Collapse toggle button */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="absolute -right-3 top-16 w-6 h-6 bg-white border border-gray-200 rounded-full shadow-sm flex items-center justify-center text-gray-400 hover:text-green-700 hover:border-green-300 transition-all z-10"
          title={collapsed ? 'Expandir menu' : 'Recolher menu'}
        >
          {collapsed
            ? <ChevronRight className="w-3.5 h-3.5" />
            : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
      </aside>

      {/* ── Mobile header ── */}
      <header className="md:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-50 no-print">
        <Link to="/" className="flex items-center gap-2">
          <span>🌲</span>
          <span className="font-black text-green-800 text-sm">Portal de Itaboraí</span>
        </Link>
        <button onClick={() => setMobile(!mobile)}>
          {mobile ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      <AnimatePresence>
        {mobile && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.2 }}
            className="fixed inset-0 bg-white z-40 md:hidden flex flex-col no-print pt-16"
          >
            <nav className="flex-1 px-4 py-4 space-y-1">
              {nav.map(item => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.exact}
                  onClick={() => setMobile(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-4 px-4 py-3 rounded-xl text-base font-semibold transition-all',
                      isActive ? 'bg-green-700 text-white' : 'text-gray-600 hover:bg-gray-100'
                    )
                  }
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main ── */}
      <main className="flex-1 min-w-0 overflow-x-hidden">
        <div className="p-4 md:p-6 lg:p-8 pb-24 md:pb-8 max-w-full">
          {children}
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 grid grid-cols-5 no-print z-30">
        {nav.slice(0, 5).map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.exact}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-0.5 py-2 transition-colors',
                isActive ? 'text-green-700' : 'text-gray-400'
              )
            }
          >
            <item.icon className="w-5 h-5" />
            <span className="text-[9px] font-bold">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
};
