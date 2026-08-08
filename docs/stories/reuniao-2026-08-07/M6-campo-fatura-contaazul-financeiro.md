# Story M6: Nº da fatura do Conta Azul por cobrança (aba Financeiro)

**Épico:** Reunião 2026-08-07 — Melhorias até segunda
**ID:** M6
**Status:** Ready for Review
**Estimativa relativa:** M
**Executor sugerido:** @data-engineer (migration aditiva) + @dev (RPC + UI) · Quality gate: @qa
**Risco:** MÉDIO — coluna nova em `system_parcelas` (aditiva/idempotente) + RPC de escrita gate-ado + UI por linha. `system_parcelas` tem trigger de auditoria e RLS — respeitar o padrão.

---

## Story

**Como** financeiro que abre a aba **Financeiro** de um caso,
**quero** adicionar **manualmente** o **nº da fatura do Conta Azul** em cada **cobrança/parcela**,
**para** identificar/rastrear cada cobrança no Conta Azul (um caso tem **várias** cobranças lá, e a identificação hoje é manual).

Hoje a aba Financeiro (`casos.$id.financeiro.tsx`, F1) lista as cobranças/parcelas via `AsaasCobrancasPanel` (uma linha por parcela: `#`, vencimento, valor, status, ações). Não há onde anotar o **número da fatura do Conta Azul** correspondente a cada linha. M6 acrescenta esse campo **por parcela**.

---

## Contexto / o que JÁ EXISTE vs NOVO

### JÁ EXISTE (reusar — NÃO reconstruir)

- **Tabela `system_parcelas`.** `sistema-hv/supabase/migrations/20260608000008_s18_parcelas.sql` — uma linha por parcela/cobrança do caso: `numero`, `valor_centavos`, `vencimento`, `status`, `provider` (`'conta_azul'|'asaas'`), `provider_ext_id`, `boleto_url`, etc. Tem trigger `system_update_updated_at_column`, trigger de auditoria `system_fn_audit` e RLS org-scoped (`system_parcelas_select/insert/update`). View `system_parcelas_active`.
- **Painel de cobranças (UI).** `sistema-hv/src/components/cases/AsaasCobrancasPanel.tsx` — grid `#/vencimento/valor/status/ações` (`:151-260`), renderizado dentro da aba Financeiro (`casos.$id.financeiro.tsx:189`). Já distingue `p.provider === "conta_azul"` (`isCA`, `:166`). É AQUI que entra o campo/edição do nº da fatura.
- **Leitura das parcelas.** RPC `listParcelasFn` (`sistema-hv/src/rpc/termo.ts:177`) → service `listParcelas` (`sistema-hv/src/lib/termo-service.ts`). Hook `useParcelas(caseId)` (`sistema-hv/src/hooks/useTermo.ts:177`) — o painel já consome; a coluna nova volta no `SELECT *`.
- **Escritas de parcela (molde de RPC gate-ado).** `darBaixaParcelaFn`/`deleteParcelaFn`/`estornarParcelaFn` em `rpc/termo.ts` (usam `handleWrite`) + hooks `useDarBaixaParcela`/`useDeleteParcela` (`useTermo.ts`). Molde exato para o novo `setParcelaContaAzulFaturaFn`.
- **Gate de edição financeira.** `casos.$id.financeiro.tsx` já calcula `podeEditarFin = usePodeEditar("financeiro")` (`:29`) e o painel de $ só monta com `financeiro:view`. Os writes do servidor usam `requireModule('financeiro', ...)` (ver `reference_rbac_edit_gate`).
- **dev = prod / migrations via pg direto.** `npx tsx scripts/db-apply-pg.ts supabase/migrations/<arquivo>.sql` (2× idempotente) + rollback simétrico em `sistema-hv/supabase/rollbacks/` (`reference_aplicar_migrations_pg_direto`). Cabeçalho/estilo: ver `20260806000006_case_judicial_espelho.sql`.
- **`db:types`** regenerado após DDL (`sistema-hv/src/lib/supabase/types.ts`).

