# Sprints F4 — Plataforma Unificada + Sistema FIES (Projeto 1)

> **Fase F4 do roadmap** — Aplicar lógica + backend Supabase sobre o layout Lovable já implementado.
> **Owner do plano:** @pm John · **Orquestração:** Orion (aios-master)
> **Versão:** 1.1 · **Data:** 2026-05-20 · **Status:** Aprovado com ressalvas (5 BLOCKERs endereçados — ver `CHANGELOG.md`)
>
> **Mudança v1.0 → v1.1:** Sprint 1 cresceu de 12d → 17d para incorporar Stories 1.5 (LGPD bootstrap), 1.6 (Observabilidade), 1.7 (VPS Hetzner + n8n + LibreOffice + Playwright). Stories 1.1 e 1.3 ganharam `case_outbox_events` + CHECK `elaborador ≠ conferidor` + trigger imutabilidade. Reviews em `_review-qa.md` (Quinn) e `_review-architect.md` (Winston).

---

## Contexto

- **Layout pronto:** `sistema-hv/` (TanStack Start + TanStack Router + Vite + Cloudflare + Tailwind v4 + shadcn/ui). 53 rotas em `src/routes/`, rodando em `localhost:8080`. **Não tocar no visual.**
- **Backend a construir:** Supabase (Postgres + Auth + RLS + Storage + Realtime + Edge Functions).
- **PRD-fonte:** `docs/prd/01-plataforma-fies.md` (épicos 1-11). Substrato em `docs/prd/master-platform.md` (17 tabelas globais, RLS, motor de eventos).
- **Sprints antigos (`docs/sprints/`)** foram da Fase F2 (construir frontend Next.js). **Obsoletos**. Esta pasta `docs/sprints-f4/` é a sucessora.

---

## Visão geral do plano

| Métrica | Valor |
|---|---|
| Sprints totais | **11** |
| Duração média por sprint | **8-10 dias úteis** (Sprint 1 é 17d) |
| Duração total estimada | **~100-115 dias úteis (~5-5.5 meses calendário)** |
| Épicos cobertos | **11 (épicos 1-11 do PRD 1)** |
| Stories detalhadas em ACs | Sprint 1 (4 stories) + esqueleto das demais |
| Telas tocadas | 53 (mais as do Portal: 7) |
| Integrações externas | 9 (ZapSign, Drive, Gmail, Postmark, Conta Azul, Asaas, ChatGuru, SEI, Gov.br) |
| Migração | 1 sprint dedicado (~2.500 casos) |

### Justificativa da quantidade

11 sprints alinhados 1:1 com os 11 épicos do PRD 1 facilita rastreabilidade e accountability. O sprint 1 é mais denso (fundação) e o último (migração + go-live) também — todos os demais ficam num ritmo previsível de 8-10 dias úteis. Estourar pra 13-14 sprints fragmentaria épicos pequenos e diluiria o foco; comprimir para 6-7 sprints empacotaria responsabilidades demais por janela e mataria a previsibilidade.

---

## Tabela de sprints

