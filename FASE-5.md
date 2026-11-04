# FASE 5 — Metas, efeitos visuais e sons

## Entrevista
1. Quais metas você quer criar de cara (ex.: ganho diário, limite de gasto semanal, economia mensal)? Valores?
2. Som ao bater a meta: prefere "moedas", "sino" ou "fanfarra" curta?
3. Efeito visual: confete, brilho/fogos ou os dois? Medalhas bronze/prata/ouro por período (dia/semana/mês)?
4. Quando o limite de gastos estourar: só avisar na barra ou também alerta na tela?
5. Metas se repetem automaticamente a cada período? (sugestão: sim)
6. A meta de ganho deve ser geral ou você quer metas por fonte (ex.: R$ X por mês só em vendas 3D)? (as duas são possíveis)

## Objetivo
Metas simples, que **funcionam de verdade**, com recompensa visual e sonora.

## Entregáveis
1. Migration `005_goals.sql` (aditiva): `goals` (com `income_source_id` opcional) + RLS + função de progresso por período. Meta de ganho/economia considera **somente fontes que contam como ganho** (aportes ficam de fora).
2. Tela **Metas**: criar/editar/pausar/excluir os 3 tipos (ganho, limite de gastos, economia) × (dia, semana, mês).
3. Módulo único `goalProgress` (fórmulas do PRD 4.6) **com testes automatizados** (Vitest): 0%, 50%, 100%, acima de 100%, período virando, meta sem lançamentos.
4. **Barras de progresso** no Dashboard e na tela Metas: enchem de verdade, % e "faltam R$ …", cores (verde/amarelo/vermelho no limite de gastos).
5. **Celebração** ao bater: confete + som (Web Audio) + medalha; dispara **uma vez por meta/período** (usa `celebrated_periods`); respeita som ligado/desligado e "reduzir movimento".
6. Histórico de metas batidas (medalhas).
7. Diário atualizado.

## Checklist de aceite (CRÍTICO)
- [ ] Lançar um **aporte** de R$ 100 NÃO mexe na meta de ganho; lançar R$ 100 de venda 3D mexe
- [ ] Meta "só Venda 3D" ignora entradas de Corridas (99) e vice-versa
- [ ] Lançar entrada de R$ 100 com meta diária de R$ 200 → barra mostra 50% e "faltam R$ 100"
- [ ] Bater a meta dispara efeito + som uma única vez; recarregar NÃO repete
- [ ] Limite de gastos muda de verde → amarelo (80%) → vermelho (>100%)
- [ ] Meta de economia usa (entradas líquidas − saídas) e nunca mostra negativo
- [ ] Editar/excluir um lançamento atualiza a barra na hora
- [ ] Testes automatizados passam (mostrar a saída ao Octavio)
- [ ] **Se a barra não funcionar, REMOVER a barra em vez de entregar quebrada** (preferência do Octavio)
- [ ] Textos não vazam; som desliga nas preferências
- [ ] Barras e celebração funcionam no layout de celular **e** no de computador (≥ 1024 px)
- [ ] Diário atualizado

## Aprovação
Resumo + checklist → aguarde **"APROVADO"**.
