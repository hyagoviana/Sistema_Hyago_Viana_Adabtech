# Review Arquitetural — MVP-Drive

> Revisão técnica dos ADRs, schema SQL e decisões de implementação.
> **Revisor:** Aria (Architect) · **Data:** 2026-05-21 · **Versão revisada:** v1.0

---

## 🟢 Veredito geral

**APROVADO COM RESSALVAS.**

Plano sólido, decisões alinhadas com as restrições do projeto (Lovable imutável, stack simplificada, n8n adiado). 8 ADRs bem fundamentados. Schema enxuto e extensível.

**3 BLOCKERs** identificados (precisam endereçar antes do `@dev` começar).
**7 SHOULD-FIX** (corrigir durante a sprint, não bloqueante).
**5 NICE-TO-HAVE** (backlog).

---

## 🚫 BLOCKERs (resolver antes de iniciar Sprint MVP-1)

### BLOCKER-A1 — Vercel runtime não declarado nos ADRs

**Problema:** `googleapis` é pacote Node-only (~6MB). Em Vercel, TanStack Start API routes podem rodar em Edge Runtime por default. Edge **não suporta** `googleapis`.

**Impacto:** Build pode funcionar, runtime falha com `node:crypto`, `node:stream`, `node:net` indisponíveis.

**Ação requerida:**
- Criar **ADR-MVP-09 — Runtime Node.js para API routes**
- Em cada route que usa Drive, declarar:
  ```typescript
  export const runtime = 'nodejs'
  ```
- Documentar no README do `sistema-hv/`

---

### BLOCKER-A2 — UNIQUE constraint de CPF/CNPJ não considera soft-delete

**Problema:** No schema (Sprint MVP-1):
```sql
CONSTRAINT clients_cpf_cnpj_org_unique UNIQUE (organization_id, cpf_cnpj)
```

Se cliente A é soft-deleted e Hyago tenta re-cadastrar mesmo CPF, **constraint bloqueia**.

**Ação requerida:** Substituir por partial unique index:
```sql
-- Remover constraint anterior, criar:
CREATE UNIQUE INDEX clients_cpf_cnpj_org_unique
  ON clients (organization_id, cpf_cnpj)
  WHERE deleted_at IS NULL;
```

Atualizar `sprint-mvp-01-foundation.md` Story 1.1.

---

### BLOCKER-A3 — Service Account precisa ser MEMBRO do Shared Drive (não basta compartilhar pasta)

**Problema:** ADR-MVP-04 menciona Shared Drive como recomendação, mas não documenta que a SA **precisa ser adicionada como Membro do Shared Drive** (Member > Content Manager) — não basta compartilhar uma pasta dentro dele.

**Impacto:** Se Hyago só adicionar SA na pasta, `createFile` com `driveId` retorna 404.

**Ação requerida:**
- Adicionar ao `README.md` do MVP-Drive (seção "Dependências externas"):
  > Para Shared Drive: Hyago precisa adicionar `hv-drive@hv-sistema.iam.gserviceaccount.com` como **Content Manager** (ou Manager) do Shared Drive inteiro, NÃO só de uma pasta interna.
- Adicionar ao ADR-MVP-04 nota explícita.
- Smoke test no Sprint MVP-1 deve detectar falta de membership (logar `403 + storageQuotaExceeded` ou similar).

---

## ⚠️ SHOULD-FIX (durante Sprint MVP-1)

### SHOULD-A1 — `drive_file_id` deveria ter UNIQUE

**Atual:**
```sql
drive_file_id   TEXT NOT NULL,
```

**Recomendado:**
```sql
drive_file_id   TEXT NOT NULL UNIQUE,
```

**Razão:** Garante 1:1 entre arquivo do Drive e metadado. Detecta double-insert em concorrência.

---

### SHOULD-A2 — Falta índice em `audit_log` para queries comuns

**Adicionar:**
```sql
CREATE INDEX idx_audit_log_actor ON audit_log(actor_id, created_at DESC) WHERE actor_id IS NOT NULL;
CREATE INDEX idx_audit_log_action ON audit_log(action, created_at DESC);
```

