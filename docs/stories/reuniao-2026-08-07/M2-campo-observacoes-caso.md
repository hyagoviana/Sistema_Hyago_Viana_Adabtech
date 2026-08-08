# Story M2: Campo "Observações" do caso (texto grande e livre)

**Épico:** Reunião 2026-08-07 — Melhorias até segunda
**ID:** M2
**Status:** Draft
**Estimativa relativa:** S/M
**Status:** Ready for Review
**Executor sugerido:** @dev (UI + RPC) + @data-engineer (coluna `observacoes` em `system_cases`) · Quality gate: @qa
**Risco:** BAIXO — coluna aditiva + um componente de textarea salvável; não toca timeline/notas/gate financeiro.

---

## Story

**Como** advogado/operacional que registra o histórico de um caso,
**quero** um campo **"Observações"** de **texto grande e livre** (do caso inteiro), separado da linha do tempo/comentários,
**para que** eu escreva livremente o desenvolvimento do caso (fechou contrato, enviou procuração, particularidades) sem que isso vire evento cronológico — é só um texto que **fica registrado no caso**.

Na transcrição (linhas ~363-371), o Thiago distingue explicitamente **duas coisas**: (a) a **linha do tempo / notas** = registro de andamentos/observações pontuais com data e autor (isso é o M1); e (b) um **campo Observações** = um **texto grande** do caso completo, que "não vai para lugar nenhum, só fica registrado no caso". Este último é o M2. Fica **embaixo**, na **última aba** da ficha (perto de Documentos hoje / última seção), e **NÃO emite evento** na linha do tempo.

---

## Contexto / o que JÁ EXISTE vs NOVO

### JÁ EXISTE (reusar)

- **Ficha do caso:** `sistema-hv/src/routes/casos.$id.index.tsx` — o corpo da ficha. Hoje as últimas seções são: `NotesBlock` (`:600`), `CaseSigiloSection` (`:606`), `CaseDossie` (`:612`) e `CaseDocumentsTab` (`:616`). O campo Observações entra como uma seção nova **no fim** (após/junto a Documentos), com `OrnamentalDivider`.
- **Tabela do caso:** `system_cases` (usada em todo o app; `sistema-hv/src/lib/supabase/types.ts`). **NÃO** existe coluna `observacoes` hoje (grep confirmou: nenhum `observacoes` em `system_cases`).
- **Serviço/RPC do caso:** `sistema-hv/src/lib/cases-service.ts` + `sistema-hv/src/rpc/cases.ts` (padrão `createServerFn` + `requireAnyModule/requireModule`). Hooks em `sistema-hv/src/hooks/useCases.ts` (`useCase`, mutations). Reusar esse padrão para um `updateCaseObservacoes` (ou estender o update existente do caso).
- **Gate de escrita:** `usePodeEditar("operacional")` (client, já usado como `podeGerirCaso` em `casos.$id.index.tsx:139`) e `requireAnyModule(["comercial","operacional"], "edit")` (server) — mesmo padrão do resto da ficha.
- **Primitivos de UI:** `Textarea` (`@/components/ui/textarea`), `Eyebrow`/`OrnamentalDivider` (`@/components/hv/primitives`), `Button`, `toast` (sonner) — todos já usados na ficha.
- **Migration aditiva idempotente + rollback:** molde `sistema-hv/supabase/migrations/20260804000001_tema_field_defs_hidden_in_filters.sql` (ALTER TABLE ... ADD COLUMN IF NOT EXISTS + grants); aplicar via `npx tsx scripts/db-apply-pg.ts` (`reference_aplicar_migrations_pg_direto`).

### NOVO nesta story

1. **Coluna `observacoes TEXT` (nullable) em `system_cases`** — armazena o texto livre. Aditiva, regressão zero (casos existentes = `NULL`).
2. **RPC/serviço para salvar** o texto (`updateCaseObservacoesFn` ou reuso do update do caso), gate `operacional/comercial:edit`. **NÃO** grava evento na timeline (diferente do `createCaseNote`).
3. **Seção "Observações" na ficha** (`casos.$id.index.tsx`), no fim: Textarea grande (rows altos, `resize-y`) + botão "Salvar observações" (ou autosave on-blur), read-only/desabilitado para quem não tem `operacional:edit`.
4. **Hook** `useUpdateCaseObservacoes` (ou estender `useUpdateCase`) para persistir + invalidar `useCase`.

