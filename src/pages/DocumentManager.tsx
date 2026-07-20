import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import { Document, Bloco, TimberItem } from '../types';
import { TimberCalculator } from '../components/TimberCalculator';
import { ProductCalculator } from '../components/ProductCalculator';
import { ClientAutocomplete } from '../components/ClientAutocomplete';
import { ChequeTable } from '../components/ChequeTable';
import { PaymentTracker } from '../components/PaymentTracker';
import { Cheque } from '../lib/cheques';
import { calcDerived } from '../lib/calc';
import { buildDocHTML } from '../lib/docHTML';
import { buildDeliveryNoteHTML } from '../lib/deliveryNoteHTML';
import { buildPaymentReportHTML } from '../lib/paymentReportHTML';
import { buildInternalBreakdownHTML } from '../lib/internalBreakdownHTML';
import { ArrowLeft, Save, Printer, Plus, Trash2, ChevronDown, ChevronUp, Building2, Upload, CheckCircle2, AlertCircle, Users, FileCheck, Copy } from 'lucide-react';
import { importFromExcel, ImportResult } from '../lib/importExcel';
import { ImportReview } from '../components/ImportReview';
import { format } from 'date-fns';

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function newBloco(label = ''): Bloco {
  return {
    id: Math.random().toString(36).slice(2, 9),
    label,
    clientName: '',
    clientId: '',
    items: [],
  };
}

function calcBlocoTotals(bloco: Bloco) {
  return bloco.items.reduce(
    (acc, item) => {
      const d = calcDerived(item);
      acc.m3 += d.finalM3;
      acc.subtotal += d.value;
      return acc;
    },
    { m3: 0, subtotal: 0 }
  );
}

