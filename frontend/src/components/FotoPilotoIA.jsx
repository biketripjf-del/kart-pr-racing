// Foto de piloto por IA (Brunner 22/10/2026: "o píloto joga a foto dele e transformamos nele vestido de piloto" ·
// "deixa a pessoa escolher a cor antes" · "maximo de 1 para cada"). Escolhe a cor do macacão → manda uma selfie →
// confirma (é 1 vez só) → a IA devolve o retrato → "Usar como minha foto" passa pelo ajuste na moldura e salva.
// O retrato fica guardado no servidor: quem fechar antes de usar volta aqui e ele reaparece.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { Camera, Sparkles, X } from 'lucide-react';
import { api } from '../api.js';

// amostra de cada cor (o nome e a ordem vêm do servidor)
const AMOSTRA = {
  azul: ['#055391', '#ffffff'], laranja: ['#f26a1b', '#111111'], vermelho: ['#d62828', '#111111'],
  preto: ['#111111', '#ffffff'], verde: ['#1f9d55', '#111111'], amarelo: ['#f5c518', '#111111'],
};
const LADO_SELFIE = 1024;
// o retrato vem da cintura pra cima: na moldura do perfil abre aproximado no rosto (o piloto ainda ajusta)
export const FOCO_RETRATO_IA = { z: 1.8, y: 0.33 };

