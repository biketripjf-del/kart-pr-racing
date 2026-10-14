import { useEffect, useState } from 'react';
import { Flag } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import { getToken, setToken } from '../api.js';

export function Marca({ sub }) {
  return (
    <div className="flex flex-col items-center text-center gap-1">
      <Link to="/" className="flex items-center gap-2">
        <Flag className="text-[color:var(--color-gold)]" size={22} />
        <span style={{ fontFamily: 'var(--font-display)' }} className="text-3xl tracking-wide font-extrabold">
          P&R <span className="text-[color:var(--color-brand)]">RACING CUP</span>
        </span>
        <Flag className="text-[color:var(--color-gold)]" size={22} />
      </Link>
      <div className="text-xs uppercase tracking-[0.25em] text-slate-400">Pacheco &amp; Reis Advogados</div>
      {sub && <div className="text-sm text-slate-300 mt-1">{sub}</div>}
    </div>
  );
}

// menu comum a todas as páginas públicas — rola de lado no celular
export const MENU = [
  ['/', 'Início'], ['/ao-vivo', 'Ao vivo'], ['/sorteio', 'Sorteio'], ['/ranking', 'Ranking'], ['/pilotos', 'Pilotos'], ['/comparar', 'Comparar'],
  ['/mural', 'Mural'], ['/regulamento', 'Regulamento'], ['/ficha', 'Minha ficha'],
];

export function Menu() {
  return (
    <nav className="mt-5 -mx-4 px-4 overflow-x-auto [scrollbar-width:none]">
      <div className="flex gap-1.5 w-max mx-auto">
        {MENU.map(([to, rot]) => (
          <NavLink key={to} to={to} end={to === '/'}
            className={({ isActive }) => `whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] font-semibold border ${isActive
              ? 'bg-[color:var(--color-brand)] border-transparent text-white'
              : 'border-[#1d3252] text-slate-300 hover:text-white'}`}>
            {rot}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

export function Rodape() {
  const [org, setOrg] = useState(!!getToken());
  return (
    <div className="mt-10 mb-6 flex flex-col items-center gap-2 text-xs text-slate-500">
      <span>P&amp;R Racing Cup · Kartódromo Internacional de Volta Redonda</span>
      {org && (
        <span className="text-[color:var(--color-gold)]">
          modo organizador · <Link to="/admin" className="underline">painel</Link> · <button className="underline" onClick={() => { setToken(null); setOrg(false); location.reload(); }}>sair</button>
        </span>
      )}
    </div>
  );
}

export function Casca({ children, sub, largo }) {
  return (
    <div className="min-h-screen">
      <div className="checkers h-2 w-full" />
      <div className={`${largo ? 'max-w-3xl' : 'max-w-xl'} mx-auto px-4 pt-8`}>
        <Marca sub={sub} />
        <Menu />
        <div className="mt-6">{children}</div>
        <Rodape />
      </div>
    </div>
  );
}

// foto do piloto (ou as iniciais, enquanto ele não mandou foto)
export function Avatar({ id, v, nome, tam = 40, className = '' }) {
  const iniciais = String(nome || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
  const estilo = { width: tam, height: tam, fontSize: Math.round(tam * 0.38) };
  if (id && v) {
    return <img src={`/api/pilotos/${id}/foto?v=${v}`} alt={nome} style={estilo} loading="lazy"
      className={`rounded-full object-cover bg-[#13294a] shrink-0 ${className}`} />;
  }
  return (
    <div style={estilo} className={`rounded-full bg-[#13294a] border border-[#24406b] text-slate-300 font-bold flex items-center justify-center shrink-0 ${className}`}>
      {iniciais}
    </div>
  );
}

export const volta = (ms) => {
  if (ms == null) return '—';
  const min = Math.floor(ms / 60000);
  const seg = ((ms % 60000) / 1000).toFixed(3).padStart(6, '0');
  return min > 0 ? `${min}:${seg}` : seg;
};

export const dataBR = (iso) => (iso ? new Date(`${String(iso).slice(0, 10)}T12:00:00-03:00`).toLocaleDateString('pt-BR', {
  day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo',
}) : '');

export const quandoBRT = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR', {
  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo',
}) : '');

export const diaDaSemana = (iso) => (iso ? new Date(`${String(iso).slice(0, 10)}T12:00:00-03:00`).toLocaleDateString('pt-BR', {
  weekday: 'long', timeZone: 'America/Sao_Paulo',
}) : '');

// contagem regressiva AO VIVO: dias · horas · min · seg, anda de segundo em segundo
export function Contador({ ms, grande }) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const partes = [[Math.floor(s / 86400), 'dias'], [Math.floor((s % 86400) / 3600), 'horas'], [Math.floor((s % 3600) / 60), 'min'], [s % 60, 'seg']];
  return (
    <div className="grid grid-cols-4 gap-2 text-center">
      {partes.map(([n, r]) => (
        <div key={r} className={`rounded-xl bg-[#0a1930] border border-[#24406b] ${grande ? 'py-3' : 'py-2'}`}>
          <div className={`${grande ? 'text-4xl' : 'text-3xl'} font-extrabold tabular-nums`} style={{ fontFamily: 'var(--font-display)' }}>{String(n).padStart(2, '0')}</div>
          <div className="text-[11px] uppercase tracking-wide text-slate-400">{r}</div>
        </div>
      ))}
    </div>
  );
}

// o relógio da tela, batendo a cada `passo` ms
export function useAgora(passo = 1000) {
  const [agora, setAgora] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setAgora(Date.now()), passo); return () => clearInterval(t); }, [passo]);
  return agora;
}
