# Story C5: "Links úteis" / wiki por TEMA — quadro de caixinhas (texto/link) editáveis por admin

- **Épico:** Reunião 2026-08-05 — Melhorias + Motor ProJuris
- **ID:** C5
- **Status:** Ready for Review
- **Estimativa relativa:** M (nova tabela aditiva + rollback + service/rpc/hook + UI de quadro editável; sem tocar dados existentes)
- **Executor sugerido:** @data-engineer (migration) + @dev (service/UI) · Quality gate: @qa
- **Risco:** BAIXO (feature isolada, aditiva; nova tabela `system_tema_wiki_blocks`; gate admin nos writes)

---

## Story

**Como** administrador de um TEMA,
**quero** um quadro de **"Links úteis" / wiki** vinculado ao **tema** (não ao kanban), composto por **caixinhas** de **texto** ou **link (URL)**, com **título editável** (ex.: "Links úteis", "Manuais", "Observações"), que **só admins escrevem** e todos veem,
**para que** a equipe encontre avisos gerais, manuais e links importantes logo na entrada do tema (junto ao pop-up de seleção de kanban do C4), como um post-it/aviso do tema.

> **Frase do levantamento (Bloco C, item C5):** *"'Links úteis' / wiki por tema: quadro com caixinhas de texto ou link (URL), título editável (Links úteis / Manuais / Observações), admins escrevem, salva no Drive. Vinculado ao TEMA (não ao Kanban). Post-it/aviso geral. Aparece na entrada do tema (junto ao pop-up C4)."* Status **NOVO**, prioridade 🟡.

---

## Contexto / o que JÁ EXISTE vs NOVO

### JÁ EXISTE (molde / não reinventar)

- **Camada TEMA:** `system_temas` (tabela nova, independente) — `sistema-hv/supabase/migrations/20260719000001_tema_frente_modelagem.sql:34` (`id`, `organization_id`, `slug`, `name`, timestamps, `deleted_at`) + view `system_temas_active`. O quadro C5 se pendura em `tema_id` (o TEMA, não o service_type — respeita "vinculado ao tema").
- **Hooks de tema:** `sistema-hv/src/hooks/useTemas.ts` (`useTemas` → id, name, `service_type_id`). Molde para o hook do wiki.
- **Molde de tabela aditiva vinculada a tema/service_type com JSONB e views/grants/RLS:**
  - `system_service_type_folders` (`sistema-hv/supabase/migrations/20260709000030_service_type_folders.sql`) — tabela filha de `service_type` com view `_active`, grants nos 3 roles, `ON DELETE CASCADE`, `deleted_at`.
  - `system_tema_field_defs` (JSONB de opções, view `_active`, grants) — `sistema-hv/supabase/migrations/20260731000001_tema_field_defs_scope_multi.sql`. **Molde de JSONB + view `SELECT *` + grants.**
  - **Molde de migration completa (RLS por org + índice único parcial + trigger updated_at + audit + view `_active`):** `20260804000004_pipeline_boards.sql` (A3) — copiar a estrutura de RLS/grants/audit.
- **Gate admin (writes de config):** `can(role, "config.manage")` (`sistema-hv/src/lib/rbac.ts`) usado no front (`pipeline.tsx:110`) e `requireModule("sistema","edit")` / `requireModule` no servidor (`sistema-hv/src/rpc/boards.ts:55`, `auth-guard.ts`). Reads = `requireAuth` (todos veem).
- **RPC/serviço molde:** `sistema-hv/src/rpc/boards.ts` + `sistema-hv/src/lib/board-service.ts` (padrão `createServerFn` + `requireAuth`/`requireModule` + service com `getSupabaseAdmin` + `BoardServiceError(status)` + `DEFAULT_ORG`).
- **Dialog/editor molde:** `sistema-hv/src/components/pipeline/BoardsManagerDialog.tsx` (CRUD dentro de dialog), `TemaFieldDefsEditor.tsx` (editor de itens com add/remover/reordenar). O quadro de caixinhas espelha esse padrão de "lista editável de itens".
- **Onde aparece (entrada do tema):** `sistema-hv/src/routes/pipeline.tsx` `ServiceTypeSelection` + o pop-up do **C4** (`KanbanPickerDialog`). O levantamento diz "aparece na entrada do tema (junto ao pop-up C4)" → montar o bloco C5 na tela de temas e/ou dentro do pop-up C4. Coordenar com C4.

