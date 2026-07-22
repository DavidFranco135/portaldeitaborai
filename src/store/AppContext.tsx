import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { AppData, Client, Document, AppSettings, BouncedCheck, StockItem, StockMovement } from '../types';
import {
  initFirebase,
  isFirebaseConfigured,
  fbSaveClient,
  fbDeleteClient,
  fbLoadClients,
  fbSaveDocument,
  fbDeleteDocument,
  fbLoadDocuments,
  fbSaveSettings,
  fbLoadSettings,
  fbSaveCheck,
  fbDeleteCheck,
  fbLoadChecks,
  fbSaveStockItem,
  fbDeleteStockItem,
  fbLoadStockItems,
} from '../lib/firebase';

// ─── State ───────────────────────────────────────────────────────────────────

/**
 * Item pendente de sincronização — guardado quando um salvamento na nuvem
 * falha (geralmente por falta de internet). Fica persistido no
 * localStorage também, pra sobreviver a um fechamento de página enquanto
 * offline, e é reenviado automaticamente assim que a conexão volta.
 */
interface PendingItem {
  id: string;
  kind: 'client' | 'deleteClient' | 'document' | 'deleteDocument' | 'check' | 'deleteCheck' | 'stock' | 'deleteStock' | 'settings';
  payload: any;
  createdAt: string;
}

interface AppState extends AppData {
  bouncedChecks: BouncedCheck[];
  stockItems: StockItem[];
  isFirebaseReady: boolean;
  isSyncing: boolean;
  lastSync?: string;
  isOnline: boolean;
  pendingSync: PendingItem[];
}

const defaultSettings: AppSettings = {
  companyName: 'PORTAL DE ITABORAÍ',
  companyAddress: 'RUA EXEMPLO, Nº 100',
  companyNeighborhood: 'MADEIRA, PORTAS E BATENTES',
  companyCity: 'ITABORAÍ-RJ',
  companyCEP: '24800-000',
  companyCNPJ: '00.000.000/0001-00',
  companyPhone: '(21) 00000-0000',
  companyEmail: 'contato@portaldeitaborai.com.br',
  defaultCommissionPct: 5,
  priceRefs: [
    { id: '1', desc: 'TÁBUA PINUS 30×1,8', espessura: 1.8, largura: 30, price: 1380 },
    { id: '2', desc: 'SARRAFO PINUS 5×3', espessura: 3, largura: 5, price: 1380 },
  ],
};

const initialState: AppState = {
  clients: [],
  documents: [],
  bouncedChecks: [],
  stockItems: [],
  settings: defaultSettings,
  isFirebaseReady: false,
  isSyncing: false,
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  pendingSync: [],
};

// ─── Actions ─────────────────────────────────────────────────────────────────

