# 00 — SKILL (regras do agente) — LEIA ANTES DE QUALQUER COISA

Você é o agente de IA que vai construir o app **Cona Cash** (antes chamado Caixa Simples) para o Octavio.
Octavio **não é programador**: fale em português (pt-BR), de forma simples, direta e curta.

## Ordem de leitura (sempre que abrir esta pasta)
1. `00-SKILL.md` (este arquivo)
2. `DIARIO.md` — descubra em que fase/passo parou. **Nunca recomece do zero.**
3. `ATUALIZACAO-v1.1.md` — o que mudou na versão 1.1 e a **nova ordem de execução**
4. `PRD.md` (versão 1.1) — a fonte da verdade do produto
5. O arquivo da fase atual (`FASE-1.md`, `FASE-2.md`, `FASE-3.md`, `FASE-3B.md`, `FASE-3C.md`, `FASE-4.md`, `FASE-5.md`, `FASE-6.md`)

## Regras de ouro
1. **Entreviste antes de construir.** No início de CADA fase, faça as perguntas da seção "Entrevista" do arquivo da fase (máx. 5 por vez, com opções de resposta quando possível). Não assuma nada que o PRD não diga.
2. **Aprovação obrigatória.** Ao terminar uma fase, apresente o resumo + checklist de aceite e **espere o "APROVADO" do Octavio**. Sem aprovação, não comece a próxima fase.
3. **Diário sempre atualizado.** Antes de começar, a cada passo relevante e ao terminar, atualize `DIARIO.md` (formato definido nele). Se o Octavio pausar, o diário deve bastar para você retomar.
4. **Não quebre o que já funciona.** Mudanças novas = branch/commit pequeno, testar antes de seguir. Nunca apagar tabela/dado sem backup e sem pedir.
5. **Funcionalidade antes de enfeite.** Se um efeito visual atrapalhar o desempenho ou a função, simplifique.
6. **Comandos prontos para a IDE.** Quando o Octavio precisar rodar algo (terminal, SQL do Supabase), entregue em bloco de código pronto para copiar, com 1 linha dizendo onde colar. Sem explicação longa.
7. **Segurança primeiro.** Nunca colocar chaves secretas no código nem no GitHub (use `.env` e variáveis da Vercel). A `service_role` do Supabase NUNCA vai para o front-end.
8. **Teste de verdade.** Cada fase termina com os testes do checklist rodados e o resultado informado ao Octavio (passou/falhou).
9. **Se travar ou der erro**: registre no diário (seção "Problemas"), explique em 2 linhas e proponha a correção. Não esconda erro.
10. **Versão visível.** O app mostra a versão (ex.: `v0.1.0 beta`) no rodapé/configurações. Suba a versão a cada entrega.

## Stack definida (não trocar sem perguntar)
- Front-end: **React + TypeScript + Vite**, **Tailwind CSS**, animações com **Framer Motion** (leve)
- Back-end/banco/login: **Supabase** (Postgres + Auth + RLS)
- PWA: `vite-plugin-pwa`
- PDF: gerado no navegador (`jsPDF` + `jspdf-autotable`) 
- Som: **Web Audio API** (sons gerados por código, sem arquivos pesados)
- Deploy: **GitHub → Vercel** (deploy automático a cada push na `main`)
- APK (depois): **Capacitor**, reaproveitando 100% do código web e o mesmo Supabase

## Estrutura de pastas sugerida do projeto
```
/ (raiz da pasta)
  00-SKILL.md  PRD.md  FASE-1..6.md  DIARIO.md
  /app            <- código do web app (Vite)
  /supabase       <- migrations .sql versionadas
  /APK            <- (futuro) Capacitor/Android
```

## Regras da ATUALIZAÇÃO v1.1 (valem a partir da Fase 3B)
11. **Não apague nem refaça o que já funciona** (Fases 1–3). Mudanças são **aditivas**: migrations com `create table if not exists` / `add column if not exists`, nunca `drop`, nunca renomear coluna existente. Antes de cada migration, entregue ao Octavio o comando de **backup/exportação** e só aplique depois do OK.
12. **Layout de celular é INTOCÁVEL.** Antes de mexer em qualquer tela, gere capturas "antes" (320, 360, 412, 768, 1023 px). Alterações de desktop usam **apenas** classes `lg:` / `xl:` / `2xl:`. Ao final, compare "antes × depois": abaixo de 1024 px a diferença tem que ser **zero**.
13. **O app não é só de corridas.** Não escreva textos, tags ou nomes fixos ligados a 99/Uber no código. Tudo que for "de onde veio o dinheiro" usa **Fonte de renda** (editável).
14. **Ganho ≠ Aporte.** Só fontes com `counts_as_earning = true` entram em relatórios de ganho e metas de ganho. Aporte entra no saldo, não no ganho.
15. **Ordem das fases novas**: 3 (aprovação) → **3B** → **3C** → 4 → 5 → 6. Cada uma com entrevista e aprovação do Octavio.
16. Ao concluir cada fase, **registre no DIARIO.md** a versão (`v0.3.1`, `v0.3.2`, `v0.4.0`…), e confirme que o deploy da Vercel está no ar com a mesma versão.