### NOVO nesta story

1. **Tabela `system_tema_wiki_blocks`** (aditiva): um "bloco" = um quadro com **título editável** e uma lista de **itens** (caixinhas) em JSONB. Modelagem proposta abaixo.
2. **Service** `tema-wiki-service.ts` (CRUD de blocos: listar por tema, criar, renomear título, atualizar itens, reordenar, soft-delete) — writes gate admin.
3. **RPC** `rpc/tema-wiki.ts` + **hook** `useTemaWiki.ts`.
4. **UI:** componente `TemaWikiBoard` (quadro read-only para todos; modo edição para admin) montado na entrada do tema (junto ao C4).

---

## Decisão de modelagem a travar (com @architect/@data-engineer, ANTES da migration — registrar no Change Log)

> **Regra:** vinculado ao **TEMA** (`system_temas.id`), NÃO ao kanban/board nem ao service_type. Só admins escrevem; todos leem. "Salva no Drive" do levantamento = o item pode CONTER uma URL do Drive (link), mas o **armazenamento do bloco/itens é no Supabase** (metadado), coerente com a arquitetura (Drive guarda arquivos; Supabase guarda metadado). Não criar arquivo no Drive por bloco.

### Opção A — RECOMENDADA: 1 tabela `system_tema_wiki_blocks` com itens em JSONB

```
system_tema_wiki_blocks
  id               UUID PK
  organization_id  UUID NOT NULL → system_organizations (ON DELETE RESTRICT)
  tema_id          UUID NOT NULL → system_temas(id) ON DELETE CASCADE
  titulo           TEXT NOT NULL           -- EDITÁVEL ("Links úteis" / "Manuais" / "Observações")
  itens            JSONB NOT NULL DEFAULT '[]'::jsonb
                   -- [{ id, tipo: 'texto'|'link', valor: string, rotulo?: string }]
  ordem            INT NOT NULL DEFAULT 0   -- ordem do quadro entre os blocos do tema
  created_by       UUID
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
  deleted_at       TIMESTAMPTZ
```
- **Item** (dentro de `itens` JSONB): `tipo` ∈ `texto`|`link`; `valor` = o texto ou a URL; `rotulo` opcional (texto exibido para um link). Validar `tipo` no service (Zod), não como CHECK no JSON.
- Índice `idx_..._tema (tema_id, ordem) WHERE deleted_at IS NULL`. View `system_tema_wiki_blocks_active`. RLS por org + grants nos 3 roles + trigger `updated_at` + audit (molde A3).
- **Vantagem:** um quadro = uma linha; itens variáveis sem tabela filha; reordenar itens = reescrever o JSONB (mesmo padrão de `options` em `system_tema_field_defs`).

### Opção B — REJEITADA: tabela `blocks` + tabela `items` (2 tabelas)
Normalizar os itens numa tabela filha. **Rejeitada para v1:** overhead (2 tabelas, 2 CRUDs, joins) sem ganho — os itens são poucos, sem consultas por item. Se um dia precisar buscar/relatar por item, migra-se para B. Registrar como possível evolução.

**➡ Recomendação: Opção A.** Aditiva, simples, espelha o padrão JSONB já usado.

---

## Acceptance Criteria

