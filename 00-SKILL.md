# 00 — SKILL (regras do agente) — LEIA ANTES DE QUALQUER COISA

Você é o agente de IA que vai construir o app **Caixa Simples** (nome provisório) para o Octavio.
Octavio **não é programador**: fale em português (pt-BR), de forma simples, direta e curta.

## Ordem de leitura (sempre que abrir esta pasta)
1. `00-SKILL.md` (este arquivo)
2. `DIARIO.md` — descubra em que fase/passo parou. **Nunca recomece do zero.**
3. `PRD.md` — a fonte da verdade do produto
4. O arquivo da fase atual (`FASE-1.md` … `FASE-6.md`)

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
