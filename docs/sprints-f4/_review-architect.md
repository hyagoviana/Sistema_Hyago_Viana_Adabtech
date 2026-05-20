# 🏗 Architect Review — Sprints F4 Projeto 1

> **Revisor:** @architect Winston (Solution Architect, AIOS) · **Coordenação:** Orion (aios-master)
> **Data:** 2026-05-20 · **Versão:** 1.0
> **Status:** **APROVADO COM RESSALVAS — bloqueante: 4 spikes técnicos + 3 achados críticos a endereçar antes de mergear Sprint 1**

---

## Veredito executivo

O plano F4 do @pm John é **estruturalmente sólido**: bem ancorado nos 11 épicos do PRD 1, com sequenciamento de risco descendente correto (fundação → CRUD → fluxos → migração → cutover), Definition of Done global rigoroso e ritual de validação multi-agente bem desenhado. A escolha de adiar migração (Sprint 10) e dashboards (Sprint 11) é prudente.

**Porém, há quatro categorias de risco arquitetural mal calibradas** que, se não endereçadas antes do Sprint 1 começar, têm potencial de causar retrabalho de 2-4 sprints ou — pior — comprometer a integridade transacional/segurança da plataforma em produção:

1. **Stack mismatch não validada** — TanStack Start + Cloudflare Workers + Supabase é uma combinação que **nenhum dos 3 documentos de referência (Brief §6, PRD Master §6, frontend-architecture.md) homologou**. O Brief §6 diz Next.js 15 + Vercel. O PRD Master §4.1 cita explicitamente `@supabase/ssr` (que assume Node.js, não Workers). A documentação do TanStack Start + `@supabase/ssr` em produção sob Cloudflare Workers é **escassa**, e o sprint plan trata isso como um spike de 4h dentro da Story 1.4 — é insuficiente. Esse risco precisa virar **3 spikes timeboxed pré-sprint 1**.

2. **Outbox pattern ausente do Sprint 1** — PRD Master §5.1 e §6.3 são explícitos: toda integração externa passa por `case_outbox_events` (idempotência + DLQ + retry). O Sprint 1 cria 17 tabelas globais + 6 FIES mas **não inclui `case_outbox_events`**. Isso quebra P2 (orientação a eventos) e força o Sprint 5 (Drive sync) e Sprint 6 (ZapSign webhook) a criar a tabela tarde, com risco de migrations dependentes ficarem fora de ordem. Mover para Sprint 1 (Story F4-1.1).

3. **Conversão DOCX→PDF + scraping Gov.br/SEI subestimados** — Cloudflare Workers **não roda binários nativos** (LibreOffice, Puppeteer, Tesseract). O plano marca ADR-006 como TODO, mas isso não é uma decisão de design — é um **bloqueador de runtime** que afeta Sprints 5, 7 e 8. Precisamos de VPS dedicada (Browserless ou LibreOffice headless) **provisionada antes do Sprint 5** começar. Ditto para Playwright (Gov.br/SEI/CNES) — não roda em Workers.

4. **n8n self-hosted invisível no plano até Sprint 7** — Brief §6 e PRD Master §9 elevam n8n a infra-crítica (P10). Sprint 7 é o primeiro a citá-lo, mas até lá há decisões (Drive sync Sprint 5, ZapSign Sprint 6) que o PRD Master §9.2 diz que devem rodar em n8n. O plano F4 está fazendo essas integrações como Edge Functions Supabase, **divergindo do contrato do PRD Master**. Precisa decisão consciente: ou seguimos PRD Master (n8n provisionado no Sprint 1), ou registramos ADR explícito desviando dele.

**Pode-se iniciar Sprint 1?** Sim, **após** endereçar 3 ações pré-sprint (detalhadas em "Aprovação final"). O Sprint 1 em si está bem desenhado e o atraso para validar fundamentos é menor que o custo de descobrir bugs estruturais no Sprint 5+.

---

## Aderência aos princípios do Brief §5 (P1–P10)

