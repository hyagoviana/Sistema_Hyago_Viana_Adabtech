# 📘 Project Brief — Plataforma Unificada Hyago Viana Advocacia

> **Documento mestre de contexto.** Fonte única de verdade que orienta os 8 PRDs subsequentes.
> **Versão:** 1.0 · **Data:** 2026-05-15 · **Owner:** Orion (AIOS Master) · **Status:** Aprovado para iniciar PRDs

---

## 1. Visão Executiva (Elevator Pitch)

> **Uma plataforma única que substitui Excel, Trello, Drive solto e WhatsApp informal por um sistema orientado a eventos**, onde toda demanda jurídica do escritório (do FIES à defesa CRM/CFM) flui de forma rastreável, automatizada por IA, com Cliente 360°, máquina de peticionamento, controladoria inteligente, CRM comercial integrado e atendimento WhatsApp via agente. **Tudo conectado a uma base canônica única**, com governança, LGPD e auditoria.

---

## 2. Cliente e Contexto

| Item | Valor |
|---|---|
| **Cliente** | Hyago Viana Advocacia |
| **Razão Social (Contratada)** | Adavio Luiz Costa Tittoni · CNPJ 62.880.271/0001-36 |
| **Localização** | Maceió/AL |
| **Áreas de atuação** | FIES (abatimento 1%), Programa Mais Médicos, Médicos pelo Brasil, Residência Médica (auxílio-moradia, CNRM), demandas possessórias/trabalhistas individuais, defesa ético-disciplinar CFM/CRMs, previdenciário/saúde, mandados de segurança |
| **Stakeholders associativos** | ANMR (Associação Nacional de Médicos Residentes), AMPB (Associação de Médicos pelo Brasil) — painéis institucionais |
| **Volume atual** | ~2.500 casos FIES ativos + demais demandas, geridos em Excel/Trello |
| **Equipe interna (setores)** | Comercial, Administrativo/Operacional, Jurídico, Financeiro, Controladoria, Administrador |

---

## 3. Problemas que estamos resolvendo

1. **Fragmentação de dados** — Excel + Trello + WhatsApp + Drive não conversam; mesmo cliente aparece em N lugares.
2. **Volume incompatível com gestão manual** — 2.500 casos FIES + demais demandas excedem capacidade de planilha.
3. **Perda de prazos e baixa rastreabilidade** — sem motor de eventos, alertas dependem de memória humana.
4. **Peticionamento manual repetitivo** — minutas com alto grau de padronização consomem horas de advogado sênior.
5. **Falta de inteligência sobre teses/decisões** — conhecimento jurídico do escritório não é capturado nem reutilizado.
6. **CRM informal** — leads e cross-sell dependem de planilhas e bom-senso dos atendentes.
7. **Triagem por humano em primeiro contato** — WhatsApp recebe alta carga de mensagens não-qualificadas.
8. **Compliance LGPD frágil** — coleta de dados sensíveis sem consentimento estruturado nem trilha auditável.

---

## 4. Visão de produto (3 anos)

> **A plataforma é o "sistema operacional" do escritório.** Toda informação nasce nela ou é capturada por ela. Advogados, controladoria, comercial, financeiro e cliente final operam sobre a mesma base de eventos, com IA assistindo (nunca decidindo no lugar do advogado). Em 3 anos, deve permitir multiplicar o volume operacional por **5×** sem multiplicar a equipe na mesma proporção.

---

## 5. Princípios arquiteturais norteadores

