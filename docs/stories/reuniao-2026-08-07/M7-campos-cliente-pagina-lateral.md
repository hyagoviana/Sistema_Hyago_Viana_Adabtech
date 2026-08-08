# Story M7: Editar campos do CLIENTE como página lateral (não pop-up)

**Épico:** Reunião 2026-08-07 — Melhorias até segunda
**ID:** M7
**Status:** Ready for Review
**Estimativa relativa:** S/M
**Executor sugerido:** @dev (refactor de container) · Quality gate: @qa
**Risco:** BAIXO/MÉDIO — refactor de apresentação (Dialog → painel lateral) SEM mudar a lógica dos campos. Cuidar dos 2 pontos que abrem o gerenciador hoje (ClientRoster + tela de Campos personalizados) e da limpeza de estado ao fechar.

---

## Story

**Como** admin que gerencia os **campos do cadastro do cliente**,
**quero** que a tela "editar campos do cliente" abra como **página lateral** (painel deslizante à direita), e não como **pop-up modal** centralizado,
**para** ter o mesmo padrão/conforto da edição dos **campos da pipeline** (que já mora numa coluna lateral fixa), com mais espaço e sem a sensação de "modal apertado".

Refinamento do B1/I1 (reunião 2026-08-05): a tela de campos do cliente é o `ClientFieldsManagerDialog` (hoje um `<Dialog>` modal). Os campos da pipeline (`TemaFieldDefsEditor`) já são renderizados **inline numa coluna lateral** na tela dedicada `configuracoes.campos-personalizados.tsx` (não como pop-up). M7 alinha o cliente a esse padrão: um **painel lateral** (Sheet) em vez do modal centralizado.

---

## Contexto / o que JÁ EXISTE vs NOVO

### JÁ EXISTE

- **Gerenciador de campos do cliente (hoje modal).** `sistema-hv/src/components/clients/ClientFieldsManagerDialog.tsx` — um `<Dialog><DialogContent className="sm:max-w-[680px] max-h-[88vh] overflow-y-auto">` com: campos fixos (referência), lista de campos adicionais (reordenar/ocultar/editar/excluir), editor de campo (novo/edição), e o bloco B1 "Aparece nos casos" + seletor de temas. **Toda a lógica fica aqui e NÃO muda** — só o container (Dialog → Sheet lateral).
- **Padrão "página lateral" de referência (o alvo visual).** `TemaFieldDefsEditor` (`sistema-hv/src/components/pipeline/TemaFieldDefsEditor.tsx`) é renderizado **inline na coluna direita** de `sistema-hv/src/routes/configuracoes.campos-personalizados.tsx` (`:137`) — não é modal. É o "igual à de campos da pipeline" que o owner citou.
- **Componente Sheet (painel lateral) já existe.** `sistema-hv/src/components/ui/sheet.tsx` (shadcn) — `Sheet`/`SheetContent side="right"`/`SheetHeader`/`SheetTitle`/`SheetDescription`. É o container natural para "página lateral" mantendo o padrão open/onOpenChange (drop-in do Dialog).
- **Os 2 lugares que abrem o gerenciador hoje** (com `open`/`onOpenChange`):
  1. `sistema-hv/src/components/clients/ClientRoster.tsx:446` — botão "Info/Cadastro" (`setFieldsOpen`), gate `canManageFields = usePodeEditar('sistema')`.
  2. `sistema-hv/src/routes/configuracoes.campos-personalizados.tsx:166` — botão "Editar campos do cliente" (`setClientFieldsOpen`), na coluna esquerda (aside) da tela dedicada.
- **Gate.** `usePodeEditar('sistema')` (B3) nos dois pontos; writes já ADMIN server-side (`requireModule('sistema','edit')`). **Não muda.**

### NOVO nesta story

**Trocar o container do `ClientFieldsManagerDialog` de `Dialog` (modal centralizado) para `Sheet` lateral (`side="right"`)**, mantendo:
- a mesma assinatura `{ open, onOpenChange }` (para os 2 call-sites não mudarem, ou mudarem trivialmente);
- todo o corpo (campos fixos, lista, editor, B1) idêntico;
- a limpeza de estado ao fechar (`useEffect(!open)` já existente);
- o scroll interno (o Sheet lateral tem altura total; o conteúdo rola).

