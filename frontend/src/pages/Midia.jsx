import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Upload, Play, X, Download, Image as ImgIcon, Film, EyeOff } from 'lucide-react';
import { api, getEu } from '../api.js';
import { Casca } from '../components/Marca.jsx';
import { useAdmin } from '../components/AdminApp.jsx';

// Fotos e vídeos do dia, enviados por quem estava lá (Brunner 14/10: juntar o material pro marketing).
// O arquivo vai INTEIRO (qualidade original); a miniatura da galeria é feita aqui no celular.
const CHAVE_AUTOR = 'prcup_autor';
const mb = (b) => (!b ? "0 MB" : b >= 1e9 ? `${(b / 1e9).toFixed(1)} GB` : `${Math.max(0.1, b / 1e6).toFixed(1)} MB`);

function desenhar(fonte, w, h) {
  const lado = 360;
  const esc = Math.min(1, lado / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.round(w * esc); c.height = Math.round(h * esc);
  c.getContext('2d').drawImage(fonte, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.72);
}

// miniatura: foto = reduz; vídeo = quadro de 1 s. Se o navegador não conseguir (HEIC fora do Safari), fica sem.
function miniatura(arquivo) {
  return new Promise((ok) => {
    const url = URL.createObjectURL(arquivo);
    const fim = (v) => { URL.revokeObjectURL(url); ok(v); };
    setTimeout(() => fim(null), 8000);
    if (arquivo.type.startsWith('image/')) {
      const img = new Image();
      img.onload = () => fim(desenhar(img, img.naturalWidth, img.naturalHeight));
      img.onerror = () => fim(null);
      img.src = url;
      return;
    }
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.preload = 'auto';
    v.onloadeddata = () => { v.currentTime = Math.min(1, (v.duration || 2) / 2); };
    v.onseeked = () => { try { fim(desenhar(v, v.videoWidth, v.videoHeight)); } catch { fim(null); } };
    v.onerror = () => fim(null);
    v.src = url;
  });
}

function Visor({ m, fechar }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col" onClick={fechar}>
      <div className="flex items-center justify-between p-3 text-white text-sm" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}>
        <span className="truncate">{m.autor}{m.legenda ? ` · ${m.legenda}` : ''}</span>
        <button aria-label="fechar" onClick={fechar}><X size={24} /></button>
      </div>
      <div className="flex-1 flex items-center justify-center p-2" onClick={(e) => e.stopPropagation()}>
        {m.tipo === 'video'
          ? <video src={`/api/midia/${m.id}/arquivo`} controls autoPlay playsInline className="max-h-full max-w-full" />
          : <img src={`/api/midia/${m.id}/arquivo`} alt="" className="max-h-full max-w-full object-contain" />}
      </div>
      <a href={`/api/midia/${m.id}/arquivo?baixar=1`} onClick={(e) => e.stopPropagation()}
        className="m-3 btn btn-ghost justify-center" style={{ marginBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}>
        <Download size={16} /> Baixar original ({mb(m.bytes)})
      </a>
    </div>
  );
}

