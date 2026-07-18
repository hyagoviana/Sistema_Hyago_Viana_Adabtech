# Story R1-02: Bug B3 — cliente aparece como "lead E cliente" após assinatura

- **Sprint/Epic:** Reforma 2026-07 · **R1 — Modelo Pessoa/Lead/Cliente por caso** (bloco B1)
- **ID:** R1-02
- **Status:** Ready for Review
- **Estimativa relativa:** S–M (correção de derivação/UI de status; reconciliação de dados legados)
- **Executor sugerido:** @dev (serviço/UI) + @qa · Quality gate: @architect

---

## Story

**Como** dono do escritório (Hyago),
**quero** que, após a assinatura, a pessoa reflita o lifecycle **correto por caso** (deixe de aparecer como "lead **e** cliente" ao mesmo tempo indevidamente),
**para que** a base de leads não fique poluída com quem já é cliente naquele caso.

---

## Contexto / o que JÁ EXISTE vs NOVO

> **Bug do Hyago (doc-mestre §8, item B3):** *"lead+cliente juntos"* → mapeado para o lifecycle por caso (§3.4), bloco **B1**.

**Diagnóstico da causa (correto e esperado × incorreto):**
- É **correto** (E1) uma pessoa aparecer em Leads **e** em Clientes quando tem casos DIFERENTES em lifecycles diferentes (1 caso LEAD + 1 caso CLIENTE). As views fazem isso de propósito — `20260702000002_views_leads_clientes.sql:22-41` (leads) e `:47-65` (clientes).
- É **BUG** quando o **MESMO** caso conta como lead **e** cliente — tipicamente por dado legado: caso promovido a CLIENTE **apenas por procuração** (sem contrato), ou `lifecycle`/carimbos incoerentes deixados por integrações antigas (n8n promoveu sem carimbar — ver comentário em `20260708000002_migracao_procuracao_lead.sql:9-13`).

- **JÁ EXISTE (correção estrutural de dados):** `20260708000002_migracao_procuracao_lead.sql` rebaixa CLIENTE-só-por-procuração → LEAD (idempotente, auditado, reversível). **Confirmar se foi aplicada em produção.**
- **JÁ EXISTE (gatilhos corretos):** `registrarProcuracaoAssinada` (segue LEAD) e `promoverCasoOperacional` (só contrato ⇒ CLIENTE) em `cases-service.ts:816` / `:879`.
- **JÁ EXISTE (UI de status):** ficha do cliente `clientes.$id.tsx` NÃO exibe badge de lifecycle da pessoa hoje; o roster (`ClientRoster.tsx`) mostra as abas Leads/Clientes.
- **NOVO:** (a) **reconciliação** dos casos legados incoerentes que ainda causam "lead+cliente" no MESMO caso; (b) exibição de status **por caso** onde hoje o usuário se confunde (ver R1-03 para a aba de casos); (c) garantir que a pessoa só apareça em Leads por causa de casos REALMENTE em LEAD.

> **DECISÃO TRAVADA:** a pessoa reflete o lifecycle **derivado dos casos**. Nenhum status é gravado na pessoa. A correção de B3 é (1) sanear dados legados e (2) deixar claro na UI qual **caso** está em qual estágio (não a pessoa "em dois estados" de forma confusa).

---

## Acceptance Criteria

1. Nenhum **caso** aparece simultaneamente como LEAD e CLIENTE (impossível pela coluna única `lifecycle`; validado por auditoria — 0 casos com carimbos incoerentes que a UI trate como ambíguo).
2. Após a assinatura do **contrato** de um caso, esse caso sai de Leads e entra em Clientes; a pessoa deixa de aparecer em Leads **se não tiver mais nenhum caso LEAD**.
3. Casos legados promovidos só por procuração são reconciliados (rebaixados a LEAD **ou** promovidos a CLIENTE conforme houver contrato assinado) — sem duplo estado no mesmo caso.
4. A migração de reconciliação é **idempotente** e **auditada** (evento em `system_case_events`); rodar 2x não altera de novo.
5. Regressão: uma pessoa com 1 caso LEAD + 1 caso CLIENTE **continua** aparecendo corretamente nas duas abas (isso NÃO é o bug).

---

## Tasks / Subtasks