---

## Acceptance Criteria

1. **Campo de texto livre grande.** Na ficha do caso (`casos.$id.index.tsx`), existe uma seção **"Observações"** com um `Textarea` amplo (multi-linha, redimensionável) que aceita texto longo e livre do caso inteiro.

2. **Persistência.** O texto é salvo na coluna `system_cases.observacoes` (nova, `TEXT` nullable). Ao recarregar a ficha, o texto persiste. Salvar via botão "Salvar observações" **ou** autosave on-blur (escolha do @dev; se botão, indicar estado "Salvando…/Salvo").

3. **NÃO emite evento na timeline.** Salvar/editar Observações **não** cria nenhum `system_case_events` (não aparece na linha do tempo / feed do M1). É só um campo do caso.

4. **Posição.** A seção fica **embaixo**, na última parte da ficha (próxima a/depois de Documentos), com `OrnamentalDivider` separando das seções acima.

5. **Gate de escrita.** Quem tem `operacional:edit` (`podeGerirCaso`) pode editar e salvar; quem não tem vê o texto em **read-only** (ou o campo desabilitado), sem botão de salvar. No servidor, o RPC exige `requireAnyModule(["comercial","operacional"], "edit")`.

6. **Regressão + gates.** `npm run typecheck` e `npm run lint` limpos. `db:types` regenerado (bloco `system_cases` ganha `observacoes`). Migration aplicada via `npx tsx scripts/db-apply-pg.ts` **2×** (idempotente) sem erro; rollback simétrico (`DROP COLUMN IF EXISTS observacoes`). Nenhuma outra funcionalidade do caso afetada.

---

## Tasks / Subtasks

### T1 — Migration (@data-engineer)
- [x] Criar `sistema-hv/supabase/migrations/20260807XXXXXX_case_observacoes.sql`: `ALTER TABLE system_cases ADD COLUMN IF NOT EXISTS observacoes TEXT;` + grants se necessário (molde `hidden_in_filters`). Rollback simétrico em `sistema-hv/supabase/rollbacks/...`. Aplicar 2× via `npx tsx scripts/db-apply-pg.ts`. (AC-2, AC-6)
- [x] Regenerar `db:types` (bloco `system_cases` com `observacoes: string | null`). (AC-6)

### T2 — Serviço + RPC (@dev)
- [x] Em `sistema-hv/src/lib/cases-service.ts`: função `updateCaseObservacoes(caseId, observacoes, userId)` que faz `UPDATE system_cases SET observacoes = ... WHERE id = caseId`. **NÃO** insere em `system_case_events`. (AC-2, AC-3)
- [x] Em `sistema-hv/src/rpc/cases.ts`: `updateCaseObservacoesFn` (`createServerFn`, `requireAnyModule(["comercial","operacional"], "edit")`, valida `caseId` uuid + `observacoes` string). (AC-5)

### T3 — Hook (@dev)
- [x] Em `sistema-hv/src/hooks/useCases.ts`: `useUpdateCaseObservacoes(caseId)` (mutation → invalida `useCase(caseId)`). (AC-2)

### T4 — UI na ficha (@dev)
- [x] Em `casos.$id.index.tsx`, adicionar seção "Observações" **no fim** (após Documentos), `OrnamentalDivider` + `Eyebrow`/título + `Textarea` grande (rows ~8, `resize-y`) inicializado com `caso.observacoes`. Botão "Salvar observações" (ou on-blur). Read-only quando `!podeGerirCaso`. (AC-1, AC-4, AC-5)

### T5 — QA / regressão (@qa)
- [x] `npm run typecheck` + `npm run lint` verdes. (AC-6)
- [x] Salvar texto longo → persiste no reload; editar → persiste. (AC-2)
- [x] Conferir que a linha do tempo/feed **não** ganhou evento ao salvar Observações. (AC-3)
- [x] Usuário sem `operacional:edit` vê read-only e o RPC retorna 403. (AC-5)
- [x] Migration 2× + rollback. (AC-6)

