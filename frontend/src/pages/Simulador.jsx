import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Calculator, Trophy, Plus, X, Info, ArrowUp, ArrowDown } from 'lucide-react';
import { api, getEu } from '../api.js';
import { Casca, Avatar, dataBR, diaDaSemana } from '../components/Marca.jsx';

// Simulador da última etapa (Brunner 19/10/2026 18:30 BRT, "1+2 go"): "e se eu fizer 1º, 3º e 2º?" + a matemática do
// título. Nada é gravado: o servidor monta folhas hipotéticas e roda o mesmo motor do ranking. Quem não foi mexido chega
// na ordem do ritmo (estimativa). O piloto escolhido mora na URL (?p=<id>), então dá pra mandar o link no grupo.
const pts = (n) => Number(n).toLocaleString('pt-BR');
const ord = (n) => (n == null ? '—' : `${n}º`);
const ZEBRA = { backgroundImage: 'repeating-linear-gradient(90deg, #d0312d 0 14px, #ffffff 14px 28px)' };
const CAMPOS = [['b1', '1ª bateria'], ['b2', '2ª bateria'], ['final', 'Final']];
const BATERIA_DO_BLOCO = { W: ['B1 · W+X', 'B3 · W+Y'], X: ['B1 · W+X', 'B4 · X+Z'], Y: ['B2 · Y+Z', 'B3 · W+Y'], Z: ['B2 · Y+Z', 'B4 · X+Z'] };

function Seletor({ rotulo, sub, valor, projetado, onChange, final }) {
  return (
    <label className="flex-1 min-w-0">
      <span className="block text-[11px] font-semibold text-tx2 truncate">{rotulo}</span>
      {sub && <span className="block text-[10px] text-tx3 truncate">{sub}</span>}
      <select value={valor ?? ''} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        className="mt-1 w-full rounded-lg border border-[#d5dfeb] bg-white px-2 py-2 text-[15px] font-semibold text-brand-dark">
        <option value="">{final && projetado == null ? 'ritmo: fora' : `ritmo: ${ord(projetado)}`}</option>
        {Array.from({ length: 14 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}º</option>)}
      </select>
    </label>
  );
}

function Ajuste({ nome, base, aj, setAj, remover }) {
  const d = base.find((x) => x.piloto === nome);
  const blocos = BATERIA_DO_BLOCO[d?.grupo] || [];
  return (
    <div className="flex gap-2 items-end">
      {CAMPOS.map(([k, rot], i) => (
        <Seletor key={k} rotulo={rot} sub={i < 2 ? blocos[i] : 'os 14 melhores'} final={k === 'final'} valor={aj?.[k]} projetado={d?.[k]}
          onChange={(v) => setAj(nome, { ...aj, [k]: v })} />
      ))}
      {remover && <button onClick={remover} aria-label="tirar" className="shrink-0 w-9 h-10 grid place-items-center text-tx3"><X size={18} /></button>}
    </div>
  );
}

