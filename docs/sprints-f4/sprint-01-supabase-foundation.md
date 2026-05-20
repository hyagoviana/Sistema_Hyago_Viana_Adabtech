# Sprint 1 — Supabase Foundation

> **Versão:** 1.1 · **Status:** Pronto para validação multi-agente
> **Estimativa:** 17 dias úteis (era 12d na v1.0; +5d para LGPD/Observabilidade/VPS/Outbox/CHECK) · **Épico PRD 1:** 1 — Backend Foundations
> **Stories PRD 1 cobertas:** 1.1, 1.2, 1.3, 1.4 (parcial — telas críticas)
> **Histórico:** v1.0 → v1.1 incorpora os 5 BLOCKERs dos reviews QA (F-01, F-02) + Architect (F-01, F-02, F-03/F-04). Ver `CHANGELOG.md` e `_review-qa.md` / `_review-architect.md`.

---

## Objetivo

Erguer a **fundação backend imutável** do Projeto 1. Ao fim deste sprint, o `sistema-hv/` (TanStack Start + Vite) deixa de operar com fixtures hard-coded e passa a conversar com **dois projetos Supabase reais** (staging + prod) com schema completo, RLS auditada, Auth funcional, **LGPD bootstrap operacional, observabilidade ativa (Sentry + logs estruturados + PostHog + UptimeRobot) e VPS Hetzner provisionada para n8n self-hosted + LibreOffice headless + Playwright workers**. O login mock do Lovable é substituído por Supabase Auth, e ao menos 4 rotas críticas (`/clientes`, `/casos`, `/clientes/:id`, `/casos/:id`) leem do banco real (lista vazia inicialmente, mas com query real, RSC + React Query). CI/CD básico (lint + typecheck + build + RLS audit) verde em PRs.

Tudo o que vier depois assume esta base sólida — daí a densidade do sprint (17 dias úteis vs. média de 8-10).

---

## Definition of Done específico do Sprint 1

### Schema + RLS (base)
- [ ] Dois projetos Supabase (staging + prod) provisionados em `sa-east-1`, ambos plano **Pro** (PITR + 500 connections — ver Architect §"Recomendações" item 2)
- [ ] 17 tabelas globais (Master §3) + 6 tabelas FIES (PRD 1 §5) + `case_outbox_events` + `integration_logs` + `consent_records` + `consent_revocations` + `webhook_dedupe` + `cron_run_log` aplicadas em staging
- [ ] 9+ ENUMs canônicos aplicados (case_type, macrostatus_op, macrostatus_fin, etc.)
- [ ] Extensions habilitadas: `uuid-ossp`, `pg_trgm`, `vector` (futuro RAG), `pgcrypto`, `pg_cron`, `pg_jsonschema` (validar `fies_data`)
- [ ] RLS policies criadas para 100% das tabelas com PII (cobertura ≥80% testada por persona — atende QA F-01 item 6)
- [ ] CHECK constraint `chk_segregacao_elab_conf` em `termo_acerto_snapshots` desde Sprint 1 (atende Architect F-02)
- [ ] Trigger `prevent_termo_mutation_after_approval()` criado já no Sprint 1 mesmo sem uso até Sprint 8 (atende Architect F-02)
- [ ] Script `scripts/audit-rls.ts` rodando em CI: 0 vazamento entre orgs em 20+ cenários
- [ ] Trigger `trg_log_macrostatus` e `trg_bifurcar` funcionais (testes pgTAP)
- [ ] Seed inicial: 1 org "Hyago Viana Advocacia", 7 roles, 1 admin user

### Auth + UI mínima
- [ ] Login Lovable (`src/routes/login.tsx` ou `entrar.tsx`) trocado de mock → Supabase Auth real
- [ ] Cookies httpOnly via `@supabase/ssr` (ou equivalente para TanStack Start — ver spike SP-01)
- [ ] MFA TOTP funcional para roles em `MFA_REQUIRED_ROLES = ['admin', 'fin']` (atende QA S-05)
- [ ] Convite por e-mail funcional (template via Supabase nativo; Postmark vem no Sprint 6)
- [ ] Logout limpa sessão completamente (cookie + storage); refresh token revogado server-side (atende Architect A-09 / QR-05)
- [ ] `/clientes`, `/casos`, `/clientes/:id`, `/casos/:id` lendo via Supabase real (lista vazia OK)
- [ ] React Query keys padronizadas em `src/lib/queryKeys.ts`
- [ ] Cliente Supabase em `src/lib/supabase/{client,server}.ts`

