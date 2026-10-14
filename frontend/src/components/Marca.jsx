import { useEffect, useState } from 'react';
import { Home, Radio, Trophy, Users, LayoutGrid, UserRound, Shuffle, Swords, Camera, GraduationCap, Megaphone, ScrollText } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { getToken, setToken } from '../api.js';

// cabeçalho na identidade Pacheco & Reis: faixa marinho, símbolo R do logo, letras expandidas como as do logo
export function Marca() {
  return (
    <header className="relative overflow-hidden bg-[color:var(--color-brand-dark)] text-white" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
        <Link to="/" className="flex items-center gap-3 min-w-0">
          <img src="/img/simbolo-branco.png" alt="" className="h-9 w-auto shrink-0" />
          <span className="leading-none min-w-0">
            <span className="display block text-[19px]">P&amp;R Racing Cup</span>
            <span className="block mt-1 text-[10px] uppercase tracking-[0.22em] text-white/70 truncate">Pacheco &amp; Reis Advogados</span>
          </span>
        </Link>
      </div>
      <div className="h-[3px] bg-[color:var(--color-brand)]" />
    </header>
  );
}

// navegação de app: 4 abas fixas embaixo + "Mais" (o resto)
export const ABAS = [['/', 'Início', Home], ['/ao-vivo', 'Ao vivo', Radio], ['/ranking', 'Ranking', Trophy], ['/pilotos', 'Pilotos', Users], ['/mais', 'Mais', LayoutGrid]];
export const MAIS = [
  ['/ficha', 'Minha ficha', UserRound, 'Foto, contato, peso e altura'],
  ['/sorteio', 'Sorteio dos grupos', Shuffle, 'Ao vivo, pra todo mundo ao mesmo tempo'],
  ['/comparar', 'Comparar pilotos', Swords, 'Lado a lado e confronto direto'],
  ['/midia', 'Fotos e vídeos', Camera, 'Suba o que você gravou no dia'],
  ['/dicas', 'Dicas de pilotagem', GraduationCap, 'Traçado, freio, ultrapassagem'],
  ['/mural', 'Mural', Megaphone, 'Avisos da organização'],
  ['/regulamento', 'Regulamento', ScrollText, 'Formato, pontos e regras'],
];
const EM_MAIS = MAIS.map(([to]) => to);

export function Menu() {
  const { pathname } = useLocation();
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-[#e3e9f1]" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="max-w-xl mx-auto grid grid-cols-5">
        {ABAS.map(([to, rot, Icone]) => {
          const ativo = to === '/' ? pathname === '/' : pathname.startsWith(to) || (to === '/mais' && EM_MAIS.some((m) => pathname.startsWith(m)))
            || (to === '/pilotos' && pathname.startsWith('/piloto/'));
          return (
            <Link key={to} to={to} className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ${ativo ? 'text-brand' : 'text-tx3'}`}>
              <Icone size={21} strokeWidth={ativo ? 2.4 : 1.8} />{rot}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function Rodape() {
  const [org, setOrg] = useState(!!getToken());
  return (
    <div className="mt-10 mb-6 flex flex-col items-center gap-2 text-xs text-tx3">
      <span>P&amp;R Racing Cup · Pacheco &amp; Reis Advogados</span>
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
    <div className="min-h-screen pb-24">
      <Marca />
      <div className={`${largo ? 'max-w-3xl' : 'max-w-xl'} mx-auto px-4 pt-5`}>
        {sub && <h1 className="display text-[22px] leading-tight text-brand-dark mb-4">{sub}</h1>}
        {children}
        <Rodape />
      </div>
      <Menu />
    </div>
  );
}

// foto do piloto (ou as iniciais, enquanto ele não mandou foto)
export function Avatar({ id, v, nome, tam = 40, className = '' }) {
  const iniciais = String(nome || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
  const estilo = { width: tam, height: tam, fontSize: Math.round(tam * 0.38) };
  if (id && v) {
    return <img src={`/api/pilotos/${id}/foto?v=${v}`} alt={nome} style={estilo} loading="lazy"
      className={`rounded-full object-cover bg-[#e8eff7] shrink-0 ${className}`} />;
  }
  return (
    <div style={estilo} className={`rounded-full bg-[#e8eff7] border border-[#d5dfeb] text-tx font-bold flex items-center justify-center shrink-0 ${className}`}>
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
        <div key={r} className={`rounded-xl bg-[#f3f6fa] border border-[#d5dfeb] ${grande ? 'py-3' : 'py-2'}`}>
          <div className={`${grande ? 'text-4xl' : 'text-3xl'} display tabular-nums text-brand-dark`}>{String(n).padStart(2, '0')}</div>
          <div className="text-[11px] uppercase tracking-wide text-tx2">{r}</div>
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