| # | Nome | Foco | Épicos PRD 1 | Stories PRD 1 | Dias úteis | Status |
|---|---|---|---|---|---|---|
| **1** | [Supabase Foundation](./sprint-01-supabase-foundation.md) | Schema global + FIES + RLS + Auth real + LGPD bootstrap + Observabilidade + VPS Hetzner (n8n + LibreOffice + Playwright) + CI/CD | Épico 1 + LGPD + Observabilidade | 1.1, 1.2, 1.3, 1.4 (parcial), 1.5 (NOVO), 1.6 (NOVO), 1.7 (NOVO) | 17 | Próximo |
| **2** | [Clientes (CRUD + 360°)](./sprint-02-clientes-360.md) | CRUD Cliente, Ficha 360° 5 abas, alertas, sync Drive básico, busca fuzzy | Épico 2 | 2.1, 2.2, 2.3 | 9 | Pendente |
| **3** | [Casos + Pipeline Operacional](./sprint-03-casos-pipeline-op.md) | CRUD Caso, Pipeline Op (10 colunas + Kanban + gates), Ficha Caso (2 rastros), realtime | Épico 3 (op) | 3.1, 3.2, 3.4 (parcial) | 10 | Pendente |
| **4** | [Pipeline Financeira + Views](./sprint-04-pipeline-financeira.md) | Pipeline Fin (15 colunas), 8 views complementares, bifurcação automática, Ficha Caso (rastro fin) | Épico 3 (fin) | 3.3, 3.4 (final) | 8 | Pendente |
| **5** | [Documentos + Geradores](./sprint-05-documentos.md) | Upload + Storage + OCR + canônicos por tipo + geração Declaração COVID + DGM + Drive sync completo | Épico 4 | 4.1, 4.2, 4.3, 4.4 | 10 | Pendente |
| **6** | [Onboarding ZapSign + Portal V1](./sprint-06-zapsign-portal.md) | Webhook ZapSign (Caminhos A/B/C), Portal Cliente (login, home, casos, docs, boletos) | Épicos 5 + 9 | 5.1, 5.2, 5.3, 9.1, 9.2, 9.4, 9.5 | 10 | Pendente |
| **7** | [POP FIES_COVID + FIES_ESF_DGM](./sprint-07-pops-fies.md) | Régua follow-up, QA Declaração COVID, requerimento + gov.br, SEI scraper, decisão MS, escalação judicial, DGM workflow | Épicos 6 + 7 | 6.1-6.6, 7 (DGM particularidades) | 12 | Pendente |
| **8** | [Termo de Acerto + Aprovação Híbrida](./sprint-08-termo-acerto.md) | Wizard cálculo, snapshot imutável, conferência (segregação RLS), aprovação automática vs manual, PDF, hash | Épico 8 (parcial) | 8.1, 8.2, 8.3 | 9 | Pendente |
| **9** | [Cobrança + Conta Azul/Asaas + Portal V2](./sprint-09-cobranca-portal.md) | Apresentação, aceite (4 canais), API cobrança, parcelas, régua, inadimplência, renegociação; Portal: aceite Termo + mensagens + perfil | Épico 8 (final) + Portal V2 | 8.4-8.8, 9.3, ChatGuru | 10 | Pendente |
| **10** | [Migração + Hardening](./sprint-10-migracao-hardening.md) | Script Excel→canônico, dry-run, validação, dashboard erros, importação dos 2.500 casos em staging, retesteação E2E | Épico 10 | 10.1, 10.2 | 10 | Pendente |
| **11** | [Dashboards + Cutover Produção](./sprint-11-dashboards-cutover.md) | Materialized views, dashboards Op/Fin/Admin, smoke E2E final, migração prod, treinamento equipe, go-live oficial | Épico 11 + DoD §17 | 11.1, 11.2, 11.3 | 10 | Pendente |

**Total:** ~115 dias úteis (~23 semanas). Inclui buffer de 10% por sprint para validação multi-agente + revisão.

---

## Princípios do plano (não negociáveis)

1. **Risco descendente** — Sprint 1 valida Supabase + Auth + RLS antes de qualquer feature. Se a base falhar, paramos.
2. **Valor incremental** — Ao fim do Sprint 2 já se cadastra um cliente real e vê na tela. Ao fim do Sprint 3 já se cria caso e move pipeline. Stakeholder vê progresso quinzenalmente.
3. **Migração tardia** — Os 2.500 casos só entram no Sprint 10, depois do schema estar 100% estável.
4. **Integrações isoladas** — Cada integração tem um sprint (ou meio-sprint) dedicado. Falhas de API externa não bloqueiam features paralelas.
5. **Portal paralelizável** — Portal Cliente V1 (Sprint 6) e V2 (Sprint 9) usam o mesmo schema; podem ser desenvolvidos em paralelo por sub-time se houver capacidade.
6. **Dashboards por último** — Só fazem sentido com dados reais migrados.
7. **Lovable é intocável** — Conectamos lógica em telas existentes. Nenhuma story do plano cria UI nova; apenas troca mock → real ou adiciona estado.

---

## Ritual de validação multi-agente

> **Obrigatório ao fim de cada sprint antes do próximo começar.**

```
@pm John         valida stories/ACs cumpridos + cobertura PRD 1 §6
@architect       valida decisões técnicas (RLS, migrations, integrações)
@dev             valida qualidade do código (testes, padrões, sem any/console.log)
@qa              executa Definition of Done global + axe + Lighthouse
@devops          valida CI/CD, migrations idempotentes, secrets, observabilidade
@po (Hyago)      sign-off de negócio quando aplicável (fluxos, regras, exceções)
```

