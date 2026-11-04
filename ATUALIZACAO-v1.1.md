# ATUALIZAÇÃO v1.1 — Cona Cash
Data: 04/11/2026 | Base: DIARIO.md (Fases 1 e 2 aprovadas, Fase 3 pronta aguardando aprovação, versão v0.3.0 beta)

## 1. Análise do que foi pedido
| # | Pedido do Octavio | Diagnóstico | Solução |
|---|---|---|---|
| 1 | O app está focado em corridas da 99; quer ganhos de outras fontes (peças 3D, Mercado Livre, venda presencial, bares, supermercados, outros) e poder "colocar dinheiro" | A entrada só sabe **como** o dinheiro chegou (Maquininha/Pix/Online/Dinheiro), não **de onde** veio. As tags rápidas fixas (#Uber, #99…) e a conta de teste reforçam o viés de corridas. Metas e relatórios também não distinguem origem. | Novo conceito **Fonte de renda** (editável) + **Aporte** (entra no saldo, não conta como ganho) — **Fase 3B** |
| 2 | Primeira página parece só de celular; quer dashboard e menu lateral no computador/TV, mantendo o celular **como está** | Layout atual usa só barra inferior. | **AppShell** com menu lateral a partir de 1024 px, só com classes `lg:`/`xl:`/`2xl:`, e verificação de imagens antes×depois (diferença zero no celular) — **Fase 3C**; dashboard completo na **Fase 4** |
| 3 | Continuar de onde parou, sem apagar comandos antigos | Fases 1–3 já executadas e válidas. | Arquivos antigos **não são tocados**; as mudanças entram como **fases novas (3B, 3C)** e ajustes em 4, 5 e 6; SKILL e PRD mandam o agente ler esta atualização |

## 2. Pontos de atenção encontrados no diário
- A **Fase 3 ainda não tem "APROVADO"** do Octavio. Ele deve aprovar (o que existe funciona: testes 100%) antes da 3B.
- **URL da Vercel** está como "aguardando primeiro deploy". O agente deve confirmar se o deploy está no ar e registrar a URL.
- O DIARIO contém o **e-mail do admin**: confirmar que o repositório do GitHub é **privado**.
- Os dados de teste (planilha de 10 lançamentos) viram o **teste de regressão** da 3B: os saldos têm que continuar iguais (C1 216,51 | C2 40,00 | C3 70,00 | Bolso 45,00 | Total 371,51).

## 3. Nova ordem de execução
1. Octavio aprova a **Fase 3** (como está)
2. **Fase 3B** — Fontes de renda e aportes → `v0.3.1`
3. **Fase 3C** — Layout de computador/TV → `v0.3.2`
4. **Fase 4** — Dashboard (2 layouts) + relatórios por fonte + PDF → `v0.4.0`
5. **Fase 5** — Metas (geral ou por fonte) + efeitos e sons → `v0.5.0`
6. **Fase 6** — PWA, otimização, testes e preparo do APK → `v1.0.0`
(Continuam sendo 6 fases principais; 3B e 3C são ajustes da Fase 3.)

## 4. O que colocar na pasta
**Colar por cima (mesmo nome):** `00-SKILL.md`, `PRD.md`, `DIARIO.md` (já traz todo o histórico anterior + o novo estado), `FASE-4.md`, `FASE-5.md`, `FASE-6.md`
**Arquivos novos:** `ATUALIZACAO-v1.1.md`, `FASE-3B.md`, `FASE-3C.md`
**Não mexer:** `FASE-1.md`, `FASE-2.md`, `FASE-3.md` e todo o código já criado.
**Nada precisa ser deletado.**

## 5. Comando para o agente retomar
```
Leia 00-SKILL.md, DIARIO.md e ATUALIZACAO-v1.1.md. Depois peça meu APROVADO da Fase 3 e comece a entrevista da FASE-3B.md. Não apague nada do que já funciona.
```
