# Follow-ups — SHOULD-FIX e NICE-TO-HAVE adiados (v1.1)

> Itens identificados nos reviews `_review-qa.md` e `_review-architect.md` que **não entraram no Sprint 1 v1.1** mas devem ser endereçados conforme cada sprint se aproxima.
>
> Cada item: ID original · descrição curta · sprint sugerido · esforço estimado · ação concreta.

---

## Sprint 2 — Clientes (CRUD + 360°)

| ID | Descrição | Esforço | Ação |
|---|---|---|---|
| QA S-09 (parcial) | Realtime: estratégia de subscribe/unsubscribe e cost-control | 0.5d | Aplicar padrão definido em ADR-011 (Sprint 1) na lista de Clientes; cleanup em `useEffect` |
| QA M-02 | Lighthouse Accessibility ≥95 em todas as rotas tocadas | 0.25d | Estender testes axe + Lighthouse para `/clientes`, `/clientes/:id` |
| Architect S-04 | Streaming/Suspense TanStack Start com Supabase queries | 0.5d | 1 PR de exemplo com `/clientes` antes de replicar; documentar padrão |

---

## Sprint 3 — Casos + Pipeline Operacional

| ID | Descrição | Esforço | Ação |
|---|---|---|---|
| QA S-09 | Realtime reconnect + reconcile snapshot | 0.5d | E2E que mata WS via DevTools e valida estado consistente após 30s |
| QA NEW-11 | Realtime reconnect snapshot (story sugerida) | embutido em S-09 | Implementar reconnect handler + snapshot fetch |
| QA M-01 | Densidade Kanban persistir em `user_preferences` | 0.5d | Migration + endpoint; substituir localStorage |
| QA QR-06 | Race em UPDATE de macrostatus (optimistic locking) | 0.5d | Coluna `version` em `cases`; rejeitar UPDATE se versão divergir |
| Architect M-08 | Drag-drop conflict resolution | 0.5d | Definir: last-write-wins via `updated_at`; documentar no sprint |

---

## Sprint 4 — Pipeline Financeira + Views

| ID | Descrição | Esforço | Ação |
|---|---|---|---|
| QA S-04 | Bifurcação concurrent test | 0.5d | Teste pgTAP `test_bifurcacao_concurrent.sql` |
| QA NEW-09 | Bifurcação concurrent test (story sugerida) | embutido em S-04 | 2 sessões `BEGIN; UPDATE; COMMIT;` paralelas |
| Architect P3 gap | CHECK garantindo macrostatus_financeiro só sai NAO_APLICAVEL via bifurcação | 0.25d | CHECK na migration 004 ou trigger |
| Architect S-05 | MV refresh policy + CONCURRENTLY + alerting | 0.5d | ADR-012 + UNIQUE index em cada MV |

---

## Sprint 5 — Documentos + Geradores

| ID | Descrição | Esforço | Ação |
|---|---|---|---|
| QA M-04 | OCR fallback Vision vs Tesseract | 0.5d | Comparação 10 docs amostrais validada por Hyago antes do default; ADR-005-OCR (renomear se conflitar) |
| QA M-05 | Drive sync estratégia de conflito | 0.25d | Definir last-write-wins ou rejeição; documentar no ADR |
| QA QR-07 | Edge Function timeout cascata | 0.5d | Reforçar uso de `case_outbox_events` queue; workers separados |
| Architect M-04 | Storage RLS testado em audit-rls.ts | 0.5d | Estender `audit-rls.ts` com cenários Storage |
| Architect A-06 | Egress Supabase ao servir 30GB PDFs | 0.5d | Signed URL + redirect Cloudflare R2 |

---

## Sprint 6 — Onboarding ZapSign + Portal V1