### NOVO nesta story

1. **Migration aditiva**: `ALTER TABLE system_parcelas ADD COLUMN IF NOT EXISTS contaazul_fatura_numero TEXT;` (nasce NULL; sem CHECK; identificação livre). Rollback simétrico (`DROP COLUMN IF EXISTS`). Idempotente. RLS/trigger existentes já cobrem a linha — nenhuma policy nova.
2. **RPC de escrita** `setParcelaContaAzulFaturaFn` (POST) em `sistema-hv/src/rpc/termo.ts`: `{ parcelaId, faturaNumero: string|null }`; `requireModule('financeiro','edit')`; `UPDATE system_parcelas SET contaazul_fatura_numero WHERE id=parcelaId` (via service `setParcelaContaAzulFatura` em `termo-service.ts`, org-scoped). Aceita limpar (vazio → NULL).
3. **Hook** `useSetParcelaContaAzulFatura(caseId)` em `useTermo.ts` — invalida `["parcelas", caseId]`.
4. **UI no `AsaasCobrancasPanel`**: por linha, exibir o nº da fatura CA quando houver + um controle inline para **editar/adicionar** (input pequeno ou popover com "Salvar"), visível/editável só com `podeEditarFin`. Faz sentido destacar nas parcelas `provider === "conta_azul"`, mas o pedido é "por cobrança" — permitir em qualquer linha (a fatura CA é uma identificação manual, independente do provider automático).

---

## Acceptance Criteria

1. **Coluna nova em `system_parcelas`.** Migration aditiva/idempotente cria `contaazul_fatura_numero TEXT` (NULL default), com rollback simétrico. Aplicada 2× sem erro; nenhuma tabela existente tocada; RLS/triggers existentes seguem valendo. `db:types` regenerado.
2. **Campo por cobrança/parcela na aba Financeiro.** No `AsaasCobrancasPanel` (dentro da aba Financeiro), cada linha de parcela permite **ver** e **editar** o nº da fatura do Conta Azul. Um caso com N parcelas tem N valores independentes.
3. **Persistência gate-ada.** Salvar grava `system_parcelas.contaazul_fatura_numero` da parcela via RPC que passa por `requireModule('financeiro','edit')` (403 para quem não pode editar, mesmo chamando o RPC direto). Aceita **limpar** (vazio → NULL).
4. **Só edita quem pode.** O controle de edição só aparece/funciona com `podeEditarFin` (`usePodeEditar('financeiro')`); quem tem só `financeiro:view` vê o número mas não edita. Quem não tem `financeiro:view` nem chega ao painel (gate da página, já existente).
5. **Volta na leitura.** `listParcelas` passa a retornar `contaazul_fatura_numero` (via `SELECT *` ou coluna explícita), e o painel exibe. Sem valor → estado neutro ("—"/"Adicionar nº da fatura").
6. **Regressão / gates.** `npm run typecheck` + `npm run lint` limpos; `db:types` ok. As cobranças/parcelas existentes continuam listando/dando baixa/cancelando normalmente; a coluna nova é opcional e não afeta os fluxos Asaas/Conta Azul automáticos.

---

## Tasks / Subtasks

### T1 — DDL aditiva (@data-engineer)
- [ ] Migration `sistema-hv/supabase/migrations/20260807XXXXXX_parcela_contaazul_fatura.sql`: `ALTER TABLE system_parcelas ADD COLUMN IF NOT EXISTS contaazul_fatura_numero TEXT;` (comentário de coluna opcional). Idempotente. Aplicar via `db-apply-pg.ts` (2×). (AC-1)
- [ ] Rollback `sistema-hv/supabase/rollbacks/20260807XXXXXX_parcela_contaazul_fatura.rollback.sql`: `ALTER TABLE system_parcelas DROP COLUMN IF EXISTS contaazul_fatura_numero;`. (AC-1)
- [ ] `db:types` regenerado. (AC-1, AC-6)

