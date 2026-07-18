# Story R1-02: Bug B3 — cliente aparece como "lead E cliente" após assinatura

- **Sprint/Epic:** Reforma 2026-07 · **R1 — Modelo Pessoa/Lead/Cliente por caso** (bloco B1)
- **ID:** R1-02
- **Status:** Draft
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

- [ ] **Confirmar aplicação da migração 0708000002** (AC:3) — checar em produção se `20260708000002_migracao_procuracao_lead.sql` já rodou; se não, aplicar via `npx tsx scripts/db-apply-pg.ts <arquivo.sql>`.
- [ ] **Auditoria de incoerência** (AC:1,3) — listar casos com combinação suspeita:
  - `lifecycle='CLIENTE'` sem `doc_kind='contrato'` ASSINADO;
  - `lifecycle='LEAD'` **com** `assinatura_liberada_at` setado (viola CHECK — deve dar 0);
  - `procuracao_assinada_at` setado com `lifecycle='CLIENTE'` porém sem contrato.
- [ ] **Migração de reconciliação (se sobrar dado)** — apenas DADOS (não toca colunas ⇒ **não** recria a view). Idempotente + evento `reconciliacao_b3`. Rollback correspondente.
- [ ] **UI (AC:2)** — garantir que o roster/ficha não rotule a PESSOA como "lead" quando todos os casos dela já são CLIENTE (a fonte é a view; validar que o filtro está por caso vivo em LEAD).
- [ ] **Testes** (AC:1-5) — ver Testing; `npx tsc --noEmit` / `npm run lint` verdes.

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
- Auditoria: 0 casos com `lifecycle='LEAD'` + `assinatura_liberada_at` (CHECK garante).
- Caso CLIENTE-só-por-procuração é reconciliado para LEAD; evento registrado; 2ª execução no-op.
- Pessoa com caso LEAD + caso CLIENTE segue nas duas abas (não é o bug).
- Após assinar contrato do último caso LEAD da pessoa, ela some de Leads.
- `npm run typecheck` / `npm run lint` verdes.

---

## Dependências

- **Depende de:** R1-01 (auditoria/regras validadas). Reusa a migração `20260708000002` já existente.
- **Habilita:** R1-03 (aba casos separa leads — a UI usa a distinção correta).
- **Cruzamento com R2 (TEMA):** nenhum. B3 é puramente lifecycle; independe de tema.

## File List

- `sistema-hv/supabase/migrations/2026071x000001_reconciliacao_b3.sql` (novo — condicional)
- `sistema-hv/supabase/rollbacks/2026071x000001_reconciliacao_b3.rollback.sql` (novo — condicional)
- `sistema-hv/src/components/clients/ClientRoster.tsx` (validar filtro por caso)

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-18 | 0.1 | Draft inicial (bug B3 / B1) | @sm |
