import { useEffect, useMemo, useRef, useState } from 'react';
import { Shuffle, Eye, ShieldCheck } from 'lucide-react';
import { api } from '../api.js';
import { Casca, Avatar, Contador, quandoBRT } from '../components/Marca.jsx';
import { AdminSorteio, useAdmin } from '../components/AdminApp.jsx';

// Sorteio dos blocos AO VIVO (4 blocos de 7, W/X/Y/Z, que se misturam nas baterias — formato opção A, 19/10/2026). Quem manda é o servidor: ele começa na hora marcada e revela 1 nome a cada 5 s.
// A tela só pergunta (de 1,5 em 1,5 s) e anima. Os nomes ainda não sorteados nunca chegam aqui.
const PERGUNTA_MS = 1500;
const BLOCOS = ['W', 'X', 'Y', 'Z'];
const COR = { W: 'bg-[color:var(--color-brand)]', X: 'bg-[color:var(--color-gold)]', Y: 'bg-emerald-600', Z: 'bg-red-600' };
const CORRE = { W: 'baterias 1 e 3', X: 'baterias 1 e 4', Y: 'baterias 2 e 3', Z: 'baterias 2 e 4' };

function ColunaGrupo({ g, nomes, fotos, ultimo }) {
  return (
    <div className="card p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`w-6 h-6 rounded-md ${COR[g]} text-white text-sm font-extrabold grid place-items-center`}>{g}</span>
          <span className="font-extrabold text-lg display">BLOCO {g}</span>
        </div>
        <div className="text-xs text-tx2 tabular-nums">{nomes.length}</div>
      </div>
      <div className="text-[11px] text-tx3">{CORRE[g]}</div>
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
  const admin = useAdmin(); // o painel de marcar só aparece pro organizador logado

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

  const painel = admin ? <AdminSorteio naTela /> : null;
  if (s === undefined) return <Casca sub="Sorteio dos blocos"><div className="text-center text-tx2 py-10">Carregando…</div></Casca>;
  if (s === null) {
    return (
      <Casca sub="Sorteio dos blocos">
        {painel}
        <div className="card p-8 text-center text-tx">
          <Shuffle className="mx-auto text-[color:var(--color-gold)] mb-3" size={40} />
          O sorteio dos blocos ainda não foi marcado. Quando for, a contagem aparece aqui e o sorteio roda sozinho, ao vivo, pra todo mundo ao mesmo tempo.
        </div>
      </Casca>
    );
  }


  return (
    <Casca sub={`Sorteio dos blocos${s.titulo ? ` · ${s.titulo}` : ''}`}>
      {painel}
      {s.fase === 'contagem' && (
        <div className="card p-5">
          <div className="text-center text-sm text-tx">Começa sozinho em <b>{quandoBRT(s.agendado_para)}</b> (horário de Brasília)</div>
          <div className="mt-4"><Contador grande ms={new Date(s.agendado_para).getTime() - agoraServ} /></div>
          <div className="mt-4 text-center text-xs text-tx2">
            {s.inscritos} pilotos no pote · 1 nome a cada {Math.round(s.passo_ms / 1000)} s · rodízio W, X, Y, Z (7 em cada bloco)
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
          <div className="flex items-center justify-center gap-2 text-xs uppercase tracking-[0.2em] text-red-600 font-bold">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> ao vivo · {revelados.length} de {s.total}
          </div>
          <div className="mt-4 min-h-[150px] flex flex-col items-center justify-center">
            {girando ? (
              <>
                <div className="w-24 h-24 rounded-full border-4 border-dashed border-[color:var(--color-gold)] animate-spin" />
                <div className="mt-3 text-lg text-tx2 blur-[1px]">{tambor}</div>
              </>
            ) : ultimo ? (
              <div key={ultimo.nome} className="animate-[aparece_.6s_ease-out] flex flex-col items-center">
                <Avatar id={ultimo.piloto_id} v={fotos[ultimo.piloto_id]} nome={ultimo.nome} tam={96} />
                <div className="mt-3 text-2xl font-extrabold display">{ultimo.nome}</div>
                <div className={`mt-1 px-3 py-0.5 rounded-full text-sm font-bold text-white ${COR[ultimo.grupo] || 'bg-slate-500'}`}>BLOCO {ultimo.grupo}</div>
              </div>
            ) : (
              <div className="text-tx2">Primeiro nome saindo…</div>
            )}
          </div>
        </div>
      )}

      {s.fase === 'concluido' && (
        <div className="card p-4 text-center">
          <div className="text-xl font-extrabold display">BLOCOS DEFINIDOS</div>
          <div className="text-xs text-tx2 mt-1">Já estão no quadro ao vivo.</div>
        </div>
      )}

      {revelados.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-3">
          {BLOCOS.map((g) => (
            <ColunaGrupo key={g} g={g} nomes={revelados.filter((r) => r.grupo === g)} fotos={fotos} ultimo={ultimo?.nome} />
          ))}
        </div>
      )}

      {s.semente && (
        <details className="card mt-4 p-4 text-sm">
          <summary className="cursor-pointer font-semibold flex items-center gap-2"><ShieldCheck size={16} className="text-emerald-700" /> Como conferir este sorteio</summary>
          <div className="mt-3 text-tx space-y-2">
            <p>A ordem saiu de um embaralhamento com a semente abaixo, gerada na hora em que o sorteio começou e escondida até o último nome. Os nomes entram em ordem alfabética antes de embaralhar, e os sorteados vão em rodízio: o 1º pro bloco W, o 2º pro X, o 3º pro Y, o 4º pro Z, o 5º volta pro W, e assim por diante.</p>
            <p>Com a semente e a lista, qualquer pessoa refaz o sorteio e chega exatamente no mesmo resultado.</p>
            <div className="font-mono text-xs bg-[#f3f6fa] border border-[#d5dfeb] rounded-lg p-2 break-all">semente: {s.semente}</div>
          </div>
        </details>
      )}
      {s.fase === 'revelando' && (
        <div className="mt-3 flex items-center justify-center gap-1 text-[11px] text-tx3"><Eye size={12} /> todo mundo está vendo o mesmo sorteio, na mesma hora</div>
      )}
    </Casca>
  );
}
