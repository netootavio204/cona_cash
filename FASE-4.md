# FASE 4 — Dashboard, saldos e relatórios + PDF (v1.1)

> Atualizada na v1.1: dashboard nos **dois layouts** e relatórios por **fonte de renda**. Parte do que a 3B (fontes) e a 3C (layout) já entregaram.

## Entrevista
1. No computador, quais blocos você quer ver primeiro? (sugestão: KPIs, ganhos por dia, ganhos por fonte, saldos por conta, últimos lançamentos)
2. Quais gráficos ajudam mais: rosca de gastos por categoria, barras de ganho por dia, rosca por fonte? Todos?
3. No PDF: logo da Cona no topo? Incluir lista completa de lançamentos? Mostrar quebra por fonte?
4. Semana vai de segunda a domingo? Mês é o mês do calendário?
5. Quer comparar período atual × anterior e ver o lucro por fonte (ganhos − gastos ligados à fonte)?

## Objetivo
Mostrar a situação do dinheiro de relance (celular e computador) e permitir relatórios confiáveis, separando **ganho** de **aporte**.

## Entregáveis
1. Migration `004_reports.sql` (aditiva): funções/views SQL de resumo por período — totais, por **fonte**, por forma, por conta, por categoria, por dia, **lucro por fonte**; ganhos consideram só fontes com `counts_as_earning = true`; aportes saem separados.
2. **Dashboard — celular (< 1024 px)**: mantém exatamente o visual atual e **adiciona blocos abaixo** (ganhos por fonte, lucro por fonte, metas quando existirem).
3. **Dashboard — computador/TV (≥ 1024 px)**: grade de painéis — KPIs (saldo total, ganhos hoje, saídas hoje, resultado), gráfico de ganhos por dia (7/30 dias), ganhos por fonte, gastos por categoria, saldos por conta, metas (espaço para a Fase 5) e tabela dos últimos lançamentos.
4. **Relatórios**: abas Dia | Semana | Mês | Personalizado, navegação anterior/próximo, filtro por fonte, totais (bruto, taxas, líquido, saídas, resultado), **aportes à parte**, quebras por fonte/forma/conta/categoria, gráficos leves. No computador: duas colunas.
5. **Exportar PDF** (jsPDF): cabeçalho com período, resumo, quebra por fonte, aportes, lista de lançamentos; paginação correta.
6. Fuso America/Sao_Paulo nos limites de dia/semana/mês (testar virada às 23:59/00:00).
7. Números animados e skeletons de carregamento.
8. Testes, diário, versão **v0.4.0 beta**, deploy conferido.

## Checklist de aceite
- [ ] Totais do relatório batem com a soma manual (3 períodos) e com a planilha de conferência das fases anteriores
- [ ] Aporte aparece só em "Aportes" e nunca nos ganhos
- [ ] Lucro por fonte = ganhos líquidos da fonte − gastos ligados a ela (conferir um caso real: venda 3D − filamento)
- [ ] Transferências não entram em ganho/gasto
- [ ] Lançamento às 23:59 cai no dia certo
- [ ] PDF abre no celular e no PC, sem texto cortado, várias páginas OK
- [ ] Relatório de mês com 500+ lançamentos abre em < 2 s
- [ ] Celular **idêntico** ao aprovado na 3C (comparação de imagens, diferença zero nos blocos antigos); computador correto em 1024/1280/1440/1920
- [ ] Textos/valores grandes não vazam (testar R$ 1.234.567,89)
- [ ] Diário atualizado

## Aprovação
Resumo + checklist → aguarde **"APROVADO"**.
