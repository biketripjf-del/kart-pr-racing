import { Casca } from '../components/Marca.jsx';

// Dicas de pilotagem pra quem anda de kart alugado poucas vezes por ano (Brunner 14/10: "uma sessão de dicas de
// pilotagem de kart"). Desenhos feitos em código (SVG), sem imagem gerada. Fontes no rodapé da página.

// curva de 90° à direita: pista, zebras, traçado ideal e os 4 momentos
function Curva() {
  const borda = '#c5d0de';
  return (
    <svg viewBox="0 0 360 310" className="w-full h-auto" role="img" aria-label="Traçado ideal numa curva de 90 graus">
      <rect width="360" height="310" fill="#eef3f9" rx="12" />
      {/* pista */}
      <path d="M110 310 L110 150 Q110 60 200 60 L360 60" fill="none" stroke="#3a4657" strokeWidth="92" />
      {/* zebras: dentro da curva e na saída por fora */}
      <path d="M155 160 Q155 105 210 105" fill="none" stroke="#fff" strokeWidth="8" />
      <path d="M155 160 Q155 105 210 105" fill="none" stroke="#d0312d" strokeWidth="8" strokeDasharray="9 9" />
      <path d="M250 15 L345 15" fill="none" stroke="#fff" strokeWidth="8" />
      <path d="M250 15 L345 15" fill="none" stroke="#d0312d" strokeWidth="8" strokeDasharray="9 9" />
      {/* bordas */}
      <path d="M64 310 L64 150 Q64 14 200 14 L360 14" fill="none" stroke={borda} strokeWidth="2" />
      <path d="M156 310 L156 150 Q156 106 200 106 L360 106" fill="none" stroke={borda} strokeWidth="2" />
      {/* traçado ideal: por fora → tangência tardia por dentro → sai aberto */}
      <path d="M76 310 L76 175 C76 130 140 108 172 106 C212 103 262 70 340 26" fill="none" stroke="#5aa9ff" strokeWidth="5" strokeLinecap="round" />
      {/* zona de frenagem */}
      <path d="M76 285 L76 205" stroke="#d0312d" strokeWidth="9" strokeLinecap="round" opacity=".9" />
      {[[76, 262, '1'], [76, 178, '2'], [172, 106, '3'], [292, 46, '4']].map(([x, y, n]) => (
        <g key={n}>
          <circle cx={x} cy={y} r="13" fill="#fff" stroke="#055391" strokeWidth="3" />
          <text x={x} y={y + 5} textAnchor="middle" fontSize="15" fontWeight="800" fill="#055391">{n}</text>
        </g>
      ))}
      <text x="18" y="300" fontSize="11" fill="#4b5d76">entra</text>
      <text x="300" y="98" fontSize="11" fill="#e8eef7">sai</text>
    </svg>
  );
}

const MOMENTOS = [
  ['1', 'Freia forte e em linha reta', 'Com o kart ainda reto, colado no lado de FORA. O freio do kart só pega nas rodas de trás: frear virando faz rodar.'],
  ['2', 'Alivia o freio e vira', 'Solte o freio aos poucos enquanto começa a virar. Vire um pouco mais tarde do que dá vontade.'],
  ['3', 'Tangência', 'Encoste na zebra de DENTRO, um pouco depois do meio da curva (tangência tardia). É ela que deixa você acelerar mais cedo.'],
  ['4', 'Acelera e usa a pista toda', 'Endireite o volante e acelere progressivamente, deixando o kart abrir até a zebra de fora. Reta boa nasce na saída da curva.'],
];

const DICAS = [
  ['Mãos e volante', 'Mãos em "quinze para as três" (9 e 3 horas). Empurre o volante com a mão de fora em vez de puxar com a de dentro: o movimento sai mais suave.'],
  ['Suavidade ganha de força', 'Kart alugado é pesado e tem pouco motor. Toda pancada no volante ou no freio custa velocidade. Mãos e pés macios = volta mais rápida.'],
  ['Olhe longe', 'Na reta, olhe pro ponto de frenagem. Freando, olhe pra tangência. Na tangência, olhe pra saída. O kart vai pra onde você olha.'],
  ['Corpo', 'Costas no banco, corpo firme e cabeça alinhada com o corpo. Não se pendure pra dentro da curva.'],
  ['Pé no acelerador', 'Ou freia ou acelera: nunca os dois ao mesmo tempo. Kart alugado não tem embreagem nem marcha; pé no freio com acelerador só esquenta e trava.'],
  ['Ultrapassagem', 'Prepare na saída da curva anterior (saia colado, com mais velocidade) e passe na reta ou freando por dentro. Escolha uma linha e mantenha: zigue-zague é perigoso e não ajuda.'],
  ['Defesa', 'Uma mudança de linha só, e cedo. Fechar a porta em cima da frenagem é como acidente acontece, e encostar faz perder posição.'],
  ['Retrovisor não existe', 'Olhe pra trás no máximo uma vez por volta. Quem olha muito para trás perde tempo na frente.'],
  ['Pista e pneu', 'A borracha escura no asfalto mostra o traçado que todo mundo usa. Nas primeiras voltas o pneu está frio: vá com calma até ele aquecer.'],
];

