import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api, setToken } from '../api.js';
import { Casca } from '../components/Marca.jsx';

export default function AdminLogin() {
  const nav = useNavigate();
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [carregando, setCarregando] = useState(false);

  async function entrar(e) {
    e.preventDefault();
    setCarregando(true);
    try {
      const { data } = await api.post('/admin/login', { usuario, senha });
      setToken(data.token);
      // /admin/login?volta=/sorteio volta pra tela de onde veio
      const volta = new URLSearchParams(location.search).get('volta') || '';
      nav(/^\/[a-z]/.test(volta) ? volta : '/admin');
    } catch {
      toast.error('Usuário ou senha inválidos.');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <Casca sub="Painel do organizador">
      <form onSubmit={entrar} className="card p-6 space-y-4 max-w-sm mx-auto">
        <div>
          <span className="label">Usuário</span>
          <input className="input" value={usuario} onChange={(e) => setUsuario(e.target.value)} autoCapitalize="none" />
        </div>
        <div>
          <span className="label">Senha</span>
          <input type="password" className="input" value={senha} onChange={(e) => setSenha(e.target.value)} />
        </div>
        <button className="btn btn-primary w-full" disabled={carregando}>{carregando ? 'Entrando…' : 'Entrar'}</button>
      </form>
    </Casca>
  );
}