| # | Princípio | Implicação prática |
|---|---|---|
| **P1** | **Base canônica única** | Todo módulo lê/grava do mesmo schema Supabase. Nada de bases paralelas. |
| **P2** | **Orientação a eventos** | Toda transição de estado emite evento auditável (`events` table + outbox pattern). |
| **P3** | **Dois rastros independentes** | Operacional e Financeiro avançam em ritmos próprios; arquivamento por convergência. |
| **P4** | **Imutabilidade pós-aprovação** | Snapshots (ex: Termo de Acerto) viram imutáveis após aprovação jurídica; alterações geram nova versão (v2, v3). |
| **P5** | **IA como copiloto, nunca piloto** | Toda decisão consequente (peticionar, aceitar Termo, judicializar) tem aprovação humana. |
| **P6** | **Segregação de funções** | Quem elabora ≠ quem confere ≠ quem aprova. Regra forçada pelo sistema. |
| **P7** | **Anti-alucinação por RAG validado** | Geração de peças só consome fontes rastreáveis (peças aprovadas, decisões cadastradas, normas verificáveis). |
| **P8** | **LGPD por design** | Consentimento estruturado, finalidade declarada, anonimização para painéis agregados, direito ao esquecimento. |
| **P9** | **Migração assistida, não disruptiva** | Operação atual (Excel/Trello) coexiste com a nova durante go-live; migração incremental dos 2.500 casos. |
| **P10** | **Self-hosting de infra crítica** | n8n auto-hospedado, Evolution API self-hosted; reduz dependência de SaaS opacos. |

---

## 6. Stack técnico (decidido)

### 6.1 Camadas

| Camada | Tecnologia | Justificativa |
|---|---|---|
| **Frontend** | **Next.js 15** (App Router) + React Server Components + TypeScript | SSR + RSC reduz JS no cliente, type-safe end-to-end |
| **UI/Componentes** | **shadcn/ui** + **Tailwind CSS** | Componentes acessíveis, customizáveis, sem dependência de runtime |
| **Data fetching** | TanStack Query (React Query) v5 | Cache, optimistic updates, sincronização |
| **State global** | Zustand (leve) | Apenas para UI state; dados vêm do Supabase via RSC ou React Query |
| **Forms** | React Hook Form + Zod | Validação client+server compartilhada |
| **Tabelas** | TanStack Table v8 | Pipelines, listas de cobrança, dashboards |
| **Auth** | **Supabase Auth** (email/senha + magic link + MFA TOTP) | Integra com RLS nativamente |
| **DB** | **Supabase PostgreSQL** 15+ | RLS, triggers, functions, realtime, vector (pgvector) para embeddings |
| **Storage** | **Supabase Storage** (S3-compatible) | Documentos, mídias, snapshots de PDFs |
| **Edge Functions** | Supabase Edge Functions (Deno) | Webhooks, cron jobs leves, integrações |
| **Realtime** | Supabase Realtime (Postgres CDC) | Painel "Hoje", feed de eventos, notificações |
| **IA** | **Claude API** (Anthropic) — modelos: Sonnet 4.6 (default), Opus 4.7 (peticionamento/teses), Haiku 4.5 (classificações rápidas) | Caching nativo, ferramentas, 200k context |
| **Embeddings** | OpenAI `text-embedding-3-large` ou Cohere — base de teses/decisões | pgvector no Supabase |
| **Automação** | **n8n self-hosted** (VPS própria) | Workflows visuais, controle total, custo previsível |
| **WhatsApp** | **Evolution API** self-hosted (provisório) → WhatsApp Business API oficial (migração futura) | Evita custos altos no início |
| **Hosting frontend** | **Vercel** (produção) + preview por PR | DX, edge runtime, integração GitHub |
| **Hosting backend/n8n** | VPS Hostinger/Hetzner + Docker Compose | n8n + Evolution API + workers |
| **Observability** | Sentry (erros) + Axiom ou Logtail (logs) + Supabase Logs + Posthog (analytics produto) | Cobertura completa |
| **CI/CD** | GitHub Actions + Vercel deploy hooks | Testes, lint, type-check, deploy |
| **Testes** | Vitest (unit) + Playwright (E2E) + Testing Library (componentes) | Cobertura E2E dos fluxos críticos |

### 6.2 Integrações externas (mapa)