function Titulo({ m }) {
  const [todos, setTodos] = useState(false);
  const lider = m.linhas[0];
  const correm = m.linhas.filter((l) => l.corre);
  const lista = todos ? m.linhas : m.linhas.slice(0, 10);
  return (
    <div className="card mt-4 overflow-hidden">
      <div className="px-4 pt-3 pb-2">
        <div className="font-semibold flex items-center gap-1.5"><Trophy size={16} className="text-[color:var(--color-gold)]" /> Matemática do título</div>
        <p className="mt-1 text-[13px] text-tx">
          {lider.corre
            ? <><b>{lider.piloto}</b> chega na frente com <b>{pts(lider.leva)}</b>. Os <b>{correm.length}</b> que correm sexta ainda podem ser campeões.</>
            : <><b>{lider.piloto}</b> tem {pts(lider.hoje)} hoje, mas não corre sexta: com o descarte, fica com <b>{pts(lider.leva)}</b>. Quem fizer mais pontos que a diferença passa. Os <b>{correm.length}</b> que correm ainda podem ser campeões.</>}
        </p>
        <p className="mt-1 text-[11px] text-tx2">{m.regra}</p>
      </div>
      <div className="divide-y divide-[#e3e9f1] border-t border-[#e3e9f1]">
        {lista.map((l) => (
          <div key={l.chave} className="flex items-center gap-2.5 px-4 py-2">
            <span className="w-6 text-right text-[13px] font-bold text-tx2 tabular-nums">{l.pos}</span>
            <Avatar id={l.piloto_id} v={l.foto_v} nome={l.piloto} tam={28} />
            <span className="flex-1 min-w-0">
              <span className="block text-[14px] font-semibold truncate">{l.piloto}</span>
              {l.sai?.pontos > 0 && <span className="block text-[11px] text-tx3">hoje {pts(l.hoje)} · o descarte tira {dataBR(l.sai.data).slice(0, 5)} ({pts(l.sai.pontos)})</span>}
              <span className="block text-[11px] text-tx2">{!l.corre ? 'não corre sexta' : !l.atras ? 'na frente' : lider.corre
                  ? `precisa de ${pts(l.atras + 1)} pts a mais que ${lider.piloto.split(' ')[0]} na sexta`
                  : `${pts(l.atras + 1)} pts na sexta passam ${lider.piloto.split(' ')[0]}`}</span>
            </span>
            <span className="text-right shrink-0">
              <span className="block font-extrabold tabular-nums text-brand-dark">{pts(l.leva)}</span>
              {l.atras > 0 && <span className="block text-[11px] text-tx3 tabular-nums">−{pts(l.atras)}</span>}
            </span>
          </div>
        ))}
      </div>
      {m.linhas.length > 10 && (
        <button onClick={() => setTodos(!todos)} className="w-full py-2.5 text-[12px] font-semibold text-brand border-t border-[#e3e9f1]">
          {todos ? 'Ver só os 10 primeiros' : `Ver os ${m.linhas.length}`}
        </button>
      )}
    </div>
  );
}

