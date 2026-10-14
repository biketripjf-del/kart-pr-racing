import { useEffect, useState } from 'react';
import { Download, Share, X } from 'lucide-react';

// "Instalar o app": Android/Chrome oferece o botão nativo; no iPhone só existe o caminho Compartilhar → Adicionar à Tela de Início.
let pedido = null;
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); pedido = e; });
}
const instalado = () => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
const iPhone = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const chave = 'prcup_instalar_fechado';

export function InstalarApp({ compacto }) {
  const [, setTick] = useState(0);
  const [fechado, setFechado] = useState(() => { try { return compacto && localStorage.getItem(chave) === '1'; } catch { return false; } });
  const [passo, setPasso] = useState(false);
  useEffect(() => { const t = setTimeout(() => setTick((x) => x + 1), 1500); return () => clearTimeout(t); }, []);
  if (instalado() || fechado) return null;
  const ios = iPhone();
  if (!ios && !pedido) return null;
  async function instalar() {
    if (ios) { setPasso(true); return; }
    pedido.prompt(); await pedido.userChoice; pedido = null; setTick((x) => x + 1);
  }
  return (
    <div className="card p-4 mb-4 flex gap-3 items-start border-[color:var(--color-brand)]/30">
      <img src="/icon-192.png" alt="" className="w-11 h-11 rounded-xl shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="font-semibold">Instale o app no celular</div>
        {!passo
          ? <div className="text-xs text-tx2 mt-0.5">Abre em tela cheia, direto do ícone, sem procurar o link no WhatsApp.</div>
          : <div className="text-xs text-tx mt-1 leading-relaxed">No Safari, toque em <Share size={13} className="inline -mt-0.5" /> <b>Compartilhar</b> (embaixo) → <b>Adicionar à Tela de Início</b> → <b>Adicionar</b>.</div>}
        {!passo && <button onClick={instalar} className="btn btn-primary mt-2 py-1.5 text-sm"><Download size={15} /> Instalar</button>}
      </div>
      {compacto && <button aria-label="fechar" onClick={() => { try { localStorage.setItem(chave, '1'); } catch { /* sem storage */ } setFechado(true); }}><X size={16} className="text-tx3" /></button>}
    </div>
  );
}
