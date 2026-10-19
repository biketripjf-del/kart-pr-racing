// Simulador da última etapa (Brunner 19/10/2026 18:30 BRT, "1+2 go"): "e se eu fizer 1º, 3º e 2º?" e a matemática do
// título. Funções PURAS, nada é gravado: monta folhas HIPOTÉTICAS da próxima etapa (formato copa3) e roda o MESMO motor
// do ranking (rankingCampeonato) com elas no lugar das de verdade.
//  - Projeção: quem não foi mexido chega na ordem do RITMO (índice médio de todas as corridas, menor = mais rápido);
//    sem ritmo vai pro fim, em ordem alfabética. É estimativa, e a tela diz isso.
//  - Blocos: os do sorteio quando já saíram; antes disso, um sorteio provisório com semente fixa (a tela avisa).
//  - Ajustes: { [nome]: { b1, b2, final } } = posição na 1ª e na 2ª bateria DO PILOTO e na final. Cada um é encaixado
//    na posição pedida e os outros descem; a final só vale se o piloto se classificar com aquelas baterias.
//  - Matemática do título: com o dia 23 o ano chega a 3 dias e o descarte liga; o último dia é protegido, então o que
//    cada um LEVA pra sexta = soma dos dias anteriores menos o pior deles (dia com punição não sai). Na sexta, quem
//    fizer mais pontos que essa diferença passa.
import { calcularQuadro, SESSOES, BLOCOS, pontosDaPosicao } from './aoVivo.js';
import { rankingCampeonato, rankingRitmo, punidosDoEvento, anoDe, MIN_EVENTOS_DESCARTE } from './historico.js';
import { montarOrdem } from './sorteio.js';

export const MAXIMO_NO_DIA = 3 * pontosDaPosicao(1); // 2 baterias + final, vencendo as 3
const SEMENTE_PROVISORIA = 'simulador-blocos-provisorios';

// a próxima etapa = a Copa (formato de baterias) mais recente que ainda não tem campeão homologado
export function proximaEtapa(eventos) {
  return eventos.filter((e) => !e.estado.teste && e.estado.formato !== 'corridas')
    .sort((a, b) => String(b.estado.data).localeCompare(String(a.estado.data)))
    .find((e) => !calcularQuadro(e.estado).final.campeao) || null;
}

const chave = (p) => (p.piloto_id != null ? `id:${p.piloto_id}` : null);

function pilotosProjetados(eventos, etapa) {
  const lista = etapa.estado.pilotos || [];
  const ritmo = new Map(rankingRitmo(eventos, { minimo: 1 }).tabela.map((l) => [l.chave, l.ritmo]));
  const reais = lista.length > 0 && lista.every((p) => BLOCOS.includes(p.grupo));
  const provisorio = reais ? null : new Map(montarOrdem(lista.map((p) => p.nome), SEMENTE_PROVISORIA).map((o) => [o.nome, o.grupo]));
  return {
    blocos_reais: reais,
    pilotos: lista.map((p) => ({ nome: p.nome, piloto_id: p.piloto_id ?? null, grupo: reais ? p.grupo : provisorio.get(p.nome), ritmo: ritmo.get(chave(p)) ?? null }))
      .sort((a, b) => (a.ritmo ?? Infinity) - (b.ritmo ?? Infinity) || a.nome.localeCompare(b.nome)),
  };
}

// melhor volta fictícia coerente com o ritmo, só pra desempate andar no mesmo sentido da projeção
const voltaFicticia = (p, i) => Math.round(47300 * (p.ritmo ?? 106 + i * 0.1) / 100);

function encaixar(ordem, pedidos) {
  // pedidos: [[nome, pos]] — do 1º pedido pro último, cada um vai pra posição dele
  let o = [...ordem];
  for (const [nome, pos] of pedidos.sort((a, b) => a[1] - b[1])) {
    if (!o.includes(nome)) continue;
    o = o.filter((n) => n !== nome);
    o.splice(Math.max(0, Math.min(o.length, pos - 1)), 0, nome);
  }
  return o;
}

