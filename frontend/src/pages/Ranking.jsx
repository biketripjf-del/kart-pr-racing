import { useEffect, useState } from 'react';
import { Trophy, Medal } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { Casca } from '../components/Marca.jsx';

export default function Ranking() {
  const [dados, setDados] = useState(null);

  useEffect(() => {
    api.get('/ranking').then((r) => setDados(r.data)).catch(() => setDados({ ranking: [], etapas_realizadas: [] }));
  }, []);

  if (!dados) return <Casca sub="Ranking"><div className="text-center text-slate-400 py-10">Carregando…</div></Casca>;

  const medalha = (pos) =>
    pos === 1 ? 'text-yellow-400' : pos === 2 ? 'text-slate-300' : pos === 3 ? 'text-amber-600' : 'text-slate-500';

  return (
    <Casca sub="Classificação do campeonato">
      {dados.ranking.length === 0 ? (
        <div className="card p-8 text-center text-slate-300">
          <Trophy className="mx-auto text-[color:var(--color-gold)] mb-3" size={40} />
          O ranking abre depois da primeira etapa. Bora correr! 🏁
          <div className="mt-4"><Link to="/" className="btn btn-primary inline-flex">Fazer inscrição</Link></div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          {dados.ranking.map((l) => (
            <div key={l.piloto_id} className="flex items-center gap-3 px-4 py-3 border-b border-[#1d3252] last:border-0">
              <div className={`w-8 text-center font-bold ${medalha(l.posicao)}`}>
                {l.posicao <= 3 ? <Medal size={20} className="mx-auto" /> : l.posicao}
              </div>
              <div className="flex-1">
                <div className="font-semibold">{l.apelido || l.nome}</div>
                {l.apelido && <div className="text-xs text-slate-400">{l.nome}</div>}
              </div>
              <div className="text-xs text-slate-400">{l.etapas_disputadas} et.</div>
              <div className="text-xl font-bold text-[color:var(--color-brand)] w-12 text-right">{l.pontos_liquidos}</div>
            </div>
          ))}
        </div>
      )}

      {dados.etapas_realizadas?.length > 0 && (
        <div className="mt-6">
          <div className="label mb-2">Etapas realizadas</div>
          <div className="flex flex-wrap gap-2">
            {dados.etapas_realizadas.map((e) => (
              <Link key={e.id} to={`/etapa/${e.id}`} className="btn btn-ghost text-sm">{e.nome}</Link>
            ))}
          </div>
        </div>
      )}
    </Casca>
  );
}
