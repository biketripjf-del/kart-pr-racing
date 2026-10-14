import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import './index.css';

import Inicio from './pages/Inicio.jsx';
import { FichaLista, FichaForm } from './pages/Ficha.jsx';
import Sorteio from './pages/Sorteio.jsx';
import Mural from './pages/Mural.jsx';
import Regulamento from './pages/Regulamento.jsx';
import Pilotos from './pages/Pilotos.jsx';
import Piloto from './pages/Piloto.jsx';
import Ranking from './pages/Ranking.jsx';
import ResultadoEtapa from './pages/ResultadoEtapa.jsx';
import AdminLogin from './pages/AdminLogin.jsx';
import AdminPilotos from './pages/AdminPilotos.jsx';
import AdminEtapa from './pages/AdminEtapa.jsx';
import AoVivo from './pages/AoVivo.jsx';
import { getToken } from './api.js';

function Protegido({ children }) {
  return getToken() ? children : <Navigate to="/admin/login" replace />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Toaster position="top-center" richColors />
      <Routes>
        <Route path="/" element={<Inicio />} />
        <Route path="/ficha" element={<FichaLista />} />
        <Route path="/ficha/:id" element={<FichaForm />} />
        <Route path="/sorteio" element={<Sorteio />} />
        <Route path="/mural" element={<Mural />} />
        <Route path="/regulamento" element={<Regulamento />} />
        <Route path="/pilotos" element={<Pilotos />} />
        <Route path="/piloto/:id" element={<Piloto />} />
        <Route path="/ranking" element={<Ranking />} />
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
