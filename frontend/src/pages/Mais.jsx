import { Link } from 'react-router-dom';
import { ChevronRight, KeyRound } from 'lucide-react';
import { getToken, setToken } from '../api.js';
import { Casca, MAIS } from '../components/Marca.jsx';
import { InstalarApp } from '../components/Instalar.jsx';

export default function Mais() {
  return (
    <Casca sub="Mais">
      <InstalarApp />
      <div className="card overflow-hidden">
        {MAIS.map(([to, rot, Icone, dica]) => (
          <Link key={to} to={to} className="flex items-center gap-3 px-4 py-3.5 border-b border-[#e3e9f1] last:border-0 hover:bg-[#eef3f9]">
            <span className="w-10 h-10 rounded-xl bg-[#e8eff7] text-brand flex items-center justify-center shrink-0"><Icone size={20} /></span>
            <span className="flex-1 min-w-0">
              <span className="block font-semibold">{rot}</span>
              <span className="block text-xs text-tx2 truncate">{dica}</span>
            </span>
            <ChevronRight size={18} className="text-tx3" />
          </Link>
        ))}
      </div>
      <Organizador />
    </Casca>
  );
}

// porta de entrada do organizador (Brunner 14/10: "como assim logado?" — o login só existia digitando /admin/login)
function Organizador() {
  if (!getToken()) {
    return (
      <Link to="/admin/login?volta=/ficha" className="mt-4 flex items-center justify-center gap-1.5 text-xs text-tx2 py-2">
        <KeyRound size={13} /> Área do organizador
      </Link>
    );
  }
  const atalhos = [['/ficha', 'Links das fichas'], ['/sorteio', 'Sorteio'], ['/mural', 'Mural'], ['/admin', 'Painel']];
  return (
    <div className="card mt-4 p-4">
      <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-brand"><KeyRound size={13} /> Você está como organizador</div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {atalhos.map(([to, rot]) => <Link key={to} to={to} className="btn btn-ghost py-2 text-sm">{rot}</Link>)}
      </div>
      <button className="mt-3 w-full text-xs text-tx2 underline" onClick={() => { setToken(null); location.reload(); }}>Sair do modo organizador</button>
    </div>
  );
}
