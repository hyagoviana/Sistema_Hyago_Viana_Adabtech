# QA Review — Sprints F4 Projeto 1

> Revisor: @qa Quinn (Test Architect) · Data: 2026-05-20 · **Status: APROVADO COM RESSALVAS**
> Plano avaliado: `docs/sprints-f4/` (README + 11 sprints) · Versão do plano: 1.0 do @pm John
> Referências cruzadas: `docs/prd/01-plataforma-fies.md` §6/§9.2/§10.4/§11/§17 · `docs/prd/master-platform.md` §12 · `docs/project-brief.md` §6

---

## Veredito executivo

O plano F4 do @pm John é **sólido em arquitetura macro e sequenciamento de risco**: a decisão de erguer Supabase + RLS + Auth no Sprint 1 antes de qualquer feature, a postergação da migração para o Sprint 10, e a divisão Op → Fin → Documentos → Onboarding → POPs → Termo → Cobrança → Migração → Dashboards segue a doutrina correta de "risco descendente". O Sprint 1 está com profundidade suficiente para executar (4 stories com ACs observáveis). Riscos macro estão razoavelmente identificados (M-01 a M-10), e o ritual multi-agente está descrito.

Porém, sob lente QA senior, o plano apresenta **lacunas críticas de testabilidade** que, se não corrigidas antes do Sprint 1, comprometem a confiabilidade de tudo que vem depois. Em particular: (1) **LGPD operacional** está praticamente ausente — não há story dedicada para export do titular, não há teste de retenção 5/10 anos, não há teste de revogação de consentimento, e o `consent_records` (Master §3.15) sequer aparece nas migrations do Sprint 1; (2) **observabilidade** (Sentry/Axiom/PostHog do brief §6) não tem sprint, não tem story, não tem KPI testável; (3) **imutabilidade pós-aprovação** (Princípio P4 do brief, §10.1 do PRD 1) só tem 1 linha de DoD no Sprint 8 — falta teste explícito de RLS UPDATE/DELETE; (4) os **4 canais de aceite** (PRD §10.4) estão listados no Sprint 9 mas sem critério de teste por canal nem validação de evidência cross-channel; (5) **migração** (Sprint 10) tem dry-run mas não exige plano de rollback executável nem critério numérico claro de aceite (95% é fraco para 2.500 casos = aceitar 125 erros silenciosos).

**Recomendação:** APROVADO COM RESSALVAS. Pode-se iniciar Sprint 1 **após** corrigir os 5 BLOCKERs abaixo (F-01 a F-05). Os SHOULD-FIX podem ser endereçados durante o Sprint 1 sem bloquear; os NICE-TO-HAVE entram no backlog do sprint correspondente.

---

## Pontos fortes

- **Sprint 1 denso e bem detalhado** — 4 stories com ACs realmente observáveis (`scripts/audit-rls.ts` em CI com 20+ cenários, particionamento `case_events`, pgTAP nos triggers).
- **RLS levado a sério** — script de auditoria automatizado em CI desde o Sprint 1, com cenários cross-org e segregação elaborador≠conferidor.
- **Risco macro M-01 a M-10** — cobertura razoável de riscos cross-sprint, com mitigações executáveis (não apenas declaratórias).
- **Sequenciamento financeiro correto** — Termo (Sprint 8) antes de Cobrança (Sprint 9) antes de Migração (Sprint 10) antes de Dashboards (Sprint 11). Bifurcação validada ponta-a-ponta no Sprint 4 e não apenas via pgTAP.
- **DoD global no README** — 18 itens cobrindo código, backend, frontend, segurança, testes e docs. Bom baseline.
- **Adapter pattern para Cobrança** (Sprint 9, S9-R1) — desacopla Conta Azul vs Asaas e prevê fallback manual.
- **Migration tardia + coexistência** — Sprint 10 fica em staging; prod só no Sprint 11, com janela de manutenção combinada.
- **Hardening dedicado** — 3 dias no Sprint 10 reservados para bugs P0/P1 e re-rodar audit-RLS. Senior move.
- **Pré-requisitos do README explícitos e bloqueantes** — não permite começar Sprint 1 sem checklist humano de Hyago.

---

## Achados críticos (BLOCKER — precisa corrigir antes de Sprint 1)

### F-01 · LGPD não tem story dedicada nem testes

**Onde:** Toda a pasta `docs/sprints-f4/` · **Impacto:** Crítico — viola PRD 1 §17 ("LGPD: export + soft-delete funcionais") e Master §12.3.

