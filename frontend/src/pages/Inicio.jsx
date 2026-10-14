import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, MapPin, Clock, UserRound, Shuffle, Radio, Megaphone, Pin } from 'lucide-react';
import { api } from '../api.js';
import { InstalarApp } from '../components/Instalar.jsx';
import { Casca, Contador, useAgora, dataBR, quandoBRT, diaDaSemana } from '../components/Marca.jsx';

// contagem até a hora em que o kart abre (sex 23/10 15:00 BRT, no evento atual) — anda de segundo em segundo
function Contagem({ data, hora }) {
  const agora = useAgora(1000);
  if (!data) return null;
  const hh = (String(hora || '').match(/(\d{1,2}):(\d{2})/) || [null, '15', '00']).slice(1).join(':');
  const alvo = new Date(`${String(data).slice(0, 10)}T${hh.padStart(5, '0')}:00-03:00`).getTime();
  if (alvo - agora <= 0) return null;
  return <div className="mt-4"><Contador ms={alvo - agora} /></div>;
}

export default function Inicio() {
  const [evento, setEvento] = useState(null);
  const [avisos, setAvisos] = useState([]);
  const [sorteio, setSorteio] = useState(null);

  useEffect(() => {
    api.get('/config').then(({ data }) => {
      api.get(`/ao-vivo/${data.evento_atual}`).then((r) => setEvento(r.data)).catch(() => {});
      api.get(`/sorteio/${data.evento_atual}`).then((r) => setSorteio(r.data)).catch(() => {});
    });
    api.get('/avisos').then((r) => setAvisos(r.data)).catch(() => {});
  }, []);

  const ev = evento?.evento;
  const h = ev?.horarios || {};
  const comecou = evento && Object.values(evento.quadro.sessoes).some((s) => s.resultado.length || s.tomada?.length);

  return (
    <Casca>
      <InstalarApp compacto />
      {ev && (
        <div className="card overflow-hidden">
          {/* capa: pista em vista aérea desenhada no formato do R do logo P&R (arte gerada, não é foto de evento) */}
          <div className="relative h-56 bg-[color:var(--color-brand-dark)]">
            <img src="/img/pista-r.webp" alt="" className="absolute inset-0 w-full h-full object-cover object-[50%_60%]" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#032a52] via-[#032a52]/40 to-transparent" />
            <div className="absolute bottom-0 inset-x-0 p-4 text-white">
              <div className="text-[11px] uppercase tracking-[0.2em] text-white/80 font-semibold">Próxima corrida</div>
              <div className="mt-1 text-[22px] leading-tight display">{ev.titulo}</div>
            </div>
          </div>
          <div className="p-5 pt-4">
          <div className="space-y-1.5 text-sm text-tx">
            <div className="flex items-center gap-2"><CalendarDays size={15} className="text-tx2" />{diaDaSemana(ev.data)}, {dataBR(ev.data)}</div>
            {ev.local && <div className="flex items-center gap-2"><MapPin size={15} className="text-tx2" />{ev.local}</div>}
            {h.kart_abre && <div className="flex items-center gap-2"><Clock size={15} className="text-tx2" />Kart abre {h.kart_abre} · saída de JF {h.saida}</div>}
          </div>
          <Contagem data={ev.data} hora={h.kart_abre} />
          <div className="mt-4 grid grid-cols-2 gap-2">
            {comecou
              ? <Link to="/ao-vivo" className="btn btn-primary col-span-2"><Radio size={16} /> Quadro AO VIVO</Link>
              : <>
                <Link to="/ficha" className="btn btn-primary"><UserRound size={16} /> Minha ficha</Link>
                <Link to="/sorteio" className="btn btn-ghost"><Shuffle size={16} /> Sorteio</Link>
              </>}
          </div>
          {sorteio && sorteio.fase === 'contagem' && (
            <div className="mt-3 text-xs text-tx2 text-center">Sorteio dos grupos ao vivo no app: <b className="text-tx">{quandoBRT(sorteio.agendado_para)}</b></div>
          )}
          </div>
        </div>
      )}

      <div className="mt-6 flex items-center gap-2 font-semibold"><Megaphone size={17} className="text-[color:var(--color-gold)]" /> Mural</div>
      {avisos.length === 0 && <div className="card mt-3 p-5 text-sm text-tx2 text-center">Nenhum aviso ainda.</div>}
      {avisos.slice(0, 3).map((a) => (
        <div key={a.id} className="card mt-3 p-4">
          <div className="flex items-center gap-2 font-semibold">{a.fixado && <Pin size={14} className="text-[color:var(--color-gold)]" />}{a.titulo}</div>
          <div className="mt-1 text-sm text-tx whitespace-pre-line line-clamp-4">{a.texto}</div>
          <div className="mt-2 text-[11px] text-tx3">{quandoBRT(a.criado_em)}</div>
        </div>
      ))}
      {avisos.length > 3 && <Link to="/mural" className="block mt-3 text-center text-sm text-[color:var(--color-brand)]">Ver todos os avisos</Link>}
    </Casca>
  );
}
