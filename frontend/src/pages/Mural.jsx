import { useEffect, useState } from 'react';
import { Megaphone, Pin } from 'lucide-react';
import { api } from '../api.js';
import { Casca, quandoBRT } from '../components/Marca.jsx';

export default function Mural() {
  const [avisos, setAvisos] = useState(null);
  useEffect(() => { api.get('/avisos').then((r) => setAvisos(r.data)).catch(() => setAvisos([])); }, []);
  return (
    <Casca sub="Mural de notícias e avisos">
      {!avisos && <div className="text-center text-slate-400 py-10">Carregando…</div>}
      {avisos && !avisos.length && (
        <div className="card p-8 text-center text-slate-300">
          <Megaphone className="mx-auto text-[color:var(--color-gold)] mb-3" size={36} />
          Nenhum aviso ainda.
        </div>
      )}
      {avisos?.map((a) => (
        <div key={a.id} className={`card mt-3 p-4 ${a.fixado ? 'border-[color:var(--color-gold)]/60' : ''}`}>
          <div className="flex items-center gap-2 font-semibold">{a.fixado && <Pin size={14} className="text-[color:var(--color-gold)]" />}{a.titulo}</div>
          <div className="mt-2 text-sm text-slate-300 whitespace-pre-line">{a.texto}</div>
          <div className="mt-2 text-[11px] text-slate-500">{quandoBRT(a.criado_em)}</div>
        </div>
      ))}
    </Casca>
  );
}
