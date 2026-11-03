# PRD — Caixa Simples (nome provisório)
Versão do documento: 1.0 | Status: BETA (uso só do Octavio, preparado para vários usuários)

## 1. Visão
App **simples** para quem recebe de várias formas e em várias contas (ex.: motorista de aplicativo) controlar **o que entra e o que sai**, ver o saldo de cada conta, acompanhar metas e consultar relatórios. Prioridade: **fácil de entender, rápido de usar, nunca quebrar**.

Primeiro um **web app (PWA)**; depois um **APK Android** (Capacitor) usando o **mesmo banco Supabase**.

## 2. Usuários
- **Usuário comum**: vê e edita só os próprios dados.
- **Admin**: tudo do usuário comum + aprova/bloqueia usuários + liga/desliga o link de cadastro. O primeiro admin é criado manualmente (SQL entregue pelo agente).
- Beta: só o Octavio usa; a estrutura multiusuário já nasce pronta (toda tabela tem `user_id` e RLS).

## 3. Conceitos
- **Conta**: onde o dinheiro fica. Padrão inicial: *Conta 1, Conta 2, Conta 3* (renomeáveis para nomes de banco), *Bolso (dinheiro)*. Tipo: `banco` ou `dinheiro`. Pode ser arquivada (não apagada se tiver lançamentos).
- **Forma de pagamento (origem da entrada)**: padrão *Maquininha (cartão)*, *Pix*, *Online (app)*, *Dinheiro*. Cada uma tem: **conta de destino padrão** e **taxa %** (padrão 0%). Ex.: Maquininha → Conta 1, taxa configurável; Pix → Conta 2; Online → Conta 3; Dinheiro → Bolso.
- **Categoria de saída**: padrão *Abastecimento, Alimentação, Peça de carro, Manutenção, Lavagem, Gasto avulso* (editáveis, com ícone e cor).
- **Lançamentos**: `entrada`, `saida`, `transferencia`.
- **Saldo da conta** = saldo inicial + entradas líquidas − saídas ± transferências.

## 4. Requisitos funcionais

### 4.1 Login e cadastro
- E-mail + senha (Supabase Auth). Recuperar senha por e-mail.
- Novo cadastro nasce com status `pendente` e **não entra no app** até o admin aprovar. Tela "Aguardando aprovação".
- Admin: lista de usuários (pendente/aprovado/bloqueado) com botões Aprovar, Bloquear, Reativar.
- **Botão no painel admin: "Cadastro de novos usuários: ABERTO/FECHADO"**. Fechado = o link/tela de cadastro some **e** o servidor recusa novos cadastros (validação no banco, não só esconder o botão).
- Sessão persistente; botão Sair.

### 4.2 Entradas (ganhos)
- **Lançamento rápido (um valor)**: valor, forma de pagamento (conta destino vem sugerida, editável), data/hora (padrão agora), observação opcional.
- **Lançamento em lote (fim do dia)**: tela com várias linhas (valor + forma de pagamento + conta), botão "adicionar linha", total do lote visível, salvar tudo de uma vez.
- Taxa: se a forma de pagamento tem taxa %, o app guarda **valor bruto**, **taxa (R$)** e **valor líquido** (o que cai na conta). A taxa pode ser ajustada manualmente no lançamento. O valor líquido é o que soma no saldo.
- Tudo editável e excluível.

### 4.3 Saídas (gastos)
- Valor, categoria, **conta de onde saiu**, data/hora, observação.
- Tudo editável e excluível.

### 4.4 Transferências
- Valor, conta origem, conta destino (diferentes), data/hora, observação. Ex.: tirar da Conta 1 e pôr no Bolso.
- Não conta como entrada nem saída nos relatórios de ganho/gasto; só move saldo.

### 4.5 Histórico e segurança dos dados
- **Observação** em todo lançamento.
- **Exclusão = lixeira** (soft delete): lançamento excluído some das telas e dos totais, mas fica registrado.
- **Log de auditoria** (`audit_log`): toda criação/edição/exclusão grava quem, quando (data/hora), antes e depois. Tela "Histórico" do lançamento mostra as alterações.
- Confirmação antes de excluir. Opção de desfazer logo após excluir (snackbar de 6 s).

