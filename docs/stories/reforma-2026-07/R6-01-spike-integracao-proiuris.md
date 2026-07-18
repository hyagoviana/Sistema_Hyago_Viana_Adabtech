# Story R6-01: Spike + spec de integração ProIuris (API + cron de ingestão)

- **Épico:** R6 — Controladoria + distribuição de tarefas (E6, bloco B6)
- **ID:** R6-01
- **Status:** Draft — DESIGN/SPIKE (NÃO codar produção ainda)
- **Estimativa relativa:** M (spike de investigação + documento de spec, sem produção)
- **Executor sugerido:** @architect + @data-engineer (spike) · Quality gate: @architect
- **Natureza:** ALTO NÍVEL / DESIGN. Entregável = **spec aprovada**, não feature em produção.

---

## 🔴 PRÉ-REQUISITOS BLOQUEANTES (não iniciar produção sem)

- **API ProIuris** — credenciais (client_id/secret ou API key), URL base, ambiente (sandbox/prod), endpoints de **movimentações/intimações**, formato de autenticação, limites de rate. *(pendência do cliente §9.4 do doc-mestre)*
- **N7 (doc-mestre)** — decisão de como **vincular casos existentes ao ProIuris** (o judicial já existe lá): chave de correlação (nº do processo? CPF? nº interno?).
- **Mockup** da tela de Controladoria (§9.3) — pelo menos rascunho da lista de intimações.

> Enquanto os bloqueantes não chegarem, esta story produz **apenas o documento de spec + protótipo de contrato de dados** (não escreve no banco de produção).

---

## Story

**Como** arquiteto/controladoria,
**quero** uma spec técnica validada da integração ProIuris (autenticação, endpoints, cron de ingestão, formato de payload e chave de correlação com nossos casos),
**para que** a implementação de R6-02/03/04 (dedup, triagem, tarefas, distribuição) comece sobre um contrato de dados estável, sem retrabalho e sem risco ao núcleo `system_cases`.

---

## Contexto / o que JÁ EXISTE vs NOVO

- **JÁ EXISTE (rotas placeholder):** `src/routes/controladoria.index.tsx`, `controladoria.prazos.tsx`, `controladoria.excecoes.tsx`, `controladoria.decisoes.tsx`, `controladoria.teses.tsx` — telas estáticas, sem dados reais. Servem de casca da UI.
- **JÁ EXISTE (padrão de integração externa):** todo externo passa pelo **n8n** (memória `project_stack_simplified`) ou por cron server-side (ex.: Conta Azul cron 08:30 — `8cc04d0`). Decidir ProIuris via **n8n** (recomendado, alinhado ao stack) **ou** cron server-side no padrão Conta Azul → **é um dos pontos da spec**.
- **JÁ EXISTE (padrão cron):** sync Conta Azul cron 08:30 grava `system_parcelas.provider/provider_ext_id`. Reusar o padrão de idempotência (`provider_ext_id` como chave anti-duplicata).
- **NOVO:** tabela-staging de intimações cruas (`system_intimacoes` — proposta), campo de correlação em `system_cases`, e o job de ingestão.

> **DECISÃO A TRAVAR NA SPEC:** ingestão via **n8n** (escrevendo na staging) vs **cron server-side** (`src/rpc` + serviço). Default recomendado: **n8n** (consistente com o stack), com a staging como fronteira.

---

## Acceptance Criteria (de DESIGN — "spec aprovada")

1. **Documento de spec aprovado** em `docs/reforma-2026-07/spec-proiuris.md` cobrindo: autenticação, lista de endpoints usados, exemplo de payload real (ou mock representativo), campos que interessam (nº processo, órgão, prazo, tipo de movimentação/intimação, data, partes).
2. **Contrato de dados definido:** schema proposto da staging `system_intimacoes` (colunas + tipos + chave anti-dup `provider_ext_id`/hash) **documentado** (migration ainda NÃO aplicada em produção — só rascunho no doc/rollback).
3. **Chave de correlação intimação→caso definida** (N7): como amarrar uma intimação a um `system_cases` existente (por nº de processo em `canonical_fields`? novo campo `processo_numero`?). Decisão registrada com impacto na Matriz §5.
4. **Cadência do cron definida:** madrugada e/ou fim do dia (janelas, timezone America/Sao_Paulo, política de retry/backoff), documentada.
5. **Sem escrita em produção:** o spike não altera `system_cases` nem cria dados reais; qualquer chamada à API ProIuris é read-only/sandbox.

---

## Tasks / Subtasks

- [ ] **Spike 1 — Autenticação/endpoints** (AC:1) — validar credenciais ProIuris num ambiente isolado; mapear endpoints de movimentações/intimações e paginação. *(bloqueado por credenciais)*
- [ ] **Spike 2 — Payload real** (AC:1) — coletar 3–5 payloads reais/mock; identificar campos úteis e variações por tipo de intimação.
- [ ] **Spike 3 — Correlação caso↔processo** (AC:3, N7) — investigar como os casos existentes se ligam ao número de processo; propor campo/chave. Cruza com `canonical_fields` (S2-07).
- [ ] **Design — staging `system_intimacoes`** (AC:2) — rascunho de migration + rollback (NÃO aplicar): colunas cruas + `raw JSONB` + `provider_ext_id`/`content_hash` UNIQUE + `status` (nova/confirmada/arquivada) + `case_id` nullable + `dedup_group_id` nullable.
- [ ] **Design — job de ingestão** (AC:4) — decidir n8n vs cron server-side; definir janelas, timezone, retry/backoff, idempotência.
- [ ] **Escrever** `docs/reforma-2026-07/spec-proiuris.md` e submeter a @architect.

---

## Dev Notes

**Arquivos/artefatos previstos (design, não produção):**
- NOVO doc `docs/reforma-2026-07/spec-proiuris.md`.
- RASCUNHO (não aplicar) `sistema-hv/supabase/migrations/` staging `system_intimacoes` + rollback.
- Referência de padrão cron: sync Conta Azul (`8cc04d0`), `system_parcelas.provider_ext_id`.

**Regras de ouro:**
- **Não** tocar `case_type`/`macrostatus_*` (trigger dual-write §3.2/§5).
- Se propor campo novo em `system_cases` (ex.: `processo_numero`), **recriar `system_cases_active` (DROP+CREATE)** preservando todas as colunas (regra de ouro 2) — mas só na fase de implementação, não no spike.
- Integração externa preferir **n8n** (memória `project_stack_simplified`).

### Testing (de design)
- Spec revisada e aprovada por @architect.
- Schema da staging validado contra 3–5 payloads reais/mock (todos os campos mapeiam).

---

## Cruzamentos

- **R6↔S2-07** (`canonical_fields`): chave de correlação processo↔caso pode morar aí.
- **R6→R6-02/03/04:** habilita dedup, triagem, tarefas e distribuição.
- **R8↔R6:** a mesma integração ProIuris alimenta dados de inadimplência (R8-02).

---

## Dependências

- **Bloqueada por:** credenciais/endpoints ProIuris; decisão N7; mockup da tela.
- **Habilita:** R6-02 (dedup/triagem), R6-03 (tarefas), R6-04 (distribuição).

## File List

- `docs/reforma-2026-07/spec-proiuris.md` (novo — design)

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-18 | 0.1 | Draft de alto nível (spike + spec) — bloco B6 | @sm |
