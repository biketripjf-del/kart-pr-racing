import { useEffect, useMemo, useRef, useState } from 'react';
import { Shuffle, Eye, ShieldCheck } from 'lucide-react';
import { api } from '../api.js';
import { Casca, Avatar, quandoBRT } from '../components/Marca.jsx';

// Sorteio dos grupos AO VIVO. Quem manda é o servidor: ele começa na hora marcada e revela 1 nome a cada 5 s.
// A tela só pergunta (de 1,5 em 1,5 s) e anima. Os nomes ainda não sorteados nunca chegam aqui.
const PERGUNTA_MS = 1500;
const doisDig = (n) => String(n).padStart(2, '0');

function Relogio({ ms }) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400); const h = Math.floor((s % 86400) / 3600); const m = Math.floor((s % 3600) / 60); const ss = s % 60;
  const partes = d > 0 ? [[d, 'dias'], [h, 'h'], [m, 'min']] : [[h, 'h'], [m, 'min'], [ss, 's']];
  return (
    <div className="grid grid-cols-3 gap-2 text-center">
      {partes.map(([n, r]) => (
        <div key={r} className="rounded-xl bg-[#0a1930] border border-[#24406b] py-3">
          <div className="text-4xl font-extrabold tabular-nums" style={{ fontFamily: 'var(--font-display)' }}>{doisDig(n)}</div>
          <div className="text-[11px] uppercase tracking-wide text-slate-400">{r}</div>
        </div>
      ))}
    </div>
  );
}