**O que está errado:**
- O Sprint 1 cria `consent_records` (mencionado tangencialmente no README como "17 tabelas"), mas a tabela **não aparece** na lista explícita de migrations do Sprint 1 (`003_tables_global.sql` cita 17 tabelas; é preciso confirmar que `consent_records` está incluída — o texto não cita).
- **Não existe** story de export LGPD do titular (`/api/lgpd/export?token={uuid}` do Master §12.3).
- **Não existe** teste de retenção 5 anos pós-quitação (`legal_hold = true`).
- **Não existe** teste de revogação de consentimento por finalidade.
- Sprint 9 menciona "preferências de privacidade (LGPD opt-in/out por finalidade)" sem definir AC observável.
- Hard-delete após retenção 5 anos não é mencionado em nenhum sprint.

**Ação sugerida:**
1. Adicionar Story F4-1.5 no Sprint 1: "Bootstrap LGPD — `consent_records` na lista explícita de migrations + RLS + função `record_consent(client_id, finalidade, base_legal, evidence)`".
2. Criar **Story 9.X-LGPD** no Sprint 9 (ou Sprint 11): "Export LGPD do titular + revogação de consentimento + teste de retenção", com ACs:
   - Endpoint `/api/lgpd/export?token={uuid}` retorna ZIP com 5 arquivos (Master §12.3)
   - E2E: cliente solicita export → recebe e-mail com link assinado → baixa ZIP → contém todos os dados
   - Teste cron: job de retenção move dados sem `legal_hold` para hard-delete após 5 anos
   - Teste: revogação de consent `marketing` impede envio de mensagens dessa finalidade
3. Adicionar ao DoD global: "LGPD smoke E2E executado ao fim de Sprint 9 e Sprint 11".

---

### F-02 · Observabilidade (Sentry/Axiom/PostHog) ausente do plano

**Onde:** Nenhum sprint menciona setup de Sentry, Axiom/Logtail, PostHog ou UptimeRobot · **Impacto:** Crítico — KPIs do brief §6 (P95 ≤500ms, uptime ≥99.5%) não têm como ser medidos sem instrumentação.

**O que está errado:**
- Brief §6 e Master §12.2 listam **6 ferramentas de observabilidade obrigatórias**. O plano F4 não menciona nenhuma delas em nenhum sprint.
- O Sprint 11 (Cutover) precisa de UptimeRobot rodando ANTES do go-live, não depois.
- Sentry source maps precisam ser configurados no `sistema-hv` desde a primeira Edge Function (Sprint 1).
- Sem PostHog, não há baseline de quem usa o quê — Sprint 11 vai "no escuro" para definir prioridades pós-go-live.

**Ação sugerida:**
1. Adicionar **Story F4-1.6 no Sprint 1**: "Bootstrap observabilidade — Sentry (front + Edge Functions com source maps) + Axiom/Logtail (logs estruturados JSON em todas Edge Functions) + PostHog (eventos: login, criar caso, mover pipeline, aceitar Termo)".
2. Adicionar à DoD global no README: "Sentry capturando erros em PR de cada sprint; PostHog eventos contratualizados via `src/lib/analytics/events.ts`".
3. Adicionar ao Sprint 11 (cutover): "UptimeRobot configurado e monitorando app, portal, painel e webhook endpoints **antes** do switch DNS".
4. Adicionar KPI testável: "Sprint 1 deixa um dashboard Axiom/Logtail com pelo menos 1 query de exemplo (`error rate por Edge Function`)".

---

### F-03 · Imutabilidade pós-APROVADO_JURIDICO sem teste robusto

**Onde:** Sprint 8, DoD: "Teste de imutabilidade: tentar UPDATE em snapshot APROVADO retorna erro" · **Impacto:** Crítico — Princípio P4 do brief.

**O que está errado:**
- Apenas 1 linha no DoD. Não há descrição de COMO testar (RLS policy? trigger BEFORE UPDATE? CHECK?).
- Não há teste de **DELETE** (apenas UPDATE).
- Não há teste de tentativa via `service_role` (que normalmente bypassa RLS — precisa de trigger separado).
- A imutabilidade do PDF (hash determinístico) está testada ("PDF determinístico: gerar 2x mesmo input → mesmo hash") mas não há teste de que o hash **persiste** entre v1 e a apresentação ao cliente (Sprint 9, S9-R3 menciona mas é mitigação, não teste).

