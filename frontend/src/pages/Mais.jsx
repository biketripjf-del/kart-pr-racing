import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
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
    </Casca>
  );
}
