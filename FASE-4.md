# FASE 4 — Dashboard, saldos e relatórios + PDF

## Entrevista
1. O que você quer ver primeiro ao abrir o app? (saldo total, hoje, metas...)
2. Quais gráficos ajudam mais: rosca de gastos por categoria, barras de ganho por dia, ambos?
3. No PDF: quer logo/nome do app no topo? Incluir lista completa de lançamentos?
4. Semana vai de segunda a domingo? Mês é o mês do calendário?
5. Quer comparar período atual × anterior?

## Objetivo
Mostrar a situação do dinheiro de relance e permitir relatórios confiáveis.

## Entregáveis
1. Migration `004_reports.sql`: funções/views SQL de resumo por período (totais, por forma, por conta, por categoria, por dia).
2. **Dashboard**: saldo total, cards por conta, resumo de hoje, atalhos (+Entrada, +Saída, Transferir, Lote), últimos 10 lançamentos, espaço para barras de metas (preenchido na Fase 5).
3. **Relatórios**: abas Dia | Semana | Mês | Personalizado, navegação anterior/próximo, totais (bruto, taxas, líquido, saídas, resultado), quebras por forma/conta/categoria, gráficos leves.
4. **Exportar PDF** (jsPDF): cabeçalho com período, resumo, quebras e lista de lançamentos; paginação correta; visual limpo.
5. Fuso America/Sao_Paulo respeitado nos limites de dia/semana/mês (testar virada de dia às 23:59/00:00).
6. Números animados (contagem) e skeletons de carregamento.
7. Diário atualizado.

## Checklist de aceite
- [ ] Totais do relatório batem com a soma manual dos lançamentos (3 períodos)
- [ ] Transferências não entram em ganho/gasto
- [ ] Lançamento às 23:59 cai no dia certo
- [ ] PDF abre no celular e no PC, sem texto cortado, várias páginas OK
- [ ] Relatório de mês com 500+ lançamentos abre em < 2 s
- [ ] Textos/valores grandes não vazam nos cards (testar R$ 1.234.567,89)
- [ ] Diário atualizado

## Aprovação
Resumo + checklist → aguarde **"APROVADO"**.
