# QA Test Plan — MVP-Drive

> Gates de qualidade e cenários de teste por sprint.
> Autor: Quinn (QA) · Aprovador: Hyago Viana (PO)

**Versão:** 1.0 · **Data:** 2026-05-21

---

## 🧪 Estratégia geral

Pirâmide de testes adaptada ao MVP:

```
       /\          E2E manual (Hyago + Quinn)
      /  \         — Jornada completa: criar cliente → anexar → baixar
     /────\        Integração (Vitest + Supabase staging)
    /      \       — Server routes + RLS + Drive helper
   /────────\      Unit (Vitest)
  /          \    — Validators Zod, utils, hooks isolados
 /────────────\
```

**Cobertura mínima:** 70% nos arquivos novos do MVP-Drive.

---

## 🎯 Gates de saída por sprint

### Gate MVP-1 (Foundation)

| Critério | Como verificar | Aprovador |
|---|---|---|
| Migration aplica em staging sem erro | `npx supabase db push --debug` | Architect |
| RLS bloqueia query anon | `curl` com anon key retorna `[]` | QA |
| RLS permite query authenticated | `curl` com JWT válido retorna dados | QA |
| Smoke test 5/5 passa | `npm run smoke` | QA |
| Drive helper exporta 5 funções | Inspeção de `drive.ts` exports | Architect |
| `tsc --noEmit` passa | CI check | Dev |
| `eslint` passa | CI check | Dev |
| **GO/NO-GO** | Reunião 15min | PO + Architect + QA |

### Gate MVP-2 (CRUD)

| Critério | Como verificar | Aprovador |
|---|---|---|
| Criar cliente cria pasta Drive | Verificação visual no Drive | QA |
| CPF duplicado retorna 409 | Test integração | QA |
| Editar cliente persiste | E2E manual | QA |
| Soft-delete não aparece em `clients_active` | Query SQL | QA |
| Validações Zod cobrem CPF/CNPJ inválidos | Testes unitários ≥10 casos | QA |
| Drive offline: cliente é criado com `drive_sync_failed=true` | Test integração (mock Drive 500) | QA |
| Layout Lovable preservado | Diff visual lado-a-lado | UX |
| Audit log preenchido em todas as ações | `SELECT * FROM audit_log` | QA |
| **GO/NO-GO** | Reunião 15min | PO + QA |

### Gate MVP-3 (Arquivos)

| Critério | Como verificar | Aprovador |
|---|---|---|
| Upload de arquivo válido funciona | E2E manual | QA |
| Arquivo > 20MB rejeitado com 413 | Test integração | QA |
| Mime não permitido rejeitado com 415 | Test integração | QA |
| Download retorna conteúdo idêntico (hash bate) | Test integração com SHA-256 | QA |
| Excluir documento marca `deleted_at` + remove do Drive | Test integração + visual | QA |
| Falha Drive no upload não cria metadado órfão | Test integração com mock | QA |
| Cota Drive API monitorada (logs) | Grep logs | QA |
| Audit log nas 3 ações (upload/download/delete) | Query | QA |
| **GO/NO-GO Final MVP-Drive** | Reunião 30min | PO + Architect + QA |

---

## 🛡️ Cenários de RLS (críticos)

Testar com 2 organizações fictícias `ORG-A` e `ORG-B`:

| # | Cenário | Esperado |
|---|---|---|
| RLS-01 | Usuário de ORG-A faz `SELECT clients` | Vê só clientes de ORG-A |
| RLS-02 | Usuário de ORG-A faz `SELECT clients WHERE id=<id de ORG-B>` | Retorna vazio (não erro) |
| RLS-03 | Usuário de ORG-A tenta `INSERT clients (organization_id='ORG-B', ...)` | Rejeitado |
| RLS-04 | Usuário de ORG-A tenta `UPDATE clients SET ... WHERE id=<id de ORG-B>` | 0 rows affected |
| RLS-05 | Anon faz `SELECT clients` | Retorna vazio |
| RLS-06 | Usuário de ORG-A faz `SELECT client_documents` | Só vê docs de clientes da ORG-A |
| RLS-07 | Usuário de ORG-A faz `SELECT audit_log` | Só vê logs da ORG-A |
| RLS-08 | service_role bypassa todas as RLS | Vê tudo (esperado, é a chave admin) |

**Implementação:** Script `sistema-hv/scripts/test-rls.ts` simula cada cenário.

---

## ☁️ Cenários de Google Drive