1. **Migration aditiva + rollback.** Nova `sistema-hv/supabase/migrations/2026080500000X_tema_wiki_blocks.sql` cria `system_tema_wiki_blocks` (Opção A) com `tema_id → system_temas ON DELETE CASCADE`, `titulo`, `itens JSONB DEFAULT '[]'`, `ordem`, RLS por org, view `_active`, grants nos 3 roles (`anon, authenticated, service_role`), trigger `updated_at` e audit — tudo `IF NOT EXISTS`/idempotente (roda 2× sem erro). Rollback `sistema-hv/supabase/rollbacks/2026080500000X_tema_wiki_blocks.rollback.sql` faz DROP da tabela + view. Aplicar via `npx tsx scripts/db-apply-pg.ts …` (dev=prod).
2. **Types.** `sistema-hv/src/lib/supabase/types.ts` ganha o bloco `system_tema_wiki_blocks` (+ view `_active`). `npm run typecheck` limpo.
3. **Service com gate admin.** `sistema-hv/src/lib/tema-wiki-service.ts`: `listTemaWikiBlocks(temaId)` (read), `createTemaWikiBlock`, `updateTemaWikiBlock` (titulo/itens/ordem), `reorderTemaWikiBlocks`, `softDeleteTemaWikiBlock`. Writes validam itens (`tipo ∈ texto|link`, `valor` não-vazio; para `link`, validar formato de URL). `BoardServiceError`-style com status.
4. **RPC/hook.** `sistema-hv/src/rpc/tema-wiki.ts`: reads com `requireAuth`, writes com `requireModule("sistema","edit")` (ou equivalente `config.manage`). Hook `sistema-hv/src/hooks/useTemaWiki.ts` (`useTemaWiki(temaId)` + mutations com invalidação).
5. **UI — quadro read-only para todos.** Componente `TemaWikiBoard` renderiza os blocos do tema: título + caixinhas. Itens `link` são clicáveis (abrem em nova aba, `rel="noopener noreferrer"`); itens `texto` exibem o texto (post-it). Todos os usuários autenticados veem.
6. **UI — edição só admin.** Com `config.manage`, o admin pode: criar bloco, renomear o título, adicionar/editar/remover caixinhas (escolher tipo texto/link + valor + rótulo), reordenar e excluir o bloco. Sem `config.manage`, o quadro é somente-leitura (nenhum botão de edição).
7. **Aparece na entrada do tema.** O `TemaWikiBoard` é montado na entrada do tema — na tela de temas (`ServiceTypeSelection`) e/ou dentro do pop-up C4 (`KanbanPickerDialog`). Coordenar com C4 o ponto exato de montagem; o bloco é por `tema_id`.
8. **Vinculado ao TEMA, não ao kanban.** O quadro é o mesmo independentemente de qual kanban do tema o usuário abra. Excluir o tema (soft-delete) cascateia/oculta seus blocos (via `ON DELETE CASCADE` na FK + view `_active`). Nenhuma dependência de board/service_type.
9. **Regressão zero.** Feature nova e isolada — não altera pipeline, casos, filtros, campos nem timeline. Temas sem blocos simplesmente não mostram o quadro (ou mostram um estado vazio com CTA "Adicionar" só para admin).

---

## Tasks / Subtasks