type Action =
  | { type: 'LOAD_LOCAL'; payload: Partial<AppData> }
  | { type: 'SET_FIREBASE_READY'; payload: boolean }
  | { type: 'SET_SYNCING'; payload: boolean }
  | { type: 'SET_LAST_SYNC'; payload: string }
  | { type: 'SET_ONLINE'; payload: boolean }
  | { type: 'SET_PENDING'; payload: PendingItem[] }
  | { type: 'ADD_CLIENT'; payload: Client }
  | { type: 'UPDATE_CLIENT'; payload: Client }
  | { type: 'DELETE_CLIENT'; payload: string }
  | { type: 'ADD_DOCUMENT'; payload: Document }
  | { type: 'UPDATE_DOCUMENT'; payload: Document }
  | { type: 'DELETE_DOCUMENT'; payload: string }
  | { type: 'UPDATE_SETTINGS'; payload: AppSettings }
  | { type: 'SET_CLIENTS'; payload: Client[] }
  | { type: 'SET_DOCUMENTS'; payload: Document[] }
  | { type: 'SET_CHECKS'; payload: BouncedCheck[] }
  | { type: 'ADD_CHECK'; payload: BouncedCheck }
  | { type: 'UPDATE_CHECK'; payload: BouncedCheck }
  | { type: 'DELETE_CHECK'; payload: string }
  | { type: 'SET_STOCK'; payload: StockItem[] }
  | { type: 'ADD_STOCK'; payload: StockItem }
  | { type: 'UPDATE_STOCK'; payload: StockItem }
  | { type: 'DELETE_STOCK'; payload: string };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'LOAD_LOCAL':
      return { ...state, ...action.payload };
    case 'SET_FIREBASE_READY':
      return { ...state, isFirebaseReady: action.payload };
    case 'SET_SYNCING':
      return { ...state, isSyncing: action.payload };
    case 'SET_LAST_SYNC':
      return { ...state, lastSync: action.payload };
    case 'SET_ONLINE':
      return { ...state, isOnline: action.payload };
    case 'SET_PENDING':
      return { ...state, pendingSync: action.payload };
    case 'SET_CLIENTS':
      return { ...state, clients: action.payload };
    case 'SET_DOCUMENTS':
      return { ...state, documents: action.payload };
    case 'SET_CHECKS':
      return { ...state, bouncedChecks: action.payload };
    case 'ADD_CHECK':
      return { ...state, bouncedChecks: [action.payload, ...state.bouncedChecks] };
    case 'UPDATE_CHECK':
      return { ...state, bouncedChecks: state.bouncedChecks.map(c => c.id === action.payload.id ? action.payload : c) };
    case 'DELETE_CHECK':
      return { ...state, bouncedChecks: state.bouncedChecks.filter(c => c.id !== action.payload) };
    case 'SET_STOCK':
      return { ...state, stockItems: action.payload };
    case 'ADD_STOCK':
      return { ...state, stockItems: [action.payload, ...state.stockItems] };
    case 'UPDATE_STOCK':
      return { ...state, stockItems: state.stockItems.map(s => s.id === action.payload.id ? action.payload : s) };
    case 'DELETE_STOCK':
      return { ...state, stockItems: state.stockItems.filter(s => s.id !== action.payload) };
    case 'ADD_CLIENT':
      return { ...state, clients: [action.payload, ...state.clients] };
    case 'UPDATE_CLIENT':
      return {
        ...state,
        clients: state.clients.map(c =>
          c.id === action.payload.id ? action.payload : c
        ),
      };
    case 'DELETE_CLIENT':
      return {
        ...state,
        clients: state.clients.filter(c => c.id !== action.payload),
      };
    case 'ADD_DOCUMENT':
      return {
        ...state,
        documents: [action.payload, ...state.documents.filter(d => d.id !== action.payload.id)],
      };
    case 'UPDATE_DOCUMENT':
      return {
        ...state,
        documents: state.documents.map(d =>
          d.id === action.payload.id ? action.payload : d
        ),
      };
    case 'DELETE_DOCUMENT':
      return {
        ...state,
        documents: state.documents.filter(d => d.id !== action.payload),
      };
    case 'UPDATE_SETTINGS':
      return { ...state, settings: action.payload };
    default:
      return state;
  }
}

// ─── Context ─────────────────────────────────────────────────────────────────

interface ContextValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  saveClient: (c: Client) => Promise<void>;
  deleteClient: (id: string) => Promise<void>;
  saveDocument: (d: Document) => Promise<void>;
  deleteDocument: (id: string) => Promise<void>;
  saveSettings: (s: AppSettings) => Promise<void>;
  saveCheck: (c: BouncedCheck) => Promise<void>;
  deleteCheck: (id: string) => Promise<void>;
  saveStockItem: (s: StockItem) => Promise<void>;
  deleteStockItem: (id: string) => Promise<void>;
  adjustStock: (stockItemId: string, delta: number, motivo: string, doc?: { id: string; number: string; type: 'pedido' | 'romaneio' | 'notaentrega' }) => Promise<void>;
  syncFromFirebase: () => Promise<void>;
  flushPendingSync: () => Promise<void>;
}

const AppContext = createContext<ContextValue | undefined>(undefined);

