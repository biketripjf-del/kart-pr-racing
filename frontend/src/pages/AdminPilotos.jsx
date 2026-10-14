import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Users, Flag, LogOut, Plus } from 'lucide-react';
import { api, setToken, money } from '../api.js';
import { Casca, Avatar } from '../components/Marca.jsx';
import { AdminMural, AdminSorteio } from '../components/AdminApp.jsx';

export default function AdminPilotos() {
  const nav = useNavigate();
  const [pilotos, setPilotos] = useState([]);
  const [etapas, setEtapas] = useState([]);
  const [novaEtapa, setNovaEtapa] = useState(false);
  const [ne, setNe] = useState({ numero: '', nome: '', data: '', kartodromo: '', cidade: '', valor: '180' });

  async function carregar() {
    try {
      const [p, e] = await Promise.all([api.get('/pilotos'), api.get('/etapas')]);
      setPilotos(p.data);
      setEtapas(e.data);
    } catch {
      toast.error('Sessão expirada.');
      nav('/admin/login');
    }
  }
  useEffect(() => { carregar(); }, []);

  function sair() { setToken(null); nav('/admin/login'); }

  async function criarEtapa(ev) {
    ev.preventDefault();
    try {
      await api.post('/etapas', {
        numero: Number(ne.numero), nome: ne.nome, data: ne.data,
        kartodromo: ne.kartodromo, cidade: ne.cidade,
        valor_centavos: Math.round(Number(ne.valor) * 100),
      });
      setNovaEtapa(false);
      setNe({ numero: '', nome: '', data: '', kartodromo: '', cidade: '', valor: '180' });
      carregar();
      toast.success('Etapa criada.');
    } catch {
      toast.error('Não deu pra criar a etapa.');
    }
  }

  return (
    <Casca sub="Painel do organizador">
      <AdminSorteio />
      <AdminMural />
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2"><Flag size={18} /> Etapas</h2>
        <button onClick={() => setNovaEtapa((v) => !v)} className="btn btn-ghost text-sm"><Plus size={16} /> Nova etapa</button>
      </div>

      {novaEtapa && (
        <form onSubmit={criarEtapa} className="card p-4 mb-4 grid grid-cols-2 gap-3">
          <input className="input" placeholder="Nº" value={ne.numero} onChange={(e) => setNe({ ...ne, numero: e.target.value })} />
          <input className="input" placeholder="Nome (ex: Etapa 2)" value={ne.nome} onChange={(e) => setNe({ ...ne, nome: e.target.value })} />
          <input type="date" className="input" value={ne.data} onChange={(e) => setNe({ ...ne, data: e.target.value })} />
          <input className="input" placeholder="Valor R$" value={ne.valor} onChange={(e) => setNe({ ...ne, valor: e.target.value })} />
          <input className="input col-span-2" placeholder="Kartódromo" value={ne.kartodromo} onChange={(e) => setNe({ ...ne, kartodromo: e.target.value })} />
          <input className="input col-span-2" placeholder="Cidade" value={ne.cidade} onChange={(e) => setNe({ ...ne, cidade: e.target.value })} />
          <button className="btn btn-primary col-span-2">Criar etapa</button>
        </form>
      )}

      <div className="space-y-2 mb-8">
        {etapas.map((e) => (
          <Link key={e.id} to={`/admin/etapa/${e.id}`} className="card px-4 py-3 flex items-center justify-between hover:brightness-110">
            <div>
              <div className="font-semibold">{e.nome}</div>
              <div className="text-xs text-tx2">
                {new Date(e.data + 'T12:00:00').toLocaleDateString('pt-BR')} · {money(e.valor_centavos)}
                {' · '}<span className={e.status === 'realizada' ? 'text-emerald-700' : 'text-amber-700'}>{e.status}</span>
              </div>
            </div>
            <span className="text-[color:var(--color-brand)] text-sm">gerir →</span>
          </Link>
        ))}
        {etapas.length === 0 && <div className="text-tx2 text-sm">Nenhuma etapa ainda.</div>}
      </div>

      <h2 className="text-lg font-semibold flex items-center gap-2 mb-3"><Users size={18} /> Pilotos ({pilotos.length}) · fichas preenchidas: {pilotos.filter((p) => p.ficha_em).length}</h2>
      <div className="card overflow-hidden">
        {pilotos.map((p) => (
          <div key={p.id} className="px-4 py-3 border-b border-[#e3e9f1] last:border-0 flex gap-3">
            <Avatar id={p.id} v={p.tem_foto && p.foto_em ? new Date(p.foto_em).getTime() : null} nome={p.nome} tam={36} />
            <div className="flex-1 min-w-0">
              <div className="flex justify-between">
                <span className="font-semibold">{p.nome} {p.apelido && <span className="text-tx2 font-normal">"{p.apelido}"</span>}</span>
                <span className={`text-[11px] ${p.ficha_em ? 'text-emerald-700' : 'text-amber-700'}`}>{p.ficha_em ? 'ficha ok' : 'sem ficha'}</span>
              </div>
              <div className="text-xs text-tx3 flex gap-3 flex-wrap mt-0.5">
                {p.whatsapp && <span>{p.whatsapp}</span>}
                {p.data_nascimento && <span>nasc. {new Date(p.data_nascimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</span>}
                {p.peso_kg && <span>{p.peso_kg} kg</span>}
                {p.altura_cm && <span>{p.altura_cm} cm</span>}
                {p.experiencia && <span>{p.experiencia}</span>}
                {p.camiseta && <span>camiseta {p.camiseta}</span>}
                {p.empresa && <span>· {p.empresa}</span>}
              </div>
              {(p.emergencia_nome || p.tipo_sanguineo) && (
                <div className="text-xs text-tx3 mt-0.5">emergência: {p.emergencia_nome || '—'} {p.emergencia_tel || ''}{p.tipo_sanguineo ? ` · sangue ${p.tipo_sanguineo}` : ''}</div>
              )}
            </div>
          </div>
        ))}
        {pilotos.length === 0 && <div className="px-4 py-6 text-tx2 text-sm">Ninguém inscrito ainda.</div>}
      </div>

      <button onClick={sair} className="btn btn-ghost text-sm mt-6 mx-auto flex"><LogOut size={16} /> Sair</button>
    </Casca>
  );
}