| Princípio | Cobertura nos sprints | Gap arquitetural | Sprint sugerido para fechar |
|---|---|---|---|
| **P1 — Base canônica única** | ✅ Forte. Sprint 1 cria schema único Supabase; nenhum sprint introduz base paralela. | Materialized views (Sprint 4 + Sprint 11) podem fragmentar leitura se não houver invalidação clara. Documentar ownership: "MV é leitura; mutação sempre na tabela base". | ADR adicional no Sprint 1 |
| **P2 — Orientação a eventos** | ⚠️ **Parcial.** Sprint 1 cria `case_events` e triggers `trg_log_macrostatus` + `trg_bifurcar`. Mas **`case_outbox_events` (PRD Master §6.3) está ausente** do Sprint 1. Sem outbox, webhooks ZapSign (Sprint 6) e Conta Azul/Asaas (Sprint 9) não terão garantia de exactly-once. | **F-01 (BLOCKER).** Adicionar `case_outbox_events` + `integration_logs` + função `enqueue_outbox()` no Sprint 1, Story F4-1.1. | Sprint 1 |
| **P3 — Dois rastros independentes (Op + Fin)** | ✅ Forte. Sprints 3 e 4 separam corretamente. Trigger de bifurcação no Sprint 1 com teste pgTAP no Sprint 1. | Falta CHECK garantindo que `macrostatus_financeiro` só pode sair de `NAO_APLICAVEL` via bifurcação automática (anti-burla manual via Postgres). | Sprint 4 |
| **P4 — Imutabilidade pós-aprovação** | ⚠️ **Parcial.** Sprint 8 cita hash SHA-256 + snapshot v1. Mas falta: (a) trigger Postgres impedindo `UPDATE` em snapshots APROVADOS (apenas RLS é insuficiente — service role bypassa); (b) hash verificado **na geração** e **na visualização** (Sprint 9 só cita na visualização). | **S-01 (SHOULD).** Adicionar trigger `prevent_termo_mutation()` + verificação hash em ambos os pontos. Story 8.3. | Sprint 8 |
| **P5 — IA copiloto, nunca piloto** | ✅ Adiada corretamente (Projeto 3). Sprint 1 prepara `vector` extension. Aprovação automática Termo (Sprint 8) é regra determinística, não IA — correto. | Faltam fundações: tabelas `prompt_logs`, `ai_validations` (referenciadas em PRD Master §8). Pode aguardar Projeto 3, mas o schema pgvector já vai estar criado sem uso por meses (risco de drift). | Documentar em ADR-001 |
| **P6 — Segregação de funções** | ✅ Forte. Sprint 1 inclui RLS `termo_update_conferencia` + CHECK `elaborador ≠ conferidor` é planejado para Sprint 8 (Story 8.2). | **F-02 (BLOCKER).** CHECK constraint deve estar **desde o Sprint 1** (na migration `003_tables_global.sql`), não só RLS — porque service role bypassa RLS. Sem CHECK, scripts admin podem violar segregação. Mover para Sprint 1. | Sprint 1 |
| **P7 — Anti-alucinação RAG** | ✅ Corretamente adiado para Projeto 3. Sprint 1 cria `vector` extension. | OK. Sem ação. | n/a (Projeto 3) |
| **P8 — LGPD por design** | ⚠️ **Parcial.** `consent_records` aparece no Sprint 1. `audit_log` também. Soft-delete + restore citado no DoD global. **Mas:** sem sprint para retenção (cron `pg_cron` apagando dados após 5 anos pós-quitação — Brief §11.3), sem export JSON (direito ao acesso/portabilidade), sem tela de gestão de consentimentos. | **S-02 (SHOULD).** Adicionar story explícita "LGPD operations" no Sprint 9 (já que ele toca Portal de Perfil) ou no hardening do Sprint 10. | Sprint 9 ou 10 |
| **P9 — Migração não disruptiva** | ✅ Forte. Sprint 10 dedicado; Sprint 11 prevê coexistência 2 semanas (S11-R3). | Falta: estratégia explícita de "quem é fonte de verdade durante coexistência". Se Hyago atualizar Excel pós-migração, sistema ignora? Sincroniza? Sem definição, vai gerar inconsistência. | Sprint 10 |
| **P10 — Self-hosting infra crítica** | ⚠️ **Crítica.** n8n self-hosted não aparece como entregável em nenhum sprint **até o Sprint 7**, mas Sprint 5 (Drive sync) e Sprint 6 (ZapSign webhook) deveriam usá-lo conforme PRD Master §9.2. | **F-03 (BLOCKER).** Decidir: n8n provisionado em paralelo ao Sprint 1 (como infra), ou registrar ADR explícito que Sprints 5-6 usam Edge Functions e n8n só entra Sprint 7. | Sprint 1 (infra) ou ADR |

---

## Pontos fortes técnicos

- **Sequenciamento de risco descendente.** Sprint 1 valida Supabase + Auth + RLS antes de qualquer feature. Isso é o melhor que o plano faz: se quebra, paramos cedo e barato.
- **Definition of Done global muito sólido.** Cobertura ≥70%, lint+typecheck+RLS audit em CI, smoke E2E por story, audit_log em ações sensíveis — raro ver um DoD com esse rigor já no plano.
- **Script `audit-rls.ts` em CI no Sprint 1** é exatamente a defesa certa contra M-01 (vazamento entre orgs). 20+ cenários é um número saudável.
- **Adapter pattern para Cobrança (Sprint 9, ADR-007)** segue corretamente o padrão Hexagonal do PRD Master §6.2.
- **Bifurcação Op→Fin via trigger Postgres com teste pgTAP no Sprint 1** é o approach certo (não delegar ao app-tier).
- **Particionamento `case_events` por mês** previsto no Sprint 1 — boa decisão para escala (vai facilitar muito o vacuum em 12-24 meses).
- **Aprovação automática Termo conservadora + métrica de reversão monitorada** (Sprint 8) — postura madura. Critérios bem definidos.
- **Sprint 10 com dry-run obrigatório + amostra aprovada por Hyago antes de commit definitivo** — controle correto.

---

## Achados críticos (BLOCKER) — endereçar antes ou durante Sprint 1

### F-01 · Outbox pattern (`case_outbox_events`) ausente do Sprint 1

