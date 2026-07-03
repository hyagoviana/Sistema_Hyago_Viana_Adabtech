# Story S6-01: Critérios editáveis por etapa dentro do `StageEditor` (dialog do Kanban) — fin e op

- **Sprint:** 6 — Financeiro incremental (critérios editáveis + check no card) `[Frente A]`
- **ID:** S6-01
- **Status:** Ready for Review
- **Estimativa relativa:** S/M (front — plugar o `StageChecklistEditor` que JÁ EXISTE dentro do `StageEditor`; reusa 100% do CRUD de defs; **provável SEM migration**)
- **Executor sugerido:** @dev (front) · Quality gate: @architect

---

## Story

**Como** administrador/operador do financeiro,
**quero** criar, editar, reordenar e marcar como obrigatórios os **critérios (itens de checklist)** de cada **etapa financeira** direto no editor de etapas que abro pelo Kanban (botão "Editar etapas"),
**para que** cada gate financeiro tenha critérios parametrizáveis pela própria equipe — sem depender de outra tela — reusando o gate `system_fn_avancar_fin_se_ok` (S3-02) que já avança o card quando todos os `required` estão `done`.

---

## Contexto / o que JÁ EXISTE vs NOVO

- **JÁ EXISTE (tabelas — S2-01):** `system_stage_checklist_defs` (defs por `service_type_id` + `stage_slug`, `key`, `label`, `ordem`, `required`, `expected_doc_pattern`, `active`, soft-delete) e `system_case_checklist_items` (instância por caso) — migration `20260703000001_stage_checklist.sql`. **Agnósticas ao `kind`** (ancoradas em `stage_slug` + `service_type_id`), então **já servem para etapas `fin` e `op`**.
- **JÁ EXISTE (gate fin — S3-02):** `system_fn_avancar_fin_se_ok(p_case_id, p_triggered_by)` (`20260704000001_fn_avancar_fin.sql`) avança o card fin quando todos os itens `required` da etapa fin atual estão `done`. **Nada a criar no gate.**
- **JÁ EXISTE (editor de defs — componente):** `src/components/pipeline/StageChecklistEditor.tsx` — CRUD completo de itens de checklist por etapa (criar, renomear via label, `required` togglável, reordenar, excluir), via `useChecklistDefs`/`useCreateChecklistDef`/`useUpdateChecklistDef`/`useDeleteChecklistDef`/`useReorderChecklistDefs`. Recebe `serviceTypeId`, `stageSlug`, `canEdit`.
- **JÁ EXISTE (onde o editor de defs está plugado HOJE):** APENAS na rota `src/routes/comercial.funil.tsx` (dentro do `StageList` local, expandindo cada etapa) — e **essa rota é hardcoded para `kind: "op" | "fin"`**. Ou seja, o CRUD de critérios já existe e funciona, mas vive numa **tela separada** (`/comercial/funil`), não no editor que o operador abre a partir do **Kanban financeiro**.
- **JÁ EXISTE (o editor usado pelo Kanban):** `src/components/cases/StageEditor.tsx` — é um **Dialog** com CRUD de etapas (label, `stage_role`, ordem, criar, excluir) que aceita `kind: StageKind` (`op` | `fin` | `comercial`). É aberto pelo botão **"Editar etapas"** em:
  - `src/routes/casos.financeiro.index.tsx:253` (Kanban fin, `kind="fin"`) — **alvo principal da Frente A**;
  - `src/routes/comercial.leads.tsx` e `src/routes/pipeline.tsx` (op) — ganham o mesmo benefício de brinde.
  - **Esse `StageEditor` NÃO tem o `StageChecklistEditor` dentro** — só edita a etapa, não os critérios dela.
- **NOVO (só front):** dentro de cada linha de etapa do `StageEditor`, adicionar um **expand/disclosure** (chevron) que renderiza o `StageChecklistEditor` (`serviceTypeId`, `stageSlug=s.slug`, `canEdit`) — exatamente como o `StageList` do `comercial.funil.tsx` já faz. Assim o operador cria/edita/reordena os critérios da etapa **financeira** (e, de brinde, op) sem sair do Kanban.

