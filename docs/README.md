# 📚 Documentação — Plataforma Unificada Hyago Viana Advocacia

> **Pacote completo de PRDs** entregue por Orion (AIOS Master) em 2026-05-15.
> Equipe simulada: @pm + @architect + @qa + @ux-design-expert + @dev.

---

## 🎯 Visão de 30 segundos

Plataforma única que substitui Excel + Trello + WhatsApp informal por sistema orientado a eventos, com **6 módulos integrados** sobre **base canônica única** (Supabase), com **IA copiloto** (Claude), **automação visual** (n8n self-hosted), **identidade premium** (navy + dourado HV) e **compliance LGPD/OAB** por design.

---

## 📁 Índice dos documentos

### Fundação

| # | Documento | Tamanho | Conteúdo |
|---|---|---|---|
| 0 | [`project-brief.md`](./project-brief.md) | ~20 KB | Visão executiva, problemas, princípios, stack, KPIs, riscos, roadmap macro, glossário |

### PRDs (8 documentos)

| # | PRD | Arquivo | Tamanho | Foco |
|---|---|---|---|---|
| 1 | **UX & Design System** | [`prd/00-ux-design-system.md`](./prd/00-ux-design-system.md) | ~46 KB | Tokens, tipografia, componentes shadcn customizados, acessibilidade WCAG 2.2 AA, padrões de layout, microcopy |
| 2 | **PRD Master (Arquitetura)** | [`prd/master-platform.md`](./prd/master-platform.md) | ~75 KB | Schema canônico Supabase (17 tabelas globais + ~36 dos módulos = ~53 totais), RLS, motor de eventos, integrações, IA/RAG, n8n, LGPD, DevOps |
| 3 | **Projeto 1 — Plataforma + FIES** | [`prd/01-plataforma-fies.md`](./prd/01-plataforma-fies.md) | ~47 KB | Cliente 360°, dois rastros, pipelines, fluxos POP (COVID, ESF/DGM, ESF/Portaria, Militar), Termo de Acerto imutável, Portal do Cliente, migração 2.500 casos |
| 4 | **Projeto 2 — Controladoria** | [`prd/02-controladoria-juridica.md`](./prd/02-controladoria-juridica.md) | ~35 KB | Sync Projuris, classificação IA de movimentações, gestão de prazos, Centro de Exceções, base de teses/decisões com embeddings (pgvector) |
| 5 | **Projeto 3 — Peticionamento** | [`prd/03-maquina-peticionamento.md`](./prd/03-maquina-peticionamento.md) | ~24 KB | RAG anti-alucinação, geração de 9 tipos de peça com Claude Opus, banco de peças validadas, checklist de prontidão |
| 6 | **Projeto 4 — Comercial/CRM** | [`prd/04-comercial-crm.md`](./prd/04-comercial-crm.md) | ~17 KB | Funil comercial, cross-sell engine, leads externos (Meta/Google Ads), painel institucional ANMR/AMPB |
| 7 | **Projeto 5 — Marketing** | [`prd/05-marketing-conteudo.md`](./prd/05-marketing-conteudo.md) | ~19 KB | Calendário editorial IA, geradores Reels/Podcast/Copy, compliance OAB automatizado, banco de mídia |
| 8 | **Projeto 6 — Agente WhatsApp** | [`prd/06-agente-whatsapp.md`](./prd/06-agente-whatsapp.md) | ~26 KB | Evolution API + n8n, agente IA conversacional, classificação 8 categorias, handoff humano, LGPD-compliant, multimodal (áudio/OCR) |

**Total: ~308 KB de markdown** ≈ 350-400 páginas A4 equivalentes.

---

## 🏗️ Stack técnico decidido

| Camada | Tecnologia |
|---|---|
| **Frontend** | Next.js 15 (App Router) + RSC + TypeScript |
| **UI** | shadcn/ui + Tailwind + Lucide icons |
| **State/Data** | TanStack Query + Zustand + React Hook Form + Zod |
| **Auth/DB/Storage** | Supabase (Auth + Postgres 15 + RLS + Storage + Edge Functions + Realtime + pgvector) |
| **IA** | Claude API (Sonnet 4.6 default, Opus 4.7 minutas, Haiku 4.5 classificação) + caching obrigatório |
| **Embeddings** | text-embedding-3-large (pgvector) |
| **Automação** | n8n self-hosted (Hetzner CCX13 VPS + Docker Compose) |
| **WhatsApp** | Evolution API self-hosted (V1) → WhatsApp Business API (V2) |
| **Hosting** | Vercel (frontend, 3 apps) + VPS Hostinger/Hetzner (n8n + Evolution) |
| **Observability** | Sentry + Axiom/Logtail + PostHog + UptimeRobot |
| **CI/CD** | GitHub Actions + Vercel deploy hooks |
| **Testes** | Vitest + Playwright + axe-core |