### LGPD bootstrap (Story 1.5 — atende QA F-01)
- [ ] Tabela `consent_records` criada **na migration `003_tables_global.sql`** (lista explícita)
- [ ] Tabela `consent_revocations` criada (registro de revogações)
- [ ] Campo `policy_version` em `consent_records` (Política versionada)
- [ ] Endpoint `/api/lgpd/export-titular` retorna JSON dos dados do titular
- [ ] Função `soft_delete_titular()` + cron `pg_cron` mensal para hard-delete pós 5 anos (parametrizável por org)
- [ ] Testes E2E: titular solicita export → recebe JSON; titular revoga consent → registrado e propagado

### Observabilidade bootstrap (Story 1.6 — atende QA F-02)
- [ ] Sentry SDK instalado e configurado em TanStack Start + Cloudflare Workers + Supabase Edge Functions (source maps + DSN por ambiente)
- [ ] **Logtail** (Better Stack) escolhido como provider de logs estruturados — ver `_adrs/ADR-004-logging-stack.md`
- [ ] PostHog configurado com 100% das transições de macrostatus emitindo evento (`case.macrostatus.changed`) + eventos núcleo (`auth.login`, `termo.aceito`, etc.)
- [ ] UptimeRobot configurado para 3 endpoints críticos (`/login`, `/api/health`, `/api/health/db`)
- [ ] Dashboard mínimo de SLO: P95 latência queries pipeline, uptime, error rate por endpoint
- [ ] Alertas: P95 > 800ms, error rate > 1%, uptime < 99.5%

### VPS Hetzner + n8n + LibreOffice + Playwright (Story 1.7 — atende Architect F-03/F-04)
- [ ] VPS Hetzner CX22 (€7-15/mês) provisionada com Docker Compose
- [ ] n8n self-hosted instalado (versão LTS, backup de workflows configurado)
- [ ] LibreOffice headless instalado e validado para conversão DOCX→PDF determinística (hash reproduzível em 5 execuções — pré-req do SP-03)
- [ ] Playwright + browsers instalados (Chromium + Firefox) em container
- [ ] VPS → Supabase Service Role configurado com rotação a cada 90d
- [ ] Network: VPS pode chamar Cloudflare Workers e Supabase Edge Functions
- [ ] Monitoramento básico (Uptime Kuma)

### Idempotência + Outbox (Story 1.1 expandida — atende Architect F-01 + QA S-01)
- [ ] Tabela `case_outbox_events` com colunas: `id`, `organization_id`, `aggregate_type`, `aggregate_id`, `event_type`, `payload jsonb`, `occurred_at`, `published_at` nullable, `attempts`, `last_error`
- [ ] Índice em `(published_at, occurred_at)` para worker consumer
- [ ] Tabela `webhook_dedupe(provider, external_id, received_at)` com UNIQUE — atende QA S-01
- [ ] Função `enqueue_outbox(source, source_event_id, payload)` testada com pgTAP (duplicado → conflict)
- [ ] Worker outbox publisher: **Edge Function** + cron pg_cron (60s) — ver `_adrs/ADR-005-webhook-idempotency.md`

### CI/CD + DX
- [ ] Pasta `supabase/migrations/` versionada no repo
- [ ] CI verde: lint + typecheck + build + RLS audit + bundle analyzer (alerta > 5MB — atende QA M-03 + Architect S-07)
- [ ] Preview deploy por PR no Cloudflare Pages (atende Architect S-06)
- [ ] Smoke test pós-deploy: `curl` em 3 endpoints críticos; rollback automático via `wrangler rollback` se falha
- [ ] Smoke E2E Playwright: login admin + logout + tentativa de cross-org bloqueada
- [ ] CHANGELOG.md inicial criado em `sistema-hv/` no formato Keep-a-Changelog (atende QA M-10)
- [ ] ADRs registrados em `docs/sprints-f4/_adrs/`: 001, 002, 003, 004, 005, 006

### Documentação auxiliar
- [ ] `docs/architecture/auditable-actions.md` criado com lista exaustiva (atende QA S-06)
- [ ] `docs/architecture/rls-policies.md` com tabela resumo
- [ ] Setup k6 (ou autocannon) para benchmark de 5 queries críticas em CI; baseline em `tests/perf/baseline.json` (atende QA S-07)

---

## Stories detalhadas

### Story F4-1.1 · Projetos Supabase + schema global aplicado (+ Outbox + CHECK)

**Como** tech lead, **eu quero** dois projetos Supabase (staging + prod) provisionados com o schema global do Master §3, **para que** o backend esteja pronto a receber dados reais.

**Estimativa:** 3.5 dias úteis (+0.5d v1.0 → v1.1: outbox + CHECK + pg_jsonschema) · **Dependências:** Pré-requisitos do README cumpridos · **Mapeia PRD 1 §6:** Story 1.1