### 4.6 Metas (simples, fáceis de entender)
Três tipos, cada um com período **diário, semanal ou mensal**:
1. **Meta de ganho**: "ganhar R$ X no período". Progresso = soma das entradas **líquidas** do período ÷ X.
2. **Limite de gastos**: "gastar no máximo R$ X". Progresso = soma das saídas do período ÷ X. Verde até 80%, amarelo 80–100%, vermelho acima (estourou).
3. **Meta de economia**: "guardar R$ X". Progresso = (entradas líquidas − saídas) do período ÷ X, mínimo 0.
- Barra de progresso **que realmente enche**, com % e "faltam R$ …". Cálculos centralizados em UM módulo (`goalProgress`) com **testes automatizados** (o app anterior do Octavio teve barra que não funcionava: isto é critério de aceite crítico).
- Ao bater a meta: **efeito visual** (confete) + **efeito sonoro** (som curto de conquista) uma única vez por meta/período; ícone de medalha na meta batida. Opção "som ligado/desligado" nas configurações.
- Metas editáveis, pausáveis e excluíveis.

### 4.7 Dashboard (tela inicial)
- Saldo total + saldo de cada conta (cards).
- Hoje: entradas líquidas, saídas, resultado.
- Barras das metas ativas.
- Botões grandes: **+ Entrada**, **+ Saída**, **Transferir**, **Lote do dia**.
- Últimos 10 lançamentos.

### 4.8 Relatórios
- Períodos: **Dia, Semana, Mês** (com navegação anterior/próximo) e intervalo personalizado.
- Mostra: total bruto, taxas pagas, total líquido, total de saídas, resultado, entradas por forma de pagamento, entradas por conta, saídas por categoria, lista de lançamentos.
- Gráficos simples e leves (barras/rosca).
- **Exportar PDF** do relatório (visual limpo, com período, totais e lista), pelo navegador.

### 4.9 Configurações (área administrativa do usuário)
- Contas (criar, editar, arquivar), saldo inicial.
- Formas de pagamento (nome, conta destino padrão, taxa %).
- Categorias de saída (nome, ícone, cor).
- Metas.
- Preferências: som ligado/desligado, moeda (R$), primeiro dia da semana.
- Painel **Admin** (só para admin): usuários, botão de cadastro aberto/fechado.
- Versão do app visível.

## 5. Requisitos não funcionais
- **Dinheiro em centavos** (inteiro) no banco — nunca `float`.
- **Fuso horário** America/Sao_Paulo para "dia/semana/mês"; semana começa na segunda (configurável).
- **RLS ativada em todas as tabelas**: `user_id = auth.uid()`; admin só acessa o que o PRD permite (usuários/configuração), não os lançamentos dos outros.
- **Desempenho**: carregamento inicial rápido (code-splitting por página), listas paginadas (50 por vez), índices em `(user_id, occurred_at)`, agregações de relatório no banco (view/função SQL), não no navegador.
- **Preparado para o futuro**: migrations SQL versionadas em `/supabase`, campo `schema_version`/versão do app, tipos TypeScript gerados do banco, código separado por módulos (`features/`), camada `api/` isolada (para o APK reutilizar).
- **Offline (básico)**: app abre offline (PWA) mostrando o último estado; lançamento offline completo fica como melhoria futura (registrar no diário).
- **Acessibilidade**: alvos de toque ≥ 44 px, contraste adequado, textos legíveis.

