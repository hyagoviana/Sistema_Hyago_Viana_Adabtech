# Story S2-01: Menu único de configuração de tema

- **Sprint:** S2 — Configuração de tema + Drive + ProJuris
- **ID:** S2-01 · **Item do Thiago:** 1
- **Status:** Ready for Review
- **Estimativa relativa:** M
- **Executor sugerido:** @dev · Quality gate: @qa

---

## Story

**Como** administrador,
**quero** configurar o tema **num lugar só**,
**para que** ninguém precise adivinhar se mexe pelo Kanban ou pelas Configurações — e para que operação
e configuração parem de se misturar na mesma tela.

---

## Contexto

Anotação do Thiago (desenhos 7 a 12): *"Essas são questões de configurações, vamos remover daqui e manter
apenas no painel de configuração. Hoje existem 2 'menus' diferentes para configurar temas"* e
*"Temas e campos personalizados: vamos centralizar a criação e as configurações relacionadas aos temas em
um só local."*

Os dois hoje:

1. **`Editar tema`** — diálogo aberto pela **Área de Trabalho** (`src/routes/pipeline.tsx`): renomeia o
   tema e vincula pastas de Casos/Procurações do Drive.
2. **`/configuracoes/campos-personalizados`** — já com abas **Campos · Pastas do Drive · Distribuição ·
   Financeiro** e a lista de pipelines à esquerda (é o desenho 11/13 dele).

O segundo é superconjunto do primeiro. A Área de Trabalho fica só com **operação**: abrir o tema,
`+ Novo tema`, `Ver todos em lista`.

---

## Acceptance Criteria

1. A página `/configuracoes/campos-personalizados` passa a se chamar **"Configuração de temas"**
   (breadcrumb, título e item no menu de Configurações), mantendo a rota atual para não quebrar links
   — ou com redirect da antiga se a rota mudar.
2. Ela absorve tudo que o diálogo `Editar tema` fazia: **renomear** o tema e **criar/anexar/vincular**
   pastas e modelos (Casos e Procurações). Nada some.
3. O botão/menu **"Editar tema" sai da Área de Trabalho**. Continuam lá: abrir o tema, `+ Novo tema`,
   `Campos personalizados` (como atalho que leva à página nova), `Ver todos em lista`, `Temas`.
4. **Criar tema** continua possível pela Área de Trabalho, mas ao criar o sistema oferece
   "configurar agora" levando à página única (o fluxo do Thiago: cria e já configura).
5. Nenhuma configuração de tema fica acessível por dois caminhos diferentes ao fim da story.
6. Gate: a página é do módulo **Sistema** e só quem administra vê (comportamento atual preservado).
7. `npx tsc --noEmit` e `npm run lint` sem erro novo.

---

## Tasks / Subtasks

- [x] Mover o conteúdo do diálogo `Editar tema` para a aba **Pastas do Drive** da página única (AC 2).
- [x] Adicionar o campo **Nome do tema** (renomear) na página (AC 2).
- [x] Remover o botão do Kanban e ajustar a barra de ações da Área de Trabalho (AC 3).
- [x] Pós-criação de tema → link "configurar agora" (AC 4).
- [x] Renomear títulos/breadcrumb/menu (AC 1).
- [x] Varredura: `grep` por chamadas ao diálogo antigo e remoção do componente órfão (AC 5).

---

## Dev Notes

- A aba **Integrações** entra na **S2-02** — esta story só consolida o que já existe.
- Componentes envolvidos: `src/routes/pipeline.tsx` (botão + diálogo),
  `src/routes/configuracoes.campos-personalizados.tsx`, `src/rpc/temas.ts`,
  `src/rpc/service-type-folders.ts`.
- Não mexer na lógica de vínculo de pastas agora — a reforma dela é a **S2-04**. Aqui é só mudança de lugar.

## Definition of Done

- [ ] Existe **um** caminho para configurar tema
- [ ] Área de Trabalho ficou só com operação
- [ ] typecheck + lint verdes

---

## Dev Agent Record (03/09/2026)

**Implementado.**
- **Área de Trabalho** (`pipeline.tsx`) ficou só com operação: abrir tema, **Novo tema**,
  **Configurar temas** (leva à tela única) e **Ver todos em lista**. Saíram: o botão "Temas" e o lápis
  de edição no card (virou atalho para a configuração).
- Novo componente enxuto `NovoTemaDialog.tsx` — só cria o tema e devolve o criado para quem chamou.
  Na Área de Trabalho, criar leva direto para a configuração (fluxo que o Thiago descreveu).
- **Configurações › Configuração de temas** (rota `/configuracoes/campos-personalizados`, mantida para
  não quebrar links) absorveu o que era do diálogo: bloco **Nome do tema** (renomear) e **Excluir tema**,
  com a mesma confirmação sobre a lixeira do Drive. Botão **Novo tema** no cabeçalho.
- Título, breadcrumb e o card em Configurações renomeados de "Campos personalizados" para
  **"Configuração de temas"**.
- `TemasManagerDialog.tsx` **removido** (`git rm`) — nenhuma tela o referenciava mais.

**Validação:** `npx tsc --noEmit`, `eslint` e `npm run build` verdes.
(O build só conclui com `NODE_OPTIONS=--max-old-space-size=8192` nesta máquina — limitação de heap do
ambiente, não do código.)

**Nota:** a aba **Integrações** (assunto do ProJuris) é a S2-02 — esta story só consolidou o que existia.

---

## QA Results — 03/09/2026 (Quinn)

**Gate: PASS**

- AC 1-5 verificados: a rota foi mantida (nenhum link quebra), o diálogo `Editar tema` deixou de existir e
  suas funções (renomear, excluir, pastas) estão na tela única. `grep` confirma que nenhuma tela referencia
  o componente removido.
- AC 6 (gate) verificado: `Novo tema`, `TemaIdentidade` e o diálogo estão sob `usePodeEditar("sistema")`;
  na Área de Trabalho, sob `can(role, "config.manage")` — mesma régua de antes.
- A confirmação de exclusão preservou o texto sobre a lixeira do Drive — importante, é ação destrutiva.
- Build, typecheck e lint verdes.

**Melhoria sugerida (não bloqueia):** ao criar tema pela Área de Trabalho, a navegação leva à tela de
configuração mas **não seleciona** o tema recém-criado (abre no estado "Escolha uma pipeline"). Dentro da
própria tela de configuração o `onCreated` já seleciona. Passar o id pela navegação fecharia a diferença.
