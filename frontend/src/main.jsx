import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import './index.css';

import Cadastro from './pages/Cadastro.jsx';
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
        <Route path="/" element={<Cadastro />} />
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
