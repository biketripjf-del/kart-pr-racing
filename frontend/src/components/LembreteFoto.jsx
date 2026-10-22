// Aviso pra quem ainda não tem foto (Brunner 22/10/2026: "deixa a opção de mudar a foto pra quem ainda nao mudou logo
// qdo a pessoa loga"). Aparece ao abrir o app com o link pessoal guardado; escolhe, ajusta na moldura e salva na hora
// (rota só da foto). "Agora não" adia 12 h neste celular. Fica fora da ficha (ela já tem o botão no topo), do link
// pessoal, do sorteio ao vivo e da área do organizador.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Camera, Sparkles } from 'lucide-react';
import { api, getEu } from '../api.js';
import { Avatar } from './Marca.jsx';
import AjustarFoto from './AjustarFoto.jsx';
import FotoPilotoIA, { podeFotoIA, FOCO_RETRATO_IA } from './FotoPilotoIA.jsx';

const ADIADO_KEY = 'prcup_foto_adiada';
const ADIA_MS = 12 * 3600 * 1000;
const FORA = (p) => p === '/ficha' || p.startsWith('/f/') || p === '/sorteio' || p.startsWith('/admin');
const adiado = () => { try { return Date.now() - Number(localStorage.getItem(ADIADO_KEY) || 0) < ADIA_MS; } catch { return false; } };
const adiar = () => { try { localStorage.setItem(ADIADO_KEY, String(Date.now())); } catch { /* sem storage */ } };

export default function LembreteFoto() {
  const { pathname } = useLocation();
  const nav = useNavigate();
  const [eu, setEu] = useState(null);
  const [ajustando, setAjustando] = useState(null);
  const [doIA, setDoIA] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [ia, setIa] = useState(false);
  const arquivo = useRef(null);
  const fora = FORA(pathname);

  useEffect(() => {
    if (fora || eu || !getEu() || adiado()) return;
    api.get('/ficha/eu').then(({ data }) => { if (!data.tem_foto) setEu(data); }).catch(() => {});
  }, [fora]);

  if (!eu || fora) return null;
  const fechar = () => { adiar(); setEu(null); };

  async function salvar(dataUrl) {
    setAjustando(null);
    setSalvando(true);
    try {
      await api.post('/ficha/eu/foto', { foto: dataUrl });
      toast.success('Foto salva! Já aparece no ranking e nas baterias.');
      setEu(null);
    } catch (err) {
      if (err.response?.data?.erro === 'preencha_a_ficha') { setEu(null); nav('/ficha'); return toast('Preencha a ficha primeiro: a foto vai junto com ela.'); }
      toast.error('Não consegui salvar a foto. Tente de novo.');
    } finally { setSalvando(false); }
  }

  return createPortal(
    <div className="fixed inset-0 z-[55] bg-black/60 flex items-end sm:items-center justify-center p-4">
      <div className="card p-5 w-full max-w-sm flex flex-col items-center gap-3 text-center">
        <Avatar id={eu.id} nome={eu.nome || eu.nome_evento} tam={72} />
        <div className="font-semibold text-lg">Coloque sua foto de piloto</div>
        <div className="text-sm text-tx2">Você ainda está só com as iniciais. A foto aparece no ranking, nas baterias, no sorteio e nas caronas.</div>
        <input ref={arquivo} type="file" accept="image/*" className="hidden"
          onChange={(e) => { const a = e.target.files?.[0]; e.target.value = ''; if (a) { setDoIA(false); setAjustando(a); } }} />
        <button type="button" className="btn btn-primary w-full" disabled={salvando} onClick={() => arquivo.current?.click()}>
          <Camera size={16} /> {salvando ? 'Salvando…' : 'Escolher foto'}
        </button>
        {podeFotoIA(eu) && (
          <button type="button" className="btn btn-gold w-full" disabled={salvando} onClick={() => setIa(true)}>
            <Sparkles size={16} /> {eu.foto_ia.usada ? 'Ver minha foto de piloto (IA)' : 'Criar foto de piloto com IA'}
          </button>
        )}
        <button type="button" className="btn btn-ghost w-full" onClick={fechar}>Agora não</button>
      </div>
      {ia && <FotoPilotoIA eu={eu} onFechar={() => setIa(false)} onUsar={(blob) => { setIa(false); setDoIA(true); setAjustando(blob); }} />}
      {ajustando && <AjustarFoto arquivo={ajustando} foco={doIA ? FOCO_RETRATO_IA : undefined} onPronto={salvar}
        onCancelar={(motivo) => { setAjustando(null); if (motivo === 'ilegivel') toast.error('Não consegui ler essa imagem. Tente outra.'); }} />}
    </div>,
    document.body
  );
}