| Sistema | Direção | Quem consome |
|---|---|---|
| **ZapSign** | Webhook in | Projeto 1 (onboarding contratos) |
| **Google Drive** | Bidirecional (Service Account) | Projeto 1 (pastas por caso/cliente) |
| **Gmail API** | Read | Projeto 1 + 2 (e-mails MS/FNDE) |
| **Postmark** | Send | Projetos 1, 4 (cobranças, marketing transacional) |
| **Conta Azul** | Bidirecional + webhook | Projeto 1 (cobrança boleto, NF) |
| **Asaas** | Bidirecional + webhook | Projeto 1 (cobrança cartão) |
| **SEI (Sistema Eletrônico de Informações Gov.br)** | Scraping (Playwright Workers) | Projeto 1 + 2 |
| **CNES Data** | Scraping mensal | Projeto 1 |
| **Gov.br** | Login delegado (Dr. Hyago) + protocolo eGov | Projeto 1 (operacional) |
| **Projuris** | API oficial bidirecional | Projeto 2 (controladoria) |
| **ChatGuru** | Webhook + API | Projetos 1, 4, 6 (WhatsApp operacional) |
| **Evolution API** | Webhook + API | Projeto 6 (WhatsApp agente IA) |
| **Meta Ads + Google Ads** | API | Projeto 4 (tráfego pago) |
| **Plataformas de conteúdo IA** (HeyGen, ElevenLabs, etc.) | API | Projeto 5 (marketing) |
| **CFM/CRM portais** | Scraping consulta | Projeto 1 (Doc 04 - CRM médico) |

---

## 7. Marca e Identidade Visual

| Item | Valor |
|---|---|
| **Logo** | HV em dourado mostarda (`#987814`) com texto "HYAGOVIANA ADVOCACIA" em navy (`#1e2044`) |
| **Cor primária** | `#1e2044` — Navy (deep authority) |
| **Cor secundária / accent** | `#987814` — Gold (premium, sofisticação) |
| **Neutro claro** | `#e8e8e8` — Cinza claro (backgrounds) |
| **Neutro escuro** | `#000000` — Preto (texto principal sobre claro) |
| **Tom de marca** | Profissional, sóbrio, confiável, premium — refletindo seriedade da advocacia. Sem decoração excessiva. |
| **Direção visual** | **Clean, predominantemente branco (light-first), premium.** Navy e dourado como **accents cirúrgicos** (proporção 70% branco · 20% cinzas · 7% navy · 3% dourado). Sem gradients, sem decoração — elegância vem do whitespace e da tipografia. |
| **Tipografia** | Playfair Display (títulos H1-H2) + Inter (UI, body) + JetBrains Mono (dados). Máximo 2 weights por tela. |

> Detalhamento completo no **PRD 0 — UX/Design System** (especialmente Addendum v1.1 — Clean Light Premium).

---

## 8. Atores e Perfis (RBAC)

| Perfil | Permissões resumidas | Módulos primários |
|---|---|---|
| **Admin** | Tudo + override de regras + auditoria + impersonação restrita | Todos |
| **Advogado Titular** | Casos próprios + base de teses/decisões (R/W) + aprovação Termo | 1, 2, 3 |
| **Advogado Associado** | Casos atribuídos + peças (W/R) + sem aprovação Termo | 1, 2, 3 |
| **Prestador Externo** | Acesso restrito a casos específicos com escopo temporal | 1 (parcial) |
| **Controladoria** | Painel jurídico + tarefas + prazos + exceções + classificações | 2 |
| **Comercial** | Pipeline comercial + leads + cross-sell + integrações Meta/Google | 4 |
| **Financeiro** | Pipeline financeira + Termo (elaboração) + cobrança | 1 |
| **Conferidor Financeiro** | Conferir Termo (não pode elaborar) | 1 |
| **Operacional/ADM** | Operacional FIES + docs + protocolos | 1 |
| **Marketing** | Pipeline editorial + bancos de mídia + aprovações | 5 |
| **Cliente Final (Portal)** | Apenas seus casos: timeline, docs, aceite Termo, boletos | 1 (portal) |
| **Agente IA WhatsApp** | Triagem informativa SDR + handoff humano | 6 |

