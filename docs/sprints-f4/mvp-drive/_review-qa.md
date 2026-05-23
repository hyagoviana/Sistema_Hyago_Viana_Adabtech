# Review de QA — MVP-Drive

> Validação do test plan, identificação de gaps de cobertura e adição de cenários.
> **Revisor:** Quinn (QA) · **Data:** 2026-05-21 · **Versão revisada:** v1.0 do `_qa-test-plan.md`

---

## 🟢 Veredito geral

**APROVADO COM ADIÇÕES OBRIGATÓRIAS.**

Plano base sólido (28 cenários cobertos: 8 RLS + 10 Drive + 7 ERR + 5 PERF). Cobertura funcional boa. **Faltam categorias críticas** de segurança, dados e migration.

**3 BLOCKERs** (precisam ser cobertos antes do gate final).
**8 SHOULD-FIX** (adicionar ao test plan).
**6 NICE-TO-HAVE**.

**Cenários novos propostos: 18** (cobrindo SEC, DATA, MIG, OBS).

---

## 🚫 BLOCKERs (cobertura obrigatória)

### BLOCKER-Q1 — Zero cenários de segurança (SQL injection, XSS, path traversal)

**Problema:** O sistema vai receber input de campos texto (full_name, description, file name) e expor isso em UI + Drive. Sem teste de injeção, vulnerabilidades passam.

**Ação:** Adicionar **categoria SEC** com 6 cenários (lista abaixo). Esses são **gates obrigatórios** do MVP-3.

---

### BLOCKER-Q2 — Cenário crítico de IDOR no download não está coberto

**Problema:** O server-proxy de download é `/api/clients/$id/documents/$docId/download`. Se a query SQL não validar **AMBOS** os IDs (client_id E doc_id), atacante pode baixar documento de outro cliente passando `docId` válido + `clientId` arbitrário.

**Atual no stub Sprint MVP-3 Story 3.2:**
```typescript
.eq('id', params.docId)
.eq('client_id', params.id)  // ✅ presente — bom
.is('deleted_at', null)
```

Está OK no código. **Mas precisa teste explícito** que valida isso.

**Ação:** Adicionar **SEC-04** (já listei abaixo) como gate obrigatório.

---

### BLOCKER-Q3 — Migration sem teste de idempotência ou rollback

**Problema:** Test plan não cobre:
1. `npx supabase db push` rodando 2x seguidas — esperado: 0 erros
2. Rollback se algo der errado em produção (qual o script de DROP?)

**Sem isso:** Risco de prod ficar travado em estado inconsistente.

**Ação:**
- Adicionar **MIG-01** (idempotência) e **MIG-02** (rollback script existe e funciona) aos gates.
- Criar `sistema-hv/supabase/migrations/0001_init.rollback.sql` com DROP correspondente.

---

## ⚠️ SHOULD-FIX (adicionar ao test plan)

### SHOULD-Q1 — Faltam cenários de concorrência

| Cenário | Descrição |
|---|---|
| **CON-01** | 2 uploads simultâneos do mesmo arquivo no mesmo cliente → 2 entries criadas (duplicatas OK no MVP) |
| **CON-02** | Criação simultânea de 2 clientes com CPF idêntico → 1 sucesso + 1 erro 409 |
| **CON-03** | Edit + delete do mesmo cliente em paralelo → último write wins (sem corromper estado) |

### SHOULD-Q2 — Falta validação de migração de dados

| Cenário | Descrição |
|---|---|
| **MIG-03** | Aplicar migration em DB com dados → seed default org não duplica (`ON CONFLICT DO NOTHING` funciona) |
| **MIG-04** | Migration rollback preserva dados não relacionados |

### SHOULD-Q3 — Faltam observability gates

| Cenário | Descrição |
|---|---|
| **OBS-01** | Toda chamada Drive loga `console.info` com `{ action, fileId, duration_ms }` |
| **OBS-02** | Falha Drive loga `console.error` com payload do erro (sanitizado) |
| **OBS-03** | Smoke test pode ser rodado em CI |

### SHOULD-Q4 — Falta teste de Hot Path (caminho feliz acelerado)