**Ação sugerida:**
1. No Sprint 8, expandir AC para:
   - Migration `08X_immutability.sql`: trigger BEFORE UPDATE/DELETE em `termo_acerto_snapshots` que **lança exceção** se `status IN ('APROVADO_JURIDICO', 'APRESENTADO', 'ACEITO', 'SUBSTITUIDO')`.
   - Teste pgTAP: UPDATE direto via service_role retorna erro PSQL `IMMUTABLE_SNAPSHOT_VIOLATION`.
   - Teste E2E Playwright: tentar editar via UI um Termo APROVADO mostra read-only.
2. Adicionar AC no Sprint 9: "Cliente aceita Termo: hash do PDF servido = hash em `snapshot.pdf_hash`; teste manipula hash via DevTools e confirma rejeição".
3. Migrar este teste para o **DoD global** como cláusula permanente: "Entidades imutáveis (Termo APROVADO, audit_log, case_events) têm trigger anti-UPDATE/DELETE testado em pgTAP".

---

### F-04 · 4 canais de aceite (PRD §10.4) sem cobertura E2E por canal

**Onde:** Sprint 9, Story 8.5 · **Impacto:** Crítico — PRD 1 §10.4 e §17 exigem todos os 4 canais funcionais.

**O que está errado:**
- A tabela de 4 canais aparece, mas o DoD do Sprint 9 só cita "Smoke E2E completo: aprovação → apresentação → aceite Portal com 2FA". Os outros 3 canais (WHATSAPP, PRESENCIAL, ZAPSIGN) **não têm teste exigido**.
- Não há AC validando que a estrutura de evidência (IP, UA, timestamp, signed_text) está **completa** para cada canal — só Portal é detalhado (signed_text literal).
- Não há teste de **concorrência**: cliente aceita simultaneamente via Portal e WhatsApp — qual ganha?
- Não há teste de **canal indevido**: cliente tenta aceitar via ZapSign mas não há doc_id válido — deve retornar erro estruturado.

**Ação sugerida:**
1. Expandir Story 8.5 com 4 ACs separados (1 por canal), cada um com smoke E2E mínimo:
   - PORTAL: usuário aceita → evidência completa registrada → cobrança disparada.
   - WHATSAPP: simular webhook ChatGuru com "ACEITO" → mesma evidência.
   - PRESENCIAL: ADM faz upload de foto assinada → evidência inclui `registered_by_user_id`.
   - ZAPSIGN: simular webhook ZapSign → `signed_pdf_path` registrado.
2. Adicionar AC explícito: "Concorrência de aceite — primeiro INSERT vence via UNIQUE index em `(snapshot_id, status='ACEITO')`; demais retornam conflito 409 com mensagem clara".
3. Adicionar AC: "Cada canal de aceite gera entrada idêntica em `audit_log` com `channel` discriminado".

---

### F-05 · Sprint 10 (Migração) sem critério numérico aceitável e sem rollback executável

**Onde:** Sprint 10, DoD: ">= 95% das linhas IMPORTED (5% ERROR aceitável documentado)" · **Impacto:** Crítico — 5% de 2.500 = 125 casos com erro silencioso pode esconder bugs sistêmicos.

**O que está errado:**
- 95% é **complacente demais** para uma migração com base legal regulada. Padrão senior para migração one-shot é ≥99% IMPORTED, com cada SKIPPED tendo **motivo classificado** e **plano de tratamento** definido antes do cutover.
- Plano de rollback do cutover (Sprint 11) só aparece como mitigação genérica ("Snapshot pré-cutover; rollback documentado em runbook"). Não há AC: "runbook testado em staging com rollback completo executado e validado".
- Coexistência Excel + sistema (M-04) é mencionada mas não tem teste de divergência: se OPE atualizar Excel após cutover, ninguém detecta.
- Dry-run é "obrigatório" mas não diz **quantas iterações** — senior pratica mínimo 3 dry-runs (validação inicial, pós-correções, pós-aprovação amostra).

**Ação sugerida:**
1. Reescrever AC: "≥99% IMPORTED; cada SKIPPED tem motivo classificado em 5 categorias (CPF inválido, status sem mapeamento, duplicado, dados faltantes obrigatórios, parser error); 100% dos SKIPPED revisados por Hyago antes do go-live".
2. Adicionar AC no Sprint 10: "Mínimo 3 dry-runs em staging com gates entre eles: (a) >50% IMPORTED; (b) >90% IMPORTED + amostra 20 validada por Hyago; (c) >99% IMPORTED + amostra 50 validada".
3. Adicionar Story 10.3: "Rollback executável — script `scripts/rollback-migration.ts` testado em staging que reverte 100% do batch importado em <30min; ADR-009 expande para descrever quando usar".
4. Adicionar Story 11.X-Cutover: "Coexistência observável — script diário compara contagem de casos ativos no Excel vs Supabase durante 2 sem; alerta @admin se divergência > 0".