| # | Cenário | Esperado |
|---|---|---|
| DRV-01 | Drive online + pasta acessível | createFolder OK |
| DRV-02 | Pasta-raiz não compartilhada com SA | createFolder falha 403 → DriveError |
| DRV-03 | Drive offline (mock 500) | DriveError lançado, cliente criado com flag |
| DRV-04 | Drive responde lento (mock 30s) | Timeout configurado (15s) → DriveError |
| DRV-05 | Upload de 19.9MB | OK |
| DRV-06 | Upload de 21MB | 413 antes de chegar no Drive |
| DRV-07 | Upload de tipo não permitido (.exe) | 415 |
| DRV-08 | Download de arquivo recém-criado | conteúdo idêntico |
| DRV-09 | Download de arquivo deletado no Drive (manualmente) | 502 Drive |
| DRV-10 | Delete de arquivo já deletado | Soft-delete OK, Drive 404 silencioso |

---

## 🔁 Cenários de erro & resiliência

| # | Cenário | Esperado |
|---|---|---|
| ERR-01 | Supabase indisponível durante criar cliente | 500 com mensagem clara |
| ERR-02 | Supabase OK, Drive falha após INSERT | Cliente persistido, `drive_sync_failed=true`, UI mostra banner |
| ERR-03 | Upload com network drop no meio | Cliente recebe 502, nada órfão no banco |
| ERR-04 | Concurrent upload do mesmo arquivo | 2 entries em `client_documents` (ok — duplicatas permitidas) |
| ERR-05 | Soft-delete cliente com docs | `client_documents.deleted_at` também marcado |
| ERR-06 | Upload com nome com caracteres especiais (acentos, emoji) | OK, nome preservado no Drive |
| ERR-07 | Cookie/sessão expirada | Browser redireciona pra login (fase 2 — auth) |

---

## ⚡ Cenários de performance (sanity check)

| # | Cenário | SLO MVP |
|---|---|---|
| PERF-01 | Listagem com 100 clientes | < 500ms |
| PERF-02 | Criação de cliente + pasta Drive | < 3s p95 |
| PERF-03 | Upload de 5MB | < 8s |
| PERF-04 | Download de 5MB | < 5s |
| PERF-05 | Ficha do cliente carrega (sem docs) | < 800ms |

*MVP não tem SLO formal — números acima são "sanity check".*

---

## 🧰 Ferramentas

| Tipo | Ferramenta |
|---|---|
| Unit tests | Vitest |
| Integration tests | Vitest + Supabase staging + Drive sandbox |
| E2E manual | Browser + checklist Notion/markdown |
| Coverage | `vitest --coverage` |
| Lint | ESLint (configurado no projeto) |
| Type-check | `tsc --noEmit` |
| RLS audit | Script custom `scripts/test-rls.ts` |

---

## 📋 Checklist E2E manual (Quinn + Hyago)

Rodar antes do gate final do MVP-3:

```
[ ] 1. Abrir /clientes — lista vazia (após reset staging)
[ ] 2. Clicar "Novo cliente" → preencher: Nome="João Teste", CPF="123.456.789-09" (válido), email
[ ] 3. Submeter → cliente aparece na lista
[ ] 4. Verificar no Drive (manual): pasta "joao-teste-12345678909" criada
[ ] 5. Clicar no cliente → ficha abre
[ ] 6. Aba Documentos → arrastar PDF 2MB
[ ] 7. Aguardar upload → arquivo aparece na lista
[ ] 8. Verificar no Drive (manual): PDF dentro da pasta do cliente
[ ] 9. Clicar "Baixar" → arquivo é baixado, abre corretamente
[ ] 10. Conferir hash SHA-256 (manual via shell): bate com o do banco
[ ] 11. Clicar "Excluir" no doc → confirmar → some da lista
[ ] 12. Verificar no Drive (manual): arquivo sumiu
[ ] 13. Editar cliente: mudar telefone → salvar → muda na ficha
[ ] 14. Excluir cliente → some da lista
[ ] 15. Conferir no banco: deleted_at preenchido, audit_log com 4+ entries
```

---

## 🚨 Bugs encontrados — registro

| Sprint | Bug ID | Severidade | Status | Descrição |
|---|---|---|---|---|
| _(a preencher)_ | — | — | — | — |

Critérios de severidade:
- **P0 (bloqueador):** Impede uso básico do sistema. Não fecha sprint.
- **P1 (alto):** Quebra fluxo principal mas tem workaround. Corrigir antes do gate.
- **P2 (médio):** Inconveniente mas não bloqueia. Backlog próximo sprint.
- **P3 (baixo):** Cosmético. Backlog livre.

---

## ✅ Sign-off final do MVP-Drive

Ao final, três assinaturas:

```
[ ] Quinn (QA)        — Test plan executado integralmente
[ ] Aria (Architect)  — Decisões arquiteturais íntegras
[ ] Hyago Viana (PO)  — Comportamento aceito do ponto de vista do negócio
```

---

— Plano gerado por Orion, aprovado por Quinn (QA)