export default function Midia() {
  const admin = useAdmin();
  const [lista, setLista] = useState(null);
  const [pilotos, setPilotos] = useState([]);
  const [autor, setAutor] = useState(() => { try { return JSON.parse(localStorage.getItem(CHAVE_AUTOR)) || null; } catch { return null; } });
  const [outro, setOutro] = useState('');
  const [legenda, setLegenda] = useState('');
  const [fila, setFila] = useState([]); // {nome, bytes, pct, status}
  const [filtro, setFiltro] = useState('tudo');
  const [aberta, setAberta] = useState(null);
  const input = useRef(null);

  const carregar = () => api.get('/midia').then((r) => setLista(r.data)).catch(() => setLista([]));
  useEffect(() => {
    carregar();
    api.get('/ficha/lista').then((r) => setPilotos(r.data.pilotos)).catch(() => {});
    // quem abriu o link pessoal já vem escolhido
    if (getEu()) api.get('/ficha/eu').then((r) => setAutor({ id: r.data.id, nome: r.data.nome_evento })).catch(() => {});
  }, []);

  function escolherAutor(v) {
    const a = v === 'outro' ? { id: null, nome: '' } : (() => { const p = pilotos.find((x) => String(x.id) === v); return p ? { id: p.id, nome: p.nome } : null; })();
    setAutor(a);
    if (a?.id) { try { localStorage.setItem(CHAVE_AUTOR, JSON.stringify(a)); } catch { /* sem storage */ } }
  }
  const nomeAutor = autor?.id ? autor.nome : outro.trim();

  async function enviar(e) {
    const arquivos = [...(e.target.files || [])];
    e.target.value = '';
    if (!arquivos.length) return;
    if (nomeAutor.length < 2) { toast.error('Diga quem está enviando antes de escolher os arquivos.'); return; }
    const inicio = fila.length;
    setFila((f) => [...f, ...arquivos.map((a) => ({ nome: a.name, bytes: a.size, pct: 0, status: 'na fila' }))]);
    const muda = (i, x) => setFila((f) => f.map((it, k) => (k === inicio + i ? { ...it, ...x } : it)));
    for (const [i, a] of arquivos.entries()) {
      if (a.size > 500 * 1024 * 1024) { muda(i, { status: 'grande demais (máx. 500 MB)' }); continue; }
      muda(i, { status: 'enviando' });
      try {
        const tipo = a.type || (/\.mov$/i.test(a.name) ? 'video/quicktime' : /\.heic$/i.test(a.name) ? 'image/heic' : '');
        const { data } = await api.put('/midia', a, {
          params: { autor: nomeAutor, piloto_id: autor?.id || undefined, legenda: legenda || undefined, nome: a.name },
          headers: { 'Content-Type': tipo },
          timeout: 0,
          onUploadProgress: (p) => muda(i, { pct: Math.round((p.loaded / (p.total || a.size)) * 100) }),
        });
        const t = await miniatura(a);
        if (t) await api.post(`/midia/${data.id}/thumb`, { thumb: t }).catch(() => {});
        muda(i, { status: 'enviado', pct: 100 });
      } catch (err) {
        muda(i, { status: err.response?.data?.detalhe || 'falhou, tente de novo' });
      }
    }
    carregar();
  }

  async function esconder(m) {
    await api.patch(`/midia/${m.id}`, { oculto: true });
    toast.success('Escondido da galeria (o arquivo continua guardado).');
    carregar();
  }

  const mostrados = useMemo(() => (lista || []).filter((m) => filtro === 'tudo' || (filtro === 'minhas' ? autor?.id && m.piloto_id === autor.id : m.tipo === filtro)), [lista, filtro, autor]);
  const total = (lista || []).reduce((s, m) => s + m.bytes, 0);

  return (
    <Casca sub="Fotos e vídeos">
      <div className="card p-4 space-y-3">
        <div className="text-sm text-tx">Gravou ou fotografou no dia? Sobe aqui. Vai na <b>qualidade original</b>, direto pro videomaker e pro marketing da P&amp;R.</div>
        <label className="block">
          <span className="label">Quem está enviando</span>
          <select className="input" value={autor ? (autor.id ? String(autor.id) : 'outro') : ''} onChange={(e) => escolherAutor(e.target.value)}>
            <option value="" disabled>Escolha seu nome</option>
            {pilotos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            <option value="outro">Não sou piloto (acompanhante, equipe…)</option>
          </select>
        </label>
        {autor && !autor.id && <input className="input" placeholder="Seu nome" value={outro} onChange={(e) => setOutro(e.target.value)} />}
        <input className="input" placeholder="Legenda (opcional): ex. largada da final" value={legenda} onChange={(e) => setLegenda(e.target.value)} maxLength={300} />
        <input ref={input} type="file" accept="image/*,video/*" multiple className="hidden" onChange={enviar} />
        <button className="btn btn-primary w-full" onClick={() => (nomeAutor.length < 2 ? toast.error('Escolha seu nome primeiro.') : input.current?.click())}>
          <Upload size={17} /> Escolher fotos e vídeos
        </button>
        <div className="text-[11px] text-tx3">Até 500 MB por arquivo. Pode escolher vários de uma vez; deixe a tela aberta até terminar.</div>
        {fila.length > 0 && (
          <div className="space-y-1.5 pt-1">
            {fila.map((f, i) => (
              <div key={i} className="text-xs">
                <div className="flex justify-between gap-2"><span className="truncate">{f.nome}</span><span className={f.status === 'enviado' ? 'text-emerald-700' : 'text-tx2'}>{f.status === 'enviando' ? `${f.pct}%` : f.status}</span></div>
                <div className="h-1.5 mt-1 rounded bg-[#e8eff7] overflow-hidden"><div className="h-full bg-brand transition-all" style={{ width: `${f.pct}%` }} /></div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-5 flex items-center gap-1.5">
        {[['tudo', 'Tudo'], ['foto', 'Fotos'], ['video', 'Vídeos'], ['minhas', 'Minhas']].map(([k, r]) => (
          <button key={k} onClick={() => setFiltro(k)} className={`px-3 py-1.5 rounded-full text-[13px] font-semibold border ${filtro === k ? 'bg-brand text-white border-transparent' : 'border-[#d5dfeb] text-tx'}`}>{r}</button>
        ))}
        {lista && <span className="ml-auto text-[11px] text-tx3">{lista.length} · {mb(total)}</span>}
      </div>

      {!lista && <div className="text-center text-tx2 py-8">Carregando…</div>}
      {lista && !mostrados.length && <div className="card mt-3 p-8 text-center text-sm text-tx2">Nada aqui ainda. No dia 23, cada foto e vídeo que vocês subirem aparece nesta galeria.</div>}
      <div className="mt-3 grid grid-cols-3 gap-1.5">
        {mostrados.map((m) => (
          <div key={m.id} className="relative aspect-square rounded-lg overflow-hidden bg-[#e8eff7]">
            <button className="absolute inset-0" onClick={() => setAberta(m)} aria-label="abrir">
              {m.tem_thumb
                ? <img src={`/api/midia/${m.id}/thumb`} alt="" loading="lazy" className="w-full h-full object-cover" />
                : <span className="w-full h-full flex items-center justify-center text-tx3">{m.tipo === 'video' ? <Film size={26} /> : <ImgIcon size={26} />}</span>}
              {m.tipo === 'video' && <span className="absolute bottom-1 right-1 bg-black/60 rounded-full p-1"><Play size={12} className="text-white" fill="white" /></span>}
            </button>
            {admin && <button title="esconder" onClick={() => esconder(m)} className="absolute top-1 right-1 bg-white/90 rounded-full p-1"><EyeOff size={13} className="text-red-600" /></button>}
          </div>
        ))}
      </div>
      {aberta && <Visor m={aberta} fechar={() => setAberta(null)} />}
    </Casca>
  );
}