> **Auditoria obrigatória:** toda ação de Admin e toda transição de macrostatus são logadas em `audit_log` com `user_id`, `timestamp`, `ip`, `user_agent`, `entity`, `action`, `diff`.

---

## 9. KPIs e Métricas de Sucesso

### 9.1 KPIs de plataforma (saúde do sistema)

- ✅ **Uptime** ≥ 99.5% mensal
- ✅ **Latência P95** ≤ 500 ms para queries de pipeline
- ✅ **Erro de integração** ≤ 0.5% (com retry exponencial)
- ✅ **Tempo médio de carga Cliente 360°** ≤ 2s

### 9.2 KPIs de produto (por módulo)

| Módulo | KPI primário | Meta |
|---|---|---|
| **1 — FIES** | Casos migrados / total | 100% até 90d pós-go-live |
| **1 — FIES** | SLA: dias em macrostatus operacional ≤ 45 | 80% dos casos |
| **1 — FIES** | Taxa de aceite do Termo (sem discordância) | ≥ 75% |
| **1 — FIES** | Inadimplência > 30d | ≤ 8% |
| **2 — Controladoria** | Prazos com aceite/responsável atribuído em < 1 dia útil | ≥ 95% |
| **2 — Controladoria** | Movimentações classificadas automaticamente (alta confiança) | ≥ 70% |
| **3 — Peticionamento** | Minutas geradas com ≥ 80% de aproveitamento (poucas correções) | ≥ 60% |
| **3 — Peticionamento** | Taxa de "alucinação detectada" | ≤ 2% |
| **4 — CRM** | Conversão lead → cliente | Baseline + 30% |
| **4 — CRM** | Tempo médio até primeiro contato | ≤ 5 min |
| **5 — Marketing** | Conteúdos publicados / mês | ≥ 20 |
| **6 — WhatsApp** | Triagem automática resolvida sem humano | ≥ 50% |
| **6 — WhatsApp** | Handoff humano em < 30s quando solicitado | ≥ 95% |

### 9.3 KPIs de negócio (cliente)

- 📈 Aumento de capacidade operacional: meta **+200%** em 12 meses
- 📈 Redução de tempo de protocolo (DOCS → PROTOCOLO): meta **-40%**
- 📈 Recuperação de crédito FIES (valor honorários efetivamente cobrados / pipeline ativo): **≥ 90%**

---

## 10. Riscos estratégicos do programa

| # | Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|---|
| **R1** | Login Gov.br único (Dr. Hyago) — ponto crítico de falha | Média | Alto | Contingência: protocolo manual + delegação documentada; futuro: certificado A3 institucional |
| **R2** | Migração dos 2.500 casos FIES com inconsistências | Alta | Alto | Plano de migração incremental + dry-run + validação por amostra + período de coexistência |
| **R3** | Aprovação automática do Termo gerar discordâncias acima do esperado | Média | Médio | Calibração conservadora 30d + métrica de reversão monitorada + ajuste contínuo |
| **R4** | Evolution API instável / banimento WhatsApp | Alta | Alto | Migração planejada para WhatsApp Business API oficial (custos repassados conforme contrato) |
| **R5** | Vazamento LGPD (dados sensíveis: CPF, CRM, histórico médico/jurídico) | Baixa | Crítico | RLS rigorosa + auditoria total + criptografia at-rest + DPO designado + treinamento equipe |
| **R6** | Alucinação de IA em peças gerar peça impertinente protocolada | Baixa | Crítico | Marcação "MINUTA NÃO REVISADA" + obrigatoriedade de aceite advogado + mapa de fontes + revisão automatizada |
| **R7** | Lock-in em fornecedor (Projuris API, ChatGuru) | Média | Médio | Abstração por interface; adaptadores trocáveis; contratos com SLA |
| **R8** | Custo de IA escalar com volume (~2500 casos × N tokens) | Alta | Médio | Prompt caching obrigatório + escolha Haiku para classificação + budget guardrails |
| **R9** | Resistência cultural da equipe (mudança de Excel para sistema) | Alta | Médio | Onboarding com treinamento + champions internos + UI familiar (pipelines tipo Trello) |
| **R10** | Conflito de regras Operacional × Financeiro (rastros divergem) | Média | Alto | Estados canônicos rigorosos + testes E2E dos cenários divergentes + dashboard de exceções |

