# Story R1-01: Lifecycle Lead/Cliente é POR CASO — validar e ajustar (E1)

- **Sprint/Epic:** Reforma 2026-07 · **R1 — Modelo Pessoa/Lead/Cliente por caso** (bloco B1 do doc-mestre)
- **ID:** R1-01
- **Status:** Draft
- **Estimativa relativa:** M (auditoria + ajustes de regra; sem reconstruir o lifecycle — ele já existe)
- **Executor sugerido:** @dev (regras/serviço) + @qa (matriz de estados) · Quality gate: @architect

---

## Story

**Como** escritório que atende a mesma pessoa em várias frentes,
**quero** que "lead" e "cliente" sejam status **por CASO** (não da pessoa), refletindo contrato/procuração assinados por caso,
**para que** uma pessoa possa ser lead num caso e cliente em outro ao mesmo tempo, sem status "grudado" na pessoa.

---

## Contexto / o que JÁ EXISTE vs NOVO

> **Regra de leitura (doc-mestre §3.4 / §6-B1):** *"Grande parte já existe no lifecycle atual — validar e ajustar UI."* Esta story NÃO reconstrói o modelo; ela **audita** o que já existe e **ajusta** o que estiver divergente da decisão E1.

- **JÁ EXISTE (coluna de estado por caso):** `system_cases.lifecycle TEXT NOT NULL DEFAULT 'LEAD'` + `perdido_at` + `perdido_motivo` — `20260702000001_case_lifecycle.sql:30-33`. Domínio via CHECK `system_cases_lifecycle_domain_chk` (`:36-40`).
- **JÁ EXISTE (invariantes de banco — NÃO remover):** `system_cases_assinatura_lifecycle_chk` (`assinatura_liberada_at NOT NULL ⇒ lifecycle <> 'LEAD'`, `:60-66`) e `system_cases_perdido_lifecycle_chk` (`perdido_at NOT NULL ⇒ lifecycle = 'PERDIDO'`, `:69-75`).
- **JÁ EXISTE (transições no serviço):**
  - `registrarProcuracaoAssinada` (`cases-service.ts:816-860`): procuração assinada = evento **comercial**, `macrostatus_comercial='GANHO'`, **NÃO** muda `lifecycle` (segue LEAD). Confirmado alinhado a E1.
  - `promoverCasoOperacional` (`cases-service.ts:879-951`): **só** contrato assinado ⇒ `lifecycle='CLIENTE'` + `assinatura_liberada_at`. Confirmado alinhado a E1.
  - `marcarCasoPerdido` (`cases-service.ts:970-1016`) ⇒ `PERDIDO`.
- **JÁ EXISTE (migração de dados que sustenta E1/B3):** `20260708000002_migracao_procuracao_lead.sql` — rebaixa CLIENTE-só-por-procuração de volta a LEAD (critério: sem `doc_kind='contrato'` ASSINADO). É a base histórica do bug B3 (tratado em R1-02).
- **NOVO (nesta story):** apenas (a) **auditoria** dos dados de produção contra as invariantes; (b) **ajuste de regra** onde o lifecycle não estiver sendo derivado por caso; (c) documento de estados (matriz LEAD/CLIENTE/PERDIDO × gatilho). **Sem** nova coluna de lifecycle na PESSOA — proibido criar status na `system_clients`.

> **DECISÃO TRAVADA (E1 + doc-mestre §3.4):** o estado de vida vive no **CASO**. A pessoa (`system_clients`) **não** tem coluna `lifecycle`; o status dela é **derivado** dos casos (views `system_clients_leads/_clientes/_perdidos`). Caso sem contrato assinado = LEAD (→ comercial); caso com **contrato+procuração** assinados = CLIENTE (→ operacional/financeiro).

---

## Acceptance Criteria

1. **Auditoria passa:** query de produção confirma zero violação das invariantes (`assinatura_liberada_at ⇒ ≠LEAD`, `perdido_at ⇒ PERDIDO`, `lifecycle ∈ {LEAD,CLIENTE,PERDIDO}`). Resultado registrado na story.
2. **Nenhum status na pessoa:** confirmado que `system_clients` NÃO tem coluna de lifecycle e que toda derivação de status da pessoa passa pelas views por-caso.
3. **Procuração assinada NÃO promove a cliente:** um caso com só procuração assinada permanece `lifecycle='LEAD'` (via `registrarProcuracaoAssinada`), aparece no comercial como `GANHO`.
4. **Contrato assinado promove a cliente:** um caso com contrato assinado vira `lifecycle='CLIENTE'` (via `promoverCasoOperacional`), com `assinatura_liberada_at` carimbado no mesmo patch (respeitando o CHECK).
5. **Pessoa em 2 estados simultâneos:** uma pessoa com 1 caso LEAD e 1 caso CLIENTE aparece nas DUAS views (`system_clients_leads` **e** `system_clients_clientes`) sem duplicar linhas dentro de cada view.
6. As invariantes/CHECKs de lifecycle **não** foram removidas nem afrouxadas.

