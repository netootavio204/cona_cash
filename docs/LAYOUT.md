# Guia de Layout Responsivo — Cona Cash (v1.1 / Fase 3C)

> **Regra de Ouro (PRD 7.2 e FASE-3C.md):** Abaixo de **1024 px**, o layout de celular e tablet em pé **NÃO muda em nada** (diferença visual zero entre ANTES e DEPOIS). Todas as adaptações para computador, notebook e TV entram **exclusivamente** a partir do breakpoint `lg:` (`≥ 1024 px`).

---

## 1. Breakpoints Oficiais

| Faixa de Largura | Prefixo Tailwind | Dispositivos Alvo | Navegação Principal | Estrutura da Tela |
|---|---|---|---|---|
| **320 px – 1023 px** | *(classes base / `sm:` / `md:`)* | Celulares Android (320, 360, 390, 412 px) e Tablets em pé (768 px) | **Barra inferior fixa (`BottomNav`)** com `lg:hidden` | Coluna única (`max-w-2xl`), cards empilhados, modais mobile |
| **1024 px – 1919 px** | `lg:` / `xl:` | Notebooks e Monitores Desktop (1024, 1280, 1440 px) | **Menu lateral fixo (`Sidebar`)** à esquerda com `hidden lg:flex` (240 px aberto / 72 px recolhido) | `AppShell` com barra superior desktop, área central (`max-w-[1440px]`), grade no Início, tabela em Lançamentos, duas colunas em Config e modais centralizados (`~560 px`) |
| **≥ 1920 px** | `2xl:` / `min-[1920px]:` | Smart TVs, Telões e Monitores Full HD / 4K | **Menu lateral fixo (`Sidebar`)** com fontes e alvos ampliados | Tipografia e espaçamentos ampliados para leitura à distância, anel de foco (`focus-visible`) de alto contraste (`#FF7A1A`) e navegação completa por teclado/controle remoto (`Tab`, setas, `Enter`, `Esc`) |

---

## 2. Regras Inegociáveis de Implementação

1. **Intocabilidade do Mobile (`< 1024 px`)**:
   - Nenhuma classe base (`px-3`, `py-3`, `max-w-2xl`, `grid-cols-2`, etc.) usada nas telas de celular pode ser removida ou alterada.
   - Qualquer mudança para o modo computador deve usar prefixos `lg:`, `xl:` ou `min-[1920px]:`.
   - Comprovado por comparação automatizada de imagens (`docs/regressao/antes/` vs `docs/regressao/depois/`) nas larguras **320, 360, 412, 768 e 1023 px** com **0 pixels de diferença**.

2. **Um Único `AppShell` Sem Recarregamento**:
   - Redimensionar a janela entre `< 1024 px` e `≥ 1024 px` (ex.: `1400 px → 400 px → 1400 px`) **não desmonta** o estado da página ativa nem fecha/limpa formulários que o usuário esteja preenchendo.
   - `BottomNav` permanece montado com `lg:hidden` e `Sidebar` permanece com `hidden lg:flex`.

3. **Menu Lateral (`Sidebar`) no Computador/TV**:
   - Exibe logo oficial Cona Cash (alto contraste dark), itens **Início**, **Lançamentos**, **Relatórios**, **Metas**, **Config** (e atalho **Painel Admin** quando `role === 'admin'`).
   - Possui botão para **recolher/expandir** (alternando entre `240 px` com rótulos e `72 px` apenas com ícones e tooltips), persistindo a escolha do usuário em `localStorage` (`cona_sidebar_collapsed`).
   - No rodapé do menu lateral ficam o nome do usuário, selo `ADMIN`, versão do app (`v0.3.2 beta`) e botão **Sair**.

4. **Atalhos de Teclado e Controle Remoto (`≥ 1024 px`)**:
   - Quando o foco não está dentro de um campo de digitação (`input`, `textarea`, `select`), os atalhos rápidos funcionam diretamente:
     - **`N`**: Abre modal de **Nova Entrada Rápida**
     - **`S`**: Abre modal de **Nova Saída (Gasto)**
     - **`T`**: Abre modal de **Transferência entre Contas**
     - **`L`**: Abre modal de **Lote do Fim do Dia**
   - Navegação por setas (`ArrowUp` / `ArrowDown`) entre itens do menu lateral e `Escape` para fechar modais.

5. **Regra Anti-Vazamento (PRD 7.1) em Todos os Tamanhos**:
   - Todo card, célula de tabela, botão e campo utiliza `min-w-0`, `truncate` ou `overflow-hidden`, além de `tabular-nums` para valores em R$.
   - Nenhuma tela pode gerar barra de rolagem horizontal (`scrollWidth <= clientWidth`) em `320, 360, 412, 768, 1023, 1024, 1280, 1440 e 1920 px`.

