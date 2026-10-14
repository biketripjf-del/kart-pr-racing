import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Trophy, Timer, RefreshCw, Flag, AlertTriangle } from 'lucide-react';
import { api } from '../api.js';
import { Casca } from '../components/Marca.jsx';

const INTERVALO_MS = 15000;
const ROTULO = {
  aguardando: { txt: 'aguardando', cls: 'bg-slate-700/60 text-slate-300' },
  ao_vivo: { txt: 'na pista', cls: 'bg-red-600 text-white animate-pulse' },
  provisorio: { txt: 'provisório', cls: 'bg-amber-500/90 text-black' },
  homologado: { txt: 'homologado', cls: 'bg-emerald-600 text-white' },
};

const volta = (ms) => {
  if (ms == null) return '—';
  const min = Math.floor(ms / 60000);
  const seg = ((ms % 60000) / 1000).toFixed(3).padStart(6, '0');
  return min > 0 ? `${min}:${seg}` : seg;
};
const horaBRT = (iso) => (iso ? new Date(iso).toLocaleTimeString('pt-BR', {
  hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo',
}) : '');

function Selo({ status }) {
  const r = ROTULO[status] || ROTULO.aguardando;
  return <span className={`text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${r.cls}`}>{r.txt}</span>;
}

function Tabela({ cab, linhas, destaque }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[11px] uppercase tracking-wide text-slate-400">
            {cab.map((c, i) => <th key={i} className={`px-2 py-2 font-medium ${i === 1 ? 'text-left' : 'text-center'}`}>{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l, i) => (
            <tr key={i} className={`border-t border-[#1d3252] ${destaque?.(i) || ''}`}>
              {l.map((c, j) => <td key={j} className={`px-2 py-2 ${j === 1 ? 'text-left font-medium' : 'text-center tabular-nums'}`}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CartaoSessao({ s, children, vazio }) {
  return (
    <div className="card mt-4">
      <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-2">
        <div className="font-semibold">{s.nome}</div>
        <div className="flex items-center gap-2">
          {s.atualizado_em && <span className="text-[11px] text-slate-500">{horaBRT(s.atualizado_em)}</span>}
          <Selo status={s.status} />
        </div>
      </div>
      {children || <div className="px-4 pb-4 text-sm text-slate-400">{vazio || 'Ainda não correu.'}</div>}
      {s.observacoes && <div className="px-4 pb-3 text-xs text-amber-300/90">{s.observacoes}</div>}
    </div>
  );
}

function Resultado({ s, comPontos }) {
  if (!s.resultado.length) return null;
  const cab = ['Pos', 'Piloto', 'Kart', 'Melhor volta', ...(comPontos ? ['Pts'] : [])];
  const linhas = s.resultado.map((l) => [
    l.ausente ? '—' : l.pos_oficial,
    <>
      {l.piloto}
      {l.ausente && <span className="ml-2 text-[11px] text-red-300">não correu</span>}
      {l.punicao && <span className="ml-2 text-[11px] text-amber-300">punido ({l.punicao === 'fim' ? 'fim de fila' : `${l.punicao === true ? 3 : l.punicao} pos.`}; cruzou em {l.pos_folha}º)</span>}
    </>,
    l.kart ?? '—',
    volta(l.mv_ms),
    ...(comPontos ? [<b className="text-[color:var(--color-brand)]">{l.pontos}</b>] : []),
  ]);
  return <Tabela cab={cab} linhas={linhas} />;
}

function Grid({ grid, titulo }) {
  if (!grid?.length) return null;
  return (
    <div className="px-4 pb-3">
      <div className="label mt-1">{titulo}</div>
      <ol className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        {grid.map((p, i) => (
          <li key={p} className="flex gap-2"><span className="w-6 text-right text-slate-500 tabular-nums">{i + 1}º</span>{p}</li>
        ))}
      </ol>
    </div>
  );
}

function Grupo({ g, q }) {
  const grupo = q.grupos[g];
  const cls = q.sessoes[`CLASS_${g}`];
  const b1 = q.sessoes[`B1_${g}`];
  const b2 = q.sessoes[`B2_${g}`];
  if (!grupo.pilotos.length) return <div className="card p-6 text-center text-slate-300 mt-4">Grupos saem do sorteio.</div>;
  const placar = grupo.tabela.map((l) => [
    l.pos,
    <>{l.piloto}{l.cabeca && <span className="ml-1 text-[10px] text-[color:var(--color-gold)]">cabeça</span>}
      {l.empate_sorteio && <span className="ml-1 text-[10px] text-amber-300">empate</span>}</>,
    l.b1 ? (l.b1.ausente ? '·1' : l.b1.pontos) : '—',
    l.b2 ? (l.b2.ausente ? '·1' : l.b2.pontos) : '—',
    <b>{l.total}</b>,
    volta(l.mv_baterias_ms),
  ]);
  return (
    <>
      <div className="card mt-4">
        <div className="flex items-center justify-between px-4 pt-3 pb-1">
          <div className="font-semibold">Placar do Grupo {g}</div>
          <span className="text-[11px] text-slate-400">{grupo.definido ? 'definido' : grupo.parcial ? 'parcial' : 'antes da largada'}</span>
        </div>
        <Tabela
          cab={['#', 'Piloto', 'B1', 'B2', 'Total', 'Melhor volta']}
          linhas={placar}
          destaque={(i) => (i === 6 && grupo.parcial !== undefined && (grupo.parcial || grupo.definido)
            ? 'border-b-2 border-b-[color:var(--color-gold)]' : '') + (i < 7 && (grupo.parcial || grupo.definido) ? ' bg-[#13294a]' : '')}
        />
        <div className="px-4 py-2 text-[11px] text-slate-400">Linha dourada = corte. Os 7 de cima vão pra GRANDE FINAL. Desempate: melhor volta nas baterias.</div>
      </div>
      <CartaoSessao s={cls}><Resultado s={cls} /></CartaoSessao>
      <CartaoSessao s={b1} vazio={b1.grid ? null : 'Grid sai da tomada de tempo.'}>
        {b1.resultado.length ? <Resultado s={b1} comPontos /> : <Grid grid={b1.grid} titulo="Grid de largada" />}
      </CartaoSessao>
      <CartaoSessao s={b2} vazio="Grid = resultado da Bateria 1 invertido.">
        {b2.resultado.length ? <Resultado s={b2} comPontos /> : <Grid grid={b2.grid} titulo="Grid de largada (invertido)" />}
      </CartaoSessao>
    </>
  );
}

function Final({ q }) {
  const fin = q.sessoes.FINAL;
  const { final } = q;
  return (
    <>
      {final.podio.length > 0 && (
        <div className="card mt-4 p-4">
          <div className="flex items-center gap-2 font-semibold"><Trophy className="text-[color:var(--color-gold)]" size={18} /> Pódio {final.campeao ? '' : '(provisório)'}</div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            {final.podio.map((p) => (
              <div key={p.piloto} className={`rounded-xl p-3 ${p.pos === 1 ? 'bg-[color:var(--color-gold)] text-black' : 'bg-[#13294a]'}`}>
                <div className="text-2xl font-extrabold" style={{ fontFamily: 'var(--font-display)' }}>{p.pos}º</div>
                <div className="text-sm font-semibold leading-tight">{p.piloto}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      <CartaoSessao s={fin} vazio={null}>
        {fin.resultado.length ? <Resultado s={fin} /> : (
          final.grid.length ? (
            <Tabela
              cab={['Larga', 'Piloto', 'Grupo', 'Pts']}
              linhas={final.grid.map((l) => [`${l.largada}º`, l.piloto, l.grupo, l.total])}
            />
          ) : <div className="px-4 pb-4 text-sm text-slate-400">Top-7 de cada grupo. Grid pela pontuação das baterias.</div>
        )}
        {!fin.resultado.length && final.grid.length > 0 && !final.definido && (
          <div className="px-4 py-2 text-[11px] text-amber-300">Grid provisório — muda até as baterias 2 serem homologadas.</div>
        )}
      </CartaoSessao>
    </>
  );
}

function Dia({ dados }) {
  const { quadro: q, evento, pilotos } = dados;
  const h = evento.horarios || {};
  return (
    <>
      {(h.chegada || h.briefing || h.tomada) && (
        <div className="card mt-4 p-4 grid grid-cols-3 text-center text-sm">
          <div><div className="label">Chegada</div>{h.chegada || '—'}</div>
          <div><div className="label">Briefing</div>{h.briefing || '—'}</div>
          <div><div className="label">1ª tomada</div>{h.tomada || '—'}</div>
        </div>
      )}
      <div className="card mt-4 overflow-hidden">
        {Object.values(q.sessoes).map((s) => (
          <div key={s.codigo} className={`flex items-center justify-between px-4 py-2.5 border-b border-[#1d3252] last:border-0 ${q.em_curso === s.codigo ? 'bg-[#13294a]' : ''}`}>
            <div className="flex items-center gap-2 text-sm">
              {q.em_curso === s.codigo && <Flag size={14} className="text-[color:var(--color-gold)]" />}
              {s.nome}
            </div>
            <Selo status={s.status} />
          </div>
        ))}
      </div>
      {q.melhor_volta_do_dia && (
        <div className="card mt-4 p-4 flex items-center gap-3">
          <Timer className="text-[color:var(--color-gold)]" />
          <div>
            <div className="label mb-0">Melhor volta do dia</div>
            <div className="font-semibold">{q.melhor_volta_do_dia.piloto} · {q.melhor_volta_do_dia.volta}</div>
          </div>
        </div>
      )}
      <div className="card mt-4 p-4">
        <div className="label">Pilotos ({pilotos.length})</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          {pilotos.map((p) => (
            <div key={p.nome} className="flex items-center gap-2">
              {p.grupo && <span className="text-[10px] font-bold w-4 text-slate-400">{p.grupo}</span>}
              <span>{p.nome}</span>
              {p.cabeca && <span className="text-[10px] text-[color:var(--color-gold)]">cabeça {p.cabeca}</span>}
            </div>
          ))}
        </div>
      </div>
      {evento.regulamento && (
        <details className="card mt-4 p-4 text-sm">
          <summary className="cursor-pointer font-semibold">Regulamento</summary>
          <div className="mt-3 whitespace-pre-line text-slate-300">{evento.regulamento}</div>
        </details>
      )}
    </>
  );
}

export default function AoVivo() {
  const { slug = 'copa-3' } = useParams();
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(false);
  const [aba, setAba] = useState(null);

  const carregar = useCallback(() => {
    api.get(`/ao-vivo/${slug}`).then((r) => { setDados(r.data); setErro(false); }).catch(() => setErro(true));
  }, [slug]);

  useEffect(() => {
    carregar();
    const t = setInterval(() => { if (!document.hidden) carregar(); }, INTERVALO_MS);
    return () => clearInterval(t);
  }, [carregar]);

  if (!dados) {
    return <Casca sub="Ao vivo"><div className="text-center text-slate-400 py-10">{erro ? 'Quadro ainda não aberto.' : 'Carregando…'}</div></Casca>;
  }
  const q = dados.quadro;
  const abaPadrao = q.em_curso === 'FINAL' ? 'F' : (q.sessoes[q.em_curso]?.grupo || 'D');
  const atual = aba || (q.sessoes.B1_A.status === 'aguardando' && q.sessoes.CLASS_A.status === 'aguardando' ? 'D' : abaPadrao);
  const abas = [['D', 'Dia'], ['A', 'Grupo A'], ['B', 'Grupo B'], ['F', 'Final']];

  return (
    <Casca sub={[dados.evento.titulo, dados.evento.subtitulo].filter(Boolean).join(' · ')}>
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>
          {q.em_curso ? <>Agora: <b className="text-slate-200">{q.sessoes[q.em_curso].nome}</b></> : 'Encerrado'}
        </span>
        <button onClick={carregar} className="flex items-center gap-1 hover:text-slate-200">
          <RefreshCw size={12} /> {horaBRT(dados.atualizado_em)}
        </button>
      </div>
      {q.avisos.map((a) => (
        <div key={a} className="mt-3 flex items-center gap-2 text-sm text-amber-300"><AlertTriangle size={14} />{a}</div>
      ))}
      <div className="mt-4 grid grid-cols-4 gap-1 p-1 rounded-xl bg-[#0f1e33] border border-[#1d3252]">
        {abas.map(([k, t]) => (
          <button key={k} onClick={() => setAba(k)}
            className={`py-2 rounded-lg text-sm font-semibold ${atual === k ? 'bg-[color:var(--color-brand)] text-white' : 'text-slate-300'}`}>{t}</button>
        ))}
      </div>
      {atual === 'D' && <Dia dados={dados} />}
      {(atual === 'A' || atual === 'B') && <Grupo g={atual} q={q} />}
      {atual === 'F' && <Final q={q} />}
    </Casca>
  );
}
