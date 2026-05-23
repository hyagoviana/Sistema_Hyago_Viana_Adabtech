# Decisões Arquiteturais — MVP-Drive

> Architecture Decision Records (ADRs) específicas do recorte MVP-Drive.
> Complementam (não substituem) os ADRs gerais do projeto em `docs/sprints-f4/_adrs/`.

**Versão:** 1.0 · **Data:** 2026-05-21 · **Status:** 🟢 Aprovado

---

## ADR-MVP-01 — Storage direto no Drive via Service Account (sem n8n no caminho crítico)

### Contexto
A memória do projeto define que "tudo de integração externa vai pelo n8n". Porém, para o MVP, n8n ainda não está configurado e o Hyago pediu explicitamente para deixá-lo pra depois. Drive é storage primário do sistema.

### Decisão
Acessar a Google Drive API **direto do backend TanStack Start** usando a Service Account já criada (`hv-drive@hv-sistema.iam.gserviceaccount.com`). Sem n8n no caminho crítico.

### Consequências
- ✅ Menos latência (uma chamada de rede a menos)
- ✅ Erros mais fáceis de debugar
- ✅ Não precisa subir VPS de n8n no MVP
- ⚠️ Quando n8n entrar (sprints futuros), refatorar pra usar facade do n8n se trouxer valor (orquestração, retry, dead-letter)
- ⚠️ Credenciais Drive ficam no backend TanStack (Vercel env), não centralizadas no n8n

### Alternativas consideradas
- **n8n facade desde o MVP** — Adiciona infra (VPS) ao caminho crítico do MVP, fora do escopo do que o Hyago pediu.
- **Supabase Edge Function como proxy** — Mais uma camada sem ganho real no MVP; agrega quando precisar isolar credenciais.

---

## ADR-MVP-02 — Schema mínimo (3 tabelas)

### Contexto
PRD Master tem 17 tabelas globais. Pra MVP, só precisamos das que cobrem CRUD de cliente + arquivos.

### Decisão
Criar **apenas 3 tabelas** no MVP:

| Tabela | Propósito |
|---|---|
| `clients` | Dados cadastrais do cliente |
| `client_documents` | Metadado de arquivos (Drive guarda o conteúdo) |
| `audit_log` | Trilha de ações (LGPD básico) |

**Adiamos** (mas anotamos no schema com FKs nullable se necessário):
- `organizations`, `users`, `roles`, `user_organization_roles` — usar `auth.users` do Supabase + 1 org hardcoded no MVP
- `cases`, `case_events`, `case_documents` — Sprint F4-03
- `terms_of_agreement`, `parcels` — Sprint F4-08, F4-09
- `consent_records`, `webhook_dedupe`, `case_outbox_events` — Sprint F4-01 completo

### Consequências
- ✅ Migração rápida (1 arquivo SQL)
- ✅ Foco no que destrava a UI
- ⚠️ Schema crescerá — manter `clients` compatível com extensões futuras (não renomear PKs, manter FKs prontas)
- ⚠️ `organization_id` fica nullable no MVP, mas presente no schema (multi-tenancy preparada)

---

## ADR-MVP-03 — Download via server-proxy (não link direto)

### Contexto
Há duas formas de servir um arquivo do Drive:
1. **Link direto** — gerar `permission: anyone-with-link` no Drive e expor `webViewLink`
2. **Server-proxy** — backend TanStack Start busca o arquivo via API e devolve no response

### Decisão
**Server-proxy** no MVP (rota `/api/clients/:id/documents/:docId/download`).

### Consequências
- ✅ Permissões controladas pelo Supabase RLS (não pelo Drive)
- ✅ Auditoria precisa (cada download vai pro `audit_log`)
- ✅ Permite revogar acesso instantâneo (basta soft-delete na tabela)
- ✅ Cliente vê só pelo nosso domínio, não conhece a URL do Drive
- ⚠️ Custo de banda (arquivo passa pelo nosso server) — aceitável no MVP (arquivos ≤20MB)
- ⚠️ Se arquivos crescerem muito (>50MB) ou volume aumentar, migrar pra link assinado de curta duração

### Alternativas consideradas
- **`anyone-with-link`** — Quebra LGPD na prática (link vaza = arquivo público). Rejeitado.
- **Signed URL com expiração curta (Drive API `files.get` com alt=media)** — Drive não suporta nativamente como S3. Possível com bibliotecas, mas adiciona complexidade no MVP.

---

## ADR-MVP-04 — Shared Drive (recomendado) vs My Drive

### Contexto
A SA pode trabalhar com:
- **My Drive** do Hyago (pasta dele compartilhada com a SA)
- **Shared Drive** (Drive Compartilhado / Drive de equipe — recurso Google Workspace)

### Decisão
**Recomendação: Shared Drive** se o Hyago tiver plano Google Workspace. Senão, My Drive.

### Por que Shared Drive é melhor
- ✅ Arquivos não pertencem a uma pessoa (Hyago) — pertencem à organização
- ✅ Se Hyago sair / mudar de conta, arquivos não viram órfãos
- ✅ SA pode criar arquivos com ownership do próprio Shared Drive
- ✅ Backup/governança nativa
- ⚠️ Requer plano Google Workspace (Business Starter ~R$30/usuário/mês)

