# DIÁRIO DE CONSTRUÇÃO — Cona Cash (antes Caixa Simples)

> O agente DEVE atualizar este arquivo. Ao retomar, leia primeiro "ESTADO ATUAL".

## ESTADO ATUAL
- Fase atual: **FASE 3C — Layout de computador/notebook/TV (`v0.3.2 beta`) — CONCLUÍDA (Aguardando aprovação)**
- Último passo concluído: Implementação completa da Fase 3C (Sidebar recolhível em `≥ 1024px`, Top Bar Desktop com Saldo Total e ações rápidas, Tabela completa de Lançamentos no desktop, atalhos de teclado `N/S/T/L/Esc`, foco e tipografia escalonada para TV Full HD `1920×1080`, `docs/LAYOUT.md`, e regressão visual 20/20 ANTES vs DEPOIS com zero diferença em `< 1024px`)
- Próximo passo: Aguardar o **"APROVADO"** do Octavio na Fase 3C para iniciar a **Fase 4 (Dashboard com 2 layouts + Relatórios por fonte + PDF)**
- Versão do app: `v0.3.2 beta`
- Último commit/deploy: sincronizado no GitHub (`origin/main`)
- Aguardando aprovação do Octavio? **SIM (Fase 3C)**

## PROGRESSO DAS FASES
| Fase | Nome | Status | Aprovada em |
|---|---|---|---|
| 1 | Fundação, login e visual | ✅ aprovada | 2026-11-03 |
| 2 | Configurações e área admin | ✅ aprovada | 2026-11-03 |
| 3 | Lançamentos (entrada, saída, transferência) | ✅ aprovada | 2026-11-04 |
| 3B | Fontes de renda e aportes (v1.1) | ✅ aprovada | 2026-11-04 |
| 3C | Layout de computador/TV (v1.1) | ⏳ aguardando aprovação | — |
| 4 | Dashboard, saldos e relatórios + PDF | ⬜ | — |
| 5 | Metas, efeitos visuais e sons | ⬜ | — |
| 6 | PWA, otimização, testes e preparo do APK | ⬜ | — |

## PLANILHA DE CONFERÊNCIA DE 10 LANÇAMENTOS (FASE 3)
Saldo Inicial configurado para o teste: **Conta 1 = R$ 100,00** | Conta 2 = R$ 0,00 | Conta 3 = R$ 0,00 | Bolso = R$ 0,00.
| # | Tipo | Descrição / Forma / Categoria | Conta Afetada | Bruto | Taxa | Líquido | Impacto no Saldo |
|---|---|---|---|---|---|---|---|
| L1 | Entrada | Maquininha (3,49%) `#Uber` | Conta 1 | R$ 100,00 | R$ 3,49 | **R$ 96,51** | Conta 1: R$ 196,51 |
| L2 | Entrada | Pix (0%) `#Particular` | Conta 2 | R$ 80,00 | R$ 0,00 | **R$ 80,00** | Conta 2: R$ 80,00 |
| L3 | Entrada | Dinheiro (0%) | Bolso | R$ 50,00 | R$ 0,00 | **R$ 50,00** | Bolso: R$ 50,00 |
| L4 | Entrada (Lote) | Online (app) `#99` | Conta 3 | R$ 120,00 | R$ 0,00 | **R$ 120,00** | Conta 3: R$ 120,00 |
| L5 | Entrada (Lote) | Pix | Conta 2 | R$ 40,00 | R$ 0,00 | **R$ 40,00** | Conta 2: R$ 120,00 |
| L6 | Saída | Abastecimento `#Gasolina` | Conta 2 | R$ 60,00 | R$ 0,00 | **-R$ 60,00** | Conta 2: R$ 60,00 |
| L7 | Saída | Alimentação `#Almoço` | Bolso | R$ 25,00 | R$ 0,00 | **-R$ 25,00** | Bolso: R$ 25,00 |
| L8 | Saída | Lavagem | Conta 1 | R$ 30,00 | R$ 0,00 | **-R$ 30,00** | Conta 1: R$ 166,51 |
| L9 | Transferência | Conta 3 → Conta 1 | C3 (-50) / C1 (+50) | R$ 50,00 | R$ 0,00 | **R$ 50,00** | C3: R$ 70,00 / C1: R$ 216,51 |
| L10 | Transferência | Conta 2 → Bolso | C2 (-20) / Bolso (+20) | R$ 20,00 | R$ 0,00 | **R$ 20,00** | C2: R$ 40,00 / Bolso: R$ 45,00 |
- **Saldos Finais Conferidos no Banco (`get_account_balances`)**:
  - **Conta 1**: `R$ 216,51` (21.651 centavos) — **BATEU 100%**
  - **Conta 2**: `R$ 40,00` (4.000 centavos) — **BATEU 100%**
  - **Conta 3**: `R$ 70,00` (7.000 centavos) — **BATEU 100%**
  - **Bolso (dinheiro)**: `R$ 45,00` (4.500 centavos) — **BATEU 100%**
  - **Saldo Total Geral**: `R$ 371,51` (37.151 centavos) — **BATEU 100%**

