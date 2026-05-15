# 🏗️ Sprints Plan — Construção do Design System & Frontend Mock-First

> **Plataforma Hyago Viana Advocacia · Fase F2 (Frontend Mock-First)**
> **Versão:** 1.0 · **Data:** 2026-05-15 · **Orquestração:** Orion
> **Time virtual:** @pm + @architect + @ux-design-expert + @qa + skills `frontend-design` + `web-design-guidelines`

---

## Sumário

1. [Decisões prévias](#1-decisões-prévias)
2. [Visão geral dos 8 sprints](#2-visão-geral-dos-8-sprints)
3. [Sprint 1 — Fundação Técnica](#sprint-1-fundação-técnica)
4. [Sprint 2 — Design System Core](#sprint-2-design-system-core)
5. [Sprint 3 — Cliente 360° + FIES (parte 1)](#sprint-3-cliente-360-fies-parte-1)
6. [Sprint 4 — FIES (parte 2) + Controladoria](#sprint-4-fies-parte-2-controladoria)
7. [Sprint 5 — Peticionamento + Comercial](#sprint-5-peticionamento-comercial)
8. [Sprint 6 — Marketing + WhatsApp](#sprint-6-marketing-whatsapp)
9. [Sprint 7 — Portal do Cliente + Painel Institucional](#sprint-7-portal-painel)
10. [Sprint 8 — Polish + A11y + Performance + Handoff](#sprint-8-polish)
11. [Ritual de validação multi-agente](#11-ritual-de-validação-multi-agente)
12. [Definição de Pronto (DoD) — global](#12-definição-de-pronto-dod-global)
13. [Métricas de saúde do projeto](#13-métricas-de-saúde-do-projeto)

---

## 1. Decisões prévias

| Decisão | Status |
|---|---|
| ✅ Pular Figma — ir direto para código | Confirmado |
| ✅ Stack Next.js 15 + Tailwind 4 + shadcn + Turborepo | Confirmado |
| ✅ Mock-first com MSW + fixtures determinísticas | Confirmado |
| ✅ Local: pasta nova `sistema-hv/` ao lado de `docs/` | Confirmado |
| ✅ 8 sprints (~10-14 dias úteis cada na execução real) | Estimado |
| ✅ Validação multi-agente ao fim de cada sprint | Confirmado |

---

## 2. Visão geral dos 8 sprints

```
S1 ──── S2 ──── S3 ──── S4 ──── S5 ──── S6 ──── S7 ──── S8
 │       │       │       │       │       │       │       │
Fund.   DS      Client+ FIES+   Petic+  Mkt+    Portal  Polish
Técn.   Core    FIES1   Contr.  Comerc. WhatsAp +Painel +Handoff
                                                          F3 → F4
 │       │       │       │       │       │       │       │
 12      ~50    ~15     ~15     ~15     ~10     ~20     QA
 cmps   cmps    telas   telas   telas   telas   telas   final
        Story
        book
```

**Total estimado:** ~95-110 telas implementadas em código (Next.js + Tailwind + shadcn customizado) ao fim de S8. As 115 telas do sitemap do PRD 0 são cobertas porque várias são variantes resolvidas por componentes parametrizados.

---

## Sprint 1 — Fundação Técnica

### 🎯 Objetivo
Estabelecer **base técnica imutável** sobre a qual todas as outras 7 sprints se apoiam. Após este sprint, qualquer dev pode rodar `pnpm dev` e ver os 3 apps de pé com login mock funcional.

### 📦 Entregáveis

#### 1. Monorepo
- [ ] `pnpm-workspace.yaml` + `turbo.json` configurados
- [ ] 3 apps: `apps/interno`, `apps/portal`, `apps/painel` rodando Next.js 15
- [ ] 6 packages: `@hv/ui`, `@hv/tokens`, `@hv/api-client`, `@hv/mocks`, `@hv/utils`, `@hv/eslint-config`, `@hv/tsconfig`
- [ ] Turbo cache local + Vercel Remote Cache opcional

#### 2. Configurações
- [ ] `tsconfig` base + nextjs + react-library
- [ ] ESLint flat config compartilhado com regras estritas
- [ ] Prettier + `prettier-plugin-tailwindcss`
- [ ] Tailwind 4 com preset compartilhado consumindo `@hv/tokens`
- [ ] Husky + lint-staged para pre-commit (opcional, se tempo)

#### 3. Tokens de design (`@hv/tokens`)
- [ ] `colors.ts` — paleta navy + gold + neutros conforme PRD 0 v1.2
- [ ] `typography.ts` — Playfair Display (display) + Inter (body) + JetBrains Mono
- [ ] `spacing.ts`, `radii.ts`, `shadows.ts`, `motion.ts`
- [ ] Função `tokensToCSSVars()` que emite CSS variables

#### 4. App shell + tema
- [ ] `globals.css` com Tailwind 4 + CSS vars + `@theme` directive
- [ ] Fonts via `next/font/google` (Playfair + Inter)
- [ ] `<ThemeProvider>` (next-themes, light only V1, dark plugável V2)
- [ ] Layout root com `<MSWProvider>` em dev

#### 5. MSW setup
- [ ] `@hv/mocks` com handlers básicos (`auth`, `clientes`, `casos` — 5-10 handlers)
- [ ] Fixtures iniciais determinísticas (faker seedado): 10 clientes, 30 casos
- [ ] Scenarios switcher (DevTools panel) — happy/slow/error/empty/offline
- [ ] Worker browser + setupServer node

#### 6. Auth mock + Login
- [ ] Login flow funcional com 3 usuários mock (admin, comercial, advogado)
- [ ] Cookie httpOnly simulado via Route Handler
- [ ] MFA prompt opcional (mock)
- [ ] Logout
- [ ] Middleware protegendo rotas `(dashboard)`

#### 7. Storybook
- [ ] Storybook 8 publicado em `packages/ui`
- [ ] `msw-storybook-addon` configurado
- [ ] addon-a11y ativo
- [ ] 5 componentes seed: Button, Input, Card, Badge, Avatar com stories

#### 8. CI/CD
- [ ] GitHub Actions: lint + typecheck + test no PR
- [ ] Chromatic ou similar para visual review do Storybook (opcional)
- [ ] Deploy preview Vercel automático

#### 9. Documentação
- [ ] README do monorepo com setup instructions
- [ ] CONTRIBUTING.md com convenções de código
- [ ] `.env.example`

### 🧑‍💼 Perspectiva @pm — User Stories

| ID | Story | AC principais |
|---|---|---|
| **S1.1** | **Como** dev, **eu quero** clonar o repo e rodar `pnpm install && pnpm dev`, **para que** os 3 apps subam sem erro | Setup do zero em < 5min; comando único; logs claros |
| **S1.2** | **Como** dev, **eu quero** acessar `localhost:3000` e ver tela de login HV, **para que** eu possa começar a desenvolver | Login com clean design; identidade visual HV correta; sem console errors |
| **S1.3** | **Como** dev, **eu quero** logar com `admin@hv.test / hyago123` e ver o painel "Hoje" placeholder, **para que** o flow auth esteja validado | Login → redirect dashboard; cookie setado; rotas protegidas redirecionam para login |
| **S1.4** | **Como** designer, **eu quero** acessar Storybook em `localhost:6006`, **para que** eu veja os componentes documentados | Storybook publicado com 5+ componentes; addon a11y mostrando zero violations |
| **S1.5** | **Como** PM, **eu quero** ver pipeline CI verde no PR, **para que** mudanças quebrem cedo | GitHub Actions verde; lint+type+test rodando |

### 🏗️ Perspectiva @architect — decisões técnicas

> _(Detalhado no [Plano de Arquitetura](#) — produzido pelo Plan agent. Sumário aqui.)_

- **Monorepo Turborepo + pnpm workspaces**
- **RSC default, "use client" opt-in**
- **Estado servidor: TanStack Query · URL state: nuqs · UI ephemeral: Zustand**
- **Zod como single source of truth** (gera tipos + valida runtime)
- **MSW único para browser, node, Storybook**
- **`@hv/api-client` abstrai todo HTTP** — zero `fetch()` em componentes

### 🎨 Perspectiva @ux-design-expert — direção visual

- **Identidade HV aplicada na primeira pixel:** sidebar branca, faixa dourada no item ativo, Playfair em H1, navy só em texto/botões.
- **Login page premium** (mockup ASCII §B.1.1 do PRD 0): logo HV dourado 64px centralizado, form com border `#e8e8e8`, padding 32px, inputs 44px altura.
- **Validação skill `frontend-design`:** zero gradients clichê, zero glassmorphism, zero noise textures. Whiteboard refinado.
- **Validação skill `web-design-guidelines`:** contraste ≥ 4.5:1 em todos os componentes; foco visível gold ring 3px; estados ricos (não só cor).

### 🛡️ Perspectiva @qa — checklist de aceitação

#### Funcional
- [ ] `pnpm install` completa sem warnings críticos
- [ ] `pnpm dev` sobe os 3 apps em < 30s
- [ ] Login → Dashboard funciona em todos os 3 perfis mock
- [ ] Logout limpa sessão
- [ ] Rotas protegidas redirecionam corretamente

#### Visual
- [ ] Logo HV correto (dourado mostarda, símbolo + texto navy)
- [ ] Paleta exata: `#1e2044`, `#987814`, brancos, cinzas neutros
- [ ] Tipografia: Playfair em H1, Inter em UI/body
- [ ] Sidebar branca com faixa dourada no item ativo
- [ ] Whitespace generoso (48px top page, 24px card padding)

#### Acessibilidade
- [ ] Lighthouse Accessibility ≥ 95 no login
- [ ] axe-core no Storybook: zero violations critical/serious
- [ ] Navegação por teclado em login + dashboard (tab order lógico)
- [ ] Foco visível em todos os elementos interativos
- [ ] aria-labels em ícones-botão

#### Técnico
- [ ] TypeScript strict sem `any` em código novo
- [ ] ESLint zero warnings
- [ ] Vitest passando (cobertura mínima 60% em utils)
- [ ] Playwright: jornada login → logout funcional
- [ ] Bundle inicial < 250KB First Load (medido)
- [ ] Lighthouse Performance ≥ 85 (mock)

#### Validação cruzada
- [ ] @architect aprovou estrutura técnica
- [ ] @ux-design-expert aprovou visual login + shell
- [ ] @qa rodou checklist completo
- [ ] Skill `web-design-guidelines` validou UI quality

### ⏱ Estimativa
**5-8 dias úteis** (squad de 2 devs) · _Em sessão Claude: 2-3 sessões intensas_

---

## Sprint 2 — Design System Core

### 🎯 Objetivo
Construir **~50 componentes** que servem de blocos de Lego para todas as telas dos próximos 6 sprints. Cada componente vive no Storybook com 5+ stories (default, loading, empty, error, full).

### 📦 Entregáveis — Inventário de componentes

#### Primitives (shadcn customizados — 20)
- Button (variants: primary, secondary, ghost, destructive, link · sizes: sm, default, lg, icon)
- Input, Textarea, Label, FormField (wrapper RHF)
- Select, Combobox, MultiSelect, DatePicker, DateRangePicker, TimePicker
- Checkbox, Radio, Switch
- Avatar, AvatarGroup
- Badge, Tag, Chip
- Tooltip, Popover

#### Layout (8)
- AppShell, Sidebar, Topbar, PageHeader, ContentContainer
- Drawer (lateral), Sheet (mobile), Modal/Dialog

#### Display (10)
- Card, Divider, Accordion, Tabs, Breadcrumb
- Skeleton, EmptyState, ErrorBoundary, Spinner
- Stepper

#### Composites (12 — chave do produto)
- **DataTable** (TanStack Table + sorting + filtering + pagination + densidade)
- **PipelineBoard** (Kanban com drag-and-drop dnd-kit)
- **KanbanCard** (variante compact/default/expanded)
- **CommandPalette** (⌘K com cmdk)
- **NotificationsBell** (dropdown + página)
- **TimelineFeed** (item, agrupamento por data)
- **MacrostatusBadge** (variantes operacional/financeiro com semáforo SLA)
- **NextActionFooter**
- **AlertStrip** (warning/danger/info em cabeçalhos)
- **DocumentRow** (item de lista de docs com status)
- **AuditEntry** (linha de audit log)
- **MaskedField** (CPF/CNPJ com permissão de reveal — LGPD)

### 🧑‍💼 Stories do @pm

| ID | Story |
|---|---|
| **S2.1** | Como dev, instalar componente do design system via `import { X } from '@hv/ui'` |
| **S2.2** | Como designer/PM, ver cada componente em Storybook com todas as variantes |
| **S2.3** | Como dev, ter API consistente (compound components, ref forwarding, asChild via Slot) |
| **S2.4** | Como QA, ver axe-core verde em todos os componentes |

### 🏗️ Decisões @architect

- **Componentes em `packages/ui/src/components/{primitives,layout,display,composites,feedback}/`**
- **Compound pattern** para densos (`PipelineBoard.Header`, `PipelineBoard.Column`)
- **Polymorphism via `as` prop** só em `Text`, `Heading`
- **Ref forwarding** em todos os primitives
- **CVA (class-variance-authority)** para variants
- **Story por componente** com `meta.parameters.a11y` ativo

### 🎨 Direção @ux-design-expert

- **Pixel-perfect contra PRD 0** §8 (Anatomias) — cada componente segue spec.
- **Microinterações sutis** (Sprint 8 refina, S2 implementa o essencial):
  - Hover: cor texto cinza → navy + underline gold expand left-to-right 200ms
  - Focus: ring gold 40% 3px
  - Click button: scale 1 → 0.98 → 1 em 100ms
- **Skill `frontend-design` aplicada** em cada componente:
  - Sem decoração desnecessária
  - Tipografia disciplinada (máx 2 weights/componente)
  - Bordas refinadas (1px solid #e8e8e8) ao invés de shadows pesadas

### 🛡️ QA por componente

Cada um precisa:
- [ ] Story default + loading + disabled + error + variants
- [ ] axe-core zero violations
- [ ] Navegação teclado funcional
- [ ] Variant prop documentada via TypeScript
- [ ] Unit test (Vitest + Testing Library) para lógica interna
- [ ] Interaction test (Storybook) para fluxos
- [ ] Responsive verificado (xs/md/xl)

### ⏱ Estimativa
**8-12 dias úteis** · _Em sessão Claude: 4-6 sessões_

---

## Sprint 3 — Cliente 360° + FIES (parte 1)

### 🎯 Objetivo
**15 telas mais críticas** do app: Cliente 360, listagem de clientes, listagem de casos, Pipeline Operacional Kanban, Ficha do caso, Painel "Hoje". Onde o produto ganha alma.

### 📦 Telas
1. `/` — **Painel "Hoje"** (urgente/hoje/próximos/conquistas)
2. `/clientes` — Lista (tabela densa + filtros + busca)
3. `/clientes/novo` — Form criar (PF/PJ wizard)
4. `/clientes/[id]` — **Cliente 360°** (5 abas)
5. `/clientes/[id]/casos` — aba Casos com `CaseCard` dois rastros
6. `/clientes/[id]/documentos` — aba Docs
7. `/clientes/[id]/timeline` — aba Timeline
8. `/clientes/[id]/financeiro` — aba Financeiro
9. `/clientes/[id]/comunicacao` — aba Comunicação
10. `/casos` — **Pipeline Operacional** Kanban 10 colunas
11. `/casos/lista` — view tabular alternativa
12. `/casos/[id]` — **Ficha do Caso** (2 rastros lado a lado)
13. `/casos/[id]/timeline` — timeline do caso
14. `/casos/[id]/documentos` — docs canônicos
15. `/casos/[id]/auditoria` — audit log

### 🎨 Highlights UX
- **CaseCard** é o componente que sangra mais (dois rastros lado a lado) — pixel-perfect contra PRD 0 §8.2.
- **Pipeline Kanban** com drag-and-drop fluido (`dnd-kit`), gates visuais (drop válido = coluna verde, inválido = vermelho + tooltip).
- **Cliente 360°** usa parallel routes do Next.js (carregamento independente das abas).
- **Painel "Hoje"** é o "rosto" do produto — primeira impressão diária. Tipografia Playfair "Bom dia, Maria 👋", densidade controlada.

### 🛡️ QA
- [ ] Drag-and-drop funcional + acessível (teclado: setas + space)
- [ ] Empty state da lista de clientes ("Importar do Excel?")
- [ ] Realtime mock (refetch cada 30s)
- [ ] Filtros URL via nuqs persistem em refresh
- [ ] Densidade toggle (confortável/padrão/compacto)
- [ ] Performance: pipeline com 200 casos renderiza < 1s

### ⏱ Estimativa
**10-14 dias úteis** · _Em sessão Claude: 5-7 sessões_

---

## Sprint 4 — FIES (parte 2) + Controladoria

### 🎯 Objetivo
Completar fluxos FIES (Termo + Pipeline Financeira) + abrir módulo Controladoria.

### 📦 Telas (~15)

#### FIES parte 2 (8)
- `/casos/financeiro` — Pipeline Financeira 15 colunas + 8 views complementares
- `/casos/financeiro/aguardando-ativacao`, `/parcelas-atrasadas`, `/inadimplencia`, etc. (8 views)
- `/casos/[id]/termo` — Snapshot viewer
- `/casos/[id]/termo/elaborar` — Wizard 4 steps
- `/casos/[id]/termo/conferir` — Conferência (segregação enforced UI)
- `/casos/renovacoes` — Calendário ESF
- `/casos/novas-solicitacoes` — Lista

#### Controladoria (7)
- `/controladoria` — Painel multi-aba
- `/controladoria/prazos` — Lista + calendário
- `/controladoria/movimentacoes` — Lista com filtros
- `/controladoria/movimentacoes/validar` — Fila validação baixa-confiança
- `/controladoria/excecoes` — Centro de Exceções (8 categorias)
- `/controladoria/teses` — Lista + busca semântica mock
- `/controladoria/decisoes` — Lista + filtros

### 🎨 Highlights
- **Termo de Acerto Wizard** (4 steps com progressbar) — cálculo automático mockado, segregação visual elaborador ≠ conferidor.
- **Snapshot viewer** mostra v1, v2 (versionamento).
- **Centro de Exceções** com 4 níveis de prioridade visual.

### ⏱ Estimativa
**10-12 dias úteis**

---

## Sprint 5 — Peticionamento + Comercial

### 🎯 Objetivo
Editor de minutas (com streaming IA mockado) + CRM completo.

### 📦 Telas (~15)

#### Peticionamento (6)
- `/peticionamento` — Lista minutas
- `/peticionamento/nova` — Wizard tipo de peça/caso
- `/peticionamento/checklist/[caseId]` — Prontidão score
- `/peticionamento/[id]` — **Editor de Minuta** (com painel lateral fontes/issues, streaming mock)
- `/peticionamento/[id]/versoes` — Histórico
- `/peticionamento/banco-pecas` — Lista + busca

#### Comercial (9)
- `/comercial` — Painel
- `/comercial/funil` — Funil Kanban 5+ etapas
- `/comercial/leads` — Lista tabular
- `/comercial/leads/[id]` — Detalhe + histórico
- `/comercial/oportunidades` — Cross-sell engine UI
- `/comercial/campanhas` — Meta + Google Ads cards
- `/comercial/email-marketing` — Lista campanhas
- `/comercial/email-marketing/novo` — Editor
- `/comercial/email-marketing/templates` — Editor templates

### 🎨 Highlights
- **Editor minuta** com streaming text (mockando Claude SSE) — cursor pulsando, char-by-char.
- **Watermark "MINUTA — NÃO REVISADA"** sobre o texto.
- **Painel lateral** lista fontes (teses, decisões, docs) clicáveis.
- **Score validação 0-100** visual no rodapé.

### ⏱ Estimativa
**10-14 dias úteis**

---

## Sprint 6 — Marketing + WhatsApp

### 🎯 Objetivo
Pipeline editorial IA + Inbox WhatsApp com chat completo.

### 📦 Telas (~10)

#### Marketing (5)
- `/marketing` — Painel
- `/marketing/calendario` — Calendário editorial (mês/semana/lista)
- `/marketing/conteudos` — Lista
- `/marketing/conteudos/[id]` — Editor multi-tab (Briefing/Roteiro/Copy/Mídia/Compliance)
- `/marketing/banco-midia` — Grid + busca

#### WhatsApp (5)
- `/whatsapp` — Inbox (3 tabs: Inbox/Em Atendimento/Aguardando)
- `/whatsapp/conversas/[id]` — **Chat UI** com painel lateral IA
- `/whatsapp/agente` — Configuração agente
- `/whatsapp/handoffs` — Fila handoffs ativos
- `/whatsapp/templates` — Templates de mensagem

### 🎨 Highlights
- **Calendário editorial** com mini-cards coloridos por tipo (Reel/Podcast/Post/E-mail).
- **Chat WhatsApp** com bolhas de mensagem, painel IA lateral mostrando resumo + dados coletados + ações.
- **Compliance OAB checker** visual no editor de marketing (score + issues).

### ⏱ Estimativa
**8-10 dias úteis**

---

## Sprint 7 — Portal do Cliente + Painel Institucional

### 🎯 Objetivo
Apps `portal/` e `painel/` completos. Mobile-first no portal.

### 📦 Telas

#### Portal Cliente (14, mobile-first)
- `/entrar`, `/recuperar`, `/primeiro-acesso/[token]`
- `/` — Home (lista casos + atalhos)
- `/casos/[id]` — Caso simplificado (linguagem cliente)
- `/documentos`, `/documentos/upload`
- `/boletos`, `/boletos/[id]`
- `/mensagens`, `/mensagens/[thread]`
- `/termos`, `/termos/[id]/aceitar` — **Aceite com 2FA**
- `/perfil`, `/perfil/privacidade`

#### Painel Institucional (6, desktop+tablet)
- `/entrar`
- `/` — Dashboard agregado
- `/associados` — Mapa Brasil + filtros
- `/demandas`, `/resultados`, `/relatorios`

### 🎨 Highlights
- **Portal mobile-first**: bottom nav, touch targets ≥ 44px, câmera para upload, pinch-zoom no PDF.
- **Aceite Termo** com 2FA, registro de evidência (IP, UA, timestamp).
- **Painel ANMR/AMPB**: gráficos agregados anonimizados, mapa do Brasil com pins por estado.

### ⏱ Estimativa
**10-12 dias úteis**

---

## Sprint 8 — Polish + A11y + Performance + Handoff

### 🎯 Objetivo
**Não construir novo** — refinar, validar, documentar e entregar para F3 (testes de usabilidade) → F4 (lógica backend).

### 📦 Atividades

#### Polish visual
- [ ] Microinterações refinadas (todas as 21 do PRD 0 §B.13.2)
- [ ] Page transitions Linear-style
- [ ] Easing functions revisadas
- [ ] Loading states sofisticados (skeletons + Suspense streaming)

#### Acessibilidade — auditoria completa
- [ ] axe-core em 100% das stories
- [ ] Playwright + `@axe-core/playwright` nos 10 fluxos críticos
- [ ] Teste manual NVDA (Windows) nas 3 jornadas mais críticas
- [ ] Teste manual com teclado puro em fluxos completos
- [ ] Contraste validado em todos os pares
- [ ] Touch targets verificados em mobile

#### Performance
- [ ] Lighthouse ≥ 90 em LCP, INP, CLS nas telas-chave
- [ ] Bundle analyzer: cada rota < 200KB First Load JS
- [ ] Imagens otimizadas (AVIF/WebP via `next/image`)
- [ ] Fontes preloaded
- [ ] Suspense boundaries estratégicos

#### Cobertura de testes
- [ ] E2E Playwright nos 10 fluxos críticos verde
- [ ] Storybook test-runner verde
- [ ] Coverage Vitest ≥ 70% em features

#### Internacionalização
- [ ] Estrutura `messages/pt-BR/` validada
- [ ] Zero strings hardcoded (auditoria via lint rule)

#### Print stylesheet
- [ ] Dossiê do cliente PDF exportável
- [ ] Termo PDF oficial com hash

#### Documentação
- [ ] Storybook publicado em `storybook.hyagoviana.adv.br` (Vercel)
- [ ] README do monorepo atualizado
- [ ] Guia de uso de componentes (`docs/design-system.md`)
- [ ] Changelog v0.1.0 → v1.0.0

#### Handoff
- [ ] Sessão de apresentação para Hyago + equipe
- [ ] Documento "Estado da F2" com métricas
- [ ] Lista de hipóteses a validar em F3 (testes usuário)
- [ ] Tickets prontos para F4 (backend)

### ⏱ Estimativa
**8 dias úteis**

---

## 11. Ritual de validação multi-agente

> **Ao final de CADA sprint, todos os 4 agentes + 2 skills passam por aprovação obrigatória antes de iniciar o próximo.**

### Cerimônia "Sprint Review" (1-2h)

```
1. @pm apresenta:
   - Stories completadas vs planejadas
   - ACs cumpridos
   - Demonstração funcional (deploy preview)

2. @architect valida:
   - Decisões técnicas seguidas
   - Não há débito técnico crítico
   - ADRs respeitadas
   - Estrutura de pastas íntegra

3. @ux-design-expert valida:
   - Pixel-perfect contra PRD 0
   - Microinterações aplicadas
   - Identidade HV preservada
   - Empty/error states cobertos

4. @qa executa:
   - Checklist de DoD
   - Smoke test E2E
   - axe-core audit
   - Lighthouse pontuação

5. skill `frontend-design` valida:
   - Anti-AI-slop check
   - Tipografia disciplinada
   - Sem decoração gratuita

6. skill `web-design-guidelines` audita:
   - WCAG 2.2 AA conformidade
   - Whitespace adequado
   - Hierarquia visual clara

7. Sprint go/no-go:
   ✅ Todos aprovam → Sprint N+1 inicia
   ❌ Algum bloqueia → spike de correção (1-2 dias)
```

### Documentação produzida por cerimônia
- `sprint-N-review.md` com decisões, prints, ACs marcados, débitos identificados.

---

## 12. Definição de Pronto (DoD) — global

> **Aplica a TODA story de TODA sprint. Não-negociável.**

### Código
- [ ] PR aprovado por 1+ reviewer humano (em produção real) ou auto-validado nas cerimônias
- [ ] CI verde: lint + typecheck + vitest + playwright (fluxos tocados)
- [ ] Cobertura de teste mínima respeitada (60% utils, 80% schemas)
- [ ] Zero `any` introduzido
- [ ] Zero `console.log` deixado para trás
- [ ] Zero `// TODO` sem ticket vinculado

### Design
- [ ] Stories no Storybook (componentes)
- [ ] Pixel-perfect contra PRD 0 (telas)
- [ ] Responsividade testada em xs/md/xl
- [ ] Dark mode plugável (mesmo que opt-in V2)
- [ ] Microinterações aplicadas

### Acessibilidade
- [ ] axe-core sem violations critical/serious
- [ ] Navegação por teclado funcional
- [ ] Foco visível em todos elementos interativos
- [ ] ARIA labels em ícones-botão
- [ ] Contraste verificado

### Performance
- [ ] Bundle não cresceu > 10% sem justificativa
- [ ] Lighthouse Performance ≥ 85
- [ ] Imagens otimizadas

### Documentação
- [ ] Comentários apenas no "porquê" (não "o quê")
- [ ] README atualizado se mudou setup
- [ ] Changelog entrada criada

### Validação multi-agente
- [ ] @pm: AC cumprido
- [ ] @architect: aderente às ADRs
- [ ] @ux: visual aprovado
- [ ] @qa: checklist completo
- [ ] skills: validação registrada

---

## 13. Métricas de saúde do projeto

> **Dashboard semanal** (atualizado pelo @qa).

| Métrica | Meta | Como medir |
|---|---|---|
| **Velocity** | 5-8 stories/sprint | Contagem no fim do sprint |
| **CI green rate** | ≥ 95% PRs | GitHub Actions |
| **a11y violations** | 0 critical, 0 serious | axe-core |
| **Bundle size first load** | < 200KB | next bundle analyzer |
| **Lighthouse Performance** | ≥ 85 | Lighthouse CI |
| **Lighthouse A11y** | ≥ 95 | Lighthouse CI |
| **Cobertura testes** | ≥ 70% features | Vitest coverage |
| **Storybook coverage** | 100% componentes UI | Manual review |
| **Sprint Review go-rate** | 100% | Cerimônia |

---

## 🚀 Próximos passos

1. **Você aprova este plano** → resposta "GO Sprint 1"
2. **Eu disparo Sprint 1**:
   - Crio pasta `sistema-hv/` ao lado de `docs/`
   - Setup monorepo + Turborepo + pnpm
   - Configuro 3 apps Next.js 15
   - Crio 6 packages
   - Implemento tokens, app shell, auth mock, login
   - Setup MSW + fixtures iniciais
   - Storybook com 5 componentes seed
   - CI GitHub Actions
   - README + docs

3. **Ao final do Sprint 1**, rodo o **ritual de validação multi-agente** e te apresento o resultado.

4. **Após aprovação**, parte Sprint 2.

---

> **Status:** Sprints Plan aprovado para execução.
> **Owner:** Orion (Orchestrator)
> **Próxima ação:** Aguardar GO para iniciar Sprint 1.
>
> _— @pm + @architect + @ux-design-expert + @qa + skills `frontend-design` + `web-design-guidelines`, sob coordenação de Orion 🎯_