### My Drive (fallback)
- ✅ Funciona com conta Google gratuita
- ⚠️ Arquivos criados pela SA têm a SA como dono — se SA for deletada, arquivos ficam órfãos
- ⚠️ Storage conta na cota pessoal do Hyago (15GB grátis)

### Implementação
- Variável `GOOGLE_DRIVE_SHARED_DRIVE_ID` no `.env.local` decide o modo:
  - Vazio → My Drive
  - Preenchido → Shared Drive (precisa passar `supportsAllDrives: true` nas chamadas API)
- Helper Drive abstrai a diferença

### Ação requerida
Hyago precisa confirmar com Orion qual modelo usar **antes do Sprint MVP-1 começar**.

---

## ADR-MVP-05 — `googleapis` Node SDK (oficial)

### Contexto
Acessar Drive API exige autenticação OAuth2 + chamadas REST específicas.

### Decisão
Usar o pacote oficial **`googleapis`** (npm). Versão `^144.0.0` ou mais recente.

```bash
npm install googleapis
```

### Por que
- ✅ Mantido pelo Google
- ✅ TypeScript first-class
- ✅ Cobre todos os endpoints Drive + suporte a Shared Drives
- ✅ Auth helper `JWT` lê a private key da Service Account direto
- ❌ REST direto via `fetch` exigiria implementar JWT signing manualmente (custo > benefício)

---

## ADR-MVP-06 — Tratamento de falha: outbox pattern leve

### Contexto
O fluxo `Adicionar Cliente`:
1. INSERT em `clients` (Supabase)
2. Criar pasta no Drive (API call)
3. UPDATE `clients.drive_folder_id` (Supabase)

Se passo 2 falhar, ficamos com cliente sem pasta. Se passo 3 falhar, pasta sem referência (lixo no Drive).

### Decisão
**Compensação otimista** no MVP, **outbox completo no Sprint F4-01 final**:

- Cliente é criado SEM pasta inicialmente (`drive_folder_id IS NULL`)
- Job/trigger background tenta criar pasta com retry exponencial (até 3x)
- Falha definitiva → marca cliente com flag `drive_sync_failed=true` (coluna boolean) + alerta UI
- Hyago pode "reconciliar" manualmente via botão "Criar pasta"

### Por que não outbox completo no MVP
- Outbox exige tabela `case_outbox_events` + worker consumer (pg_cron ou worker externo)
- Complexidade ≠ valor no MVP

### Consequências
- ✅ Cliente criado mesmo se Drive estiver fora
- ✅ Sistema continua usável
- ⚠️ Estado `drive_sync_failed` aparece na UI até resolver
- ✅ Quando outbox entrar (F4-01 resíduo), migrar facilmente

---

## ADR-MVP-07 — RLS organization-scoped (preparada pra multi-tenant)

### Contexto
PRD Master prevê multi-tenancy (`organizations`). No MVP só temos 1 org (escritório do Hyago).

### Decisão
**RLS já com `organization_id`** mesmo com 1 org. Toda query passa por `current_organization_id()` (JWT claim).

```sql
-- Policy exemplo
CREATE POLICY clients_select_org_member ON clients
  FOR SELECT
  USING (organization_id = (SELECT auth.jwt() ->> 'organization_id')::uuid);
```

### Por que
- ✅ Evita refatoração futura quando entrar 2ª organização
- ✅ Forçamos isolamento desde dia 1
- ⚠️ Levemente mais complexo — aceitável

### Como popular `organization_id` no MVP
- Trigger no signup do Supabase Auth atribui `organization_id` default
- 1 org seed na migration inicial

---

## ADR-MVP-08 — Soft-delete com cascade lógico

### Contexto
LGPD exige direito ao esquecimento, mas precisamos preservar auditoria.

### Decisão
- Coluna `deleted_at TIMESTAMPTZ NULL` em todas as tabelas mutáveis
- DELETE físico só via job admin (sprint futuro)
- Quando cliente é "deletado":
  - `clients.deleted_at = now()`
  - Todos `client_documents` do cliente recebem `deleted_at = now()`
  - **Drive não é tocado** (arquivos ficam órfãos lá, OK no MVP — limpeza no F4-10)

### Views convenientes
```sql
CREATE VIEW clients_active AS
  SELECT * FROM clients WHERE deleted_at IS NULL;
```

UI sempre consulta `clients_active` por padrão; tela "Lixeira" consulta tabela completa.

---

## 📊 Resumo dos ADRs

| ADR | Decisão | Reversível? |
|---|---|---|
| MVP-01 | Drive direto, sem n8n no MVP | ✅ Sim (refatorar pra n8n quando entrar) |
| MVP-02 | Schema mínimo de 3 tabelas | ✅ Sim (adicionar tabelas) |
| MVP-03 | Download via server-proxy | ⚠️ Médio (mudaria URLs no front) |
| MVP-04 | Shared Drive recomendado | ✅ Sim (mudar variável de env) |
| MVP-05 | `googleapis` SDK | ⚠️ Médio (mudar implementação do helper) |
| MVP-06 | Compensação otimista, outbox depois | ✅ Sim (migrar pra outbox) |
| MVP-07 | RLS já org-scoped | ✅ Sim (manter mesmo em 1 org) |
| MVP-08 | Soft-delete com cascade lógico | ⚠️ Médio (DELETE físico seria destrutivo) |

---

**Próxima revisão:** Antes do Sprint MVP-1 começar, com `@architect` (Aria).