Aprovação dos 5 técnicos + sign-off de @po quando o sprint tem entregável visível para Hyago.

---

## Definition of Done global (toda story de todo sprint)

### Código
- [ ] CI verde: `lint` + `typecheck` + `test`
- [ ] Zero `any`, zero `console.log` em código de produção
- [ ] Cobertura unit/integration ≥ 70% nos arquivos novos
- [ ] PR revisado por outro dev (ou @dev agent em modo review)

### Backend / Supabase
- [ ] Migration idempotente (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`)
- [ ] RLS policy criada **e** testada com script de auditoria (usuário X NÃO vê dados de org Y)
- [ ] Trigger / função PL/pgSQL coberta por teste em `pgTAP` ou equivalente
- [ ] Edge Function com timeout, retry e logs estruturados

### Frontend (sistema-hv)
- [ ] Telas continuam pixel-identical ao Lovable (nenhuma alteração de classe Tailwind sem aprovação @ux)
- [ ] Estados: loading, empty, error, success implementados
- [ ] Realtime onde aplicável (assinatura Supabase Realtime testada)
- [ ] React Query keys consistentes e invalidação correta após mutations

### Segurança & LGPD
- [ ] Nenhum dado sensível em logs
- [ ] Audit log preenchido para ações sensíveis (transição macrostatus, aceite Termo, override admin)
- [ ] Soft-delete + restore para entidades reguladas (cliente, caso, doc)

### Testes
- [ ] Smoke E2E (Playwright) do happy-path da story
- [ ] Teste de RLS: usuário sem permissão recebe 403/empty
- [ ] Teste de gate: transição inválida bloqueada com mensagem clara

### Documentação
- [ ] Story file atualizado com status `[x]` em cada AC
- [ ] `docs/sprints-f4/sprint-XX-*.md` atualizado com File List + decisões
- [ ] CHANGELOG.md no `sistema-hv/` com referência à story
- [ ] ADR criado se houve decisão arquitetural relevante (`docs/architecture/adr-NNN-*.md`)

---

## Pré-requisitos do Sprint 1 (contas, credenciais, infraestrutura)

> Tudo abaixo é **bloqueante** — sem isso, Sprint 1 não inicia. Cada item indica **quem deve providenciar** e **onde a key/secret deve ser armazenada**.

### Credenciais e contas necessárias (checklist para Hyago)

| Serviço | Necessário no | Quem cria/paga | Onde guarda | Plano sugerido |
|---|---|---|---|---|
| **Supabase** | Sprint 1 | Hyago (login `hyagoviana.adv@gmail.com`) | GitHub Secrets `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET` | **Pro** ($25/mês × 2 projetos = $50) — Architect §"Recomendações" item 2 |
| **Cloudflare** | Sprint 1 | Hyago | Wrangler local + GitHub Secret `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | Free para staging; Workers Paid ($5/mês) em prod |
| **Hetzner Cloud** | Sprint 1 (Story 1.7) | Hyago | `.env` na VPS + 1Password / Vault | CX22 ARM (€7/mês) ou x86 (€15/mês) |
| **Sentry** | Sprint 1 (Story 1.6) | Hyago | GitHub Secret `SENTRY_DSN_FRONT`, `SENTRY_DSN_EDGE`, `SENTRY_AUTH_TOKEN` (source maps) | Free 5K eventos/mês — sobe para Team $26 em prod |
| **PostHog** | Sprint 1 (Story 1.6) | Hyago | GitHub Secret `POSTHOG_KEY`, `POSTHOG_HOST` | Cloud free (1M eventos/mês) |
| **Logtail (Better Stack)** | Sprint 1 (Story 1.6) | Hyago | GitHub Secret `LOGTAIL_SOURCE_TOKEN` | Free 1GB/mês |
| **UptimeRobot** | Sprint 1 (Story 1.6) | Hyago | Conta + IDs dos monitores (não precisa em CI) | Free (50 monitores) |
| **GitHub** | Sprint 1 | Hyago | GitHub Secrets configurados; CODEOWNERS | Free/Team |
| **Domínio `hyagoviana.adv.br`** | Sprint 1 | Hyago | DNS via Cloudflare; subdomínios `app.`, `portal.`, `n8n.`, `api.` | Já adquirido (confirmar) |
| **Postmark** | Sprint 6 | Hyago | GitHub Secret `POSTMARK_SERVER_TOKEN` | Starter $15/mês |
| **ZapSign** | Sprint 6 | Hyago | GitHub Secret `ZAPSIGN_API_TOKEN`, `ZAPSIGN_HMAC_SECRET` | Sandbox + plano por uso |
| **Conta Azul** OU **Asaas** | Sprint 9 | Hyago decide (ADR-013) | GitHub Secret correspondente | Sandbox grátis; prod via Hyago |
| **ChatGuru** | Sprint 9 | Hyago | GitHub Secret `CHATGURU_API_TOKEN` | Sandbox grátis |

**Total custo mensal infraestrutura prod (estimado):** ~R$430/mês ($75 Supabase + $5 Cloudflare + R$110 Hetzner + R$50 Logtail Pro futuro + R$130 Sentry Team futuro + R$75 Postmark = R$430).

### Repositório
- [ ] Branch `develop` criada como base de PRs do plano F4
- [ ] Branch protection regras em `main` (PR + 1 review + CI verde obrigatório)
- [ ] `.github/workflows/ci.yml` criado (será detalhado no Sprint 1)
- [ ] `.github/CODEOWNERS` definido com responsáveis por subpastas (não apenas @hyago global)

### Ferramentas locais (devs)
- [ ] Supabase CLI instalado (`npm i -g supabase`)
- [ ] Docker Desktop rodando (para `supabase start` local)
- [ ] Wrangler instalado (`npm i -g wrangler`)
- [ ] Acesso ao `psql` para auditoria pontual
- [ ] Acesso SSH à VPS Hetzner

### Variáveis de ambiente
- [ ] `.env.example` no `sistema-hv/` com todas as chaves listadas na tabela acima
- [ ] GitHub Secrets configurados para CI (staging + prod separados)
- [ ] **Service Role Key isolada** — pre-commit hook bloqueando string que parece service key (atende Architect A-09)

### Dados e legais
- [ ] Excel `FIES.xlsx` (~2.500 linhas) anonimizado/copiado para `/data/` (não comitar)
- [ ] LGPD: Política de Privacidade v1.0.0 validada pelo Hyago (vai para `docs/legal/`)
- [ ] DPO designado e e-mail `dpo@hyagoviana.adv.br` criado (atende QA NEW-12)
- [ ] Mapeamento de roles do escritório validado (admin, comercial, adm, ope, jur, fin, advogado_associado)

### Sign-off humano
- [ ] Hyago revisou e aprovou este plano F4 v1.1 (com 5 BLOCKERs endereçados)
- [ ] Hyago alocou capacidade do time (quem trabalha em quê)
- [ ] Hyago decidiu: Conta Azul OU Asaas (ou ambos com auto-detecção) — ADR-013

---

## Spikes técnicos pré-Sprint 1 (4 dias úteis em paralelo)

> Investigações **timeboxed** com produto técnico (ADR, exemplo funcional, ou veto). **SP-01, SP-03 e SP-04 são bloqueantes** — se falham, parte do plano F4 precisa ser redesenhado. Atende Architect §"Spikes técnicos".

| # | Spike | Timebox | Owner | Plano de execução | Output |
|---|---|---|---|---|---|
| **SP-01** | `@supabase/ssr` em TanStack Start + Cloudflare Workers | 1 dia útil | Tech Lead | Criar branch `spike/ssr-tanstack`; deploy hello-world em Cloudflare; testar login + sessão httpOnly + 1 query RLS protegida | **BLOQUEANTE.** ADR-002 finalizado com PASS/FAIL. Se FAIL → avaliar Hono ou Next.js (custa 2-3 sprints) |
| **SP-02** | Bundle size do `sistema-hv/` com supabase-js + react-query + recharts | 0.5 dia útil | DevOps | Adicionar deps no branch + rollup-plugin-visualizer + build prod | Bundle analyzer reportado. Decisão: Workers Free OK / Paid necessário / code-splitting agressivo |
| **SP-03** | LibreOffice headless gera Termo PDF determinístico | 0.5 dia útil | Backend | Container Docker pinado com fontes; gerar 5 PDFs do mesmo DOCX; comparar SHA-256 | **BLOQUEANTE.** Aprovar ADR-006 se hashes idênticos. Se FAIL → Cloud Run + Puppeteer com fontes pinadas (revisão Sprint 8) |
| **SP-04** | Playwright Gov.br: login + protocolar 1 doc teste | 1 dia útil | Backend | Workflow n8n + Playwright no container; usar conta sandbox de Hyago | **BLOQUEANTE.** Documenta CAPTCHA frequency + expiração de sessão. Se FAIL → Sprint 7 vira input manual exclusivo |
| **SP-05** | Supabase Realtime sob carga (30 conexões + 1 UPDATE/s) | 0.5 dia útil | DevOps | Script Node simulando carga; medir egress | Confirma limite Free/Pro. Documenta em ADR-001 |
| **SP-06** | Custom claims via Auth Hook colocam `organization_id` + `roles[]` no JWT | 0.5 dia útil | Tech Lead | Edge Function Auth Hook em staging; decode JWT | **Pré-requisito da RLS do Sprint 1.** PASS é obrigatório |
| **SP-07** | Dicionário tsvector PT-BR no Supabase | 0.5h | Backend | Conectar via psql e rodar `SELECT to_tsvector('portuguese', 'teste de busca')` | Confirma `case_documents.ocr_text` viável para Sprint 5 (atende Architect M-06) |

**Total:** 4 dias úteis em paralelo por 2 devs = ~2-3 dias calendário. **Investimento que evita 10-15 dias de retrabalho.**

**Cronograma sugerido:** Semana de 2026-05-21 dedicada aos spikes + ADRs (003, 004, 005, 006). Sprint 1 oficial começa segunda-feira seguinte após sign-off Hyago.

---

## Gates entre sprints (critérios objetivos para "Sprint N+1 pode começar")

> Atende QA "acrescentar gates entre sprints no README".

| Gate | Critério mensurável |
|---|---|
| **Sprint 1 → 2** | RLS audit 100% verde + Sentry/PostHog/UptimeRobot recebendo eventos + n8n acessível + LGPD export funcional + CHECK `elaborador ≠ conferidor` testado via service role |
| **Sprint 2 → 3** | CRUD Cliente E2E + Realtime reconnect testado + busca fuzzy ≤300ms P95 |
| **Sprint 3 → 4** | Pipeline Op drag-drop com gates inválidos bloqueando + bifurcação Op→Fin observada em UI |
| **Sprint 4 → 5** | 8 MVs com refresh testado + `bifurcação_automatica` cobertura 100% pgTAP |
| **Sprint 5 → 6** | OCR PDF/DOCX funcional + Drive sync 2-way + ADR-005 (OCR) finalizado |
| **Sprint 6 → 7** | 3 caminhos ZapSign E2E + Portal V1 login + boletos visíveis |
| **Sprint 7 → 8** | Régua FIES_COVID disparando + Gov.br/SEI scraping operacional ou plano B manual definido |
| **Sprint 8 → 9** | Auto-aprovação Termo com 70-85% taxa em amostra Hyago + imutabilidade testada via service role |
| **Sprint 9 → 10** | 4 canais de aceite funcionais + adapter Cobrança Conta Azul OU Asaas + régua disparando |
| **Sprint 10 → 11** | Migração ≥99% IMPORTED em staging + rollback script testado + amostra 50 validada por Hyago |
| **Sprint 11 → Go-live** | Smoke E2E 10 fluxos críticos verde + UptimeRobot configurado em prod + treinamento equipe + janela cutover marcada |

---

## Riscos macro do plano (cross-sprint)

| # | Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|---|
| **M-01** | RLS mal configurada vaza dados entre orgs | Média | **Crítico** | Sprint 1 dedica capacidade a testes de RLS; auditoria automatizada em CI |
| **M-02** | Lovable layout não acomoda algum estado/campo novo | Média | Médio | Cada sprint identifica gaps na review de arquitetura; @ux negocia ajustes mínimos pontuais |
| **M-03** | Gov.br/SEI scraping quebra com mudança de site | Alta | Médio | Adapter isolado; contingência: input manual de NUP + alerta |
| **M-04** | Migração dos 2.500 casos tem dados inconsistentes | Alta | Alto | Dry-run obrigatório no Sprint 10; coexistência Excel + sistema por 30d |
| **M-05** | Aprovação automática Termo diverge da intenção JUR | Média | Alto | Critérios conservadores no Sprint 8; métrica de reversão monitorada por 60d |
| **M-06** | ZapSign Caminho C (inconsistência) gera fila não tratada | Baixa | Médio | Sprint 6 cria SLA: tarefa URGENTE + notificação imediata + fallback bloqueia criação |
| **M-07** | Cliente recusa Portal e exige WhatsApp/presencial | Alta | Baixo | PRD já prevê 4 canais de aceite no Sprint 9 |
| **M-08** | Time fica bloqueado em sprint anterior, atrasa cascata | Média | Alto | Buffer 10% por sprint; replanejamento na Sprint Review se algo escorrega |
| **M-09** | Migração de schema em prod com dados ativos quebra | Baixa | **Crítico** | Migrations testadas em staging com snapshot prod; janela de manutenção no Sprint 11 |
| **M-10** | Stack TanStack Start + Cloudflare tem problemas SSR não previstos | Média | Médio | Sprint 1 valida `@supabase/ssr` ou equivalente; spike técnico se necessário |

---

## Decisões já tomadas (não rediscutir)

- **Frontend:** TanStack Start + Vite (não Next.js como o PRD original assumia)
- **Visual:** Lovable layout intocável
- **Backend:** Supabase (Postgres + Auth + RLS + Storage + Realtime + Edge Functions)
- **Sprints F2 (`docs/sprints/`):** obsoletos, não revisitar
- **Roadmap:** F4 começa direto após este plano ser aprovado (não passa por F3 separadamente — Lovable já cobriu)

---

## Pontos a alinhar com Hyago antes de Sprint 1

> Recomendações do @pm para @aios-master discutir com o usuário.

1. **Capacidade do time:** quem fará dev? Hyago acompanha mas não codifica? Há devs juniores? Definir parallelism real do plano.
2. **Conta Azul vs Asaas:** PRD prevê ambos com auto-detecção. Confirmar se mantém ou escolhe um para V1.
3. **Janela de cutover (Sprint 11):** weekend? feriado? quando o escritório consegue parar 4-6h.
4. **Postmark vs SES vs Resend:** PRD diz Postmark; confirmar (custo + setup).
5. **CI/CD provider:** GitHub Actions confirmado? Algum constraint de minutos?
6. **Cloudflare Pages vs Workers vs Pages Functions:** o `sistema-hv` está em `@cloudflare/vite-plugin` — confirmar destino de deploy (preview + prod).
7. **Domínio prod:** qual subdomínio? `app.hv.adv.br`? `sistema.hyagoviana.adv.br`?
8. **Migração de Drive:** os ~30GB já existentes serão importados, indexados, ou referenciados? PRD não cobre detalhes — alinhar Sprint 5 vs Sprint 10.
9. **TOTP/MFA obrigatório:** para quais roles? Admin sim, FIN sim, demais opt-in?
10. **Auditoria externa:** alguém vai auditar RLS/LGPD antes do go-live? Marcar slot no Sprint 11.

---

## Documentos relacionados

- [`docs/prd/01-plataforma-fies.md`](../prd/01-plataforma-fies.md) — PRD fonte deste plano
- [`docs/prd/master-platform.md`](../prd/master-platform.md) — Schema global + arquitetura base
- [`docs/project-brief.md`](../project-brief.md) — Brief do programa
- [`docs/architecture/frontend-architecture.md`](../architecture/frontend-architecture.md) — Decisões técnicas (princípios servem mesmo sendo Next.js no texto)
- [`sistema-hv/`](../../sistema-hv/) — Código-fonte (Lovable layout)
- [`docs/sprints/`](../sprints/) — ⚠ OBSOLETO (F2)

### Revisões e governança (v1.1)
- [`_review-qa.md`](./_review-qa.md) — Review @qa Quinn (5 BLOCKERs, 12 SHOULD-FIX, 14 stories sugeridas) — **imutável**
- [`_review-architect.md`](./_review-architect.md) — Review @architect Winston (3 BLOCKERs, 12 ADRs adicionais, 6 spikes) — **imutável**
- [`CHANGELOG.md`](./CHANGELOG.md) — Histórico de versões do plano
- [`_followups.md`](./_followups.md) — SHOULD-FIX/NICE-TO-HAVE adiados por sprint
- [`_adrs/`](./_adrs/) — Architecture Decision Records (MADR-light)

---

> _— @pm John, sob coordenação do Orion 🎯_
