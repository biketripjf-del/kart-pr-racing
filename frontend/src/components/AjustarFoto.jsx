// Ajustar a foto dentro da moldura antes de salvar (Brunner 22/10/2026: "eu subi a foto inteira e ficou cortado e
// nao tinha como regular a foto dentro da moldura"). Antes o app cortava um quadrado no CENTRO sem perguntar — foto
// de corpo inteiro perdia o rosto. Agora: arrasta pra posicionar, pinça/barra pra zoom, e dá pra afastar até a foto
// inteira caber no círculo (o que sobra vira fundo claro, como o das iniciais).
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ZoomIn, ZoomOut } from 'lucide-react';

// área visível do ajuste e o círculo que vira a foto: 300/260 px, encolhendo em celular estreito (320 px de tela)
const tamanhos = () => { const palco = Math.max(220, Math.min(300, window.innerWidth - 80)); return [palco, Math.round(palco * 0.867)]; };
const LADO = 512;    // foto salva (512 px, jpeg) — ~60 KB em vez de 4 MB
const ZOOM_MAX = 4;
const FUNDO = '#e8eff7';

// foco (opcional): { z, y } = zoom inicial e ponto da foto (fração da altura, de cima) que abre no centro do círculo
export default function AjustarFoto({ arquivo, onPronto, onCancelar, foco }) {
  const [[PALCO, MOLDURA]] = useState(tamanhos);
  const [img, setImg] = useState(null);
  const [z, setZ] = useState(1);              // 1 = a foto cobre o círculo
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const toques = useRef(new Map());
  const pinca = useRef(null);

  useEffect(() => {
    const url = URL.createObjectURL(arquivo);
    const i = new Image();
    i.onload = () => {
      // foto em pé (corpo inteiro, selfie): começa mostrando a parte de CIMA, onde costuma estar o rosto
      if (foco) {
        const alt = (i.height * MOLDURA * foco.z) / Math.min(i.width, i.height);
        setZ(foco.z); setPos({ x: 0, y: Math.min(alt * (0.5 - foco.y), (alt - MOLDURA) / 2) });
      } else if (i.height > i.width) setPos({ x: 0, y: ((i.height * MOLDURA) / i.width - MOLDURA) / 2 * 0.7 });
      setImg(i);
    };
    i.onerror = () => onCancelar('ilegivel');
    i.src = url;
    return () => URL.revokeObjectURL(url);
  }, [arquivo]);

  useEffect(() => {
    const esc = (e) => { if (e.key === 'Escape') onCancelar(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, []);

  if (!img) return null;
  const base = MOLDURA / Math.min(img.width, img.height);                 // escala que cobre o círculo
  const zMin = Math.min(img.width, img.height) / Math.max(img.width, img.height); // foto inteira dentro
  const larg = img.width * base * z, alt = img.height * base * z;
  // a foto não sai da moldura: maior que o círculo = cobre sempre; menor = fica dentro dele
  const prender = (p, zz = z) => {
    const lx = Math.abs(img.width * base * zz - MOLDURA) / 2, ly = Math.abs(img.height * base * zz - MOLDURA) / 2;
    return { x: Math.max(-lx, Math.min(lx, p.x)), y: Math.max(-ly, Math.min(ly, p.y)) };
  };
  const zoom = (nz) => { const zz = Math.max(zMin, Math.min(ZOOM_MAX, nz)); setZ(zz); setPos((p) => prender(p, zz)); };

  const down = (e) => { e.currentTarget.setPointerCapture(e.pointerId); toques.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); pinca.current = null; };
  const move = (e) => {
    const t = toques.current;
    if (!t.has(e.pointerId)) return;
    const antes = t.get(e.pointerId);
    t.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (t.size === 1) {
      setPos((p) => prender({ x: p.x + e.clientX - antes.x, y: p.y + e.clientY - antes.y }));
    } else if (t.size === 2) {
      const [a, b] = [...t.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinca.current) zoom(z * (d / pinca.current));
      pinca.current = d;
    }
  };
  const up = (e) => { toques.current.delete(e.pointerId); pinca.current = null; };

  function usar() {
    const c = document.createElement('canvas');
    c.width = LADO; c.height = LADO;
    const g = c.getContext('2d');
    g.fillStyle = FUNDO; g.fillRect(0, 0, LADO, LADO);
    const k = LADO / MOLDURA;
    g.drawImage(img, (MOLDURA / 2 + pos.x - larg / 2) * k, (MOLDURA / 2 + pos.y - alt / 2) * k, larg * k, alt * k);
    onPronto(c.toDataURL('image/jpeg', 0.85));
  }

  return createPortal(
    <div className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center p-4">
      <div className="card p-5 w-full max-w-sm flex flex-col items-center gap-4">
        <div className="font-semibold">Ajuste sua foto</div>
        <div className="relative overflow-hidden rounded-xl bg-[#111] touch-none select-none cursor-grab active:cursor-grabbing"
          style={{ width: PALCO, height: PALCO }}
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
          onWheel={(e) => zoom(z * (e.deltaY < 0 ? 1.08 : 1 / 1.08))}>
          <img src={img.src} alt="" draggable={false} className="absolute max-w-none pointer-events-none"
            style={{ width: larg, height: alt, left: PALCO / 2 + pos.x - larg / 2, top: PALCO / 2 + pos.y - alt / 2 }} />
          <div className="absolute rounded-full pointer-events-none border-2 border-white/90"
            style={{ width: MOLDURA, height: MOLDURA, left: (PALCO - MOLDURA) / 2, top: (PALCO - MOLDURA) / 2, boxShadow: '0 0 0 400px rgba(0,0,0,.55)' }} />
        </div>
        <div className="flex items-center gap-3 w-full">
          <button type="button" className="btn btn-ghost px-2 shrink-0" onClick={() => zoom(z / 1.2)} aria-label="Afastar"><ZoomOut size={18} /></button>
          <input type="range" className="flex-1 min-w-0 accent-brand" min={zMin} max={ZOOM_MAX} step={0.01} value={z} onChange={(e) => zoom(Number(e.target.value))} aria-label="Zoom" />
          <button type="button" className="btn btn-ghost px-2 shrink-0" onClick={() => zoom(z * 1.2)} aria-label="Aproximar"><ZoomIn size={18} /></button>
        </div>
        <div className="text-[11px] text-tx3 text-center -mt-2">Arraste pra posicionar o rosto no círculo. Pinça ou a barra pra aproximar e afastar.</div>
        <div className="flex gap-2 w-full">
          <button type="button" className="btn btn-ghost flex-1" onClick={() => onCancelar()}>Cancelar</button>
          <button type="button" className="btn btn-primary flex-1" onClick={usar}>Usar esta foto</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
