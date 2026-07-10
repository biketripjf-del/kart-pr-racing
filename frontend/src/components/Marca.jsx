import { Flag } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Marca({ sub }) {
  return (
    <div className="flex flex-col items-center text-center gap-1">
      <div className="flex items-center gap-2">
        <Flag className="text-[color:var(--color-gold)]" size={22} />
        <span style={{ fontFamily: 'var(--font-display)' }} className="text-3xl tracking-wide font-extrabold">
          P&R <span className="text-[color:var(--color-brand)]">RACING CUP</span>
        </span>
        <Flag className="text-[color:var(--color-gold)]" size={22} />
      </div>
      <div className="text-xs uppercase tracking-[0.25em] text-slate-400">Pacheco &amp; Reis Advogados</div>
      {sub && <div className="text-sm text-slate-300 mt-1">{sub}</div>}
    </div>
  );
}

export function Rodape() {
  return (
    <div className="mt-10 mb-6 flex justify-center gap-4 text-xs text-slate-500">
      <Link to="/" className="hover:text-slate-300">Inscrição</Link>
      <span>·</span>
      <Link to="/ranking" className="hover:text-slate-300">Ranking</Link>
    </div>
  );
}

export function Casca({ children, sub }) {
  return (
    <div className="min-h-screen">
      <div className="checkers h-2 w-full" />
      <div className="max-w-xl mx-auto px-4 pt-8">
        <Marca sub={sub} />
        <div className="mt-8">{children}</div>
        <Rodape />
      </div>
    </div>
  );
}
