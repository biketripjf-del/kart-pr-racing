import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Trophy, Timer, Flag, Medal, Instagram, PencilLine } from 'lucide-react';
import { api } from '../api.js';
import { Casca, Avatar, volta, dataBR } from '../components/Marca.jsx';

function Numero({ rot, valor, icone: Icone }) {
  return (
    <div className="rounded-xl bg-[#0a1930] border border-[#24406b] p-3 text-center">
      {Icone && <Icone size={15} className="mx-auto text-[color:var(--color-gold)]" />}
      <div className="mt-1 text-2xl font-extrabold tabular-nums" style={{ fontFamily: 'var(--font-display)' }}>{valor ?? '—'}</div>
      <div className="text-[11px] uppercase tracking-wide text-slate-400">{rot}</div>
    </div>
  );
}

export default function Piloto() {
  const { id } = useParams();
  const [d, setD] = useState(null);
  useEffect(() => { api.get(`/historico/piloto/${id}`).then((r) => setD(r.data)).catch(() => setD(false)); }, [id]);
  if (d === null) return <Casca sub="Piloto"><div className="text-center text-slate-400 py-10">Carregando…</div></Casca>;
  if (!d) return <Casca sub="Piloto"><div className="card p-8 text-center text-slate-300">Piloto não encontrado.</div></Casca>;
  const { piloto: p, numeros: n, ranking } = d;
  const voltas = Object.entries(n.melhor_volta_por_tracado);
  return (
    <Casca sub="Piloto">
      <div className="card p-5 flex flex-col items-center text-center">
        <Avatar id={p.id} v={p.foto_v} nome={p.nome} tam={112} />
        <div className="mt-3 text-3xl font-extrabold leading-none" style={{ fontFamily: 'var(--font-display)' }}>{p.nome}</div>
        {p.apelido && p.apelido !== p.nome && <div className="mt-1 text-sm text-slate-400">"{p.apelido}"</div>}
        <div className="mt-2 flex items-center gap-3 text-xs text-slate-400">
          {p.cidade && <span>{p.cidade}</span>}
          {p.instagram && <a href={`https://instagram.com/${p.instagram}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-white"><Instagram size={13} />@{p.instagram}</a>}
        </div>
        {ranking && (
          <div className="mt-3 px-3 py-1 rounded-full bg-[color:var(--color-brand)] text-white text-sm font-bold">
            {ranking.pos}º no ranking{ranking.parcial ? ' (parcial)' : ''} · {ranking.total} pts
          </div>
        )}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Numero rot="corridas" valor={n.corridas_disputadas} icone={Flag} />
        <Numero rot="vitórias" valor={n.vitorias} icone={Trophy} />
        <Numero rot="pódios" valor={n.podios} icone={Medal} />
        <Numero rot="posição média" valor={n.media_posicao?.toLocaleString('pt-BR')} />
        <Numero rot="melhor posição" valor={n.melhor_posicao ? `${n.melhor_posicao}º` : null} />
        <Numero rot="títulos" valor={n.titulos} />
      </div>

      {voltas.length > 0 && (
        <div className="card mt-4 p-4">
          <div className="flex items-center gap-2 font-semibold"><Timer size={16} className="text-[color:var(--color-gold)]" /> Melhor volta</div>
          <div className="mt-2 space-y-1 text-sm">
            {voltas.map(([t, v]) => (
              <div key={t} className="flex justify-between"><span className="text-slate-300">{t} <span className="text-[11px] text-slate-500">· {dataBR(v.data)}</span></span><b className="tabular-nums">{volta(v.mv_ms)}</b></div>
            ))}
          </div>
          <div className="mt-2 text-[11px] text-slate-500">Separado por traçado: volta de traçado diferente não se compara.</div>
        </div>
      )}

      {n.eventos.length > 0 && (
        <div className="card mt-4 p-4">
          <div className="font-semibold">Eventos</div>
          {n.eventos.map((e) => (
            <div key={e.slug} className="mt-2 flex justify-between text-sm">
              <span className="text-slate-300">{dataBR(e.data)} · {e.titulo.replace(/\s*·.*$/, '')}</span>
              <b>{e.campeao ? '🏆 ' : ''}{e.pos}º de {e.de}{e.completa ? '' : ' (parcial)'}</b>
            </div>
          ))}
        </div>
      )}

      {n.corridas.length > 0 && (
        <div className="card mt-4 overflow-x-auto">
          <div className="px-4 pt-3 font-semibold">Corrida a corrida</div>
          <table className="w-full text-sm mt-1">
            <thead><tr className="text-[11px] uppercase tracking-wide text-slate-400">
              <th className="px-2 py-2 text-left">Corrida</th><th className="px-2 py-2">Pos</th><th className="px-2 py-2">Kart</th><th className="px-2 py-2">Melhor volta</th>
            </tr></thead>
            <tbody>
              {n.corridas.map((c, i) => (
                <tr key={i} className="border-t border-[#1d3252]">
                  <td className="px-2 py-2"><div>{c.sessao_nome}</div><div className="text-[11px] text-slate-500">{dataBR(c.data)}{c.tracado ? ` · ${c.tracado}` : ''}</div></td>
                  <td className="px-2 py-2 text-center tabular-nums">{c.ausente ? <span className="text-red-300">faltou</span> : `${c.pos}º`}</td>
                  <td className="px-2 py-2 text-center tabular-nums">{c.kart ?? '—'}</td>
                  <td className="px-2 py-2 text-center tabular-nums">{volta(c.mv_ms)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!n.corridas.length && <div className="card mt-4 p-5 text-center text-sm text-slate-400">Ainda não correu nenhuma corrida registrada no app.</div>}

      <Link to={`/ficha/${p.id}`} className="mt-4 flex items-center justify-center gap-1 text-xs text-slate-400 hover:text-white"><PencilLine size={13} /> É você? Atualize sua ficha</Link>
    </Casca>
  );
}