- [x] **Confirmar aplicação da migração 0708000002** (AC:3) — auditoria confirma o critério da 0708 já saneou o legado original; nenhum caso residual `rebaixado_lead_migracao_s9` pendente. Não foi necessário reaplicar.
- [x] **Auditoria de incoerência** (AC:1,3) — rodada via `scripts/db-query.ts` (read-only). Números em Testing.
  - (a) `lifecycle='CLIENTE'` sem `doc_kind='contrato'` ASSINADO = **3** (todos = combinado "Contrato e procuração", NÃO bug);
  - (b) `lifecycle='LEAD'` **com** `assinatura_liberada_at` = **0** (CHECK garante);
  - (c) `procuracao_assinada_at` + `lifecycle='CLIENTE'` sem `doc_kind='contrato'` = **3** (mesmos 3 casos de (a)).
- [x] **Migração de reconciliação — NÃO criada** — os 3 casos flagados pelo critério literal da 0708 são CLIENTEs LEGÍTIMOS do modelo de documento COMBINADO (S9-12): o doc assinado é "Contrato e procuração" (`doc_kind='procuracao'`) e a regra do owner 2026-07-08 (webhook.ts:158) promove a CLIENTE em QUALQUER assinatura. Cada um tem evento `contrato_assinado`. Aplicar o critério literal rebaixaria cliente legítimo → NÃO fazer. Auditoria refinada (CLIENTE sem NENHUM doc assinado E sem evento `contrato_assinado`) = **0**. Banco limpo de B3 real.
- [x] **UI (AC:2)** — roster valida OK. As abas derivam por caso: "cliente" via `system_cases_active` `lifecycle='CLIENTE'` (por pessoa distinta); "lead" = roster-mestre por decisão do owner (AJUSTE A 2026-07-07 / memória "Leads=lista/roster"). Pessoa em 2 abas por casos distintos é o comportamento CORRETO (E1). Nenhum bug de filtro. Sem alteração de código.
- [x] **Testes** (AC:1-5) — `npm run test:rbac` verde. `npm run typecheck` só com erros PRÉ-EXISTENTES não relacionados a B3 (nenhum código tocado; tree limpa).

---

## Dev Notes

**Arquivos a tocar:**
- `sistema-hv/supabase/migrations/2026071x000001_reconciliacao_b3.sql` (novo — só se a auditoria achar dado residual) + rollback.
- `sistema-hv/src/lib/cases-service.ts` (referência dos gatilhos — auditar).
- `sistema-hv/src/components/clients/ClientRoster.tsx` / `src/routes/clientes.$id.tsx` (garantir exibição por caso).

**Regras de ouro (pertinentes):**
- Se a reconciliação for **só DADOS** (UPDATE de `lifecycle`/carimbos), **NÃO** recriar `system_cases_active` (não toca colunas) — igual ao padrão de `20260708000002_migracao_procuracao_lead.sql:23-24`.
- **NÃO** remover CHECKs de lifecycle.
- **NÃO** recriar `trg_system_cases_bifurcacao`.
- Migração idempotente + auditada + rollback (padrão do projeto).
- Escrita de lifecycle é RPC-only — se precisar mexer em runtime, usar as funções existentes.

**Riscos de regressão:**
- Confundir o comportamento CORRETO (pessoa em 2 abas por 2 casos distintos) com o bug ⇒ NÃO "deduplicar" a pessoa entre abas. O critério do bug é **mesmo caso** incoerente.
- Rebaixar indevidamente um CLIENTE legítimo (com contrato assinado) ⇒ o WHERE deve exigir ausência de `doc_kind='contrato'` ASSINADO (idêntico ao critério validado em 0708000002).

### Testing

**Auditoria (read-only, `scripts/db-query.ts`, banco dev=prod) — 2026-07-18:**

| # | Critério | Resultado |
|---|----------|-----------|
| (a) | `lifecycle='CLIENTE'` sem `doc_kind='contrato'` ASSINADO | **3** |
| (b) | `lifecycle='LEAD'` com `assinatura_liberada_at` setado (viola CHECK) | **0** |
| (c) | `procuracao_assinada_at` + `lifecycle='CLIENTE'` sem `doc_kind='contrato'` | **3** (= os mesmos 3 de (a)) |
| (refinado) | `CLIENTE` sem NENHUM doc ASSINADO **E** sem evento `contrato_assinado` | **0** |

