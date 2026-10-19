import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Trophy, ChevronRight, Info, Gauge, Timer, Flag } from 'lucide-react';
import { api } from '../api.js';
import { Casca, Avatar, dataBR, volta, atras } from '../components/Marca.jsx';

// Ranking do campeonato (Brunner 14/10: "tem que ser lista (...) tem que ter o podio. igual ao ranking do app do pedal
// mas com estilo de corrida"). Pódio 2-1-3 em degraus com zebra de pista; o resto como torre de cronometragem.
// Regra (19/10/2026): pontos estilo F1 por evento, avulsa vale metade, falta = 0, mais pontos vence (historico.js).

const pts = (n) => Number(n).toLocaleString('pt-BR');

const ZEBRA = { backgroundImage: 'repeating-linear-gradient(90deg, #d0312d 0 14px, #ffffff 14px 28px)' };

function Degrau({ l, pos, rotulo }) {
  const alto = { 1: 'h-28', 2: 'h-20', 3: 'h-14' }[pos];
  const tam = pos === 1 ? 76 : 60;
  const conteudo = (
    <div className="flex flex-col items-center">
      {pos === 1 && <Trophy size={20} className="text-[color:var(--color-gold)] mb-1" />}
      <div className={`rounded-full p-[3px] ${pos === 1 ? 'bg-[color:var(--color-gold)]' : 'bg-[#c5d0de]'}`}>
        <div className="rounded-full bg-white p-[2px]"><Avatar id={l.piloto_id} v={l.foto_v} nome={l.piloto} tam={tam} /></div>
      </div>
      <div className="mt-1.5 text-[13px] font-bold leading-tight text-center line-clamp-2 px-1">{l.piloto}</div>
      <div className="text-[11px] text-tx2 tabular-nums">{rotulo ?? `${pts(l.total)} pts`}</div>
      <div className={`mt-2 w-full ${alto} rounded-t-lg bg-[color:var(--color-brand-dark)] relative overflow-hidden flex items-start justify-center`}>
        <div className="absolute top-0 inset-x-0 h-1.5" style={ZEBRA} />
        <span className="display text-white/95 mt-3 text-3xl">{pos}</span>
      </div>
    </div>
  );
  return l.piloto_id ? <Link to={`/piloto/${l.piloto_id}`} className="flex-1 min-w-0">{conteudo}</Link> : <div className="flex-1 min-w-0">{conteudo}</div>;
}

function Linha({ l, lider, eventos }) {
  const gap = lider - l.total;
  const corpo = (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <span className="w-8 h-8 rounded-md bg-[#eef3f9] border border-[#d5dfeb] flex items-center justify-center display text-[15px] text-brand-dark tabular-nums shrink-0">{l.pos}</span>
      <span className="w-1 self-stretch rounded-full bg-brand shrink-0" />
      <Avatar id={l.piloto_id} v={l.foto_v} nome={l.piloto} tam={36} />
      <span className="flex-1 min-w-0">
        <span className="block font-semibold truncate">{l.piloto}</span>
        <span className="block text-[11px] text-tx2 truncate">
          {l.colunas.map((c, i) => (
            <span key={c.evento}>{i ? ' · ' : ''}{dataBR(eventos[i]?.data).slice(0, 5)}: {c.pos != null ? `${c.pos}º (${pts(c.pontos)})` : 'não correu'}</span>
          ))}
        </span>
      </span>
      <span className="text-right shrink-0">
        <span className="block font-extrabold tabular-nums text-brand-dark leading-none">{pts(l.total)}<span className="text-[10px] font-semibold text-tx3 ml-0.5">pts</span></span>
        <span className="block text-[11px] text-tx3 tabular-nums mt-0.5">{gap ? `−${pts(gap)}` : 'líder'}</span>
      </span>
      {l.piloto_id && <ChevronRight size={16} className="text-tx3 shrink-0" />}
    </div>
  );
  return l.piloto_id
    ? <Link to={`/piloto/${l.piloto_id}`} className="block hover:bg-[#f3f6fa]">{corpo}</Link>
    : <div>{corpo}</div>;
}

