# Story A6: Reordenar opções de lista/menu (setas ↑↓ / drag-and-drop)

**Épico:** Reunião 2026-08-05 — Melhorias + Motor ProJuris
**ID:** A6
**Status:** Ready for Review
**Estimativa relativa:** M
**Executor sugerido:** @dev (UI editor) · Quality gate: @qa
**Risco:** BAIXO (só front; as `options` já são um array JSONB ordenado — reordenar é reindexar o array antes de salvar)

---

## Story

**Como** admin que configura um campo de múltipla escolha de um tema,
**quero** **reordenar** as opções da lista/menu (por **setas ↑↓** e/ou **drag-and-drop**),
**para que** a ordem em que as opções aparecem no dropdown da ficha/filtro reflita a prioridade que eu quero (e não só a ordem de digitação).

**ACTION ITEM** da reunião 05/08. Reaproveitar o **padrão já existente** de reordenação usado em "editar etapas / checklist da etapa" (setas ↑↓). A ordem das opções é a **ordem do array `options`** (JSONB) — reordenar = permutar o array antes de persistir.

---

## Contexto / o que JÁ EXISTE vs NOVO

### JÁ EXISTE

- **Padrão de reordenação por setas ↑↓** (o molde a copiar): `sistema-hv/src/components/pipeline/StageChecklistEditor.tsx`:
  - importa `ArrowDown, ArrowUp` de lucide (`:1`);
  - função `move(index, dir: -1 | 1)` (`:175-185`) que faz swap `[arr[index], arr[target]] = [arr[target], arr[index]]` e persiste;
  - render das setas com `disabled` nas bordas (`:203-222`: `disabled={i === 0}` / `disabled={i === list.length - 1}`).
  - (Persistência via `useReorderChecklistDefs` → `reorderChecklistDefs(ids)` em `sistema-hv/src/lib/checklist-service.ts:193-204`, que reindexa `ordem`. **No caso das opções NÃO precisamos disso** — ver abaixo.)
- **Opções de campo de tema = array JSONB ordenado:** em `system_tema_field_defs.options` (JSONB, array de strings). Normalizado por `normalizeOptions(type, options)` em `sistema-hv/src/lib/tema-field-defs-service.ts:61-68` (preserva a ORDEM do array). O update grava `clean.options = normalizeOptions(...)` (`:291-299`).
- **Editor das opções:** `sistema-hv/src/components/pipeline/TemaFieldDefsEditor.tsx`:
  - estado `optionsList: string[]` (`:81`);
  - `setOptionAt(i,val)` (`:121-123`), `addOption()` (`:124-126`), `removeOption(i)` (`:127-129`);
  - render da lista de opções (`:263-300`): cada opção é um `<Input>` + botão `<X/>` remover; botão `<Plus/>` "Adicionar opção".
  - `parseOptions()` (`:131-135`) devolve o array na ORDEM de `optionsList` → **a ordem do array já é a ordem persistida**.
- **Consumo da ordem (já respeita o array):**
  - ficha: `CaseCanonicalFields.tsx` `optionsToArray(def.options).map(...)` (`:279-284` no select; `:230-235` no multiselect via `CanonicalMultiSelect`);
  - filtros: `CaseFiltersPanel.tsx` `canonicalOptions` (`:153-154`) mapeia `def.options` **na ordem do array**.
- **Reorder de OPÇÕES já existe em OUTRO lugar** (referência de UX cross-check): `sistema-hv/src/components/settings/ClientFieldDefsManager.tsx` (campos do cliente) — verificar se lá as opções já têm ↑↓ para copiar exatamente. (Se não, o molde do checklist basta.)

### NOVO nesta story

1. **Botões ↑↓ por opção** no `TemaFieldDefsEditor`, dentro do bloco `usaOpcoes(type)` (`:263-300`), reusando o padrão do `StageChecklistEditor.move`. Reordenar apenas permuta `optionsList` (estado local) — a persistência já acontece via `parseOptions()` no `salvar`.
2. **(Opcional) drag-and-drop** das opções. Se o projeto já tiver uma lib de DnD (verificar `@dnd-kit`/react-dnd nas deps antes de adicionar), oferecer arrastar; caso contrário, entregar **só as setas ↑↓** (suficiente pelo ACTION ITEM, que aceita "ou setas").
3. Sem mudança de banco: a ordem é a ordem do array `options` (JSONB), já persistida por `normalizeOptions`.

---

## Acceptance Criteria

1. **Reordenar opções por setas ↑↓ no editor.** No `TemaFieldDefsEditor`, cada opção de um campo `select`/`multiselect` ganha setas **↑** e **↓** que movem a opção uma posição para cima/baixo em `optionsList`. As setas nas bordas ficam **desabilitadas** (topo não sobe; base não desce), espelhando `StageChecklistEditor` (`:203-222`).
2. **Ordem persiste.** Ao salvar o campo (`salvar` → `parseOptions()`), a nova ordem é gravada em `options` (JSONB) na ordem de `optionsList`. Reabrir o campo (`startEdit`) mostra a ordem salva.
3. **Ordem refletida na ficha e nos filtros.** O dropdown da ficha (`CaseCanonicalFields`), o multiselect (`CanonicalMultiSelect`) e o filtro (`CaseFiltersPanel.canonicalOptions`) exibem as opções na **nova ordem** (já consomem o array — só depende de AC2).
4. **(Se DnD disponível) drag-and-drop opcional.** Se houver lib de DnD já instalada, permitir arrastar opções para reordenar; caso contrário, entregar só ↑↓ (ACTION ITEM satisfeito). Não adicionar dependência nova sem aprovação.
5. **Sem regressão em adicionar/remover/editar opção.** `addOption`/`removeOption`/`setOptionAt` continuam funcionando; a lista mínima de 1 opção (`disabled={optionsList.length <= 1}` no remover) é mantida.
6. **Gates.** `npm run typecheck`, `npm run lint` limpos.

