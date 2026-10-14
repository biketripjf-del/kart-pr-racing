import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Trophy, Timer, RefreshCw, Flag, AlertTriangle } from 'lucide-react';
import { api } from '../api.js';
import { Casca } from '../components/Marca.jsx';

const INTERVALO_MS = 15000;
const ROTULO = {
  aguardando: { txt: 'aguardando', cls: 'bg-slate-200 text-tx2' },
  ao_vivo: { txt: 'na pista', cls: 'bg-red-600 text-white animate-pulse' },
  provisorio: { txt: 'provisório', cls: 'bg-amber-500 text-white' },
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
          <tr className="text-[11px] uppercase tracking-wide text-tx2">
            {cab.map((c, i) => <th key={i} className={`px-2 py-2 font-medium ${i === 1 ? 'text-left' : 'text-center'}`}>{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l, i) => (
            <tr key={i} className={`border-t border-[#e3e9f1] ${destaque?.(i) || ''}`}>
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
          {s.atualizado_em && <span className="text-[11px] text-tx3">{horaBRT(s.atualizado_em)}</span>}
          <Selo status={s.status} />
        </div>
      </div>
      {children || <div className="px-4 pb-4 text-sm text-tx2">{vazio || 'Ainda não correu.'}</div>}
      {s.observacoes && <div className="px-4 pb-3 text-xs text-amber-700/90">{s.observacoes}</div>}
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
      {l.ausente && <span className="ml-2 text-[11px] text-red-600">não correu</span>}
      {l.punicao && <span className="ml-2 text-[11px] text-amber-700">punido ({l.punicao === 'fim' ? 'fim de fila' : `${l.punicao === true ? 3 : l.punicao} pos.`}; cruzou em {l.pos_folha}º)</span>}
    </>,
    l.kart ?? '—',
    volta(l.mv_ms),
    ...(comPontos ? [<b className="text-[color:var(--color-brand)]">{l.pontos}</b>] : []),
  ]);
  return <Tabela cab={cab} linhas={linhas} />;
}

function Grid({ s, titulo }) {
  if (!s.grid?.length) return null;
  const volta_ = (p) => s.tomada?.find((l) => l.piloto === p)?.mv_ms;
  return (
    <div className="px-4 pb-3">
      <div className="label mt-1">{titulo}</div>
      <ol className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        {s.grid.map((p, i) => (
          <li key={p} className="flex gap-2">
            <span className="w-6 text-right text-tx3 tabular-nums">{i + 1}º</span>
            <span className="flex-1">{p}</span>
            {volta_(p) != null && <span className="text-[11px] text-tx2 tabular-nums">{volta(volta_(p))}</span>}
          </li>
        ))}
      </ol>
    </div>
  );
}

function Corrida({ s }) {
  return (
    <CartaoSessao s={s} vazio="Grid sai da tomada de tempo (melhor volta larga em 1º).">
      {s.resultado.length ? <Resultado s={s} comPontos /> : <Grid s={s} titulo="Grid de largada · tomada de tempo" />}
    </CartaoSessao>
  );
}

const pts = (b) => (b ? (b.ausente ? <span className="text-red-600">14</span> : b.pontos) : '—');

function Placar({ tabela, corte, titulo, nota, comGrupo }) {
  const linhas = tabela.map((l) => [
    l.correu ? l.pos : '—',
    <>{l.piloto}{l.cabeca && <span className="ml-1 text-[10px] text-[color:var(--color-gold)]">cabeça</span>}
      {l.empate_sorteio && <span className="ml-1 text-[10px] text-amber-700">empate</span>}</>,
    ...(comGrupo ? [l.grupo] : []),
    pts(l.b1), pts(l.b2), <b>{l.correu ? l.total : '—'}</b>, volta(l.mv_baterias_ms),
  ]);
  return (
    <div className="card mt-4">
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <div className="font-semibold">{titulo}</div>
        <span className="text-[11px] text-tx2">menor soma vence</span>
      </div>
      <Tabela
        cab={['#', 'Piloto', ...(comGrupo ? ['Gr'] : []), 'B1', 'B2', 'Total', 'Melhor volta']}
        linhas={linhas}
        destaque={(i) => (corte && i === corte - 1 ? 'border-b-2 border-b-[color:var(--color-gold)]' : '')
          + (tabela[i].vai_pra_final ? ' bg-[#e8eff7]' : '')}
      />
      {nota && <div className="px-4 py-2 text-[11px] text-tx2">{nota}</div>}
    </div>
  );
}

function Grupo({ g, q }) {
  const grupo = q.grupos[g];
  if (!grupo.pilotos.length) return <div className="card p-6 text-center text-tx mt-4">Grupos saem do sorteio.</div>;
  const naFinal = new Set(q.geral.tabela.filter((l) => l.vai_pra_final).map((l) => l.piloto));
  const tabela = grupo.tabela.map((l) => ({ ...l, vai_pra_final: naFinal.has(l.piloto) }));
  return (
    <>
      <Placar tabela={tabela} titulo={`Placar do Grupo ${g}`}
        nota="Pontos = posição (1º = 1 ponto). Perdeu a bateria = 14. Fundo azul = hoje está entre os 14 da final (aba Geral)." />
      <Corrida s={q.sessoes[`B1_${g}`]} />
      <Corrida s={q.sessoes[`B2_${g}`]} />
    </>
  );
}

function Geral({ q }) {
  const { geral } = q;
  return (
    <Placar tabela={geral.tabela} corte={14} comGrupo
      titulo={`Classificação geral${geral.definido ? '' : geral.parcial ? ' · parcial' : ''}`}
      nota="Linha dourada = corte. Os 14 de cima correm a GRANDE FINAL. Desempate: melhor volta nas baterias." />
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
              <div key={p.piloto} className={`rounded-xl p-3 ${p.pos === 1 ? 'bg-[color:var(--color-gold)] text-white' : 'bg-[#e8eff7]'}`}>
                <div className="text-2xl font-extrabold display">{p.pos}º</div>
                <div className="text-sm font-semibold leading-tight">{p.piloto}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      <CartaoSessao s={fin} vazio="Os 14 melhores da classificação geral. Quem vencer a final é o campeão.">
        {fin.resultado.length ? <Resultado s={fin} /> : (
          final.grid.length > 0 && (
            <>
              <Tabela cab={['Larga', 'Piloto', 'Gr', 'Pts']}
                linhas={final.grid.map((l) => [`${l.largada}º`, l.piloto, l.grupo, l.total])} />
              {!final.grid_pela_tomada && (
                <div className="px-4 py-2 text-[11px] text-amber-700">Ordem pelos pontos — o grid de verdade sai da tomada de tempo da final.</div>
              )}
            </>
          )
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
      {(h.saida || h.kart_abre || h.volta) && (
        <div className="card mt-4 p-4 grid grid-cols-3 text-center text-sm">
          <div><div className="label">Saída de JF</div>{h.saida || '—'}</div>
          <div><div className="label">Kart abre</div>{h.kart_abre || '—'}</div>
          <div><div className="label">Volta</div>{h.volta || '—'}</div>
        </div>
      )}
      <div className="card mt-4 overflow-hidden">
        {Object.values(q.sessoes).map((s) => (
          <div key={s.codigo} className={`flex items-center justify-between px-4 py-2.5 border-b border-[#e3e9f1] last:border-0 ${q.em_curso === s.codigo ? 'bg-[#e8eff7]' : ''}`}>
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
              {p.grupo && <span className="text-[10px] font-bold w-4 text-tx2">{p.grupo}</span>}
              <span>{p.nome}</span>
              {p.cabeca && <span className="text-[10px] text-[color:var(--color-gold)]">cabeça {p.cabeca}</span>}
            </div>
          ))}
        </div>
      </div>
      {evento.regulamento && (
        <details className="card mt-4 p-4 text-sm">
          <summary className="cursor-pointer font-semibold">Regulamento</summary>
          <div className="mt-3 whitespace-pre-line text-tx">{evento.regulamento}</div>
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
    return <Casca sub="Ao vivo"><div className="text-center text-tx2 py-10">{erro ? 'Quadro ainda não aberto.' : 'Carregando…'}</div></Casca>;
  }
  const q = dados.quadro;
  const abaPadrao = q.em_curso === 'FINAL' ? 'F' : (q.sessoes[q.em_curso]?.grupo || 'D');
  const comecou = Object.values(q.sessoes).some((s) => s.resultado.length || s.tomada?.length);
  const atual = aba || (comecou ? abaPadrao : 'D');
  const abas = [['D', 'Dia'], ['A', 'Grupo A'], ['B', 'Grupo B'], ['G', 'Geral'], ['F', 'Final']];

  return (
    <Casca sub={[dados.evento.titulo, dados.evento.subtitulo].filter(Boolean).join(' · ')}>
      <div className="flex items-center justify-between text-xs text-tx2">
        <span>
          {q.em_curso ? <>Agora: <b className="text-tx">{q.sessoes[q.em_curso].nome}</b></> : 'Encerrado'}
        </span>
        <button onClick={carregar} className="flex items-center gap-1 hover:text-tx">
          <RefreshCw size={12} /> {horaBRT(dados.atualizado_em)}
        </button>
      </div>
      {q.avisos.map((a) => (
        <div key={a} className="mt-3 flex items-center gap-2 text-sm text-amber-700"><AlertTriangle size={14} />{a}</div>
      ))}
      <div className="mt-4 grid grid-cols-5 gap-1 p-1 rounded-xl bg-white border border-[#e3e9f1]">
        {abas.map(([k, t]) => (
          <button key={k} onClick={() => setAba(k)}
            className={`py-2 rounded-lg text-[13px] font-semibold ${atual === k ? 'bg-[color:var(--color-brand)] text-white' : 'text-tx'}`}>{t}</button>
        ))}
      </div>
      {atual === 'D' && <Dia dados={dados} />}
      {(atual === 'A' || atual === 'B') && <Grupo g={atual} q={q} />}
      {atual === 'G' && <Geral q={q} />}
      {atual === 'F' && <Final q={q} />}
    </Casca>
  );
}