## 6. Modelo de dados (Supabase / Postgres)
Todas com `id uuid pk`, `created_at`, `updated_at`; valores em **centavos (bigint)**.
- `profiles`: `id` (= auth.users.id), `name`, `email`, `role` (`user`|`admin`), `status` (`pending`|`approved`|`blocked`), `sound_enabled`, `week_starts_on`.
- `app_settings` (1 linha): `signup_open boolean`.
- `accounts`: `user_id`, `name`, `type` (`bank`|`cash`), `initial_balance_cents`, `color`, `archived`.
- `payment_methods`: `user_id`, `name`, `default_account_id`, `fee_percent numeric(5,2)`, `archived`.
- `categories`: `user_id`, `name`, `icon`, `color`, `archived`.
- `transactions`: `user_id`, `kind` (`income`|`expense`|`transfer`), `occurred_at timestamptz`, `account_id` (conta afetada / origem), `to_account_id` (só transferência), `payment_method_id` (entrada), `category_id` (saída), `gross_cents`, `fee_cents`, `net_cents`, `note`, `batch_id` (lote), `deleted_at` (lixeira).
- `goals`: `user_id`, `type` (`income`|`spending_limit`|`savings`), `period` (`day`|`week`|`month`), `target_cents`, `active`, `celebrated_periods jsonb` (períodos já comemorados).
- `audit_log`: `user_id`, `table_name`, `record_id`, `action` (`create`|`update`|`delete`|`restore`), `before jsonb`, `after jsonb`, `at timestamptz`.
- Triggers: criar `profiles` ao cadastrar (status `pending`); **bloquear cadastro quando `signup_open=false`**; popular padrões (contas, formas, categorias) na aprovação/criação; gravar `audit_log` em `transactions`.
- Funções/views: saldo por conta; resumo por período (totais, por forma, por conta, por categoria); progresso de metas.

## 7. Design e experiência
- **Tema dark** principal: fundo preto/grafite (#0B0B0D), **laranja** (#FF7A1A) como cor de destaque, vermelho (#FF3B30) e amarelo (#FFC940) como apoio, **verde** (#2EE59D) para positivo/meta batida. Opcional tema claro depois.
- Estilo **minimalista e futurista**: cards com vidro fosco (blur), **bordas com brilho animado** (gradiente laranja→amarelo girando devagar), transições suaves, números que "contam" ao mudar, microanimações nos botões. Respeitar "reduzir movimento" do sistema.
- Fonte moderna e legível (ex.: Inter/Sora), números tabulares.
- Mobile-first, funciona em qualquer Android (de 320 px de largura para cima) e também no desktop.
- Navegação inferior (Início, Lançamentos, Relatórios, Metas, Config).

### 7.1 REGRA ANTI-VAZAMENTO DE TEXTO (obrigatória)
- Todo texto dentro de botão/card/campo usa `min-width:0`, `overflow:hidden`, `text-overflow:ellipsis` ou `line-clamp`; botões nunca estouram a largura.
- Componente único `<Botao>` com texto que **encolhe automaticamente** (fonte com `clamp()`; se ainda não couber, reduz e depois corta com "…" e mostra o texto completo em tooltip/aria-label).
- Valores em R$ longos usam fonte que se ajusta (`clamp`) e abreviam (ex.: R$ 1,2 mil) só no card pequeno, com valor completo ao tocar.
- Testar em 320, 360, 390, 412 px e com fonte do sistema aumentada. **Critério de aceite em todas as fases.**

## 8. Deploy e versões
- Código no **GitHub**; **Vercel** conectada ao repositório (deploy automático da `main`, preview nas branches).
- Variáveis na Vercel: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- Versão semântica visível no app; `CHANGELOG` no diário.

## 9. Fora do escopo (por enquanto)
Integração automática com bancos/Open Finance, notificações push, lançamento offline completo, múltiplas moedas, compartilhamento de dados entre usuários, app para iPhone.

## 10. Critérios gerais de sucesso do BETA
1. O Octavio lança entrada, saída e transferência em menos de 15 segundos.
2. Saldos de todas as contas conferem com o que ele espera.
3. Barras de meta enchem e o efeito dispara ao bater.
4. Nenhum texto vaza em nenhuma tela de 320 a 430 px.
5. Relatório do dia/semana/mês confere e exporta em PDF.
6. Cadastro precisa de aprovação do admin; o botão fecha o cadastro de verdade.