**Critérios de aceitação:**
- [ ] Projeto Supabase `hv-staging` criado em `sa-east-1` (plano **Pro**)
- [ ] Projeto Supabase `hv-prod` criado em `sa-east-1` (plano **Pro**, vazio aguardando Sprint 11)
- [ ] Estrutura `supabase/` versionada no repo (`config.toml`, `migrations/`, `seed.sql`)
- [ ] Migration `001_extensions.sql`: habilita `uuid-ossp`, `pg_trgm`, `vector`, `pgcrypto`, `pg_cron`, `pg_jsonschema`
- [ ] Migration `002_enums.sql`: 9 ENUMs do Master §3.2
- [ ] Migration `003_tables_global.sql`: 17 tabelas do Master §3.3-§3.17 **incluindo explicitamente `consent_records`** (atende QA F-01 item 1)
- [ ] Migration `003b_tables_outbox.sql`: `case_outbox_events` + `integration_logs` + `webhook_dedupe` (atende Architect F-01)
- [ ] Migration `003c_termo_skeleton.sql`: `termo_acerto_snapshots` com `CHECK (elaborador_id IS DISTINCT FROM conferidor_id)` + trigger `prevent_termo_mutation_after_approval()` (atende Architect F-02)
- [ ] Migration `004_indexes.sql`: todos os índices do Master §3 + índice `(published_at, occurred_at)` em outbox + UNIQUE em `webhook_dedupe(provider, external_id)`
- [ ] Migration `005_triggers.sql`: `trg_gen_case_code`, `trg_log_macrostatus`, `trg_bifurcar`
- [ ] Migration `005b_functions.sql`: `enqueue_outbox()`, `soft_delete_titular()`, `auth.org_id()`, `auth.user_role()`
- [ ] Migrations idempotentes (`CREATE TABLE IF NOT EXISTS`)
- [ ] `supabase db push --linked` (staging) executa sem erros
- [ ] Teste pgTAP: tentativa de criar snapshot com `elaborador_id = conferidor_id` falha **tanto via API quanto via SQL direto com service role** (atende Architect F-02 — defesa em profundidade)
- [ ] Teste pgTAP: `enqueue_outbox` duplicado retorna conflito; processor lê PENDING ordenado por `occurred_at`

**Notas técnicas:**
- Particionamento de `case_events` por mês (Master §3.8) — criar 12 partições para 2026 já.
- `case_documents.ocr_text` com índice GIN em português — spike SP-07 (30min) confirma dicionário disponível antes de mergear.
- `fies_data` ganha CHECK via `pg_jsonschema` validando keys essenciais (atende Architect A-08).

---

### Story F4-1.2 · Schema específico FIES + 6 tabelas auxiliares

**Como** tech lead, **eu quero** as tabelas específicas do PRD 1 §5 aplicadas, **para que** o schema FIES tenha a estrutura para os épicos seguintes.

**Estimativa:** 1 dia útil · **Dependências:** Story F4-1.1 · **Mapeia PRD 1 §6:** Story 1.3

**Critérios de aceitação:**
- [ ] Migration `006_fies_extension.sql`: `ALTER TABLE cases ADD COLUMN fies_data jsonb DEFAULT '{}'`
- [ ] Migration `007_fies_tables.sql`: cria `case_municipios_inteligencia`, `case_sei_tracking`, `case_cnes_sync`, `case_holds_history`, `migration_log`
- [ ] Constraint `UNIQUE (organization_id, municipio, uf)` em `case_municipios_inteligencia`
- [ ] Índices conforme PRD 1 §5 (`idx_mun_uf`, `idx_sei_case`, `idx_holds_case`)
- [ ] Função `bifurcar_automatica()` testada
- [ ] Teste pgTAP do trigger de bifurcação em `supabase/tests/test_bifurcacao.sql`

---

### Story F4-1.3 · RLS policies + auditoria automatizada

**Como** tech lead de segurança, **eu quero** RLS configurada e auditada automaticamente, **para que** organizações não vazem dados entre si e roles respeitem escopos.

**Estimativa:** 3 dias úteis · **Dependências:** Stories F4-1.1, F4-1.2 · **Mapeia PRD 1 §6:** Story 1.1 (parte RLS) + Master §4

**Critérios de aceitação:**
- [ ] Função `auth.org_id()` e `auth.user_role()` criadas (em 005b)
- [ ] Migration `010_rls_clients.sql` · `011_rls_cases.sql` · `012_rls_termo.sql` (com RLS adicional: usuário não pode ter ambos os papéis no mesmo snapshot — atende Architect F-02 item 3) · `013_rls_portal.sql` · `014_rls_eventos_docs.sql` · `015_rls_fies.sql` · `016_rls_outbox_lgpd.sql` (outbox + consent + webhook_dedupe)
- [ ] Script `scripts/audit-rls.ts` executando 20+ cenários (Master §4)
- [ ] Cenários LGPD: titular consegue ler apenas próprios `consent_records`; admin com escopo consegue exportar
- [ ] Cenários outbox: apenas role `service_role` pode INSERT em `case_outbox_events`; UPDATE bloqueado se `published_at IS NOT NULL`
- [ ] Script roda em CI; falha pipeline se algum cenário vaza
- [ ] Documentação `docs/architecture/rls-policies.md` com tabela resumo (cobertura ≥80% das tabelas com PII)

