import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Camera, CheckCircle2, Search, Lock } from 'lucide-react';
import { api } from '../api.js';
import { Casca, Avatar } from '../components/Marca.jsx';
import * as M from '../mascaras.js';

// ---------- /ficha: o piloto acha o próprio nome ----------
export function FichaLista() {
  const [dados, setDados] = useState(null);
  const [busca, setBusca] = useState('');
  useEffect(() => { api.get('/ficha/lista').then((r) => setDados(r.data)).catch(() => setDados({ pilotos: [] })); }, []);
  const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const lista = (dados?.pilotos || []).filter((p) => norm(p.nome).includes(norm(busca)));
  const feitas = (dados?.pilotos || []).filter((p) => p.tem_ficha).length;
  return (
    <Casca sub="Ficha do piloto">
      <div className="card p-4 text-sm text-tx">
        Toque no seu nome e preencha a ficha: foto, contato, peso, altura e um contato de emergência.
        Telefone, peso, nascimento e saúde ficam só com a organização; no app aparecem só a foto e o nome.
      </div>
      <div className="mt-4 relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-tx3" />
        <input className="input pl-9" placeholder="Procure seu nome" value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>
      {dados && <div className="mt-2 text-xs text-tx2">{feitas} de {dados.pilotos.length} fichas preenchidas</div>}
      <div className="card mt-3 overflow-hidden">
        {!dados && <div className="p-6 text-center text-tx2">Carregando…</div>}
        {lista.map((p) => (
          <Link key={p.id} to={`/ficha/${p.id}`} className="flex items-center gap-3 px-4 py-2.5 border-b border-[#e3e9f1] last:border-0 hover:bg-[#eef3f9]">
            <Avatar id={p.id} v={p.foto_v} nome={p.nome} tam={36} />
            <div className="flex-1 font-medium">{p.nome}</div>
            {p.tem_ficha
              ? <span className="flex items-center gap-1 text-[11px] text-emerald-700"><CheckCircle2 size={14} /> preenchida</span>
              : <span className="text-[11px] text-amber-700">falta preencher</span>}
          </Link>
        ))}
        {dados && !lista.length && <div className="p-6 text-center text-sm text-tx2">Nenhum nome encontrado. Se o seu não está na lista, fale com a organização.</div>}
      </div>
    </Casca>
  );
}

// reduz a foto no próprio celular (512 px, jpeg) — sobe ~60 KB em vez de 4 MB
function reduzirFoto(arquivo) {
  return new Promise((ok, falha) => {
    const img = new Image();
    const url = URL.createObjectURL(arquivo);
    img.onload = () => {
      const lado = 512;
      const menor = Math.min(img.width, img.height);
      const c = document.createElement('canvas');
      c.width = lado; c.height = lado;
      // recorte quadrado no centro
      c.getContext('2d').drawImage(img, (img.width - menor) / 2, (img.height - menor) / 2, menor, menor, 0, 0, lado, lado);
      URL.revokeObjectURL(url);
      ok(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); falha(new Error('imagem ilegível')); };
    img.src = url;
  });
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

// ---------- /ficha/:id: o formulário ----------
export function FichaForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const [piloto, setPiloto] = useState(null);
  const [f, setF] = useState(VAZIO);
  const [foto, setFoto] = useState(null);
  const [confirmacao, setConfirmacao] = useState('');
  const [aceite, setAceite] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const arquivo = useRef(null);

  useEffect(() => {
    api.get(`/ficha/${id}`).then((r) => {
      setPiloto(r.data);
      setF((x) => ({ ...x, nome: r.data.nome || '', apelido: r.data.apelido || '' }));
    }).catch(() => setPiloto(false));
  }, [id]);

  // mascara = função de mascaras.js aplicada a cada tecla
  const set = (k, mascara) => (e) => { const v = mascara ? mascara(e.target.value) : e.target.value; setF((x) => ({ ...x, [k]: v })); };
  const [aberta, setAberta] = useState(false);

  async function abrir() {
    try {
      const { data } = await api.post(`/ficha/${id}/abrir`, { confirmacao });
      const t = Object.fromEntries(Object.keys(VAZIO).map((k) => [k, data[k] == null ? '' : String(data[k])]));
      setF({
        ...t, whatsapp: M.telefone(t.whatsapp), emergencia_tel: M.telefone(t.emergencia_tel), data_nascimento: M.isoParaData(t.data_nascimento),
        peso_kg: M.peso(t.peso_kg), altura_cm: M.altura(t.altura_cm), instagram: M.instagram(t.instagram),
      });
      setAberta(true);
      toast.success('Ficha aberta. Altere o que quiser e salve.');
    } catch { toast.error('WhatsApp não confere com o da ficha.'); }
  }

  async function escolherFoto(e) {
    const a = e.target.files?.[0];
    if (!a) return;
    try { setFoto(await reduzirFoto(a)); } catch { toast.error('Não consegui ler essa imagem. Tente outra.'); }
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
      await api.post(`/ficha/${id}`, {
        ...f, data_nascimento: nasc, peso_kg: num(f.peso_kg), altura_cm: num(f.altura_cm), consentimento: true,
        ...(foto ? { foto } : {}), ...(piloto?.tem_ficha ? { confirmacao } : {}),
      });
      toast.success('Ficha salva. Bora pra pista!');
      nav(`/piloto/${id}`);
    } catch (err) {
      const d = err.response?.data;
      toast.error(d?.erro === 'confirme_o_whatsapp' ? 'WhatsApp não confere com o da ficha.' : d?.detalhe || 'Não consegui salvar. Confira os campos.');
    } finally { setEnviando(false); }
  }

  if (piloto === null) return <Casca sub="Ficha do piloto"><div className="text-center text-tx2 py-10">Carregando…</div></Casca>;
  if (piloto === false) return <Casca sub="Ficha do piloto"><div className="card p-6 text-center text-tx">Piloto não encontrado. <Link to="/ficha" className="text-[color:var(--color-brand)]">Voltar à lista</Link></div></Casca>;

  return (
    <Casca sub="Ficha do piloto">
      <form onSubmit={enviar} className="space-y-4">
        <div className="card p-5 flex flex-col items-center gap-3">
          {foto
            ? <img src={foto} alt="" className="w-28 h-28 rounded-full object-cover" />
            : <Avatar id={piloto.id} v={piloto.foto_v} nome={piloto.nome} tam={112} />}
          <input ref={arquivo} type="file" accept="image/*" className="hidden" onChange={escolherFoto} />
          <button type="button" className="btn btn-ghost" onClick={() => arquivo.current?.click()}>
            <Camera size={16} /> {piloto.tem_foto || foto ? 'Trocar foto' : 'Colocar foto'}
          </button>
          <div className="text-[11px] text-tx3 text-center">Foto de rosto, de frente. Aparece no quadro, no sorteio e no ranking.</div>
        </div>

        {piloto.tem_ficha && (
          <div className="card p-4 border-amber-500/40">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-700"><Lock size={15} /> Essa ficha já foi preenchida</div>
            <div className="mt-1 text-xs text-tx2">Para alterar, digite o WhatsApp que está cadastrado nela.</div>
            <div className="mt-3 flex gap-2">
              <input className="input" inputMode="tel" placeholder="(32) 99999-9999" value={confirmacao} onChange={(e) => setConfirmacao(M.telefone(e.target.value))} required />
              <button type="button" className="btn btn-ghost shrink-0" onClick={abrir}>{aberta ? 'Aberta' : 'Abrir'}</button>
            </div>
          </div>
        )}

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
    </Casca>
  );
}
