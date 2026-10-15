import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Car, MapPin, Clock, Plus, X, Lock, UserPlus } from 'lucide-react';
import { api } from '../api.js';
import { Casca, Avatar } from '../components/Marca.jsx';

// Caronas JF → Volta Redonda (msg do Emmanuel no grupo: "serão sugeridos grupos para o deslocamento").
// Quem abriu o link pessoal neste celular oferece carro ou entra num; a organização mexe em tudo.
const ERROS = {
  abra_seu_link: 'Abra seu link pessoal primeiro (Minha ficha).', ja_esta_em_um_carro: 'Você já está em um carro.',
  carro_cheio: 'Esse carro lotou.', vagas_menor_que_passageiros: 'Já tem mais gente que isso no carro.', so_o_motorista: 'Só o motorista mexe no carro.',
};
const erro = (e) => toast.error(ERROS[e.response?.data?.erro] || 'Não deu certo. Tente de novo.');

function Oferta({ fechar, sem, admin }) {
  const [v, setV] = useState({ vagas: 3, saida_local: '', saida_hora: '10:00', obs: '', motorista_id: '' });
  async function salvar(e) {
    e.preventDefault();
    try {
      await api.post('/caronas', { ...v, vagas: Number(v.vagas), motorista_id: v.motorista_id ? Number(v.motorista_id) : null });
      toast.success('Carro cadastrado. Agora é esperar a galera entrar.'); fechar(true);
    } catch (err) { erro(err); }
  }
  return (
    <form onSubmit={salvar} className="card p-4 space-y-3 border-[color:var(--color-brand)]/40">
      <div className="font-semibold flex items-center gap-2"><Car size={17} className="text-brand" /> Vou de carro</div>
      {admin && (
        <label className="block"><span className="label">Motorista (organização cadastrando por alguém)</span>
          <select className="input" value={v.motorista_id} onChange={(e) => setV({ ...v, motorista_id: e.target.value })}>
            <option value="">Eu mesmo (link pessoal)</option>
            {sem.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </label>
      )}
      <div className="grid grid-cols-2 gap-3">
        <label className="block"><span className="label">Vagas livres</span>
          <select className="input" value={v.vagas} onChange={(e) => setV({ ...v, vagas: e.target.value })}>
            {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <label className="block"><span className="label">Saída</span>
          <input className="input" inputMode="numeric" placeholder="10:00" value={v.saida_hora} maxLength={5}
            onChange={(e) => { const d = e.target.value.replace(/\D/g, '').slice(0, 4); setV({ ...v, saida_hora: d.length > 2 ? `${d.slice(0, 2)}:${d.slice(2)}` : d }); }} />
        </label>
      </div>
      <label className="block"><span className="label">Sai de onde (bairro ou ponto em JF)</span>
        <input className="input" placeholder="Ex.: Independência, posto da Itamar" value={v.saida_local} maxLength={80} onChange={(e) => setV({ ...v, saida_local: e.target.value })} />
      </label>
      <label className="block"><span className="label">Observação (opcional)</span>
        <input className="input" placeholder="Ex.: racha a gasolina, passo no centro" value={v.obs} maxLength={200} onChange={(e) => setV({ ...v, obs: e.target.value })} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="btn btn-ghost" onClick={() => fechar(false)}>Cancelar</button>
        <button className="btn btn-primary">Oferecer carona</button>
      </div>
    </form>
  );
}

function Assento({ p, podeTirar, tirar }) {
  if (!p) return <div className="w-11 h-11 rounded-full border-2 border-dashed border-[#c5d0de] flex items-center justify-center text-[10px] text-tx3">livre</div>;
  return (
    <div className="relative flex flex-col items-center w-14">
      <Avatar id={p.id} v={p.foto_v} nome={p.nome} tam={44} />
      <span className="mt-1 text-[10px] leading-tight text-center text-tx truncate w-full">{p.nome.split(' ')[0]}</span>
      {podeTirar && <button onClick={tirar} title="tirar do carro" className="absolute -top-1 -right-0.5 bg-white rounded-full border border-[#d5dfeb] p-0.5"><X size={11} className="text-red-600" /></button>}
    </div>
  );
}

function Carro({ c, eu, admin, sem, recarregar }) {
  const souMotorista = eu && c.motorista.id === eu.id;
  const souPassageiro = eu && c.passageiros.some((p) => p.id === eu.id);
  const livres = c.vagas - c.passageiros.length;
  const [colocar, setColocar] = useState('');
  const acao = (fn, msg) => async () => { try { await fn(); if (msg) toast.success(msg); recarregar(); } catch (e) { erro(e); } };
  return (
    <div className={`card p-4 ${souMotorista || souPassageiro ? 'border-[color:var(--color-brand)]' : ''}`}>
      <div className="flex items-center gap-3">
        <Avatar id={c.motorista.id} v={c.motorista.foto_v} nome={c.motorista.nome} tam={44} />
        <div className="flex-1 min-w-0">
          <div className="text-[11px] uppercase tracking-wide text-tx3 font-semibold">Motorista</div>
          <div className="font-semibold truncate">{c.motorista.nome}{souMotorista ? ' (você)' : ''}</div>
        </div>
        <div className={`text-right text-xs font-bold ${livres ? 'text-emerald-700' : 'text-tx3'}`}>{livres ? `${livres} vaga${livres > 1 ? 's' : ''}` : 'lotado'}</div>
      </div>
      {(c.saida_local || c.saida_hora || c.obs) && (
        <div className="mt-2 text-sm text-tx2 space-y-0.5">
          {(c.saida_local || c.saida_hora) && <div className="flex items-center gap-1.5">{c.saida_hora && <><Clock size={13} />{c.saida_hora}</>}{c.saida_local && <><MapPin size={13} className="ml-1" />{c.saida_local}</>}</div>}
          {c.obs && <div className="text-xs">{c.obs}</div>}
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {Array.from({ length: c.vagas }, (_, i) => c.passageiros[i]).map((p, i) => (
          <Assento key={p?.id || `v${i}`} p={p} podeTirar={p && (admin || souMotorista)}
            tirar={acao(() => api.post(`/caronas/${c.id}/sair`, { piloto_id: p.id }), 'Tirado do carro.')} />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {eu && !souMotorista && !souPassageiro && livres > 0 && !eu.no_carro && (
          <button className="btn btn-primary flex-1 py-2 text-sm" onClick={acao(() => api.post(`/caronas/${c.id}/entrar`), 'Você está nesse carro.')}><UserPlus size={15} /> Entrar nesse carro</button>
        )}
        {souPassageiro && <button className="btn btn-ghost flex-1 py-2 text-sm" onClick={acao(() => api.post(`/caronas/${c.id}/sair`), 'Você saiu do carro.')}>Sair do carro</button>}
        {(souMotorista || admin) && (
          <>
            <select className="input py-1.5 text-sm flex-1 min-w-[7rem]" value={c.vagas} onChange={(e) => acao(() => api.patch(`/caronas/${c.id}`, { vagas: Number(e.target.value) }), 'Vagas atualizadas.')()}>
              {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n} vaga{n > 1 ? 's' : ''}</option>)}
            </select>
            <button className="btn btn-ghost py-2 text-sm text-red-600" onClick={acao(() => api.delete(`/caronas/${c.id}`), 'Carro desfeito.')}>Desfazer carro</button>
          </>
        )}
      </div>
      {admin && livres > 0 && sem.length > 0 && (
        <div className="mt-2 flex gap-2">
          <select className="input py-1.5 text-sm" value={colocar} onChange={(e) => setColocar(e.target.value)}>
            <option value="">Colocar alguém nesse carro…</option>
            {sem.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
          <button className="btn btn-ghost py-1.5 text-sm" disabled={!colocar} onClick={acao(() => api.post(`/caronas/${c.id}/entrar`, { piloto_id: Number(colocar) }).then(() => setColocar('')), 'Colocado no carro.')}>OK</button>
        </div>
      )}
    </div>
  );
}

export default function Caronas() {
  const [d, setD] = useState(null);
  const [oferecendo, setOferecendo] = useState(false);
  const carregar = () => api.get('/caronas').then((r) => setD(r.data)).catch(() => setD({ caronas: [], sem_carona: [], eu: null }));
  useEffect(() => { carregar(); const t = setInterval(() => { if (!document.hidden) carregar(); }, 15000); return () => clearInterval(t); }, []);
  if (!d) return <Casca sub="Caronas"><div className="text-center text-tx2 py-10">Carregando…</div></Casca>;

  const noCarro = d.eu && d.caronas.some((c) => c.motorista.id === d.eu.id || c.passageiros.some((p) => p.id === d.eu.id));
  const eu = d.eu ? { ...d.eu, no_carro: noCarro } : null;
  const vagas = d.caronas.reduce((s, c) => s + c.vagas - c.passageiros.length, 0);

  return (
    <Casca sub="Caronas pra Volta Redonda">
      <div className="card p-4 text-sm text-tx">
        Saída de Juiz de Fora <b>até 10:00–10:30</b>. Quem vai de carro oferece as vagas; quem precisa entra num carro. Cada um continua livre pra ir como quiser.
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          {[[d.caronas.length, 'carros'], [vagas, 'vagas livres'], [d.sem_carona.length, 'sem carona']].map(([n, r]) => (
            <div key={r} className="rounded-xl bg-[#f3f6fa] border border-[#d5dfeb] py-2">
              <div className="display text-2xl text-brand-dark tabular-nums">{n}</div><div className="text-[10px] uppercase tracking-wide text-tx2">{r}</div>
            </div>
          ))}
        </div>
      </div>

      {!d.eu && !d.admin && (
        <div className="card p-4 mt-3 text-sm text-tx flex gap-3">
          <Lock size={18} className="text-brand shrink-0 mt-0.5" />
          <div>Pra oferecer ou entrar num carro, abra uma vez o <b>seu link pessoal</b> (o que a organização mandou no seu WhatsApp). <Link to="/ficha" className="text-brand underline">Saiba mais</Link></div>
        </div>
      )}

      {(eu && !noCarro) || d.admin ? (
        oferecendo
          ? <div className="mt-3"><Oferta sem={d.sem_carona} admin={d.admin} fechar={(ok) => { setOferecendo(false); if (ok) carregar(); }} /></div>
          : <button className="btn btn-primary w-full mt-3" onClick={() => setOferecendo(true)}><Plus size={17} /> Vou de carro e tenho vaga</button>
      ) : null}

      <div className="mt-5 space-y-3">
        {d.caronas.map((c) => <Carro key={c.id} c={c} eu={eu} admin={d.admin} sem={d.sem_carona} recarregar={carregar} />)}
        {!d.caronas.length && <div className="card p-6 text-center text-sm text-tx2"><Car className="mx-auto mb-2 text-tx3" size={28} />Nenhum carro ainda. Quem vai de carro, abre a primeira vaga.</div>}
      </div>

      {d.sem_carona.length > 0 && (
        <>
          <h2 className="display text-base text-brand-dark mt-6 mb-2">Sem carona ainda ({d.sem_carona.length})</h2>
          <div className="card p-3 flex flex-wrap gap-2">
            {d.sem_carona.map((p) => (
              <div key={p.id} className="flex flex-col items-center w-14">
                <Avatar id={p.id} v={p.foto_v} nome={p.nome} tam={36} />
                <span className="mt-1 text-[10px] text-center text-tx2 truncate w-full">{p.nome.split(' ')[0]}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 text-[11px] text-tx3">Inclui quem vai por conta própria; aqui só aparece quem ainda não está em nenhum carro do app.</div>
        </>
      )}
    </Casca>
  );
}
