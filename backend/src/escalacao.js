// Escalação das baterias (22/10/2026, Brunner: "vamos deixar essa tela mais interessante… os mais rápidos, qual bateria
// ficou mais forte" → GO nos 5: ficha de cada piloto, bateria da morte, título em jogo, duelos, recorde à vista).
// Só leitura: tudo sai do histórico dos OUTROS eventos (o dia de hoje não entra no "antes da corrida").
import { SESSOES, normalizar } from './aoVivo.js';
import { rankingRitmo, recordesPorTracado, rivaisDoPiloto } from './historico.js';
import { matematicaDoTitulo } from './simulacao.js';

export const TOP_FORCA = 5; // força = média do ritmo dos 5 mais rápidos (a média de todos pune a bateria por ter 1 lento)
export const DESTAQUES = 3;
const chave = (p) => (p.piloto_id != null ? `id:${p.piloto_id}` : null);
const media2 = (xs) => Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100;

export function escalacaoDasBaterias(eventos, slug) {
  const etapa = eventos.find((e) => e.slug === slug);
  if (!etapa) return null;
  const antes = eventos.filter((e) => e.slug !== slug && !e.estado.teste);
  const pilotos = etapa.estado.pilotos || [];
  if (!pilotos.some((p) => p.grupo)) return { sorteado: false, baterias: [] };

  // ritmo de quem tem ao menos 1 corrida (o corte de 3 é do RANKING; aqui a ficha mostra quantas corridas sustentam o número)
  const r = rankingRitmo(antes, { minimo: 1 });
  const ritmo = new Map(r.tabela.map((l) => [l.chave, l]));
  // título: só faz sentido enquanto esta é a próxima etapa (depois do dia, o ranking de verdade já conta)
  const m = matematicaDoTitulo([...antes, etapa]);
  const titulo = m && m.etapa.slug === slug ? new Map(m.linhas.map((l) => [l.chave, l])) : null;
  const rec = etapa.estado.tracado
    ? recordesPorTracado(antes).find((x) => normalizar(x.tracado) === normalizar(etapa.estado.tracado)) : null;
  const melhorNoTracado = new Map((rec?.todos || []).map((v) => [v.chave, v.mv_ms]));

  const ficha = (p) => {
    const k = chave(p);
    const rt = ritmo.get(k);
    const t = titulo?.get(k);
    return {
      piloto: p.nome, piloto_id: p.piloto_id ?? null, grupo: p.grupo,
      ritmo: rt?.ritmo ?? null, corridas: rt?.corridas ?? 0, vezes_mais_rapido: rt?.vezes_mais_rapido ?? 0,
      estreante: !rt,
      pontos: t ? t.leva : null, pos_copa: t ? t.pos : null, pode_ser_campeao: !!t?.pode_ser_campeao,
      melhor_volta_ms: melhorNoTracado.get(k) ?? null,
    };
  };

  const baterias = SESSOES.filter((s) => s.tipo === 'bateria').map((s) => {
    const lista = pilotos.filter((p) => s.blocos.includes(p.grupo)).map(ficha)
      .sort((a, b) => (a.ritmo ?? Infinity) - (b.ritmo ?? Infinity) || b.corridas - a.corridas || a.piloto.localeCompare(b.piloto, 'pt-BR'));
    lista.filter((l) => l.ritmo != null).slice(0, DESTAQUES).forEach((l, i) => { l.destaque = i + 1; });
    const comDado = lista.filter((l) => l.ritmo != null);
    const topo = comDado.slice(0, TOP_FORCA);
    // duelos: pares desta bateria que já correram juntos (confronto direto, ausente não conta)
    const duelos = [];
    const ids = new Set(lista.map((l) => l.piloto_id).filter((x) => x != null));
    for (const l of lista) {
      if (l.piloto_id == null) continue;
      for (const o of rivaisDoPiloto(antes, `id:${l.piloto_id}`)) {
        if (!ids.has(o.piloto_id) || o.piloto_id <= l.piloto_id) continue; // cada par uma vez
        duelos.push({ a: l.piloto, b: lista.find((x) => x.piloto_id === o.piloto_id).piloto, a_vence: o.vitorias, b_vence: o.derrotas, encontros: o.encontros });
      }
    }
    duelos.sort((x, y) => y.encontros - x.encontros || Math.abs(x.a_vence - x.b_vence) - Math.abs(y.a_vence - y.b_vence) || x.a.localeCompare(y.a));
    const voltas = lista.filter((l) => l.melhor_volta_ms != null).sort((a, b) => a.melhor_volta_ms - b.melhor_volta_ms);
    return {
      codigo: s.codigo, nome: s.nome, blocos: s.blocos,
      pilotos: lista,
      forca: topo.length >= TOP_FORCA ? media2(topo.map((l) => l.ritmo)) : null,
      com_dado: comDado.length, estreantes: lista.length - comDado.length,
      candidatos: lista.filter((l) => l.pode_ser_campeao).map((l) => l.piloto),
      duelos: duelos.slice(0, 4),
      mais_perto_do_recorde: voltas[0] ? { piloto: voltas[0].piloto, mv_ms: voltas[0].melhor_volta_ms } : null,
    };
  });
  // bateria da morte = menor índice de força (só entre as que têm TOP_FORCA pilotos com dado)
  const medidas = baterias.filter((b) => b.forca != null).sort((a, b) => a.forca - b.forca);
  medidas.forEach((b, i) => { b.forca_pos = i + 1; });
  if (medidas.length > 1) medidas[0].da_morte = true;
  return {
    sorteado: true,
    regra: `Ritmo = melhor volta ÷ melhor volta da corrida × 100, média das corridas anteriores (100 = o mais rápido). Força da bateria = média do ritmo dos ${TOP_FORCA} mais rápidos dela; quanto menor, mais forte. Estreante não tem volta registrada e fica fora da conta.`,
    recorde: rec ? { tracado: rec.tracado, piloto: rec.recorde.piloto, mv_ms: rec.recorde.mv_ms, data: rec.recorde.data } : null,
    baterias,
  };
}
