import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Timer, Zap, Crown } from 'lucide-react';
import { api } from '../api.js';
import { Casca } from '../components/Marca.jsx';

export default function ResultadoEtapa() {
  const { id } = useParams();
  const [dados, setDados] = useState(null);
  const cardRef = useRef(null);

  useEffect(() => {
    api.get(`/resultados/etapa/${id}`).then((r) => setDados(r.data)).catch(() => setDados({ classificacao: [] }));
  }, [id]);

  if (!dados) return <Casca sub="Resultado"><div className="text-center text-tx2 py-10">Carregando…</div></Casca>;
  const { etapa, classificacao = [] } = dados;

  const pod = (p) => (p === 1 ? '🥇' : p === 2 ? '🥈' : p === 3 ? '🥉' : `${p}º`);

  return (
    <Casca sub={etapa?.nome}>
      <div ref={cardRef} className="card p-5">
        <div className="text-center mb-4">
          <div className="text-2xl display">{etapa?.nome}</div>
          <div className="text-sm text-tx2">
            {etapa?.kartodromo} {etapa?.data && `· ${new Date(etapa.data + 'T12:00:00').toLocaleDateString('pt-BR')}`}
          </div>
        </div>
        {classificacao.length === 0 ? (
          <div className="text-center text-tx2 py-6">Resultado ainda não publicado.</div>
        ) : classificacao.map((r) => (
          <div key={r.piloto_id} className="flex items-center gap-3 py-2.5 border-b border-[#e3e9f1] last:border-0">
            <div className="w-8 text-center text-lg">{pod(r.posicao)}</div>
            <div className="flex-1">
              <div className="font-semibold">{r.apelido || r.nome}</div>
              <div className="text-xs text-tx2 flex gap-2 items-center flex-wrap">
                {r.melhor_volta && <span className="inline-flex items-center gap-1"><Timer size={12} />{r.melhor_volta}</span>}
                {r.melhor_volta_da_etapa && <span className="inline-flex items-center gap-1 text-[color:var(--color-gold)]"><Zap size={12} />volta mais rápida</span>}
                {r.pole && <span className="inline-flex items-center gap-1 text-sky-300"><Crown size={12} />pole</span>}
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-[color:var(--color-brand)]">{r.pontos}</div>
              <div className="text-[10px] text-tx3">pts</div>
            </div>
          </div>
        ))}
      </div>
    </Casca>
  );
}