Decisão de forma (D-M7): **manter um componente controlado por `open/onOpenChange`** trocando `Dialog*`→`Sheet*` é o caminho de menor risco e preserva os 2 call-sites. (Alternativa "inline na coluna direita como o tema" exigiria embutir na tela de Campos personalizados E resolver o botão do ClientRoster — mais invasivo; o Sheet dá o mesmo efeito de "página lateral" em ambos os lugares.)

---

## Acceptance Criteria

1. **Abre como página lateral.** A tela de "editar campos do cliente" abre num **painel lateral deslizante à direita** (`Sheet side="right"`), não mais como pop-up modal centralizado. Largura confortável (ex.: `sm:max-w-[680px]` ou maior) e scroll interno para o conteúdo comprido.
2. **Mesma funcionalidade.** Tudo que o `ClientFieldsManagerDialog` faz hoje continua: ver campos fixos, listar/reordenar/ocultar/editar/excluir campos adicionais, criar/editar campo (com opções, obrigatório, texto de ajuda) e o B1 "Aparece nos casos" + seleção de temas. Nada de lógica removida.
3. **Os 2 pontos de abertura seguem funcionando.** O botão "Info/Cadastro" no `ClientRoster` e o "Editar campos do cliente" na tela `configuracoes.campos-personalizados` abrem o painel lateral. O gate `usePodeEditar('sistema')` continua valendo nos dois.
4. **Fecha e limpa estado.** Fechar o painel (X, clique fora/overlay, Esc) chama `onOpenChange(false)` e reseta o rascunho/edição (o `useEffect(!open)` existente). Reabrir começa limpo.
5. **Consistência visual com o padrão lateral.** O cabeçalho do painel usa `SheetHeader`/`SheetTitle`/`SheetDescription` (equivalente ao `DialogHeader/Title/Description` atual). Comportamento coerente com outros Sheets do app, se houver.
6. **Regressão / gates.** `npm run typecheck` + `npm run lint` limpos. Sem migration (100% front, só apresentação). B1 (aparece nos casos + temas) continua persistindo igual; nenhuma mudança de RPC/hook.

---

## Tasks / Subtasks

### T1 — Trocar o container Dialog → Sheet (@dev)
- [x] Em `sistema-hv/src/components/clients/ClientFieldsManagerDialog.tsx`, substituir os imports/JSX de `Dialog/DialogContent/DialogHeader/DialogTitle/DialogDescription/DialogFooter` por `Sheet/SheetContent (side="right")/SheetHeader/SheetTitle/SheetDescription/SheetFooter` (de `@/components/ui/sheet`). Manter `className` de largura/scroll (`sm:max-w-[680px]`, `overflow-y-auto`, altura total do Sheet). Corpo idêntico. (AC-1, AC-2, AC-5)
- [x] Manter a assinatura `{ open, onOpenChange }` e o `useEffect(!open)` de reset. (AC-4)
- [x] (Opcional) renomear o arquivo/símbolo para `ClientFieldsManagerPanel`/`ClientFieldsManagerSheet` e atualizar os imports; ou manter o nome `ClientFieldsManagerDialog` para não tocar os call-sites (decisão do dev — se renomear, atualizar os 2 imports). (AC-3) — **Decisão: mantido o nome `ClientFieldsManagerDialog`** para não tocar os 2 call-sites (assinatura idêntica).

### T2 — Conferir os 2 call-sites (@dev)
- [x] `sistema-hv/src/components/clients/ClientRoster.tsx` — botão "Info/Cadastro" (`fieldsOpen`/`setFieldsOpen`) abre o painel lateral. (AC-3) — inalterado (mesma assinatura).
- [x] `sistema-hv/src/routes/configuracoes.campos-personalizados.tsx` — botão "Editar campos do cliente" (`clientFieldsOpen`) abre o painel lateral. Conferir que não fica estranho abrir um Sheet à direita numa tela que já tem layout de 2 colunas (aceitável — o Sheet cobre por cima). (AC-3, AC-5) — inalterado (mesma assinatura).

### T3 — QA / regressão (@qa)
- [ ] Abrir pelos 2 pontos; criar/editar/ocultar/reordenar/excluir campo; testar B1 (marcar "aparece nos casos" + selecionar temas → persiste). (AC-2)
- [ ] Fechar por X/overlay/Esc reseta o rascunho; reabrir limpo. (AC-4)
- [ ] Gate `usePodeEditar('sistema')`: não-admin sem a permissão não vê o botão. (AC-3)
- [ ] `npm run typecheck` + `npm run lint` verdes; sem migration. (AC-6)

---

