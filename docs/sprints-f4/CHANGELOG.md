# CHANGELOG — Sprints F4 (Projeto 1)

Histórico de versões do plano de sprints F4 da Plataforma FIES. Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

---

## [1.1] — 2026-05-20

> Revisão incorporando reviews de @qa Quinn e @architect Winston. **5 BLOCKERs endereçados**, vários SHOULD-FIX absorvidos no Sprint 1, restante listado em `_followups.md`.

### Resumo executivo

Sprint 1 cresceu de **12d → 17d** (+5d) para acomodar fundações críticas que estavam ausentes na v1.0. Duração total do plano: **~100 → ~115 dias úteis**. Justificativa: corrigir agora os 5 BLOCKERs evita 2-4 sprints de retrabalho mais tarde (estimativa Architect).

### Adicionado

- **Story 1.5 — Bootstrap LGPD** (2.5d) — endereça **QA F-01 (BLOCKER)**
  - `consent_records` + `consent_revocations` + `policy_version` na migration `003_tables_global.sql`
  - Endpoint `/api/lgpd/export-titular` (Edge Function)
  - Soft-delete + cron `pg_cron` mensal para hard-delete pós 5 anos (FIES, parametrizável por org)
  - Testes E2E: export titular + revogação consent
  - Cobertura ≥80% das tabelas com PII testada por persona
- **Story 1.6 — Bootstrap Observabilidade** (2d) — endereça **QA F-02 (BLOCKER)**
  - Sentry SDK em TanStack Start + Cloudflare Workers + Supabase Edge Functions (com source maps)
  - Logtail (Better Stack) como provider de logs estruturados (ver ADR-004)
  - PostHog com 100% das transições de macrostatus + eventos núcleo
  - UptimeRobot para `/login`, `/api/health`, `/api/health/db`
  - Dashboard SLO + alertas (P95 > 800ms, error rate > 1%, uptime < 99.5%)
- **Story 1.7 — VPS Hetzner + n8n + LibreOffice + Playwright** (2.5d) — endereça **Architect F-03 (n8n) + F-04 (DOCX→PDF + scraping)**
  - Hetzner CX22 (€7-15/mês) com Docker Compose
  - n8n self-hosted versão LTS com backup workflows
  - LibreOffice headless com fontes pinadas (pré-req SP-03)
  - Playwright Chromium + Firefox
  - Uptime Kuma + backup diário para Storage Box
  - `docs/operations/vps-hetzner-runbook.md`
- **Story 1.1 expandida** — `case_outbox_events` + `integration_logs` + `webhook_dedupe` desde Sprint 1 — endereça **Architect F-01 (BLOCKER)**
  - Migration `003b_tables_outbox.sql`
  - Função `enqueue_outbox()` + Edge Function `outbox-publisher` (cron pg_cron 60s)
  - ADR-005 documenta estratégia de idempotência
- **Story 1.1 expandida** — `termo_acerto_snapshots` com CHECK `elaborador_id IS DISTINCT FROM conferidor_id` + trigger `prevent_termo_mutation_after_approval()` — endereça **Architect F-02 (BLOCKER)**
  - Migration `003c_termo_skeleton.sql`
  - Teste pgTAP: violação falha tanto via API quanto via service role (defesa em profundidade)
  - RLS adicional impedindo mesmo usuário ter ambos os papéis
- **6 ADRs novos em `_adrs/`:**
  - ADR-001 — Stack TanStack + Supabase (decisão já tomada, documentada)
  - ADR-002 — Estratégia cliente Supabase em TanStack Start
  - ADR-003 — Hosting strategy (Cloudflare + Supabase Edge + VPS Hetzner)
  - ADR-004 — Logging stack (escolha de Logtail/Better Stack)
  - ADR-005 — Webhook idempotency (outbox + webhook_dedupe)
  - ADR-006 — DOCX→PDF (LibreOffice em VPS vs alternativas)
- **`_followups.md`** com lista categorizada por sprint dos SHOULD-FIX e NICE-TO-HAVE não absorvidos na v1.1
- **Seção "Gates entre sprints"** no README com critérios objetivos para "Sprint N+1 pode começar" (atende sugestão @qa)
- **Seção "Spikes técnicos pré-Sprint 1"** no README com plano de execução dos 6 spikes SP-01 a SP-07 (atende Architect)
- **Seção "Pré-requisitos do Sprint 1"** reescrita com tabela de credenciais necessárias (quem cria, onde guarda, plano sugerido)
- **`docs/architecture/auditable-actions.md`** lista exaustiva de ações sensíveis (atende QA S-06)
- **`docs/legal/privacy-policy-v1.0.0.md`** Política de Privacidade versionada (atende QA F-01 item 5)
- **`scripts/rotate-service-role-key.sh`** rotação 90d (atende Architect A-09)
- **`tests/perf/baseline.json`** com k6 baseline (atende QA S-07)
- **Bundle analyzer** no CI alerta em > 5MB (atende QA M-03 + Architect S-07)
- **Preview deploys Cloudflare Pages por PR** (atende Architect S-06)
- **MFA obrigatório para `admin` E `fin`** (atende QA S-05)
- **Password Policy mínima** (12 chars, 1 maiúscula, 1 número — atende QA QR-04)
- **JWT TTL 30min + refresh + revoke server-side no logout** (atende QA QR-05)
- **`pg_jsonschema`** para validar `fies_data` (atende Architect A-08)