**Notas técnicas:**
- Custom claims no JWT via Auth Hook Edge Function — colocar `organization_id` e `roles[]` no token (validado em SP-06).

---

### Story F4-1.4 · Auth real (login, logout, MFA, convite) + cliente Supabase no TanStack Start

**Como** admin, **eu quero** o fluxo de login/MFA/convite funcionar com Supabase real (não mais mock do Lovable), **para que** usuários acessem a plataforma com identidade verdadeira.

**Estimativa:** 3 dias úteis · **Dependências:** Stories F4-1.1, F4-1.3 · **Mapeia PRD 1 §6:** Story 1.2

**Critérios de aceitação:**

#### Cliente Supabase
- [ ] **SP-01 já executado e PASS** — `@supabase/ssr` validado em TanStack Start + Cloudflare Workers (ver Spikes pré-Sprint 1 no README)
- [ ] `src/lib/supabase/client.ts` — cliente browser (anon key)
- [ ] `src/lib/supabase/server.ts` — cliente server-side
- [ ] `src/lib/supabase/middleware.ts` — refresh de sessão em cada navegação SSR
- [ ] Variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` documentadas em `.env.example`

#### Login + Logout
- [ ] Rota `src/routes/login.tsx` (ou `entrar.tsx`) atualizada: form Lovable mantém visual idêntico
- [ ] Erro de credencial mostra toast (`sonner`)
- [ ] Sucesso redireciona para `/hoje`
- [ ] Botão logout chama `supabase.auth.signOut` + revoga refresh token server-side
- [ ] Cookies httpOnly setados
- [ ] Password Policy mínima: 12 chars, 1 maiúscula, 1 número (atende QA QR-04)
- [ ] JWT TTL 30min + refresh; logout invalida server-side (QR-05)

#### MFA TOTP
- [ ] Tela de configuração MFA dentro de `configuracoes.tsx` (mantém visual Lovable)
- [ ] Fluxo: gera secret + QR code → usuário escaneia → valida código → MFA ativo
- [ ] Login subsequente de admin **e fin** pede TOTP (atende QA S-05)
- [ ] Backup codes (5) gerados e exibidos uma única vez
- [ ] Roles em `MFA_REQUIRED_ROLES` sem `mfa_configured = true` recebem redirect para `/configuracoes/mfa` (exceto a própria rota)

#### Convite por e-mail
- [ ] Tela admin de "Convidar usuário" em `configuracoes.tsx`
- [ ] Form: e-mail + role(s)
- [ ] Chama `supabase.auth.admin.inviteUserByEmail` via Edge Function
- [ ] E-mail enviado com template Supabase padrão

#### Testes
- [ ] Smoke E2E (Playwright): login admin com email/senha + MFA → vê `/hoje` → logout
- [ ] E2E: usuário com role `advogado_associado` tentando `/configuracoes` recebe 403/redirect com toast
- [ ] Test unit: helper `getSession()` em loader retorna `null` se sem token

#### Migração de telas críticas (parcial — "data layer pronto")
- [ ] `/clientes`, `/clientes/:id`, `/casos`, `/casos/:id` lendo via Supabase real (loader TanStack Router)
- [ ] React Query keys em `src/lib/queryKeys.ts`
- [ ] Loading/empty/error states usando componentes shadcn do Lovable
- [ ] Realtime: subscription em `clients` na lista (Sprint 2 expande); **filtro server-side obrigatório** (`organization_id=eq.X`) — atende Architect S-03

---

### Story F4-1.5 · Bootstrap LGPD (NOVO — atende QA F-01)

**Como** DPO/admin, **eu quero** infraestrutura LGPD operacional desde o Sprint 1, **para que** a plataforma atenda direitos do titular (acesso, retenção, revogação) sem retrabalho posterior.

**Estimativa:** 2.5 dias úteis · **Dependências:** Stories F4-1.1, F4-1.3 · **Atende:** QA F-01 (BLOCKER) + Architect S-02

**Critérios de aceitação:**
- [ ] **AC-1** — Tabela `consent_records(id, client_id, finalidade, base_legal, policy_version, evidence jsonb, granted_at, organization_id)` criada na migration `003_tables_global.sql` (lista explícita) — atende QA F-01 item 1
- [ ] **AC-2** — Tabela `consent_revocations(id, consent_id, revoked_at, revoked_by, reason)` criada
- [ ] **AC-3** — Campo `policy_version` em `consent_records` (string semver, ex.: `1.0.0`)
- [ ] **AC-4** — Função `record_consent(client_id, finalidade, base_legal, evidence)` testada com pgTAP
- [ ] **AC-5** — Função `revoke_consent(consent_id, reason)` com trigger que propaga em `audit_log`
- [ ] **AC-6** — Endpoint `/api/lgpd/export-titular` (Edge Function) retorna JSON com dados do titular (CPF do usuário logado OU admin com escopo justificado em `audit_log`)
- [ ] **AC-7** — Função `soft_delete_titular(client_id)` marca `deleted_at`; nenhum query padrão retorna soft-deleted (RLS WHERE `deleted_at IS NULL`)
- [ ] **AC-8** — Cron `pg_cron` mensal chamado `hard_delete_lgpd_retention`: hard-delete de soft-deleted com `quitacao_at < now() - 5 years` (FIES parametrizável por org)
- [ ] **AC-9** — Teste E2E: titular solicita export → recebe JSON com seus dados (cliente, casos, parcelas, consents, comunicações)
- [ ] **AC-10** — Teste E2E: titular revoga consent → registrado em `consent_revocations` + `audit_log` + propagado (ex.: marketing automation respeita revogação)
- [ ] **AC-11** — Cobertura ≥80% das tabelas com PII tem RLS testada por persona em `audit-rls.ts`
- [ ] **AC-12** — Documentação `docs/architecture/lgpd-bootstrap.md` resumindo: tabelas, funções, endpoint, cron, retenção, política de versionamento

**Notas técnicas:**
- Política de Privacidade v1.0.0 fica no repo (`docs/legal/privacy-policy-v1.0.0.md`) — Hyago aprova.
- Story 9.X-LGPD no Sprint 9 estende com export ZIP completo (Master §12.3) e tela de gestão.

---

### Story F4-1.6 · Bootstrap Observabilidade (NOVO — atende QA F-02)

**Como** time de operação, **eu quero** Sentry + logs estruturados + PostHog + UptimeRobot configurados desde o Sprint 1, **para que** todo incidente do Sprint 2 em diante seja diagnosticável com dados reais.

**Estimativa:** 2 dias úteis · **Dependências:** Conta nos providers (ver Pré-requisitos do README) · **Atende:** QA F-02 (BLOCKER)

**Critérios de aceitação:**
- [ ] **AC-1** — Sentry SDK instalado e configurado em:
  - `sistema-hv/` (TanStack Start) com source maps upload no build
  - Cloudflare Workers (wrangler binding)
  - Supabase Edge Functions (DSN via env)
- [ ] **AC-2** — Logtail (Better Stack) configurado — todas as Edge Functions emitem logs estruturados JSON (`{level, msg, request_id, organization_id, user_id, route}`) — ver `_adrs/ADR-004-logging-stack.md`
- [ ] **AC-3** — PostHog configurado com SDK web + server. Eventos contratualizados em `src/lib/analytics/events.ts`:
  - `auth.login`, `auth.logout`, `auth.mfa_setup`
  - `case.macrostatus.changed` (op + fin — 100% das transições)
  - `case.created`, `client.created`
  - `termo.gerado`, `termo.aprovado`, `termo.aceito`
  - `lgpd.export_requested`, `lgpd.consent_revoked`
- [ ] **AC-4** — UptimeRobot monitorando: `https://app.hyagoviana.adv.br/login`, `https://app.hyagoviana.adv.br/api/health`, `https://app.hyagoviana.adv.br/api/health/db` (1min interval; alerta em e-mail + Telegram)
- [ ] **AC-5** — Dashboard mínimo Logtail/Better Stack com 3 widgets:
  - P95 latência queries pipeline
  - Uptime últimas 24h
  - Error rate por Edge Function