## Dev Notes

- **É só o CONTÊINER.** O `Sheet` do shadcn (`sistema-hv/src/components/ui/sheet.tsx`) é um drop-in do `Dialog`: mesma API `open`/`onOpenChange`, mesmo overlay/Esc/close. Troca de `Dialog*` → `Sheet*` + `side="right"`. **Zero** mudança no corpo (lista, editor, B1, hooks `useClientFieldDefs`/`useSetClientFieldTemaLinks` etc.).
- **Por que Sheet e não "inline como o tema".** O `TemaFieldDefsEditor` é inline porque vive numa tela dedicada de 2 colunas. O gerenciador do cliente é aberto por BOTÃO em 2 telas diferentes (ClientRoster e Campos personalizados). Um Sheet lateral dá o efeito de "página lateral" pedido nos DOIS lugares sem reescrever nenhuma das telas nem duplicar o editor. (D-M7)
- **Largura/scroll:** o `DialogContent` atual usa `sm:max-w-[680px] max-h-[88vh] overflow-y-auto`. No Sheet lateral, a altura é total (100dvh); manter `overflow-y-auto` no conteúdo e largura confortável (`w-full sm:max-w-[680px]` ou `sm:max-w-[720px]`). Conferir o CSS do `SheetContent side="right"` no projeto.
- **Nome do símbolo:** manter `ClientFieldsManagerDialog` evita tocar os 2 imports; se preferir clareza, renomear para `...Panel` e atualizar `ClientRoster.tsx` + `configuracoes.campos-personalizados.tsx`. Não há outros consumidores (grep: só esses 2 + as próprias stories).
- **Sem migration, sem RPC, sem hook novo** — 100% apresentação. B1 e I1 já entregaram a lógica/persistência.

**Riscos:**
- **R1 — Sheet dentro de tela com layout próprio** (Campos personalizados) pode parecer redundante (um painel lateral sobre uma coluna). Aceitável (o Sheet cobre por cima e fecha); se incomodar, o owner decide depois. Não bloqueia.
- **R2 — reset de estado ao fechar** deixar de disparar se o Sheet não propagar `onOpenChange` no overlay/Esc. Mitigação: manter o `useEffect(!open)` e testar os 3 modos de fechar (T3).

## Testing

- **Abertura lateral** pelos 2 botões; conteúdo completo e rolável.
- **CRUD de campo** + **B1** (aparece nos casos + temas) idênticos ao de hoje; persistem.
- **Fechar** por X/overlay/Esc → reset; reabrir limpo.
- **Gate** `sistema:edit` esconde o botão para não-autorizados.
- **Gates:** `npm run typecheck` + `npm run lint` limpos.

## Dependências

- **Story B1/I1 (2026-08-05)** — `ClientFieldsManagerDialog` (campos do cliente + "aparece nos casos") e a tela dedicada `configuracoes.campos-personalizados.tsx`. Base direta; M7 só muda a apresentação.
- **`sistema-hv/src/components/ui/sheet.tsx`** — componente de painel lateral (já existe).
- **B3** — gate `usePodeEditar('sistema')` (inalterado).

## File List

**Alterados**
- `sistema-hv/src/components/clients/ClientFieldsManagerDialog.tsx` (container Dialog → Sheet lateral; corpo idêntico) — eventual rename para `...Panel`.
- `sistema-hv/src/components/clients/ClientRoster.tsx` (só se renomear o símbolo)
- `sistema-hv/src/routes/configuracoes.campos-personalizados.tsx` (só se renomear o símbolo)

## Change Log

| Data | Versão | Descrição | Autor |
|---|---|---|---|
| 2026-08-07 | v0.1 | Draft inicial | @sm (Bob) |
| 2026-08-08 | v0.2 | Implementado (@dev via Orion). Container `Dialog`→`Sheet side="right"` em `ClientFieldsManagerDialog.tsx` (imports Dialog* removidos, JSX trocado por `Sheet/SheetContent/SheetHeader/SheetTitle/SheetDescription/SheetFooter`; `className="w-full sm:max-w-[680px] overflow-y-auto flex flex-col gap-4"`). Corpo/lógica/B1 e `useEffect(!open)` de reset intactos; símbolo `ClientFieldsManagerDialog` mantido, call-sites (ClientRoster + configuracoes.campos-personalizados) inalterados. Gates: `npm run typecheck` OK, `npx eslint` no arquivo tocado 0 erros. Sem migration. | @dev |