| ID | Descrição | Esforço | Ação |
|---|---|---|---|
| QA S-01 | Webhook ZapSign idempotência teste de carga | 0.5d | 5 chamadas paralelas mesmo `doc_id` → 1 caso + 4 retornos 200 skip |
| QA S-11 | Postmark rotação de chaves | 0.25d | Supabase Vault secret + TTL 90d + alerta 14d antes |
| QA QR-04 | Senha cliente Portal: política mínima | 0.25d | Configurar Password Policy Supabase para Portal users também |
| QA QR-09 | Webhook ZapSign retry + DLQ | 0.25d | Tabela `webhook_failures` para DLQ (já temos `webhook_dedupe`) |
| Architect ADR-014 | Assinatura digital: ZapSign vs Clicksign vs DocuSign | 0.5d | ADR antes do Sprint 6 começar |

---

## Sprint 7 — POP FIES_COVID + DGM

| ID | Descrição | Esforço | Ação |
|---|---|---|---|
| QA M-06 | n8n workflows versionamento testado em PR | 0.5d | Validação JSON schema em CI |
| Architect ADR-010 | Scraping headless: Playwright VPS + retry + captcha + alerting | 0.5d | ADR antes do Sprint 7 começar |
| QA NEW-13 (parcial) | DGM follow-up date logic unit test | 0.25d | Unit test em `evaluate-dgm-followup.test.ts` |

---

## Sprint 8 — Termo de Acerto + Aprovação Híbrida

| ID | Descrição | Esforço | Ação |
|---|---|---|---|
| QA F-03 / Architect S-01 | Imutabilidade Termo: trigger pgTAP via service role | já embutido no Sprint 1 (Story 1.1 + migration 003c) | Validar E2E no Sprint 8 |
| QA S-02 | Auto-aprovação Termo: 7 critérios em testes individuais | 0.5d | Tabela com 7 linhas (1 critério false por vez) + 1 tudo-true |
| QA S-03 | Cálculo Termo: 30 casos + 8 bordas + 3 suspensão = 41 testes | 1d | `termo-calculation.test.ts` com 41 cenários; falha bloqueia merge |
| QA S-08 | SLA aging fila JUR + alerta gestor | 0.5d | Cron + evento `SLA_VIOLATED` + notification |
| QA NEW-06 | Imutabilidade Termo trigger + pgTAP | embutido no Sprint 1 v1.1 | Validar funciona em fluxo real Sprint 8 |
| Architect S-01 | Hash verificado na geração + visualização Portal | 0.5d | Assert no momento de gerar PDF; verificar a cada visualização |

---

## Sprint 9 — Cobrança + Conta Azul/Asaas + Portal V2

| ID | Descrição | Esforço | Ação |
|---|---|---|---|
| QA F-04 | 4 canais de aceite com smoke por canal | 1d | Expandir Story 8.5 com 4 ACs separados |
| QA F-01 (parte 2) | Export LGPD ZIP do titular (Master §12.3) | 1d | Estende Story 1.5 com export ZIP completo + tela admin de gestão |
| QA M-07 | ChatGuru templates: teste de fallback texto simples | 0.25d | Mock template não aprovado → cai em texto |
| Architect S-02 | LGPD ops: tela admin gestão consentimentos | 1d | Tela em `configuracoes.tsx` |
| Architect ADR-013 | Conta Azul + Asaas auto-detecção vs único provider | 0.5d | ADR antes do Sprint 9; Hyago decide |
| Architect ADR-008 | Provider 2FA SMS para Portal | 0.5d | ADR antes do Sprint 9 |

---

## Sprint 10 — Migração + Hardening

| ID | Descrição | Esforço | Ação |
|---|---|---|---|
| QA F-05 (parte 1) | Reescrever DoD: ≥99% IMPORTED + 5 categorias SKIPPED + 3 dry-runs gates | 0.5d | Editar Sprint 10 DoD; revisar com Hyago |
| QA F-05 (parte 2) | Story 10.3 Rollback executável + script + ADR-009 | 1d | `scripts/rollback-migration.ts` testado em staging <30min |
| QA M-09 | Tabela `migration_amostra_aprovacao` para auditar amostras | 0.25d | Migration + endpoint |
| QA QR-08 | Migração encoding Excel (UTF-8 BOM, ISO-8859-1, etc.) | 0.5d | `chardet` + teste com 5 encodings |
| Architect P9 gap | Estratégia "quem é fonte de verdade durante coexistência" | 0.25d | Definir no Sprint 10 + comunicar para Hyago |

---