---

## Achados maiores (SHOULD FIX — durante Sprint 1)

### S-01 · Webhook ZapSign idempotência sem teste de carga / race

**Onde:** Sprint 6, Story 5.1 · **Impacto:** Alto.

**Problema:** "Idempotência via `doc_id` (UNIQUE em `case_outbox_events`)" é projetada, mas teste é apenas: "3 caminhos testados com payload real (sandbox)". Não há teste de **2 webhooks chegando em paralelo** (race condition no INSERT com UNIQUE pode dar erro de constraint em vez de skip elegante).

**Ação sugerida:** Adicionar AC: "Teste de concorrência — 5 chamadas paralelas do mesmo `doc_id` resultam em 1 caso criado + 4 retornos 200 com body `{status: 'duplicate', skip: true}`; nenhum erro 500".

---

### S-02 · Auto-aprovação Termo: critérios sem teste falso/verdadeiro individual

**Onde:** Sprint 8, Story 8.3 · **Impacto:** Alto — PRD §11.1 tem 7 critérios.

**Problema:** O DoD diz "elaborar v1 → aprovação automática" (1 cenário positivo) e "elaborar v1 com cláusula especial → aprovação manual" (1 cenário negativo). Faltam **5 cenários negativos** (1 por critério restante: `tipo_termo`, `percentual`, `procuração`, `flag_risco`, `valor fora faixa`, `flag_judicial`).

**Ação sugerida:** Tabela de testes com 7 linhas (1 critério false por vez) + 1 linha tudo-true. Cada linha gera 1 teste unit em `evaluate-termo-approval.test.ts`. Métricas de cobertura: 100% dos critérios PRD §11.1 testados em isolamento.

---

### S-03 · Cálculo do Termo: 30 casos sem cobertura de bordas

**Onde:** Sprint 8, S8-R1: "teste unit com 30 casos reais" · **Impacto:** Alto — PRD §9.2 tem regras críticas.

**Problema:** "30 casos reais validados por Hyago" é bom mas faltam **casos de borda** explícitos:
- `saldo_antes − saldo_depois − parcelas = 0` (valor_efetivo zero)
- `saldo_depois > saldo_antes` (clamp em 0)
- Resto exato = R$99 (incorpora)
- Resto exato = R$100 (cria parcela extra)
- Resto exato = R$0 (não cria)
- Cenários A, B, C de suspensão FIES (PRD §9.3) — cada um com seu pré-preenchimento

**Ação sugerida:** Story 8.1 ganha AC: "30 casos reais + 8 casos de borda matemáticos + 3 casos de suspensão (A/B/C) = 41 testes unit em `termo-calculation.test.ts`. Falha 1 = bloqueia merge".

---

### S-04 · Bifurcação automática: race condition entre op e fin

**Onde:** Sprint 4, S4-R3 · **Impacto:** Alto.

**Problema:** A mitigação ("CHECK no trigger: só dispara WHEN `OLD.macrostatus_op IS DISTINCT FROM NEW`") previne loop simples mas não cobre: 2 updates simultâneos em colunas diferentes que ambos disparam triggers; trigger fires AFTER UPDATE em transação isolada.

**Ação sugerida:** Adicionar teste pgTAP `test_bifurcacao_concurrent.sql`: 2 sessões `BEGIN; UPDATE; COMMIT;` paralelas — verifica que `case_events` tem exatamente 1 evento `BIFURCACAO_AUTOMATICA`, não 2.

---

### S-05 · MFA obrigatório por role não tem teste

**Onde:** Sprint 1, Story F4-1.4 · **Impacto:** Médio-Alto — README §"Pontos a alinhar" item 9 ainda em aberto.

**Problema:** Sprint 1 implementa MFA "funcional para role `admin`" mas não testa o restante. Brief sugere FIN também. Não há AC: "usuário FIN sem MFA configurado é forçado a configurar no primeiro login pós-decreto".

**Ação sugerida:** Resolver o item 9 do README ANTES do Sprint 1. Depois adicionar AC condicional: "Roles em `MFA_REQUIRED_ROLES = ['admin', 'fin']` sem `mfa_configured = true` recebem redirect para `/configuracoes/mfa` em todas as rotas exceto a própria".