> **DECISÃO DO OWNER (INCREMENTAL — travada):** entregar agora **apenas** (1) critérios editáveis/acrescentáveis por etapa financeira e (2) o check dentro do card (S6-02). **NÃO** remodelar as 15 etapas do POP, **NÃO** criar colunas novas de segregação/hold/flag judicial, **NÃO** máquina de transição avançada — tudo isso é **fase futura / BACKLOG** (ver seção BACKLOG). Esta story só **expõe** o CRUD de critérios que já existe, no lugar certo.

---

## Acceptance Criteria

1. No Kanban financeiro (`/casos/financeiro`), abrir **"Editar etapas"** e, em qualquer etapa fin, expandir a etapa mostra o **`StageChecklistEditor`** daquela etapa (`stage_slug` + `service_type_id`), permitindo **criar, renomear, marcar `required`, reordenar e excluir** critérios.
2. O `required` de cada critério é editável e **persiste** (`system_stage_checklist_defs.required`); um critério `expected_doc_pattern` **opcional** pode ser deixado como está (o `StageChecklistEditor` atual não o expõe na UI — **manter comportamento**; não é requisito adicioná-lo agora).
3. O mesmo expand passa a valer para o `StageEditor` aberto no **operacional** (`comercial.leads.tsx`, `pipeline.tsx`) — o componente é único, então op e fin ganham o CRUD de critérios sem código duplicado.
4. **Reuso do gate:** ao concluir (em produção) todos os `required` de uma etapa fin, o card avança pelo gate **`system_fn_avancar_fin_se_ok` já existente** (S3-02) — esta story **não** cria nem altera gate; só **alimenta** os `defs required` que o gate lê.
5. **Regressão:** o CRUD de **etapas** do `StageEditor` (label/role/ordem/criar/excluir) continua funcionando igual; a rota separada `/comercial/funil` continua funcionando (não é removida nesta story).
6. **Sem migration** (as tabelas de checklist já existem e são agnósticas ao kind). Se o owner quiser **exemplos-semente** de critérios por etapa fin, isso é uma migration **opcional** de seed `ON CONFLICT DO NOTHING` — marcada como opcional, **não** requisito.

---

## Tasks / Subtasks

- [x] **Plugar `StageChecklistEditor` no `StageEditor`** (AC: 1,2,3) — em `src/components/cases/StageEditor.tsx`, adicionar por linha de etapa um botão de expand (chevron, padrão do `StageList` de `comercial.funil.tsx:125-173`) que, aberto, renderiza `<StageChecklistEditor serviceTypeId={serviceTypeId} stageSlug={s.slug} canEdit={...} />`.
  - [x] Estado local `expanded: string | null` (id da etapa aberta), como no molde.
  - [x] `canEdit` — prop opcional `canEdit?: boolean` (default `true`) adicionada ao `StageEditor`; as 3 rotas (fin/pipeline op/comercial leads) passam `can(role, "config.manage")` via `useAuth`, alinhado ao padrão de S2-02 e `comercial.funil.tsx`.
- [x] **Verificar `kind='comercial'`** (AC: 3) — o `StageChecklistEditor` só depende de `service_type_id`+`stage_slug`; o expand aparece para qualquer kind (fin/op/comercial). Confirmado em `comercial.leads.tsx` (kind="comercial").
- [ ] **(Opcional) Seed de exemplos** (AC: 6) — NÃO feito (sem pedido explícito do owner; evita escrever dados não solicitados).
- [x] **Testes** (AC: 1–6) — `npx tsc --noEmit`: só os 3 erros PRÉ-EXISTENTES de `service_type_id` (nenhum novo). `npm run lint` nos arquivos tocados: só ruído CRLF pré-existente, zero violação real. Teste funcional em runtime pendente p/ @qa.

---

## Dev Notes

