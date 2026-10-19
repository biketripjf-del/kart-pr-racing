import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import './index.css';

import Inicio from './pages/Inicio.jsx';
import { FichaForm, LinkPessoal } from './pages/Ficha.jsx';
import Caronas from './pages/Caronas.jsx';
import Sorteio from './pages/Sorteio.jsx';
import Mural from './pages/Mural.jsx';
import Regulamento from './pages/Regulamento.jsx';
import Pilotos from './pages/Pilotos.jsx';
import Piloto from './pages/Piloto.jsx';
import Ranking from './pages/Ranking.jsx';
import Comparar from './pages/Comparar.jsx';
import Mais from './pages/Mais.jsx';
import Dicas from './pages/Dicas.jsx';
import Midia from './pages/Midia.jsx';
import ResultadoEtapa from './pages/ResultadoEtapa.jsx';
import AdminLogin from './pages/AdminLogin.jsx';
import AdminPilotos from './pages/AdminPilotos.jsx';
import AdminEtapa from './pages/AdminEtapa.jsx';
import AoVivo from './pages/AoVivo.jsx';
import { getToken } from './api.js';
import { registerSW } from 'virtual:pwa-register';

// Versão nova no ar = o app troca sozinho (recarrega quando o service worker novo assume). Sem isso a aba aberta antes
// do deploy segue com o código velho: foi o "não salva" da ficha do Brunner em 19/10, com o conserto já no ar.
// E confere a cada 30 min, pra quem deixa o app aberto (dia da corrida), e toda vez que o app volta pra frente da tela:
// o PWA no celular quase nunca é fechado de verdade, só vai pro fundo (Brunner 19/10: "reset em todos sem que eles façam").
registerSW({ immediate: true, onRegisteredSW(_, r) {
  if (!r) return;
  setInterval(() => r.update(), 30 * 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') r.update(); });
} });

function Protegido({ children }) {
  return getToken() ? children : <Navigate to="/admin/login" replace />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Toaster position="top-center" richColors />
      <Routes>
        <Route path="/" element={<Inicio />} />
        <Route path="/ficha" element={<FichaForm />} />
        <Route path="/ficha/:id" element={<Navigate to="/ficha" replace />} />
        <Route path="/f/:token" element={<LinkPessoal />} />
        <Route path="/caronas" element={<Caronas />} />
        <Route path="/sorteio" element={<Sorteio />} />
        <Route path="/mural" element={<Mural />} />
        <Route path="/regulamento" element={<Regulamento />} />
        <Route path="/pilotos" element={<Pilotos />} />
        <Route path="/piloto/:id" element={<Piloto />} />
        <Route path="/ranking" element={<Ranking />} />
        <Route path="/comparar" element={<Comparar />} />
        <Route path="/mais" element={<Mais />} />
        <Route path="/dicas" element={<Dicas />} />
        <Route path="/midia" element={<Midia />} />
        <Route path="/etapa/:id" element={<ResultadoEtapa />} />
        <Route path="/ao-vivo" element={<AoVivo />} />
        <Route path="/ao-vivo/:slug" element={<AoVivo />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<Protegido><AdminPilotos /></Protegido>} />
        <Route path="/admin/etapa/:id" element={<Protegido><AdminEtapa /></Protegido>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
