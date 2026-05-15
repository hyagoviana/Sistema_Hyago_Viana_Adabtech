# ✨ Sprint 8 — Polish + A11y + Performance + Handoff — Passo a Passo

> **Versão:** 1.0 · **Status:** Pronto para execução
> **Pré-requisitos:** Sprints 1-7 ✅ concluídos e validados

---

## 🎯 Objetivo

**Não construir novo** — refinar, validar, documentar e entregar para **F3 (testes de usabilidade)** → **F4 (lógica backend)**.

## 📦 Definição de Pronto

- [ ] 21 microinterações refinadas (PRD 0 §B.13.2)
- [ ] Lighthouse ≥ 90 em LCP, INP, CLS nas 10 telas-chave
- [ ] axe-core 100% das stories + jornadas críticas verde
- [ ] Bundle First Load JS < 200KB por rota
- [ ] E2E Playwright 10 jornadas críticas verde
- [ ] Storybook publicado em `storybook.hyagoviana.adv.br`
- [ ] Documentação completa
- [ ] Apresentação para Hyago + equipe realizada

---

## 📋 Passo a passo

### BLOCO A — Polish visual (Passos 1-4)

#### Passo 1 · Microinterações refinadas
Implementar as 21 microinterações do PRD 0 §B.13.2:
- Hover em link: cor + underline gold expand left-to-right 200ms
- Hover em CaseCard: border `#e8e8e8` → `#d4d4d4` + shadow `0 1px 2px` 150ms
- Hover em item sidebar: background fade-in `#fafafa` 150ms
- Focus em input: border 1px → 1px gold + ring 3px gold/15% 150ms ease-out
- Click em botão: scale 1 → 0.98 → 1 em 100ms
- Drag-drop: card eleva, tilt 1deg, cursor grabbing
- Drop válido: coluna acende verde sutil
- Drop inválido: coluna pulsa vermelho + tooltip motivo
- Toast aparece: slide-in 200ms direita + leve scale
- Toast desaparece: slide-out 250ms + fade
- Modal aparece: backdrop fade 150ms + scale 0.96→1.0 200ms
- Tab switch: underline gold slide-out + slide-in 200ms ease
- Skeleton shimmer: gradient 1.2s loop
- Stream IA: cursor pulsa, char-by-char com easing
- Loading button: texto + spinner inline
- Counter update: number tick suave (1→2→3) 100ms
- Drag handle: aparece só no hover do card (gold)
- Underline em link: gradient gold left-to-right (Linear-style)
- Tooltip: fade-in 100ms após 500ms hover delay

#### Passo 2 · Page transitions
Padrão Linear-style:
- Mudança de rota: conteúdo principal slide-fade 200ms (next-view-transitions)
- Sidebar permanece estática (sem reanimar)
- TopBar permanece estática
- URL e document.title atualizam

#### Passo 3 · Easing functions revisadas
- `ease-out: cubic-bezier(0.16, 1, 0.3, 1)` ← default entradas
- `ease-in: cubic-bezier(0.4, 0, 1, 1)` ← saídas
- `ease-in-out: cubic-bezier(0.65, 0, 0.35, 1)` ← reversíveis
- Auditar arquivos: substituir `transition-all duration-200` genérico por durations/easings corretas

#### Passo 4 · Loading states sofisticados
- Skeletons matching exato layout (não placeholders genéricos)
- Streaming SSR com Suspense boundaries em Cliente 360 (cada aba carrega independente)
- Long operations:
  - Migração: progress bar com counter X/Y + tempo estimado
  - IA gerando minuta: streaming text com cursor pulsando

### BLOCO B — Acessibilidade — auditoria completa (Passos 5-9)

#### Passo 5 · axe-core 100% Storybook
- Storybook test-runner com `@storybook/test-runner` + `axe-playwright`
- CI integrado: PR bloqueado se violation critical/serious
- Comando: `pnpm --filter @hv/ui test-storybook`