function ColunaGrupo({ g, nomes, fotos, ultimo }) {
  return (
    <div className="card p-3">
      <div className="flex items-center justify-between">
        <div className="font-extrabold text-xl" style={{ fontFamily: 'var(--font-display)' }}>GRUPO {g}</div>
        <div className="text-xs text-slate-400 tabular-nums">{nomes.length}</div>
      </div>
      <div className="mt-2 space-y-1.5">
        {nomes.map((r) => (
          <div key={r.nome} className={`flex items-center gap-2 text-sm rounded-lg px-1 py-0.5 ${r.nome === ultimo ? 'bg-[color:var(--color-brand)]/30 animate-[aparece_.6s_ease-out]' : ''}`}>
            <Avatar id={r.piloto_id} v={fotos[r.piloto_id]} nome={r.nome} tam={26} />
            <span className="truncate">{r.nome}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Sorteio() {
  const [evento, setEvento] = useState(null);
  const [s, setS] = useState(undefined);
  const [todos, setTodos] = useState([]); // pra animar o tambor e mostrar as fotos
  const [desvio, setDesvio] = useState(0); // relógio do servidor - relógio do celular
  const [agora, setAgora] = useState(Date.now());
  const [tambor, setTambor] = useState('');
  const timer = useRef(null);

  useEffect(() => { api.get('/config').then((r) => setEvento(r.data.evento_atual)); }, []);
  useEffect(() => {
    api.get('/ficha/lista').then((r) => setTodos(r.data.pilotos)).catch(() => {});
  }, []);
  useEffect(() => {
    if (!evento) return;
    const perguntar = () => api.get(`/sorteio/${evento}`).then((r) => {
      setS(r.data); setDesvio(new Date(r.data.agora).getTime() - Date.now());
    }).catch((e) => setS(e.response?.status === 404 ? null : (x) => x));
    perguntar();
    timer.current = setInterval(() => { if (!document.hidden) perguntar(); }, PERGUNTA_MS);
    return () => clearInterval(timer.current);
  }, [evento]);
  useEffect(() => { const t = setInterval(() => setAgora(Date.now()), 120); return () => clearInterval(t); }, []);

  const fotos = useMemo(() => Object.fromEntries(todos.map((p) => [p.id, p.foto_v])), [todos]);
  const revelados = s?.revelados || [];
  const ultimo = revelados[revelados.length - 1];
  const restantes = useMemo(() => {
    const ja = new Set(revelados.map((r) => r.nome));
    return todos.filter((p) => !ja.has(p.nome)).map((p) => p.nome);
  }, [todos, revelados.length]);
  const agoraServ = agora + desvio;
  const proximoEm = s?.proximo_em ? new Date(s.proximo_em).getTime() : null;
  const girando = s?.fase === 'revelando' && proximoEm && proximoEm - agoraServ < 2200 && restantes.length > 0;

  // tambor: nomes que ainda estão no pote passando rápido antes da revelação (nenhum deles é o próximo de verdade)
  useEffect(() => {
    if (!girando) { setTambor(''); return; }
    setTambor(restantes[Math.floor(Math.random() * restantes.length)]);
  }, [girando, agora, restantes]);

  if (s === undefined) return <Casca sub="Sorteio dos grupos"><div className="text-center text-slate-400 py-10">Carregando…</div></Casca>;
  if (s === null) {
    return (
      <Casca sub="Sorteio dos grupos">
        <div className="card p-8 text-center text-slate-300">
          <Shuffle className="mx-auto text-[color:var(--color-gold)] mb-3" size={40} />
          O sorteio dos grupos ainda não foi marcado. Quando for, a contagem aparece aqui e o sorteio roda sozinho, ao vivo, pra todo mundo ao mesmo tempo.
        </div>
      </Casca>
    );
  }

  const A = revelados.filter((r) => r.grupo === 'A');
  const B = revelados.filter((r) => r.grupo === 'B');

  return (
    <Casca sub={`Sorteio dos grupos${s.titulo ? ` · ${s.titulo}` : ''}`}>
      {s.fase === 'contagem' && (
        <div className="card p-5">
          <div className="text-center text-sm text-slate-300">Começa sozinho em <b>{quandoBRT(s.agendado_para)}</b> (horário de Brasília)</div>
          <div className="mt-4"><Relogio ms={new Date(s.agendado_para).getTime() - agoraServ} /></div>
          <div className="mt-4 text-center text-xs text-slate-400">
            {s.inscritos} pilotos no pote · 1 nome a cada {Math.round(s.passo_ms / 1000)} s · alterna Grupo A e Grupo B
            {s.cabecas?.length ? ` · ${s.cabecas.length} cabeças de chave saem primeiro` : ' · sem cabeça de chave'}
          </div>
          {todos.length > 0 && (
            <div className="mt-4 flex flex-wrap justify-center gap-1.5">
              {todos.map((p) => <Avatar key={p.id} id={p.id} v={p.foto_v} nome={p.nome} tam={30} />)}
            </div>
          )}
        </div>
      )}

      {(s.fase === 'revelando' || s.fase === 'fechando') && (
        <div className="card p-5 text-center">
          <div className="flex items-center justify-center gap-2 text-xs uppercase tracking-[0.2em] text-red-400 font-bold">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> ao vivo · {revelados.length} de {s.total}
          </div>
          <div className="mt-4 min-h-[150px] flex flex-col items-center justify-center">
            {girando ? (
              <>
                <div className="w-24 h-24 rounded-full border-4 border-dashed border-[color:var(--color-gold)] animate-spin" />
                <div className="mt-3 text-lg text-slate-400 blur-[1px]">{tambor}</div>
              </>
            ) : ultimo ? (
              <div key={ultimo.nome} className="animate-[aparece_.6s_ease-out] flex flex-col items-center">
                <Avatar id={ultimo.piloto_id} v={fotos[ultimo.piloto_id]} nome={ultimo.nome} tam={96} />
                <div className="mt-3 text-2xl font-extrabold" style={{ fontFamily: 'var(--font-display)' }}>{ultimo.nome}</div>
                <div className={`mt-1 px-3 py-0.5 rounded-full text-sm font-bold ${ultimo.grupo === 'A' ? 'bg-[color:var(--color-brand)] text-white' : 'bg-[color:var(--color-gold)] text-black'}`}>GRUPO {ultimo.grupo}</div>
              </div>
            ) : (
              <div className="text-slate-400">Primeiro nome saindo…</div>
            )}
          </div>
        </div>
      )}

      {s.fase === 'concluido' && (
        <div className="card p-4 text-center">
          <div className="text-xl font-extrabold" style={{ fontFamily: 'var(--font-display)' }}>GRUPOS DEFINIDOS</div>
          <div className="text-xs text-slate-400 mt-1">Já estão no quadro ao vivo.</div>
        </div>
      )}

      {revelados.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <ColunaGrupo g="A" nomes={A} fotos={fotos} ultimo={ultimo?.nome} />
          <ColunaGrupo g="B" nomes={B} fotos={fotos} ultimo={ultimo?.nome} />
        </div>
      )}

      {s.semente && (
        <details className="card mt-4 p-4 text-sm">
          <summary className="cursor-pointer font-semibold flex items-center gap-2"><ShieldCheck size={16} className="text-emerald-400" /> Como conferir este sorteio</summary>
          <div className="mt-3 text-slate-300 space-y-2">
            <p>A ordem saiu de um embaralhamento com a semente abaixo, gerada na hora em que o sorteio começou e escondida até o último nome. Os nomes entram em ordem alfabética antes de embaralhar, e o 1º sorteado vai pro Grupo A, o 2º pro B, e assim por diante.</p>
            <p>Com a semente e a lista, qualquer pessoa refaz o sorteio e chega exatamente no mesmo resultado.</p>
            <div className="font-mono text-xs bg-[#0a1930] border border-[#24406b] rounded-lg p-2 break-all">semente: {s.semente}</div>
          </div>
        </details>
      )}
      {s.fase === 'revelando' && (
        <div className="mt-3 flex items-center justify-center gap-1 text-[11px] text-slate-500"><Eye size={12} /> todo mundo está vendo o mesmo sorteio, na mesma hora</div>
      )}
    </Casca>
  );
}