**Problema.** PRD Master §5.1 (outbox pattern) e §6.3 (webhook pipeline) tornam a tabela `case_outbox_events` parte do schema canônico. Ela é o ponto único de garantia de idempotência, retry exponencial e DLQ para todas as integrações externas. O Sprint 1, Story F4-1.1, cria 17 tabelas globais mas **não inclui esta**. Spruint 5 (Drive sync) cita "queue via `case_outbox_events`" assumindo que existe. Sprint 6 (ZapSign) idem.

**Sprint(s) afetado(s).** Sprint 1 (criação ausente), Sprint 5 (cita tabela inexistente), Sprint 6 (idem), Sprint 9 (idem).

**Recomendação técnica.** Adicionar à Story F4-1.1 (Sprint 1):
- Migration `003b_tables_outbox.sql` criando `case_outbox_events` + `integration_logs` (PRD Master §6.3 + §3.17).
- Função PL/pgSQL `enqueue_outbox(source, source_event_id, payload)` que valida UNIQUE (idempotência).
- Edge Function template `process-outbox-event` (sem implementação concreta — só esqueleto; cada sprint depois pluga seu processor).
- Teste pgTAP: enqueue duplicado retorna conflito; processor lê PENDING ordenado por `received_at`.

**Trade-off.** +0.5 dia úteis no Sprint 1, mas economiza ~2 dias de refactor no Sprint 5 e 6. Sem outbox, webhook duplicado do ZapSign cria caso duplicado em prod (cenário M-06 sub-estimado).

---

### F-02 · CHECK `elaborador ≠ conferidor` adiado para Sprint 8 expõe gap de Sprint 1

**Problema.** O PRD Master §3.13 já define `CONSTRAINT chk_segregacao_elab_conf CHECK (...)`. Sprint 1, Story F4-1.1 cria a tabela `termo_acerto_snapshots`, mas o CHECK só é citado no Sprint 8 (Story 8.2 “Conferência”). Entre o Sprint 1 e o Sprint 8 há ~6 sprints. Se qualquer migration ou script admin (incluindo o migrador do Sprint 10) inserir registros em `termo_acerto_snapshots` durante esse período, **a constraint estará ausente** e dados ruins entram em produção.

**Sprint(s) afetado(s).** Sprint 1 (criação incompleta), Sprint 10 (migração pode violar).

**Recomendação técnica.** Mover o CHECK para a migration `003_tables_global.sql` (Sprint 1). Junto, criar trigger `prevent_termo_mutation_after_approval()` que impede `UPDATE`/`DELETE` em snapshots `APROVADO_JURIDICO`, `APRESENTADO`, `ACEITO` (mais defesa-em-profundidade — RLS pode ser bypassed por service role).

**Trade-off.** Zero custo adicional. Apenas mover linha de SQL. Sem isso, P6 (segregação de funções) tem janela de violação de ~5 meses.

---

### F-03 · n8n self-hosted não tem sprint de provisionamento

**Problema.** Brief §6 (P10) e PRD Master §9 estabelecem n8n self-hosted como infra crítica. PRD Master §9.2 lista 15 workflows que devem rodar em n8n, incluindo `wf-zapsign-onboarding` (que o Sprint 6 implementa como Edge Function) e `wf-régua-followup-docs` (Sprint 7). **Não há nenhum sprint dedicado a provisionar n8n** (VPS Hetzner, Docker Compose, backups, Caddy/TLS). O plano F4 está silenciosamente migrando responsabilidades para Edge Functions Supabase — isso é uma divergência arquitetural que precisa ser **consciente, documentada em ADR e justificada**, ou revertida.

**Sprint(s) afetado(s).** Sprint 5, 6, 7, 9 (todos assumem coisas executando em algum lugar — não está claro onde).

**Recomendação técnica.** Duas opções (ambas via ADR):

| Opção | Custo | Trade-off |
|---|---|---|
| **A. n8n provisionado em paralelo ao Sprint 1** (infra-track separada) | +€20/mês VPS + 2-3 dias DevOps | Aderência ao PRD Master; reduz complexidade nas Edge Functions; permite Hyago editar workflows visualmente. |
| **B. Edge Functions Supabase até Sprint 7, então adoção parcial n8n para scrapers** | -€20/mês + simplifica Sprints 5-6 | Diverge do P10 (self-hosting infra crítica); concentra dependência em Supabase; mudança tardia força refactor. |

**Recomendação do @architect:** **Opção A**. n8n entra como infra paralela ao Sprint 1 (sem story dedicada no Sprint 1; vai como linha lateral no readme + tarefa DevOps). Custo é baixo, alinhamento ao Brief é total, e Hyago pode editar workflows sem precisar de PR — isso destrava a equipe operacional.

---

### F-04 · DOCX→PDF + scraping headless precisam de infra fora de Cloudflare Workers

**Problema.** Cloudflare Workers **não roda binários nativos**. Os sprints 5, 7 e 8 dependem:
- **Sprint 5:** `docxtemplater` + LibreOffice/Puppeteer para gerar Declaração COVID + DGM em PDF;
- **Sprint 7:** Playwright para protocolar no Gov.br (`wf-protocolo-egov`), scraping SEI e CNES;
- **Sprint 8:** geração de Termo PDF determinístico com hash reproduzível.

