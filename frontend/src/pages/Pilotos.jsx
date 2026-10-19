import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, ChevronRight } from 'lucide-react';
import { api } from '../api.js';
import { Casca, Avatar } from '../components/Marca.jsx';

// Pilotos em LISTA (14/10: o grid de cartões "ta estranho"), na ordem do ranking, com busca.
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default function Pilotos() {
  const [lista, setLista] = useState(null);
  const [busca, setBusca] = useState('');
  useEffect(() => { api.get('/historico/pilotos').then((r) => setLista(r.data)).catch(() => setLista([])); }, []);
  const mostrados = (lista || []).filter((p) => norm(p.nome).includes(norm(busca)));
  return (
    <Casca sub="Pilotos">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-tx3" />
        <input className="input pl-9" placeholder="Procurar piloto" value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>
      {!lista && <div className="text-center text-tx2 py-10">Carregando…</div>}
      <div className="card mt-3 overflow-hidden divide-y divide-[#e3e9f1]">
        {mostrados.map((p) => (
          <Link key={p.piloto_id} to={`/piloto/${p.piloto_id}`} className="flex items-center gap-3 px-3 py-2.5 hover:bg-[#f3f6fa]">
            <Avatar id={p.piloto_id} v={p.foto_v} nome={p.nome} tam={42} />
            <span className="flex-1 min-w-0">
              <span className="block font-semibold truncate">{p.nome}</span>
              <span className="block text-[11px] text-tx2">{p.ranking ? `${p.ranking}º no ranking ${p.ano}` : p.ja_correu ? `não correu em ${p.ano}` : 'estreia na 3ª Copa'}</span>
            </span>
            <ChevronRight size={16} className="text-tx3" />
          </Link>
        ))}
        {lista && !mostrados.length && <div className="p-6 text-center text-sm text-tx2">Ninguém com esse nome.</div>}
      </div>
    </Casca>
  );
}