## Sprint 11 — Dashboards + Cutover

| ID | Descrição | Esforço | Ação |
|---|---|---|---|
| QA F-05 (parte 3) | Coexistência observável: script diário Excel vs Supabase | 0.5d | Cron + alerta @admin se divergência |
| QA F-02 (parte 2) | UptimeRobot configurado ANTES do switch DNS | já no Sprint 1 v1.1 | Validar que está ativo em prod |
| QA S-12 | Enumerar 10 fluxos críticos no Sprint 11 | 0.25d | Lista já está em `_review-qa.md` §S-12; copiar para Sprint 11 DoD |
| QA NEW-12 | DPO designado + e-mail dpo@ + SLA 15d | já em pré-requisitos | Validar no go-live |
| QA NEW-13 | Status page interna `dashboards.admin.tsx` | 1d | Cards: UptimeRobot, Sentry errors, queue lag, etc. |
| QA NEW-14 | Backup automático Supabase + restore drill | 0.5d | Restore em projeto staging em <2h; documenta RPO/RTO real |
| QA QR-10 | DGM sem_exito acumula silenciosamente | 0.25d | Card no Dashboard Admin com SLA 7d |
| QA M-08 | Mapa Brasil DGM com lazy load | 0.25d | `React.lazy` no componente Map |
| Architect ADR-017 | Backup + DR Supabase runbook | 0.5d | Documenta PITR + snapshot frequency + RTO/RPO |

---

## Cross-sprint (DoD global ou várias sprints)

| ID | Descrição | Sprint aplicação | Esforço |
|---|---|---|---|
| QA S-06 | Lista exaustiva ações sensíveis (`auditable-actions.md`) | **já criada no Sprint 1 v1.1** | embutido |
| QA S-10 | Cron `pg_cron` teste em staging 7d antes de prod | DoD global + cada sprint que cria cron | 0d (regra) |
| QA NEW-08 | Lista auditável de ações sensíveis (story sugerida) | já no Sprint 1 v1.1 | embutido |
| Architect ADR-011 | Realtime padrão | **já criada como pendência Sprint 1 v1.1 (escopo S-03)** | embutido |
| Architect ADR-015 | Cache strategy (CDN + Postgres + React Query) | Sprint 1 (criar) / aplicar contínuo | 0.5d |
| Architect M-01 | `pgvector` versão pinada + justificativa | ADR-001 (já criado) | 0d |
| Architect M-02 | Ferramenta de teste para Edge Functions Deno | Sprint 1 doc | 0.25d |
| Architect M-03 | Painel `/hoje` agrega múltiplas tabelas — quem implementa? | Sprint 3 ou 4 | 0.5d |
| Architect M-05 | Idempotência cron jobs `pg_cron` (`cron_run_log` UNIQUE) | já no Sprint 1 v1.1 | embutido |
| Architect M-07 | Convite e-mail Supabase pode cair em spam | doc na Story 1.4 | 0d (aviso) |
| Architect ADR-016 | IA estratégia (futura, Projeto 3) | Pré-Projeto 3 | 0d |

---

## Riscos arquiteturais a monitorar (não viram tasks ainda)

| ID | Risco | Trigger para virar task |
|---|---|---|
| Architect A-01 | Vendor lock-in Supabase | Se Supabase mudar pricing antes do go-live |
| Architect A-02 | Custo Supabase ao crescer | Billing alert > $80/mês em prod |
| Architect A-03 | Cold start Cloudflare Workers | TTFB `/login` > 300ms em UptimeRobot |
| Architect A-04 | Limites Cloudflare Free | > 80K req/dia em prod (sinal para migrar para Paid) |
| Architect A-05 | Backup/DR Supabase RTO/RPO desconhecido | Sprint 11 drill obrigatório |
| Architect A-07 | Determinismo PDF cross-environment | Teste CI gera 2 PDFs e compara — adicionar Sprint 8 |
| Architect A-10 | TanStack Start 1.x evolui rápido | Pinar versão exata; subscrever changelog |

---

> _Owner: @pm John · Atualize este arquivo ao iniciar cada sprint, marcando o que entra em scope e o que continua adiado._
