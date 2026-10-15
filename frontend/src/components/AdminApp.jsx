import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Megaphone, Shuffle, Trash2, Pin, Link2, Copy, RefreshCw, MessageCircle } from 'lucide-react';
import { api, getToken } from '../api.js';
import { quandoBRT } from './Marca.jsx';

// Mural: publicar, fixar, apagar
export function AdminMural() {
  const [avisos, setAvisos] = useState([]);
  const [n, setN] = useState({ titulo: '', texto: '', fixado: false });
  const carregar = () => api.get('/avisos').then((r) => setAvisos(r.data));
  useEffect(() => { carregar(); }, []);
  async function publicar(e) {
    e.preventDefault();
    try { await api.post('/avisos', n); setN({ titulo: '', texto: '', fixado: false }); carregar(); toast.success('Aviso publicado.'); } catch { toast.error('Não publicou.'); }
  }
  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold flex items-center gap-2 mb-3"><Megaphone size={18} /> Mural</h2>
      <form onSubmit={publicar} className="card p-4 space-y-3">
        <input className="input" placeholder="Título" value={n.titulo} onChange={(e) => setN({ ...n, titulo: e.target.value })} required />
        <textarea className="input min-h-[90px]" placeholder="Texto do aviso" value={n.texto} onChange={(e) => setN({ ...n, texto: e.target.value })} required />
        <label className="flex items-center gap-2 text-sm text-tx"><input type="checkbox" checked={n.fixado} onChange={(e) => setN({ ...n, fixado: e.target.checked })} /> Fixar no topo</label>
        <button className="btn btn-primary w-full">Publicar no mural</button>
      </form>
      {avisos.map((a) => (
        <div key={a.id} className="card mt-2 px-4 py-2.5 flex items-center gap-2 text-sm">
          <button title="fixar/desafixar" onClick={() => api.patch(`/avisos/${a.id}`, { fixado: !a.fixado }).then(carregar)}>
            <Pin size={15} className={a.fixado ? 'text-[color:var(--color-gold)]' : 'text-tx3'} />
          </button>
          <span className="flex-1 truncate">{a.titulo}</span>
          <span className="text-[11px] text-tx3">{quandoBRT(a.criado_em)}</span>
          <button title="apagar" onClick={() => api.delete(`/avisos/${a.id}`).then(carregar)}><Trash2 size={15} className="text-red-600" /></button>
        </div>
      ))}
    </div>
  );
}

// Quem está vendo é o organizador? Só se tem token E o servidor aceita (token vencido = visitante comum).
export function useAdmin() {
  const [admin, setAdmin] = useState(false);
  useEffect(() => {
    if (!getToken()) return;
    api.get('/admin/me').then(() => setAdmin(true)).catch(() => setAdmin(false));
  }, []);
  return admin;
}

// datetime-local do celular (sem fuso) a partir de um instante, em horário de Brasília
const campoBRT = (ms) => new Date(ms - 3 * 3600000).toISOString().slice(0, 16);

// Sorteio dos grupos: marcar dia e hora (BRT). Na hora, roda sozinho. Aparece no /admin e, pro organizador, no próprio /sorteio.
export function AdminSorteio({ naTela }) {
  const [evento, setEvento] = useState(null);
  const [s, setS] = useState(null);
  const [quando, setQuando] = useState('');
  const [refazer, setRefazer] = useState(false);
  const carregar = (ev) => api.get(`/sorteio/${ev}`).then((r) => setS(r.data)).catch(() => setS(null));
  useEffect(() => { api.get('/config').then((r) => { setEvento(r.data.evento_atual); carregar(r.data.evento_atual); }); }, []);
  useEffect(() => { if (!evento) return undefined; const t = setInterval(() => carregar(evento), 5000); return () => clearInterval(t); }, [evento]);
  async function marcar(iso) {
    try {
      await api.post(`/sorteio/${evento}`, { agendado_para: iso });
      toast.success('Sorteio marcado.'); setRefazer(false); carregar(evento);
    } catch (err) { toast.error(err.response?.data?.erro === 'sorteio_em_andamento' ? 'Sorteio já está rodando.' : 'Não marcou.'); }
  }
  function agendar(e) {
    e.preventDefault();
    // o campo datetime-local vem sem fuso: é horário de Brasília (UTC-3, sem horário de verão)
    if (new Date(`${quando}:00-03:00`).getTime() < Date.now()) return toast.error('Esse horário já passou.');
    marcar(`${quando}:00-03:00`);
  }
  async function cancelar() { await api.delete(`/sorteio/${evento}`); toast.success('Cancelado.'); carregar(evento); }
  const rodando = s && (s.fase === 'revelando' || s.fase === 'fechando');
  const concluido = s?.fase === 'concluido';
  return (
    <div className={naTela ? 'mb-4' : 'mb-8'}>
      {naTela
        ? <div className="flex items-center gap-2 mb-2 text-xs uppercase tracking-[0.2em] text-[color:var(--color-gold)] font-bold"><Shuffle size={14} /> Só você vê isto · organizador</div>
        : <h2 className="text-lg font-semibold flex items-center gap-2 mb-3"><Shuffle size={18} /> Sorteio dos grupos ({evento})</h2>}
      <div className="card p-4 space-y-3 border-[color:var(--color-gold)]/50">
        <div className="text-sm text-tx">
          {s ? <>Situação: <b>{{ contagem: 'marcado', revelando: 'rodando agora', fechando: 'rodando agora', concluido: 'concluído' }[s.fase] || s.fase}</b> · {s.fase === 'contagem' ? `começa ${quandoBRT(s.agendado_para)} BRT` : `${s.revelados.length} de ${s.total} revelados`}</> : 'Nenhum sorteio marcado.'}
        </div>
        {rodando && <div className="text-xs text-tx2">Rodando: não dá pra mexer até o último nome sair.</div>}
        {!rodando && (!concluido || refazer) && (
          <>
            {refazer && <div className="text-xs text-amber-700">Refazer apaga os grupos atuais quando o novo sorteio rodar.</div>}
            <form onSubmit={agendar} className="space-y-2">
              <span className="label">Dia e hora do sorteio</span>
              <input type="datetime-local" className="input" value={quando} min={campoBRT(Date.now())} onChange={(e) => setQuando(e.target.value)} required />
              <button className="btn btn-primary w-full">{s?.fase === 'contagem' ? 'Remarcar pra esse horário' : 'Marcar o sorteio'}</button>
            </form>
            <button type="button" onClick={() => marcar(new Date(Date.now() + 60000).toISOString())} className="btn btn-ghost w-full text-sm">Começar daqui a 1 minuto</button>
            <div className="text-[11px] text-tx3">Horário de Brasília. Na hora marcada o sorteio começa sozinho pra todo mundo (1 nome a cada 5 s, ~2,5 min pra 28) e grava os grupos no quadro ao vivo.</div>
          </>
        )}
        {s?.fase === 'contagem' && <button onClick={cancelar} className="btn btn-ghost w-full text-sm">Cancelar o sorteio marcado</button>}
        {concluido && !refazer && <button onClick={() => setRefazer(true)} className="btn btn-ghost w-full text-sm">Refazer o sorteio</button>}
      </div>
    </div>
  );
}