**Cenário HP-01:** Em < 60s end-to-end:
1. Criar cliente
2. Anexar 1 documento
3. Baixar e conferir hash
4. Excluir documento
5. Excluir cliente

Se isso passa → confiança que a jornada base funciona.

### SHOULD-Q5 — Faltam testes de cota / rate limit

| Cenário | Descrição |
|---|---|
| **RATE-01** | 100 uploads em 60s não estoura quota Drive (1000/100s) |
| **RATE-02** | 1000 chamadas `clients.list` em 60s — Supabase responde dentro do plano free |

### SHOULD-Q6 — Faltam testes de internacionalização básica

| Cenário | Descrição |
|---|---|
| **I18N-01** | Cliente com nome contendo acentos (José, Ângela) — persistido e exibido sem corrupção |
| **I18N-02** | Arquivo com nome em chinês / emoji → upload OK, download preserva nome |

### SHOULD-Q7 — Mime sniffing fraco

**Problema:** Sprint MVP-3 valida `file.type` (header HTTP). Atacante pode falsificar (`Content-Type: application/pdf` num `.exe`).

**Ação:** Adicionar **SEC-05** — validar pelos primeiros bytes (magic numbers) usando lib como `file-type`. NICE-TO-HAVE pro MVP, BLOCKER pra produção.

### SHOULD-Q8 — Falta limpeza de testes (teardown)

**Problema:** Smoke test deixa pastas/arquivos "SMOKE_TEST_*" no Drive se falhar no meio.

**Ação:** Adicionar script `scripts/cleanup-drive.ts` que deleta tudo com prefixo `SMOKE_TEST_` ou mais antigo que 24h. Rodar antes/depois do CI.

---

## 💡 NICE-TO-HAVE

| # | Item |
|---|---|
| NTH-Q1 | Playwright E2E automático (substituir checklist manual de 15 passos) |
| NTH-Q2 | Chaos test: Drive responde 500 em 10% das chamadas |
| NTH-Q3 | Mutation testing (Stryker) para garantir testes não estão "fakes" |
| NTH-Q4 | Snapshot test de componentes UI (Storybook) |
| NTH-Q5 | Lighthouse CI score baseline |
| NTH-Q6 | API contract test (OpenAPI spec + Dredd) |

---

## ➕ Novos cenários propostos (18 totais)

### Categoria SEC (Segurança) — **GATES OBRIGATÓRIOS**

| # | Cenário | Esperado |
|---|---|---|
| **SEC-01** | Criar cliente com `full_name = '<script>alert(1)</script>Maria'` | Persistido literal, renderizado como texto (não executado) |
| **SEC-02** | Upload de arquivo com nome `../../etc/passwd.pdf` | Nome sanitizado ou rejeitado; Drive não escapa sandbox |
| **SEC-03** | Search com `?q='; DROP TABLE clients;--` | Supabase usa prepared statements (zero SQL injection) — confirmar |
| **SEC-04** | User A logado, tenta `GET /api/clients/<id-A>/documents/<docId-do-cliente-B>/download` | 404 (RLS bloqueia) |
| **SEC-05** | Upload de `.exe` renomeado pra `.pdf` (Content-Type falso) | Rejeitado (magic bytes) — _MVP: SHOULD-FIX, F4-S01: BLOCKER_ |
| **SEC-06** | Cookie/session token exposto em URL ou log | Não acontece — auditar logs |

### Categoria DATA (Integridade de Dados)

| # | Cenário | Esperado |
|---|---|---|
| **DATA-01** | Upload de 5MB → download → SHA-256 bate em 10 iterações | 100% match |
| **DATA-02** | Migration aplica 2x consecutivas | 0 erros, estado idempotente |
| **DATA-03** | Soft-delete + re-cadastro de cliente com mesmo CPF | OK (depende de BLOCKER-A2 corrigido) |
| **DATA-04** | Cliente sem `drive_folder_id` tenta upload | 409 com mensagem clara, ofereçe botão "Reconciliar" |

### Categoria CON (Concorrência)

| # | Cenário | Esperado |
|---|---|---|
| **CON-01** | 2 uploads simultâneos mesmo arquivo | 2 entries, sem race condition |
| **CON-02** | 2 INSERTs paralelos mesmo CPF | 1 sucesso + 1 erro 409 |
| **CON-03** | UPDATE + DELETE paralelos do mesmo cliente | Estado consistente |