#### Passo 6 · Playwright + `@axe-core/playwright`
- 10 jornadas críticas com `injectAxe()` + `checkA11y()`
- Asserção: `expect(violations).toEqual([])` em cada
- Jornadas listadas no PRD frontend-architecture.md §5.5

#### Passo 7 · Testes manuais
- **NVDA (Windows)** em 3 jornadas críticas:
  - Login → Cliente 360 → abrir caso
  - Pipeline FIES drag-drop por teclado
  - Aceite Termo no Portal mobile
- **Teclado puro** em fluxos completos (sem mouse)

#### Passo 8 · Contraste auditoria
- Stark CLI ou similar para varrer todos os pares cor texto/fundo
- Fix qualquer < 4.5:1 para texto normal ou < 3:1 para texto grande

#### Passo 9 · Touch targets mobile
- Auditoria visual nas telas do Portal: todo elemento clicável ≥ 44×44px
- Fix se algum link/botão pequeno

### BLOCO C — Performance (Passos 10-13)

#### Passo 10 · Lighthouse CI
- Configurar `lighthouserc.json` com targets por rota
- Rodar em CI no push para main
- 10 telas-chave: LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1

#### Passo 11 · Bundle analyzer
- `@next/bundle-analyzer` em cada app
- Identificar bibliotecas > 50KB sem justificativa
- Lazy load:
  - Editor rich text (Tiptap/Lexical) — dynamic import
  - Recharts/visx — só nas páginas de dashboard
  - PDF viewer — só nas telas de Termo
- Budget: First Load JS < 200KB por rota

#### Passo 12 · Imagens
- Auditar todas: AVIF/WebP via `next/image`
- LCP image preloaded
- Lazy load below-the-fold

#### Passo 13 · Fonts
- Preload Inter regular + Playfair Display
- `font-display: swap`
- Self-host fallback se Google Fonts lento

### BLOCO D — Cobertura de testes (Passos 14-16)

#### Passo 14 · E2E Playwright 10 jornadas
1. Login → painel Hoje → abrir caso FIES → Cliente 360°
2. Pipeline FIES: arrastar card A → B (mouse + teclado)
3. Gerar minuta com streaming mock
4. Aceitar Termo no Portal mobile
5. Triagem WhatsApp: thread → handoff
6. Criar tese em Controladoria
7. Filtros URL persistem em refresh
8. Toggle dark mode persiste (V2 plugável)
9. Permissão: Comercial não vê Controladoria
10. Acessibilidade: navegação teclado todas as 10

#### Passo 15 · Storybook test-runner
- 100% das stories passam interactions + a11y
- CI integrado

#### Passo 16 · Vitest coverage
- ≥ 70% em features (não em UI components — esses cobrem via Storybook)
- Schemas Zod: 100% (test cada caso válido/inválido)
- Utils: 100%

### BLOCO E — Internacionalização (Passo 17)

#### Passo 17 · i18n preparada
- Estrutura `messages/pt-BR/<namespace>.json`
- ESLint custom rule: bloquear strings hardcoded em JSX (warn por enquanto)
- Função `t()` simples (sem next-intl em V1)
- Pronto para plugar `next-intl` em F9

### BLOCO F — Print stylesheet (Passo 18)

#### Passo 18 · PDFs exportáveis
- **Dossiê do cliente**: rota `/clientes/[id]/dossie` com `@media print`
  - Header fixo + tabelas paginadas + footer paginação
  - Botão "Imprimir" usa `react-to-print` ou window.print()
- **Termo PDF oficial**: render como página `/termos/[id]/pdf` com layout específico
  - Hash SHA-256 visível
  - QR code de verificação (mock)

### BLOCO G — Dark mode plugável (Passo 19)

#### Passo 19 · Dark mode opt-in
- next-themes configurado
- Tokens dark em `[data-theme="dark"]`:
  ```css
  [data-theme="dark"] {
    --color-bg: #0a0a0a;
    --color-bg-subtle: #171717;
    --color-fg: #fafafa;
    --color-fg-muted: #a3a3a3;
    --color-border: #262626;
    /* navy e gold mantém */
  }
  ```
