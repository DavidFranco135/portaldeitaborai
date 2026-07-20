import React, { useState, useMemo, useRef } from 'react';
import { useApp } from '../store/AppContext';
import { BouncedCheck } from '../types';
import {
  Plus, Search, Trash2, Edit2, X, Camera, CheckCircle2, Clock,
  AlertTriangle, Image as ImageIcon, Calendar, Banknote, Printer,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { buildChequesReportHTML } from '../lib/chequesReportHTML';
import { format, parseISO } from 'date-fns';

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const MOTIVOS = [
  'Sem fundos',
  'Divergência de assinatura',
  'Conta encerrada',
  'Sustado pelo emitente',
  'Folha de cheque cancelada/extraviada',
  'Bloqueado judicialmente',
  'Devolução por insuficiência (2ª apresentação)',
  'Outro',
];

const EMPTY: Partial<BouncedCheck> = {
  status: 'aguardando',
  motivo: MOTIVOS[0],
};

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Comprime e redimensiona uma imagem antes de salvar como base64.
 * Fotos de celular sem compressão facilmente passam de 1MB, que é o
 * limite por documento no Firestore — isso causava falha silenciosa
 * ao salvar mais de uma foto.
 */
function compressImage(file: File, maxDimension = 1280, quality = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDimension) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else if (height > maxDimension) {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas não suportado')); return; }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export const ChequesDevolvidos: React.FC = () => {
  const { state, saveCheck, deleteCheck } = useApp();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'aguardando' | 'pago'>('todos');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<BouncedCheck>>(EMPTY);
  const [photos, setPhotos] = useState<Array<{ id: string; data: string; label?: string }>>([]);
  const [saving, setSaving] = useState(false);
  const [viewPhoto, setViewPhoto] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const checks = state.bouncedChecks || [];

  const filtered = useMemo(() => {
    return checks.filter(c => {
      if (statusFilter !== 'todos' && c.status !== statusFilter) return false;
      if (search && !c.clientName.toLowerCase().includes(search.toLowerCase()) &&
          !(c.numero || '').includes(search) &&
          !(c.banco || '').toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    }).sort((a, b) => (b.dataDevolucao || b.createdAt).localeCompare(a.dataDevolucao || a.createdAt));
  }, [checks, search, statusFilter]);

  const totals = useMemo(() => {
    const aguardando = checks.filter(c => c.status === 'aguardando');
    const pago = checks.filter(c => c.status === 'pago');
    return {
      aguardandoCount: aguardando.length,
      aguardandoValor: aguardando.reduce((s, c) => s + c.valor, 0),
      pagoCount: pago.length,
      pagoValor: pago.reduce((s, c) => s + c.valor, 0),
    };
  }, [checks]);

  const openNew = () => {
    setForm({ ...EMPTY, dataDevolucao: new Date().toISOString().split('T')[0] });
    setEditId(null);
    setPhotos([]);
    setShowForm(true);
  };

  const openEdit = (c: BouncedCheck) => {
    setForm({ ...c });
    setEditId(c.id);
    // Merge legacy single photo + new photos array
    const existing = [...(c.photos || [])];
    if (c.photoData && !existing.some(p => p.data === c.photoData)) {
      existing.unshift({ id: 'legacy', data: c.photoData, label: 'Cheque' });
    }
    setPhotos(existing);
    setShowForm(true);
  };

  const close = () => {
    setShowForm(false);
    setForm(EMPTY);
    setEditId(null);
    setPhotos([]);
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    e.target.value = '';
    try {
      const newPhotos = await Promise.all(
        files.map(async f => ({
          id: Math.random().toString(36).slice(2, 9),
          data: await compressImage(f),
        }))
      );
      setPhotos(prev => [...prev, ...newPhotos]);
    } catch (err) {
      console.error(err);
      alert('Erro ao carregar imagem. Tente uma foto de cada vez.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.clientName || !form.valor) return;
    const now = new Date().toISOString();
    const rawCheck: any = {
      ...form,
      id: editId || Math.random().toString(36).slice(2, 11),
      clientName: form.clientName!,
      valor: form.valor!,
      motivo: form.motivo || 'Outro',
      status: form.status || 'aguardando',
      photos: photos.length > 0 ? photos : [],
      createdAt: editId
        ? checks.find(c => c.id === editId)?.createdAt || now
        : now,
      updatedAt: now,
    };
    delete rawCheck.photoData; // migrated to photos[]

    // Firestore rejects `undefined` field values — strip them out
    const check = Object.fromEntries(
      Object.entries(rawCheck).filter(([, v]) => v !== undefined)
    ) as unknown as BouncedCheck;

    // Estimativa de tamanho — Firestore rejeita documentos acima de ~1MB
    const approxSizeKB = Math.round(JSON.stringify(check).length / 1024);
    if (approxSizeKB > 950) {
      alert(
        `As fotos estão muito pesadas (~${approxSizeKB}KB, limite ~1000KB).\n\n` +
        `Remova uma foto ou tire fotos com menor qualidade antes de salvar.`
      );
      return;
    }

    setSaving(true);
    try {
      await saveCheck(check);
      close();
    } catch (err: any) {
      console.error('Erro ao salvar cheque:', err);
      alert(
        'Não foi possível salvar o cheque.\n\n' +
        (err?.message || 'Erro desconhecido. Verifique sua conexão e tente novamente.')
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este cheque do controle?')) return;
    await deleteCheck(id);
  };

  const handlePrintReport = () => {
    const win = window.open('', '_blank');
    if (!win) { alert('Pop-up bloqueado. Permita pop-ups e tente novamente.'); return; }
    const filterLabel = statusFilter === 'todos' ? 'Todos os status'
      : statusFilter === 'aguardando' ? 'Aguardando pagamento' : 'Pagos';
    win.document.write(buildChequesReportHTML(filtered, state.settings, filterLabel));
    win.document.close();
  };

  const handlePrintSingle = (c: BouncedCheck) => {
    const win = window.open('', '_blank');
    if (!win) { alert('Pop-up bloqueado. Permita pop-ups e tente novamente.'); return; }
    win.document.write(buildChequesReportHTML([c], state.settings, `Cheque de ${c.clientName}`));
    win.document.close();
  };

  const toggleStatus = async (c: BouncedCheck) => {
    const newStatus = c.status === 'pago' ? 'aguardando' : 'pago';
    await saveCheck({
      ...c,
      status: newStatus,
      dataPagamento: newStatus === 'pago' ? new Date().toISOString().split('T')[0] : undefined,
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <div className="space-y-6 pb-24 md:pb-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-green-800">Cheques Devolvidos</h1>
          <p className="text-gray-500 text-sm">Controle de cheques que voltaram do banco</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handlePrintReport}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-bold shadow-md hover:bg-indigo-700 transition-all">
            <Printer className="w-4 h-4" /> Relatório PDF
          </button>
          <button onClick={openNew}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-green-700 text-white rounded-xl font-bold shadow-md hover:bg-green-800 transition-all">
            <Plus className="w-4 h-4" /> Novo Cheque
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-red-600" />
            <p className="text-[10px] font-bold uppercase tracking-wider text-red-600">Aguardando</p>
          </div>
          <p className="text-xl font-black text-red-700">{fmt(totals.aguardandoValor)}</p>
          <p className="text-[10px] text-red-400">{totals.aguardandoCount} cheque{totals.aguardandoCount !== 1 ? 's' : ''}</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <p className="text-[10px] font-bold uppercase tracking-wider text-green-600">Pagos</p>
          </div>
          <p className="text-xl font-black text-green-700">{fmt(totals.pagoValor)}</p>
          <p className="text-[10px] text-green-400">{totals.pagoCount} cheque{totals.pagoCount !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por cliente, número ou banco..."
            className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl outline-none focus:border-green-600 shadow-sm text-sm"
          />
        </div>
        <div className="flex gap-1 p-1 bg-white border border-gray-200 rounded-xl">
          {(['todos', 'aguardando', 'pago'] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={[
                'px-4 py-2 rounded-lg text-xs font-bold transition-all capitalize',
                statusFilter === s ? 'bg-green-700 text-white shadow' : 'text-gray-500 hover:bg-gray-100'
              ].join(' ')}
            >
              {s === 'todos' ? 'Todos' : s === 'aguardando' ? 'Aguardando' : 'Pagos'}
            </button>
          ))}
        </div>
      </div>

      {/* Form Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            >
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                <h2 className="text-lg font-black text-green-800">
                  {editId ? 'Editar Cheque' : 'Novo Cheque Devolvido'}
                </h2>
                <button onClick={close} className="p-1 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <Field label="Cliente *">
                  <select
                    value={form.clientId || ''}
                    onChange={e => {
                      const c = state.clients.find(x => x.id === e.target.value);
                      setForm(p => ({ ...p, clientId: e.target.value, clientName: c?.name || p.clientName }));
                    }}
                    className={INP}
                  >
                    <option value="">— Selecionar cadastrado —</option>
                    {[...state.clients].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <input
                    required
                    value={form.clientName || ''}
                    onChange={e => setForm(p => ({ ...p, clientName: e.target.value }))}
                    placeholder="Ou digitar nome do cliente..."
                    className={INP + ' mt-2'}
                  />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Nº do Cheque">
                    <input value={form.numero || ''} onChange={e => setForm(p => ({ ...p, numero: e.target.value }))}
                      placeholder="000123" className={INP} />
                  </Field>
                  <Field label="Banco">
                    <input value={form.banco || ''} onChange={e => setForm(p => ({ ...p, banco: e.target.value }))}
                      placeholder="Ex: Bradesco" className={INP} />
                  </Field>
                </div>

                <Field label="Valor *">
                  <input required type="number" step="0.01" value={form.valor || ''}
                    onChange={e => setForm(p => ({ ...p, valor: parseFloat(e.target.value) || 0 }))}
                    placeholder="R$ 0,00" className={INP} />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Data de Emissão">
                    <input type="date" value={form.dataEmissao || ''}
                      onChange={e => setForm(p => ({ ...p, dataEmissao: e.target.value }))} className={INP} />
                  </Field>
                  <Field label="Data da Devolução">
                    <input type="date" value={form.dataDevolucao || ''}
                      onChange={e => setForm(p => ({ ...p, dataDevolucao: e.target.value }))} className={INP} />
                  </Field>
                </div>

                <Field label="Motivo da Devolução">
                  <select value={form.motivo || MOTIVOS[0]} onChange={e => setForm(p => ({ ...p, motivo: e.target.value }))} className={INP}>
                    {MOTIVOS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </Field>

                <Field label="Status">
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setForm(p => ({ ...p, status: 'aguardando' }))}
                      className={[
                        'py-2.5 rounded-lg text-sm font-bold border-2 transition-all flex items-center justify-center gap-2',
                        form.status === 'aguardando' ? 'border-red-400 bg-red-50 text-red-700' : 'border-gray-200 text-gray-400'
                      ].join(' ')}>
                      <Clock className="w-4 h-4" /> Aguardando
                    </button>
                    <button type="button" onClick={() => setForm(p => ({ ...p, status: 'pago' }))}
                      className={[
                        'py-2.5 rounded-lg text-sm font-bold border-2 transition-all flex items-center justify-center gap-2',
                        form.status === 'pago' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-400'
                      ].join(' ')}>
                      <CheckCircle2 className="w-4 h-4" /> Pago
                    </button>
                  </div>
                </Field>

                {form.status === 'pago' && (
                  <Field label="Data do Pagamento">
                    <input type="date" value={form.dataPagamento || ''}
                      onChange={e => setForm(p => ({ ...p, dataPagamento: e.target.value }))} className={INP} />
                  </Field>
                )}

                <Field label="Observações">
                  <textarea value={form.notes || ''} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                    className={INP + ' min-h-[60px] resize-none'} placeholder="Detalhes adicionais..." />
                </Field>

                {/* Photo attachments — multiple */}
                <Field label="Fotos (cheque, comprovante de pagamento, etc.)">
                  <input ref={fileRef} type="file" accept="image/*" multiple
                    onChange={handlePhotoSelect} className="hidden" />
                  {photos.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 mb-2">
                      {photos.map((p, i) => (
                        <div key={p.id} className="relative group">
                          <img src={p.data} alt={p.label || `Foto ${i+1}`}
                            className="w-full h-24 object-cover rounded-lg border border-gray-200 bg-gray-50" />
                          <button type="button"
                            onClick={() => setPhotos(prev => prev.filter(x => x.id !== p.id))}
                            className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full shadow hover:bg-red-600 transition-all">
                            <X className="w-3 h-3" />
                          </button>
                          <input
                            value={p.label || ''}
                            onChange={e => setPhotos(prev => prev.map(x => x.id === p.id ? { ...x, label: e.target.value } : x))}
                            placeholder={i === 0 ? 'ex: Cheque' : 'ex: Comprovante'}
                            className="w-full mt-1 text-[10px] p-1 border border-gray-200 rounded text-center outline-none focus:border-green-500"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  <button type="button" onClick={() => fileRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 py-4 border-2 border-dashed border-gray-300 rounded-lg text-gray-400 hover:border-green-400 hover:text-green-600 transition-all">
                    <Camera className="w-5 h-5" />
                    <span className="text-xs font-bold">
                      {photos.length > 0 ? 'Adicionar mais fotos' : 'Tirar foto ou escolher da galeria'}
                    </span>
                  </button>
                </Field>

                <div className="flex gap-3 pt-2">
                  <button type="submit" disabled={saving}
                    className="flex-1 bg-green-700 text-white py-2.5 rounded-xl font-bold hover:bg-green-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
                    {saving ? 'Salvando...' : editId ? 'Atualizar' : 'Salvar Cheque'}
                  </button>
                  <button type="button" onClick={close} disabled={saving}
                    className="px-6 py-2.5 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-colors disabled:opacity-60">
                    Cancelar
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Photo viewer */}
      <AnimatePresence>
        {viewPhoto && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setViewPhoto(null)}
            className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          >
            <img src={viewPhoto} alt="Cheque" className="max-w-full max-h-full rounded-lg" />
            <button onClick={() => setViewPhoto(null)}
              className="absolute top-4 right-4 p-2 bg-white/20 text-white rounded-full hover:bg-white/30">
              <X className="w-5 h-5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* List */}
      <div className="space-y-3">
        {filtered.map(c => (
          <div key={c.id}
            className={[
              'bg-white border rounded-xl p-4 shadow-sm hover:shadow-md transition-all',
              c.status === 'pago' ? 'border-green-200' : 'border-red-200'
            ].join(' ')}
          >
            <div className="flex items-start gap-3">
              {/* Photo thumbnails */}
              {(() => {
                const allPhotos = [
                  ...(c.photos || []),
                  ...(c.photoData && !(c.photos || []).some(p => p.data === c.photoData)
                    ? [{ id: 'legacy', data: c.photoData, label: 'Cheque' }] : []),
                ];
                return allPhotos.length > 0 ? (
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    {allPhotos.slice(0, 2).map((p, i) => (
                      <button key={p.id} onClick={() => setViewPhoto(p.data)}
                        title={p.label}
                        className="w-14 h-14 rounded-lg overflow-hidden border border-gray-200 relative">
                        <img src={p.data} alt={p.label || 'Foto'} className="w-full h-full object-cover" />
                        {i === 1 && allPhotos.length > 2 && (
                          <span className="absolute inset-0 bg-black/60 text-white text-xs font-black flex items-center justify-center">
                            +{allPhotos.length - 2}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0 border border-dashed border-gray-200">
                    <ImageIcon className="w-5 h-5 text-gray-300" />
                  </div>
                );
              })()}

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-black text-gray-900 truncate">{c.clientName}</p>
                    <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-0.5">
                      {c.numero && <span>Cheque Nº {c.numero}</span>}
                      {c.banco && <span>• {c.banco}</span>}
                    </div>
                  </div>
                  <p className="font-black text-gray-900 flex-shrink-0">{fmt(c.valor)}</p>
                </div>

                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                    <AlertTriangle className="w-2.5 h-2.5" /> {c.motivo}
                  </span>
                  {c.dataDevolucao && (
                    <span className="text-[10px] text-gray-400 flex items-center gap-1">
                      <Calendar className="w-2.5 h-2.5" />
                      Devolvido {format(parseISO(c.dataDevolucao + 'T12:00:00'), 'dd/MM/yyyy')}
                    </span>
                  )}
                </div>

                {c.notes && <p className="text-xs text-gray-500 mt-1.5 italic">{c.notes}</p>}

                <div className="flex items-center gap-2 mt-3">
                  <button onClick={() => toggleStatus(c)}
                    className={[
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                      c.status === 'pago'
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-red-100 text-red-700 hover:bg-red-200'
                    ].join(' ')}
                  >
                    {c.status === 'pago'
                      ? <><CheckCircle2 className="w-3.5 h-3.5" /> Pago</>
                      : <><Clock className="w-3.5 h-3.5" /> Aguardando</>}
                  </button>
                  {c.status === 'pago' && c.dataPagamento && (
                    <span className="text-[10px] text-green-500">
                      em {format(parseISO(c.dataPagamento + 'T12:00:00'), 'dd/MM/yyyy')}
                    </span>
                  )}
                  <button onClick={() => handlePrintSingle(c)}
                    className="ml-auto p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all">
                    <Printer className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => openEdit(c)}
                    className="p-1.5 text-gray-400 hover:text-green-700 hover:bg-green-50 rounded-lg transition-all">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(c.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-16 bg-white border border-dashed border-gray-200 rounded-xl">
            <Banknote className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-400 italic text-sm">Nenhum cheque devolvido encontrado.</p>
          </div>
        )}
      </div>
    </div>
  );
};

const INP = 'w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-green-600 text-sm transition-colors';

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="space-y-1">
    <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</label>
    {children}
  </div>
);
