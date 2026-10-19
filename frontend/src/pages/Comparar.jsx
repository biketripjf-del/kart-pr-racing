import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, X, Swords, Crown } from 'lucide-react';
import { api } from '../api.js';
import { Casca, Avatar, volta, dataBR } from '../components/Marca.jsx';

// Comparar pilotos lado a lado (Brunner 14/10: "comparar os dados de um piloto com outro ou vários").
// Até 4 de uma vez. A seleção mora na URL (/comparar?p=1,7,29), então dá pra mandar o link do duelo no grupo.
const MAX = 4;
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// cada linha: como ler o número e quem ganha (menor ou maior)
const LINHAS = [
  ['Ranking', (d) => d.ranking?.pos, 'menor', (v) => `${v}º`],
  ['Pontos no ranking', (d) => d.ranking?.total, 'menor'],
  ['Corridas', (d) => d.numeros.corridas_disputadas, 'maior'],
  ['Vitórias', (d) => d.numeros.vitorias, 'maior'],
  ['Pódios', (d) => d.numeros.podios, 'maior'],
  ['Posição média', (d) => d.numeros.media_posicao, 'menor', (v) => v.toLocaleString('pt-BR')],
  ['Melhor posição', (d) => d.numeros.melhor_posicao, 'menor', (v) => `${v}º`],
  ['Títulos', (d) => d.numeros.titulos, 'maior'],
];

function melhorDe(valores, sentido) {
  const ok = valores.filter((v) => v != null);
  if (ok.length < 2) return null;
  const alvo = sentido === 'menor' ? Math.min(...ok) : Math.max(...ok);
  return ok.every((v) => v === alvo) ? null : alvo; // empate geral não destaca ninguém
}

// confronto direto: nas corridas que os dois terminaram, quem chegou na frente
function confronto(a, b) {
  const deB = new Map(b.numeros.corridas.filter((c) => !c.ausente).map((c) => [`${c.evento}|${c.sessao}`, c]));
  const juntas = a.numeros.corridas.filter((c) => !c.ausente && deB.has(`${c.evento}|${c.sessao}`))
    .map((c) => ({ corrida: c, a: c.pos, b: deB.get(`${c.evento}|${c.sessao}`).pos }));
  return { juntas, va: juntas.filter((j) => j.a < j.b).length, vb: juntas.filter((j) => j.b < j.a).length };
}

function Celula({ valor, destaque, fmt }) {
  return (
    <td className={`px-1 py-2 text-center tabular-nums ${destaque ? 'text-[color:var(--color-gold)] font-extrabold' : ''}`}>
      {valor == null ? <span className="text-tx3">—</span> : (fmt ? fmt(valor) : valor)}
    </td>
  );
}