O Sprint 5 cita ADR-006 como TODO, mas **as opções têm custos materialmente diferentes** (de R$0 a R$500/mês) e tempo de cold-start variável (de instantâneo a 10s+). Sem decidir **antes**, o time vai descobrir no meio do Sprint 5 e perder dias.

**Sprint(s) afetado(s).** Sprint 5, Sprint 7, Sprint 8.

**Recomendação técnica.** **Spike pré-sprint** (timebox 1 dia útil) avaliando 3 opções:

| Opção | Custo/mês | Cold start | Determinismo PDF (hash) | Recomendação |
|---|---|---|---|---|
| **Cloud Run + Puppeteer container** | $0-$30 (free tier generoso) | 2-5s (com min-instances=0); ~0s com min-instances=1 ($15/mês) | Bom (fontes pinadas no Dockerfile) | **Recomendado** para PDF + Playwright |
| **LibreOffice headless em VPS própria (Hetzner)** | €5-10 (incluso no n8n VPS) | ~0s (sempre on) | Excelente (controle total) | OK se já tem VPS para n8n |
| **Browserless.io SaaS** | $50-$200 | ~0s | Médio (versões mudam) | Caro; só se prazo apertar |

**Recomendação do @architect:** Usar a **mesma VPS Hetzner do n8n** (Opção A2 do F-03) também para LibreOffice headless e Playwright workers. Custo marginal zero, infra unificada, e o time DevOps gerencia 1 servidor em vez de 2 plataformas. Documentar em **ADR-006 (geração PDF) + ADR-010 (scraping headless)** ambos referenciando a mesma VPS.

**Trade-off.** Concentra falha em 1 VPS — mitigar com Uptime Kuma + backup diário (já no PRD Master §9.1). Aceitável para volume FIES.

---

## Achados maiores (SHOULD FIX)

### S-01 · Imutabilidade Termo precisa trigger + verificação hash em 2 pontos

Cobertura atual (Sprint 8): hash gerado, RLS impede UPDATE pela API. Falta:
- Trigger `prevent_termo_mutation_after_approval()` (defesa contra service role bypass);
- Verificação de hash **na geração** do PDF (assert que o que está em DB casa com bytes gerados);
- Verificação de hash **antes do aceite** (Sprint 9 cita; bom);
- Verificação de hash **a cada visualização Portal** (NÃO citado — Portal pode mostrar PDF cacheado obsoleto).

**Sprint sugerido:** Sprint 8 (criar trigger + assert na geração), Sprint 9 (verificação no Portal).

---

### S-02 · LGPD operations (retenção + export + gestão consentimentos) sem sprint

Brief §11.3 lista 6 requisitos LGPD; Sprint 1 cobre 2 (consent_records + audit_log). Faltam:
- Cron `pg_cron` mensal: hard-delete pós retenção (5 anos pós-quitação FIES);
- Botão "Exportar meus dados" no Portal (Sprint 9 não cita);
- Tela admin de gestão de consentimentos por finalidade;
- Anonimização nos painéis institucionais (ANMR/AMPB) — fora do Projeto 1, mas a infra começa aqui.

**Sprint sugerido:** Adicionar story "LGPD ops" ao Sprint 9 (+1.5d) ou ao hardening do Sprint 10 (+1.5d).

---

### S-03 · Realtime do Supabase: estratégia de subscribe/unsubscribe e cost-control não definidos

Sprint 2 (lista Clientes), Sprint 3 (Pipeline Op com drag-drop multi-user), Sprint 4 (Pipeline Fin) — todos usam Realtime. Riscos:
- **Memory leaks:** `useEffect` sem cleanup em loaders TanStack Router quebra se rota for cacheada;
- **Connection caps:** Supabase Free tem 200 concurrent connections; Pro 500. Com 10-30 usuários abertos em múltiplas telas, pode estourar;
- **Egress cost:** cada UPDATE em `cases` é broadcast para todos os assinantes — em prod com 2500 casos e múltiplas telas abertas, pode gerar GB/dia.

**Recomendação.** ADR específico (ADR-011 sugerido) padronizando:
- Subscribe sempre dentro de `useEffect` retornando cleanup;
- Filtros server-side (`filter: 'organization_id=eq.X'`) — nunca subscrever sem filtro;
- 1 subscription por **tela**, não por **componente** (consolidar no nível da rota);
- Métricas em Sentry/PostHog: contagem de subscriptions ativas por user.

**Sprint sugerido:** Adicionar ao Sprint 1 como decisão arquitetural; aplicar no Sprint 2 em diante.

---

### S-04 · Streaming/Suspense do TanStack Start com Supabase queries não validado

Sprint 1 assume que loaders TanStack Router chamam `supabase.from(...)` server-side. Mas:
- TanStack Start `createServerFn` ainda é experimental em alguns aspectos;
- Streaming SSR + Suspense fronteiras requerem `Awaited<ReturnType<typeof loader>>` corretos;
- React Query hydration com loader data pode duplicar fetches se mal-feito.