- [ ] **AC-6** — Alertas configurados:
  - P95 > 800ms por 5min → notificação
  - Error rate > 1% por 5min → notificação
  - Uptime < 99.5% mensal → relatório
- [ ] **AC-7** — Critério mensurável validado em CI: smoke test verifica que 1 chamada manual a `/api/health` resulta em 1 log estruturado em Logtail + 0 erros novos em Sentry
- [ ] **AC-8** — Critério: 100% das transições de macrostatus em E2E emitem evento PostHog (assert via PostHog API no teste)

**Notas técnicas:**
- Sentry free tier (5K eventos/mês) suficiente para staging; prod migra para Team ($26/mês) no Sprint 11.
- Logtail/Better Stack: 1GB/mês free; Pro $25/mês quando crescer.
- PostHog Cloud free (1M eventos/mês) — adequado para Projeto 1.

---

### Story F4-1.7 · Provisionar VPS Hetzner + n8n + LibreOffice + Playwright (NOVO — atende Architect F-03 + F-04)

**Como** time de DevOps, **eu quero** uma VPS Hetzner com n8n self-hosted + LibreOffice headless + Playwright workers provisionada desde o Sprint 1, **para que** as Sprints 5/6/7/8 não fiquem bloqueadas esperando infraestrutura para processos pesados.