---

### S-06 · Audit_log: ausência de teste de "ações sensíveis"

**Onde:** DoD global · **Impacto:** Alto — Master §12.1 exige audit_log para "toda ação consequente".

**Problema:** DoD diz "Audit log preenchido para ações sensíveis" sem **lista exaustiva** nem teste automatizado. O que conta como sensível? Sem lista, devs vão esquecer.

**Ação sugerida:** Criar em Sprint 1 o arquivo `docs/architecture/auditable-actions.md` com lista exaustiva (mínimo: login, logout, MFA setup, criar/editar/deletar cliente, transição macrostatus, aceite Termo, override admin, export LGPD, revogação consent, geração PDF). Adicionar ao DoD: "Story que toca ação dessa lista DEVE incluir teste E2E que valida 1+ linha nova em `audit_log` com `action`, `actor_user_id`, `entity_kind`, `entity_id`".

---

### S-07 · Performance KPI (P95 ≤500ms) sem instrumentação de medição

**Onde:** Brief §6 · **Impacto:** Médio-Alto.

**Problema:** Vários sprints citam "performance < Xms p95" (Sprint 2: 300ms; Sprint 3: 500ms; Sprint 4: 600ms) mas não há infraestrutura de medição em CI. Como saber se está abaixo do KPI sem load test reproduzível?

**Ação sugerida:** Sprint 1 ganha AC: "Setup k6 (ou autocannon) para benchmark de 5 queries críticas em CI; relatório salvo em `tests/perf/baseline.json`. Falha pipeline se P95 > 2× baseline em PR".

---

### S-08 · Aprovação manual JUR — fila com SLA não tem teste de aging

**Onde:** Sprint 8, Story 8.3 · **Impacto:** Médio.

**Problema:** PRD §9.1 define SLA 1 dia útil para aprovação JUR manual. Não há teste de cron que escala se ficar mais que SLA (deve criar alerta ao gestor JUR / admin).

**Ação sugerida:** AC: "Task de aprovação manual >1 dia útil em estado pendente gera evento `SLA_VIOLATED` + notification para `responsavel_juridico_id.gestor`. Teste com clock manipulado."

---

### S-09 · Realtime Supabase — teste de reconnect / fallback offline

**Onde:** Sprint 2, S2-R4 e Sprint 3, drag-drop realtime · **Impacto:** Médio.

**Problema:** Realtime depende de WebSocket persistente. Não há AC: "perda de conexão por 60s → reconnect automático; mudanças durante offline reconciliadas via snapshot fetch on reconnect".

**Ação sugerida:** Sprint 3 (que estabiliza padrão Realtime) ganha AC explícito de reconnect + reconciliação + teste E2E que mata WS via DevTools e valida estado consistente após 30s.

---

### S-10 · Cron `pg_cron` — teste em staging antes de prod ausente

**Onde:** Sprints 4 (refresh views), 7 (régua follow-up), 9 (régua cobrança) · **Impacto:** Médio.

**Problema:** DoD global não cita teste de cron. README pré-requisitos exige extensão `pg_cron` mas não diz "cada cron criado vai pra staging por 7d antes de virar prod".

**Ação sugerida:** Adicionar ao DoD global: "Job `pg_cron` em prod só após ≥7 dias rodando em staging com 0 falhas; runbook de pause/resume documentado".

---

### S-11 · Sprint 6 Postmark: rotação de chaves não tratada

**Onde:** Sprint 6, "Postmark integração" · **Impacto:** Médio (segurança).

**Problema:** Setup de Postmark menciona templates e bounce tracking mas não menciona estratégia de rotação de chaves API. Pré-requisito do brief é seguro por padrão.

**Ação sugerida:** AC: "Chave Postmark armazenada como Supabase Vault secret com TTL 90d; alerta @admin 14d antes de expirar".

---

### S-12 · Smoke E2E 10 fluxos críticos (PRD §17) — lista não está enumerada

**Onde:** Sprint 11, DoD · **Impacto:** Médio-Alto.

**Problema:** "Smoke E2E 10 fluxos críticos passando em prod" sem listar quais 10. Vai virar discussão no final.

