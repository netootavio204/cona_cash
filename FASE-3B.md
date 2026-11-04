# FASE 3B — Fontes de renda (o app deixa de ser só de corridas)

> Ajuste da v1.1. Vem **depois** do "APROVADO" da Fase 3 e **antes** da 3C. Não apague nada da Fase 3: tudo aqui é **aditivo**.
> Leia 00-SKILL.md, ATUALIZACAO-v1.1.md, DIARIO.md e PRD.md (v1.1). Depois faça a ENTREVISTA.

## Entrevista (máx. 5 perguntas por vez, com opções)
1. Fontes de renda iniciais: manter a lista padrão (*Corridas (99)*, *Venda 3D — Mercado Livre*, *Venda 3D — Presencial*, *Venda 3D — Bares e mercados*, *Outros ganhos*, *Aporte*)? Quer trocar nomes ou tem outras fontes?
2. Para cada fonte, qual forma de pagamento/conta é a padrão? (ex.: Mercado Livre cai em qual conta?)
3. Os lançamentos de teste que já existem (sem fonte): marcar todos como "Corridas (99)", deixar como "Sem fonte" ou apagar os de teste?
4. Quer ligar gastos a uma fonte (ex.: filamento → Venda 3D) para ver o **lucro por fonte**?
5. Tags rápidas: manter #Uber, #99, #Particular, #Gorjeta, #Gasolina, #Almoço ou trocar por outras?

## Objetivo
Permitir lançar ganhos de **qualquer fonte** e **aportes** (dinheiro colocado), sem perder nada do que já funciona.

## Entregáveis
1. **Backup antes de tudo**: entregue ao Octavio o comando/SQL de exportação de `transactions`, `accounts`, `payment_methods`, `categories`. Só aplique a migration depois do OK dele.
2. Migration `003b_income_sources.sql` — **idempotente e aditiva** (`create table if not exists`, `add column if not exists`; sem `drop`, sem renomear): tabela `income_sources`, coluna `transactions.income_source_id`, `profiles.quick_tags text[]`, RLS por `user_id`, função/trigger que cria as fontes padrão para cada usuário (e para o Octavio já existente). SQL entregue em bloco pronto para colar no SQL Editor.
3. **Config → Fontes de renda**: criar, editar (nome, ícone, cor, forma de pagamento padrão, chave **"conta como ganho"**), arquivar/restaurar; excluir só se não houver lançamentos.
4. **Entrada rápida, Lote do dia e Edição**: novo campo **Fonte** (logo depois do Valor). Escolher a fonte preenche forma e conta sugeridas (editáveis). No lote entra a coluna Fonte. Tela de celular mantém o mesmo visual, só com o campo novo.
5. **Aporte**: fonte com `counts_as_earning = false`; selo "Aporte" na lista; entra no saldo, **fica fora** dos totais de ganho.
6. **Saída**: campo opcional **"Ligar a uma fonte"**.
7. **Lista de lançamentos**: filtro por fonte e etiqueta colorida da fonte em cada linha ("Sem fonte" para os antigos, com opção de editar em massa).
8. **Tags rápidas editáveis** em Preferências (substituem as fixas).
9. **Sugestões de categorias para peças 3D** (Filamento, Manutenção da impressora, Embalagem, Frete, Taxas de marketplace) com botão "Adicionar sugestões" que não duplica.
10. Revisar **todos os textos do app**: nada fixo ligado a corridas/99/Uber (usar as fontes cadastradas).
11. Testes (Vitest + integração Supabase), diário, versão **v0.3.1 beta**, deploy conferido.

## Checklist de aceite
- [ ] Rodar a migration duas vezes não dá erro (idempotente)
- [ ] **Regressão de saldos**: com os dados de teste da planilha da Fase 3, os saldos continuam **C1 R$ 216,51 | C2 R$ 40,00 | C3 R$ 70,00 | Bolso R$ 45,00 | Total R$ 371,51**
- [ ] Lançar R$ 100 em "Venda 3D — Mercado Livre" sugere forma/conta certas e soma no saldo
- [ ] Aporte de R$ 50 soma no saldo e **não** aparece nos totais de ganho
- [ ] Filtro por fonte funciona; "Sem fonte" aparece nos antigos
- [ ] Fonte arquivada some das opções novas, mas continua nos lançamentos antigos
- [ ] RLS: usuário A não vê fontes/lançamentos do usuário B
- [ ] Layout de celular igual ao anterior, só com o campo novo; textos não vazam (320/360/412)
- [ ] Diário atualizado

## Aprovação
Resumo + checklist → aguarde **"APROVADO"**.