---

## 🗓️ Roadmap de execução — Design-first

```
F0 ───── F1 ───── F2 ───── F3 ─── F4 ───── F5 ──── F6 ──── F7 ──── F8 ──────── F9
 │        │        │        │      │        │       │       │       │           │
 PRDs   Figma   Frontend  Testes  Projeto  Proj.2  Proj.6  Proj.3  Proj.4+5    Polish
 v1.2    HF     mock-first usabil  1+FIES  Contr.  WhatsAp Petic.  paralelos   Go-live
 ✓     3 sem   4 sem      1 sem  8 sem    6 sem  4 sem   6 sem   8 sem        2 sem
```

**F0 concluído** (PRDs entregues). **Ordem da lógica/backend:** 1 → 2 → 6 → 3 → 4 → 5.
**Total restante:** ~13 meses (F1-F9).

---

## 🌐 Subdomínios planejados

| URL | App |
|---|---|
| `app.hyagoviana.adv.br` | Aplicação interna (equipe do escritório) |
| `portal.hyagoviana.adv.br` | Portal do Cliente (mobile-first) |
| `painel.hyagoviana.adv.br` | Painel institucional ANMR/AMPB (público restrito) |
| `storybook.hyagoviana.adv.br` | Design System (interno) |

---

## 🎨 Identidade visual — Clean Light Premium

- **Logo:** HV dourado mostarda + "HYAGOVIANA ADVOCACIA" navy
- **Direção:** **Clean, light-first, premium** — 90% das telas em branco/off-white
- **Proporção visual:** 70% branco · 20% cinzas · 7% navy · 3% dourado
- **Cores:** `#ffffff` / `#fafafa` (base) · `#1e2044` (navy, accent) · `#987814` (dourado, accent) · `#e8e8e8` (border) · `#171717` (texto)
- **Tipografia:** Playfair Display (títulos) + Inter (UI/body) + JetBrains Mono (dados)
- **Assinatura visual:** faixa dourada 2px no item ativo da sidebar (única "marca" visível sempre)
- **Princípio:** whitespace é luxo. Navy é tinta, não base. Dourado é especiaria, não molho.

📌 **Detalhamento completo:** ver `Addendum v1.1` no PRD 0.

---

## 🧮 Tabelas Supabase (resumo)

| Categoria | Quantidade |
|---|---|
| **Globais (PRD Master)** | 17 |
| **Projeto 1 — FIES** | 6 |
| **Projeto 2 — Controladoria** | 8 |
| **Projeto 3 — Peticionamento** | 6 |
| **Projeto 4 — CRM** | 7 |
| **Projeto 5 — Marketing** | 5 |
| **Projeto 6 — WhatsApp** | 4 |
| **TOTAL** | **~53 tabelas** |

Todas com RLS + soft-delete + audit log + organization_id (multi-tenant pronto).

---

## 🔐 Compliance

- ✅ **LGPD by design**: consentimento estruturado, finalidade declarada, anonimização, direito ao acesso/esquecimento, DPO
- ✅ **OAB**: checker automatizado de risco ético-publicitário em todos conteúdos (Projeto 5)
- ✅ **Auditoria**: 100% das ações sensíveis logadas (audit_log particionado mensalmente)
- ✅ **Segurança**: RLS no banco, signed URLs, criptografia at-rest, MFA TOTP obrigatório para roles críticas, secrets em vault

---

## 📊 KPIs principais (saúde + produto)