---

## 11. Compliance e LGPD

### 11.1 Dados sensíveis tratados

- CPF, RG, dados profissionais (CRM, OAB), vínculo institucional, histórico financeiro, comunicações com cliente, documentos médicos/jurídicos.

### 11.2 Bases legais aplicáveis

- **Execução de contrato** (cliente do escritório): art. 7º, V, LGPD
- **Cumprimento de obrigação legal/regulatória** (advogado, OAB): art. 7º, II
- **Consentimento** (leads externos, marketing): art. 7º, I — necessariamente explícito e auditável

### 11.3 Requisitos transversais (todos os PRDs implementam)

- ✅ Tela/banner de consentimento na primeira interação cliente (Portal + WhatsApp)
- ✅ Tabela `consent_records` com timestamp, IP, finalidade, versão da política
- ✅ Direito ao acesso e portabilidade: export JSON dos dados do titular
- ✅ Direito ao esquecimento: soft-delete + cron de hard-delete após retenção legal (5 anos pós-quitação para FIES)
- ✅ Logs de acesso a dados sensíveis (`audit_log`)
- ✅ Anonimização nos painéis institucionais (ANMR, AMPB)
- ✅ DPO designado: a definir (sugestão: Adavio ou parceiro externo)
- ✅ Política de Privacidade e Termos de Uso publicados e versionados

### 11.4 Ética OAB

- ⚠ Marketing (Projeto 5) submete conteúdo a checklist automático de risco ético-publicitário (vedação de captação de clientela, "advocacia de massa", etc.) antes de publicar.

---

## 12. Roadmap macro — Design-first (ordem confirmada)

> **Estratégia adotada:** construir TODA a UI primeiro (F0-F3) com mocks; depois aplicar lógica e backend módulo a módulo sobre telas prontas (F4-F9).

```
F0 ───── F1 ───── F2 ───── F3 ─── F4 ───── F5 ──── F6 ──── F7 ──── F8 ──────── F9
 │        │        │        │      │        │       │       │       │           │
 PRDs   Figma   Frontend  Testes  Projeto  Proj.2  Proj.6  Proj.3  Proj.4+5    Polish
 v1.2    HF     mock-first usabil  1+FIES  Contr.  WhatsAp Petic.  paralelos   Go-live
 ✓     3 sem   4 sem      1 sem  8 sem    6 sem  4 sem   6 sem   8 sem        2 sem
```

**Total: ~14 meses** (F0 ✅ concluído; restam ~13 meses para F1-F9).

**Justificativa da ordem 1 → 2 → 6 → 3 → 4 → 5 (lógica/backend):**

1. **Projeto 1** é fundação inegociável — sem base canônica, nenhum outro módulo opera.
2. **Projeto 2** destrava a operação jurídica diária (Projuris, prazos, exceções) — ROI imediato.
3. **Projeto 6** automatiza a entrada (WhatsApp), aliviando o time enquanto se constrói o resto.
4. **Projeto 3** consome maturidade dos Projetos 1+2 (precisa de teses/decisões povoadas para RAG funcionar).
5. **Projeto 4** depende de base de clientes consolidada (Projeto 1) para cross-sell.
6. **Projeto 5** é o mais "destacável" — pode rodar quase autônomo, então fica por último.

---

## 13. Equipe sugerida (squad)

| Papel | Dedicação | Responsabilidades |
|---|---|---|
| **Tech Lead / Arquiteto** | 100% | Schema, decisões cross-módulo, code review |
| **Fullstack Senior** | 100% × 2 | Implementação core (Next.js + Supabase) |
| **Backend/Integrações** | 100% × 1 | n8n, scrapers SEI/CNES, webhooks, Edge Functions |
| **UX/UI Designer** | 50% (inicial 100%) | Design system, telas, testes de usabilidade |
| **QA Engineer** | 50% | Testes E2E críticos, validação migração, regressão |
| **IA Engineer** | 50% | Prompts, RAG, embeddings, custo |
| **Product Owner (Hyago/Adavio)** | 30% | Validação de regras de negócio, aceite de PRDs |

