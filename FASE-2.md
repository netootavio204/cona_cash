# FASE 2 — Configurações e área admin

## Entrevista
1. Nomes reais das 3 contas (bancos) e do bolso? Têm saldo inicial hoje? (valor de cada)
2. Taxa da maquininha (% débito/crédito) e se Pix/online têm taxa. Qual conta recebe cada forma de pagamento?
3. Categorias de saída: manter as padrão (Abastecimento, Alimentação, Peça de carro, Manutenção, Lavagem, Gasto avulso) ou ajustar?
4. Dia de início da semana (segunda?) e som ligado por padrão?
5. Quer cores/ícones específicos nas contas?

## Objetivo
Tudo que é "cadastro" fica editável pelo usuário, e o admin controla usuários e o cadastro.

## Entregáveis
1. Migration `002_config.sql`: `accounts`, `payment_methods`, `categories` + RLS + valores padrão criados automaticamente para cada usuário aprovado.
2. Tela **Contas**: criar, editar (nome, tipo, cor, saldo inicial), arquivar/restaurar; excluir só se não houver lançamentos.
3. Tela **Formas de pagamento**: nome, conta destino padrão, taxa %, arquivar.
4. Tela **Categorias**: nome, ícone, cor, arquivar.
5. Tela **Preferências**: som, primeiro dia da semana.
6. **Painel Admin** (só admin): lista de usuários com Aprovar/Bloquear/Reativar; **botão "Cadastro de novos usuários: ABERTO/FECHADO"** (atualiza `app_settings.signup_open`; com confirmação).
7. Valores em centavos, máscara de moeda R$ nos campos.
8. Diário atualizado.

## Checklist de aceite
- [ ] Criar/editar/arquivar conta, forma e categoria funciona e persiste
- [ ] Taxa % aceita decimais (ex.: 3,49) e salva corretamente
- [ ] Botão de cadastro fecha de verdade (tela some e API recusa) e reabre
- [ ] Aprovar/bloquear usuário muda o acesso imediatamente
- [ ] Usuário comum NÃO vê o painel admin (testar acessando a rota direto)
- [ ] Textos longos de nomes não vazam
- [ ] Diário atualizado

## Aprovação
Resumo + checklist → aguarde **"APROVADO"**.
