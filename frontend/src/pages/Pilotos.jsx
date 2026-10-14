import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { Casca, Avatar } from '../components/Marca.jsx';

export default function Pilotos() {
  const [lista, setLista] = useState(null);
  useEffect(() => { api.get('/historico/pilotos').then((r) => setLista(r.data)).catch(() => setLista([])); }, []);
  return (
    <Casca sub="Pilotos">
      {!lista && <div className="text-center text-tx2 py-10">Carregando…</div>}
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
        {lista?.map((p) => (
          <Link key={p.piloto_id} to={`/piloto/${p.piloto_id}`} className="card p-3 flex flex-col items-center text-center gap-2 hover:border-[color:var(--color-brand)]">
            <Avatar id={p.piloto_id} v={p.foto_v} nome={p.nome} tam={64} />
            <div className="text-[13px] font-semibold leading-tight">{p.nome}</div>
            <div className="text-[11px] text-tx2">{p.ranking ? `${p.ranking}º no ranking` : 'estreante'}</div>
          </Link>
        ))}
      </div>
    </Casca>
  );
}