- Toggle em `/perfil/preferencias`
- Storybook com toolbar global theme

### BLOCO H — Documentação (Passos 20-22)

#### Passo 20 · Storybook publicado
- Deploy Vercel separado em `storybook.hyagoviana.adv.br`
- Auth básica (Vercel Password Protection) — não público

#### Passo 21 · Guia de uso
- `docs/design-system.md` no monorepo
- Como usar cada componente compartilhado
- Patterns + anti-patterns
- Exemplos copy-paste

#### Passo 22 · README + Changelog
- README do monorepo atualizado com:
  - Estrutura
  - Setup
  - Comandos
  - Convenções
  - Onboarding (10 min para novo dev produzir)
- CHANGELOG.md com `v0.1.0` → `v1.0.0` (entrega F2)

### BLOCO I — Handoff F3/F4 (Passos 23-25)

#### Passo 23 · Apresentação para Hyago + equipe
- Demo live ao vivo das 115 telas
- Cobertura de jornadas top-15
- Métricas: Lighthouse, axe, bundle size, coverage
- Lista de hipóteses a validar em F3 (testes usuário)

#### Passo 24 · Documento "Estado da F2"
- `docs/F2-completion-report.md`:
  - Telas implementadas vs PRD 0
  - Componentes do design system
  - Métricas finais
  - Decisões tomadas durante execução (ADRs add)
  - Débitos técnicos conhecidos
  - Hipóteses para validar em F3

#### Passo 25 · Tickets para F4 (backend)
- Lista de tickets para cada PRD de módulo:
  - PRD 1: ~80 tickets (Supabase, RLS, integrações)
  - PRDs 2-6: estimativas
- Prioridades, dependências, owners sugeridos

---

## ✅ Validação multi-agente final

### @pm
- [ ] Demo end-to-end das 115 telas
- [ ] Apresentação para Hyago realizada
- [ ] Aprovação formal para F3

### @architect
- [ ] Zero débitos técnicos críticos
- [ ] Documentação de ADRs atualizada
- [ ] Estrutura preparada para F4 (swap mock → real é troca de baseURL + remoção MSW)

### @ux-design-expert
- [ ] Microinterações refinadas
- [ ] Linguagem visual coerente em 115 telas
- [ ] Sem inconsistências visuais entre módulos

### @qa
- [ ] Lighthouse Performance ≥ 90 em telas-chave
- [ ] Lighthouse Accessibility ≥ 95
- [ ] axe-core 100% verde
- [ ] E2E 10 jornadas verde
- [ ] Coverage ≥ 70% features
- [ ] Bundle < 200KB First Load

### skill `frontend-design`
- [ ] Sistema visualmente premium e distinto
- [ ] Nenhuma tela "genérica"
- [ ] Identidade HV preservada em 100%

### skill `web-design-guidelines`
- [ ] WCAG 2.2 AA conformidade auditada
- [ ] Best practices respeitadas

---

## 🎯 Critério de "F2 finalizada" → "F3 pode começar"

- ✅ Sistema navegável end-to-end em deploy preview Vercel
- ✅ Hyago aprovou apresentação
- ✅ 10 jornadas críticas tocáveis
- ✅ Métricas todas verdes
- ✅ Storybook publicado
- ✅ Documentação completa
- ✅ Time externo (F3 — testes de usabilidade) tem acesso

---

## ⏱ Estimativa

**8 dias úteis**

---

## 🚀 Próxima fase: F3 — Testes de Usabilidade

5 usuários reais executam top-15 jornadas críticas:
- 1 sessão de 1h cada usuário
- Observação remota gravada (com consentimento)
- Análise dos pain points
- Iterações finais antes de F4 (backend)

Após F3 ok → **F4 — Aplicar lógica Projeto 1 (FIES) sobre UI pronta**.

---

> _Sprint 8 detalhado. Fim da Fase F2 — Design system + frontend mock-first._
> _— Orion, orquestrando o sistema 🎯_