// Links pessoais da ficha (14/10 21:43: "a ficha do piloto nao pode ser publica"). Só o organizador vê.
// "WhatsApp" abre o WhatsApp do PRÓPRIO celular do organizador com a mensagem pronta: quem envia é ele.
const textoLink = (nome, url) => `Fala, ${nome.split(' ')[0]}! Esse é o seu link pessoal do app da 3ª Copa P&R:\n${url}\n\nToque nele pra preencher sua ficha (foto, peso, altura, contato de emergência). Depois o app já reconhece você no celular. O link é só seu, não repasse.`;
export function AdminLinks() {
  const [lista, setLista] = useState(null);
  const [so, setSo] = useState('falta');
  const carregar = () => api.get('/ficha/admin/links').then((r) => setLista(r.data.pilotos)).catch(() => setLista([]));
  useEffect(() => { carregar(); }, []);
  const url = (t) => `${location.origin}/f/${t}`;
  async function copiar(p) {
    try { await navigator.clipboard.writeText(textoLink(p.nome, url(p.token))); toast.success(`Mensagem do ${p.nome.split(' ')[0]} copiada.`); } catch { toast.error('Não consegui copiar.'); }
  }
  async function trocar(p) {
    await api.post(`/ficha/admin/${p.id}/novo-link`); toast.success('Link trocado. O antigo parou de funcionar.'); carregar();
  }
  const zap = (p) => {
    const d = String(p.whatsapp || '').replace(/\D/g, '');
    const num = d.length >= 10 ? (d.startsWith('55') ? d : `55${d}`) : '';
    return `https://wa.me/${num}?text=${encodeURIComponent(textoLink(p.nome, url(p.token)))}`;
  };
  const mostrados = (lista || []).filter((p) => so === 'todos' || !p.tem_ficha);
  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-2 text-xs uppercase tracking-[0.2em] text-[color:var(--color-gold)] font-bold"><Link2 size={14} /> Só você vê isto · links pessoais</div>
      <div className="card p-3">
        <div className="text-xs text-tx2 px-1">Mande pra cada piloto o link DELE. O botão verde abre o seu WhatsApp com a mensagem pronta.</div>
        <div className="mt-2 flex gap-1.5 px-1">
          {[['falta', `Falta preencher${lista ? ` (${lista.filter((p) => !p.tem_ficha).length})` : ''}`], ['todos', 'Todos']].map(([k, r]) => (
            <button key={k} onClick={() => setSo(k)} className={`px-3 py-1 rounded-full text-xs font-semibold border ${so === k ? 'bg-brand text-white border-transparent' : 'border-[#d5dfeb] text-tx'}`}>{r}</button>
          ))}
        </div>
        <div className="mt-2 divide-y divide-[#e3e9f1]">
          {!lista && <div className="p-3 text-center text-sm text-tx2">Carregando…</div>}
          {mostrados.map((p) => (
            <div key={p.id} className="flex items-center gap-2 px-1 py-2">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{p.nome}</div>
                <div className={`text-[11px] ${p.tem_ficha ? 'text-emerald-700' : 'text-amber-700'}`}>{p.tem_ficha ? 'ficha preenchida' : 'falta preencher'}</div>
              </div>
              <a href={zap(p)} target="_blank" rel="noreferrer" className="px-2.5 py-1.5 rounded-lg bg-[#1f9d55] text-white text-xs font-semibold flex items-center gap-1"><MessageCircle size={13} /> WhatsApp</a>
              <button onClick={() => copiar(p)} title="copiar mensagem" className="p-1.5 rounded-lg border border-[#d5dfeb]"><Copy size={14} className="text-brand" /></button>
              <button onClick={() => trocar(p)} title="trocar link (o antigo para)" className="p-1.5 rounded-lg border border-[#d5dfeb]"><RefreshCw size={14} className="text-tx3" /></button>
            </div>
          ))}
          {lista && !mostrados.length && <div className="p-3 text-center text-sm text-emerald-700">Todo mundo preencheu.</div>}
        </div>
      </div>
    </div>
  );
}
