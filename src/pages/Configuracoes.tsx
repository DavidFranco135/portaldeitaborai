import React, { useState, useEffect } from 'react';
import { useApp } from '../store/AppContext';
import { AppSettings } from '../types';
import { Save, Plus, Trash2, Cloud, CloudOff, AlertCircle, CheckCircle2, LogOut } from 'lucide-react';
import { logout } from '../components/Login';

const INPUT = 'w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-green-600 text-sm';

export const Configuracoes: React.FC = () => {
  const { state, saveSettings, syncFromFirebase } = useApp();
  const [form, setForm] = useState<AppSettings>({ ...state.settings });
  const [saved, setSaved] = useState(false);

  // A tela pode abrir antes dos dados reais chegarem do Firebase (a
  // busca é assíncrona) — sem isso, o formulário fica travado no valor
  // inicial (com as referências de exemplo do código) mesmo depois dos
  // dados corretos chegarem, dando a impressão de que o que foi apagado
  // "voltou", quando na verdade só a tela não tinha atualizado sozinha.
  useEffect(() => {
    setForm({ ...state.settings });
  }, [state.settings]);

  const handleSave = async () => {
    await saveSettings(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const addPriceRef = () => {
    setForm(p => ({
      ...p,
      priceRefs: [
        ...p.priceRefs,
        {
          id: Math.random().toString(36).slice(2, 9),
          desc: '',
          espessura: 0,
          largura: 0,
          price: 0,
        },
      ],
    }));
  };

  const removePriceRef = (id: string) => {
    setForm(p => ({ ...p, priceRefs: p.priceRefs.filter(r => r.id !== id) }));
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-24 md:pb-8">
      <div>
        <h1 className="text-2xl font-black text-green-800">Configurações</h1>
        <p className="text-gray-500 text-sm">Dados da empresa, preços de referência e Firebase</p>
      </div>

      {/* Firebase status */}
      <div className={['rounded-xl border p-5 space-y-3', state.isFirebaseReady ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'].join(' ')}>
        <div className="flex items-center gap-3">
          {state.isFirebaseReady ? (
            <>
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
              <div>
                <p className="font-bold text-green-800 text-sm">Firebase conectado!</p>
                <p className="text-xs text-green-700">Dados sincronizados automaticamente com o Firestore.</p>
              </div>
              <button
                onClick={syncFromFirebase}
                disabled={state.isSyncing}
                className="ml-auto flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700 disabled:opacity-50"
              >
                <Cloud className="w-3.5 h-3.5" />
                {state.isSyncing ? 'Sincronizando...' : 'Sincronizar agora'}
              </button>
            </>
          ) : (
            <>
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-bold text-amber-800 text-sm">Firebase não configurado</p>
                <p className="text-xs text-amber-700">Os dados estão salvos apenas localmente neste dispositivo.</p>
              </div>
            </>
          )}
        </div>

        {!state.isFirebaseReady && (
          <div className="bg-white rounded-lg p-4 border border-amber-200 text-xs space-y-2 text-gray-700">
            <p className="font-bold text-gray-900">Como configurar o Firebase:</p>
            <ol className="list-decimal ml-4 space-y-1">
              <li>Acesse <a href="https://console.firebase.google.com" target="_blank" rel="noreferrer" className="text-blue-600 underline">console.firebase.google.com</a></li>
              <li>Crie ou selecione seu projeto</li>
              <li>Vá em <strong>Project Settings → Your apps → Web app</strong></li>
              <li>Copie o objeto <code className="bg-gray-100 px-1 rounded">firebaseConfig</code></li>
              <li>Crie o arquivo <code className="bg-gray-100 px-1 rounded">.env.local</code> na raiz do projeto com:</li>
            </ol>
            <pre className="bg-gray-900 text-green-400 p-3 rounded-lg text-[10px] overflow-x-auto mt-2">{`VITE_FIREBASE_API_KEY=sua_chave
VITE_FIREBASE_AUTH_DOMAIN=seuprojeto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=seuprojeto
VITE_FIREBASE_STORAGE_BUCKET=seuprojeto.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123:web:abc`}</pre>
            <p className="font-bold text-gray-800 mt-2">Também no Firebase Console, crie uma coleção Firestore e adicione as regras:</p>
            <pre className="bg-gray-900 text-green-400 p-3 rounded-lg text-[10px] overflow-x-auto">{`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true; // ajuste para produção
    }
  }
}`}</pre>
          </div>
        )}
      </div>

      {/* Company data */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <h2 className="font-black text-green-800">Dados da Empresa</h2>
          <button
            onClick={handleSave}
            className={['flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all', saved ? 'bg-green-100 text-green-700' : 'bg-green-700 text-white hover:bg-green-800'].join(' ')}
          >
            {saved ? <><CheckCircle2 className="w-3.5 h-3.5" /> Salvo!</> : <><Save className="w-3.5 h-3.5" /> Salvar</>}
          </button>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2 space-y-1">
            <label className={LBL}>Razão Social</label>
            <input value={form.companyName} onChange={e => setForm(p => ({ ...p, companyName: e.target.value }))} className={INPUT} />
          </div>
          <div className="space-y-1">
            <label className={LBL}>Slogan / Ramo</label>
            <input value={form.companyNeighborhood} onChange={e => setForm(p => ({ ...p, companyNeighborhood: e.target.value }))} className={INPUT} />
          </div>
          <div className="space-y-1">
            <label className={LBL}>Endereço</label>
            <input value={form.companyAddress} onChange={e => setForm(p => ({ ...p, companyAddress: e.target.value }))} className={INPUT} />
          </div>
          <div className="space-y-1">
            <label className={LBL}>Cidade / Estado</label>
            <input value={form.companyCity} onChange={e => setForm(p => ({ ...p, companyCity: e.target.value }))} className={INPUT} />
          </div>
          <div className="space-y-1">
            <label className={LBL}>CEP</label>
            <input value={form.companyCEP} onChange={e => setForm(p => ({ ...p, companyCEP: e.target.value }))} className={INPUT} />
          </div>
          <div className="space-y-1">
            <label className={LBL}>CNPJ</label>
            <input value={form.companyCNPJ} onChange={e => setForm(p => ({ ...p, companyCNPJ: e.target.value }))} className={INPUT} />
          </div>
          <div className="space-y-1">
            <label className={LBL}>Telefone</label>
            <input value={form.companyPhone} onChange={e => setForm(p => ({ ...p, companyPhone: e.target.value }))} className={INPUT} />
          </div>
          <div className="space-y-1">
            <label className={LBL}>E-mail</label>
            <input value={form.companyEmail} onChange={e => setForm(p => ({ ...p, companyEmail: e.target.value }))} className={INPUT} />
          </div>
        </div>
      </div>

      {/* Price references */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <div>
            <h2 className="font-black text-green-800">Referências de Preço</h2>
            <p className="text-xs text-gray-400">Atalhos para preencher rapidamente novos itens</p>
          </div>
          <button
            onClick={addPriceRef}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-700 text-white rounded-lg text-xs font-bold hover:bg-green-800"
          >
            <Plus className="w-3.5 h-3.5" /> Adicionar
          </button>
        </div>
        <div className="p-6 space-y-3">
          {form.priceRefs.map(ref => (
            <div key={ref.id} className="flex items-center gap-3">
              <input
                value={ref.desc}
                onChange={e => setForm(p => ({ ...p, priceRefs: p.priceRefs.map(r => r.id === ref.id ? { ...r, desc: e.target.value } : r) }))}
                className={INPUT + ' flex-1'}
                placeholder="Descrição (ex: TÁBUA PINUS 30×1.8)"
              />
              <input
                type="number"
                step="0.1"
                value={ref.espessura || ''}
                onChange={e => setForm(p => ({ ...p, priceRefs: p.priceRefs.map(r => r.id === ref.id ? { ...r, espessura: parseFloat(e.target.value) || 0 } : r) }))}
                className={INPUT + ' w-24'}
                placeholder="Bitola"
              />
              <input
                type="number"
                step="0.1"
                value={ref.largura || ''}
                onChange={e => setForm(p => ({ ...p, priceRefs: p.priceRefs.map(r => r.id === ref.id ? { ...r, largura: parseFloat(e.target.value) || 0 } : r) }))}
                className={INPUT + ' w-24'}
                placeholder="Largura"
              />
              <input
                type="number"
                value={ref.price || ''}
                onChange={e => setForm(p => ({ ...p, priceRefs: p.priceRefs.map(r => r.id === ref.id ? { ...r, price: parseFloat(e.target.value) || 0 } : r) }))}
                className={INPUT + ' w-32'}
                placeholder="R$/m³"
              />
              <button
                onClick={() => removePriceRef(ref.id)}
                className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          {form.priceRefs.length === 0 && (
            <p className="text-gray-400 italic text-sm text-center py-4">
              Nenhuma referência. Clique em Adicionar.
            </p>
          )}
          <div className="pt-2">
            <button
              onClick={handleSave}
              className="px-5 py-2 bg-green-700 text-white rounded-lg text-xs font-bold hover:bg-green-800"
            >
              Salvar referências
            </button>
          </div>
        </div>
      </div>

      {/* Conta */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <h2 className="font-black text-green-800 mb-3">Conta</h2>
        <button
          onClick={() => {
            if (confirm('Deseja sair da sua conta?')) logout();
          }}
          className="w-full flex items-center justify-center gap-2 py-3 bg-red-50 text-red-600 rounded-lg font-bold text-sm hover:bg-red-100 transition-colors"
        >
          <LogOut className="w-4 h-4" /> Sair
        </button>
      </div>
    </div>
  );
};

const LBL = 'text-[10px] font-bold uppercase tracking-wider text-gray-400 block';