export default function Comparar() {
  const [params, setParams] = useSearchParams();
  const ids = useMemo(() => (params.get('p') || '').split(',').map(Number).filter((n) => n > 0).slice(0, MAX), [params]);
  const [todos, setTodos] = useState(null);
  const [dados, setDados] = useState({});
  const [busca, setBusca] = useState('');

  useEffect(() => { api.get('/historico/pilotos').then((r) => setTodos(r.data)).catch(() => setTodos([])); }, []);
  useEffect(() => {
    for (const id of ids) {
      if (dados[id]) continue;
      api.get(`/historico/piloto/${id}`).then((r) => setDados((x) => ({ ...x, [id]: r.data }))).catch(() => {});
    }
  }, [ids.join(',')]);

  const trocar = (id) => {
    const novo = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id].slice(0, MAX);
    setParams(novo.length ? { p: novo.join(',') } : {}, { replace: true });
    setBusca('');
  };

  const sel = ids.map((id) => dados[id]).filter(Boolean);
  const prontos = sel.length === ids.length && sel.length >= 2;
  const opcoes = (todos || []).filter((p) => !ids.includes(p.piloto_id) && norm(p.nome).includes(norm(busca)));
  const tracados = prontos ? [...new Set(sel.flatMap((d) => Object.keys(d.numeros.melhor_volta_por_tracado)))] : [];
  const pares = prontos ? sel.flatMap((a, i) => sel.slice(i + 1).map((b) => ({ a, b, ...confronto(a, b) }))) : [];

  return (
    <Casca sub="Comparar pilotos" largo>
      <div className="card p-4">
        <div className="text-sm text-tx">Escolha de 2 a {MAX} pilotos. O melhor número de cada linha fica em dourado.</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {ids.map((id) => {
            const p = (todos || []).find((x) => x.piloto_id === id) || dados[id]?.piloto;
            return (
              <button key={id} onClick={() => trocar(id)} className="flex items-center gap-1.5 rounded-full bg-[color:var(--color-brand)] text-white pl-1 pr-2.5 py-1 text-sm font-semibold">
                <Avatar id={id} v={p?.foto_v} nome={p?.nome} tam={24} /> {p?.nome || '…'} <X size={14} />
              </button>
            );
          })}
        </div>
        {ids.length < MAX && (
          <>
            <div className="mt-3 relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-tx3" />
              <input className="input pl-9" placeholder={ids.length ? 'Adicionar outro piloto' : 'Procure um piloto'} value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
            {/* lista inteira, sem caixa com rolagem própria: no celular a caixa de 5 linhas parecia ser a lista toda (Brunner 19/10) */}
            {todos && <div className="mt-2 text-[11px] text-tx3">{opcoes.length} piloto{opcoes.length === 1 ? '' : 's'}{busca ? ' com esse nome' : ''}</div>}
            <div className="mt-1 rounded-lg border border-[#e3e9f1]">
              {!todos && <div className="p-4 text-center text-sm text-tx2">Carregando…</div>}
              {opcoes.map((p) => (
                <button key={p.piloto_id} onClick={() => trocar(p.piloto_id)} className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm border-b border-[#e3e9f1] last:border-0 hover:bg-[#eef3f9]">
                  <Avatar id={p.piloto_id} v={p.foto_v} nome={p.nome} tam={28} />
                  <span className="flex-1">{p.nome}</span>
                  {p.ranking && <span className="text-[11px] text-tx3">{p.ranking}º</span>}
                </button>
              ))}
              {todos && !opcoes.length && <div className="p-4 text-center text-sm text-tx2">Ninguém com esse nome.</div>}
            </div>
          </>
        )}
      </div>

      {ids.length >= 2 && !prontos && <div className="text-center text-tx2 py-8">Carregando…</div>}

      {prontos && (
        <>
          <div className="card mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 bg-white w-[88px]" />
                  {sel.map((d) => (
                    <th key={d.piloto.id} className="px-1 pt-3 pb-2 min-w-[64px] align-top">
                      <Link to={`/piloto/${d.piloto.id}`} className="flex flex-col items-center gap-1">
                        <Avatar id={d.piloto.id} v={d.piloto.foto_v} nome={d.piloto.nome} tam={sel.length > 3 ? 40 : 52} />
                        <span className="text-[11px] font-semibold leading-tight">{d.piloto.nome}</span>
                      </Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {LINHAS.map(([rot, ler, sentido, fmt]) => {
                  const vs = sel.map(ler);
                  const best = melhorDe(vs, sentido);
                  return (
                    <tr key={rot} className="border-t border-[#e3e9f1]">
                      <td className="sticky left-0 bg-white pl-3 pr-1 py-2 text-xs text-tx">{rot}</td>
                      {vs.map((v, i) => <Celula key={i} valor={v} destaque={best != null && v === best} fmt={fmt} />)}
                    </tr>
                  );
                })}
                {tracados.map((t) => {
                  const vs = sel.map((d) => d.numeros.melhor_volta_por_tracado[t]?.mv_ms ?? null);
                  const best = melhorDe(vs, 'menor');
                  return (
                    <tr key={t} className="border-t border-[#e3e9f1]">
                      <td className="sticky left-0 bg-white pl-3 pr-1 py-2 text-xs text-tx">Melhor volta<div className="text-[11px] text-tx3">{t}</div></td>
                      {vs.map((v, i) => <Celula key={i} valor={v} destaque={best != null && v === best} fmt={volta} />)}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {sel.some((d) => d.ranking?.parcial) && <div className="mt-2 text-[11px] text-tx3 text-center">Ranking parcial: ainda falta lançar corrida.</div>}

          <div className="mt-6 flex items-center gap-2 font-semibold"><Swords size={17} className="text-[color:var(--color-gold)]" /> Confronto direto</div>
          <div className="text-xs text-tx2 mt-1">Nas corridas em que os dois terminaram, quem chegou na frente.</div>
          {pares.map(({ a, b, juntas, va, vb }) => (
            <div key={`${a.piloto.id}-${b.piloto.id}`} className="card mt-3 p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <Avatar id={a.piloto.id} v={a.piloto.foto_v} nome={a.piloto.nome} tam={32} />
                  <span className="truncate text-sm font-semibold">{a.piloto.nome}</span>
                  {va > vb && <Crown size={14} className="text-[color:var(--color-gold)] shrink-0" />}
                </div>
                <div className="text-2xl font-extrabold tabular-nums shrink-0 display">{va} <span className="text-tx3">x</span> {vb}</div>
                <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
                  {vb > va && <Crown size={14} className="text-[color:var(--color-gold)] shrink-0" />}
                  <span className="truncate text-sm font-semibold text-right">{b.piloto.nome}</span>
                  <Avatar id={b.piloto.id} v={b.piloto.foto_v} nome={b.piloto.nome} tam={32} />
                </div>
              </div>
              {juntas.length === 0
                ? <div className="mt-2 text-xs text-tx3 text-center">Ainda não correram juntos.</div>
                : (
                  <div className="mt-3 space-y-1">
                    {juntas.map(({ corrida: c, a: pa, b: pb }) => (
                      <div key={`${c.evento}|${c.sessao}`} className="flex items-center text-xs">
                        <span className={`w-10 text-left tabular-nums ${pa < pb ? 'text-[color:var(--color-gold)] font-bold' : 'text-tx2'}`}>{pa}º</span>
                        <span className="flex-1 text-center text-tx2 truncate">{c.sessao_nome} · {dataBR(c.data)}</span>
                        <span className={`w-10 text-right tabular-nums ${pb < pa ? 'text-[color:var(--color-gold)] font-bold' : 'text-tx2'}`}>{pb}º</span>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          ))}
          <div className="mt-4 text-[11px] text-tx3 text-center">Peso, altura e idade ficam fora: são dados da ficha que só a organização vê.</div>
        </>
      )}
      {ids.length < 2 && todos && <div className="mt-4 text-center text-sm text-tx3">Escolha pelo menos 2 pilotos.</div>}
    </Casca>
  );
}