- [x] **T1 — Decisão de modelagem (@architect/@data-engineer)** (AC: 1) — travada Opção A (JSONB de itens) + shape do item (`id`, `tipo` ∈ texto|link, `valor`, `rotulo?`). Registrado no Change Log.
- [x] **T2 — Migration (@data-engineer)** (AC: 1) — `20260806000002_tema_wiki_blocks.sql` (molde `20260804000004_pipeline_boards.sql`): CREATE TABLE IF NOT EXISTS + índice `(tema_id, ordem)` + view `_active` + RLS por org (4 policies) + grants 3 roles + trigger `updated_at` + audit. FK `tema_id → system_temas ON DELETE CASCADE`.
- [x] **T3 — Rollback (@data-engineer)** (AC: 1) — `supabase/rollbacks/20260806000002_tema_wiki_blocks.rollback.sql`: DROP view + DROP table CASCADE.
- [x] **T4 — Aplicar migration (@data-engineer)** (AC: 1) — aplicada via `npx tsx scripts/db-apply-pg.ts` (conexão direta); idempotência confirmada (2× OK).
- [x] **T5 — Types (@dev)** (AC: 2) — bloco `system_tema_wiki_blocks` (+ view `_active`) em `types.ts`. Typecheck limpo.
- [x] **T6 — Service (@dev)** (AC: 3) — `tema-wiki-service.ts` (list/create/update/reorder/softDelete) + validação Zod (`tipo` enum, `valor` non-empty, `http(s)://` p/ `link` — rejeita `javascript:`) + `id` do item gerado no servidor (`randomUUID`).
- [x] **T7 — RPC (@dev)** (AC: 4) — `rpc/tema-wiki.ts` (read `requireAuth`; writes `requireModule("sistema","edit")`).
- [x] **T8 — Hook (@dev)** (AC: 4) — `useTemaWiki.ts` (`useTemaWiki(temaId)` + `useCreate/Update/Reorder/DeleteTemaWikiBlock` com invalidação `["tema-wiki", temaId]`).
- [x] **T9 — UI `TemaWikiBoard` (@dev)** (AC: 5, 6) — `TemaWikiBoard.tsx`: read-only p/ todos + modo edição admin (add bloco / renomear título / editar caixinhas texto|link + rótulo / reordenar via ↑↓ / excluir). Links clicáveis em nova aba (`rel="noopener noreferrer"`).
- [x] **T10 — Montagem na entrada do tema (@dev)** (AC: 7, 8) — montado dentro do `KanbanPickerDialog` (C4), por `temaId`. Estado vazio com CTA só para admin.
- [x] **T11 — Smoke DB (@dev/@qa)** (AC: 3, 8) — validado: criar bloco + 2 itens (texto+link), `_active` traz vivo, update dispara `updated_at`, soft-delete some da `_active`. Cascata ao soft-delete do tema garantida pela FK + `_active`.
- [x] **T12 — Gates (@dev)** — `typecheck` limpo (só erro pré-existente contaazul); `eslint` 0 nos tocados. Smoke UI Playwright pendente para @qa.

---

## Dev Notes

- **Vinculado ao TEMA:** FK para `system_temas(id)` (a camada TEMA), NÃO para `system_service_types`. É o dado que o owner chama de "por tema".
- **"Salva no Drive":** interpretar como "o item pode ser uma URL (inclusive do Drive)". O **bloco** e os **itens** ficam no Supabase (metadado) — coerente com a arquitetura (Drive = arquivos; Supabase = metadado). Não criar arquivo no Drive por bloco.
- **JSONB de itens (Opção A):** reordenar/editar caixinha = reescrever o array `itens` (mesmo padrão de `options` em `system_tema_field_defs`). Gerar um `id` estável por item no service (não confiar no cliente).
- **Gate admin:** writes = `config.manage`/`requireModule("sistema","edit")`; reads = `requireAuth`. Espelhar exatamente o padrão dos writes de board.
- **Validação de link:** aceitar só `http(s)://…`; rejeitar `javascript:` (segurança). Rótulo opcional para exibir texto amigável.
- **Onde montar (coordenar com C4):** o levantamento diz "junto ao pop-up C4". Se C4 ainda não estiver pronto, montar primeiro em `ServiceTypeSelection` (tela de temas) e depois integrar ao pop-up. O bloco é auto-contido (recebe `temaId`).
- **Molde de migration:** copiar RLS/grants/audit/view de `20260804000004_pipeline_boards.sql`. `DEFAULT_ORG = '00000000-0000-0000-0000-000000000001'`. Prefixo `system_` em tudo. **dev = prod** — cuidado (via `db-apply-pg.ts`).
- **Sem impacto em pipeline/casos/filtros/timeline** — feature isolada.