Sem esses, queries por usuário ou tipo de ação fazem seq scan completo.

---

### SHOULD-A3 — `drive_sync_error TEXT` sem limite — risco de blow up

**Atual:** `drive_sync_error TEXT` aceita qualquer tamanho. Stack trace de Drive pode crescer >10KB.

**Recomendado:**
```sql
drive_sync_error   VARCHAR(2000),
```

Ou estruturar como JSONB:
```sql
drive_sync_error   JSONB  -- { code, message, retried_count }
```

---

### SHOULD-A4 — RLS de INSERT em `audit_log` está implícita

**Atual:** Sprint MVP-1 diz "Insert só via service_role (backend)" no comentário, mas não tem policy explícita bloqueando authenticated.

**Recomendado:** Adicionar policy explícita:
```sql
-- Bloquear INSERT direto via JWT user (forçar via service_role)
-- Não criar policy de INSERT — RLS default bloqueia
-- OU criar policy explícita:
CREATE POLICY audit_log_no_user_insert ON audit_log
  FOR INSERT
  WITH CHECK (false);  -- ninguém insere via anon/authenticated
```

(service_role bypassa RLS, então continua funcionando para o backend.)

---

### SHOULD-A5 — Auditoria deveria ser via TRIGGER, não código

**Atual:** Cada server route insere em `audit_log` manualmente.

**Risco:** Dev esquece de adicionar audit numa rota nova → buraco de compliance.

**Recomendado (mas avaliar custo no MVP):** Trigger `AFTER INSERT/UPDATE/DELETE` em `clients` e `client_documents` que escreve em `audit_log`. Trade-off: menos flexibilidade no `diff`, mas garantia de cobertura.

**Decisão sugerida:** Manter manual no MVP (mais simples), migrar pra trigger no F4-S01 oficial. Anotar em `_followups.md`.

---

### SHOULD-A6 — Server-proxy de download tem limite de 20MB no Vercel Hobby

**Problema:** Vercel Hobby tem **payload limit de 4.5MB por response**. Pro/Enterprise tem 50MB. Download de arquivo de 20MB pelo proxy **falha em Hobby**.

**Soluções:**
1. Streaming response (já implementado no stub — Response retornando ReadableStream) — **Vercel suporta streaming sem o limite de payload em Pro**. Em Hobby, ainda há limite.
2. Confirmar plano Vercel do projeto. Se Hobby → ou aceitar limite menor (5MB) ou upgrade.

**Ação:** Documentar no README + adicionar ADR-MVP-10 sobre plano Vercel.

---

### SHOULD-A7 — Timeout Vercel: 30s Hobby / 300s Pro

**Problema:** Upload + hash + Drive upload + INSERT podem somar >30s em Hobby para arquivos próximos do limite.

**Mitigação:**
- Mover hashing pra client-side (browser calcula SHA-256 antes de enviar)
- Documentar no Sprint MVP-3 Story 3.1

---

## 💡 NICE-TO-HAVE (backlog próximo sprint)

| # | Item |
|---|---|
| NTH-A1 | Adicionar coluna `clients.tags TEXT[]` para classificação futura |
| NTH-A2 | Endpoint `/api/health` retornando status Supabase + Drive |
| NTH-A3 | Migration `0002_seed_dev.sql` opcional com 5 clientes de teste |
| NTH-A4 | View materializada `mv_clients_with_doc_count` para dashboards |
| NTH-A5 | Resumable upload (Drive resumable URL) para arquivos > 20MB — fora MVP |

---

## 📋 Validações do schema (linha-a-linha)

### Tabela `clients` ✅ com ajustes acima

