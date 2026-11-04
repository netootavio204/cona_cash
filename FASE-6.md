# FASE 6 — PWA, otimização, testes e preparo do APK

## Entrevista
1. Quer que o app "instale" na tela inicial do celular (PWA) com ícone próprio? Nome que aparece sob o ícone?
2. Algum bug ou incômodo que você notou nas fases anteriores?
3. Quer tema claro além do escuro?
4. Para o APK: já tem Android Studio instalado? Qual Android do seu celular?
5. Algo que ficou de fora e você quer registrar como "futuro" (ex.: lançar offline, notificações)?

## Objetivo
Deixar o BETA estável, rápido, instalável e pronto para virar APK.

## Entregáveis
1. **PWA**: manifest, ícones (192/512/maskable), service worker, tela de instalação, abre offline mostrando último estado, aviso "nova versão disponível — atualizar".
2. **Otimização**: code-splitting por rota, imagens/ícones leves, auditoria Lighthouse (meta: Performance ≥ 90 e PWA ✓ no celular), revisão de índices e consultas lentas, paginação conferida.
3. **Segurança**: revisão de todas as políticas RLS (relatório curto), cabeçalhos de segurança na Vercel, nenhuma chave exposta, backup/exportação dos dados (botão "Exportar meus dados" em CSV/JSON).
4. **Testes**: testes unitários dos cálculos (saldo, taxa, metas, períodos), roteiro de testes manuais em 320/360/412 px.
5. **Revisão visual final**: animações fluidas, nada vazando, reduzir movimento ok.
6. **Preparo do APK**: `capacitor.config`, documento `APK-PLANO.md` (passo a passo em comandos prontos: `npm i @capacitor/core @capacitor/cli @capacitor/android`, `npx cap add android`, build, abrir no Android Studio, gerar APK assinado), pasta `/APK` na raiz reservada. **Não gerar o APK sem o Octavio pedir** — isso será um próximo projeto (mesmo código, mesmo Supabase).
7. **CHANGELOG** e versão `v1.0.0 beta` visível.
8. Diário finalizado com "ESTADO ATUAL: BETA concluído" e lista de melhorias futuras.

## Checklist de aceite
- [ ] Instala como app no Android e abre em tela cheia
- [ ] Atualização de versão aparece e funciona após novo deploy
- [ ] Lighthouse mobile: Performance ≥ 90, PWA válido
- [ ] Todos os testes automatizados passam
- [ ] Revisão de RLS: usuário A × B isolados; usuário comum × admin
- [ ] Exportar dados funciona
- [ ] Nenhum texto vaza em 320–430 px
- [ ] Layout de celular idêntico ao aprovado (diferença zero abaixo de 1024 px) e layout de computador/TV correto em 1024/1280/1440/1920
- [ ] Regressão visual completa em 320, 360, 412, 768, 1023 (celular) e 1024, 1280, 1440, 1920 (computador/TV); Lighthouse também em modo desktop
- [ ] O APK usará SOMENTE o layout de celular (confirmar no `APK-PLANO.md`)
- [ ] `APK-PLANO.md` criado e `DIARIO.md` finalizado

## Aprovação
Resumo + checklist → aguarde **"APROVADO"**. Após isso o BETA está concluído.
