import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './store/AppContext';
import { Layout } from './components/Layout';
import { Login, isAuthenticated } from './components/Login';
import { Dashboard } from './pages/Dashboard';
import { Clientes } from './pages/Clientes';
import { DocumentManager } from './pages/DocumentManager';
import { Relatorios } from './pages/Relatorios';
import { Configuracoes } from './pages/Configuracoes';
import { TabelaPrecos } from './pages/TabelaPrecos';
import { ChequesDevolvidos } from './pages/ChequesDevolvidos';
import { Estoque } from './pages/Estoque';

export default function App() {
  const [authed, setAuthed] = useState(isAuthenticated());

  if (!authed) {
    return <Login onSuccess={() => setAuthed(true)} />;
  }

  return (
    <Router>
      <AppProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/clientes" element={<Clientes />} />
            <Route path="/pedidos/novo" element={<DocumentManager type="pedido" />} />
            <Route path="/pedidos/:id" element={<DocumentManager type="pedido" />} />
            <Route path="/romaneios/novo" element={<DocumentManager type="romaneio" />} />
            <Route path="/romaneios/:id" element={<DocumentManager type="romaneio" />} />
            <Route path="/notas-entrega/novo" element={<DocumentManager type="notaentrega" />} />
            <Route path="/notas-entrega/:id" element={<DocumentManager type="notaentrega" />} />
            <Route path="/estoque" element={<Estoque />} />
            <Route path="/relatorios" element={<Relatorios />} />
            <Route path="/tabela-precos" element={<TabelaPrecos />} />
            <Route path="/cheques-devolvidos" element={<ChequesDevolvidos />} />
            <Route path="/configuracoes" element={<Configuracoes />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </AppProvider>
    </Router>
  );
}