**Recomendação.** Adicionar ao spike Story F4-1.4 (4h → estender para 6h) a validação explícita de:
- Loader Server → Hydration React Query → Realtime subscription (caminho completo);
- 1 PR de exemplo com `/clientes` antes de replicar nas outras 3 rotas críticas.

---

### S-05 · Materialized views sem estratégia clara de invalidação

Sprint 4 (8 views) e Sprint 11 (3 dashboards MVs) usam `pg_cron` para refresh nightly + Inadimplência refresh on-demand. Problemas:
- "On-demand" sem definição: a cada abertura de view? a cada minuto? Custo de REFRESH MATERIALIZED VIEW em prod com 2500 casos pode ser ~10s — UX pode pisca;
- REFRESH MATERIALIZED VIEW **bloqueia leitura** sem `CONCURRENTLY` (precisa de UNIQUE index na MV — Sprint 4 não menciona);
- pg_cron jobs precisam ser idempotentes e ter alerting se falham — Sprint 4 não cita.

**Recomendação.** ADR-012 sugerido: estratégia de MVs (refresh policy, CONCURRENTLY obrigatório, indexes necessários, alerting). Aplicar no Sprint 4.

---

### S-06 · CI/CD do Sprint 1 falta: preview deploys, smoke pós-deploy, rollback, migration lock

DoD Sprint 1: "lint + typecheck + build + RLS audit". Bom, mas falta:
- **Preview deploys por PR** no Cloudflare Pages (essencial para review de UI);
- **Smoke tests pós-deploy** (curl em endpoints críticos);
- **Rollback automático** se smoke falha (Cloudflare suporta via `wrangler rollback`);
- **Migrations versionadas com lock** (Supabase CLI tem `--linked` mas não previne duas pipelines aplicando ao mesmo tempo);
- **CODEOWNERS** previsto, mas sem definição quem é owner de quê (apenas "@hyago global").

**Recomendação.** Expandir Sprint 1 DoD (DevOps) com esses 5 itens. +1d útil no Sprint 1.

---

### S-07 · Bundle size + code splitting do TanStack com 53 rotas não validados

Sprint 1 DoD diz "Bundle size do app < 1.2MB gzipped". Mas com 53 rotas + 46 shadcn + Supabase JS + React Query + Recharts + pdf.js (Sprint 5) + xlsx (Sprint 10), 1.2MB é otimista. TanStack Router faz code-splitting automático por rota se usado corretamente, mas:
- Vite com `@cloudflare/vite-plugin` tem limite de **10MB por bundle** (Workers Free) ou **25MB** (Paid);
- Recharts é particularmente grande (~200KB gzipped) — Sprint 11 (dashboards) pode estourar.

**Recomendação.** Adicionar bundle analyzer (`rollup-plugin-visualizer`) ao Sprint 1 CI. Alertar se total > 5MB. Re-validar no Sprint 11 antes de adicionar Recharts em massa.

---

## Achados menores (NICE TO HAVE)

### M-01 (review) · `pgvector` criada no Sprint 1 mas usada só no Projeto 3
Risco de drift (extension version mismatches em ~6 meses). Documentar no ADR-001 a versão pinada e a justificativa de criar agora.

### M-02 (review) · Cobertura ≥70% pode ser difícil em código Edge Functions Deno
DoD global pede ≥70% unit/integration. Deno tem ecossistema de teste diferente (não usa Vitest). Documentar no Sprint 1: que ferramenta de teste para Edge Functions? `deno test`? Cobertura via `deno coverage`?

### M-03 (review) · Painel "Hoje" (`/hoje`) é uma das rotas mais ricas e não tem sprint dedicado
Mencionado de passagem no Sprint 1 ("Sucesso redireciona para `/hoje`") e no Sprint 8 ("aparece no Painel Hoje com prioridade ALTA"). Mas o `/hoje` agrega tarefas/eventos de múltiplas tabelas — onde é implementado? Sugestão: incorporar à Story 3.1 ou criar story dedicada no Sprint 4.

### M-04 (review) · Storage RLS testado em audit-rls.ts?
Sprint 1 audit-rls cobre 20 cenários DB. Storage RLS é separado (testes precisam baixar/upar com diferentes JWTs). Sprint 5 cita "Policies separadas no Storage referenciando `auth.org_id()`". Validar que `audit-rls.ts` é estendido no Sprint 5 com cenários Storage.

### M-05 (review) · Idempotência de cron jobs `pg_cron`
Sprint 7 (régua follow-up), Sprint 9 (régua cobrança), Sprint 11 (MV refresh). Se `pg_cron` dispara 2x por algum motivo (restart, manual trigger), o que acontece? Tarefas duplicadas? Add: cada cron job tem dedupe via tabela `cron_run_log` com `UNIQUE (job_name, run_date)`.

### M-06 (review) · `case_documents.ocr_text` GIN em português
Sprint 1 nota técnica cita "confirmar disponibilidade do dicionário no Supabase". Não é "confirmar" — é **bloqueante** para Sprint 5 (busca full-text). Spike de 30min no Sprint 1.

### M-07 (review) · Convite por e-mail no Sprint 1 sem Postmark
Sprint 1 usa template Supabase nativo; Postmark vem só Sprint 6. Mas e-mail de convite de teste de Hyago pode cair em spam (Supabase usa SES compartilhado). Aceitável, mas documentar limitação.