---

## 14. Dependências e premissas

### 14.1 Premissas
- Acesso à API Projuris será fornecido pelo cliente.
- Login Gov.br do Dr. Hyago disponível para delegação operacional.
- Documentos atuais (Excel, Trello, Drive) acessíveis para migração.
- Equipe atual disponível para sessões de validação semanais.

### 14.2 Dependências externas
- Aprovação OAB (eventual consulta sobre rotinas automatizadas de marketing).
- Acordos comerciais com ChatGuru, Conta Azul, Asaas, Projuris (chaves API).
- Domínio e SSL para o app (sugestão: `app.hyagoviana.adv.br`).

---

## 15. Princípios de design da experiência

> Detalhamento completo no **PRD 0 — UX/Design System**. Aqui, apenas os princípios mestres:

1. **Densidade controlada** — telas operacionais são densas (advogados precisam de dados), mas com hierarquia tipográfica clara.
2. **Próxima ação sempre visível** — todo card (caso, tarefa, oportunidade) exibe "o que fazer agora".
3. **Estados ricos** — cores e badges comunicam status sem texto excessivo.
4. **Mobile-first no Portal do Cliente, desktop-first no app interno.**
5. **Acessibilidade WCAG 2.2 AA mínimo.**
6. **Tempo de aprendizado curto** — pipelines reconhecíveis (modelo Trello) na superfície, motor de regras escondido por baixo.

---

## 16. Outputs deste programa

Ao final dos 8 PRDs e da execução completa, o escritório terá:

- ✅ 1 plataforma web SaaS unificada (`app.hyagoviana.adv.br`)
- ✅ 1 Portal do Cliente (`portal.hyagoviana.adv.br`)
- ✅ 1 painel institucional ANMR/AMPB (`painel.hyagoviana.adv.br`)
- ✅ Agente WhatsApp 24/7
- ✅ Pipeline de conteúdo IA-assistido
- ✅ Documentação técnica, operacional e treinamento

---

## 17. Glossário (termos do domínio)

| Termo | Definição |
|---|---|
| **FIES** | Fundo de Financiamento Estudantil. Abatimento de 1% por mês de serviço em ESF/áreas remotas — Lei 10.260/2001. |
| **DGM** | Declaração de Gestão Municipal — documento prefeito atesta vínculo ESF. |
| **ESF** | Estratégia Saúde da Família (programa federal). |
| **CNES** | Cadastro Nacional de Estabelecimentos de Saúde. |
| **Termo de Acerto** | Documento que formaliza o valor recuperado e honorários (PARCIAL ou COMPLEMENTAR). |
| **PMMB** | Programa Médicos pelo Brasil. |
| **CNRM** | Comissão Nacional de Residência Médica. |
| **Macrostatus** | Estado canônico de alto nível do caso em cada rastro (operacional/financeiro). |
| **Snapshot** | Versão imutável do Termo após aprovação jurídica. |
| **Rastro operacional / financeiro** | Dois fluxos independentes que tramitam em paralelo após implantação do abatimento. |
| **Bifurcação** | Momento em que rastro financeiro inicia a partir do operacional (gatilho IMPLANTADO). |
| **Hold** | Pausa temporária no fluxo financeiro com motivo estruturado. |
| **NUP** | Número Único de Protocolo (SEI). |

---

## 18. Como este Brief é usado

| PRD downstream | Seções deste brief que consome |
|---|---|
| PRD 0 — UX/Design | §7, §15 |
| PRD Master | §5, §6, §8, §10, §11 |
| PRDs 1–6 | Todas |

---

> **Status:** Aprovado. Próximo passo: gerar **PRD 0 — UX/Design System**.
> _— Orion, orquestrando o sistema 🎯_
