# Guia Passo a Passo: Deploy do CONA CASH na Vercel & Supabase

Este guia detalha o processo completo para colocar o **CONA CASH** em produção na nuvem de forma gratuita, segura e com deploy contínuo integrado ao GitHub.

---

## Como Funciona a Arquitetura
- **Vercel**: Hospeda a aplicação web (Front-end React + Vite + PWA). É rápida, com certificado SSL/HTTPS automático e CDN global.
- **Supabase**: Hospeda o banco de dados PostgreSQL, autenticação de usuários, regras de segurança RLS e APIs em tempo real.
- **Comunicação**: O front-end na Vercel se conecta ao Supabase através de **Variáveis de Ambiente** protegidas.

---

## PASSO 1: Preparar o Banco de Dados no Supabase

Se você já executou as migrations ao longo das fases, seu banco já está pronto. Se estiver iniciando um novo projeto Supabase, siga este passo:

1. Acesse o painel do [Supabase](https://supabase.com/dashboard) e entre no seu projeto.
2. No menu lateral esquerdo, clique no ícone **SQL Editor**.
3. Clique no botão **New Query**.
4. Abra o arquivo consolidado gerado no repositório:
   📁 [`supabase/SCHEMA_COMPLETO_CONA_CASH.sql`](../supabase/SCHEMA_COMPLETO_CONA_CASH.sql)
5. Copie todo o conteúdo do arquivo, cole no SQL Editor do Supabase e clique no botão verde **Run** (ou `Ctrl + Enter`).
6. O script criará de forma 100% segura e idempotente todas as tabelas (`profiles`, `app_settings`, `accounts`, `payment_methods`, `categories`, `income_sources`, `transactions`, `goals`, `audit_log`), triggers, políticas de segurança RLS e funções de relatórios.

### Obter as Chaves de Conexão no Supabase:
1. No menu lateral do Supabase, clique em **Project Settings** (ícone de engrenagem no canto inferior esquerdo).
2. Clique na aba **API**.
3. Copie os seguintes valores para usar no Passo 2:
   - **Project URL** (ex: `https://xxxxxxxxxxxxxxxxxxxx.supabase.co`)
   - **anon public key** (chave que começa com `eyJhbGci...`)

---

## PASSO 2: Deploy na Vercel (Conectando ao GitHub)

1. Acesse [vercel.com](https://vercel.com) e faça login com a sua conta do GitHub.
2. No Dashboard principal, clique no botão azul **Add New...** e selecione **Project**.
3. Na lista de repositórios do GitHub, localize `cona_cash` e clique em **Import**.
4. Na tela de configuração do projeto (**Configure Project**):
   - **Project Name**: Pode manter `cona-cash` (ou o nome de sua preferência).
   - **Framework Preset**: Selecione `Vite` (ou deixe automático).
   - **Root Directory**: Deixe `./` (a raiz do projeto). O arquivo `vercel.json` na raiz já gerencia a compilação da subpasta `app/`.
     *(Opcional: Se preferir apontar diretamente para a pasta `app`, basta clicar em Edit e selecionar `app`).*

5. **Environment Variables (VARIÁVEIS DE AMBIENTE - OBRIGATÓRIO)**:
   Expanda a seção **Environment Variables** e adicione as seguintes variáveis:

   | Nome da Variável | Valor |
   |---|---|
   | `VITE_SUPABASE_URL` | Cole a sua **Project URL** obtida no Supabase |
   | `VITE_SUPABASE_ANON_KEY` | Cole a sua chave **anon public** obtida no Supabase |
   | `VITE_INITIAL_ADMIN_EMAIL` | *(Opcional)* Seu e-mail de administrador |

6. Clique no botão **Deploy**.
7. Aguarde cerca de 1 a 2 minutos enquanto a Vercel compila o TypeScript, gera o bundle otimizado e distribui para a rede global.
8. Pronto! Uma tela de comemoração com confetes aparecerá exibindo o domínio oficial (ex: `https://cona-cash.vercel.app`).

---

## PASSO 3: Testando em Produção e Instalando como PWA

1. Abra a URL gerada no navegador do seu computador ou celular.
2. Faça login com suas credenciais ou crie seu usuário.
3. **No Celular (Android / iOS)**:
   - Um botão discreto *"Instalar CONA CASH"* aparecerá na tela inicial.
   - Caso prefira, no Chrome/Edge toque nos 3 pontinhos e selecione **"Adicionar à tela inicial"** ou **"Instalar aplicativo"**.
   - No iPhone (Safari), toque no botão de compartilhamento e em seguida em **"Adicionar à Tela de Início"**.
   - O app será aberto em tela cheia, com ícone oficial, sem barras de navegador e com suporte offline via Service Worker.

---

## PASSO 4: Atualizações Futuras Automáticas (CI/CD)

Você não precisa repetir o deploy a cada melhoria:
- Toda vez que fizermos uma alteração, correção ou nova funcionalidade e enviarmos para a branch `main` do GitHub (`git push origin main`), a Vercel detecta a mudança e atualiza o seu site em produção automaticamente em menos de 1 minuto!