---

## Tasks / Subtasks

- [ ] **Auditoria de dados (AC:1,2)** — script/consulta read-only (via `scripts/db-query.ts` ou equivalente):
  - [ ] Contar casos por `lifecycle`; listar violações das 3 invariantes (esperado 0).
  - [ ] Confirmar ausência de coluna de lifecycle em `system_clients` (`information_schema.columns`).
  - [ ] Registrar o resultado numérico na seção Testing desta story.
- [ ] **Validação de regra no serviço (AC:3,4)** — revisar `registrarProcuracaoAssinada` e `promoverCasoOperacional` (`cases-service.ts`) e confirmar (com teste) que procuração ≠ promoção; contrato = promoção. Ajustar SOMENTE se divergir.
- [ ] **Validação das views (AC:5)** — confirmar que `system_clients_leads/_clientes/_perdidos` agregam por caso e não duplicam pessoa. Ajuste apenas se houver duplicação.
- [ ] **Matriz de estados (doc)** — tabela LEAD/CLIENTE/PERDIDO × gatilho (criar caso / procuração / contrato / perder / reverter), anexada às Dev Notes ou a um MD curto em `docs/reforma-2026-07/`.
- [ ] **Testes** (AC:1-6) — cenários de estado (ver Testing); `npx tsc --noEmit` / `npm run lint` verdes.

---

## Dev Notes

**Arquivos a tocar (auditar; alterar só se divergir):**
- `sistema-hv/src/lib/cases-service.ts` (`registrarProcuracaoAssinada`, `promoverCasoOperacional`, `marcarCasoPerdido`).
- `sistema-hv/supabase/migrations/20260702000001_case_lifecycle.sql` (referência — **não** editar migration já aplicada).
- `sistema-hv/supabase/migrations/20260702000002_views_leads_clientes.sql` (referência das views).

**Regras de ouro (pertinentes):**
- **NÃO** remover os CHECKs de lifecycle (`lifecycle_domain`, `assinatura⇒≠LEAD`, `perdido⇒PERDIDO`) — doc-mestre §5.5 / R5.
- **NÃO** deletar `case_type` / `macrostatus_*` (dual-write via `system_fn_sync_stage_ids`).
- **NÃO** recriar `trg_system_cases_bifurcacao` (dropado).
- Se QUALQUER migration for necessária tocando colunas de `system_cases`: **RECRIAR `system_cases_active` (DROP+CREATE)** preservando TODAS as colunas + grants `anon/authenticated/service_role`. (Esta story tende a ser **auditoria pura**, sem migration.)
- Escrita de lifecycle é **RPC-only** (centralizada em `cases-service`).

**Riscos de regressão:**
- Afrouxar o CHECK `assinatura⇒≠LEAD` quebra a reversão CLIENTE→PERDIDO (S1-01b). Não tocar.
- Criar status na pessoa (mesmo "cache") reintroduz o bug B3 — **proibido**.

### Testing
- LEAD→(procuração)→segue LEAD + comercial GANHO.
- LEAD→(contrato)→CLIENTE + `assinatura_liberada_at` setado.
- Pessoa com caso LEAD + caso CLIENTE aparece nas duas views, 1 linha em cada.
- Auditoria: 0 violações das 3 invariantes (número registrado).
- `npm run typecheck` / `npm run lint` verdes.

---

## Dependências

- **Depende de:** nada (fundação já implementada nos S1-0x/S9-0x). É a story-base do épico R1.
- **Habilita:** R1-02 (bug B3), R1-03 (aba casos separa leads), R1-04 (ficha ramificada por tema).
- **Cruzamento com R2 (TEMA):** nenhuma dependência dura. A derivação de status por caso é ortogonal ao tema; R1-01 não muda com a chegada do TEMA.

## File List

- `sistema-hv/src/lib/cases-service.ts` (auditoria; alterar só se divergir)
- `docs/reforma-2026-07/R1-01-matriz-estados.md` (novo — matriz de estados; opcional)

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-18 | 0.1 | Draft inicial (épico R1 / B1) | @sm |
