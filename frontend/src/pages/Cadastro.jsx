import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, money } from '../api.js';
import { Casca } from '../components/Marca.jsx';

const EXPERIENCIA = [
  { v: 'nunca', l: 'Nunca corri' },
  { v: 'casual', l: 'Já andei algumas vezes' },
  { v: 'frequente', l: 'Corro com frequência' },
];

export default function Cadastro() {
  const [etapa, setEtapa] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [pronto, setPronto] = useState(false);
  const [form, setForm] = useState({
    nome: '', apelido: '', whatsapp: '', data_nascimento: '', peso_kg: '',
    experiencia: '', empresa: '', indicado_por: '', consentimento: false,
  });

  useEffect(() => {
    api.get('/etapas/proxima').then((r) => setEtapa(r.data)).catch(() => {});
  }, []);

  const set = (k) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [k]: val }));
  };

  async function enviar(e) {
    e.preventDefault();
    if (!form.nome.trim()) return toast.error('Preencha seu nome.');
    if (!form.consentimento) return toast.error('É preciso aceitar o uso dos dados.');
    setEnviando(true);
    try {
      await api.post('/pilotos', {
        ...form,
        peso_kg: form.peso_kg ? Number(form.peso_kg) : null,
        data_nascimento: form.data_nascimento || null,
        etapa_id: etapa?.id || null,
      });
      setPronto(true);
    } catch (err) {
      toast.error(err.response?.data?.detalhe || 'Não deu pra enviar. Tenta de novo.');
    } finally {
      setEnviando(false);
    }
  }

  if (pronto) {
    return (
      <Casca sub="Inscrição confirmada">
        <div className="card p-8 text-center">
          <CheckCircle2 className="mx-auto text-emerald-400" size={56} />
          <h2 className="text-2xl font-bold mt-4">Você está dentro! 🏁</h2>
          <p className="text-slate-300 mt-2">
            Inscrição confirmada{etapa ? ` para a ${etapa.nome}` : ''}. Nos vemos na pista.
          </p>
          <Link to="/ranking" className="btn btn-ghost mt-6 inline-flex">
            <Trophy size={18} /> Ver o ranking
          </Link>
        </div>
      </Casca>
    );
  }

  return (
    <Casca sub="Inscrição de piloto">
      {etapa && (
        <div className="card p-4 mb-5 flex items-center gap-3">
          <div className="checkers w-10 h-10 rounded-lg shrink-0" />
          <div>
            <div className="font-semibold">{etapa.nome}</div>
            <div className="text-sm text-slate-400">
              {new Date(etapa.data + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
              {etapa.kartodromo ? ` · ${etapa.kartodromo}` : ''} · {money(etapa.valor_centavos)} (2 baterias)
            </div>
          </div>
        </div>
      )}

      <form onSubmit={enviar} className="card p-5 space-y-4">
        <Campo label="Nome completo *">
          <input className="input" value={form.nome} onChange={set('nome')} placeholder="Seu nome" />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Apelido de piloto">
            <input className="input" value={form.apelido} onChange={set('apelido')} placeholder="Como quer no ranking" />
          </Campo>
          <Campo label="WhatsApp">
            <input className="input" value={form.whatsapp} onChange={set('whatsapp')} placeholder="(00) 00000-0000" inputMode="tel" />
          </Campo>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Data de nascimento">
            <input type="date" className="input" value={form.data_nascimento} onChange={set('data_nascimento')} />
          </Campo>
          <Campo label="Peso (kg)">
            <input type="number" step="0.5" className="input" value={form.peso_kg} onChange={set('peso_kg')} placeholder="usado no handicap" inputMode="decimal" />
          </Campo>
        </div>
        <Campo label="Experiência no kart">
          <div className="grid grid-cols-3 gap-2">
            {EXPERIENCIA.map((o) => (
              <button type="button" key={o.v} onClick={() => setForm((f) => ({ ...f, experiencia: o.v }))}
                className={`btn text-sm ${form.experiencia === o.v ? 'btn-primary' : 'btn-ghost'}`}>
                {o.l}
              </button>
            ))}
          </div>
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Empresa / escritório">
            <input className="input" value={form.empresa} onChange={set('empresa')} placeholder="Onde trabalha" />
          </Campo>
          <Campo label="Indicado por">
            <input className="input" value={form.indicado_por} onChange={set('indicado_por')} placeholder="Quem te chamou" />
          </Campo>
        </div>

        <label className="flex items-start gap-3 text-sm text-slate-300 cursor-pointer pt-1">
          <input type="checkbox" checked={form.consentimento} onChange={set('consentimento')} className="mt-1 w-5 h-5 accent-[color:var(--color-brand)]" />
          <span>Autorizo o uso dos meus dados e imagens para a organização do campeonato, ranking e divulgação da P&amp;R Racing Cup.</span>
        </label>

        <button className="btn btn-primary w-full text-lg" disabled={enviando}>
          {enviando ? 'Enviando…' : 'Confirmar inscrição 🏁'}
        </button>
      </form>
    </Casca>
  );
}

function Campo({ label, children }) {
  return (
    <div>
      <span className="label">{label}</span>
      {children}
    </div>
  );
}