**Ação sugerida:** Enumerar agora os 10 fluxos no `_review-qa.md` ou no `sprint-11`:
1. Login admin + MFA + logout
2. ZapSign Caminho A → cliente criado + caso ONBOARDING
3. Cliente sobe doc → OCR + status canônico atualizado
4. Pipeline Op drag-drop com gate inválido (bloqueia) e válido (transiciona)
5. Bifurcação IMPLANTADO → ELABORANDO_TERMO observada em UI
6. Elaborar Termo + Conferir + Aprovação automática + PDF gerado
7. Aceite Portal com 2FA + cobrança disparada (sandbox)
8. Webhook pagamento → status PAGA
9. Régua cobrança WhatsApp D-5 disparada
10. Export LGPD do titular (assumindo F-01 corrigido)

---

## Achados menores (NICE TO HAVE)

### M-01 · Densidade Kanban (compacto/padrão/confortável) persistir em `user_preferences`

Sprint 3 usa localStorage. Senior move: tabela `user_preferences` no Supabase para sincronizar entre devices. Pode entrar no Sprint 3 ou ficar para backlog.

### M-02 · Lighthouse Accessibility ≥95 só na rota `/login`

Sprint 1 cita só `/login`. Estender para todas as 4 rotas tocadas (`clientes`, `casos`, etc.).

### M-03 · Bundle size: < 1.2MB é arbitrário

Sprint 1, @devops. Documentar racional do limite (Cloudflare Workers 10MB - margem) em ADR.

### M-04 · OCR fallback Vision vs Tesseract

Sprint 5, ADR-005. Adicionar AC: "comparação de qualidade em 10 docs amostrais validada por Hyago antes da decisão default".

### M-05 · Drive sync: estratégia de conflito não definida

Sprint 5. Se cliente sobe via Portal e ao mesmo tempo via Drive direto, qual ganha? Adicionar ao ADR.

### M-06 · n8n workflows não têm versionamento testado em PR

Sprint 7. Workflows JSON em `n8n/workflows/` precisam ter validação de schema (json-schema) em CI.

### M-07 · ChatGuru templates pré-aprovados sem teste de fallback

Sprint 9. Se template não aprovado, sistema deve cair em texto simples — sem teste.

### M-08 · Mapa Brasil DGM (Sprint 11) com `react-simple-maps` — bundle pesado

Avaliar lazy load para evitar inchar Dashboard Operacional.

### M-09 · "Hyago aprovou amostra de 20 casos" sem registro auditável

Sprint 10. Adicionar tabela `migration_amostra_aprovacao` com `approved_by`, `approved_at`, `notes`.

### M-10 · CHANGELOG.md no `sistema-hv/` sem padrão

DoD global. Definir Keep-a-Changelog format desde Sprint 1.

---

## Stories sugeridas faltantes

| # | Story sugerida | Sprint sugerido | Justificativa |
|---|---|---|---|
| **NEW-01** | Bootstrap LGPD (consent_records explícito + helpers) | Sprint 1 | F-01 BLOCKER |
| **NEW-02** | Bootstrap Observabilidade (Sentry + Axiom + PostHog) | Sprint 1 | F-02 BLOCKER |
| **NEW-03** | Export LGPD do titular + revogação consent + retenção 5 anos | Sprint 9 ou 11 | F-01 BLOCKER |
| **NEW-04** | Rollback executável da migração + coexistência observável | Sprint 10 / 11 | F-05 BLOCKER |
| **NEW-05** | 4 canais de aceite com smoke por canal | Sprint 9 | F-04 BLOCKER |
| **NEW-06** | Imutabilidade Termo com trigger + teste pgTAP | Sprint 8 | F-03 BLOCKER |
| **NEW-07** | Performance baseline com k6 em CI | Sprint 1 | S-07 |
| **NEW-08** | Lista auditável de ações sensíveis (`auditable-actions.md`) | Sprint 1 | S-06 |
| **NEW-09** | Bifurcação concurrent test | Sprint 4 | S-04 |
| **NEW-10** | SLA aging para fila JUR + alerta gestor | Sprint 8 | S-08 |
| **NEW-11** | Realtime reconnect + reconcile snapshot | Sprint 3 | S-09 |
| **NEW-12** | DPO designado + e-mail dpo@ + SLA 15d | Sprint 11 (pré-go-live) | Master §12.3 |
| **NEW-13** | Status page interna em `dashboards.admin.tsx` | Sprint 11 | Já citado mas sem ACs |
| **NEW-14** | Backup automático Supabase + restore drill testado | Sprint 1 (configuração) + Sprint 11 (drill) | Brief uptime ≥99.5% |

---

## Cobertura de testes — análise por sprint