### M-08 (review) · Drag-drop com latência ruim no Realtime (S3-R2)
Optimistic update local + rollback é a abordagem certa, mas falta detalhe: como o rollback se comporta se 2 usuários moverem o mesmo card simultaneamente? Last-write-wins? Conflict resolution? Definir no Sprint 3.

---

## ADRs faltantes (recomendados)

O @pm citou ADR-002 (Supabase em TanStack Start), ADR-006 (DOCX→PDF), ADR-007 (Adapter Cobrança), ADR-008 (Provider 2FA SMS), ADR-009 (Drive estratégia migração). Recomendo **adicionar**:

| ADR | Escopo | Sprint sugerido |
|---|---|---|
| **ADR-001** *(revisar)* | Supabase como backend — pinar versão Postgres, extensions, política de upgrade. Documentar limites do plano Pro vs Free (connections, egress, storage). | Sprint 1 |
| **ADR-003** | **Hosting strategy:** Cloudflare Workers (frontend) + Supabase (backend) + VPS Hetzner (n8n + LibreOffice + Playwright). Diagrama de fluxo de dados. | Pré-Sprint 1 |
| **ADR-004** | **n8n vs Edge Functions:** quando usar qual. Critério: workflows visuais editáveis pela equipe → n8n; lógica pura de dados ou auth → Edge Functions. | Pré-Sprint 1 |
| **ADR-005** | **OCR strategy:** Tesseract local vs Google Vision vs Claude Vision (custo, precisão, latência). | Sprint 5 |
| **ADR-010** | **Scraping headless:** Playwright em VPS Hetzner (compartilhada com n8n). Estratégia de retry, captcha, alerting. | Sprint 7 |
| **ADR-011** | **Supabase Realtime:** padrão de subscribe/unsubscribe, filtros obrigatórios, cap de conexões por usuário, métricas. | Sprint 1 (decisão) / Sprint 2 (aplicação) |
| **ADR-012** | **Materialized views:** refresh policy, CONCURRENTLY, indexes obrigatórios, pg_cron, alerting. | Sprint 4 |
| **ADR-013** | **Cobrança:** Conta Azul + Asaas (auto-detecção) vs um único provider — alinhar com Hyago. Trade-off custo, features, lock-in. | Pré-Sprint 9 |
| **ADR-014** | **Assinatura digital:** ZapSign vs alternativa (Clicksign, DocuSign). Critério: custo por assinatura, API webhook, eVidência legal. | Pré-Sprint 6 |
| **ADR-015** | **Cache strategy:** Cloudflare CDN (assets) + Supabase Postgres (queries) + React Query (client) — TTLs, invalidation patterns. | Sprint 1 |
| **ADR-016** | **IA estratégia (futura, Projeto 3):** Claude vs OpenAI por finalidade (peticionamento, classificação, embeddings). Custo + caching. | Pré-Projeto 3 |
| **ADR-017** | **Backup + DR Supabase:** PITR, snapshot frequency, RTO/RPO, runbook de restore. | Sprint 1 (decisão) / Sprint 11 (runbook) |

**Total: ~12 ADRs adicionais** + 5 já planejados = ~17 ADRs durante o Projeto 1. Parece muito, mas é o custo de uma fundação bem documentada — economiza 10× em retrabalho.

---

## Spikes técnicos recomendados antes/durante Sprint 1

Spikes são **investigações timeboxed** com produto técnico (ADR, exemplo funcional, ou veto). Recomendo executar **antes de Sprint 1 começar oficialmente**:

| # | Spike | Timebox | Owner | Output |
|---|---|---|---|---|
| **SP-01** | `@supabase/ssr` funciona em TanStack Start em Cloudflare Workers? | **1 dia útil** | Tech Lead | Hello-world deployado: login + sessão cookie httpOnly + RLS funcionando. PASS/FAIL → decide ADR-002. |
| **SP-02** | Bundle size: aplicativo atual `sistema-hv/` com supabase-js + react-query + recharts adicionados estoura limite Workers? | **0.5 dia útil** | DevOps | Bundle analyzer reportado. Decisão: Workers Free OK / precisa Paid / precisa code-splitting agressivo. |
| **SP-03** | LibreOffice headless gera Termo PDF determinístico (mesmo hash em 5 execuções)? | **0.5 dia útil** | Backend | Container Docker pinado com fontes; 5 PDFs gerados; hash comparado. Decisão: aprovar ADR-006. |
| **SP-04** | Playwright Gov.br: consigo fazer login + protocolar 1 documento de teste? | **1 dia útil** | Backend | Workflow n8n + Playwright funcional em sandbox. Documenta CAPTCHA frequency, expiração de sessão. |
| **SP-05** | Supabase Realtime sob carga: 30 conexões simultâneas + 1 UPDATE/seg = quanto egress? | **0.5 dia útil** | DevOps | Carga simulada (script Node). Confirma limite Free/Pro. Decisão: plano Supabase. |
| **SP-06** | Custom claims via Auth Hook Edge Function colocam `organization_id` + `roles[]` no JWT? | **0.5 dia útil** | Tech Lead | JWT decoded mostra claims. PASS é pré-requisito da RLS do Sprint 1. |

