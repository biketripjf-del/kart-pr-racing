import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ChevronLeft, Check, X, MessageCircle, Copy } from 'lucide-react';
import { api } from '../api.js';
import { Casca } from '../components/Marca.jsx';

// "mm:ss.mmm" / "ss.mmm" -> ms
function tempoParaMs(str) {
  if (!str) return null;
  const s = String(str).trim().replace(',', '.');
  if (!s) return null;
  const partes = s.split(':').map((p) => parseFloat(p));
  if (partes.some((n) => Number.isNaN(n))) return null;
  let ms = 0;
  if (partes.length === 3) ms = ((partes[0] * 60 + partes[1]) * 60 + partes[2]) * 1000;
  else if (partes.length === 2) ms = (partes[0] * 60 + partes[1]) * 1000;
  else ms = partes[0] * 1000;
  return Math.round(ms);
}
function msParaTempo(ms) {
  if (ms == null) return '';
  const totalSeg = ms / 1000;
  const min = Math.floor(totalSeg / 60);
  const seg = (totalSeg - min * 60).toFixed(3);
  return `${min}:${seg.padStart(6, '0')}`;
}

export default function AdminEtapa() {
  const { id } = useParams();
  const [etapa, setEtapa] = useState(null);
  const [inscritos, setInscritos] = useState([]);
  const [rascunho, setRascunho] = useState({}); // piloto_id -> {posicao, volta, voltas, pole}
  const [relatorio, setRelatorio] = useState('');

  const carregar = useCallback(async () => {
    const [e, ins] = await Promise.all([
      api.get('/etapas').then((r) => r.data.find((x) => x.id === Number(id))),
      api.get(`/etapas/${id}/inscritos`),
    ]);
    setEtapa(e);
    setInscritos(ins.data);
    const r = {};
    for (const i of ins.data) {
      r[i.piloto_id] = {
        posicao: i.posicao ?? '',
        volta: i.melhor_volta_ms != null ? msParaTempo(i.melhor_volta_ms) : '',
        voltas: i.num_voltas ?? '',
        pole: !!i.pole,
      };
    }
    setRascunho(r);
  }, [id]);
  useEffect(() => { carregar(); }, [carregar]);

  async function togglePagamento(pilotoId, pago) {
    await api.patch(`/etapas/${id}/inscritos/${pilotoId}/pagamento`, { pago });
    setInscritos((xs) => xs.map((i) => (i.piloto_id === pilotoId ? { ...i, pago } : i)));
  }

  async function salvarResultado(pilotoId) {
    const d = rascunho[pilotoId] || {};
    await api.put(`/resultados/${id}/${pilotoId}`, {
      posicao: d.posicao ? Number(d.posicao) : null,
      melhor_volta_ms: tempoParaMs(d.volta),
      num_voltas: d.voltas ? Number(d.voltas) : null,
      pole: !!d.pole,
    });
    toast.success('Resultado salvo.');
    carregar();
  }

  async function marcarRealizada() {
    await api.patch(`/etapas/${id}`, { status: 'realizada' });
    toast.success('Etapa marcada como realizada. Já entra no ranking.');
    carregar();
  }

  async function gerarRelatorio() {
    const { data } = await api.get(`/resultados/etapa/${id}`);
    const cls = (data.classificacao || []).filter((r) => r.posicao).sort((a, b) => a.posicao - b.posicao);
    if (!cls.length) return toast.error('Sem resultados lançados ainda.');
    const medal = (p) => (p === 1 ? '🥇' : p === 2 ? '🥈' : p === 3 ? '🥉' : `${p}º`);
    const mv = cls.find((r) => r.melhor_volta_da_etapa);
    let txt = `🏁 *P&R RACING CUP* — ${data.etapa.nome}\n`;
    txt += `📍 ${data.etapa.kartodromo || ''}\n\n`;
    txt += `*RESULTADO*\n`;
    for (const r of cls) {
      txt += `${medal(r.posicao)} ${r.apelido || r.nome} — ${r.pontos} pts\n`;
    }
    if (mv) txt += `\n⚡ Volta mais rápida: *${mv.apelido || mv.nome}* (${mv.melhor_volta})`;
    txt += `\n\n🏆 Ranking geral: ${location.origin}/ranking`;
    setRelatorio(txt);
  }

  function setR(pilotoId, campo, valor) {
    setRascunho((r) => ({ ...r, [pilotoId]: { ...r[pilotoId], [campo]: valor } }));
  }

  if (!etapa) return <Casca sub="Etapa"><div className="text-center text-tx2 py-10">Carregando…</div></Casca>;

  const pagos = inscritos.filter((i) => i.pago).length;

  return (
    <Casca sub={etapa.nome}>
      <Link to="/admin" className="btn btn-ghost text-sm mb-4 inline-flex"><ChevronLeft size={16} /> Voltar</Link>

      <div className="card p-4 mb-4 flex justify-between items-center">
        <div className="text-sm text-tx">
          {inscritos.length} inscritos · <span className="text-emerald-700">{pagos} pagos</span> · {etapa.status}
        </div>
        {etapa.status !== 'realizada' && (
          <button onClick={marcarRealizada} className="btn btn-gold text-sm">Fechar etapa</button>
        )}
      </div>

      <div className="flex gap-2 mb-4">
        <button onClick={gerarRelatorio} className="btn btn-primary text-sm flex-1"><MessageCircle size={16} /> Gerar relatório WhatsApp</button>
      </div>

      {relatorio && (
        <div className="card p-4 mb-5">
          <textarea className="input font-mono text-sm h-56" value={relatorio} readOnly />
          <button
            onClick={() => { navigator.clipboard.writeText(relatorio); toast.success('Copiado! Cola no grupo.'); }}
            className="btn btn-ghost text-sm mt-2"><Copy size={16} /> Copiar texto</button>
        </div>
      )}

      <div className="space-y-3">
        {inscritos.map((i) => (
          <div key={i.piloto_id} className="card p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold">{i.nome} {i.apelido && <span className="text-tx2 font-normal">"{i.apelido}"</span>}</div>
              <button
                onClick={() => togglePagamento(i.piloto_id, !i.pago)}
                className={`btn text-xs ${i.pago ? 'btn-gold' : 'btn-ghost'}`}>
                {i.pago ? <><Check size={14} /> Pago</> : <><X size={14} /> Pendente</>}
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <div>
                <span className="label">Pos.</span>
                <input className="input py-1.5 text-center" inputMode="numeric" value={rascunho[i.piloto_id]?.posicao ?? ''} onChange={(e) => setR(i.piloto_id, 'posicao', e.target.value)} />
              </div>
              <div className="col-span-2">
                <span className="label">Melhor volta</span>
                <input className="input py-1.5" placeholder="0:52.340" value={rascunho[i.piloto_id]?.volta ?? ''} onChange={(e) => setR(i.piloto_id, 'volta', e.target.value)} />
              </div>
              <div>
                <span className="label">Voltas</span>
                <input className="input py-1.5 text-center" inputMode="numeric" value={rascunho[i.piloto_id]?.voltas ?? ''} onChange={(e) => setR(i.piloto_id, 'voltas', e.target.value)} />
              </div>
            </div>
            <div className="flex items-center justify-between mt-2">
              <label className="flex items-center gap-2 text-sm text-tx">
                <input type="checkbox" checked={!!rascunho[i.piloto_id]?.pole} onChange={(e) => setR(i.piloto_id, 'pole', e.target.checked)} className="w-4 h-4 accent-[color:var(--color-brand)]" />
                Pole
              </label>
              <button onClick={() => salvarResultado(i.piloto_id)} className="btn btn-primary text-xs">Salvar</button>
            </div>
          </div>
        ))}
        {inscritos.length === 0 && <div className="text-tx2 text-sm">Ninguém inscrito nesta etapa ainda.</div>}
      </div>
    </Casca>
  );
}
