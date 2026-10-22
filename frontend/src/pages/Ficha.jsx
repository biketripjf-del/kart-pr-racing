import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Camera, Lock } from 'lucide-react';
import { api, getEu, setEu } from '../api.js';
import { AdminLinks, useAdmin } from '../components/AdminApp.jsx';
import { Casca, Avatar } from '../components/Marca.jsx';
import AjustarFoto from '../components/AjustarFoto.jsx';
import * as M from '../mascaras.js';

// ---------- /f/:token: o link pessoal. Guarda no celular e abre a ficha ----------
export function LinkPessoal() {
  const { token } = useParams();
  const nav = useNavigate();
  const [erro, setErro] = useState(false);
  useEffect(() => {
    setEu(token);
    api.get('/ficha/eu').then((r) => { toast.success(`Oi, ${r.data.nome_evento.split(' ')[0]}! Este celular agora é seu no app.`); nav('/ficha', { replace: true }); })
      .catch(() => { setEu(null); setErro(true); });
  }, [token]);
  return (
    <Casca sub="Minha ficha">
      {!erro
        ? <div className="text-center text-tx2 py-10">Abrindo sua ficha…</div>
        : <div className="card p-6 text-center text-tx">Esse link não vale mais (foi trocado ou está incompleto). Peça o seu de novo à organização.</div>}
    </Casca>
  );
}

// sem link pessoal neste celular: explica como chegar na ficha (a lista aberta de nomes saiu: ficha não é pública)
// o token do link fica no armazenamento de QUEM abriu o link (Safari, Chrome, navegador do WhatsApp). O app instalado
// na tela de início do iPhone tem armazenamento próprio e nasce sem ele (Emmanuel 19/10: "minha ficha" genérica depois
// de instalar). Colar o link aqui dentro resolve sem abrir a ficha pra quem não tem o link.

function SemLink() {
  const nav = useNavigate();
  const [texto, setTexto] = useState('');
  function abrir(e) {
    e.preventDefault();
    const t = M.tokenDoLink(texto);
    if (!t) return toast.error('Isso não parece o seu link. Ele termina em /f/ seguido de letras e números.');
    nav(`/f/${t}`);
  }
  return (
    <div className="card p-5 text-sm text-tx space-y-3">
      <div className="flex items-center gap-2 font-semibold text-base"><Lock size={17} className="text-brand" /> A ficha é pessoal</div>
      <p>Cada piloto recebe da organização um <b>link só dele</b>, pelo WhatsApp. Toque nele uma vez: o app abre a sua ficha e passa a reconhecer você neste celular (ficha, caronas, fotos).</p>
      <form onSubmit={abrir} className="space-y-2">
        <div className="font-semibold">Instalou o app e ele não te reconheceu?</div>
        <p className="text-tx2">Copie o seu link no WhatsApp (segure o dedo em cima dele → Copiar) e cole aqui:</p>
        <input className="input" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="https://kart-app-production.up.railway.app/f/…" autoCapitalize="off" autoCorrect="off" spellCheck={false} />
        <button type="submit" className="btn btn-primary w-full">Abrir minha ficha</button>
      </form>
      <p className="text-tx2">Não recebeu ou trocou de celular? Peça o seu link ao Brunner ou ao Emmanuel.</p>
    </div>
  );
}

const VAZIO = {
  nome: '', apelido: '', whatsapp: '', data_nascimento: '', peso_kg: '', altura_cm: '', cidade: '', instagram: '',
  emergencia_nome: '', emergencia_tel: '', tipo_sanguineo: '', camiseta: '', experiencia: '', empresa: '',
};

function Campo({ rot, children, dica }) {
  return (
    <label className="block">
      <span className="label">{rot}</span>
      {children}
      {dica && <span className="block mt-1 text-[11px] text-tx3">{dica}</span>}
    </label>
  );
}

