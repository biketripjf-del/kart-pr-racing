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

api.interceptors.request.use((cfg) => {
  const t = getToken();
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && !location.pathname.startsWith('/admin/login')) {
      setToken(null);
    }
    return Promise.reject(err);
  }
);

export const money = (centavos) =>
  (Number(centavos || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