**Arquivos a tocar:**
- `sistema-hv/src/components/cases/StageEditor.tsx` (adicionar o expand + `StageChecklistEditor`) — **único arquivo de código provável**.
- (reuso, sem mudança) `sistema-hv/src/components/pipeline/StageChecklistEditor.tsx`, hooks `useChecklist*` em `src/hooks/useChecklist.ts`.
- (molde a copiar) `sistema-hv/src/routes/comercial.funil.tsx` (o `StageList` local já faz exatamente o expand desejado — copiar o padrão do chevron/`expanded`).

**REGRAS DE OURO (pertinentes):**
- **NÃO toca `system_cases`** → **NÃO recriar `system_cases_active`** (regra de ouro 2 só vale quando a migration altera colunas de `system_cases`).
- **NÃO recriar `trg_system_cases_bifurcacao`** (regra de ouro 6 — dropado na 0022).
- Se surgir a seed opcional, aplicar via **`npx tsx scripts/db-apply-pg.ts <arquivo.sql>`** (pg direto; CLI quebrado no Windows/OneDrive).

**Riscos de regressão:**
- O `StageEditor` é usado por **3 rotas** (fin + 2 op). O expand não pode quebrar o layout do Dialog nem o CRUD de etapas existente. O `StageChecklistEditor` já é auto-contido (carrega seus próprios dados por `serviceTypeId`+`stageSlug`), então o risco é só de UI.
- Não confundir com o `StageList` de `comercial.funil.tsx` (rota separada, componente diferente com o mesmo objetivo) — esta story mexe **só** no `StageEditor` (dialog).

### Testing
- Abrir `/casos/financeiro` → tipo → "Editar etapas" → expandir uma etapa fin → adicionar critério `required` → recarregar → critério persiste.
- Reordenar/renomear/excluir critério → persiste (`system_stage_checklist_defs`).
- Editar etapa (label/role/ordem) continua funcionando (regressão).
- `npm run typecheck` / `npm run lint` verdes.

---

## Dependências

- **Depende de:** S2-01 (tabelas de checklist), S3-02 (gate fin `system_fn_avancar_fin_se_ok`). Ambos JÁ EXISTEM.
- **Habilita:** S6-02 (check do critério dentro do card fin — consome os mesmos `defs`).

---

## BACKLOG explícito (fase futura — NÃO fazer nesta story)

- **Re-seed das 15 etapas do POP financeiro** (remodelo completo do funil fin conforme o POP).
- **Novas colunas** de segregação/controle: `flag_judicial_financeiro`, `hold_motivo`, etc.
- **Máquina de transição / segregação conferidor≠elaborador** por etapa, snapshot versionado do checklist.
- Editor de `expected_doc_pattern` na UI (hoje a coluna existe mas não é exposta pelo `StageChecklistEditor`).

## File List

- `sistema-hv/src/components/cases/StageEditor.tsx` (alterado — prop `canEdit`, estado `expanded`, chevron por etapa + `StageChecklistEditor`)
- `sistema-hv/src/routes/casos.financeiro.index.tsx` (alterado — `useAuth`/`can` + `canEdit` no `StageEditor` fin)
- `sistema-hv/src/routes/pipeline.tsx` (alterado — `useAuth`/`can` + `canEdit` no `StageEditor` op/fin)
- `sistema-hv/src/routes/comercial.leads.tsx` (alterado — `useAuth`/`can` + `canEdit` no `StageEditor` comercial)

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-03 | 0.1 | Draft — plugar o `StageChecklistEditor` (já existente) dentro do `StageEditor` do Kanban (fin+op) para tornar os critérios editáveis pela equipe. Frente A / Sprint 6. | @sm |
| 2026-07-03 | 1.0 | Ready for Review — `StageEditor` ganhou chevron/expand por etapa renderizando `StageChecklistEditor`; prop `canEdit` (default true) ligada a `can(role,"config.manage")` nas 3 rotas. Sem migration. Typecheck: só 3 erros pré-existentes. | @dev |
