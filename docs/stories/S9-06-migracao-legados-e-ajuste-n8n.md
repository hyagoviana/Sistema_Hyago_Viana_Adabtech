# Story S9-06: Migração de dados legados (rebaixar CLIENTE-por-procuração → LEAD) + ajustar endpoint n8n (não promover na procuração)

- **Sprint:** 9 — Modelo definitivo Lead→Comercial→Operacional
- **ID:** S9-06
- **Status:** Ready for Review
- **Estimativa relativa:** M (migration de DADOS reversível + auditada; ajuste no `n8n-webhook-service` para registrar procuração em vez de promover)
- **Executor sugerido:** @data-engineer (migração de dados) + @dev (n8n) · Quality gate: @architect

---

## Story

**Como** administrador do escritório,
**quero** rebaixar os casos que viraram CLIENTE **apenas por procuração** de volta a LEAD (movendo o carimbo para `procuracao_assinada_at`) e ajustar o endpoint n8n para **não promover** na procuração,
**para que** os dados legados fiquem coerentes com o modelo novo (procuração ≠ contrato) e a automação pare de transformar procuração assinada em CLIENTE.

---

## Contexto / o que JÁ EXISTE vs NOVO

- **JÁ EXISTE (legado):** o modelo antigo tratava **procuração assinada = CLIENTE**. Backfill da `20260702000001` (`:48-51`) setou `lifecycle='CLIENTE'` para todo caso com `assinatura_liberada_at`. Owner confirma: há **~1 caso** CLIENTE que virou **por procuração** (não por contrato). Casos "aguardando assinatura" já estão corretos (LEAD).
- **JÁ EXISTE (n8n, S8-01):** `n8n-webhook-service.ts` — no ramo `assinado=true` grava a procuração ASSINADA (`:455-482`) e **PROMOVE a CLIENTE** via `promoverCasoManual` (`:504-520`). **No modelo novo isso está ERRADO** (procuração não promove).
- **JÁ EXISTE (gatilho comercial):** `registrarProcuracaoAssinada` (S9-03).
- **NOVO:** (a) **migration de dados** que identifica o(s) caso(s) CLIENTE-por-procuração e os rebaixa para LEAD, movendo `assinatura_liberada_at → procuracao_assinada_at` (limpando `assinatura_liberada_at`/`_by`), com **evento auditado** e **reversível** (rollback); (b) ajustar `n8n-webhook-service.ts` para, no `assinado=true` (procuração), chamar **`registrarProcuracaoAssinada`** em vez de `promoverCasoManual` (a pessoa segue LEAD; a promoção a CLIENTE agora é só por contrato).

> **CRITÉRIO DE IDENTIFICAÇÃO (a validar com dados reais):** "CLIENTE por procuração" = caso `lifecycle='CLIENTE'` cuja promoção veio da procuração e **não** de um contrato assinado. Como hoje só existe o carimbo `assinatura_liberada_at` (que no legado significava procuração), o critério prático é: casos CLIENTE com `assinatura_liberada_at NOT NULL` **e sem** documento `doc_kind='contrato'` ASSINADO no caso. **@data-engineer deve LISTAR os candidatos e conferir com o owner antes do UPDATE** (é ~1 caso; verificação manual barata). Casos genuinamente fechados por contrato (se houver) NÃO são rebaixados.

---

## Acceptance Criteria