// ---------- /ficha: a ficha de quem abriu o link pessoal neste celular ----------
export function FichaForm() {
  const nav = useNavigate();
  const admin = useAdmin();
  const [piloto, setPiloto] = useState(getEu() ? null : false);
  const [f, setF] = useState(VAZIO);
  const [foto, setFoto] = useState(null);
  const [ajustando, setAjustando] = useState(null); // arquivo escolhido, esperando o ajuste
  const [aceite, setAceite] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const arquivo = useRef(null);

  useEffect(() => {
    if (!getEu()) return;
    api.get('/ficha/eu').then(({ data }) => {
      setPiloto(data);
      const t = Object.fromEntries(Object.keys(VAZIO).map((k) => [k, data[k] == null ? '' : String(data[k])]));
      setF({
        ...t, nome: t.nome || data.nome_evento, whatsapp: M.telefone(t.whatsapp), emergencia_tel: M.telefone(t.emergencia_tel),
        data_nascimento: M.isoParaData(t.data_nascimento), peso_kg: M.peso(t.peso_kg), altura_cm: M.altura(t.altura_cm), instagram: M.instagram(t.instagram),
      });
      setAceite(!!data.tem_ficha);
    }).catch(() => { setEu(null); setPiloto(false); });
  }, []);

  // mascara = função de mascaras.js aplicada a cada tecla
  const set = (k, mascara) => (e) => { const v = mascara ? mascara(e.target.value) : e.target.value; setF((x) => ({ ...x, [k]: v })); };
  // escolheu o arquivo → abre o ajuste na moldura (22/10). Quem já aceitou a ficha salva a foto na hora (rota só da
  // foto); quem ainda não aceitou leva a foto junto com a ficha, no Salvar.
  function escolherFoto(e) {
    const a = e.target.files?.[0];
    e.target.value = '';
    if (a) setAjustando(a);
  }
  async function fotoAjustada(dataUrl) {
    setAjustando(null);
    setFoto(dataUrl);
    if (!piloto.tem_ficha) return;
    try {
      await api.post('/ficha/eu/foto', { foto: dataUrl });
      setPiloto((p) => ({ ...p, tem_foto: true }));
      toast.success('Foto salva!');
    } catch { toast.error('Não consegui salvar a foto. Ela vai junto quando você tocar em Salvar.'); }
  }

  async function enviar(e) {
    e.preventDefault();
    if (!aceite) return toast.error('Marque o aceite no fim da ficha.');
    if (!M.telefoneCompleto(f.whatsapp)) return toast.error('WhatsApp incompleto: DDD + número.');
    if (f.emergencia_tel && !M.telefoneCompleto(f.emergencia_tel)) return toast.error('Telefone de emergência incompleto: DDD + número.');
    const nasc = M.dataParaISO(f.data_nascimento);
    if (nasc === null) return toast.error('Data de nascimento inválida. Use DD/MM/AAAA.');
    if (f.peso_kg && !(Number(f.peso_kg.replace(',', '.')) >= 30 && Number(f.peso_kg.replace(',', '.')) <= 250)) return toast.error('Peso em kg, entre 30 e 250.');
    if (f.altura_cm && !(+f.altura_cm >= 120 && +f.altura_cm <= 230)) return toast.error('Altura em centímetros, entre 120 e 230 (ex.: 175).');
    setEnviando(true);
    const num = (v) => (v === '' ? null : Number(String(v).replace(',', '.')));
    try {
      await api.post('/ficha/eu', {
        ...f, data_nascimento: nasc, peso_kg: num(f.peso_kg), altura_cm: num(f.altura_cm), consentimento: true,
        ...(foto ? { foto } : {}),
      });
      toast.success('Ficha salva. Bora pra pista!');
      nav(`/piloto/${piloto.id}`);
    } catch (err) {
      const d = err.response?.data;
      // sem resposta do servidor = o pedido nem saiu (rede ou erro no próprio app): "confira os campos" mandaria o
      // piloto procurar erro no que ele digitou. Foi assim que o /ficha/${id} indefinido ficou 5 dias escondido (19/10).
      if (!err.response) { console.error(err); return toast.error('Não consegui enviar. Confira a internet e tente de novo; se repetir, avise a organização.'); }
      if (d?.erro === 'muitas_tentativas') return toast.error('Muitas tentativas seguidas. Espere uns minutos e salve de novo.');
      toast.error(d?.erro === 'link_invalido' ? 'Seu link pessoal não vale mais. Peça um novo à organização.' : d?.detalhe || 'Não consegui salvar. Confira os campos.');
    } finally { setEnviando(false); }
  }

  if (piloto === null) return <Casca sub="Minha ficha"><div className="text-center text-tx2 py-10">Carregando…</div></Casca>;
  if (piloto === false) return <Casca sub="Minha ficha">{admin && <AdminLinks />}<SemLink /></Casca>;

  return (
    <Casca sub="Minha ficha">
      {admin && <AdminLinks />}
      <form onSubmit={enviar} className="space-y-4">
        <div className="card p-5 flex flex-col items-center gap-3">
          {foto
            ? <img src={foto} alt="" className="w-28 h-28 rounded-full object-cover" />
            : <Avatar id={piloto.id} v={piloto.foto_v} nome={piloto.nome} tam={112} />}
          <input ref={arquivo} type="file" accept="image/*" className="hidden" onChange={escolherFoto} />
          {ajustando && <AjustarFoto arquivo={ajustando} onPronto={fotoAjustada}
            onCancelar={(motivo) => { setAjustando(null); if (motivo === 'ilegivel') toast.error('Não consegui ler essa imagem. Tente outra.'); }} />}
          <button type="button" className="btn btn-ghost" onClick={() => arquivo.current?.click()}>
            <Camera size={16} /> {piloto.tem_foto || foto ? 'Trocar foto' : 'Colocar foto'}
          </button>
          <div className="text-[11px] text-tx3 text-center">Foto de rosto, de frente. Aparece no quadro, no sorteio e no ranking.</div>
        </div>

        <div className="card p-5 space-y-4">
          <div className="font-semibold">Quem é você</div>
          <Campo rot="Nome completo *"><input className="input" value={f.nome} onChange={set('nome')} required minLength={3} /></Campo>
          <Campo rot="Apelido" dica="Aparece na sua página de piloto."><input className="input" value={f.apelido} onChange={set('apelido')} maxLength={40} /></Campo>
          <Campo rot="WhatsApp *"><input className="input" type="tel" inputMode="tel" autoComplete="tel-national" placeholder="(32) 99999-9999" value={f.whatsapp} onChange={set('whatsapp', M.telefone)} required minLength={14} /></Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo rot="Nascimento"><input className="input" inputMode="numeric" autoComplete="bday" placeholder="DD/MM/AAAA" value={f.data_nascimento} onChange={set('data_nascimento', M.data)} /></Campo>
            <Campo rot="Cidade"><input className="input" autoComplete="address-level2" placeholder="Juiz de Fora" value={f.cidade} onChange={set('cidade')} /></Campo>
          </div>
          <Campo rot="Instagram" dica="Pro videomaker marcar você."><div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-tx3">@</span>
            <input className="input pl-7" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="seuperfil" value={f.instagram} onChange={set('instagram', M.instagram)} />
          </div></Campo>
          <Campo rot="Escritório / empresa"><input className="input" value={f.empresa} onChange={set('empresa')} /></Campo>
        </div>

        <div className="card p-5 space-y-4">
          <div className="font-semibold">Pista</div>
          <div className="grid grid-cols-2 gap-3">
            <Campo rot="Peso" dica="Com a roupa de correr."><div className="relative">
              <input className="input pr-9" inputMode="decimal" placeholder="80,5" value={f.peso_kg} onChange={set('peso_kg', M.peso)} />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-tx3 text-sm">kg</span>
            </div></Campo>
            <Campo rot="Altura" dica="Em centímetros."><div className="relative">
              <input className="input pr-9" inputMode="numeric" placeholder="175" value={f.altura_cm} onChange={set('altura_cm', M.altura)} />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-tx3 text-sm">cm</span>
            </div></Campo>
          </div>
          <Campo rot="Experiência com kart">
            <select className="input" value={f.experiencia} onChange={set('experiencia')}>
              <option value="">—</option><option value="nunca">Nunca andei</option><option value="casual">Já andei algumas vezes</option><option value="frequente">Ando com frequência</option>
            </select>
          </Campo>
          <Campo rot="Tamanho de camiseta" dica="Se tiver kit, já sabemos o seu.">
            <select className="input" value={f.camiseta} onChange={set('camiseta')}>
              <option value="">—</option>{['PP', 'P', 'M', 'G', 'GG', 'XG'].map((t) => <option key={t}>{t}</option>)}
            </select>
          </Campo>
        </div>

        <div className="card p-5 space-y-4">
          <div className="font-semibold">Emergência</div>
          <Campo rot="Contato de emergência (nome)"><input className="input" value={f.emergencia_nome} onChange={set('emergencia_nome')} /></Campo>
          <Campo rot="Telefone do contato"><input className="input" type="tel" inputMode="tel" placeholder="(32) 99999-9999" value={f.emergencia_tel} onChange={set('emergencia_tel', M.telefone)} /></Campo>
          <Campo rot="Tipo sanguíneo">
            <select className="input" value={f.tipo_sanguineo} onChange={set('tipo_sanguineo')}>
              <option value="">—</option>{['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'não sei'].map((t) => <option key={t}>{t}</option>)}
            </select>
          </Campo>
        </div>

        <label className="card p-4 flex gap-3 items-start text-sm text-tx cursor-pointer">
          <input type="checkbox" className="mt-1" checked={aceite} onChange={(e) => setAceite(e.target.checked)} />
          <span>Autorizo a organização a guardar esses dados para o campeonato e a mostrar no app minha foto, meu nome e meus resultados. Telefone, nascimento, peso, altura e dados de emergência ficam só com a organização.</span>
        </label>
        <button className="btn btn-primary w-full" disabled={enviando}>{enviando ? 'Salvando…' : 'Salvar ficha'}</button>
      </form>
      <button className="mt-4 w-full text-xs text-tx3 underline" onClick={() => { setEu(null); setPiloto(false); }}>Não é você? Desconectar este celular</button>
    </Casca>
  );
}