export function simular(eventos, ajustes = {}) {
  const etapa = proximaEtapa(eventos);
  if (!etapa) return null;
  const { blocos_reais, pilotos } = pilotosProjetados(eventos, etapa);
  const idx = new Map(pilotos.map((p, i) => [p.nome, i]));
  const folha = (nomes) => nomes.map((n, i) => {
    const p = pilotos[idx.get(n)];
    return { piloto: n, pos: i + 1, kart: i + 1, mv: voltaFicticia(p, idx.get(n)), voltas: 18 };
  });
  const pedido = (nome, campo) => {
    const v = Number(ajustes?.[nome]?.[campo]);
    return Number.isInteger(v) && v >= 1 && v <= 28 ? v : null;
  };
  const sessoes = {};
  for (const d of SESSOES.filter((s) => s.tipo === 'bateria')) {
    const nomes = pilotos.filter((p) => d.blocos.includes(p.grupo)).map((p) => p.nome);
    const campo = d.n === 1 ? 'b1' : 'b2';
    const pedidos = nomes.map((n) => [n, pedido(n, campo)]).filter(([, v]) => v != null);
    sessoes[d.codigo] = { status: 'homologado', linhas: folha(encaixar(nomes, pedidos)) };
  }
  const estadoSim = { ...etapa.estado, pilotos: (etapa.estado.pilotos || []).map((p) => ({ ...p, grupo: pilotos[idx.get(p.nome)].grupo })), sessoes };
  const finalistas = calcularQuadro(estadoSim).geral.tabela.filter((l) => l.vai_pra_final).map((l) => l.piloto);
  const pedidosFinal = finalistas.map((n) => [n, pedido(n, 'final')]).filter(([, v]) => v != null);
  sessoes.FINAL = { status: 'homologado', linhas: folha(encaixar(finalistas, pedidosFinal)) };
  const quadro = calcularQuadro(estadoSim);
  const outros = eventos.filter((e) => e.slug !== etapa.slug);
  const ranking = rankingCampeonato([...outros, { slug: etapa.slug, estado: estadoSim }], { ano: anoDe(etapa.estado) });

  // o dia de cada piloto: posições reais que a simulação deu (o encaixe pode empurrar alguém) e os pontos
  const finalPos = new Map(quadro.final.classificacao.map((l) => [l.piloto, l.pos]));
  const dia = quadro.geral.tabela.map((l) => {
    const fp = finalPos.get(l.piloto) ?? null;
    return { piloto: l.piloto, piloto_id: pilotos[idx.get(l.piloto)]?.piloto_id ?? null, grupo: l.grupo, b1: l.b1?.pos ?? null, b2: l.b2?.pos ?? null, final: fp,
      pontos: l.total + (fp ? pontosDaPosicao(fp) : 0), na_final: l.vai_pra_final, ajustado: !!ajustes?.[l.piloto] };
  });
  return {
    etapa: { slug: etapa.slug, titulo: etapa.estado.titulo, data: etapa.estado.data },
    blocos_reais, campeao_do_dia: quadro.final.classificacao[0]?.piloto ?? null,
    podio: quadro.final.classificacao.slice(0, 3).map((l) => l.piloto),
    dia, ranking,
  };
}

// o que cada um leva pra sexta (com o descarte que liga no 3º dia) e a distância pro líder
export function matematicaDoTitulo(eventos) {
  const etapa = proximaEtapa(eventos);
  if (!etapa) return null;
  const ano = anoDe(etapa.estado);
  const r = rankingCampeonato(eventos, { ano });
  const doAno = new Set(r.eventos.map((e) => e.slug));
  const dataDe = new Map(r.eventos.map((e) => [e.slug, e.data]));
  const punidos = new Map(eventos.filter((e) => doAno.has(e.slug)).map((e) => [e.slug, punidosDoEvento(e)]));
  const vaiTerDescarte = r.eventos.filter((e) => e.slug !== etapa.slug).length + 1 >= MIN_EVENTOS_DESCARTE;
  const correm = new Set((etapa.estado.pilotos || []).map(chave).filter(Boolean));
  const linhas = r.tabela.map((l) => {
    const anteriores = l.colunas.filter((c) => c.evento !== etapa.slug);
    const soma = anteriores.reduce((t, c) => t + c.pontos, 0);
    const podem = anteriores.filter((c) => !punidos.get(c.evento)?.has(l.chave));
    const sai = vaiTerDescarte && podem.length ? podem.reduce((m, c) => (c.pontos < m.pontos ? c : m)) : null;
    // hoje = o que o ranking mostra agora (sem descarte, 2 dias); leva = o que sobra quando o 3º dia liga o descarte
    return { piloto: l.piloto, piloto_id: l.piloto_id, chave: l.chave, hoje: soma, leva: soma - (sai?.pontos ?? 0), sai: sai ? { evento: sai.evento, data: dataDe.get(sai.evento) ?? null, pontos: sai.pontos } : null, corre: correm.has(l.chave) };
  });
  // quem corre sexta e ainda não pontuou no ano também entra, levando 0
  for (const p of etapa.estado.pilotos || []) {
    if (chave(p) && !linhas.some((l) => l.chave === chave(p))) linhas.push({ piloto: p.nome, piloto_id: p.piloto_id, chave: chave(p), hoje: 0, leva: 0, sai: null, corre: true });
  }
  linhas.sort((a, b) => b.leva - a.leva || Number(b.corre) - Number(a.corre) || a.piloto.localeCompare(b.piloto));
  const lider = linhas[0]?.leva ?? 0;
  linhas.forEach((l, i) => {
    l.pos = i + 1;
    l.atras = lider - l.leva;
    l.pode_ser_campeao = l.corre && l.leva + MAXIMO_NO_DIA >= lider;
  });
  return {
    etapa: { slug: etapa.slug, titulo: etapa.estado.titulo, data: etapa.estado.data },
    descarte: vaiTerDescarte, maximo_no_dia: MAXIMO_NO_DIA,
    regra: vaiTerDescarte
      ? `Com a sexta, o ano chega a ${MIN_EVENTOS_DESCARTE} dias e o descarte liga: cada um perde o pior dia ANTERIOR (o último dia não se descarta). O que você leva = esses dias menos o pior. Na sexta dá pra fazer até ${MAXIMO_NO_DIA} pontos (vencendo as 2 baterias e a final).`
      : `Na sexta dá pra fazer até ${MAXIMO_NO_DIA} pontos (vencendo as 2 baterias e a final).`,
    linhas,
  };
}