function Abas({ aba, setAba }) {
  const itens = [['pontos', 'Pontos', Trophy], ['eventos', 'Eventos', Flag], ['ritmo', 'Ritmo', Gauge], ['recordes', 'Recordes', Timer]];
  return (
    <div className="mb-3 grid grid-cols-4 gap-1 p-1 rounded-xl bg-white border border-[#e3e9f1]">
      {itens.map(([k, t, I]) => (
        <button key={k} onClick={() => setAba(k)}
          className={`py-2 rounded-lg text-[12px] font-semibold flex items-center justify-center gap-1 ${aba === k ? 'bg-[color:var(--color-brand)] text-white' : 'text-tx'}`}><I size={13} />{t}</button>
      ))}
    </div>
  );
}

function Ritmo() {
  const [r, setR] = useState(null);
  const [regra, setRegra] = useState(false);
  useEffect(() => { api.get('/historico/ritmo').then((x) => setR(x.data)).catch(() => setR({ tabela: [] })); }, []);
  if (!r) return <div className="text-center text-tx2 py-10">Carregando…</div>;
  if (!r.tabela.length) return <div className="card p-8 text-center text-tx">Ainda não há corrida com tempo pra medir ritmo.</div>;
  return (
    <>
      <div className="text-xs text-tx2 mb-2">Quanto cada um fica, em média, atrás da volta mais rápida de cada corrida. Compara anos e traçados diferentes na mesma régua.</div>
      <div className="card overflow-hidden divide-y divide-[#e3e9f1]">
        {r.tabela.map((l) => {
          const corpo = (
            <div className="flex items-center gap-3 px-3 py-2.5">
              <span className="w-8 h-8 rounded-md bg-[#eef3f9] border border-[#d5dfeb] flex items-center justify-center display text-[15px] text-brand-dark tabular-nums shrink-0">{l.pos}</span>
              <span className="w-1 self-stretch rounded-full bg-brand shrink-0" />
              <Avatar id={l.piloto_id} v={l.foto_v} nome={l.piloto} tam={36} />
              <span className="flex-1 min-w-0">
                <span className="block font-semibold truncate">{l.piloto}</span>
                <span className="block text-[11px] text-tx2 truncate">
                  {l.corridas} corrida{l.corridas > 1 ? 's' : ''}{l.vezes_mais_rapido ? ` · mais rápido em ${l.vezes_mais_rapido}` : ''}
                </span>
              </span>
              <span className="text-right shrink-0 font-extrabold tabular-nums text-brand-dark">{atras(l.ritmo)}</span>
              {l.piloto_id && <ChevronRight size={16} className="text-tx3 shrink-0" />}
            </div>
          );
          return l.piloto_id
            ? <Link key={l.chave} to={`/piloto/${l.piloto_id}`} className="block hover:bg-[#f3f6fa]">{corpo}</Link>
            : <div key={l.chave}>{corpo}</div>;
        })}
      </div>
      <button onClick={() => setRegra(!regra)} className="mt-3 flex items-center gap-1.5 text-xs text-tx2"><Info size={13} /> Como funciona o ritmo</button>
      {regra && <div className="mt-2 text-[12px] text-tx2 card p-3">{r.regra} Corrida com menos de 3 tempos não entra. Quem tem poucas corridas pode subir ou cair muito com a próxima.</div>}
    </>
  );
}

