# 🏁 P&R Racing Cup

App do campeonato de kart do escritório **Pacheco & Reis Advogados**.
Inscrição pública de pilotos, controle de pagamento por etapa, lançamento de
resultados, cálculo de pontos e ranking anual.

- **Etapas:** a cada 60 dias. Etapa 1: 17/07/2026, Kartódromo Internacional de Volta Redonda-RJ.
- **Valor:** R$180 / 2 baterias por etapa.
- **Pontuação:** F1 (25-18-15-12-10-8-6-4-2-1) + 1 bônus volta mais rápida + 1 bônus pole. Descarta a pior etapa no ranking anual.

## Stack
- **Backend:** Node + Express + PostgreSQL (`backend/`)
- **Frontend:** React + Vite + Tailwind (`frontend/`)
- **Deploy:** serviço único — o backend serve a API (`/api/*`) e o frontend buildado (`frontend/dist`).

## Rodar local
```bash
# 1. Postgres rodando + crie o banco (ex: prracing)
# 2. backend/.env  (copie de .env.example)
#    DATABASE_URL=postgres://user:pass@localhost:5432/prracing
#    JWT_SECRET=<chave longa aleatória>
#    ADMIN_USER=admin
#    ADMIN_PASSWORD=<senha do organizador>

npm run build          # instala tudo + builda o frontend
npm run migrate        # cria as tabelas
npm run seed           # cria o admin + a etapa 1 (usa ADMIN_USER/ADMIN_PASSWORD)
npm start              # sobe em http://localhost:4000

# desenvolvimento (2 processos):
cd backend && npm run dev      # API na 4000
cd frontend && npm run dev     # UI na 5173 (proxy /api -> 4000)
```

## Deploy (Railway / Render / qualquer host Node + Postgres)
1. Provisione um Postgres e pegue a `DATABASE_URL`.
2. Variáveis de ambiente no host: `DATABASE_URL`, `JWT_SECRET`, `ADMIN_USER`, `ADMIN_PASSWORD`, `PORT` (o host define).
3. Build: `npm run build` · Start: `npm start` (o start roda as migrations e sobe).
4. Rode o seed uma vez para criar o admin + etapa 1: `npm run seed`.

## Rotas
- `/` inscrição pública · `/ranking` classificação · `/etapa/:id` resultado de uma etapa
- `/admin` painel do organizador (login em `/admin/login`)

## Handoff
Projeto standalone, sem dependências da eDrive. Para o escritório assumir a
hospedagem: apontar o domínio (`kart.pachecoereis.adv.br` ou similar) para o
serviço e definir as 4 variáveis de ambiente acima. Nenhuma credencial fica no
código — tudo vem do ambiente.

## Testes
```bash
cd backend && USE_PGMEM=1 JWT_SECRET=devkey PORT=4223 node test/smoke.mjs
# banco fora do ar não pode derrubar o servidor (500 limpo + processo vivo)
cd backend && JWT_SECRET=devkey node test/erro-de-banco.mjs
```
Roda o fluxo completo (cadastro → pagamento → resultado → ranking) contra um
Postgres em memória (pg-mem), sem precisar de banco.