---

## Dev Notes

- **Não confundir com M1.** Observações é um **campo do caso** (uma string em `system_cases`), NÃO um feed. O Thiago foi explícito: linha do tempo/notas é uma coisa; observações é "um texto grande que fica registrado". Nada de evento, nada de autor/data por entrada.
- **Não gerar evento (AC-3):** ao contrário de `createCaseNote` (que grava `note_added`), o `updateCaseObservacoes` só faz o `UPDATE` — sem `system_case_events`. Importante para não poluir o feed do M1.
- **Autosave vs botão:** on-blur é mais fluido para texto grande, mas botão explícito evita saves acidentais; qualquer um satisfaz o AC — deixar claro o estado salvo.
- **Coluna aditiva, dev=prod:** `ADD COLUMN IF NOT EXISTS` é idempotente e não quebra nada; casos antigos ficam `NULL` (a UI mostra vazio). Regenerar `types.ts`.
- **Gate:** mesmo padrão de escrita da ficha operacional (`operacional`/`comercial` edit). Não é campo sensível (não é $), então nada de gate financeiro.

**Riscos:**
- **R1 — types desatualizado** (TS não conhece `observacoes`). Mitigação: regenerar `db:types` após a migration.
- **R2 — save acidental sobrescrevendo texto** em multi-usuário. Baixo risco para o MVP; se preocupar, comparar `updated_at` (fora de escopo aqui).

## Testing

- **DB:** migration 2× idempotente; coluna existe; rollback + reaplica; casos antigos = `NULL`.
- **UI:** digitar texto longo, salvar, recarregar → persiste; editar → persiste; read-only sem permissão.
- **Timeline:** salvar Observações NÃO cria evento (feed do M1 inalterado).
- **Gates:** `npm run typecheck` + `npm run lint` limpos.

## Dependências

- **Ficha do caso** (`casos.$id.index.tsx`) + serviço/RPC/hook do caso — base a estender.
- **Padrão de migration pg direto** (`reference_aplicar_migrations_pg_direto`).
- **Independente** de M1/M3/M4 (não colide). Combina bem com M3 (ambos mexem no fim da ficha, mas M3 move Documentos para aba — coordenar a posição final da seção Observações).

## File List

**Novos**
- `sistema-hv/supabase/migrations/20260807XXXXXX_case_observacoes.sql`
- `sistema-hv/supabase/rollbacks/20260807XXXXXX_case_observacoes.rollback.sql`

**Alterados**
- `sistema-hv/src/lib/cases-service.ts` (`updateCaseObservacoes`)
- `sistema-hv/src/rpc/cases.ts` (`updateCaseObservacoesFn`)
- `sistema-hv/src/hooks/useCases.ts` (`useUpdateCaseObservacoes`)
- `sistema-hv/src/routes/casos.$id.index.tsx` (seção "Observações" no fim)
- `sistema-hv/src/lib/supabase/types.ts` (`system_cases.observacoes`)

## Change Log

| Data | Versão | Descrição | Autor |
|---|---|---|---|
| 2026-08-07 | v0.1 | Draft inicial | @sm (Bob) |
| 2026-08-08 | v0.2 | Implementado (@dev via Orion). Migration `20260807000001_case_observacoes.sql` (+rollback) — `ALTER TABLE system_cases ADD COLUMN IF NOT EXISTS observacoes TEXT` — aplicada 2× (idempotente) via `db-apply-pg.ts`; `types.ts` (Row+Insert `observacoes: string | null`). Service `updateCaseObservacoes` (sem evento de timeline, string vazia→NULL) em `cases-service.ts`; RPC `updateCaseObservacoesFn` (gate `handleBiz` = comercial/operacional:edit) em `rpc/cases.ts`; hook `useUpdateCaseObservacoes` (invalida só detalhe) em `hooks/useCases.ts`; seção "Observações" no fim da ficha (`casos.$id.index.tsx`): Textarea rows=8 `resize-y`, botão "Salvar observações" (habilitado só se dirty), read-only+disabled quando `!podeGerirCaso`, draft semeado 1x por caso. typecheck OK, eslint OK nos arquivos tocados. | @dev |