### T2 — Service + RPC de escrita (@dev)
- [ ] `setParcelaContaAzulFatura(parcelaId, faturaNumero)` em `sistema-hv/src/lib/termo-service.ts` (org-scoped, admin client). Trim → `null` se vazio. (AC-3)
- [ ] `setParcelaContaAzulFaturaFn` (POST) em `sistema-hv/src/rpc/termo.ts` com `requireModule('financeiro','edit')` (molde `deleteParcelaFn`/`handleWrite`). Zod `{ parcelaId: uuid, faturaNumero: string.nullish() }`. (AC-3, AC-4)

### T3 — Leitura inclui a coluna (@dev)
- [ ] Garantir que `listParcelas` devolve `contaazul_fatura_numero` (se for `SELECT *`, sai de graça; senão adicionar a coluna ao select). (AC-5)

### T4 — Hook (@dev)
- [ ] `useSetParcelaContaAzulFatura(caseId)` em `sistema-hv/src/hooks/useTermo.ts` — mutation; invalida `["parcelas", caseId]`. (AC-2, AC-5)

### T5 — UI por linha (@dev)
- [ ] Em `sistema-hv/src/components/cases/AsaasCobrancasPanel.tsx`, na coluna de cada parcela, exibir o nº da fatura CA (ou "—") + controle inline de editar/adicionar (input + Salvar ou popover), gate-ado por `podeEditarFin` (passar a prop do painel financeiro, ou consumir `usePodeEditar('financeiro')` no painel). Toasts `sonner` no padrão do arquivo. (AC-2, AC-4)

### T6 — QA / regressão (@qa)
- [ ] Migration 2× + rollback; `db:types` ok. (AC-1, AC-6)
- [ ] Salvar/editar/limpar o nº da fatura em ≥2 parcelas do mesmo caso → valores independentes; persistem no reload. (AC-2, AC-5)
- [ ] `setParcelaContaAzulFaturaFn` como não-editor → 403; leitura como `financeiro:view` vê mas não edita. (AC-3, AC-4)
- [ ] `npm run typecheck` + `npm run lint` verdes; fluxos de baixa/cancelamento intactos. (AC-6)

---

## Dev Notes

- **Por que coluna (não tabela nova):** é 1:1 com a parcela (uma fatura CA por cobrança/linha) e o painel já itera parcela-a-parcela. Coluna `TEXT` aditiva é o mínimo. Sem CHECK — é identificação livre digitada pelo humano.
- **`system_parcelas` tem auditoria + RLS.** A coluna nova entra na tabela existente; o trigger `system_fn_audit` já registra o UPDATE, e as policies `system_parcelas_update` (org-scoped) já autorizam. **Não** criar policy nova.
- **Gate = `financeiro:edit`.** Reusar exatamente o padrão da aba: `podeEditarFin = usePodeEditar('financeiro')` na UI + `requireModule('financeiro','edit')` no RPC (ver `reference_rbac_edit_gate`). O painel `AsaasCobrancasPanel` hoje NÃO recebe `podeEditarFin` — passar como prop de `casos.$id.financeiro.tsx` (que já o calcula) OU consumir o hook direto no painel. Preferir prop para manter o painel "burro".
- **Independe do provider.** Embora o número seja do Conta Azul, o pedido é "por cobrança"; permitir preencher em qualquer parcela (não só `provider === 'conta_azul'`). Se quiser, destacar visualmente nas linhas `isCA`.
- **NÃO** integrar com a API do Conta Azul aqui — é **preenchimento manual** de identificação (a integração de campos CA×ProJuris é F4, futuro). Nada de sync automático do número.
- **dev = prod:** `npx tsx scripts/db-apply-pg.ts supabase/migrations/20260807XXXXXX_parcela_contaazul_fatura.sql` (2×) de dentro de `sistema-hv/`. Rollback em `sistema-hv/supabase/rollbacks/`.