const LS_KEY = 'edi_timber_v2';
const LS_PENDING_KEY = 'edi_timber_pending_sync';

function loadFromLS(): Partial<AppData> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveToLS(data: Partial<AppData>) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(data));
  } catch {}
}

function loadPendingFromLS(): PendingItem[] {
  try {
    const raw = localStorage.getItem(LS_PENDING_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function savePendingToLS(items: PendingItem[]) {
  try {
    localStorage.setItem(LS_PENDING_KEY, JSON.stringify(items));
  } catch {}
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [state, dispatch] = useReducer(reducer, initialState);
  // Ref espelhando a fila pendente — evita closures desatualizadas dentro
  // dos listeners de online/offline e do retry automático.
  const pendingRef = useRef<PendingItem[]>([]);

  const setPending = useCallback((items: PendingItem[]) => {
    pendingRef.current = items;
    dispatch({ type: 'SET_PENDING', payload: items });
    savePendingToLS(items);
  }, []);

  /**
   * Enfileira um item que falhou ao salvar na nuvem, pra tentar de novo
   * automaticamente quando a conexão voltar. Substitui uma entrada
   * anterior do mesmo item (mesmo kind + mesmo id no payload), pra não
   * acumular tentativas repetidas do mesmo dado.
   */
  const enqueuePending = useCallback((kind: PendingItem['kind'], payload: any) => {
    const itemId = typeof payload === 'string' ? payload : payload?.id;
    const filtered = pendingRef.current.filter(p => {
      const pId = typeof p.payload === 'string' ? p.payload : p.payload?.id;
      return !(p.kind === kind && pId === itemId);
    });
    const entry: PendingItem = {
      id: Math.random().toString(36).slice(2, 11),
      kind,
      payload,
      createdAt: new Date().toISOString(),
    };
    setPending([...filtered, entry]);
  }, [setPending]);

  const dequeuePending = useCallback((entryId: string) => {
    setPending(pendingRef.current.filter(p => p.id !== entryId));
  }, [setPending]);

  /**
   * Executa o salvamento correspondente a um item pendente. Cada "kind"
   * mapeia pra função certa do Firebase.
   */
  const runPendingItem = useCallback(async (item: PendingItem) => {
    switch (item.kind) {
      case 'client': return fbSaveClient(item.payload);
      case 'deleteClient': return fbDeleteClient(item.payload);
      case 'document': return fbSaveDocument(item.payload);
      case 'deleteDocument': return fbDeleteDocument(item.payload);
      case 'check': return fbSaveCheck(item.payload);
      case 'deleteCheck': return fbDeleteCheck(item.payload);
      case 'stock': return fbSaveStockItem(item.payload);
      case 'deleteStock': return fbDeleteStockItem(item.payload);
      case 'settings': return fbSaveSettings(item.payload);
    }
  }, []);

  /**
   * Reenvia tudo que está na fila de pendências. Chamado automaticamente
   * quando a conexão volta (evento "online"), e também manualmente se
   * quiser forçar uma tentativa.
   */
  const flushPendingSync = useCallback(async () => {
    if (!isFirebaseConfigured() || pendingRef.current.length === 0) return;
    const items = [...pendingRef.current];
    for (const item of items) {
      try {
        await runPendingItem(item);
        dequeuePending(item.id);
      } catch {
        // continua com os próximos — esse item permanece na fila pra
        // tentar de novo na próxima vez
      }
    }
  }, [runPendingItem, dequeuePending]);

  /**
   * Salva um item na nuvem com proteção contra falha de conexão — se der
   * erro (geralmente por falta de internet), o item entra na fila de
   * pendências em vez de simplesmente perder a alteração.
   */
  const safeCloudSave = useCallback(async (kind: PendingItem['kind'], payload: any, fn: () => Promise<void>) => {
    if (!isFirebaseConfigured()) return;
    try {
      await fn();
    } catch (err) {
      console.error(`Falha ao sincronizar (${kind}), guardando pra tentar de novo depois:`, err);
      enqueuePending(kind, payload);
    }
  }, [enqueuePending]);

  // ── Bootstrap ──────────────────────────────────────────────────────────────
  useEffect(() => {
    // 1. Load from localStorage immediately
    const local = loadFromLS();
    if (local.clients || local.documents || local.settings || (local as any).bouncedChecks || (local as any).stockItems) {
      dispatch({ type: 'LOAD_LOCAL', payload: local as any });
    }

    // 1b. Restaura fila de sincronização pendente de uma sessão anterior
    // (ex: o usuário fechou o app ainda offline com alterações não salvas)
    const pending = loadPendingFromLS();
    if (pending.length > 0) {
      pendingRef.current = pending;
      dispatch({ type: 'SET_PENDING', payload: pending });
    }

    // 2. Try Firebase
    const ok = initFirebase();
    dispatch({ type: 'SET_FIREBASE_READY', payload: ok });

    if (ok) {
      syncFromFirebase();
      // Se já tinha pendências salvas de antes e a conexão está ok, tenta
      // sincronizar assim que o app abre.
      if (pending.length > 0 && navigator.onLine) {
        flushPendingSync();
      }
    }

    // 3. Monitor de conexão — atualiza o indicador visual e dispara o
    // reenvio automático da fila assim que a internet voltar.
    const handleOnline = () => {
      dispatch({ type: 'SET_ONLINE', payload: true });
      flushPendingSync();
    };
    const handleOffline = () => {
      dispatch({ type: 'SET_ONLINE', payload: false });
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 4. Reforço: tenta reenviar a fila periodicamente mesmo sem o evento
    // "online" disparar (às vezes o navegador não detecta certinho —
    // "conectado ao wifi" nem sempre significa "com internet de verdade").
    const interval = setInterval(() => {
      if (navigator.onLine && pendingRef.current.length > 0) {
        flushPendingSync();
      }
    }, 20000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Persist to localStorage ────────────────────────────────────────────────
  useEffect(() => {
    saveToLS({
      clients: state.clients,
      documents: state.documents,
      settings: state.settings,
      bouncedChecks: state.bouncedChecks,
      stockItems: state.stockItems,
    } as any);
  }, [state.clients, state.documents, state.settings, state.bouncedChecks, state.stockItems]);

  // ── Firebase sync ─────────────────────────────────────────────────────────
  const syncFromFirebase = useCallback(async () => {
    if (!isFirebaseConfigured()) return;
    dispatch({ type: 'SET_SYNCING', payload: true });
    try {
      const [clients, documents, settings, checks] = await Promise.all([
        fbLoadClients(),
        fbLoadDocuments(),
        fbLoadSettings(),
        fbLoadChecks(),
      ]);
      dispatch({ type: 'SET_CLIENTS', payload: clients });
      dispatch({ type: 'SET_DOCUMENTS', payload: documents });
      dispatch({ type: 'SET_CHECKS', payload: checks });
      const stock = await fbLoadStockItems();
      dispatch({ type: 'SET_STOCK', payload: stock });
      if (settings) dispatch({ type: 'UPDATE_SETTINGS', payload: settings });
      dispatch({ type: 'SET_LAST_SYNC', payload: new Date().toISOString() });
    } catch (e) {
      console.error('Firebase sync failed', e);
    } finally {
      dispatch({ type: 'SET_SYNCING', payload: false });
    }
  }, []);

  // ── CRUD helpers ──────────────────────────────────────────────────────────
  const saveClient = useCallback(async (client: Client) => {
    dispatch({
      type: client.id && state.clients.find(c => c.id === client.id)
        ? 'UPDATE_CLIENT'
        : 'ADD_CLIENT',
      payload: client,
    });
    await safeCloudSave('client', client, () => fbSaveClient(client));
  }, [state.clients, safeCloudSave]);

  const deleteClient = useCallback(async (id: string) => {
    dispatch({ type: 'DELETE_CLIENT', payload: id });
    await safeCloudSave('deleteClient', id, () => fbDeleteClient(id));
  }, [safeCloudSave]);

  const saveDocument = useCallback(async (document: Document) => {
    dispatch({ type: 'ADD_DOCUMENT', payload: document });
    await safeCloudSave('document', document, () => fbSaveDocument(document));
  }, [safeCloudSave]);

  const deleteDocument = useCallback(async (id: string) => {
    dispatch({ type: 'DELETE_DOCUMENT', payload: id });
    await safeCloudSave('deleteDocument', id, () => fbDeleteDocument(id));
  }, [safeCloudSave]);

  const saveCheck = useCallback(async (check: BouncedCheck) => {
    dispatch({
      type: state.bouncedChecks.find(c => c.id === check.id) ? 'UPDATE_CHECK' : 'ADD_CHECK',
      payload: check,
    });
    await safeCloudSave('check', check, () => fbSaveCheck(check));
  }, [state.bouncedChecks, safeCloudSave]);

  const deleteCheck = useCallback(async (id: string) => {
    dispatch({ type: 'DELETE_CHECK', payload: id });
    await safeCloudSave('deleteCheck', id, () => fbDeleteCheck(id));
  }, [safeCloudSave]);

  const saveStockItem = useCallback(async (item: StockItem) => {
    // Firestore rejeita campos com valor undefined — remove antes de salvar
    const clean = Object.fromEntries(
      Object.entries(item).filter(([, v]) => v !== undefined)
    ) as StockItem;
    dispatch({
      type: state.stockItems.find(s => s.id === clean.id) ? 'UPDATE_STOCK' : 'ADD_STOCK',
      payload: clean,
    });
    await safeCloudSave('stock', clean, () => fbSaveStockItem(clean));
  }, [state.stockItems, safeCloudSave]);

  const deleteStockItem = useCallback(async (id: string) => {
    dispatch({ type: 'DELETE_STOCK', payload: id });
    await safeCloudSave('deleteStock', id, () => fbDeleteStockItem(id));
  }, [safeCloudSave]);

  /**
   * Ajusta a quantidade de um item de estoque e registra o movimento.
   * delta positivo = entrada, negativo = saída. Usado tanto para ajustes
   * manuais quanto para a baixa automática quando um documento é marcado
   * como Concluído/Entregue.
   */
  const adjustStock = useCallback(async (
    stockItemId: string,
    delta: number,
    motivo: string,
    doc?: { id: string; number: string; type: 'pedido' | 'romaneio' | 'notaentrega' }
  ) => {
    const item = state.stockItems.find(s => s.id === stockItemId);
    if (!item) return;

    const movement: StockMovement = {
      id: Math.random().toString(36).slice(2, 11),
      tipo: delta > 0 ? 'entrada' : (delta < 0 ? 'saida' : 'ajuste'),
      quantidade: Math.abs(delta),
      motivo,
      date: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      ...(doc ? { documentId: doc.id, documentNumber: doc.number, documentType: doc.type } : {}),
    };

    const updated: StockItem = {
      ...item,
      quantidadeAtual: Math.max(0, Math.round((item.quantidadeAtual + delta) * 1000) / 1000),
      movements: [movement, ...(item.movements || [])],
      updatedAt: new Date().toISOString(),
    };

    await saveStockItem(updated);
  }, [state.stockItems, saveStockItem]);

  const saveSettings = useCallback(async (settings: AppSettings) => {
    dispatch({ type: 'UPDATE_SETTINGS', payload: settings });
    await safeCloudSave('settings', settings, () => fbSaveSettings(settings));
  }, [safeCloudSave]);

  return (
    <AppContext.Provider
      value={{
        state,
        dispatch,
        saveClient,
        deleteClient,
        saveDocument,
        deleteDocument,
        saveSettings,
        saveCheck,
        deleteCheck,
        saveStockItem,
        deleteStockItem,
        adjustStock,
        syncFromFirebase,
        flushPendingSync,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
};
