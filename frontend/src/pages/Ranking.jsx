import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trophy } from 'lucide-react';
import { api } from '../api.js';
import { Casca, Avatar, dataBR } from '../components/Marca.jsx';

// Ranking do campeonato: colocação em cada evento = pontos (1º = 1), menor soma vence.
export default function Ranking() {
  const [r, setR] = useState(null);
  useEffect(() => { api.get('/historico/ranking').then((x) => setR(x.data)).catch(() => setR({ eventos: [], tabela: [] })); }, []);
  if (!r) return <Casca sub="Ranking"><div className="text-center text-tx2 py-10">Carregando…</div></Casca>;
  if (!r.tabela.length) {
    return (
      <Casca sub="Ranking do campeonato">
        <div className="card p-8 text-center text-tx">
          <Trophy className="mx-auto text-[color:var(--color-gold)] mb-3" size={40} />
          O ranking abre depois da primeira corrida lançada.
        </div>
      </Casca>
    );
  }
  const cor = (pos) => (pos === 1 ? 'text-[color:var(--color-gold)]' : pos === 2 ? 'text-tx2' : pos === 3 ? 'text-[#a8641f]' : 'text-tx3');
  const curto = (t) => t.replace(/\s*·.*$/, '');
  return (
    <Casca sub={`Ranking do campeonato${r.parcial ? ' · parcial' : ''}`}>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-tx2">
              <th className="px-2 py-2 text-center">#</th>
              <th className="px-2 py-2 text-left">Piloto</th>
              {r.eventos.map((e) => <th key={e.slug} className="px-2 py-2 text-center whitespace-nowrap" title={e.titulo}>{dataBR(e.data).slice(0, 5)}</th>)}
              <th className="px-2 py-2 text-center">Pts</th>
            </tr>
          </thead>
          <tbody>
            {r.tabela.map((l) => (
              <tr key={l.chave} className="border-t border-[#e3e9f1]">
                <td className={`px-2 py-2 text-center font-extrabold tabular-nums ${cor(l.pos)}`}>{l.pos}</td>
                <td className="px-2 py-2">
                  {l.piloto_id ? (
                    <Link to={`/piloto/${l.piloto_id}`} className="flex items-center gap-2 hover:text-brand">
                      <Avatar id={l.piloto_id} v={l.foto_v} nome={l.piloto} tam={28} />
                      <span className="font-medium">{l.piloto}</span>
                    </Link>
                  ) : <span className="font-medium">{l.piloto}</span>}
                </td>
                {l.colunas.map((c) => (
                  <td key={c.evento} className="px-2 py-2 text-center tabular-nums">
                    {c.pos != null ? <span>{c.pos}º</span> : <span className="text-tx3" title="não correu">{c.pontos}*</span>}
                  </td>
                ))}
                <td className="px-2 py-2 text-center font-bold tabular-nums text-[color:var(--color-brand)]">{l.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 text-[11px] text-tx2 space-y-1">
        <p>{r.regra} * = não correu.</p>
        {r.eventos.map((e) => (
          <p key={e.slug}><b className="text-tx">{dataBR(e.data)} · {curto(e.titulo)}</b>: {e.n} classificados — {e.criterio}.</p>
        ))}
      </div>
    </Casca>
  );
}