**Análise dos 3 casos flagados (a/c):** COVID-2026-0103, COVID-2026-0110, COVID-2026-0112.
Todos têm doc assinado com título "Contrato e procuração - 1% COVID" gravado como
`doc_kind='procuracao'` (documento COMBINADO — modelo S9-12) e evento `contrato_assinado`
via webhook. São CLIENTEs LEGÍTIMOS pela regra do owner 2026-07-08 (`zapsign/webhook.ts:158`:
"QUALQUER documento assinado promove a CLIENTE"). O critério literal da 0708000002
(`doc_kind='contrato' ASSINADO`) ficou DEFASADO frente ao doc combinado — aplicá-lo
rebaixaria clientes reais. **Por isso NÃO foi criada migration de reconciliação.**

**Regressão E1 (AC-5) confirmada:** cliente "Matheus Torquato" aparece em Leads E Clientes
CORRETAMENTE — tem 5 casos LEAD + 2 casos CLIENTE (casos distintos). Os outros 2 (só 1 caso
CLIENTE cada) aparecem só em Clientes. Nenhum caso conta como LEAD e CLIENTE ao mesmo tempo.

**Validação:**
- `npm run test:rbac` — VERDE (todos os testes passaram).
- `npm run typecheck` — erros PRÉ-EXISTENTES (termo-service, visibility do
  `system_case_checklist_item_assignees`, casos.$id / casos.financeiro), NÃO relacionados a
  B3. Nenhum código foi tocado nesta story (working tree limpa), logo nenhum erro novo.

---

## Dependências

- **Depende de:** R1-01 (auditoria/regras validadas). Reusa a migração `20260708000002` já existente.
- **Habilita:** R1-03 (aba casos separa leads — a UI usa a distinção correta).
- **Cruzamento com R2 (TEMA):** nenhum. B3 é puramente lifecycle; independe de tema.

## File List

Nenhum arquivo criado ou alterado. A story foi resolvida por AUDITORIA (read-only):
o banco não tem incoerência B3 real; a UI já está correta por decisão do owner.

- `docs/stories/reforma-2026-07/R1-02-bug-b3-lead-e-cliente-juntos.md` (atualizada — esta story)
- ~~`sistema-hv/supabase/migrations/20260718000002_reconciliacao_b3.sql`~~ — NÃO criado (sem dado residual)
- ~~`sistema-hv/supabase/rollbacks/...`~~ — NÃO criado
- `sistema-hv/src/components/clients/ClientRoster.tsx` (auditado — sem mudança; filtro correto)
- `sistema-hv/src/lib/clients-service.ts` (auditado — `listClientsByLifecycle` deriva por caso; Leads=roster por AJUSTE A)
- `sistema-hv/src/lib/zapsign/webhook.ts` (auditado — regra owner 2026-07-08: qualquer assinatura ⇒ CLIENTE)

## Dev Agent Record

**Agente:** @dev (James) · **Data:** 2026-07-18

**Resumo da decisão:** Auditoria (read-only) achou 3 casos CLIENTE sem `doc_kind='contrato'`
ASSINADO, MAS investigação dos docs + eventos mostrou que os 3 têm o documento COMBINADO
"Contrato e procuração" assinado (gravado como `doc_kind='procuracao'`) + evento
`contrato_assinado`. São CLIENTEs legítimos do modelo S9-12 e da regra do owner 2026-07-08
(`zapsign/webhook.ts:158`). O critério literal da 0708000002 está defasado frente ao doc
combinado — rebaixá-los seria bug. Auditoria refinada (CLIENTE sem QUALQUER doc assinado E
sem evento `contrato_assinado`) = 0 → **sem B3 real; migration de reconciliação NÃO criada.**

UI validada: as abas derivam por caso via views/`system_cases_active`; "Leads" é o roster-mestre
por decisão do owner (AJUSTE A 2026-07-07). Pessoa em 2 abas por casos distintos é o
comportamento CORRETO (E1). Nenhum bug de filtro. Nenhum código tocado.

**Guardrails respeitados:** só SELECT no banco; nenhuma migration aplicada/criada; nenhum
CHECK removido; `trg_system_cases_bifurcacao` intacto; nenhum commit/push; nenhum CLIENTE
legítimo rebaixado.

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-18 | 0.1 | Draft inicial (bug B3 / B1) | @sm |
| 2026-07-18 | 0.2 | Auditoria concluída: 0 B3 real (3 flagados = combinado legítimo); sem migration; UI OK; test:rbac verde. Ready for Review. | @dev |