### Alterado

- **Sprint 1:** estimativa 12d → 17d
- **README:** versão 1.0 → 1.1; total do plano 95-110d → 100-115d
- **Sprint 1 DoD:** reorganizado em seções (Schema+RLS, Auth+UI, LGPD, Observabilidade, VPS, Outbox, CI/CD, Docs)
- **Story 1.4:** axe-core agora exige zero violations em **todas as 4 rotas tocadas** (não só `/login`) — atende QA M-02
- **Story 1.4:** Realtime exige **filtro server-side obrigatório** (`organization_id=eq.X`) — atende Architect S-03

### Não alterado (decisão consciente)

- **Sequenciamento dos 11 sprints** — Architect recomendou explicitamente não mexer
- **DoD global** — Mantido com rigor
- **Ritual multi-agente** — Mantido
- **Sprints 2-11** — Não tocados nesta revisão; SHOULD-FIX referentes a eles vão para `_followups.md` para tratamento conforme cada sprint se aproxima

### BLOCKERs endereçados — rastreabilidade

| ID | Origem | Descrição | Story que resolve |
|---|---|---|---|
| **QA F-01** | `_review-qa.md` §"F-01" | LGPD ausente do Sprint 1 | **Story 1.5** (NOVO) + atualização Story 1.1 (consent_records explícito) |
| **QA F-02** | `_review-qa.md` §"F-02" | Observabilidade zerada | **Story 1.6** (NOVO) |
| **Architect F-01** | `_review-architect.md` §"F-01" | `case_outbox_events` ausente do Sprint 1 | **Story 1.1 expandida** + migration `003b_tables_outbox.sql` + ADR-005 |
| **Architect F-02** | `_review-architect.md` §"F-02" | CHECK `elaborador ≠ conferidor` adiado para Sprint 8 | **Story 1.1 expandida** + migration `003c_termo_skeleton.sql` + trigger imutabilidade |
| **Architect F-03 + F-04** | `_review-architect.md` §"F-03" e "F-04" | n8n + DOCX→PDF + Playwright sem infra | **Story 1.7** (NOVO) + ADR-003 + ADR-006 |

### Trade-offs documentados

- **Sprint 1 fica denso (17d).** Aceito porque alternativa (descobrir gaps no Sprint 5+) custa 2-4 sprints. Hyago precisa estar ciente de que primeira entrega visível ao usuário continua sendo Sprint 2 (CRUD Cliente).
- **VPS Hetzner adiciona ~R$110/mês** (€15). Aceito porque destrava 4 sprints (5, 6, 7, 8) sem precisar de Cloud Run ou Browserless.
- **Plano Supabase Pro desde Sprint 1 ($50/mês)** em vez de Free. Aceito porque PITR + 500 conexões são pré-requisitos de produção e Realtime sob carga (SP-05).
- **CHECK constraint vs RLS apenas:** escolhemos defesa em profundidade (CHECK no DB + RLS + trigger). Custo: 1 migration extra. Benefício: service role bypass impossível.

### Conflitos entre BLOCKERs (não houve)

Nenhum dos 5 BLOCKERs entrou em conflito direto com outro. Architect F-02 (CHECK) e QA F-01 (LGPD) compartilham a mesma migration `003_tables_global.sql` mas em pontos diferentes.

---

## [1.0] — 2026-05-20

### Adicionado

- Plano inicial completo de 11 sprints em `docs/sprints-f4/`
- README com visão geral, tabela de sprints, princípios, ritual multi-agente, DoD global
- Sprint 1 detalhado com 4 stories (1.1 a 1.4), 12d estimados
- Sprints 2-11 com esqueleto: objetivo, stories alto-nível, riscos, DoD específico
- Princípios não-negociáveis: risco descendente, valor incremental, migração tardia, integrações isoladas, Portal paralelizável, dashboards por último, Lovable intocável
- Decisões já tomadas: TanStack Start + Vite, Supabase, Lovable intocável, F4 começa direto

### Removido

- N/A (versão inicial)

---

> _Versionamento conforme [SemVer](https://semver.org/lang/pt-BR/): MAJOR.MINOR para releases do plano. Hotfixes pontuais usam PATCH._
> _Owner: @pm John · Coordenação: Orion (aios-master)._