**Riscos:**
- **R1 — `SELECT` explícito em `listParcelas` sem a coluna nova** → o campo não volta pro front. Mitigação: T3 confere o select.
- **R2 — editar por engano sem permissão** → gate no servidor (não só UI) barra; QA confirma 403.
- **R3 — colidir com sync automático de parcelas** (Asaas/CA reescreve a linha): o sync NÃO mexe em `contaazul_fatura_numero` (coluna nova, fora dos upserts existentes) — confirmar que os syncs fazem update de colunas específicas e não sobrescrevem a linha inteira.

## Testing

- **DDL:** aplicar migration 2× (idempotente); rollback + reaplicar; `db:types` regenerado.
- **CRUD do campo:** adicionar/editar/limpar o nº da fatura em várias parcelas do mesmo caso; persiste no reload; valores independentes por linha.
- **Gate:** RPC como não-editor → 403; `financeiro:view` vê mas não edita.
- **Regressão:** dar baixa/cancelar/gerar cobrança continuam funcionando; syncs não apagam o campo.
- **Gates:** `npm run typecheck` + `npm run lint` limpos.

## Dependências

- **`system_parcelas` (S18, 2026-06-08)** + `AsaasCobrancasPanel` + `useParcelas`/`listParcelas` — base direta.
- **Story F1 (submenu financeiro)** — a aba onde o painel vive.
- **`reference_rbac_edit_gate`** — `requireModule('financeiro','edit')` + `usePodeEditar('financeiro')`.
- Requer credenciais de banco em `.env.local` (aplicar migration por pg direto).

## File List

**Novos**
- `sistema-hv/supabase/migrations/20260807XXXXXX_parcela_contaazul_fatura.sql`
- `sistema-hv/supabase/rollbacks/20260807XXXXXX_parcela_contaazul_fatura.rollback.sql`

**Alterados**
- `sistema-hv/src/lib/termo-service.ts` (`setParcelaContaAzulFatura` + coluna no select de `listParcelas` se explícito)
- `sistema-hv/src/rpc/termo.ts` (`setParcelaContaAzulFaturaFn`)
- `sistema-hv/src/hooks/useTermo.ts` (`useSetParcelaContaAzulFatura`)
- `sistema-hv/src/components/cases/AsaasCobrancasPanel.tsx` (campo/edição por linha + prop `podeEditarFin`)
- `sistema-hv/src/routes/casos.$id.financeiro.tsx` (passa `podeEditarFin` ao painel, se via prop)
- `sistema-hv/src/lib/supabase/types.ts` (coluna nova, regenerado)

## Change Log

| Data | Versão | Descrição | Autor |
|---|---|---|---|
| 2026-08-07 | v0.1 | Draft inicial | @sm (Bob) |
| 2026-08-08 | v1.0 | Implementado: migration `20260808000020_parcela_contaazul_fatura.sql` (coluna `contaazul_fatura_numero TEXT` + **CREATE OR REPLACE da view `system_parcelas_active`** p/ reexpandir `SELECT *`) aplicada 2× via `db-apply-pg.ts`; rollback simétrico (drop view→drop col→recria view). `setParcelaContaAzulFatura` (service, vazio→NULL) + `setParcelaContaAzulFaturaFn` (RPC, `financeiro:edit`) + `useSetParcelaContaAzulFatura` (hook). UI: coluna "Fatura CA" no `AsaasCobrancasPanel` com edição inline (`FaturaContaAzulCell`, gate por `podeEditarFin` passado do Financeiro). Types: CLI `supabase` indisponível no Windows → colunas `observacoes`/`contaazul_fatura_numero` adicionadas manualmente em `types.ts` (o `db:types` truncou o arquivo; restaurado via git). Typecheck OK. | @aios-master (Orion) |