## DECISÕES TOMADAS (respostas das entrevistas)
- `2026-11-04 — Fase 3C — Ponto de virada (breakpoint)`: `≥ 1024 px` (`lg:`) ativa menu lateral e layout de computador; `< 1024 px` mantém 100% o layout de celular com barra inferior.
- `2026-11-04 — Fase 3C — Menu lateral`: Aberto por padrão (248 px), com botão para recolher (76 px só ícones) salvando preferência no `localStorage`.
- `2026-11-04 — Fase 3C — Uso na TV (≥ 1920 px)`: Visualização à distância + navegação completa por teclado/controle (`Tab`, setas, `Enter` e foco laranja bem destacado, sem depender de hover).
- `2026-11-04 — Fase 3C — Perfil, versão e Sair no desktop`: No rodapé do menu lateral.
- `2026-11-04 — Fase 3C — Atalhos de teclado`: Ativados no desktop quando fora de campos de texto (`N` = Nova Entrada, `S` = Nova Saída, `T` = Transferir, `L` = Lote do dia).
- `2026-11-04 — Fase 3B — Fontes de renda iniciais`: Lista padrão da v1.1 (*Corridas (99)*, *Venda 3D — Mercado Livre*, *Venda 3D — Presencial*, *Venda 3D — Bares e mercados*, *Outros ganhos*, *Aporte*).
- `2026-11-04 — Fase 3B — Contas sugeridas`: Mercado Livre → Conta 1; Bares/Mercados → Conta 2; Presencial/Outros → Conta 3; Aporte/Dinheiro → Bolso (todas editáveis na tela).
- `2026-11-04 — Fase 3B — Lançamentos antigos`: Manter como "Sem fonte" com opção de atribuir fonte depois.
- `2026-11-04 — Fase 3B — Gastos vinculados à fonte`: Sim, campo opcional "Ligar a uma fonte" para cálculo de lucro líquido real por fonte (ex.: filamento abatendo de Venda 3D).
- `2026-11-04 — Fase 3B — Tags rápidas dinâmicas`: Armazenadas e editáveis em Preferências com sugestões (#Filamento, #MercadoLivre, #99, #Gasolina, #Almoço).
- `2026-11-04 — Atualização v1.1 — Escopo de ganhos`: o app **não é só de corridas da 99**. Quer lançar ganhos de outras fontes (venda de peças 3D com 2 impressoras: Mercado Livre, pessoalmente, em bares, em supermercados; e outras rendas) e **colocar dinheiro** (aporte) como entrada → nasce **Fonte de renda** + **Aporte** (Fase 3B).
- `2026-11-04 — Atualização v1.1 — Layout`: no **computador/notebook/TV** quer dashboard na primeira página e **menu lateral**; ao ficar em tela pequena (responsivo) volta **exatamente como está hoje** (barra de botões embaixo). O layout de celular **não pode mudar** (Fase 3C e 4).
- `2026-11-04 — Atualização v1.1 — Método`: não apagar comandos/fases antigas; fases novas 3B e 3C; PRD e SKILL passam a mandar ler `ATUALIZACAO-v1.1.md`.
- `2026-11-03 — Fase 3 — Ordem dos campos na Entrada Rápida`: **Valor (R$)** primeiro e **Forma de pagamento** logo abaixo (com a conta destino já preenchida automaticamente).
- `2026-11-03 — Fase 3 — Cálculo de taxa`: Calcula automaticamente pela % configurada na forma de pagamento e permite ajustar manualmente na hora do lançamento.
- `2026-11-03 — Fase 3 — Lote do fim do dia`: **5 linhas vazias** de início + botão *"Adicionar linha"* + total do lote visível + salvamento atômico (tudo ou nada).
- `2026-11-03 — Fase 3 — Data e hora do lançamento`: Padrão sempre **"Agora"** (data/hora atual) com opção de trocar quando quiser lançar retroativo.
- `2026-11-03 — Fase 3 — Observações e busca`: Busca por texto nas observações + botões de tags rápidas (*#Uber, #99, #Particular, #Gorjeta, #Gasolina, #Almoço*).
- `2026-11-03 — Fase 2 — Contas e saldos iniciais`: Padrão (*Conta 1, Conta 2, Conta 3* tipo `bank` e *Bolso (dinheiro)* tipo `cash`), saldo inicial `R$ 0,00` (editáveis na tela).
- `2026-11-03 — Fase 2 — Formas de pagamento e taxas`: Padrão (*Maquininha (cartão)* → Conta 1, *Pix* → Conta 2, *Online (app)* → Conta 3, *Dinheiro* → Bolso), taxas iniciais `0%` (editáveis com casas decimais na tela).
- `2026-11-03 — Fase 2 — Categorias de saída`: Manter as 6 padrão (*Abastecimento, Alimentação, Peça de carro, Manutenção, Lavagem, Gasto avulso*).
- `2026-11-03 — Fase 2 — Preferências padrão`: Semana começa na Segunda-feira (`week_starts_on = 1`) e Som LIGADO (`sound_enabled = true`) por padrão.
- `2026-11-03 — Fase 2 — Cores das contas`: Paleta automática de alto contraste no dark (Laranja `#FF7A1A`, Azul `#38BDF8`, Roxo `#A855F7`, Verde `#2EE59D`) com seletor na tela.
- `2026-11-03 — Fase 1 — Nome final do app`: **Cona Cash**
- `2026-11-03 — Fase 1 — Logo e ícone`: Usar as logos oficiais da **Cona** já presentes na pasta (`logo_preto.png`, `logo_branco.png`, `logo_transparente.png`)
- `2026-11-03 — Fase 1 — Paleta de cores`: Confirmada paleta do PRD + Logo (Fundo Dark `#0B0B0D`, Laranja `#FF7A1A`, Amarelo `#FFC940`, Vermelho `#FF3B30`, Verde `#2EE59D` nos positivos)
- `2026-11-03 — Fase 1 — Estilo visual`: Seguir estilo do PRD (minimalista/futurista dark com vidro fosco e borda brilhante animada)
- `2026-11-03 — Fase 1 — Contas e deploy`: GitHub (`https://github.com/netootavio204/cona_cash.git`), Supabase (`okcxwxmqvfpgstdhpgvm`) e Vercel já conectada ao GitHub. E-mail do Admin (`netootavio204@gmail.com`) configurado no trigger para já nascer como Admin aprovado.

## REGISTRO (mais recente em cima)
- `2026-11-04 15:05 | Fase 4 | Backup JSON salvo, migration 004_reports.sql aplicada idempotente com RPC get_financial_report, criação de ReportsPage.tsx (períodos dia/semana/mês/personalizado, KPIs com % vs anterior, filtros por fonte e Lucro Real), gráficos MiniBarChart.tsx e DonutChart.tsx em SVG puro, exportador exportPdf.ts (jsPDF + autoTable com branding oficial), bloco de 7 dias e lucro por fonte no Dashboard inicial (HomePage.tsx) | supabase/004_reports.sql, app/src/types/database.ts, app/src/api/supabase.ts, app/src/components/ui/MiniBarChart.tsx, app/src/components/ui/DonutChart.tsx, app/src/utils/exportPdf.ts, app/src/features/reports/ReportsPage.tsx, app/src/features/home/HomePage.tsx, app/src/config/version.ts | Vitest 7/7 PASS, E2E Playwright + PDF PASS, Regressão Responsiva (320px a 1280px) 12/12 PASS, Build PASS`
- `2026-11-04 12:07 | Fase 3C | Criação de docs/LAYOUT.md, Sidebar.tsx (menu lateral recolhível 248px/76px com persistência em localStorage, navegação por setas, atalho Painel Admin e rodapé com perfil/versão/Sair), Top Bar Desktop e grid 12 colunas em HomePage.tsx, Tabela Desktop completa em TransactionsPage.tsx, grids responsivos lg: em ConfigPage.tsx, atalhos de teclado (N/S/T/L/Esc) e foco/tipografia para TV 1920x1080 em index.css | docs/LAYOUT.md, docs/regressao/*, app/src/components/ui/Sidebar.tsx, app/src/components/ui/BottomNav.tsx, app/src/components/ui/Modal.tsx, app/src/components/ui/Card.tsx, app/src/features/home/HomePage.tsx, app/src/features/transactions/TransactionsPage.tsx, app/src/features/config/ConfigPage.tsx, app/src/index.css | Regressão Mobile 20/20 PASS (0 bytes diff), Desktop/TV 13/13 PASS, Vitest 7/7 PASS, Build PASS`
- `2026-11-04 10:06 | Fase 3B | Backup JSON salvo, migration 003b_income_sources.sql aplicada 2x no Supabase (idempotente), CRUD de Fontes de Renda/Aportes em ConfigPage.tsx, botão "+ Sugestões 3D" em Categorias, Tags Rápidas editáveis em Preferências, seletor de Fonte na Entrada Rápida/Lote/Edição + vínculo opcional na Saída, filtro por fonte + edição em massa para "Sem fonte" em TransactionsPage.tsx e cálculo de ganhos excluindo Aportes | supabase/003b_income_sources.sql, app/src/types/database.ts, app/src/api/supabase.ts, app/src/features/config/ConfigPage.tsx, app/src/features/transactions/*, app/src/features/home/HomePage.tsx, app/src/utils/format.ts | Vitest 7/7 PASS, Supabase Integration 7/7 + Regressão Planilha PASS, Build PASS`
- `2026-11-04 | Atualização v1.1 | Planejamento feito no chat (não pelo agente): análise do diário, PRD v1.1, SKILL v1.1, novas FASE-3B e FASE-3C, FASE-4/5/6 ajustadas e ATUALIZACAO-v1.1.md | PRD.md, 00-SKILL.md, DIARIO.md, FASE-3B.md, FASE-3C.md, FASE-4.md, FASE-5.md, FASE-6.md, ATUALIZACAO-v1.1.md | Nenhum código alterado`
- `2026-11-03 15:16 | Fase 3 | Migration 003_transactions.sql aplicada no Supabase + criação de TransactionModals.tsx (Entrada Rápida, Saída, Transferência, Lote do Dia com 5 linhas e Histórico de Auditoria), TransactionsPage.tsx (filtros, busca, paginação 50, Lixeira com restaurar e Desfazer 6s), botão de troca de senha nas Preferências e conferência de 10 lançamentos | supabase/003_transactions.sql, app/src/features/transactions/*, app/src/features/home/HomePage.tsx, app/src/features/config/ConfigPage.tsx | Vitest 5/5 PASS, Supabase Integration 6/6 + 10 Lançamentos PASS, Build PASS`
- `2026-11-03 13:58 | Fase 2 | Migration 002_config.sql aplicada automaticamente no Supabase + criação de ConfigPage.tsx (Contas, Formas/Taxas decimais, Categorias com ícones/cores, Preferências e Painel Admin com confirmação), CampoMoeda.tsx e CategoryIcon.tsx | supabase/002_config.sql, app/src/features/config/ConfigPage.tsx, app/src/components/ui/CampoMoeda.tsx, app/src/components/ui/CategoryIcon.tsx, app/src/features/home/HomePage.tsx | Vitest 4/4 PASS, Supabase Integration 6/6 PASS, Build PASS`
- `2026-11-03 13:50 | Fase 2 | Entrevista da Fase 2 concluída com o Octavio; decisões registradas no diário | DIARIO.md | OK`
- `2026-11-03 13:30 | Fase 1 | Migration 001_base.sql aplicada no Supabase e bateria de testes de integração executada (status pending, RLS isolamento A vs B, bloqueio de auto-promoção, bloqueio de cadastro quando signup_open=false, auto-aprovação do e-mail admin netootavio204@gmail.com) | public.app_settings, public.profiles, supabase/001_base.sql, DIARIO.md | 100% PASS`
- `2026-11-03 13:03 | Fase 1 | Criação completa do projeto /app (Vite+React+TS+Tailwind+Framer Motion), Design System (Botao, Card, Campo, Modal, Snackbar, ValorMoeda, BottomNav) com regra anti-vazamento PRD 7.1, telas de Auth/Aprovação/Home e migrations SQL | /app/*, /supabase/001_base.sql, /supabase/001_admin_octavio.sql, .gitignore, .env.example, vercel.json | Vitest 2/2 PASS, Build code-splitting PASS`
- `2026-11-03 12:52 | Fase 1 | Entrevista da Fase 1 respondida pelo Octavio; decisões registradas | DIARIO.md | OK`
- `2026-11-03 12:34 | Fase 1 | Leitura inicial dos arquivos de especificação, análise das logos (Cona) e recebimento do repositório GitHub e projeto Supabase | DIARIO.md | OK`

## PROBLEMAS EM ABERTO
(descrever erro, o que já tentou, próximo passo)
- Confirmar se o deploy da Vercel está no ar e registrar a URL abaixo (campo ainda está como "aguardando primeiro deploy").
- Confirmar que o repositório GitHub é **privado** (este diário contém o e-mail do admin).

## DADOS DE AMBIENTE (sem senhas/chaves!)
- Repositório GitHub: `https://github.com/netootavio204/cona_cash.git`
- URL Vercel: aguardando primeiro deploy automático
- Projeto Supabase (nome/região): `okcxwxmqvfpgstdhpgvm` (`https://okcxwxmqvfpgstdhpgvm.supabase.co`)
- Admin inicial (e-mail): `netootavio204@gmail.com`