**Estimativa:** 2.5 dias úteis · **Dependências:** Conta Hetzner + DNS Cloudflare · **Atende:** Architect F-03 (n8n) + F-04 (DOCX→PDF + scraping)

**Critérios de aceitação:**
- [ ] **AC-1** — VPS **Hetzner CX22** (€7-15/mês; ARM ou x86 conforme custo-benefício) provisionada em Falkenstein ou Helsinki
- [ ] **AC-2** — Docker + Docker Compose instalados; firewall UFW configurado (apenas 22, 80, 443 públicos)
- [ ] **AC-3** — **n8n self-hosted** instalado via Docker Compose (versão LTS, ex.: `n8nio/n8n:1.x`)
  - Backup de workflows configurado: cron diário exporta `n8n/workflows/*.json` para repo Git
  - Caddy reverse-proxy com TLS automático
  - Subdomínio: `n8n.hyagoviana.adv.br`
- [ ] **AC-4** — **LibreOffice headless** instalado em container dedicado; teste de DOCX→PDF determinístico (5 execuções → mesmo SHA-256) — pré-requisito do SP-03
- [ ] **AC-5** — **Playwright + browsers** (Chromium + Firefox) instalados em container; teste de hello-world fazendo navegação básica
- [ ] **AC-6** — Workers conectam ao Supabase via Service Role; chaves armazenadas em `.env` no servidor + rotação documentada para a cada 90d (atende Architect A-09)
- [ ] **AC-7** — Network: VPS pode chamar Cloudflare Workers (webhook reverso `https://app.hyagoviana.adv.br/api/webhooks/vps`) e vice-versa (Cloudflare Workers chamando `https://n8n.hyagoviana.adv.br/webhook/...`)
- [ ] **AC-8** — **Uptime Kuma** instalado para monitoring de tudo na VPS (interno) + sync com UptimeRobot externo (`/api/health` do n8n)
- [ ] **AC-9** — Backup diário do volume Docker (workflows n8n + configs) para Hetzner Storage Box ou Cloudflare R2
- [ ] **AC-10** — `_adrs/ADR-003-hosting-strategy.md` documenta: o que roda em Cloudflare Workers (frontend SSR), Supabase Edge Functions (auth, lógica de DB, webhook receivers leves), VPS Hetzner (n8n + LibreOffice + Playwright + workers pesados)
- [ ] **AC-11** — Documentação `docs/operations/vps-hetzner-runbook.md`: SSH access, restart procedures, backup/restore drill

**Notas técnicas:**
- Aliança com PRD Master §9.1 (n8n self-hosted) — Opção A do Architect F-03.
- Custo total mensal estimado: €15 VPS + €3 Storage Box = ~R$110/mês.
- Pré-requisito do SP-03 (LibreOffice determinístico) e SP-04 (Playwright Gov.br) — ambos rodam aqui.

---

## Cobertura PRD 1 §6 — mapeamento 1:1

| Story PRD 1 | Story F4 | Estado pós-Sprint |
|---|---|---|
| 1.1 (Supabase + schema global + RLS) | F4-1.1 + F4-1.3 | 100% (com outbox + CHECK desde Sprint 1) |
| 1.2 (Auth backend ligado à UI pronta) | F4-1.4 | 90% (template Postmark fica para Sprint 6) |
| 1.3 (Schema específico FIES + RLS) | F4-1.2 + F4-1.3 | 100% |
| 1.4 (Toggle mock → real telas críticas) | F4-1.4 (parcial) | 30% (apenas 4 rotas estruturais; Sprint 2-3 conclui) |
| §17 LGPD bootstrap | F4-1.5 (NOVO) | 100% bootstrap (export titular + soft-delete + cron retenção) |
| Brief §6 Observabilidade | F4-1.6 (NOVO) | 100% (Sentry + Logtail + PostHog + UptimeRobot) |
| Brief §6 (P10 self-hosting) + PRD Master §9 | F4-1.7 (NOVO) | 100% (n8n + LibreOffice + Playwright operacionais) |

---

## Riscos do sprint + mitigação

