import axios from 'axios';

export const api = axios.create({ baseURL: '/api' });

const TOKEN_KEY = 'prcup_token';

export function setToken(t) {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}
export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

// link pessoal do piloto (/f/<token>): guardado no celular, vai em toda chamada como X-Piloto
const EU_KEY = 'prcup_eu';
export function getEu() { try { return localStorage.getItem(EU_KEY); } catch { return null; } }
export function setEu(t) { try { if (t) localStorage.setItem(EU_KEY, t); else localStorage.removeItem(EU_KEY); } catch { /* sem storage */ } }

api.interceptors.request.use((cfg) => {
  const t = getToken();
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  const eu = getEu();
  if (eu) cfg.headers['X-Piloto'] = eu;
  return cfg;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    // só derruba o login do organizador quando o PRÓPRIO login venceu (401 de link pessoal inválido não conta)
    if (err.response?.status === 401 && err.response?.data?.erro === 'token_invalido' && !location.pathname.startsWith('/admin/login')) {
      setToken(null);
    }
    return Promise.reject(err);
  }
);

export const money = (centavos) =>
  (Number(centavos || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