**Total: 4 dias úteis de spikes**. Se rodados em paralelo por 2 pessoas, ~2 dias calendário. **Investimento que pode evitar 10-15 dias de retrabalho.**

**SP-01, SP-03 e SP-04 são bloqueantes**: se falham, parte do plano F4 precisa ser redesenhado.

---

## Riscos arquiteturais não cobertos pelo @pm (M-01 a M-10)

O @pm cobriu RLS, layout, scraping, migração, aprovação Termo, ZapSign, mudança cultural, dependências em cascata, schema em prod e TanStack/Cloudflare. **Faltaram:**

| # | Risco arquitetural | Probabilidade | Impacto | Mitigação |
|---|---|---|---|---|
| **A-01** | **Vendor lock-in Supabase.** Se Supabase encarecer ou degradar, sair custa caro (Auth + Storage + Realtime + Edge Functions integrados). | Baixa | Alto | RT6 do PRD Master cita "Postgres puro + RLS standard; portável". Validar no Sprint 1 que zero código usa features proprietárias Supabase quando equivalente standard existe. |
| **A-02** | **Custo Supabase ao crescer.** Plano Free: 500MB DB, 1GB Storage, 50K MAU, 200 connections. Plano Pro ($25/mês): 8GB DB, 100GB storage, 100K MAU. Com 2500 casos + 30GB Drive (referência) + 10-30 users ativos, ficamos no Pro. Mas Realtime tem custo por message — pipeline com 30 users ativos pode passar do incluso ($10/mês adicional cada 100K msgs). | Média | Médio | Calcular custo mensal projetado **antes** de Sprint 1. Documentar em ADR-001. Configurar billing alerts. |
| **A-03** | **Cold start Cloudflare Workers** afeta UX. Workers tem isolates leves, mas Cloudflare Pages + SSR pode ter latência inicial. | Baixa | Médio | Validar no Sprint 1: TTFB de `/login` < 200ms. Se ruim, adicionar `instances=1` (custo) ou usar Cloudflare Pages com Static + Edge Functions. |
| **A-04** | **Limites Cloudflare Free.** 100K req/dia, 10ms CPU/req. Com 30 users ativos * 100 navegações/dia * 5 req/nav = 15K req/dia (OK), mas Edge Functions pesadas podem estourar CPU. | Baixa | Médio | Migrar para Cloudflare Workers Paid ($5/mês) no go-live. Definir em ADR-003. |
| **A-05** | **Backup automático Postgres + RTO/RPO.** Supabase Pro tem PITR 7 dias. Free não. Qual é nossa estratégia de DR? Quanto tempo para restaurar? | Baixa | **Crítico** | Sprint 1 confirma plano Pro. Sprint 11 testa restore (timeboxed 30min) e documenta runbook. |
| **A-06** | **Egress Supabase** ao servir 30GB de PDFs do bucket. Plano Pro inclui 250GB egress/mês. PDFs pesados (Termo médio 2MB) * downloads pode comer. | Média | Médio | Servir docs grandes via signed URL com **redirect para CDN** (Cloudflare R2 ou similar) — não direto do Supabase Storage. Avaliar Sprint 5. |
| **A-07** | **Determinismo PDF cross-environment.** Sprint 8 quer hash reproduzível. Mas fontes diferentes entre Dockerfile staging e prod → hashes diferentes. | Média | Alto | Container Docker pinado com fontes (Sprint 5, ADR-006). Teste em CI: gerar PDF 2x e comparar hash. |
| **A-08** | **`fies_data jsonb` schema-less.** Sprint 1 cria campo livre. Sem JSON schema validation no Postgres, app pode escrever lixo. | Média | Médio | Adicionar CHECK no Postgres validando `jsonb` essential keys ou usar `pg_jsonschema` extension. Documentar shape em TS types. |
| **A-09** | **Service role key gerenciamento.** Service role bypassa RLS — vazamento é catastrófico. Sprint 1 cita "isolado em Edge Functions". | Baixa | **Crítico** | Service role **nunca** no bundle frontend (CI check). Rotação a cada 90d. Pre-commit hook bloqueando string que parece service key. |
| **A-10** | **TanStack Start versão 1.x ainda evolui rápido.** Major version 1.168 hoje pode ter breaking changes em 6 meses. | Média | Médio | Pinar versão exata no `package.json` (sem caret). Subscrever changelog. ADR documenta a versão. |

---

## Recomendações sobre stack/infra (decisões pendentes)

Decisões que o @architect recomenda tomar **antes ou durante o Sprint 1**:

### 1. Infra paralela: VPS Hetzner CCX13 (€20/mês)

Provisionar Hetzner em paralelo ao Sprint 1 com Docker Compose rodando:
- **n8n self-hosted** (PRD Master §9.1) — para workflows visuais editáveis.
- **LibreOffice headless** (ADR-006) — para geração determinística de PDFs.
- **Playwright workers** (ADR-010) — para Gov.br/SEI/CNES scraping.
- **Uptime Kuma** — monitoring de tudo isso.