### Categoria MIG (Migration)

| # | Cenário | Esperado |
|---|---|---|
| **MIG-01** | `db push` 2x consecutivas | 0 erros |
| **MIG-02** | Script `0001_init.rollback.sql` existe e roda | Limpa tudo |
| **MIG-03** | Migration em DB com seed prévia | `ON CONFLICT DO NOTHING` honra |

### Categoria OBS (Observabilidade)

| # | Cenário | Esperado |
|---|---|---|
| **OBS-01** | Toda chamada Drive loga `{action, fileId, duration_ms}` | console.info presente |
| **OBS-02** | Falha Drive loga payload do erro sanitizado | console.error sem credenciais |

---

## 📊 Resumo final dos gates (atualizado)

### Gate MVP-1 (Foundation) — total de cenários: **17** (era 8)

- 7 da v1.0 (smoke, RLS, build)
- +3 MIG (idempotência, rollback, conflict)
- +3 OBS (logs estruturados)
- +1 DATA (re-cadastro)
- +3 SEC (RLS reforço)

### Gate MVP-2 (CRUD) — total de cenários: **22** (era 10)

- 10 da v1.0
- +6 SEC (XSS, SQL injection, IDOR)
- +3 CON (concorrência)
- +3 I18N + edge cases

### Gate MVP-3 (Arquivos) — total de cenários: **30** (era 11)

- 11 da v1.0
- +10 Drive expandidos
- +4 DATA (hash integrity)
- +3 SEC (path traversal, mime spoofing)
- +1 HP-01 (hot path)
- +1 RATE

---

## 🔬 Ferramentas adicionais propostas

| Ferramenta | Para que | Bloqueia MVP? |
|---|---|---|
| **vitest --coverage** | Verificar cobertura 70% | ✅ Já no plan |
| **supatest** (custom RLS test helper) | Cenários RLS automatizados | ⚠️ Recomendado |
| **MSW** (Mock Service Worker) | Mockar Drive API em unit tests | ⚠️ Recomendado |
| **file-type** lib | Validar magic bytes | ⏳ SHOULD para MVP, BLOCKER F4 |
| **Playwright** | E2E manual → automático | 🔮 Pós-MVP |

---

## 📋 Checklist E2E manual — adições à v1.0

Adicionar 4 passos ao final dos 15 originais:

```
[ ] 16. Tentar criar cliente com CPF inválido (111.111.111-11) — rejeitado
[ ] 17. Tentar criar cliente com nome contendo <script>...</script> — persistido como texto literal
[ ] 18. Conferir audit_log: 5+ entries (create, update, upload, download, delete)
[ ] 19. Rodar migration rollback em staging → tudo limpo
```

---

## ✅ Ações requeridas (consolidadas)

**Antes do Sprint MVP-1 começar:**

- [ ] **BLOCKER-Q1:** Adicionar categoria SEC ao test plan (6 cenários)
- [ ] **BLOCKER-Q2:** Reforçar SEC-04 (IDOR) como gate obrigatório
- [ ] **BLOCKER-Q3:** Criar `0001_init.rollback.sql` + MIG-01/02 nos gates

**Durante a execução de cada sprint:**

- [ ] Adicionar cenários SEC, DATA, CON, MIG, OBS conforme tabela acima
- [ ] Implementar logs estruturados (OBS-01, OBS-02)
- [ ] Adicionar script `cleanup-drive.ts` (SHOULD-Q8)

**Aprovação:** Após BLOCKERs cobertos, **test plan v1.1 sai pronto pra QA executar** durante a sprint.

---

## 🧮 Esforço adicional de QA estimado

| Atividade | Esforço |
|---|---|
| Implementar 18 cenários novos | +1.5d |
| Criar script `cleanup-drive.ts` | +0.5d |
| Criar rollback SQL | +0.5d |
| Setup MSW para mocks Drive | +1d |
| **Total adicional** | **~3-4d** |

**Sugestão:** Esse esforço de QA roda **em paralelo** ao dev. Não bloqueia.

---

— Quinn, QA 🧪