| Categoria | KPI | Meta |
|---|---|---|
| **Plataforma** | Uptime | ≥ 99.5% |
| **Plataforma** | Latência P95 | ≤ 500ms |
| **Projeto 1** | Migração ~2.500 casos | 100% em 90d |
| **Projeto 1** | Aceite Termo sem discordância | ≥ 75% |
| **Projeto 1** | Inadimplência > 30d | ≤ 8% |
| **Projeto 2** | Classificação automática | ≥ 70% alta confiança |
| **Projeto 3** | Minutas com aproveitamento ≥80% | ≥ 60% |
| **Projeto 3** | Alucinação detectada | ≤ 2% |
| **Projeto 4** | Conversão lead→cliente | baseline +30% |
| **Projeto 5** | Conteúdos / mês | ≥ 20 |
| **Projeto 6** | Triagem sem humano | ≥ 50% |

---

## ⚠️ Top riscos do programa

1. **Migração 2.500 casos** com inconsistências → dry-run + validação amostral
2. **Login Gov.br único** (Dr. Hyago) → contingência manual + futuro: certificado A3
3. **Aprovação automática do Termo** divergir → calibração 30d + métrica reversão
4. **Evolution API banimento WhatsApp** → plano migração para Business API
5. **LGPD vazamento** → RLS + auditoria + DPO + criptografia
6. **Alucinação IA em peças** → marcação + validação automatizada + revisão obrigatória
7. **Custo IA escalar** → caching obrigatório (≥80% hit rate) + budget guard

---

## ✅ Estratégia adotada — Design-first

> **Processo definido pelo cliente:** construir TODO o sistema visual primeiro (todas 115 telas, navegação, estados), depois aplicar lógica e backend projeto por projeto sobre telas prontas.

| Fase | Duração | Entregável |
|---|---|---|
| **F0 — PRD 0 v1.2 (Design Bible)** | ✅ Concluído | 115 telas catalogadas + design tokens + componentes |
| **F1 — Figma High-Fidelity** | 3 semanas | Frames master + protótipo clicável validado com Hyago |
| **F2 — Implementação Frontend Mock-First** | 4 semanas | 115 telas implementadas em Next.js com MSW + fixtures (sem backend ainda) |
| **F3 — Testes de Usabilidade** | 1 semana | 5 usuários reais, ajustes finais, design system congelado |
| **F4 — Aplicar lógica Projeto 1 (FIES)** | 8 semanas | Trocar mocks por Supabase real + migração 2.500 casos |
| **F5 — Aplicar lógica Projeto 2 (Controladoria)** | 6 semanas | Idem |
| **F6 — Aplicar lógica Projeto 6 (WhatsApp)** | 4 semanas | Idem |
| **F7 — Aplicar lógica Projeto 3 (Peticionamento)** | 6 semanas | Idem |
| **F8 — Aplicar lógica Projetos 4 e 5 (paralelos)** | 8 semanas | Idem |
| **F9 — Polish + treinamento + go-live consolidado** | 2 semanas | Sistema completo em produção |

**Total estimado: ~14 meses** (esticável conforme disponibilidade do time).

### Por que design-first?

- ✅ Hyago vê o **produto completo navegável** antes de qualquer código de backend
- ✅ Frontend não fica bloqueado esperando API
- ✅ Testes de usabilidade acontecem **antes** de qualquer linha de SQL
- ✅ Refatorações visuais ficam **baratas**
- ✅ Cada módulo (1-6) vira "plugar lógica em tela pronta"

---

## 🤝 Como navegar nesses documentos

- **Começar pelo:** [`project-brief.md`](./project-brief.md) para contexto macro
- **Para designer/UX:** [`prd/00-ux-design-system.md`](./prd/00-ux-design-system.md)
- **Para tech lead/arquiteto:** [`prd/master-platform.md`](./prd/master-platform.md) (schema + decisões)
- **Para devs do FIES:** [`prd/01-plataforma-fies.md`](./prd/01-plataforma-fies.md) (módulo central)
- **Para revisão de PM:** todos os PRDs têm seção **"Épicos e Stories"** com ACs prontos para sprint

Cada PRD tem **checklist de validação QA + Arquiteto + UX** na seção final, indicando o que precisa estar verde antes do próximo nível.

---

> **Status:** Pacote completo entregue. Aguardando validação humana para iniciar implementação.
>
> _— Orion (AIOS Master), orquestrando o sistema 🎯_
>
> Para reabrir, revisar, expandir ou ajustar qualquer PRD: invoque `@aios-master` ou `@pm` / `@architect` / `@qa` conforme o foco.
