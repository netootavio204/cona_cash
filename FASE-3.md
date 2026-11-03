# FASE 3 — Lançamentos (entrada, saída, transferência)

## Entrevista
1. Na entrada rápida, qual campo você quer ver primeiro: valor ou forma de pagamento?
2. A taxa deve ser calculada automático pela % da forma e você pode ajustar na mão? (confirmar)
3. No lote do fim do dia, quantas linhas vazias aparecem de início? (sugestão: 5)
4. Quer lançar a data/hora sempre "agora" ou escolher com frequência outra data?
5. Quer tags/busca por texto nas observações?

## Objetivo
Registrar tudo que entra e sai, de forma rápida, com histórico seguro.

## Entregáveis
1. Migration `003_transactions.sql`: `transactions`, `audit_log`, triggers de auditoria, soft delete, índices `(user_id, occurred_at)`, função de saldo por conta.
2. **Entrada rápida** (valor, forma, conta, data/hora, observação) com cálculo bruto/taxa/líquido.
3. **Lote do dia**: várias linhas, total do lote, salvar tudo de uma vez (transação única: tudo ou nada).
4. **Saída**: valor, categoria, conta, data/hora, observação.
5. **Transferência**: origem ≠ destino, valor, data/hora, observação.
6. **Lista de lançamentos**: filtros (tipo, conta, categoria, período), busca na observação, paginação de 50.
7. **Editar** e **excluir** (lixeira + desfazer 6 s); tela **Lixeira** com restaurar; tela **Histórico** do lançamento (quem/quando/antes/depois).
8. Saldos das contas recalculando corretamente; botão flutuante de ação rápida.
9. Diário atualizado.

## Checklist de aceite
- [ ] Entrada com taxa: bruto − taxa = líquido; saldo soma só o líquido
- [ ] Transferência move saldo e NÃO aparece como ganho/gasto
- [ ] Lote salva tudo ou nada (simular erro no meio)
- [ ] Excluir some dos totais; restaurar volta
- [ ] Editar valor atualiza saldo e grava histórico com data/hora
- [ ] Conferir manualmente 10 lançamentos × saldo esperado (informar planilha de conferência no diário)
- [ ] Cada usuário vê só os seus (testar com 2 contas)
- [ ] Lançar em < 15 s no celular; textos não vazam
- [ ] Diário atualizado

## Aprovação
Resumo + checklist → aguarde **"APROVADO"**.