1. Uma consulta de diagnóstico LISTA os casos candidatos a rebaixamento (CLIENTE + `assinatura_liberada_at NOT NULL` + sem doc `doc_kind='contrato'` ASSINADO) — documentada na story antes do UPDATE. Esperado: ~1 caso.
2. A migration rebaixa cada candidato: `lifecycle='LEAD'`, `procuracao_assinada_at = assinatura_liberada_at` (preserva o instante), `assinatura_liberada_at=NULL`, `assinatura_liberada_by=NULL`, `macrostatus_comercial='GANHO'` (procuração assinada = terminal comercial). Respeita o CHECK de S9-01 (LEAD sem `assinatura_liberada_at` é válido; LEAD com `procuracao_assinada_at` é válido).
3. Cada rebaixamento grava `system_case_events(action='rebaixado_lead_migracao_s9', diff={from:'CLIENTE', motivo:'procuracao≠contrato', assinatura_liberada_at_original})` — auditável e **reversível** (o rollback restaura `assinatura_liberada_at` e `lifecycle='CLIENTE'`).
4. **Rollback** (`supabase/rollbacks/...`) restaura os campos originais a partir do `diff` do evento (ou de uma tabela/coluna de backup) — a reversão é possível.
5. `n8n-webhook-service.ts`: no ramo `assinado=true` (procuração), passa a chamar **`registrarProcuracaoAssinada(caso.id, {via:'webhook', userId: actor})`** em vez de `promoverCasoManual`. O caso **segue LEAD**. Resposta do endpoint (`caso_promovido`/`caso_lifecycle`) reflete que NÃO houve promoção (procuração não promove). Idempotente.
6. Migration idempotente (rodar 2x não rebaixa de novo o que já é LEAD). `npm run typecheck` / `npm run lint` verdes no ajuste do n8n.

---

## Tasks / Subtasks

- [x] **Diagnóstico** (AC: 1) — rodado ANTES do UPDATE. **CRITÉRIO AJUSTADO à realidade dos dados:** o candidato NÃO é "CLIENTE + `assinatura_liberada_at NOT NULL`" (o draft supunha isso), e sim **"CLIENTE + SEM doc `doc_kind='contrato'` ASSINADO"**. Motivo: o n8n promovia via `promoverCasoManual` SEM carimbar `assinatura_liberada_at` (quando `aguardando_assinatura_at` estava NULL) — então os CLIENTE-por-procuração têm `assinatura_liberada_at IS NULL`. Candidatos detectados: **2** (`FIES-2026-0065` na 1ª contagem; `MAIS-2026-0066` entrou pelo n8n durante a sessão, mesmo perfil). Ambos com 0 contratos assinados + procuração ASSINADA.
- [x] **Migration de dados** (AC: 2, 3) — `20260708000002`: INSERT do evento auditado (com valores originais) + UPDATE movendo o carimbo (`procuracao_assinada_at = COALESCE(assinatura_liberada_at, created_at, now())`), `lifecycle='LEAD'`, limpa `assinatura_liberada_at`/`_by`, `macrostatus_comercial='GANHO'`. `WHERE` = CLIENTE sem contrato assinado; guarda por `NOT EXISTS` do evento (idempotente). Aplicada + verificada: ambos LEAD, evento gravado; 0 CLIENTE restantes; CHECK respeitado.
- [x] **Rollback** (AC: 4) — `supabase/rollbacks/20260708000002_...`: restaura `lifecycle`/`assinatura_liberada_at`/`_by` do diff do evento mais recente e zera `procuracao_assinada_at`; audita a reversão.
- [x] **Ajustar n8n** (AC: 5) — `n8n-webhook-service.ts` ramo `assinado=true` chama `registrarProcuracaoAssinada` (não `promoverCasoManual`); resposta `caso_promovido=false`, `caso_lifecycle='LEAD'`. Comentários do topo (`:11-13`, `:326`) atualizados + nota no doc S8-01.
- [x] **Testes** (AC: 6) — idempotência confirmada (2ª aplicação = no-op, evento não duplica); typecheck/lint verdes. Reconciliação de dashboards e teste ponta-a-ponta do n8n ficam para @qa (S9-10).

---

## Dev Notes

**Arquivos a tocar:**
- `sistema-hv/supabase/migrations/20260708000002_migracao_procuracao_lead.sql` (novo — migration de DADOS; timestamp POSTERIOR à S9-01).
- `sistema-hv/supabase/rollbacks/20260708000002_migracao_procuracao_lead.rollback.sql` (novo).
- `sistema-hv/src/lib/n8n-webhook-service.ts` (procuração registra, não promove).
- `docs/stories/S8-01-turbinar-endpoint-n8n-assinado.md` (nota de atualização — o endpoint não promove mais na procuração).