| Sprint | E2E Playwright | Integração | Unit | Performance | LGPD | Observabilidade | Status QA |
|---|---|---|---|---|---|---|---|
| **1 — Foundation** | OK (login) | RLS audit OK | Falta unit em helpers Auth | **Faltando** (S-07) | **Faltando** (F-01) | **Faltando** (F-02) | GAP |
| **2 — Clientes 360** | OK (CRUD) | RLS OK | Falta Zod CPF/CNPJ unit | OK (300ms p95) | Faltando | Implícito | GAP menor |
| **3 — Pipeline Op** | OK (drag-drop + gate) | Realtime parcial | Falta gate validation unit | OK (500ms) | n/a | Implícito | OK com S-09 |
| **4 — Pipeline Fin** | OK (bifurcação) | OK | Falta `next_action_financeiro` unit | OK (600ms — alto) | n/a | Implícito | OK com S-04 |
| **5 — Documentos** | OK (upload + OCR) | Drive OK | Falta hash determinístico unit | Falta (OCR 30s) | RLS Storage OK | Falta logs OCR | GAP |
| **6 — ZapSign + Portal V1** | OK 3 caminhos | OK | Falta HMAC validate unit | Falta mobile perf | **Falta consent banner** | Falta | GAP |
| **7 — POPs FIES** | OK (COVID end-to-end) | OK | Falta DGM follow-up date logic unit | n/a | Falta | Falta scraper alerts | GAP |
| **8 — Termo + Aprovação** | OK 2 cenários | OK | **Faltando 5 cenários neg + bordas** | n/a | Falta imutabilidade RLS | Métricas implícitas | **GAP CRÍTICO** (F-03, S-02, S-03) |
| **9 — Cobrança + Portal V2** | OK 1 canal Portal | OK | Falta adapter cobrança unit | n/a | Cita preferências sem AC | Falta | **GAP CRÍTICO** (F-01, F-04) |
| **10 — Migração + Hardening** | n/a | Dry-run OK | Falta script unit | OK (Lighthouse 90+) | Faltando teste retenção | Falta | **GAP CRÍTICO** (F-05) |
| **11 — Dashboards + Cutover** | OK (10 fluxos sem lista) | OK | Falta MV refresh unit | OK (citado) | Falta export final | Falta UptimeRobot pré-go-live | GAP (S-12, F-02) |

**Resumo:** Sprints 8, 9 e 10 são os mais expostos. Sprint 1 precisa absorver os 2 stories de observabilidade + LGPD bootstrap antes de qualquer outro sprint.

---

## Riscos não cobertos pelas mitigações do @pm

| # | Risco descoberto | Mitigação proposta |
|---|---|---|
| **QR-01** | **Bypass de RLS via service_role** — Edge Functions usam service_role e podem vazar dados se mal escritas. M-01 não cobre. | Lint rule custom: imports de `SUPABASE_SERVICE_ROLE_KEY` só permitidos em `supabase/functions/**`; PR review obrigatório por @architect quando service_role é usado. |
| **QR-02** | **Cron `pg_cron` falha silenciosa** — se cron falha, nenhum alerta nativo. | Wrap em função SQL que loga em `cron_run_log` + alerta via Edge Function se 2 runs consecutivos falham. |
| **QR-03** | **Supabase backup drill nunca testado** — recovery time desconhecido. | Story em Sprint 11: restaurar backup em projeto staging em <2h; documentar RPO/RTO real. |
| **QR-04** | **Cliente Portal: senha fraca aceita por padrão Supabase** | Configurar Password Policy mínima: 12 chars, 1 maiúscula, 1 número (Sprint 1 ou 6). |
| **QR-05** | **Token JWT longo demais permite reuso pós-logout** | TTL 30min + refresh; logout invalida no servidor (revoke). Sprint 1. |
| **QR-06** | **Race em UPDATE de macrostatus** — 2 usuários movem o mesmo caso simultaneamente. | OPTIMISTIC LOCKING via coluna `version` ou `updated_at` no WHERE. Sprint 3. |
| **QR-07** | **Edge Function timeout cascata** — geração PDF + OCR + upload em chain pode estourar | Decoupling via `case_outbox_events` queue + workers separados. Reforçar no Sprint 5. |
| **QR-08** | **Migração: encoding de Excel** — `UTF-8 BOM`, `ISO-8859-1`, etc. em planilhas reais | Detect encoding automaticamente via `chardet`; teste com 5 encodings. Sprint 10. |
| **QR-09** | **Webhook ZapSign sem retry policy nossa** — se nossa Edge cai, ZapSign retenta mas timing nosso é responsabilidade nossa | Idempotência + DLQ (dead letter queue em `webhook_failures`). Sprint 6. |
| **QR-10** | **DGM "sem_exito" pode acumular silenciosamente** — sem alerta global | Dashboard Admin (Sprint 11) inclui card "Casos sem_exito_dgm sem plano B definido" com SLA 7d. |