---

## Tasks / Subtasks

- [x] **T1 — Função de mover opção (@dev) [AC1].** Em `TemaFieldDefsEditor.tsx`, adicionar `moveOption(i: number, dir: -1 | 1)` espelhando `StageChecklistEditor.move` (`:175-185`): calcula `target = i + dir`, ignora fora de faixa, faz swap em `optionsList` via `setOptionsList`.
- [x] **T2 — Setas na UI de opções (@dev) [AC1,AC5].** No bloco `usaOpcoes(type)` (`:263-300`), adicionar, ao lado de cada `<Input>` de opção, uma coluna com `<ArrowUp/>` (disabled quando `i === 0`) e `<ArrowDown/>` (disabled quando `i === shown.length - 1`), chamando `moveOption(i,-1)`/`moveOption(i,1)`. Importado `ArrowUp, ArrowDown` de lucide. `<X/>` remover e `<Plus/>` adicionar mantidos.
- [x] **T3 — (Opcional) DnD (@dev) [AC4].** Verificado `package.json`: só `@dnd-kit/core`+`@dnd-kit/utilities` (SEM `@dnd-kit/sortable`, que é o necessário p/ lista reordenável). Não instalar lib nova sem aprovação → entregues **só as setas ↑↓** (ACTION ITEM aceita "ou setas").
- [x] **T4 — Confirmar persistência (@dev) [AC2,AC3].** `parseOptions()` (`:131-135`) usa a ordem de `optionsList`; `normalizeOptions` (service `:61-68`) preserva a ordem (map/filter, sem sort). Ficha (`CaseCanonicalFields`), multiselect e filtro (`CaseFiltersPanel.canonicalOptions`) leem o array na ordem. Nenhuma mudança de service/RPC/migration.
- [x] **T5 — Smoke UI + gates (@qa) [AC1,AC2,AC3,AC6].** Gates: `npm run typecheck` limpo no arquivo tocado (único erro é o pré-existente conhecido em `contaazul/service.ts`); `npx eslint src/components/pipeline/TemaFieldDefsEditor.tsx` → 0 erros/warnings. Smoke UI manual pendente p/ @qa (criar select 3 opções, reordenar, salvar, reabrir, conferir dropdown na ficha).

---

## Dev Notes

- **Por que NÃO precisa de coluna `ordem` nas opções:** as `options` são um **array JSONB ordenado**; a posição no array É a ordem. Reordenar = permutar o array local (`optionsList`) e salvar via o fluxo existente (`parseOptions` → `normalizeOptions`). Diferente do checklist, que persiste `ordem` por linha — aqui é mais simples.
- **Molde exato:** `StageChecklistEditor.tsx` (`move`, setas, `disabled` nas bordas). Copiar a mesma UX para consistência visual.
- **DnD é "nice-to-have":** o ACTION ITEM aceita "drag-and-drop **ou** setas ↑↓". Entregar ↑↓ garante o valor sem risco/deps; DnD só se já houver lib. Não adicionar `@dnd-kit` sem aprovação do owner.
- **Menus de itens:** o pedido cita "opções de lista/menu". No sistema, o análogo concreto são as `options` dos campos select/multiselect (e, se o `ClientFieldDefsManager` tiver opções, aplicar o mesmo lá — verificar). Não confundir com etapas do Kanban (que já têm reorder).
- **Sem migration:** nenhuma mudança de banco. Não confundir com A4/A5 (que podem ter migration).

## Testing

- **UI:** reordenar 3 opções (↑↓), salvar, reabrir → ordem mantida; ficha e filtro refletem a ordem.
- **Regressão:** adicionar/remover/editar opção seguem OK; mínimo de 1 opção.
- **Gates:** `npm run typecheck`, `npm run lint`.

## Dependências

- Independente de A2/A3/A4/A5. **Reusa** o padrão de `StageChecklistEditor` e o array `options` existente. Mexe no MESMO arquivo `TemaFieldDefsEditor.tsx` que A4/A5 — coordenar merge.
- Sem migration; sem credenciais de banco necessárias.

## File List

**Novos**
- (nenhum)

**Alterados**
- `sistema-hv/src/components/pipeline/TemaFieldDefsEditor.tsx` (`moveOption` + setas ↑↓ nas opções; DnD opcional)

## Change Log

| Data | Versão | Descrição | Autor |
|---|---|---|---|
| 2026-08-05 | v0.1 | Draft inicial | @sm (Bob) |
| 2026-08-05 | v0.2 | Implementado (@dev via Orion). Setas ↑↓ para reordenar opções de campos select/multiselect em `TemaFieldDefsEditor.tsx` (nova `moveOption(i,dir)` com swap no `optionsList`; coluna ArrowUp/ArrowDown por opção, disabled nas bordas). Sem DnD (`@dnd-kit/sortable` ausente; não add dep). Sem migration — ordem = ordem do array `options` (JSONB), persistida via `parseOptions`→`normalizeOptions` (preserva ordem). Arquivo: `src/components/pipeline/TemaFieldDefsEditor.tsx`. Gates: typecheck limpo (só erro pré-existente em contaazul/service.ts); eslint 0 erros/warnings no arquivo. | @dev |