export const DocumentManager: React.FC<{ type: 'pedido' | 'romaneio' | 'notaentrega' }> = ({ type }) => {
  const { state, saveDocument } = useApp();
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const fromPedidoId = searchParams.get('from');

  const nextNumber = () =>
    (state.documents.filter(d => d.type === type).length + 1)
      .toString().padStart(3, '0');

  const [doc, setDoc] = useState<Partial<Document>>({
    type,
    number: nextNumber(),
    date: new Date().toISOString().split('T')[0],
    clientId: '',
    clientName: '',
    supplier: '',
    woodType: 'pinus' as const,
    docPurpose: 'cliente' as const,
    blocos: [newBloco('Principal')],
    docMode: 'madeira' as const,
    productItems: [],
    items: [],
    subtotal: 0,
    totalM3: 0,
    total: 0,
    freight: 0,
    freightIcms: 0,
    commissionPct: state.settings.defaultCommissionPct,
    commissionValue: 0,
    settlement: 0,
    motorista: '',
    status: 'andamento',
    paymentTerms: 'À VISTA',
    paymentMethod: 'cheque' as const,
    cheques: [],
    extras: [],
    partnerName: '',
    partnerSharePct: 0,
    partnerShareMode: 'percent' as const,
    partnerShareFixed: 0,
    payments: [],
    commissionPaid: false,
    partnerPaid: false,
    notes: type === 'romaneio'
      ? 'O FRETE SERÁ PAGO À VISTA AO TRANSPORTADOR NO ATO DA DESCARGA, DEDUZIDO DO MATERIAL. MANDAR O PAGAMENTO DA MADEIRA PELO MOTORISTA.'
      : '',
  });

  const [collapsedBlocos, setCollapsedBlocos] = useState<Record<string, boolean>>({});
  const [showDocFields, setShowDocFields] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<{type: 'ok'|'err'|'warn', text: string, warnings?: any[]} | null>(null);
  const [importReview, setImportReview] = useState<ImportResult | null>(null);
  const [clientMatch, setClientMatch] = useState<{client: any, importResult: ImportResult, items: TimberItem[]} | null>(null);
  const importRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (id) {
      const ex = state.documents.find(d => d.id === id);
      if (ex) {
        // Migrate legacy doc (no blocos) to bloco format
        if (!ex.blocos || ex.blocos.length === 0) {
          setDoc({
            ...ex,
            blocos: [{
              id: 'main',
              label: 'Principal',
              clientId: ex.clientId,
              clientName: ex.clientName,
              clientData: ex.clientData,
              items: ex.items || [],
            }],
          });
        } else {
          setDoc(ex);
        }
      }
    }
    // Depende de id + state.documents.length (não o array inteiro) —
    // isso garante que o efeito rode de novo quando a lista termina de
    // carregar do Firebase (ex: logo após um reload de página, quando
    // ainda está vazia no primeiro render), sem disparar toda vez que
    // qualquer outro documento for salvo em qualquer lugar do sistema
    // (o que apagaria edições ainda não salvas neste formulário).
  }, [id, state.documents.length]);

  useEffect(() => {
    if (fromPedidoId && type === 'romaneio') {
      const pedido = state.documents.find(d => d.id === fromPedidoId);
      if (pedido) {
        const blocos = pedido.blocos && pedido.blocos.length > 0
          ? pedido.blocos.map(b => ({
              ...b,
              id: Math.random().toString(36).slice(2, 9),
              items: b.items.map(i => ({ ...i, id: Math.random().toString(36).slice(2, 9) })),
            }))
          : [{
              id: Math.random().toString(36).slice(2, 9),
              label: 'Principal',
              clientId: pedido.clientId,
              clientName: pedido.clientName,
              clientData: pedido.clientData,
              items: pedido.items.map(i => ({ ...i, id: Math.random().toString(36).slice(2, 9) })),
            }];
        setDoc(prev => ({
          ...prev,
          supplier: pedido.supplier || '',
          paymentTerms: pedido.paymentTerms,
          blocos,
        }));
      }
    }
  }, [fromPedidoId]);

  // ── Totals ────────────────────────────────────────────────────────────────
  const totals = useMemo(() => {
    if (doc.docMode === 'produtos') {
      const subtotal = (doc.productItems || []).reduce((s, it) => s + it.qty * it.priceUnit, 0);
      return { m3: 0, subtotal };
    }
    return (doc.blocos || []).reduce(
      (acc, bloco) => {
        const bt = calcBlocoTotals(bloco);
        acc.m3 += bt.m3;
        acc.subtotal += bt.subtotal;
        return acc;
      },
      { m3: 0, subtotal: 0 }
    );
  }, [doc.blocos, doc.productItems, doc.docMode]);

  const freightIcms = doc.freightIcms || 0;

  // Lista de clientes cadastrados ordenada (para autocomplete no campo manual)
  const sortedClientNames = useMemo(() =>
    [...state.clients].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })),
    [state.clients]
  );

  // Ao digitar manualmente, se o texto bater exatamente com um cliente
  // cadastrado (escolhido na lista de sugestões), vincula automaticamente
  // — assim a pessoa ganha os dados completos (endereço, CNPJ, etc.)
  const matchClientByName = (name: string) =>
    state.clients.find(c => c.name.toLowerCase() === name.trim().toLowerCase());

  // Lista de parceiros já usados antes (para sugestão/autocomplete, evita erro de digitação)
  const existingPartners = useMemo(() => {
    const names = state.documents
      .filter(d => d.partnerName && d.partnerName.trim())
      .map(d => d.partnerName!.trim());
    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [state.documents]);

  // Extras (créditos/descontos — aplicados DEPOIS da comissão)
  const extrasTotal = (doc.extras || []).reduce((s, e) => e.op === '+' ? s + e.valor : s - e.valor, 0);

  // 1. Base da comissão = subtotal − frete − acerto
  // Se houver um "Valor Negociado com a Serraria" preenchido, a comissão de
  // X% é calculada sobre ESSE valor (o preço real que você negociou),
  // não sobre o subtotal do romaneio — que pode estar mais alto porque
  // você (ou o parceiro) vendeu por um preço diferente pro cliente.
  const serrariaBaseValue = doc.serrariaBaseValue || 0;
  const usaValorServaria = serrariaBaseValue > 0;
  const temParceiro = !!(doc.partnerName && doc.partnerName.trim());

  // "Total a Pagar bruto" = subtotal − frete, ANTES de tirar a comissão.
  // É esse valor bruto que se compara com o Valor Negociado com a Serraria
  // pra achar a diferença vendida a mais — não o subtotal puro da madeira
  // (que ainda não descontou o frete).
  const totalAPagarBruto = totals.subtotal - (doc.freight || 0);

  // Diferença entre o que foi negociado com a serraria e o que o cliente
  // paga de fato. Se HOUVER parceiro, essa diferença é 100% dele. Se NÃO
  // houver parceiro, a diferença é 100% sua — é você mesmo quem negociou
  // diferente com o cliente, então fica tudo com você.
  const diferencaVenda = usaValorServaria ? Math.max(0, totalAPagarBruto - serrariaBaseValue) : 0;
  const partnerMarkup = (usaValorServaria && temParceiro) ? diferencaVenda : 0;
  const ownerMarkup = (usaValorServaria && !temParceiro) ? diferencaVenda : 0;

  const acertoDeduzDoTotal = usaValorServaria ? 0 : (doc.settlement || 0);

  // Base da comissão: DIRETO sobre o Valor Negociado com a Serraria (sem
  // subtrair frete dele — o frete é um custo de logística separado, não
  // faz parte do valor negociado da madeira em si) — ou sobre o subtotal
  // normal (menos frete/acerto) quando não há valor negociado diferente.
  const baseComissao = usaValorServaria
    ? serrariaBaseValue
    : totals.subtotal - (doc.freight || 0) - acertoDeduzDoTotal;
  const commission = doc.commissionPct ? Math.max(0, baseComissao) * (doc.commissionPct / 100) : 0;

  // "Acerto Escritório":
  // • Com parceiro: campo automático = comissão + diferença DELE, tudo
  //   junto numa linha só (deduzida no lugar da comissão separada).
  // • Sem parceiro, mas com valor negociado: campo automático = só a
  //   diferença (que é 100% sua) — aparece como linha própria, com a
  //   comissão aparecendo SEPARADA também, porque ambas são suas.
  // • Sem valor negociado: campo manual, como sempre foi.
  const acertoDisplay = usaValorServaria
    ? (temParceiro ? (partnerMarkup + commission) : ownerMarkup)
    : (doc.settlement || 0);

  // Divisão da comissão (5%) com vendedor parceiro — por porcentagem OU
  // valor fixo em R$. Só se aplica quando há parceiro de verdade.
  const partnerSharePct = doc.partnerSharePct || 0;
  const partnerShareMode = doc.partnerShareMode || 'percent';
  const partnerCommissionShare = temParceiro
    ? (partnerShareMode === 'fixed'
        ? Math.min(doc.partnerShareFixed || 0, commission) // nunca passa do total da comissão
        : (partnerSharePct > 0 ? commission * (partnerSharePct / 100) : 0))
    : 0;

  // Total que fica com o parceiro = a parte dele nos 5% + a diferença que
  // ele vendeu a mais. Total que fica com você = sua parte dos 5% + a
  // diferença sua (quando não há parceiro, ownerMarkup soma aqui).
  const partnerShareValue = partnerCommissionShare + partnerMarkup;
  const myShareValue = commission - partnerCommissionShare + ownerMarkup;

  // 2. Total = subtotal − frete − acerto − comissão ± extras
  // • Com parceiro (valor negociado): o "Acerto Escritório" JÁ INCLUI a
  //   comissão inteira dentro dele — só ele é deduzido, sem subtrair a
  //   comissão de novo (senão descontaria duas vezes). O resultado bate
  //   com o valor líquido negociado com a serraria.
  // • Sem parceiro (valor negociado): comissão E diferença são suas e
  //   aparecem/deduzem SEPARADAS — ambas saem do total.
  // • Sem valor negociado: funciona exatamente como sempre funcionou.
  const total = type === 'romaneio'
    ? (usaValorServaria
        ? (temParceiro
            ? totals.subtotal - (doc.freight || 0) - acertoDisplay + extrasTotal
            : totals.subtotal - (doc.freight || 0) - commission - acertoDisplay + extrasTotal)
        : totals.subtotal - (doc.freight || 0) - acertoDeduzDoTotal - commission + extrasTotal)
    : totals.subtotal;

  const displayDate = doc.date && !isNaN(new Date(doc.date).getTime())
    ? format(new Date(doc.date + 'T12:00:00'), 'dd/MM/yyyy')
    : '—';

  // ── Bloco helpers ─────────────────────────────────────────────────────────
  const updateBloco = (blocoId: string, patch: Partial<Bloco>) =>
    setDoc(p => ({ ...p, blocos: (p.blocos || []).map(b => b.id === blocoId ? { ...b, ...patch } : b) }));

  const addBloco = () =>
    setDoc(p => ({ ...p, blocos: [...(p.blocos || []), newBloco(`Loja ${(p.blocos || []).length + 1}`)] }));

  const removeBloco = (blocoId: string) =>
    setDoc(p => ({ ...p, blocos: (p.blocos || []).filter(b => b.id !== blocoId) }));

  const toggleBloco = (blocoId: string) =>
    setCollapsedBlocos(prev => ({ ...prev, [blocoId]: !prev[blocoId] }));

  const handleBlocoClientSelect = (blocoId: string, clientId: string) => {
    const c = state.clients.find(x => x.id === clientId);
    updateBloco(blocoId, {
      clientId,
      clientName: c?.name || '',
      clientData: c ? { ...c } : undefined,
    });
  };

  // ── Import from Excel ────────────────────────────────────────────────────
  // Find best matching client from cadastro
  const findClientMatch = (name: string) => {
    if (!name) return null;
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const normName = norm(name);
    // Exact match first
    let match = state.clients.find(c => norm(c.name) === normName);
    if (match) return match;
    // Partial match — name contains or is contained
    match = state.clients.find(c =>
      norm(c.name).includes(normName) || normName.includes(norm(c.name))
    );
    return match || null;
  };

  const applyImport = (result: ImportResult, items: typeof result.items) => {
    setDoc(prev => {
      const blocos = [...(prev.blocos || [])];
      if (blocos.length === 0) blocos.push({ id: Math.random().toString(36).slice(2,9), label: 'Principal', clientName: '', items: [] });
      blocos[0] = { ...blocos[0], items };
      return {
        ...prev,
        blocos,
        supplier: result.supplier || prev.supplier || '',
        motorista: result.motorista || prev.motorista || '',
        freight: result.freight ?? prev.freight,
        clientName: result.clientName || prev.clientName || '',
      };
    });
    const calcM3 = items.reduce((s, i) => {
      const d = i.customM3 ?? 0;
      return s + (d || 0);
    }, 0);
    // Check for client match in cadastro
    if (result.clientName) {
      const match = findClientMatch(result.clientName);
      if (match) {
        setClientMatch({ client: match, importResult: result, items });
        return;
      }
    }
    setImportMsg({
      type: 'ok',
      text: `✓ ${items.length} itens importados${result.clientName ? ` — ${result.clientName}` : ''}`,
    });
  };

  const handleImportClick = () => importRef.current?.click();

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setImporting(true);
    setImportMsg(null);
    try {
      const result = await importFromExcel(file);

      if (result.warnings && result.warnings.length > 0) {
        // Show review modal for user to choose
        setImportReview(result);
      } else {
        // No warnings — apply directly
        applyImport(result, result.items);
      }
    } catch (err: any) {
      setImportMsg({ type: 'err', text: (err as any).message || 'Erro ao importar arquivo.' });
    } finally {
      setImporting(false);
    }
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    const now = new Date().toISOString();
    const finalDoc: Document = {
      ...doc,
      id: doc.id || Math.random().toString(36).slice(2, 11),
      clientName: doc.blocos?.[0]?.clientName || doc.clientName || '—',
      items: doc.blocos?.flatMap(b => b.items) || [],
      subtotal: totals.subtotal,
      totalM3: totals.m3,
      commissionValue: commission,
      partnerShareValue,
      partnerCommissionShare,
      partnerMarkup,
      myShareValue,
      settlement: acertoDisplay, // valor exibido no PDF — automático quando há parceiro, manual quando não há
      settlementInfoOnly: usaValorServaria && temParceiro,
      total,
      createdAt: doc.createdAt || now,
      updatedAt: now,
    } as Document;
    await saveDocument(finalDoc);

    // Se este romaneio foi criado a partir de um pedido, marca o pedido
    // de origem como concluído automaticamente ao salvar o romaneio.
    if (fromPedidoId && type === 'romaneio' && !id) {
      const pedidoOrigem = state.documents.find(d => d.id === fromPedidoId);
      if (pedidoOrigem && pedidoOrigem.status !== 'concluido') {
        await saveDocument({
          ...pedidoOrigem,
          status: 'concluido',
          updatedAt: new Date().toISOString(),
        });
      }
    }

    navigate('/relatorios');
  };

  /**
   * Salva imediatamente uma alteração pontual (ex: marcar comissão como
   * recebida, registrar um pagamento) sem esperar o botão "Salvar" geral
   * e sem navegar para outra tela. Evita perder alterações ao trocar de
   * romaneio sem lembrar de salvar manualmente.
   */
  const persistDocUpdate = async (patch: Partial<Document>) => {
    const now = new Date().toISOString();
    const finalDoc: Document = {
      ...doc,
      ...patch,
      id: doc.id!,
      subtotal: totals.subtotal,
      totalM3: totals.m3,
      updatedAt: now,
    } as Document;
    setDoc(finalDoc);
    if (finalDoc.id) {
      await saveDocument(finalDoc);
    }
  };

  // PDF sempre em modo econômico — sem opção colorida, sem botão de
  // compartilhar separado (compartilhar = abrir o PDF e usar o menu
  // nativo do celular a partir dele, que já é o que acontecia antes).
  /**
   * Duplica o documento atual para um NOVO pedido/romaneio — copia cliente,
   * fornecedor, itens/blocos e condições, mas gera número novo e limpa
   * pagamentos/cheques/status, para ajustar o preço do m³ separadamente
   * (útil quando o valor vendido ao cliente é diferente do preço pago à
   * serraria no pedido de compra).
   */
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [valorLiquidoDesejado, setValorLiquidoDesejado] = useState('');
  const [duplicating, setDuplicating] = useState(false);
  const duplicatingRef = React.useRef(false); // trava síncrona — evita corrida entre cliques rápidos

  const confirmDuplicate = async (markAsReference: boolean) => {
    if (!doc.id || duplicatingRef.current) return;  // trava síncrona contra toque duplo
    duplicatingRef.current = true;
    setDuplicating(true);

    try {
      const newNumber = (state.documents.filter(d => d.type === type).length + 1)
        .toString().padStart(3, '0');

      const now = new Date().toISOString();
      const rawDuplicated: any = {
        ...doc,
        id: Math.random().toString(36).slice(2, 11),
        number: newNumber,
        date: now.split('T')[0],
        // Se for documento de referência (ex: pedido de compra da serraria
        // com preço diferente), já marca como Concluído — não vai gerar
        // romaneio próprio, então não faz sentido ficar "Em Andamento"
        // poluindo a lista de pendências.
        status: markAsReference ? 'concluido' : 'andamento',
        // Marca se é documento de referência interna (compra na serraria)
        // ou pedido normal de venda ao cliente — permite filtrar depois.
        docPurpose: markAsReference ? 'serraria' : 'cliente',
        // Limpa histórico financeiro — é um documento novo
        cheques: [],
        payments: [],
        commissionPaid: false,
        partnerPaid: false,
        // Copia estrutura de itens/blocos/produtos como estava
        blocos: (doc.blocos || []).map(b => ({
          ...b,
          id: Math.random().toString(36).slice(2, 9),
          items: b.items.map(it => ({ ...it, id: Math.random().toString(36).slice(2, 9) })),
        })),
        productItems: (doc.productItems || []).map(it => ({ ...it, id: Math.random().toString(36).slice(2, 9) })),
        extras: (doc.extras || []).map(e => ({ ...e, id: Math.random().toString(36).slice(2, 9) })),
        createdAt: now,
        updatedAt: now,
      };
      // commissionPaidDate/partnerPaidDate não fazem sentido num documento
      // novo — remove em vez de deixar como `undefined`, pois o Firestore
      // rejeita campos com valor undefined e a gravação falharia em silêncio.
      delete rawDuplicated.commissionPaidDate;
      delete rawDuplicated.partnerPaidDate;

      const duplicated = Object.fromEntries(
        Object.entries(rawDuplicated).filter(([, v]) => v !== undefined)
      ) as unknown as Document;

      await saveDocument(duplicated);
      setShowDuplicateModal(false);
      // Navegação via React Router (sem recarregar a página) — agora que
      // o efeito que sincroniza o documento reage corretamente à mudança
      // de id, isso é suficiente e é bem mais rápido que um reload completo.
      const routeSegment = type === 'pedido' ? 'pedidos' : type === 'romaneio' ? 'romaneios' : 'notas-entrega';
      navigate(`/${routeSegment}/${duplicated.id}`);
    } catch (err: any) {
      console.error('Erro ao duplicar documento:', err);
      alert(
        'Não foi possível duplicar o documento.\n\n' +
        (err?.message || 'Erro desconhecido. Verifique sua conexão e tente novamente.')
      );
    } finally {
      duplicatingRef.current = false;
      setDuplicating(false);
    }
  };

  const getHTML = () => {
    const clientObj = (doc.blocos?.[0]?.clientData || state.clients.find(c => c.id === doc.blocos?.[0]?.clientId) || {}) as Record<string, any>;

    // Nota de Entrega usa um PDF próprio, bem mais simples (sem comissão,
    // frete, cheques) — só confirmação de itens entregues e assinaturas.
    if (type === 'notaentrega') {
      return buildDeliveryNoteHTML(doc as Document, clientObj, state.settings);
    }

    return buildDocHTML({
    doc: { ...doc, settlement: acertoDisplay, settlementInfoOnly: usaValorServaria && temParceiro }, // garante que o PDF mostre o valor certo mesmo sem ter salvo antes
    type,
    totals,
    commission,
    total,
    displayDate,
    client: clientObj,
    settings: state.settings,
    cheques: doc.cheques || [],
    blocos: doc.blocos || [],
    eco: true,
    extras: doc.extras || [],
    extrasTotal,
    productItems: doc.productItems || [],
    });
  };

  const handlePrint = () => {
    const win = window.open('', '_blank');
    if (!win) { alert('Pop-up bloqueado. Permita pop-ups para este site e tente novamente.'); return; }
    win.document.write(getHTML());
    win.document.close();
  };

  const handlePrintPaymentReport = () => {
    if (!doc.id) {
      alert('Salve o romaneio primeiro para gerar o relatório de pagamento.');
      return;
    }
    const win = window.open('', '_blank');
    if (!win) { alert('Pop-up bloqueado. Permita pop-ups para este site e tente novamente.'); return; }
    const finalDoc: Document = {
      ...doc,
      subtotal: totals.subtotal,
      totalM3: totals.m3,
      commissionValue: commission,
      total,
    } as Document;
    win.document.write(buildPaymentReportHTML(finalDoc, state.settings));
    win.document.close();
  };

  // Relatório interno — detalha comissão, valor negociado com a serraria e
  // quem fica com o quê (você / parceiro). Documento só para guarda
  // própria, nunca deve ser enviado ao cliente ou à serraria.
  const handlePrintInternalBreakdown = () => {
    const win = window.open('', '_blank');
    if (!win) { alert('Pop-up bloqueado. Permita pop-ups para este site e tente novamente.'); return; }
    win.document.write(buildInternalBreakdownHTML(
      { ...doc, subtotal: totals.subtotal, totalM3: totals.m3 } as Document,
      {
        totals,
        freight: doc.freight || 0,
        serrariaBaseValue,
        totalAPagarBruto,
        diferencaVenda,
        commission,
        commissionPct: doc.commissionPct || 0,
        temParceiro,
        partnerName: doc.partnerName,
        partnerCommissionShare,
        partnerMarkup,
        ownerMarkup,
        myShareValue,
        partnerShareValue,
        total,
      },
      state.settings
    ));
    win.document.close();
  };

  const s = state.settings;
  const blocos = doc.blocos || [];

  return (
    <>
      {/* Duplicate document modal */}
      {showDuplicateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowDuplicateModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Copy className="w-5 h-5 text-blue-700" />
              </div>
              <div>
                <h3 className="font-black text-gray-900 text-base">Duplicar documento</h3>
                <p className="text-xs text-gray-500">Copia cliente, itens e condições — você ajusta o preço na cópia</p>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <button
                onClick={() => confirmDuplicate(true)}
                disabled={duplicating}
                className="w-full text-left p-3 rounded-xl border-2 border-green-200 bg-green-50 hover:border-green-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <p className="text-sm font-bold text-green-800 flex items-center gap-2">
                  {duplicating ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-green-700 border-t-transparent rounded-full animate-spin" />
                      Duplicando...
                    </>
                  ) : '📋 Documento de referência'}
                </p>
                {!duplicating && (
                  <p className="text-[11px] text-green-600 mt-0.5">
                    Ex: pedido de compra na serraria com preço diferente. Já marca como <strong>Concluído</strong> — não vai aparecer na lista de pendências.
                  </p>
                )}
              </button>

              <button
                onClick={() => confirmDuplicate(false)}
                disabled={duplicating}
                className="w-full text-left p-3 rounded-xl border-2 border-gray-200 hover:border-gray-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <p className="text-sm font-bold text-gray-800">🆕 Novo pedido normal</p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Fica <strong>Em Andamento</strong>, como um pedido novo de verdade.
                </p>
              </button>
            </div>

            <button onClick={() => setShowDuplicateModal(false)} disabled={duplicating}
              className="w-full py-2 text-xs font-bold text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-40">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Client match confirmation */}
      {clientMatch && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Users className="w-5 h-5 text-green-700" />
              </div>
              <div>
                <h3 className="font-black text-gray-900 text-base">Cliente encontrado!</h3>
                <p className="text-xs text-gray-500">O Excel menciona um cliente parecido com o seu cadastro</p>
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-gray-400 font-bold uppercase tracking-wider">No Excel</span>
                <span className="font-bold text-gray-600">{clientMatch.importResult.clientName}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400 font-bold uppercase tracking-wider">No Cadastro</span>
                <span className="font-black text-green-700">{clientMatch.client.name}</span>
              </div>
              {clientMatch.client.city && (
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400 font-bold uppercase tracking-wider">Cidade</span>
                  <span className="text-gray-600">{clientMatch.client.city}</span>
                </div>
              )}
            </div>
            <p className="text-sm text-gray-600 text-center">Vincular ao cliente cadastrado?</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  // Apply with client linked
                  setDoc(prev => {
                    const blocos = [...(prev.blocos || [])];
                    if (blocos.length === 0) blocos.push({ id: Math.random().toString(36).slice(2,9), label: 'Principal', clientName: '', items: [] });
                    blocos[0] = { ...blocos[0], items: clientMatch.items, clientId: clientMatch.client.id, clientName: clientMatch.client.name, clientData: { ...clientMatch.client } };
                    return { ...prev, blocos, supplier: clientMatch.importResult.supplier || prev.supplier || '', motorista: clientMatch.importResult.motorista || prev.motorista || '', freight: clientMatch.importResult.freight ?? prev.freight };
                  });
                  setImportMsg({ type: 'ok', text: `✓ ${clientMatch.items.length} itens importados — ${clientMatch.client.name} vinculado` });
                  setClientMatch(null);
                }}
                className="py-2.5 bg-green-700 text-white rounded-xl text-sm font-bold hover:bg-green-800 transition-all"
              >
                ✓ Sim, vincular
              </button>
              <button
                onClick={() => {
                  // Apply without linking
                  setImportMsg({ type: 'ok', text: `✓ ${clientMatch.items.length} itens importados` });
                  setClientMatch(null);
                }}
                className="py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-200 transition-all"
              >
                Não, manual
              </button>
            </div>
          </div>
        </div>
      )}

      {importReview && (
        <ImportReview
          warnings={importReview.warnings}
          items={importReview.items}
          freight={importReview.freight}
          commissionValue={importReview.commissionValue}
          totalMadeira={importReview.totalMadeira}
          totalAPagar={importReview.totalAPagar}
          onConfirm={(chosenItems) => {
            applyImport(importReview, chosenItems);
            setImportReview(null);
          }}
          onCancel={() => setImportReview(null)}
        />
      )}
    <div className="space-y-5 pb-32 max-w-full overflow-x-hidden">
      {/* Toolbar */}
      <div className="space-y-2">
        {/* Row 1: back + title + save */}
        <div className="flex items-center gap-2">
          <Link to="/relatorios" className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0">
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black text-green-800 capitalize leading-tight truncate">
                {type === 'pedido' ? 'Pedido' : type === 'romaneio' ? 'Romaneio' : 'Nota de Entrega'} Nº {doc.number}
              </h1>
              {doc.woodType && (
                <span className={[
                  'text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider flex-shrink-0',
                  doc.woodType === 'pinus' ? 'bg-amber-100 text-amber-700'
                    : doc.woodType === 'eucalipto' ? 'bg-red-100 text-red-700'
                    : 'bg-gray-100 text-gray-600'
                ].join(' ')}>
                  {doc.woodType}
                </span>
              )}
            </div>
            <p className="text-[10px] text-gray-400 uppercase tracking-widest leading-tight">
              {id ? 'Editando' : 'Novo documento'}
            </p>
          </div>
          {id && (
            <button onClick={() => setShowDuplicateModal(true)}
              title="Duplicar documento — útil quando o preço do m³ para a serraria é diferente do vendido ao cliente"
              className="flex-shrink-0 flex items-center gap-1 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold hover:bg-blue-100 active:scale-95 transition-all">
              <Copy className="w-3.5 h-3.5" /> Duplicar
            </button>
          )}
          <button onClick={handleSave}
            className="flex-shrink-0 flex items-center gap-1 px-3 py-2 bg-gray-800 text-white rounded-lg text-xs font-bold hover:bg-gray-900 active:scale-95 transition-all">
            <Save className="w-3.5 h-3.5" /> Salvar
          </button>
        </div>
        {/* Row 2: action buttons */}
        <div className="grid grid-cols-2 gap-1.5">
          <button onClick={handleImportClick} disabled={importing}
            className="flex items-center justify-center gap-1 py-2.5 bg-amber-500 text-white rounded-lg text-xs font-bold hover:bg-amber-600 active:scale-95 transition-all disabled:opacity-60">
            <Upload className="w-3.5 h-3.5 flex-shrink-0" /> {importing ? 'Importando...' : 'Importar Excel'}
          </button>
          <button onClick={handlePrint}
            className="flex items-center justify-center gap-1 py-2.5 bg-green-700 text-white rounded-lg text-xs font-bold hover:bg-green-800 active:scale-95 transition-all">
            <Printer className="w-3.5 h-3.5 flex-shrink-0" /> PDF / Compartilhar
          </button>
        </div>
        {type === 'romaneio' && commission > 0 && (
          <button onClick={handlePrintInternalBreakdown}
            title="PDF só pra você guardar — mostra comissão, valor negociado e quem fica com o quê. Não mande pro cliente."
            className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-amber-50 border-2 border-dashed border-amber-300 text-amber-700 rounded-lg text-xs font-bold hover:bg-amber-100 active:scale-95 transition-all">
            <FileCheck className="w-3.5 h-3.5 flex-shrink-0" /> Detalhamento Interno (guardar p/ você)
          </button>
        )}
        {/* Hidden file input */}
        <input ref={importRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportFile} />
        {/* Import feedback */}
        {importMsg && (
          <div className="space-y-1.5">
            <div className={['flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold',
              importMsg.type === 'ok' ? 'bg-green-50 border border-green-200 text-green-800'
              : importMsg.type === 'warn' ? 'bg-amber-50 border border-amber-300 text-amber-800'
              : 'bg-red-50 border border-red-200 text-red-700'].join(' ')}>
              {importMsg.type === 'ok' ? <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-green-600" />
               : importMsg.type === 'warn' ? <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-500" />
               : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
              <span>{importMsg.text}</span>
              {importMsg.warnings && importMsg.warnings.length > 0 && (
                <span className="ml-1 text-amber-700 font-black">⚠ {importMsg.warnings.length} aviso{importMsg.warnings.length > 1 ? 's' : ''}</span>
              )}
            </div>
            {importMsg.warnings && importMsg.warnings.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1.5">
                <p className="text-[10px] font-black text-amber-700 uppercase tracking-wider">⚠ Divergências encontradas no arquivo da serraria:</p>
                {importMsg.warnings.map((w: any, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-[11px] text-amber-800">
                    <span className="font-bold flex-shrink-0 text-amber-600">[{w.field}]</span>
                    <span>{w.message}</span>
                  </div>
                ))}
                <p className="text-[10px] text-amber-600 italic pt-1">Revise os valores antes de salvar.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Doc-level fields — aba deslizante (collapsível) */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <button type="button" onClick={() => setShowDocFields(s => !s)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-2">
            <span className="text-sm font-black text-gray-700">📋 Dados do Documento</span>
            {!showDocFields && (
              <span className="text-[10px] text-gray-400 font-bold">
                Nº {doc.number} · {doc.woodType || 'pinus'} · {doc.docMode === 'produtos' ? 'Produtos' : 'Madeira'}
              </span>
            )}
          </div>
          {showDocFields ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>
        {showDocFields && (
        <div className="p-4 pt-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Doc mode selector */}
        <div className="space-y-1 md:col-span-2 lg:col-span-4">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Tipo de Tabela</label>
          <div className="grid grid-cols-2 gap-2">
            <button type="button"
              onClick={() => setDoc(p => ({ ...p, docMode: 'madeira' }))}
              className={[
                'py-2.5 rounded-lg text-sm font-bold border-2 transition-all flex items-center justify-center gap-2',
                doc.docMode !== 'produtos'
                  ? 'border-green-600 bg-green-50 text-green-800'
                  : 'border-gray-200 text-gray-400 hover:border-gray-300'
              ].join(' ')}>
              🪵 Madeira Serrada (M³)
            </button>
            <button type="button"
              onClick={() => setDoc(p => ({ ...p, docMode: 'produtos' }))}
              className={[
                'py-2.5 rounded-lg text-sm font-bold border-2 transition-all flex items-center justify-center gap-2',
                doc.docMode === 'produtos'
                  ? 'border-amber-500 bg-amber-50 text-amber-800'
                  : 'border-gray-200 text-gray-400 hover:border-gray-300'
              ].join(' ')}>
              🚪 Produtos (Portas/Batentes)
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Nº Documento</label>
          <input value={doc.number || ''} onChange={e => setDoc(p => ({ ...p, number: e.target.value }))}
            className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:border-green-600 outline-none" />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Data</label>
          <input type="date" value={doc.date || ''} onChange={e => setDoc(p => ({ ...p, date: e.target.value }))}
            className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:border-green-600 outline-none" />
        </div>
        <div className="space-y-1 md:col-span-2">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Fornecedor / Fábrica</label>
          <input value={doc.supplier || ''} onChange={e => setDoc(p => ({ ...p, supplier: e.target.value }))}
            placeholder="Nome da fábrica..."
            className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:border-green-600 outline-none" />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Tipo de Madeira</label>
          <div className="grid grid-cols-3 gap-1.5">
            {([
              { val: 'pinus', label: 'Pinus', color: 'amber' },
              { val: 'eucalipto', label: 'Eucalipto', color: 'red' },
              { val: 'outro', label: 'Outro', color: 'gray' },
            ] as const).map(w => (
              <button key={w.val} type="button"
                onClick={() => setDoc(p => ({ ...p, woodType: w.val }))}
                className={[
                  'py-2 rounded-lg text-xs font-bold border-2 transition-all',
                  doc.woodType === w.val
                    ? w.color === 'amber' ? 'border-amber-500 bg-amber-50 text-amber-700'
                      : w.color === 'red' ? 'border-red-400 bg-red-50 text-red-700'
                      : 'border-gray-400 bg-gray-100 text-gray-700'
                    : 'border-gray-200 text-gray-400 hover:border-gray-300'
                ].join(' ')}
              >
                {w.label}
              </button>
            ))}
          </div>
        </div>
        {type === 'pedido' && (
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Destino do Pedido</label>
            <div className="grid grid-cols-2 gap-1.5">
              <button type="button"
                onClick={() => setDoc(p => ({ ...p, docPurpose: 'cliente' }))}
                className={[
                  'py-2 rounded-lg text-xs font-bold border-2 transition-all',
                  (doc.docPurpose || 'cliente') === 'cliente'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 text-gray-400 hover:border-gray-300'
                ].join(' ')}>
                👤 Cliente
              </button>
              <button type="button"
                onClick={() => setDoc(p => ({ ...p, docPurpose: 'serraria' }))}
                className={[
                  'py-2 rounded-lg text-xs font-bold border-2 transition-all',
                  doc.docPurpose === 'serraria'
                    ? 'border-purple-500 bg-purple-50 text-purple-700'
                    : 'border-gray-200 text-gray-400 hover:border-gray-300'
                ].join(' ')}>
                🏭 Serraria
              </button>
            </div>
          </div>
        )}
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Condição Pagamento</label>
          <div className="flex gap-1.5 mb-1.5">
            <button type="button"
              onClick={() => setDoc(p => ({ ...p, paymentMethod: 'cheque' }))}
              className={[
                'flex-1 py-1.5 rounded-lg text-[11px] font-bold border-2 transition-all',
                (doc.paymentMethod || 'cheque') === 'cheque'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 text-gray-400 hover:border-gray-300'
              ].join(' ')}>
              🏦 Cheque
            </button>
            <button type="button"
              onClick={() => setDoc(p => ({ ...p, paymentMethod: 'dinheiro' }))}
              className={[
                'flex-1 py-1.5 rounded-lg text-[11px] font-bold border-2 transition-all',
                doc.paymentMethod === 'dinheiro'
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : 'border-gray-200 text-gray-400 hover:border-gray-300'
              ].join(' ')}>
              💵 Dinheiro
            </button>
          </div>
          <input value={doc.paymentTerms || ''} onChange={e => setDoc(p => ({ ...p, paymentTerms: e.target.value }))}
            className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:border-green-600 outline-none" />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Nome do Motorista</label>
          <input value={doc.motorista || ''} onChange={e => setDoc(p => ({ ...p, motorista: e.target.value }))}
            placeholder="Ex: João da Silva"
            className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:border-green-600 outline-none" />
        </div>
        {type === 'romaneio' && <>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Frete (R$)</label>
            <input type="number" value={doc.freight || ''} onChange={e => setDoc(p => ({ ...p, freight: parseFloat(e.target.value) || 0 }))}
              className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:border-green-600 outline-none" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">ICMS do Frete (R$)</label>
            <input type="number" value={doc.freightIcms || ''} onChange={e => setDoc(p => ({ ...p, freightIcms: parseFloat(e.target.value) || 0 }))}
              placeholder="Soma ao total"
              className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:border-green-600 outline-none" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Comissão (%)</label>
            <input type="number" value={doc.commissionPct ?? ''} onChange={e => setDoc(p => ({ ...p, commissionPct: parseFloat(e.target.value) || 0 }))}
              className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:border-green-600 outline-none" />
          </div>
          {type === 'romaneio' && (
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Valor Negociado c/ Serraria (R$)</label>
              <input type="number" min="0" value={doc.serrariaBaseValue || ''}
                onChange={e => setDoc(p => ({ ...p, serrariaBaseValue: parseFloat(e.target.value) || 0 }))}
                placeholder="Deixe vazio se não houver parceiro"
                className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:border-green-600 outline-none" />
              <p className="text-[9px] text-gray-400">
                Preencha o valor <strong>bruto</strong> (antes da comissão) — só quando o parceiro vendeu por preço diferente. A comissão passa a ser calculada sobre este valor, e a diferença até o total vira lucro extra do parceiro.
              </p>

              {/* Calculadora: líquido desejado → bruto a digitar */}
              <div className="flex items-center gap-2 mt-2 p-2 bg-blue-50 border border-blue-100 rounded-lg">
                <span className="text-[9px] font-bold text-blue-600 uppercase whitespace-nowrap">Sei só o líquido:</span>
                <input type="number" min="0" value={valorLiquidoDesejado}
                  onChange={e => setValorLiquidoDesejado(e.target.value)}
                  placeholder="Ex: 22.921,68"
                  className="flex-1 min-w-0 p-1.5 border border-blue-200 rounded text-xs outline-none focus:border-blue-500 bg-white" />
                <button type="button"
                  onClick={() => {
                    const liquido = parseFloat(valorLiquidoDesejado) || 0;
                    const pct = doc.commissionPct || 0;
                    if (liquido <= 0 || pct <= 0) return;
                    const bruto = liquido / (1 - pct / 100);
                    setDoc(p => ({ ...p, serrariaBaseValue: Math.round(bruto * 100) / 100 }));
                  }}
                  disabled={!valorLiquidoDesejado || !doc.commissionPct}
                  className="px-2.5 py-1.5 bg-blue-600 text-white rounded text-[10px] font-bold hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap">
                  Calcular Bruto
                </button>
              </div>
              {valorLiquidoDesejado && doc.commissionPct ? (
                <p className="text-[9px] text-blue-500">
                  {fmt(parseFloat(valorLiquidoDesejado) || 0)} líquido ÷ (1 − {doc.commissionPct}%) = {fmt((parseFloat(valorLiquidoDesejado) || 0) / (1 - (doc.commissionPct || 0) / 100))} bruto
                </p>
              ) : null}
            </div>
          )}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Vendedor Parceiro (opcional)</label>
            <input value={doc.partnerName || ''} onChange={e => setDoc(p => ({ ...p, partnerName: e.target.value }))}
              placeholder="Nome do parceiro..."
              list="partner-suggestions"
              className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:border-green-600 outline-none" />
            <datalist id="partner-suggestions">
              {existingPartners.map(name => <option key={name} value={name} />)}
            </datalist>
          </div>
          <div className="space-y-1 md:col-span-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Repasse ao Parceiro</label>
              <div className="flex gap-1 p-0.5 bg-gray-100 rounded-lg">
                <button type="button"
                  onClick={() => setDoc(p => ({ ...p, partnerShareMode: 'percent' }))}
                  className={[
                    'px-2.5 py-1 rounded-md text-[10px] font-bold transition-all',
                    (doc.partnerShareMode || 'percent') === 'percent'
                      ? 'bg-white text-green-700 shadow-sm' : 'text-gray-400'
                  ].join(' ')}>
                  % Porcentagem
                </button>
                <button type="button"
                  onClick={() => setDoc(p => ({ ...p, partnerShareMode: 'fixed' }))}
                  className={[
                    'px-2.5 py-1 rounded-md text-[10px] font-bold transition-all',
                    doc.partnerShareMode === 'fixed'
                      ? 'bg-white text-green-700 shadow-sm' : 'text-gray-400'
                  ].join(' ')}>
                  R$ Valor Exato
                </button>
              </div>
            </div>
            {(doc.partnerShareMode || 'percent') === 'percent' ? (
              <input type="number" min="0" max="100" value={doc.partnerSharePct || ''}
                onChange={e => setDoc(p => ({ ...p, partnerSharePct: parseFloat(e.target.value) || 0 }))}
                placeholder="ex: 50 (%)"
                className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:border-green-600 outline-none" />
            ) : (
              <>
                <input type="number" min="0" value={doc.partnerShareFixed || ''}
                  onChange={e => setDoc(p => ({ ...p, partnerShareFixed: parseFloat(e.target.value) || 0 }))}
                  placeholder="ex: 350,00"
                  className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:border-green-600 outline-none" />
                <p className="text-[10px] text-gray-400">
                  Valor exato que fica com o parceiro, direto em reais — útil quando ele vende por um preço diferente pro cliente dele.
                </p>
              </>
            )}
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              Acerto escritório (R$) {usaValorServaria && <span className="text-purple-500 normal-case">— automático</span>}
            </label>
            {usaValorServaria ? (
              <div className="w-full p-2.5 border border-purple-200 bg-purple-50 rounded-lg text-sm text-purple-800 font-bold">
                {fmt(acertoDisplay)} <span className="font-normal text-purple-400 text-xs">(comissão + diferença do parceiro — deduzido do total no lugar da comissão separada)</span>
              </div>
            ) : (
              <input type="number" value={doc.settlement || ''} onChange={e => setDoc(p => ({ ...p, settlement: parseFloat(e.target.value) || 0 }))}
                className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:border-green-600 outline-none" />
            )}
          </div>
          {/* Extras */}
          <div className="space-y-2 md:col-span-2 lg:col-span-4">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Créditos / Descontos Extras</label>
              <button type="button"
                onClick={() => setDoc(p => ({ ...p, extras: [...(p.extras||[]), { id: Math.random().toString(36).slice(2,9), desc: '', valor: 0, op: '-' as const }] }))}
                className="flex items-center gap-1 text-[10px] font-bold text-green-700 hover:text-green-900">
                <Plus className="w-3 h-3" /> Adicionar
              </button>
            </div>
            {(doc.extras || []).map(extra => (
              <div key={extra.id} className="flex items-center gap-2">
                <select value={extra.op}
                  onChange={e => setDoc(p => ({ ...p, extras: (p.extras||[]).map(x => x.id===extra.id ? {...x, op: e.target.value as '+' | '-'} : x) }))}
                  className="w-16 p-2 border border-gray-300 rounded-lg text-sm font-bold focus:border-green-600 outline-none text-center">
                  <option value="-">− Sub</option>
                  <option value="+">+ Add</option>
                </select>
                <input value={extra.desc}
                  onChange={e => setDoc(p => ({ ...p, extras: (p.extras||[]).map(x => x.id===extra.id ? {...x, desc: e.target.value} : x) }))}
                  placeholder="Descrição (ex: desconto qualidade)"
                  className="flex-1 p-2 border border-gray-300 rounded-lg text-sm focus:border-green-600 outline-none" />
                <input type="number" value={extra.valor || ''}
                  onChange={e => setDoc(p => ({ ...p, extras: (p.extras||[]).map(x => x.id===extra.id ? {...x, valor: parseFloat(e.target.value)||0} : x) }))}
                  placeholder="R$ 0,00"
                  className="w-32 p-2 border border-gray-300 rounded-lg text-sm focus:border-green-600 outline-none text-right" />
                <button onClick={() => setDoc(p => ({ ...p, extras: (p.extras||[]).filter(x => x.id !== extra.id) }))}
                  className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </>}
        <div className="space-y-1 md:col-span-2 lg:col-span-4">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Observações</label>
          <textarea value={doc.notes || ''} onChange={e => setDoc(p => ({ ...p, notes: e.target.value }))}
            className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:border-green-600 outline-none resize-none" rows={2} />
        </div>
        </div>
        )}
      </div>

      {/* ── TABLE: Produtos or Madeira ── */}
      {doc.docMode === 'produtos' ? (
        <div className="space-y-4">
          {/* Client for produtos mode */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-black text-gray-700">
                {type === 'pedido' ? 'Destinatário' : 'Cliente'}
              </h3>
              <Link to="/clientes" className="text-[9px] font-bold text-green-700 hover:underline flex items-center gap-1">
                <Plus className="w-2.5 h-2.5" /> Cadastrar
              </Link>
            </div>
            <select value={doc.blocos?.[0]?.clientId || ''}
              onChange={e => {
                const c = state.clients.find(x => x.id === e.target.value);
                setDoc(p => ({
                  ...p,
                  blocos: [{
                    ...(p.blocos?.[0] || { id: Math.random().toString(36).slice(2,9), label: 'Principal', items: [] }),
                    clientId: e.target.value,
                    clientName: c?.name || '',
                    clientData: c ? { ...c } : undefined,
                  }],
                }));
              }}
              className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:border-green-600 outline-none mb-2">
              <option value="">— Selecionar —</option>
              {[...state.clients].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {!doc.blocos?.[0]?.clientId && (
              <ClientAutocomplete
                value={doc.blocos?.[0]?.clientName || ''}
                clients={sortedClientNames}
                onChangeText={typed => setDoc(p => ({
                  ...p,
                  blocos: [{
                    ...(p.blocos?.[0] || { id: Math.random().toString(36).slice(2,9), label: 'Principal', items: [] }),
                    clientName: typed,
                  }],
                }))}
                onSelect={c => setDoc(p => ({
                  ...p,
                  blocos: [{
                    ...(p.blocos?.[0] || { id: Math.random().toString(36).slice(2,9), label: 'Principal', items: [] }),
                    clientId: c.id,
                    clientName: c.name,
                    clientData: { ...c },
                  }],
                }))}
              />
            )}
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm overflow-x-auto">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-black text-amber-700">🚪 Produtos / Portas / Batentes</span>
            </div>
            <ProductCalculator
              items={doc.productItems || []}
              onChange={productItems => setDoc(p => ({ ...p, productItems }))}
            />
          </div>
        </div>
      ) : (
      <div className="space-y-4">
        {blocos.map((bloco, bi) => {
          const bt = calcBlocoTotals(bloco);
          const isCollapsed = collapsedBlocos[bloco.id];
          return (
            <div key={bloco.id} className="bg-white border-2 border-green-200 rounded-xl shadow-sm overflow-hidden">
              {/* Bloco header */}
              <div className="flex items-center justify-between px-4 py-3 bg-green-50 border-b border-green-200 gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-8 h-8 bg-green-700 text-white rounded-lg flex items-center justify-center font-black text-sm flex-shrink-0">
                    {bi + 1}
                  </div>
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Building2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <input
                      value={bloco.label}
                      onChange={e => updateBloco(bloco.id, { label: e.target.value })}
                      placeholder="Nome da loja / local..."
                      className="font-black text-green-800 bg-transparent border-b-2 border-dashed border-green-300 focus:border-green-600 outline-none text-sm min-w-0 py-0.5 w-full"
                    />
                  </div>
                  {bt.m3 > 0 && (
                    <span className="text-xs font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                      {bt.m3.toFixed(3)} m³ · {fmt(bt.subtotal)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button onClick={() => toggleBloco(bloco.id)}
                    className="p-1.5 text-green-600 hover:bg-green-100 rounded-lg transition-all">
                    {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                  </button>
                  {blocos.length > 1 && (
                    <button onClick={() => removeBloco(bloco.id)}
                      className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {!isCollapsed && (
                <div className="p-4 space-y-4">
                  {/* Bloco client */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                          {type === 'pedido' ? 'Destinatário' : 'Cliente'}
                        </label>
                        <Link to="/clientes" className="text-[9px] font-bold text-green-700 hover:underline flex items-center gap-1">
                          <Plus className="w-2.5 h-2.5" /> Cadastrar
                        </Link>
                      </div>
                      <select value={bloco.clientId || ''}
                        onChange={e => handleBlocoClientSelect(bloco.id, e.target.value)}
                        className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:border-green-600 outline-none">
                        <option value="">— Selecionar —</option>
                        {[...state.clients].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                      {!bloco.clientId && (
                        <ClientAutocomplete
                          value={bloco.clientName || ''}
                          clients={sortedClientNames}
                          onChangeText={typed => updateBloco(bloco.id, { clientName: typed })}
                          onSelect={c => updateBloco(bloco.id, { clientId: c.id, clientName: c.name, clientData: { ...c } })}
                        />
                      )}
                    </div>
                    {bloco.clientData && (
                      <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500 space-y-0.5">
                        {(bloco.clientData as any).address && <p>📍 {(bloco.clientData as any).address}</p>}
                        {(bloco.clientData as any).city && <p>🏙 {(bloco.clientData as any).city}</p>}
                        {(bloco.clientData as any).phone && <p>📞 {(bloco.clientData as any).phone}</p>}
                      </div>
                    )}
                  </div>

                  {/* Bloco calculator */}
                  <TimberCalculator
                    items={bloco.items}
                    onChange={items => updateBloco(bloco.id, { items })}
                  />
                </div>
              )}
            </div>
          );
        })}

        {/* Add bloco button */}
        <button onClick={addBloco}
          className="w-full py-3 border-2 border-dashed border-green-300 text-green-700 rounded-xl font-bold text-sm hover:border-green-500 hover:bg-green-50 transition-all flex items-center justify-center gap-2">
          <Plus className="w-4 h-4" /> Adicionar Loja / Bloco
        </button>
      </div>
      )}

      {/* Cheques — romaneio only */}
      {type === 'romaneio' && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <ChequeTable
            cheques={doc.cheques || []}
            onChange={cheques => setDoc(p => ({ ...p, cheques }))}
            total={total}
            paymentTerms={doc.paymentTerms || ''}
            docDate={doc.date || ''}
            paymentMethod={doc.paymentMethod || 'cheque'}
          />
        </div>
      )}

      {/* Payment tracking — only for saved romaneios */}
      {type === 'romaneio' && id && (
        <div>
          <div className="flex items-center justify-between mb-2 px-1">
            <h2 className="text-sm font-black text-gray-700 uppercase tracking-wider">
              💰 Controle de Recebimento
            </h2>
            <button onClick={handlePrintPaymentReport}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 active:scale-95 transition-all">
              <FileCheck className="w-3.5 h-3.5" /> Relatório de Pagamento
            </button>
          </div>
          <PaymentTracker
            total={total}
            payments={doc.payments || []}
            onChangePayments={payments => persistDocUpdate({ payments })}
            commission={commission}
            myShareValue={myShareValue}
            commissionPaid={doc.commissionPaid || false}
            onChangeCommissionPaid={paid => persistDocUpdate({ commissionPaid: paid, commissionPaidDate: paid ? new Date().toISOString() : undefined })}
            partnerName={doc.partnerName}
            partnerShareValue={partnerShareValue}
            partnerPaid={doc.partnerPaid || false}
            onChangePartnerPaid={paid => persistDocUpdate({ partnerPaid: paid, partnerPaidDate: paid ? new Date().toISOString() : undefined })}
          />
        </div>
      )}

      {/* Live totals */}
      <div className="bg-green-700 text-white rounded-xl p-4 shadow-md">
        {blocos.length > 1 && (
          <div className="grid grid-cols-2 gap-2 mb-3 pb-3 border-b border-green-600">
            {blocos.map((b, i) => {
              const bt = calcBlocoTotals(b);
              return (
                <div key={b.id} className="bg-green-600 rounded-lg p-2">
                  <p className="text-green-300 text-[10px] font-bold truncate">{b.label || `Bloco ${i + 1}`}</p>
                  <p className="text-white text-xs font-black">{bt.m3.toFixed(3)} m³</p>
                  <p className="text-green-200 text-[10px]">{fmt(bt.subtotal)}</p>
                </div>
              );
            })}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 text-sm mb-3">
          <div>
            <p className="text-green-300 text-xs font-bold uppercase tracking-wider">Total M³</p>
            <p className="text-xl font-black">{totals.m3.toFixed(3)}</p>
          </div>
          <div>
            <p className="text-green-300 text-xs font-bold uppercase tracking-wider">Subtotal</p>
            <p className="text-xl font-black">{fmt(totals.subtotal)}</p>
          </div>
          {type === 'romaneio' && (doc.freight || 0) > 0 && (
            <div>
              <p className="text-green-300 text-xs font-bold uppercase tracking-wider">– Frete</p>
              <p className="text-xl font-black text-red-300">{fmt(doc.freight || 0)}</p>
            </div>
          )}
          {type === 'romaneio' && freightIcms > 0 && (
            <div>
              <p className="text-green-300 text-xs font-bold uppercase tracking-wider">ICMS Frete (sep.)</p>
              <p className="text-xl font-black text-blue-200">{fmt(freightIcms)}</p>
            </div>
          )}
          {type === 'romaneio' && commission > 0 && (
            <div>
              <p className="text-green-300 text-xs font-bold uppercase tracking-wider">– Comissão{usaValorServaria ? ' (s/ valor serraria)' : ''}</p>
              <p className="text-xl font-black text-red-300">{fmt(commission)}</p>
              {partnerShareValue > 0 && (
                <div className="text-[10px] text-green-200 mt-1 space-y-0.5">
                  <p>Você: <strong className="text-white">{fmt(myShareValue)}</strong></p>
                  <p>
                    {doc.partnerName || 'Parceiro'}: <strong className="text-white">{fmt(partnerShareValue)}</strong>
                    {partnerMarkup > 0 && (
                      <span className="text-green-300">
                        {' '}({fmt(partnerCommissionShare)} da comissão + {fmt(partnerMarkup)} de diferença de venda)
                      </span>
                    )}
                  </p>
                </div>
              )}
            </div>
          )}
          {type === 'romaneio' && extrasTotal !== 0 && (
            <div>
              <p className="text-green-300 text-xs font-bold uppercase tracking-wider">{extrasTotal > 0 ? '+ Extras' : '– Extras'}</p>
              <p className={`text-xl font-black ${extrasTotal > 0 ? 'text-green-200' : 'text-red-300'}`}>{fmt(Math.abs(extrasTotal))}</p>
            </div>
          )}
          <div>
            <p className="text-green-300 text-xs font-bold uppercase tracking-wider">Total a Pagar</p>
            <p className="text-2xl font-black text-yellow-300">{fmt(total)}</p>
          </div>
        </div>
        <button onClick={handlePrint}
          className="w-full py-3 bg-white text-green-800 rounded-lg font-black text-sm hover:bg-green-50 active:scale-95 transition-all flex items-center justify-center gap-2">
          <Printer className="w-4 h-4" /> PDF / Compartilhar
        </button>
      </div>
    </div>
    </>
  );
};