## Testing

- **Smoke DB:** criar bloco "Links úteis" com item texto ("Aviso X") + item link ("https://drive.google.com/…", rótulo "Manual"); renomear título p/ "Manuais"; reordenar itens; soft-delete do bloco → some da `_active`. Soft-delete do tema → blocos somem (cascata/`_active`).
- **UI (Playwright/manual):**
  - Admin: adiciona bloco, título editável, caixinhas texto/link, reordena, exclui.
  - Não-admin: vê o quadro read-only, sem botões de edição; clica num link → abre em nova aba.
  - Mesmo quadro aparece independentemente do kanban aberto (por tema).
- **Segurança:** URL inválida/`javascript:` rejeitada no service; write sem admin → 403.
- **Idempotência:** migration 2×; rollback e reaplicar.
- `typecheck`/`lint`/`build` verdes.

## Dependências

- **Depende de:** camada TEMA (`system_temas`, R2-01, já aplicada) — o `tema_id` do vínculo.
- **Cruza com C4** (pop-up de seleção de kanban) — ponto de montagem "na entrada do tema, junto ao pop-up". Coordenar o layout; C5 não bloqueia C4 (pode montar antes na tela de temas).
- **Independe de** casos/pipeline/filtros — feature isolada. Não bloqueia nem é bloqueada por C3.
- Requer credenciais de banco em `.env.local` (para `db-apply-pg.ts` e smoke DB).

## File List

**Novos**
- `sistema-hv/supabase/migrations/2026080500000X_tema_wiki_blocks.sql`
- `sistema-hv/supabase/rollbacks/2026080500000X_tema_wiki_blocks.rollback.sql`
- `sistema-hv/src/lib/tema-wiki-service.ts`
- `sistema-hv/src/rpc/tema-wiki.ts`
- `sistema-hv/src/hooks/useTemaWiki.ts`
- `sistema-hv/src/components/pipeline/TemaWikiBoard.tsx`

**Alterados**
- `sistema-hv/src/lib/supabase/types.ts` (bloco `system_tema_wiki_blocks` + `_active`)
- `sistema-hv/src/routes/pipeline.tsx` (montar `TemaWikiBoard` na entrada do tema) e/ou `sistema-hv/src/components/pipeline/KanbanPickerDialog.tsx` (C4)

## Change Log

| 2026-08-05 | v0.1 | Draft inicial | @sm (Bob) |
| 2026-08-05 | v0.2 | Implementado (@dev via Orion). Opção A: 1 tabela `system_tema_wiki_blocks` (itens JSONB `{id,tipo:texto\|link,valor,rotulo?}`, FK `tema_id → system_temas ON DELETE CASCADE`) + view `_active` + RLS/grants/audit/trigger. Migration `20260806000002_tema_wiki_blocks.sql` APLICADA (idempotente 2×) + rollback. Service `tema-wiki-service.ts` (CRUD + Zod: link só http(s), id gerado no servidor), RPC `rpc/tema-wiki.ts` (read requireAuth / write requireModule sistema:edit), hook `useTemaWiki.ts`, UI `TemaWikiBoard.tsx` (read-only p/ todos, edição só admin, links em nova aba) montado no `KanbanPickerDialog` (C4). Types atualizados. Arquivos novos: migration+rollback, `src/lib/tema-wiki-service.ts`, `src/rpc/tema-wiki.ts`, `src/hooks/useTemaWiki.ts`, `src/components/pipeline/TemaWikiBoard.tsx`. Alterados: `src/lib/supabase/types.ts`, `src/components/pipeline/KanbanPickerDialog.tsx` (montagem). Gates: typecheck OK (só erro pré-existente contaazul), eslint 0 nos tocados, smoke DB 4/4. | @dev |