| # | Risco | Probabilidade | Mitigação |
|---|---|---|---|
| **S1-R1** | `@supabase/ssr` não suporta TanStack Start nativamente | Média | **SP-01 pré-Sprint** (1 dia útil); fallback adapter custom em loaders (ADR-002) |
| **S1-R2** | RLS quebra após custom claims no JWT | Média | SP-06 valida JWT claims antes; script de auditoria em CI |
| **S1-R3** | Trigger de bifurcação loop infinito | Baixa | Teste pgTAP cobre cenários A→B→A; condicional `WHEN OLD IS DISTINCT FROM NEW` |
| **S1-R4** | Particionamento `case_events` complica DX | Baixa | Documentar em ADR-001 |
| **S1-R5** | Cloudflare Workers tem limite de pacote (10MB) com supabase-js | Baixa | **SP-02 pré-Sprint** (0.5d) valida bundle; tree-shake agressivo |
| **S1-R6** | MFA TOTP exige UI nova que Lovable não tem | Média | Adicionar dentro de `configuracoes.tsx` reaproveitando shadcn |
| **S1-R7** | Hetzner VPS down → bloqueia Sprints 5-8 | Baixa | Uptime Kuma + backup diário; runbook de restore <2h |
| **S1-R8** | LibreOffice não gera PDF determinístico | Média | **SP-03 pré-Sprint** (0.5d) PASS/FAIL; fallback Cloud Run + Puppeteer com fontes pinadas |
| **S1-R9** | PostHog/Logtail/Sentry overhead em Cloudflare Workers (CPU ms) | Baixa | Sampling 10% em prod; full em staging |
| **S1-R10** | Outbox consumer não acompanha throughput | Baixa | Cron 60s default; ajustar para 30s se backlog > 100 |

---

## Validação multi-agente (cerimônia Sprint Review)

### @pm John
- [ ] 7 stories com ACs marcados (1.1 a 1.7)
- [ ] Demo: login admin → logout; lista de clientes vazia carregando do banco; export LGPD funcional; PostHog mostrando 1 evento `auth.login`; n8n acessível em `n8n.hyagoviana.adv.br`
- [ ] Cobertura 1:1 com PRD 1 §6 + LGPD + Observabilidade + infra n8n/VPS documentada acima

### @architect Winston
- [ ] ADRs 001-006 registrados em `_adrs/`
- [ ] Migrations idempotentes e ordenadas
- [ ] Particionamento de `case_events` validado
- [ ] Custom claims no JWT documentados
- [ ] `case_outbox_events` + CHECK `elaborador ≠ conferidor` aplicados (F-01, F-02 fechados)
- [ ] VPS + n8n + LibreOffice + Playwright operacionais (F-03, F-04 fechados)

### @dev
- [ ] Zero `any`, zero `console.log` em produção
- [ ] React Query keys consistentes
- [ ] Loaders TanStack Router corretos (sem fetch no client quando deveria ser server)
- [ ] Code review do PR principal por outro dev

### @qa Quinn
- [ ] Smoke E2E Playwright passando: login + MFA + logout
- [ ] axe-core: zero violations critical/serious em **todas as 4 rotas tocadas** (atende QA M-02)
- [ ] Script `audit-rls.ts` verde com 20+ cenários (incluindo LGPD + outbox)
- [ ] Lighthouse Accessibility ≥ 95 em `/login`, `/clientes`, `/casos`, `/configuracoes`
- [ ] LGPD E2E: export + revogação funcionando
- [ ] Observabilidade smoke: 1 erro forçado aparece em Sentry; 1 evento em PostHog; uptime check verde
- [ ] k6 baseline gerado em `tests/perf/baseline.json`

### @devops
- [ ] `.github/workflows/ci.yml` executando: install + lint + typecheck + build + RLS audit + bundle analyzer + smoke pós-deploy
- [ ] Preview deploys Cloudflare Pages por PR
- [ ] Secrets em GitHub configurados (staging + prod separados)
- [ ] Branch protection ativa em `main` e `develop`
- [ ] Migrations rodam em CI contra Supabase staging em PR
- [ ] Bundle size do app < 1.2MB gzipped (alerta em > 5MB no CI)
- [ ] VPS Hetzner com backup diário + restore drill documentado
- [ ] CODEOWNERS definido (@hyago global + responsáveis por subpastas)

### @po (Hyago) — sign-off opcional
- [ ] Hyago consegue fazer login com sua conta admin e ver a tela `/hoje`
- [ ] Hyago aprovou os 7 roles no seed inicial
- [ ] Hyago aprovou a Política de Privacidade v1.0.0
- [ ] Hyago valida que n8n abre e ele consegue editar 1 workflow de teste

---

## Arquivos esperados (estimativa)

