# Contas Cotidiano

Sistema de controle financeiro pessoal — Next.js + Turso + Resend + Vercel.

## Stack

- **Frontend/Backend**: Next.js 14 (App Router, TypeScript)
- **Banco de dados**: Turso (SQLite distribuído)
- **ORM**: Drizzle ORM
- **Email**: Resend
- **Deploy**: Vercel
- **UI**: Tailwind CSS + Recharts

---

## Setup Local

### 1. Instalar dependências

```bash
npm install
```

### 2. Criar banco no Turso

```bash
# Instalar Turso CLI
curl -sSfL https://get.turso.tech/install.sh | bash

# Login
turso auth login

# Criar banco
turso db create contas-cotidiano

# Pegar URL e token
turso db show contas-cotidiano --url
turso db tokens create contas-cotidiano
```

### 3. Configurar variáveis de ambiente

```bash
cp .env.example .env.local
```

Preencha o `.env.local`:

```env
TURSO_DATABASE_URL=libsql://contas-cotidiano-seuuser.turso.io
TURSO_AUTH_TOKEN=eyJhbGc...

RESEND_API_KEY=re_xxxxxxxxxxxx
RESEND_FROM_EMAIL=contas@seudominio.com

JWT_SECRET=uma-chave-secreta-com-pelo-menos-32-caracteres
NEXTAUTH_URL=http://localhost:3000

ADMIN_EMAIL=seu@email.com
ADMIN_PASSWORD=suasenha123

CRON_SECRET=outra-chave-secreta-para-o-cron
```

### 4. Criar tabelas

```bash
npm run db:push
```

- Se não funcionar, gerar o drizzle-kit manualmente:

```bash
npx drizzle-kit generate
turso db shell contas-cotidiano < drizzle/0000_*.sql
```

### 5. Popular banco com dados do XLSX

```bash
npm run db:seed
```

### 6. Rodar em desenvolvimento

```bash
npm run dev
```

---

## Deploy na Vercel

### 1. Criar projeto na Vercel

```bash
npm i -g vercel
vercel
```

### 2. Configurar variáveis de ambiente na Vercel

No dashboard Vercel → Settings → Environment Variables, adicione todas as variáveis do `.env.example` com seus valores reais.

Para o `NEXTAUTH_URL`, use a URL da sua aplicação na Vercel (ex: `https://contas-cotidiano.vercel.app`).

### 3. Deploy

```bash
vercel --prod
```

### 4. Cron Jobs

O arquivo `vercel.json` já configura o cron para rodar diariamente às 8h. O Vercel Cron é gratuito para 1 job no plano hobby.

---

## Primeiro Acesso

1. Acesse a URL do deploy
2. Insira email e senha (definidos em `ADMIN_EMAIL` e `ADMIN_PASSWORD`)
3. Um email de verificação será enviado
4. Clique no link do email para confirmar
5. A sessão dura **30 dias** sem precisar verificar novamente

---

## Funcionalidades

- ✅ **Dashboard anual** com gráficos de evolução
- ✅ **Gestão de contas** mês a mês (CRUD completo)
- ✅ **Marcar como pago** com um clique
- ✅ **Alertas visuais** de vencimento (3 dias, vencida)
- ✅ **Email de alerta** de contas próximas do vencimento
- ✅ **Panorama mensal** por email todo dia 1
- ✅ **Autenticação segura** com verificação por email (30 dias)
- ✅ **Mobile first** — responsivo para celular
- ✅ **Dados iniciais** populados do seu XLSX de 2026

---

## Estrutura do Projeto

```
src/
├── app/
│   ├── api/
│   │   ├── auth/        # login, verify, logout
│   │   ├── bills/       # CRUD de contas
│   │   ├── salaries/    # salários
│   │   ├── dashboard/   # dados anuais
│   │   └── cron/        # notificações automáticas
│   ├── dashboard/       # página principal
│   ├── contas/          # gestão de contas
│   └── login/           # autenticação
├── components/
│   ├── dashboard/       # YearOverview, Sidebar
│   └── bills/           # BillsManager
└── lib/
    ├── auth/            # JWT, bcrypt, sessões
    ├── db/              # Drizzle + schema
    └── email/           # templates Resend
scripts/
└── seed.ts              # popular banco com dados 2026
```