**Custo:** €20/mês (~R$120). **Benefício:** alinha com P10 (self-hosting), desbloqueia Sprints 5, 6, 7, 8.

### 2. Supabase: ir direto para o plano Pro ($25/mês)

Plano Free não comporta produção (200 connections, sem PITR, sem branching). Pro é pré-requisito de:
- PITR (point-in-time recovery) — A-05;
- 500 connections (Realtime + queries) — S-03;
- Custom domain (`supabase.hv.adv.br`) — branding.

Provisionar prod e staging ambos em Pro.

### 3. Cloudflare: Workers Paid ($5/mês) a partir do go-live

Free é OK para staging/dev. Prod precisa do Paid para CPU > 10ms, R2 (caso queiramos descarregar Storage de docs pesados — A-06), e Workers Analytics decente.

### 4. Postmark confirmado: contratar no Sprint 6, não antes

Sprint 1 usa template Supabase. Postmark ($10/mês plano starter) entra Sprint 6 quando convites externos e magic links em massa começam.

### 5. CI/CD: GitHub Actions + Cloudflare Pages (preview por PR)

Confirmar GitHub Actions (Sprint 1 já assume). Adicionar Cloudflare Pages integration para preview deploy por PR (essencial para review de UI sem tocar prod).

### 6. Sentry + Axiom (logs) + PostHog desde Sprint 1

DoD global cita "Edge Function com logs estruturados" mas não diz onde vão. Provisionar Sentry (free tier OK) + Axiom (free tier 0.5GB/mês) + PostHog (self-hosted? cloud free?) **no Sprint 1**. Sem observabilidade desde o início, debugar problemas de Sprint 5+ vira caça às bruxas.

### 7. Domínio + TLS: `app.hyagoviana.adv.br` + `portal.hyagoviana.adv.br`

Decidir antes do Sprint 1 (Cloudflare já gerencia DNS). `hv.adv.br` é mais curto mas menos institucional.

---

## Aprovação final

**Veredito:** ✅ **APROVADO COM RESSALVAS.**

O plano F4 é bem-estruturado, tem ritmo correto, e o Sprint 1 — apesar dos gaps acima — é defensável. **Não recomendo reescrever sprints**. Recomendo, no entanto, três ações de baixo custo **antes do Sprint 1 efetivamente começar**:

### Ações pré-Sprint 1 (bloqueantes — total ~3 dias úteis)

1. **Executar SP-01, SP-02, SP-03, SP-04, SP-06** (4 spikes técnicos críticos, ~3 dias úteis em paralelo por 2 devs).
2. **Atualizar Story F4-1.1 (Sprint 1)** para incluir:
   - `case_outbox_events` + `integration_logs` (F-01);
   - CHECK `elaborador ≠ conferidor` em `termo_acerto_snapshots` (F-02);
   - Trigger `prevent_termo_mutation_after_approval()` (S-01);
   - Provisionamento `pg_jsonschema` para validar `fies_data` (A-08).
3. **Tomar 3 decisões infraestrutura via ADR** (F-03, F-04):
   - **ADR-003 (Hosting strategy)** — Cloudflare + Supabase + VPS Hetzner;
   - **ADR-004 (n8n vs Edge Functions)** — critério de uso;
   - **ADR-011 (Realtime padrão)** — antes de Sprint 2.

### Ações durante Sprint 1 (recomendadas — sem custo de tempo)

- Adicionar bundle analyzer ao CI (S-07).
- Configurar Sentry + Axiom + PostHog na conta certa.
- Provisionar Supabase Pro (não Free) em staging e prod desde o início.
- Documentar versão pinada do `pgvector` (M-01).
- Validar dicionário PT do tsvector (M-06).

### O que dispensa correção

- Sequenciamento dos 11 sprints (não mexer).
- DoD global (manter rigor).
- Ritual multi-agente (manter — está exemplar).
- Sprint 1 detalhamento de 4 stories (manter; incorporar adições acima a F4-1.1).

### Quando NÃO aprovar?

Se algum dos spikes SP-01, SP-03 ou SP-04 **falhar**, retornar ao Orion para reavaliação:
- **SP-01 falha** → considerar mudar para Next.js (alinhado com PRD original) ou Hono+Vite. Custa ~2-3 sprints.
- **SP-03 falha** → DOCX→PDF não determinístico → Sprint 8 precisa abandonar hash. Reduz P4 (imutabilidade).
- **SP-04 falha** → Gov.br/SEI/CNES sem automação → Sprint 7 vira input manual exclusivo. Reduz valor do produto.

Esses cenários não invalidam o plano inteiro, mas exigem replanejamento explícito.

---

**Recomendação executiva ao Orion:** **destravar o plano F4** e iniciar os spikes pré-Sprint 1 **imediatamente** (semana de 2026-05-21). Sprint 1 oficial começa após os 3 dias de spikes + 1 dia de ADRs + sign-off de Hyago. Total: ~5 dias úteis de preparação antes do start oficial. Sem isso, risco de retrabalho de 2-4 sprints a partir do Sprint 5.

---

> _Revisado com a postura de quem será chamado às 3h da manhã quando algo der errado em produção._
> _— @architect Winston, sob coordenação do Orion 🏗_