export default function Simulador() {
  const [busca, setBusca] = useSearchParams();
  const [m, setM] = useState(undefined);
  const [base, setBase] = useState(null);
  const [atual, setAtual] = useState(null);
  const [sim, setSim] = useState(null);
  const [ajustes, setAjustes] = useState({});
  const [outros, setOutros] = useState([]);
  const [eu, setEu] = useState(null);
  const vez = useRef(0);

  useEffect(() => {
    api.get('/historico/titulo').then((x) => setM(x.data)).catch(() => setM(null));
    api.post('/historico/simular', { ajustes: {} }).then((x) => { setBase(x.data); setSim(x.data); }).catch(() => {});
    api.get('/historico/ranking').then((x) => setAtual(new Map(x.data.tabela.map((l) => [l.chave, l.pos])))).catch(() => setAtual(new Map()));
  }, []);

  // quem é "eu": ?p=<id> na URL; senão o link pessoal deste celular; senão o piloto escolhe
  const pilotos = useMemo(() => (base ? [...base.dia].sort((a, b) => a.piloto.localeCompare(b.piloto)) : []), [base]);
  useEffect(() => {
    if (!base || eu) return;
    const p = Number(busca.get('p'));
    const daUrl = p && base.dia.find((d) => d.piloto_id === p);
    if (daUrl) { setEu(daUrl.piloto); return; }
    if (getEu()) api.get('/ficha/eu').then((x) => { const d = base.dia.find((y) => y.piloto_id === x.data.id); if (d) setEu(d.piloto); }).catch(() => {});
  }, [base]); // eslint-disable-line react-hooks/exhaustive-deps

  const escolher = (nome) => {
    setEu(nome); setAjustes({}); setOutros([]);
    const d = base.dia.find((x) => x.piloto === nome);
    setBusca(d?.piloto_id ? { p: String(d.piloto_id) } : {}, { replace: true });
  };
  const setAj = (nome, a) => setAjustes((x) => ({ ...x, [nome]: a }));

  // recalcula a cada mudança (o último pedido vence)
  useEffect(() => {
    if (!base) return;
    const limpos = Object.fromEntries(Object.entries(ajustes).filter(([, a]) => a && Object.values(a).some((v) => v != null)));
    const n = ++vez.current;
    const t = setTimeout(() => {
      api.post('/historico/simular', { ajustes: limpos }).then((x) => { if (n === vez.current) setSim(x.data); }).catch(() => {});
    }, 200);
    return () => clearTimeout(t);
  }, [ajustes, base]);

  if (m === undefined || (m && !base)) return <Casca sub="Simulador"><div className="text-center text-tx2 py-10">Carregando…</div></Casca>;
  if (m === null) return <Casca sub="Simulador"><div className="card p-8 text-center text-tx">Não há etapa pela frente pra simular.</div></Casca>;

  const etapa = m.etapa;
  const r = sim.ranking;
  const meu = eu && sim.dia.find((d) => d.piloto === eu);
  const minhaLinha = eu && r.tabela.find((l) => l.piloto === eu || l.piloto_id === meu?.piloto_id);
  const variacao = (l) => { const antes = atual?.get(l.chave); return antes ? antes - l.pos : null; };
  const lista = r.tabela.slice(0, 10);
  const mostraMeu = minhaLinha && minhaLinha.pos > 10;

  return (
    <Casca sub="Simulador">
      <div className="card overflow-hidden">
        <div className="px-4 pt-3 pb-4 bg-[color:var(--color-brand-dark)] text-white relative">
          <div className="absolute top-0 inset-x-0 h-1.5" style={ZEBRA} />
          <div className="text-[11px] uppercase tracking-wide text-white/70 mt-1">{diaDaSemana(etapa.data)}, {dataBR(etapa.data)} · última etapa do ano</div>
          <div className="display text-2xl leading-tight flex items-center gap-2"><Calculator size={22} /> E se…?</div>
          <p className="text-[12px] text-white/80 mt-1">Escolha suas posições nas 2 baterias e na final e veja onde você termina a Copa {String(etapa.data).slice(0, 4)}, já com o descarte.</p>
        </div>
        <div className="p-4">
          <label className="block text-[11px] font-semibold text-tx2">Piloto</label>
          <select value={eu || ''} onChange={(e) => escolher(e.target.value)}
            className="mt-1 w-full rounded-lg border border-[#d5dfeb] bg-white px-3 py-2.5 text-[15px] font-semibold">
            <option value="" disabled>Escolha seu nome</option>
            {pilotos.map((p) => <option key={p.piloto} value={p.piloto}>{p.piloto}</option>)}
          </select>
          {eu && <div className="mt-3"><Ajuste nome={eu} base={base.dia} aj={ajustes[eu]} setAj={setAj} /></div>}
          {!sim.blocos_reais && <p className="mt-2 text-[11px] text-amber-700">Blocos provisórios: os de verdade saem no sorteio. Até lá, a simulação usa um sorteio de ensaio.</p>}
        </div>
      </div>

      {meu && minhaLinha && (
        <div className="card mt-3 p-4">
          <div className="flex items-center gap-3">
            <Avatar id={minhaLinha.piloto_id} v={minhaLinha.foto_v} nome={eu} tam={52} />
            <div className="flex-1 min-w-0">
              <div className="text-[11px] uppercase tracking-wide text-tx2">Na Copa {String(etapa.data).slice(0, 4)}</div>
              <div className="display text-3xl text-brand-dark leading-none">{minhaLinha.pos}º <span className="text-lg">· {pts(minhaLinha.total)} pts</span></div>
              {variacao(minhaLinha) != null && variacao(minhaLinha) !== 0 && (
                <div className={`text-[12px] font-semibold ${variacao(minhaLinha) > 0 ? 'text-green-700' : 'text-red-600'}`}>
                  {variacao(minhaLinha) > 0 ? '▲' : '▼'} {Math.abs(variacao(minhaLinha))} em relação a hoje ({atual.get(minhaLinha.chave)}º)
                </div>
              )}
            </div>
          </div>
          <div className="mt-3 text-[13px] text-tx">
            Sexta: {ord(meu.b1)} + {ord(meu.b2)}{meu.final ? ` + ${ord(meu.final)} na final` : ''} = <b>{pts(meu.pontos)} pts</b>
            {!meu.na_final && <span className="text-red-600"> · não foi pra final com essas baterias</span>}
          </div>
          {sim.campeao_do_dia && <div className="mt-1 text-[12px] text-tx2">Pódio do dia: {sim.podio.map((p, i) => `${i + 1}º ${p}`).join(' · ')}</div>}
        </div>
      )}

      {eu && (
        <div className="card mt-3 p-4">
          <div className="text-[13px] font-semibold">Mexer em outros pilotos</div>
          <p className="text-[11px] text-tx2">Quem você não mexer chega na ordem do ritmo (média das corridas). É estimativa.</p>
          {outros.map((n) => (
            <div key={n} className="mt-3">
              <div className="text-[13px] font-semibold">{n}</div>
              <Ajuste nome={n} base={base.dia} aj={ajustes[n]} setAj={setAj}
                remover={() => { setOutros(outros.filter((x) => x !== n)); setAjustes(({ [n]: _, ...resto }) => resto); }} />
            </div>
          ))}
          <div className="mt-3 flex items-center gap-2">
            <Plus size={16} className="text-brand shrink-0" />
            <select value="" onChange={(e) => e.target.value && setOutros([...outros, e.target.value])}
              className="flex-1 rounded-lg border border-[#d5dfeb] bg-white px-2 py-2 text-[14px]">
              <option value="">Adicionar piloto…</option>
              {pilotos.filter((p) => p.piloto !== eu && !outros.includes(p.piloto)).map((p) => <option key={p.piloto} value={p.piloto}>{p.piloto}</option>)}
            </select>
          </div>
        </div>
      )}

      <div className="card mt-3 overflow-hidden">
        <div className="px-4 pt-3 pb-2 font-semibold">Copa {String(etapa.data).slice(0, 4)} simulada</div>
        <div className="divide-y divide-[#e3e9f1] border-t border-[#e3e9f1]">
          {[...lista, ...(mostraMeu ? [minhaLinha] : [])].map((l) => {
            const v = variacao(l);
            const souEu = l === minhaLinha;
            return (
              <div key={l.chave} className={`flex items-center gap-2.5 px-4 py-2 ${souEu ? 'bg-[#e8eff7]' : ''}`}>
                <span className="w-6 text-right text-[13px] font-bold text-tx2 tabular-nums">{l.pos}</span>
                <Avatar id={l.piloto_id} v={l.foto_v} nome={l.piloto} tam={28} />
                <span className="flex-1 min-w-0 text-[14px] font-semibold truncate">{l.piloto}</span>
                {v ? <span className={`text-[11px] font-semibold flex items-center ${v > 0 ? 'text-green-700' : 'text-red-600'}`}>{v > 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}{Math.abs(v)}</span> : null}
                <span className="w-12 text-right font-extrabold tabular-nums text-brand-dark">{pts(l.total)}</span>
              </div>
            );
          })}
        </div>
      </div>

      {m && <Titulo m={m} />}

      <div className="mt-3 text-[12px] text-tx2 flex gap-1.5"><Info size={13} className="shrink-0 mt-0.5" />
        <span>Simulação: nada aqui muda o ranking de verdade. A pontuação é a do <Link to="/regulamento" className="underline">regulamento</Link>: cada corrida vale pontos F1 e sai o pior dia do ano.</span>
      </div>
    </Casca>
  );
}