**REGRAS DE OURO (pertinentes):**
- Esta migration **NÃO toca colunas** de `system_cases` (só DADOS) → **NÃO recria `system_cases_active`**. (Se, por engano, alterar coluna, recriar a view — mas não é o caso.)
- **NÃO recriar `trg_system_cases_bifurcacao`** (regra de ouro 6).
- Aplicar via **`npx tsx scripts/db-apply-pg.ts <arquivo.sql>`** (pg direto; banco dev = prod).
- `system_case_events.action` **sem CHECK** → `rebaixado_lead_migracao_s9` entra livre.
- **Ordem:** roda DEPOIS de S9-01 (usa `procuracao_assinada_at`) e depois de S9-03 (o n8n chama `registrarProcuracaoAssinada`). Idealmente depois de S9-04 também (para que "promover" já signifique operacional).

**Riscos de regressão:**
- **Não rebaixar** casos genuinamente fechados por contrato — daí o diagnóstico manual antes do UPDATE. Critério conservador (só sem `doc_kind='contrato'` ASSINADO).
- O rollback precisa de fonte de verdade do valor original — gravar `assinatura_liberada_at` original no `diff` do evento (ou backup) ANTES de limpar.
- Ajuste do n8n: garantir que `resolveSystemActorId`/ator continue disponível para o evento comercial (best-effort se ausente).

### Testing
- Rodar diagnóstico → confirma ~1 caso.
- Aplicar migration → o caso vira LEAD com `procuracao_assinada_at` = o antigo `assinatura_liberada_at`; evento gravado; view coerente.
- Rollback → caso volta a CLIENTE com `assinatura_liberada_at` restaurado.
- n8n `assinado=true` num caso → grava procuração ASSINADA + `registrarProcuracaoAssinada` (LEAD), `caso_promovido=false`.

---

## Dependências

- **Depende de:** S9-01 (`procuracao_assinada_at`), S9-03 (`registrarProcuracaoAssinada` — o n8n passa a chamá-la), preferencialmente S9-04 (semântica de "promover").
- **Habilita:** dados/automação coerentes com o modelo novo. S9-10 reconcilia contagens de "clientes" nos dashboards após o rebaixamento.

---

## Diagnóstico executado (2026-07-03, antes do UPDATE)

Query (por caso CLIENTE, contando contratos/procurações ASSINADOS):

```sql
select c.id, c.case_code, c.assinatura_liberada_at,
       (select count(*) from system_case_documents d
         where d.case_id=c.id and d.doc_kind='contrato'
           and d.status='ASSINADO' and d.deleted_at is null) as contratos_assinados
from system_cases c
where c.lifecycle='CLIENTE' and c.deleted_at is null;
```

Resultado: **2 candidatos**, ambos `contratos_assinados=0` + procuração ASSINADA:
`FIES-2026-0065` (0568b602-…) e `MAIS-2026-0066` (82874e45-…, criado pelo n8n
durante a sessão). Ambos tinham `assinatura_liberada_at IS NULL` — daí o ajuste
de critério (o carimbo movido para `procuracao_assinada_at` usou o fallback
`created_at`). Pós-migration: **0 CLIENTE**, os 2 viraram LEAD com
`procuracao_assinada_at`+`GANHO`; invariante do CHECK intacta.

## Test cases (Matriz de Testes Mínimos)

- Caso próprio: **rebaixamento reversível auditado** (CLIENTE-por-procuração → LEAD) + **n8n registra em vez de promover**. Toca dados reais — diagnóstico manual obrigatório antes do UPDATE.

---

## File List

- `sistema-hv/supabase/migrations/20260708000002_migracao_procuracao_lead.sql` (novo)
- `sistema-hv/supabase/rollbacks/20260708000002_migracao_procuracao_lead.rollback.sql` (novo)
- `sistema-hv/src/lib/n8n-webhook-service.ts` (procuração registra, não promove)
- `docs/stories/S8-01-turbinar-endpoint-n8n-assinado.md` (nota de atualização)

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-03 | 0.1 | Draft inicial — migração de legados (rebaixar CLIENTE-por-procuração) + n8n não promove na procuração (Sprint 9) | @sm |
| 2026-07-03 | 1.0 | Implementada. Critério de candidato ajustado à realidade (CLIENTE + sem contrato assinado, pois legado tinha `assinatura_liberada_at` NULL). Migration `20260708000002` (2 casos rebaixados, auditado+reversível, idempotente) + rollback. n8n passa a registrar procuração (não promove); resposta `caso_promovido=false`/LEAD. Nota em S8-01. typecheck/lint ok. | @dev |