// selfie de celular tem 4–12 MB: reduz pra 1024 px em jpeg antes de subir (o servidor aceita até ~900 KB)
function reduzir(arquivo) {
  return new Promise((ok, falha) => {
    const url = URL.createObjectURL(arquivo);
    const i = new Image();
    i.onload = () => {
      const k = Math.min(1, LADO_SELFIE / Math.max(i.width, i.height));
      const c = document.createElement('canvas');
      c.width = Math.round(i.width * k); c.height = Math.round(i.height * k);
      c.getContext('2d').drawImage(i, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      ok(c.toDataURL('image/jpeg', 0.85));
    };
    i.onerror = () => { URL.revokeObjectURL(url); falha(new Error('ilegivel')); };
    i.src = url;
  });
}

export function podeFotoIA(eu) {
  const ia = eu?.foto_ia;
  return !!(ia?.ativa && eu.tem_ficha && (!ia.usada || ia.tem_resultado));
}

export default function FotoPilotoIA({ eu, onUsar, onFechar }) {
  const { cores, tem_resultado } = eu.foto_ia;
  const [etapa, setEtapa] = useState(tem_resultado ? 'carregando' : 'cor'); // cor → confirmar → gerando → pronto
  const [cor, setCor] = useState(cores[0].id);
  const [selfie, setSelfie] = useState(null);
  const [retrato, setRetrato] = useState(null);
  const arquivo = useRef(null);

  const buscarGuardado = () => api.get('/ficha/eu/foto-ia')
    .then(({ data }) => { setRetrato(data.imagem); setEtapa('pronto'); })
    .catch(() => { toast.error('Não consegui abrir sua foto de piloto. Tente de novo.'); onFechar(); });

  useEffect(() => { if (tem_resultado) buscarGuardado(); }, []);
  useEffect(() => {
    const esc = (e) => { if (e.key === 'Escape' && etapa !== 'gerando') onFechar(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [etapa]);

  async function escolheuSelfie(e) {
    const a = e.target.files?.[0];
    e.target.value = '';
    if (!a) return;
    try { setSelfie(await reduzir(a)); setEtapa('confirmar'); } catch { toast.error('Não consegui ler essa imagem. Tente outra.'); }
  }

  async function gerar() {
    setEtapa('gerando');
    try {
      const { data } = await api.post('/ficha/eu/foto-ia', { selfie, cor }, { timeout: 180_000 });
      setRetrato(data.imagem);
      setEtapa('pronto');
    } catch (err) {
      const erro = err.response?.data?.erro;
      if (erro === 'ja_gerou') return buscarGuardado();
      setEtapa('confirmar');
      if (erro === 'ia_recusou') return toast.error('A IA não conseguiu usar essa foto. Mande uma selfie de rosto, de frente, com boa luz. Sua vez continua valendo.');
      if (erro === 'muitas_tentativas') return toast.error('Muitas tentativas seguidas. Espere uns minutos.');
      toast.error('A IA não respondeu agora. Sua vez continua valendo: tente de novo em instantes.');
    }
  }

  async function usar() {
    onUsar(await (await fetch(retrato)).blob());
  }

  const corAtual = cores.find((c) => c.id === cor);
  return createPortal(
    <div className="fixed inset-0 z-[65] bg-black/70 flex items-end sm:items-center justify-center p-4" role="dialog" aria-label="Foto de piloto com IA">
      <div className="card p-5 w-full max-w-sm flex flex-col gap-4 relative max-h-[92vh] overflow-y-auto">
        {etapa !== 'gerando' && (
          <button type="button" className="absolute top-3 right-3 text-tx3" onClick={onFechar} aria-label="Fechar"><X size={20} /></button>
        )}
        <div className="flex items-center gap-2 font-semibold text-lg pr-6"><Sparkles size={18} className="text-[color:var(--color-gold)] shrink-0" /> Foto de piloto com IA</div>

        {etapa === 'carregando' && <div className="text-center text-tx2 py-8">Abrindo sua foto…</div>}

        {etapa === 'cor' && (<>
          <div className="text-sm text-tx2">Mande uma selfie e a IA te veste de piloto, com macacão na cor que você escolher. <b>Cada piloto tem 1 foto.</b></div>
          <div>
            <div className="label">1. Cor do macacão</div>
            <div className="grid grid-cols-3 gap-2">
              {cores.map((c) => {
                const [a, b] = AMOSTRA[c.id] || ['#999', '#fff'];
                return (
                  <button key={c.id} type="button" onClick={() => setCor(c.id)} aria-pressed={cor === c.id}
                    className={`rounded-xl border-2 p-2 flex flex-col items-center gap-1 text-xs min-w-0 ${cor === c.id ? 'border-[color:var(--color-brand)] bg-[#eef4fb]' : 'border-[#cfdbea] bg-white'}`}>
                    <span className="w-9 h-9 rounded-full border border-black/10 shrink-0" style={{ background: `linear-gradient(135deg, ${a} 0 58%, ${b} 58% 100%)` }} />
                    <span className="truncate max-w-full">{c.nome}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <div className="label">2. Sua selfie</div>
            <div className="text-[12px] text-tx3 mb-2">Rosto de frente, sem óculos escuros, com boa luz. Só você na foto.</div>
            <input ref={arquivo} type="file" accept="image/*" className="hidden" onChange={escolheuSelfie} />
            <button type="button" className="btn btn-primary w-full" onClick={() => arquivo.current?.click()}><Camera size={16} /> Escolher selfie</button>
          </div>
        </>)}

        {etapa === 'confirmar' && (<>
          <div className="flex items-center gap-3">
            <img src={selfie} alt="Sua selfie" className="w-24 h-24 rounded-xl object-cover shrink-0" />
            <div className="text-sm text-tx2 min-w-0">Macacão <b className="text-tx">{corAtual?.nome}</b>.<br />A IA leva uns 30 segundos.</div>
          </div>
          <div className="text-[12px] text-tx3">É <b>1 foto por piloto</b>: confira a selfie e a cor antes de gerar.</div>
          <div className="text-[11px] text-tx3">Ao gerar, sua selfie vai para a IA do Google só pra criar esta foto. O app guarda apenas o resultado.</div>
          <button type="button" className="btn btn-primary w-full" onClick={gerar}><Sparkles size={16} /> Gerar minha foto de piloto</button>
          <button type="button" className="btn btn-ghost w-full" onClick={() => setEtapa('cor')}>Trocar cor ou selfie</button>
        </>)}

        {etapa === 'gerando' && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <div className="w-16 h-16 rounded-full border-4 border-dashed border-[color:var(--color-gold)] animate-spin" />
            <div className="font-medium">Vestindo o macacão…</div>
            <div className="text-sm text-tx2">Leva uns 30 segundos. Não feche o app.</div>
          </div>
        )}

        {etapa === 'pronto' && retrato && (<>
          <img src={retrato} alt="Sua foto de piloto" className="w-full aspect-square rounded-xl object-cover bg-[#e8eff7]" />
          <button type="button" className="btn btn-primary w-full" onClick={usar}>Usar como minha foto</button>
          <div className="text-[12px] text-tx3 text-center">Ela fica guardada aqui: se não quiser usar agora, volte depois.</div>
        </>)}
      </div>
    </div>,
    document.body
  );
}
