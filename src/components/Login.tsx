import React, { useState } from 'react';
import { Lock, Mail, Eye, EyeOff } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════
// Credenciais de acesso — troque aqui se precisar alterar e-mail/senha
// ═══════════════════════════════════════════════════════════════════════
// ⚠️ TROQUE aqui o e-mail e senha de acesso do Portal de Itaboraí
const VALID_EMAIL = 'contato@portaldeitaborai.com.br';
const VALID_PASSWORD = '65432';

const AUTH_KEY = 'portal_itaborai_auth';

export function isAuthenticated(): boolean {
  return localStorage.getItem(AUTH_KEY) === 'true';
}

export function logout() {
  localStorage.removeItem(AUTH_KEY);
  window.location.reload();
}

export const Login: React.FC<{ onSuccess: () => void }> = ({ onSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (
      email.trim().toLowerCase() === VALID_EMAIL.toLowerCase() &&
      password === VALID_PASSWORD
    ) {
      localStorage.setItem(AUTH_KEY, 'true');
      onSuccess();
    } else {
      setError('E-mail ou senha incorretos.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 via-green-800 to-green-700 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo / Title */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-4xl mx-auto mb-4 shadow-lg">
            🌲
          </div>
          <h1 className="text-2xl font-black text-white">Portal de Itaboraí</h1>
          <p className="text-green-200 text-sm mt-1">Acesso restrito</p>
        </div>

        {/* Form card */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-2xl p-6 space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">E-mail</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-green-600 text-sm transition-colors"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Senha</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••"
                className="w-full pl-10 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-green-600 text-sm transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-red-600 text-xs font-bold text-center bg-red-50 border border-red-200 rounded-lg py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="w-full bg-green-700 text-white py-3 rounded-xl font-bold hover:bg-green-800 active:scale-95 transition-all"
          >
            Entrar
          </button>
        </form>

        <p className="text-center text-green-200 text-[10px] mt-6">
          Sistema de Gestão Comercial de Madeiras
        </p>
      </div>
    </div>
  );
};
