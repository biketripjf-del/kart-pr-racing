import { useEffect, useState } from 'react';
import { ScrollText } from 'lucide-react';
import { api } from '../api.js';
import { Casca, dataBR } from '../components/Marca.jsx';

// regulamento = o texto gravado no evento atual (a mesma fonte do quadro ao vivo)
export default function Regulamento() {
  const [ev, setEv] = useState(null);
  useEffect(() => {
    api.get('/config').then(({ data }) => api.get(`/ao-vivo/${data.evento_atual}`)).then((r) => setEv(r.data.evento)).catch(() => setEv(false));
  }, []);
  if (ev === null) return <Casca sub="Regulamento"><div className="text-center text-tx2 py-10">Carregando…</div></Casca>;
  if (!ev?.regulamento) return <Casca sub="Regulamento"><div className="card p-8 text-center text-tx">Regulamento ainda não publicado.</div></Casca>;
  // "1. FORMATO" vira título de seção; "- item" vira item de lista
  const blocos = ev.regulamento.split(/\n(?=\d+\.\s)/);
  return (
    <Casca sub={`Regulamento · ${ev.titulo}`}>
      <div className="card p-4 flex items-center gap-3 text-sm text-tx">
        <ScrollText className="text-[color:var(--color-gold)] shrink-0" />
        <span>{ev.local} · {dataBR(ev.data)}</span>
      </div>
      {blocos.map((b, i) => {
        const [primeira, ...resto] = b.split('\n');
        const ehSecao = /^\d+\.\s/.test(primeira);
        return (
          <div key={i} className="card mt-3 p-4">
            {ehSecao ? <div className="font-extrabold text-lg display">{primeira}</div>
              : <div className="text-sm text-tx">{primeira}</div>}
            <ul className="mt-2 space-y-1.5 text-sm text-tx">
              {resto.filter((l) => l.trim()).map((l, j) => (
                <li key={j} className="flex gap-2"><span className="text-[color:var(--color-brand)]">•</span><span>{l.replace(/^-\s*/, '')}</span></li>
              ))}
            </ul>
          </div>
        );
      })}
    </Casca>
  );
}
