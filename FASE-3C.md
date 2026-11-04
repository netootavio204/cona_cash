# FASE 3C — Layout de computador/notebook/TV (menu lateral + base do dashboard)

> Ajuste da v1.1. Vem **depois** da 3B. **O layout de celular não pode mudar em nada.**
> Leia 00-SKILL.md, ATUALIZACAO-v1.1.md, DIARIO.md e PRD.md (v1.1, seção 7.2). Depois faça a ENTREVISTA.

## Entrevista (máx. 5 perguntas por vez)
1. A partir de qual largura trocar para o layout de computador? (padrão: **1024 px**; tablet em pé continua como celular)
2. Menu lateral: sempre aberto ou recolhível só com ícones? (padrão: aberto, com botão para recolher)
3. Na TV você vai usar controle remoto/teclado ou só olhar? (ajusta o foco e a navegação)
4. Onde mostrar nome do usuário, versão e botão Sair? (padrão: rodapé do menu lateral)
5. Quer atalhos de teclado no computador (ex.: **N** = nova entrada, **S** = nova saída)?

## Regras inegociáveis
- **Antes de mexer em qualquer coisa**: gerar capturas de tela "ANTES" de todas as telas em 320, 360, 412, 768 e 1023 px e guardar em `docs/regressao/antes/`. Comando pronto (Playwright):
  ```
  npm i -D @playwright/test && npx playwright install chromium
  ```
- Alterações de desktop usam **somente** classes `lg:` / `xl:` / `2xl:`. **Não editar as classes base** (celular).
- Se algo no celular mudar 1 pixel, desfaça.

## Entregáveis
1. **AppShell** único: `BottomNav` com `lg:hidden` (como está hoje) e **Sidebar** com `hidden lg:flex`: logo Cona, Início, Lançamentos, Relatórios, Metas, Config (+ Admin se for admin), item ativo com borda/brilho animado, recolher/expandir, usuário + versão + Sair no rodapé.
2. **Barra superior (desktop)**: título da página, saldo total compacto e botões **+ Entrada / + Saída / Transferir**.
3. **Conteúdo centralizado** (máx. 1440 px) com espaçamentos maiores; telas existentes (Início, Lançamentos, Config) adaptadas só com classes de desktop:
   - Lançamentos: lista vira **tabela** (data, fonte, forma/conta, categoria, observação, valor, ações).
   - Config: duas colunas/abas.
   - Modais: **janela centralizada** (largura ~560 px); no celular continuam como estão.
4. **Início no desktop**: grade simples com os blocos que já existem (a versão completa do dashboard vem na Fase 4).
5. **TV (≥ 1920 px)**: fontes/espacamentos maiores, **foco visível** forte, navegação por Tab/setas/Enter, nada só com hover.
6. Redimensionar a janela **não recarrega** nem perde o que foi digitado; rota atual preservada.
7. Documento `docs/LAYOUT.md` com os breakpoints e as regras.
8. Testes, diário, versão **v0.3.2 beta**, deploy conferido.

## Checklist de aceite
- [ ] **Comparação de imagens ANTES × DEPOIS em 320/360/412/768/1023 px: diferença ZERO** (mostrar o resultado ao Octavio)
- [ ] ≥ 1024 px: menu lateral aparece, barra de baixo some; < 1024 px: volta a barra de baixo, como antes
- [ ] Redimensionar de 1400 → 400 → 1400 px mantém rota e formulário preenchido
- [ ] Tabela de lançamentos sem texto vazando em 1024, 1280, 1440 e 1920
- [ ] Menu recolhido/expandido funciona e lembra a escolha
- [ ] Dá para navegar e lançar uma entrada só com teclado
- [ ] Build e testes passam; deploy na Vercel conferido
- [ ] Diário atualizado

## Aprovação
Resumo + checklist → aguarde **"APROVADO"**.