---

## Métricas de qualidade propostas

KPIs que QA vai monitorar durante a execução dos sprints:

| Métrica | Meta | Sprint onde começa a medir |
|---|---|---|
| Cobertura unit/integration (`vitest --coverage`) | ≥70% em arquivos novos; ≥85% em `lib/calculation/**` (Termo) | Sprint 1 |
| `axe-core` violations critical/serious por rota | 0 | Sprint 1 |
| Lighthouse Accessibility (rotas críticas) | ≥95 | Sprint 1 |
| Lighthouse Performance (rotas críticas) | ≥90 desktop, ≥80 mobile | Sprint 2 (estabelece baseline) |
| RLS cross-org leaks detectados em CI | 0 | Sprint 1 |
| Erros Sentry por dia em staging | <5 não tratados | Sprint 1 (após F-02) |
| P95 latência queries de pipeline | ≤500ms (brief KPI) | Sprint 3 |
| Taxa de auto-aprovação Termo (PRD §11.2) | 70-85% | Sprint 8 |
| Taxa de reversão Termo (PRD §11.2) | ≤10% | Sprint 8 |
| Bugs P0 abertos > 24h | 0 | Sprint 2 |
| Dry-run migração sucesso rate | ≥99% (corrigido vs 95% atual) | Sprint 10 |
| Cobertura E2E dos 10 fluxos críticos (lista S-12) | 100% | Sprint 11 |
| Uptime de UptimeRobot em prod | ≥99.5% (brief KPI) | Sprint 11 |
| LGPD export end-to-end < 5min para 1 cliente | <5min | Sprint 9 ou 11 |
| Audit log entries por ação sensível | exatamente 1 por ação (sem dup, sem miss) | Sprint 1+ |

---

## Recomendação final

**Veredito: APROVADO COM RESSALVAS.**

O plano F4 é estruturalmente competente e demonstra senioridade no sequenciamento. **Pode-se iniciar o Sprint 1 APÓS** as seguintes ações obrigatórias:

1. **Adicionar Stories F4-1.5 (LGPD Bootstrap) e F4-1.6 (Observabilidade Bootstrap) ao Sprint 1** — corrige F-01 e F-02 BLOCKERs. Pode adicionar 1-2 dias úteis ao Sprint 1 (estimativa nova: 13-14d em vez de 12d).
2. **Confirmar que `consent_records` está na lista explícita de migrations do Sprint 1** (texto atual não confirma).
3. **Reescrever DoD do Sprint 10** com critério ≥99% IMPORTED + categorização de SKIPPED + 3 dry-runs gates.
4. **Adicionar nova Story 10.3 (Rollback executável)** no Sprint 10.
5. **Expandir DoD do Sprint 8** com teste pgTAP de imutabilidade (não apenas E2E).
6. **Expandir Story 8.5 do Sprint 9** com 4 ACs separados por canal de aceite.

Os SHOULD-FIX (S-01 a S-12) podem ser tratados como issues abertas no início de cada sprint correspondente — não bloqueiam o início mas devem ser fechados antes do "Sprint Review" multi-agente do respectivo sprint. NICE-TO-HAVE (M-01 a M-10) entram no backlog do sprint correspondente.

A qualidade do plano é **acima da média** comparada a projetos similares que vi falhar no Sprint 4-5 por falta exatamente das lacunas listadas em F-01 e F-02 (cliente descobre que não consegue atender solicitação LGPD em produção, ou descobre que não sabe diagnosticar incidente porque não tem Sentry). Endereçando os 5 BLOCKERs, o plano fica em condição de execução com risco controlado.

**Aprovação condicionada** a Hyago + @pm John responderem aos 5 BLOCKERs em uma rodada de ajustes (estimo 1 dia útil de revisão do plano + atualização dos arquivos do Sprint 1 e Sprint 10).

---

> _Revisão executada sob lente QA senior. Encontrar problemas agora é mais barato que descobrir no Sprint 5._
> _— @qa Quinn, Test Architect, sob coordenação do Orion 🎯_