```
sistema-hv/
├── .env.example                                  (atualizado)
├── CHANGELOG.md                                  (novo — Keep-a-Changelog)
├── src/
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts                         (novo)
│   │   │   ├── server.ts                         (novo)
│   │   │   ├── middleware.ts                     (novo)
│   │   │   └── types.ts                          (gerado por supabase gen types)
│   │   ├── analytics/
│   │   │   └── events.ts                         (novo — contratos PostHog)
│   │   ├── observability/
│   │   │   ├── sentry.ts                         (novo)
│   │   │   └── logger.ts                         (novo — Logtail wrapper)
│   │   └── queryKeys.ts                          (novo)
│   ├── routes/
│   │   ├── login.tsx                             (refatorado: mock → real)
│   │   ├── clientes.index.tsx                    (loader Supabase real)
│   │   ├── clientes.$id.tsx                      (loader Supabase real)
│   │   ├── casos.lista.tsx                       (loader Supabase real)
│   │   ├── casos.$id.tsx                         (loader Supabase real)
│   │   └── configuracoes.tsx                     (seções MFA + convite)
│   └── components/auth/
│       ├── MfaSetup.tsx                          (novo)
│       └── InviteUser.tsx                        (novo)
supabase/
├── config.toml                                   (novo)
├── seed.sql                                      (novo — org + roles + admin)
├── migrations/
│   ├── 001_extensions.sql
│   ├── 002_enums.sql
│   ├── 003_tables_global.sql                     (inclui consent_records!)
│   ├── 003b_tables_outbox.sql                    (NOVO — outbox + integration_logs + webhook_dedupe)
│   ├── 003c_termo_skeleton.sql                   (NOVO — termo_acerto_snapshots + CHECK + trigger imutabilidade)
│   ├── 004_indexes.sql
│   ├── 005_triggers.sql
│   ├── 005b_functions.sql                        (NOVO — enqueue_outbox, soft_delete_titular, auth helpers)
│   ├── 006_fies_extension.sql
│   ├── 007_fies_tables.sql
│   ├── 008_lgpd.sql                              (NOVO — consent_revocations + cron hard_delete)
│   ├── 010_rls_clients.sql
│   ├── 011_rls_cases.sql
│   ├── 012_rls_termo.sql
│   ├── 013_rls_portal.sql
│   ├── 014_rls_eventos_docs.sql
│   ├── 015_rls_fies.sql
│   └── 016_rls_outbox_lgpd.sql                   (NOVO)
├── functions/
│   ├── invite-user/index.ts                      (Edge Function)
│   ├── auth-hook/index.ts                        (custom claims JWT)
│   ├── lgpd-export-titular/index.ts              (NOVO)
│   └── outbox-publisher/index.ts                 (NOVO — chamado por pg_cron 60s)
└── tests/
    ├── test_bifurcacao.sql                       (pgTAP)
    ├── test_macrostatus_log.sql                  (pgTAP)
    ├── test_outbox_idempotency.sql               (NOVO pgTAP)
    ├── test_termo_segregacao.sql                 (NOVO pgTAP — CHECK + RLS)
    └── test_lgpd_consent.sql                     (NOVO pgTAP)
scripts/
├── audit-rls.ts                                  (novo — roda em CI)
└── rotate-service-role-key.sh                    (NOVO — rotação 90d)
infrastructure/
└── hetzner/
    ├── docker-compose.yml                        (NOVO — n8n + libreoffice + playwright + uptime-kuma)
    ├── Caddyfile                                 (NOVO — reverse proxy + TLS)
    └── backup.sh                                 (NOVO — backup diário workflows)
tests/perf/
└── baseline.json                                 (NOVO — k6 baseline)
.github/
├── workflows/
│   ├── ci.yml                                    (novo)
│   └── preview-deploy.yml                        (NOVO — Cloudflare Pages por PR)
└── CODEOWNERS                                    (novo)
docs/
├── architecture/
│   ├── auditable-actions.md                      (NOVO)
│   ├── lgpd-bootstrap.md                         (NOVO)
│   └── rls-policies.md                           (novo)
├── operations/
│   └── vps-hetzner-runbook.md                    (NOVO)
├── legal/
│   └── privacy-policy-v1.0.0.md                  (NOVO)
└── sprints-f4/
    └── _adrs/
        ├── ADR-001-stack-tanstack-supabase.md
        ├── ADR-002-supabase-ssr-tanstack.md
        ├── ADR-003-hosting-strategy.md
        ├── ADR-004-logging-stack.md
        ├── ADR-005-webhook-idempotency.md
        └── ADR-006-docx-to-pdf.md
```

**~60 arquivos novos/modificados (v1.0 estimava ~40).**

---

## Próximo sprint

[**Sprint 2 — Clientes (CRUD + 360°)**](./sprint-02-clientes-360.md) — Depende deste Sprint 1 estar 100% verde em validação multi-agente.

---

> _Sprint 1 v1.1 — incorpora os 5 BLOCKERs dos reviews QA + Architect. Pronto para execução após pré-requisitos do README + spikes pré-Sprint + sign-off Hyago._
> _— @pm John, sob coordenação do Orion 🎯_
