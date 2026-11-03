# FASE 1 — Fundação, login e visual

> Antes de começar: leia 00-SKILL.md, DIARIO.md e PRD.md. Depois faça a ENTREVISTA.

## Entrevista (faça ao Octavio, em pt-BR, máx. 5 perguntas por vez)
1. Você já tem conta no GitHub, Supabase e Vercel? Qual e-mail usar como admin?
2. Qual nome final do app? (se não decidir, manter "Caixa Simples")
3. Quer logo/ícone próprio ou eu crio um simples laranja/preto?
4. Confirmar paleta (laranja/preto/amarelo/vermelho + verde nos positivos) ou mudar algo?
5. Alguma tela de referência/app que ele gosta do visual?

## Objetivo
Ter o projeto no ar (Vercel) com login funcionando, aprovação de usuários básica, banco criado e o design system pronto.

## Entregáveis
1. Projeto Vite + React + TS + Tailwind + Framer Motion criado em `/app`.
2. Repositório GitHub + deploy automático na Vercel (variáveis de ambiente configuradas).
3. Supabase: migration `001_base.sql` com `profiles`, `app_settings`, RLS, triggers (criar profile `pending`, bloquear cadastro se `signup_open=false`). SQL entregue em bloco pronto para colar no SQL Editor.
4. Telas: Login, Cadastro (some se fechado), Esqueci a senha, "Aguardando aprovação", e tela Início vazia protegida.
5. SQL para tornar o Octavio **admin aprovado** (entregue pronto).
6. **Design system**: tokens de cor, tipografia, componentes `Botao`, `Card` (vidro + borda animada), `Campo`, `Modal`, `Snackbar`, navegação inferior — todos com a REGRA ANTI-VAZAMENTO (PRD 7.1).
7. Rodapé/Config mostrando versão `v0.1.0 beta`.
8. `DIARIO.md` atualizado + `.env.example`.

## Checklist de aceite (rodar e informar)
- [ ] Cadastro novo cai em "aguardando aprovação" e não acessa o app
- [ ] Admin aprovado entra normalmente; sessão persiste ao recarregar
- [ ] Recuperar senha envia e-mail
- [ ] Com `signup_open=false`, tentar cadastrar é recusado pelo banco (testar via API também)
- [ ] RLS ativa: usuário A não lê dados do usuário B
- [ ] Nenhuma chave secreta no GitHub; `service_role` não usada no front
- [ ] Textos não vazam em 320/360/412 px (testar botões com texto longo)
- [ ] Deploy na Vercel abre no celular
- [ ] Diário atualizado

## Aprovação
Apresente resumo + checklist e aguarde **"APROVADO"** do Octavio. Registre no diário.
