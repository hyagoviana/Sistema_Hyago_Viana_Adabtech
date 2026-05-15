# 🎨 Sprint 2 — Design System Core (Passo a Passo)

> **Versão:** 1.0 · **Status:** Pronto para execução
> **Pré-requisitos:** Sprint 1 ✅ concluído e validado

---

## 🎯 Objetivo

Construir **~50 componentes** que servem de blocos de Lego para todas as telas dos próximos sprints. Cada componente vive no Storybook com 5+ stories (default, loading, empty, error, full).

## 📦 Definição de Pronto

- [ ] 50 componentes implementados em `packages/ui`
- [ ] 50 Storybook stories (uma por componente principal)
- [ ] 100% axe-core verde
- [ ] 100% navegação por teclado funcional
- [ ] Cobertura Vitest 80%+ em componentes com lógica
- [ ] Documentação por componente (TSDoc)

---

## 📋 Passo a passo por épico

### ÉPICO A — Primitives (20 componentes)

#### Bloco A.1 — Forms (Passos 1-5)

**Passo 1 · Input + Label + FormField**
- `primitives/Input.tsx`: height 40px (default), 32px (sm), 48px (lg); border `#e8e8e8`; focus ring gold
- `primitives/Label.tsx`: Radix Label
- `primitives/FormField.tsx`: wrapper RHF (label + input + error message + helper text)
- Stories: default, error, disabled, with-helper, with-icon-left
- AC: axe verde, ESC limpa foco, validação inline em onBlur

**Passo 2 · Textarea**
- Min height 80px, auto-grow opcional
- Mesmo padrão visual do Input
- Stories: default, error, disabled, large

**Passo 3 · Select + Combobox + MultiSelect**
- `Select.tsx`: Radix Select com search opcional
- `Combobox.tsx`: cmdk-based (autocomplete)
- `MultiSelect.tsx`: chips removíveis
- AC: keyboard nav (↑↓ Enter Esc), ARIA roles

**Passo 4 · DatePicker + DateRangePicker + TimePicker**
- Base: `react-day-picker`
- Locale pt-BR
- Stories: single, range, with-min-max, disabled-dates

**Passo 5 · Checkbox + Radio + Switch**
- Radix primitives customizados
- Tokens HV (border `#e8e8e8` → gold quando checked)
- AC: foco visível, label clicável, ARIA

#### Bloco A.2 — Action (Passos 6-7)

**Passo 6 · Button (já existe do Sprint 1) + IconButton + ButtonGroup**
- IconButton: variante específica do Button (size icon)
- ButtonGroup: container que une botões adjacentes
- Stories: todas variants + sizes + loading state

**Passo 7 · SplitButton + FAB**
- SplitButton: ação principal + dropdown
- FAB: floating action (mobile)

#### Bloco A.3 — Display (Passos 8-10)

**Passo 8 · Badge + Tag + Chip**
- Badge: estados (success/warning/danger/info) + neutral
- Tag: removível
- Chip: container para filtros aplicados

**Passo 9 · Avatar + AvatarGroup**
- Avatar com fallback (iniciais), tamanhos sm/md/lg
- AvatarGroup com max e contador "+N"

**Passo 10 · Tooltip + Popover**
- Radix base
- Delay 500ms default
- Animation fade + slight scale

### ÉPICO B — Layout (8 componentes)

**Passo 11 · AppShell**
- Composição Sidebar + Topbar + Main
- Já implementado parcial no Sprint 1, refinar
- Variante: collapsed sidebar (1024-1279px)

**Passo 12 · Sidebar (refino)**
- Versão drawer para mobile (<1024px)
- Group separators
- Tooltip em modo collapsed

**Passo 13 · Topbar (refino)**
- Breadcrumb dinâmico (usando next/navigation)
- Command palette trigger (⌘K)
- Notification bell com badge

**Passo 14 · PageHeader**
- Title (Playfair) + subtitle + actions slot
- Breadcrumb opcional acima

**Passo 15 · ContentContainer**
- max-width 1280px centralizado
- Padding responsivo

**Passo 16 · Drawer (lateral)**
- Radix Dialog com slide-in from right
- 480/640px width
- Backdrop opcional

**Passo 17 · Sheet (bottom — mobile)**
- 100% width × 75% height
- Swipe to close (mobile)

**Passo 18 · Modal/Dialog**
- 480px default, 600px large
- Backdrop blur 4px
- Animation fade + scale 0.96→1.0

### ÉPICO C — Display (10 componentes)

**Passo 19 · Card (refino)**
- Variantes: default, interactive (hover state), selected (faixa dourada)
- Slots: header, content, footer

**Passo 20 · Divider**
- Horizontal + vertical
- Optional label inline

**Passo 21 · Accordion**
- Radix Accordion
- Animação suave de expand/collapse

**Passo 22 · Tabs**
- Radix Tabs
- Underline gold no active tab
- Slide-out + slide-in animação 200ms

**Passo 23 · Breadcrumb**
- Auto-gerado da URL ou manual
- Lucide chevron-right separator
- Última item bold

**Passo 24 · Skeleton**
- Shimmer animation
- Variantes: text, circle, rect

**Passo 25 · EmptyState**
- Icon (Lucide 48px) + title + description + CTA primary + CTA secondary
- Stories: 5 variantes (sem casos, sem leads, busca vazia, etc.)