const BANDEIRAS = [
  ['verde', ['#1a9b4b'], 'Pista liberada: largada ou fim do perigo.'],
  ['amarela', ['#f2c230'], 'Perigo à frente. Reduza e NÃO ultrapasse.'],
  ['azul', ['#1f6fd6'], 'Kart mais rápido vindo (vai te dar volta). Mantenha a linha e deixe passar.'],
  ['vermelha', ['#d0312d'], 'Corrida parada. Diminua e volte devagar pro box.'],
  ['preta', ['#111'], 'É com você: entre no box na próxima volta.'],
  ['quadriculada', null, 'Fim da corrida. Complete a volta devagar, sem ultrapassar, e entre no box.'],
];

function Bandeira({ cores }) {
  if (!cores) {
    return (
      <svg viewBox="0 0 40 28" className="w-10 h-7 rounded shrink-0 border border-[#d5dfeb]">
        {Array.from({ length: 28 }, (_, i) => <rect key={i} x={(i % 7) * 5.72} y={Math.floor(i / 7) * 7} width="5.72" height="7" fill={(i % 7 + Math.floor(i / 7)) % 2 ? '#111' : '#fff'} />)}
      </svg>
    );
  }
  return <span className="w-10 h-7 rounded shrink-0 border border-black/10" style={{ background: cores[0] }} />;
}

export default function Dicas() {
  return (
    <Casca sub="Dicas de pilotagem">
      <div className="card p-4 text-sm text-tx">
        O básico que faz diferença em kart alugado. Ninguém vira piloto lendo, mas dá pra parar de perder tempo bobo.
      </div>

      <h2 className="display text-base text-brand-dark mt-6 mb-2">A curva, em 4 tempos</h2>
      <div className="card p-3"><Curva /></div>
      <div className="mt-3 space-y-2">
        {MOMENTOS.map(([n, t, d]) => (
          <div key={n} className="card p-3 flex gap-3">
            <span className="w-7 h-7 rounded-full border-[3px] border-brand text-brand font-extrabold text-sm flex items-center justify-center shrink-0">{n}</span>
            <div><div className="font-semibold">{t}</div><div className="text-sm text-tx2 mt-0.5">{d}</div></div>
          </div>
        ))}
      </div>

      <h2 className="display text-base text-brand-dark mt-6 mb-2">No kart</h2>
      <div className="card divide-y divide-[#e3e9f1]">
        {DICAS.map(([t, d]) => (
          <div key={t} className="p-4"><div className="font-semibold">{t}</div><div className="text-sm text-tx2 mt-1">{d}</div></div>
        ))}
      </div>

      <h2 className="display text-base text-brand-dark mt-6 mb-2">Bandeiras</h2>
      <div className="card divide-y divide-[#e3e9f1]">
        {BANDEIRAS.map(([n, c, d]) => (
          <div key={n} className="p-3 flex items-center gap-3">
            <Bandeira cores={c} />
            <div><div className="font-semibold capitalize">{n}</div><div className="text-sm text-tx2">{d}</div></div>
          </div>
        ))}
      </div>
      <div className="mt-2 text-[11px] text-tx3">O briefing do kartódromo no dia vale mais que esta lista: se for diferente, siga o briefing.</div>

      <div className="mt-6 text-[11px] text-tx3 leading-relaxed">
        Fontes: Red Bull, "Karting mistakes novices make" (redbull.com) · KartClass, guias para iniciantes e kart alugado (kartclass.com) · Trophi.ai, "Top 5 tips for getting faster at karting".
      </div>
    </Casca>
  );
}
