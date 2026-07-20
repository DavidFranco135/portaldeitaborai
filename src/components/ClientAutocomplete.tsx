import React, { useState, useRef, useEffect } from 'react';
import { Client } from '../types';
import { Search, MapPin } from 'lucide-react';

interface Props {
  value: string;
  clients: Client[];
  onSelect: (client: Client) => void;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

/**
 * Campo de busca de cliente com dropdown próprio (não depende do
 * <datalist> nativo do navegador, que é inconsistente entre celulares —
 * no iPhone/Safari nem funciona, e no Android o toque na sugestão às
 * vezes perde o foco antes de registrar a seleção).
 */
export const ClientAutocomplete: React.FC<Props> = ({
  value, clients, onSelect, onChangeText, placeholder,
}) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const query = value.trim().toLowerCase();
  const filtered = query
    ? clients.filter(c => c.name.toLowerCase().includes(query)).slice(0, 8)
    : clients.slice(0, 8);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        <input
          value={value}
          onChange={e => { onChangeText(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder || 'Ou digitar nome manualmente...'}
          className="w-full mt-1 pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:border-green-600 outline-none"
        />
      </div>

      {open && filtered.length > 0 && (
        <div className="absolute z-30 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-xl max-h-56 overflow-y-auto">
          {filtered.map(c => (
            <button
              key={c.id}
              type="button"
              onMouseDown={e => {
                // onMouseDown (não onClick) garante que a seleção é
                // registrada ANTES do input perder o foco no celular.
                e.preventDefault();
                onSelect(c);
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2.5 text-sm hover:bg-green-50 active:bg-green-100 border-b border-gray-50 last:border-0 transition-colors"
            >
              <div className="font-bold text-gray-800">{c.name}</div>
              {c.city && (
                <div className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5">
                  <MapPin className="w-2.5 h-2.5" /> {c.city}{c.state ? ' — ' + c.state : ''}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