**Passo 26 · ErrorBoundary**
- React 19 ErrorBoundary
- UI: ícone alert + título + "Tentar novamente"

**Passo 27 · Spinner**
- Loader2 Lucide com animate-spin
- Variantes: inline, fullscreen, with-text

**Passo 28 · Stepper**
- Multi-step wizard (1/4 → 2/4 → ...)
- Step states: pending, active, completed, error

### ÉPICO D — Composites (12 — chave do produto)

**Passo 29 · DataTable**
- TanStack Table v8
- Sorting, filtering, pagination, density toggle (confortável/padrão/compacto)
- Row selection (single/multi)
- Sticky header
- Empty state integrado
- Loading skeleton rows
- AC: keyboard nav, ARIA grid

**Passo 30 · PipelineBoard (Kanban)**
- dnd-kit (drag-and-drop acessível)
- Compound: `<PipelineBoard><PipelineBoard.Column /></PipelineBoard>`
- Gates visuais: drop válido (coluna verde) / inválido (vermelho + tooltip)
- Mode toggle: Kanban / Lista
- AC: drag por mouse + teclado (setas + space), ARIA live regions

**Passo 31 · KanbanCard**
- Variantes: compact (lista densa), default, expanded (com timeline mini)
- Slots: header (badges), body, footer (next-action)
- AC: focável, "enter" abre detail

**Passo 32 · CommandPalette (⌘K)**
- cmdk-based
- Categorias: Ações rápidas, Ir para, Resultados recentes
- Busca debounced
- AC: ⌘K + Ctrl+K, ↑↓ Enter Esc, fuzzy match

**Passo 33 · NotificationsBell**
- Badge counter
- Dropdown lista (max 5 + "Ver todas")
- Mark as read (single + all)

**Passo 34 · TimelineFeed**
- Item compositional: timestamp + actor avatar + action description + payload
- Agrupamento por dia ("Hoje", "Ontem", "Há 3 dias")
- Cursor pagination

**Passo 35 · MacrostatusBadge**
- Cor por status + ícone bullet + texto + dias-em-estado + semáforo SLA
- Variantes: operacional (8 estados), financeiro (15 estados)
- AC: aria-label completo

**Passo 36 · NextActionFooter**
- Ícone 👉 + texto da próxima ação + responsável + prazo + CTA "Iniciar →"
- Sempre presente em cards expandidos

**Passo 37 · AlertStrip**
- Banner inline no cabeçalho de páginas
- Variantes: warning, danger, info, success
- Dismissible opcional

**Passo 38 · DocumentRow**
- Item de lista de documentos
- Status badge (PENDENTE/RECEBIDO/APROVADO/DISPENSADO)
- Actions: view, download, replace

**Passo 39 · AuditEntry**
- Linha de audit log
- Actor + action + entity + timestamp + diff toggle

**Passo 40 · MaskedField (LGPD)**
- Display: `***.***.789-00` ou `123.456.789-00` baseado em `canReveal`
- Botão eye toggle (com permissão)
- AC: registra view em audit log

### ÉPICO E — Feedback (Passos 41-45)

**Passo 41 · Toast (Sonner)**
- Configuração + custom render
- Variantes: success, error, warning, info, loading, promise

**Passo 42 · Alert (inline)**
- Mesmo formato do Toast mas estático em página
- Slots: icon, title, description, actions

**Passo 43 · ConfirmDialog**
- Modal de confirmação destrutiva
- Type-to-confirm (digitar código para liberar botão)
- Variantes: destructive, warning, info

**Passo 44 · ContextMenu**
- Radix ContextMenu
- Right-click em itens (casos, clientes, etc.)

**Passo 45 · ProgressBar + Sparkline + StatCard**
- ProgressBar: linear + circular
- Sparkline: mini chart inline
- StatCard: KPI com number + trend + sparkline

---

## ✅ Validação multi-agente

### @pm
- [ ] 50 componentes implementados
- [ ] Todos com stories no Storybook
- [ ] Demo: visitar Storybook e cobrir todos

### @architect
- [ ] CVA padrão em todos os componentes com variants
- [ ] ref forwarding em todos primitives
- [ ] Compound pattern em DataTable, PipelineBoard
- [ ] Zero dependências circulares entre packages

### @ux-design-expert
- [ ] Pixel-perfect contra PRD 0 §8 (Anatomias)
- [ ] Microinterações iniciais aplicadas (hover, focus, active)
- [ ] Estados ricos (5+ por componente quando aplicável)
- [ ] Tipografia disciplinada (max 2 weights por componente)

### @qa
- [ ] axe-core verde em 100% das stories
- [ ] Vitest: cobertura 80%+ em componentes com lógica
- [ ] Storybook test-runner verde
- [ ] Manual nav teclado em todos componentes interativos

### skill `frontend-design`
- [ ] Aesthetic intencional preservada
- [ ] Sem decoração gratuita
- [ ] Compound components corretamente estruturados

### skill `web-design-guidelines`
- [ ] WCAG 2.2 AA todos componentes
- [ ] Contraste ≥ 4.5:1 em texto
- [ ] Touch targets ≥ 44px em interativos

---

## ⏱ Estimativa

**8-12 dias úteis** · _Em sessão Claude: 4-6 sessões intensas (10 componentes por sessão)_

---

> _Próximo:_ **Sprint 3 — Cliente 360° + FIES (parte 1)**
> _— Orion, orquestrando o sistema 🎯_
