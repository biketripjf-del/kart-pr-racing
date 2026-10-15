import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, ChevronRight, Info } from 'lucide-react';
import { api } from '../api.js';
import { Casca, Avatar, dataBR } from '../components/Marca.jsx';

// Ranking do campeonato (Brunner 14/10: "tem que ser lista (...) tem que ter o podio. igual ao ranking do app do pedal
// mas com estilo de corrida"). Pódio 2-1-3 em degraus com zebra de pista; o resto como torre de cronometragem.
// Regra: colocação em cada evento = pontos (1º = 1), menor soma vence.

const ZEBRA = { backgroundImage: 'repeating-linear-gradient(90deg, #d0312d 0 14px, #ffffff 14px 28px)' };

function Degrau({ l, pos }) {
  const alto = { 1: 'h-28', 2: 'h-20', 3: 'h-14' }[pos];
  const tam = pos === 1 ? 76 : 60;
  const conteudo = (
    <div className="flex flex-col items-center">
      {pos === 1 && <Trophy size={20} className="text-[color:var(--color-gold)] mb-1" />}
      <div className={`rounded-full p-[3px] ${pos === 1 ? 'bg-[color:var(--color-gold)]' : 'bg-[#c5d0de]'}`}>
        <div className="rounded-full bg-white p-[2px]"><Avatar id={l.piloto_id} v={l.foto_v} nome={l.piloto} tam={tam} /></div>
      </div>
      <div className="mt-1.5 text-[13px] font-bold leading-tight text-center line-clamp-2 px-1">{l.piloto}</div>
      <div className="text-[11px] text-tx2 tabular-nums">{l.total} pts</div>
      <div className={`mt-2 w-full ${alto} rounded-t-lg bg-[color:var(--color-brand-dark)] relative overflow-hidden flex items-start justify-center`}>
        <div className="absolute top-0 inset-x-0 h-1.5" style={ZEBRA} />
        <span className="display text-white/95 mt-3 text-3xl">{pos}</span>
      </div>
    </div>
  );
  return l.piloto_id ? <Link to={`/piloto/${l.piloto_id}`} className="flex-1 min-w-0">{conteudo}</Link> : <div className="flex-1 min-w-0">{conteudo}</div>;
}

function Linha({ l, lider, eventos }) {
  const gap = l.total - lider;
  const corpo = (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <span className="w-8 h-8 rounded-md bg-[#eef3f9] border border-[#d5dfeb] flex items-center justify-center display text-[15px] text-brand-dark tabular-nums shrink-0">{l.pos}</span>
      <span className="w-1 self-stretch rounded-full bg-brand shrink-0" />
      <Avatar id={l.piloto_id} v={l.foto_v} nome={l.piloto} tam={36} />
      <span className="flex-1 min-w-0">
        <span className="block font-semibold truncate">{l.piloto}</span>
        <span className="block text-[11px] text-tx2 truncate">
          {l.colunas.map((c, i) => (
            <span key={c.evento}>{i ? ' · ' : ''}{dataBR(eventos[i]?.data).slice(0, 5)}: {c.pos != null ? `${c.pos}º` : 'não correu'}</span>
          ))}
        </span>
      </span>
      <span className="text-right shrink-0">
        <span className="block font-extrabold tabular-nums text-brand-dark leading-none">{l.total}<span className="text-[10px] font-semibold text-tx3 ml-0.5">pts</span></span>
        <span className="block text-[11px] text-tx3 tabular-nums mt-0.5">{gap ? `+${gap}` : 'líder'}</span>
      </span>
      {l.piloto_id && <ChevronRight size={16} className="text-tx3 shrink-0" />}
    </div>
  );
  return l.piloto_id
    ? <Link to={`/piloto/${l.piloto_id}`} className="block hover:bg-[#f3f6fa]">{corpo}</Link>
    : <div>{corpo}</div>;
}

export default function Ranking() {
  const [r, setR] = useState(null);
  const [regra, setRegra] = useState(false);
  useEffect(() => { api.get('/historico/ranking').then((x) => setR(x.data)).catch(() => setR({ eventos: [], tabela: [] })); }, []);
  if (!r) return <Casca sub="Ranking"><div className="text-center text-tx2 py-10">Carregando…</div></Casca>;
  if (!r.tabela.length) {
    return (
      <Casca sub="Ranking">
        <div className="card p-8 text-center text-tx">
          <Trophy className="mx-auto text-[color:var(--color-gold)] mb-3" size={40} />
          O ranking abre depois da primeira corrida lançada.
        </div>
      </Casca>
    );
  }
  const top = r.tabela.slice(0, 3);
  const resto = r.tabela.slice(3);
  const lider = r.tabela[0].total;
  const curto = (t) => t.replace(/\s*·.*$/, '');
  return (
    <Casca sub="Ranking do campeonato">
      <div className="flex items-center justify-between -mt-2 mb-3 text-xs text-tx2">
        <span>{r.eventos.length} evento{r.eventos.length > 1 ? 's' : ''} · {r.tabela.length} pilotos</span>
        {r.parcial && <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold">parcial</span>}
      </div>

      {top.length === 3 && (
        <div className="card px-3 pt-4 pb-0 overflow-hidden">
          <div className="flex items-end gap-2">
            <Degrau l={top[1]} pos={2} />
            <Degrau l={top[0]} pos={1} />
            <Degrau l={top[2]} pos={3} />
          </div>
        </div>
      )}

      <div className="card mt-3 overflow-hidden divide-y divide-[#e3e9f1]">
        {(top.length === 3 ? resto : r.tabela).map((l) => <Linha key={l.chave} l={l} lider={lider} eventos={r.eventos} />)}
      </div>

      <button onClick={() => setRegra(!regra)} className="mt-3 flex items-center gap-1.5 text-xs text-tx2"><Info size={13} /> Como funciona a pontuação</button>
      {regra && (
        <div className="mt-2 text-[12px] text-tx2 space-y-1 card p-3">
          <p>{r.regra}</p>
          {r.eventos.map((e) => <p key={e.slug}><b className="text-tx">{dataBR(e.data)} · {curto(e.titulo)}</b>: {e.n} classificados ({e.criterio}).</p>)}
        </div>
      )}
    </Casca>
  );
}