// Classificação de cada edição (Brunner 19/10: "rankin por evento tbm"). Chips de evento no topo; abre na edição mais
// recente que já correu. Na Copa 3 o pódio é o da final; nas antigas, a soma das posições.
function Eventos() {
  const [evs, setEvs] = useState(null);
  const [sel, setSel] = useState(null);
  useEffect(() => {
    api.get('/historico/eventos').then((x) => {
      setEvs(x.data);
      setSel((x.data.find((e) => e.linhas.length) || x.data[0])?.slug ?? null);
    }).catch(() => setEvs([]));
  }, []);
  if (!evs) return <div className="text-center text-tx2 py-10">Carregando…</div>;
  if (!evs.length) return <div className="card p-8 text-center text-tx">Nenhum evento lançado ainda.</div>;
  const ev = evs.find((e) => e.slug === sel) || evs[0];
  const copa3 = ev.formato === 'copa3';
  const maxCorridas = Math.max(0, ...ev.linhas.map((l) => l.corridas || 0));
  const valor = (l) => (copa3 ? (l.na_final ? 'final' : `${l.baterias} pts`) : `${l.pontos} pts`);
  const detalhe = (l) => (copa3
    ? (l.na_final ? `finalista · ${l.baterias ?? 0} pts nas baterias` : 'não foi pra final')
    // "N corridas" só pra quem correu menos que os outros: no celular a linha não comporta tudo
    : [l.corridas < maxCorridas ? `${l.corridas} corrida${l.corridas > 1 ? 's' : ''}` : null, `média ${l.media.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}º`, l.mv_ms ? `volta ${volta(l.mv_ms)}` : null].filter(Boolean).join(' · '));
  const top = ev.linhas.slice(0, 3);
  return (
    <>
      <div className="flex gap-1.5 overflow-x-auto pb-2 mb-1 -mx-1 px-1">
        {evs.map((e) => (
          <button key={e.slug} onClick={(x) => { setSel(e.slug); x.currentTarget.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' }); }}
            className={`shrink-0 px-3 py-1.5 rounded-full text-[12px] font-semibold border ${e.slug === ev.slug ? 'bg-[color:var(--color-brand-dark)] text-white border-transparent' : 'bg-white text-tx border-[#d5dfeb]'}`}>
            {e.titulo?.replace(/\s*·.*$/, '') || e.slug} <span className="opacity-70">{dataBR(e.data).slice(-4)}</span>
          </button>
        ))}
      </div>
      <div className="card overflow-hidden mb-3">
        <div className="px-4 pt-3 pb-3 bg-[color:var(--color-brand-dark)] text-white relative">
          <div className="absolute top-0 inset-x-0 h-1.5" style={ZEBRA} />
          <div className="text-[11px] uppercase tracking-wide text-white/70 mt-1">{dataBR(ev.data)}{ev.completa ? '' : ' · parcial'}</div>
          <div className="font-bold">{ev.titulo}</div>
          {ev.campeao && <div className="mt-1 text-[13px] flex items-center gap-1.5"><Trophy size={14} className="text-[color:var(--color-gold)]" /> Campeão: <b>{ev.campeao}</b></div>}
        </div>
      </div>
      {!ev.linhas.length ? <div className="card p-8 text-center text-tx">Esse evento ainda não correu.</div> : (
        <>
          {top.length === 3 && (
            <div className="card px-3 pt-4 pb-0 overflow-hidden">
              <div className="flex items-end gap-2">
                <Degrau l={top[1]} pos={2} rotulo={valor(top[1])} />
                <Degrau l={top[0]} pos={1} rotulo={valor(top[0])} />
                <Degrau l={top[2]} pos={3} rotulo={valor(top[2])} />
              </div>
            </div>
          )}
          <div className="card mt-3 overflow-hidden divide-y divide-[#e3e9f1]">
            {ev.linhas.map((l) => {
              const corpo = (
                <div className="flex items-center gap-3 px-3 py-2.5">
                  <span className="w-8 h-8 rounded-md bg-[#eef3f9] border border-[#d5dfeb] flex items-center justify-center display text-[15px] text-brand-dark tabular-nums shrink-0">{l.pos}</span>
                  <Avatar id={l.piloto_id} v={l.foto_v} nome={l.piloto} tam={36} />
                  <span className="flex-1 min-w-0">
                    <span className="block font-semibold truncate">{l.piloto}</span>
                    <span className="block text-[11px] text-tx2 truncate">{detalhe(l)}</span>
                  </span>
                  <span className="text-right shrink-0 font-extrabold tabular-nums text-brand-dark">{valor(l)}</span>
                  {l.piloto_id && <ChevronRight size={16} className="text-tx3 shrink-0" />}
                </div>
              );
              return l.piloto_id
                ? <Link key={l.chave} to={`/piloto/${l.piloto_id}`} className="block hover:bg-[#f3f6fa]">{corpo}</Link>
                : <div key={l.chave}>{corpo}</div>;
            })}
          </div>
          <div className="mt-3 text-[12px] text-tx2 flex gap-1.5"><Info size={13} className="shrink-0 mt-0.5" /> {ev.criterio}</div>
        </>
      )}
    </>
  );
}

function Recordes() {
  const [r, setR] = useState(null);
  useEffect(() => { api.get('/historico/recordes').then((x) => setR(x.data)).catch(() => setR([])); }, []);
  if (!r) return <div className="text-center text-tx2 py-10">Carregando…</div>;
  if (!r.length) return <div className="card p-8 text-center text-tx">Nenhum tempo registrado ainda.</div>;
  return (
    <>
      <div className="text-xs text-tx2 mb-2">A volta mais rápida já feita em cada traçado e, abaixo, a melhor de cada piloto. Volta de traçado diferente não se compara.</div>
      {r.map((t) => (
        <div key={t.tracado} className="card mb-3 overflow-hidden">
          <div className="px-4 pt-3 pb-3 bg-[color:var(--color-brand-dark)] text-white relative">
            <div className="absolute top-0 inset-x-0 h-1.5" style={ZEBRA} />
            <div className="text-[11px] uppercase tracking-wide text-white/70 mt-1">Traçado {t.tracado}</div>
            <div className="flex items-end justify-between gap-2">
              <div className="min-w-0">
                <div className="font-bold truncate">{t.recorde.piloto}</div>
                <div className="text-[11px] text-white/70">{dataBR(t.recorde.data)} · {t.recorde.sessao}</div>
              </div>
              <div className="display text-3xl tabular-nums">{volta(t.recorde.mv_ms)}</div>
            </div>
          </div>
          {(t.todos || t.top).slice(1).map((v, i) => (
            <div key={v.chave} className="flex items-center justify-between px-4 py-2 text-sm border-t border-[#e3e9f1]">
              <span className="truncate"><b className="text-tx2 mr-2">{i + 2}º</b>{v.piloto} <span className="text-[11px] text-tx3">· {dataBR(v.data)}</span></span>
              <span className="tabular-nums font-semibold">{volta(v.mv_ms)} <span className="text-[11px] text-tx3">+{((v.mv_ms - t.recorde.mv_ms) / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 3 })}</span></span>
            </div>
          ))}
        </div>
      ))}
    </>
  );
}

export default function Ranking() {
  const { state } = useLocation();
  const [aba, setAba] = useState(state?.aba || 'pontos');
  if (aba !== 'pontos') {
    return (
      <Casca sub="Ranking do campeonato">
        <Abas aba={aba} setAba={setAba} />
        {aba === 'eventos' ? <Eventos /> : aba === 'ritmo' ? <Ritmo /> : <Recordes />}
      </Casca>
    );
  }
  return <Pontos aba={aba} setAba={setAba} />;
}

function Pontos({ aba, setAba }) {
  const [r, setR] = useState(null);
  const [regra, setRegra] = useState(false);
  useEffect(() => { api.get('/historico/ranking').then((x) => setR(x.data)).catch(() => setR({ eventos: [], tabela: [] })); }, []);
  if (!r) return <Casca sub="Ranking"><div className="text-center text-tx2 py-10">Carregando…</div></Casca>;
  if (!r.tabela.length) {
    return (
      <Casca sub="Ranking">
        <div className="card p-8 text-center text-tx">
          <Trophy className="mx-auto text-[color:var(--color-gold)] mb-3" size={40} />
          O ranking abre depois da primeira corrida lançada.
        </div>
      </Casca>
    );
  }
  const top = r.tabela.slice(0, 3);
  const resto = r.tabela.slice(3);
  const lider = r.tabela[0].total;
  const curto = (t) => t.replace(/\s*·.*$/, '');
  return (
    <Casca sub="Ranking do campeonato">
      <Abas aba={aba} setAba={setAba} />
      <div className="flex items-center justify-between mb-3 text-xs text-tx2">
        <span>{r.eventos.length} evento{r.eventos.length > 1 ? 's' : ''} · {r.tabela.length} pilotos</span>
        {r.parcial && <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold">parcial</span>}
      </div>

      {top.length === 3 && (
        <div className="card px-3 pt-4 pb-0 overflow-hidden">
          <div className="flex items-end gap-2">
            <Degrau l={top[1]} pos={2} />
            <Degrau l={top[0]} pos={1} />
            <Degrau l={top[2]} pos={3} />
          </div>
        </div>
      )}

      <div className="card mt-3 overflow-hidden divide-y divide-[#e3e9f1]">
        {(top.length === 3 ? resto : r.tabela).map((l) => <Linha key={l.chave} l={l} lider={lider} eventos={r.eventos} />)}
      </div>

      <button onClick={() => setRegra(!regra)} className="mt-3 flex items-center gap-1.5 text-xs text-tx2"><Info size={13} /> Como funciona a pontuação</button>
      {regra && (
        <div className="mt-2 text-[12px] text-tx2 space-y-1 card p-3">
          <p>{r.regra}</p>
          {r.eventos.map((e) => <p key={e.slug}><b className="text-tx">{dataBR(e.data)} · {curto(e.titulo)}</b>: {e.n} classificados{e.avulsa ? ', avulsa (vale metade)' : ''} ({e.criterio}).</p>)}
        </div>
      )}
    </Casca>
  );
}