| Coluna | Aprovado? | Comentário |
|---|---|---|
| `id` uuid PK | ✅ | OK |
| `organization_id` FK ON DELETE RESTRICT | ✅ | Bom — bloqueia delete acidental de org |
| `full_name` text NOT NULL | ✅ | Considerar `VARCHAR(200)` (ADR-A3) |
| `cpf_cnpj` text | ✅ | Sanitizar pra armazenar sem máscara |
| `email` text | ✅ | OK |
| `phone` text | ✅ | OK |
| `address` JSONB | ✅ | OK — flexível |
| `drive_folder_id/url` | ✅ | OK |
| `drive_sync_failed` boolean | ✅ | OK |
| `drive_sync_error` text | ⚠️ | Limitar (SHOULD-A3) |
| `created_by` uuid | ✅ | Falta FK? No MVP sem auth.users → manter sem FK |
| `created_at/updated_at` | ✅ | OK |
| `deleted_at` | ✅ | OK |
| UNIQUE constraint | 🚫 | BLOCKER-A2 — tornar partial |

### Tabela `client_documents` ✅ com ajustes acima

| Coluna | Aprovado? | Comentário |
|---|---|---|
| `id, client_id, organization_id` | ✅ | OK |
| `client_id` ON DELETE RESTRICT | ✅ | Bom — soft-delete em vez de cascade |
| `name, description` | ✅ | OK |
| `drive_file_id` | ⚠️ | Adicionar UNIQUE (SHOULD-A1) |
| `drive_url` | ✅ | OK |
| `mime_type, size_bytes, sha256` | ✅ | OK |
| `uploaded_by, created_at, deleted_at` | ✅ | OK |

### Tabela `audit_log` ✅ com ajustes acima

| Coluna | Aprovado? | Comentário |
|---|---|---|
| `id, organization_id, actor_id` | ✅ | OK |
| `action TEXT` | ✅ | Sugiro ENUM no F4 oficial |
| `entity_type, entity_id` | ✅ | OK |
| `diff JSONB` | ✅ | OK |
| `ip_address INET, user_agent` | ✅ | Capturar no server (request headers) |
| Índices | ⚠️ | Adicionar SHOULD-A2 |

---

## 🧠 ADRs — análise individual

| ADR | Aprovação | Comentário |
|---|---|---|
| MVP-01 (Drive direto sem n8n) | ✅ | Aceito. Migrar pra n8n quando entrar — refatoração isolada (helper) |
| MVP-02 (Schema mínimo) | ✅ | Aceito. Manter compatibilidade futura — não renomear PKs/FKs |
| MVP-03 (Server-proxy download) | ⚠️ | Aceito **com** ressalva SHOULD-A6/A7 sobre Vercel limits |
| MVP-04 (Shared Drive recomendado) | ⚠️ | Aceito **com** BLOCKER-A3 (membership) |
| MVP-05 (googleapis SDK) | ⚠️ | Aceito **com** BLOCKER-A1 (runtime Node) |
| MVP-06 (Outbox leve) | ✅ | Aceito. Documentar fluxo de reconciliação manual |
| MVP-07 (RLS org-scoped) | ⚠️ | Aceito **mas** — `current_organization_id()` precisa de claim no JWT. No MVP usa fallback (org default). Pra multi-tenant real, criar hook de auth no F4-S01 |
| MVP-08 (Soft-delete) | ✅ | Aceito. Adicionar ADR sobre cascade quando hard-delete entrar |

---

## ✅ Ações requeridas (consolidadas)

**Antes do Sprint MVP-1 começar:**

- [ ] Atualizar `sprint-mvp-01-foundation.md` com correções BLOCKER-A1, A2, A3
- [ ] Criar `_adr-mvp-drive.md` ADR-MVP-09 (Runtime Node) e ADR-MVP-10 (Plano Vercel)
- [ ] Atualizar `README.md` com instrução clara de Shared Drive membership
- [ ] Confirmar com Hyago o **plano Vercel** atual (Hobby/Pro)

**Durante o Sprint MVP-1:**

- [ ] Implementar todos os SHOULD-FIX (A1-A7) — ~2-3h extras de trabalho

**Aprovação final:**

Após correções dos BLOCKERs, schema e ADRs ficam **prontos para `@dev` começar**.

---

— Aria, Architect 🏛️
