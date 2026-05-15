# 🎨 PRD 0 — UX & Design System

> **Plataforma Unificada Hyago Viana Advocacia**
> **Versão:** 1.2 · **Data:** 2026-05-15 · **Owner:** @ux-design-expert (lead) + Orion · **Status:** Aprovado como Design Bible (F0)
>
> **Changelog:**
> - **v1.0** (inicial) — Design tokens, componentes, padrões de layout, WCAG 2.2 AA
> - **v1.1** (Addendum) — Direção Clean Light Premium: predominantemente branco, navy/gold como accents cirúrgicos
> - **v1.2** (Addendum) — Sistema Unificado End-to-End: 115 telas, login, multi-tenancy, empty/error states, ⌘K, notificações, microinterações, estratégia design-first/mock-first
>
> _Este PRD define a **linguagem visual e a sintaxe de interação compartilhada** por todos os 6 módulos. É consumido por PRDs 1–6._

---

## Sumário

1. [Visão de design](#1-visão-de-design)
2. [Princípios](#2-princípios)
3. [Brand foundations](#3-brand-foundations)
4. [Design tokens](#4-design-tokens)
5. [Tipografia](#5-tipografia)
6. [Iconografia & ilustração](#6-iconografia--ilustração)
7. [Grid, espaçamento e elevação](#7-grid-espaçamento-e-elevação)
8. [Componentes UI](#8-componentes-ui)
9. [Padrões de layout (templates de página)](#9-padrões-de-layout)
10. [Estados, feedback e motion](#10-estados-feedback-e-motion)
11. [Acessibilidade WCAG 2.2 AA](#11-acessibilidade)
12. [Internacionalização](#12-internacionalização)
13. [Performance UX](#13-performance-ux)
14. [Voz, tom e microcopy](#14-voz-tom-e-microcopy)
15. [Mapa de telas global (sitemap)](#15-mapa-de-telas-global)
16. [Wireframes-chave](#16-wireframes-chave)
17. [Padrões transversais por módulo](#17-padrões-transversais-por-módulo)
18. [Métricas UX e validação](#18-métricas-ux-e-validação)
19. [Entregáveis & implementação](#19-entregáveis--implementação)

---

## 1. Visão de design

> **"Whiteboard refinado — clean, predominantemente branco, com navy de assinatura e dourado de luxo cirúrgico."**

A plataforma é uma ferramenta profissional usada por advogados durante 8 horas diárias. Densidade é necessária; **clareza é obrigatória.** A estética é **light-mode-first, com 90% das telas em branco puro ou off-white**. Navy (`#1e2044`) e dourado (`#987814`) aparecem como **accents cirúrgicos**, jamais como massas de cor. Sem gradients, sem decoração, sem AI-slop — elegância vem do equilíbrio, da tipografia e do whitespace generoso.

### 🎯 Proporção visual obrigatória

| Cor | Proporção da tela | Onde |
|---|---|---|
| **Branco (`#ffffff`, `#fafafa`)** | **70%** | Fundo de páginas, cards, sidebar, modais |
| **Cinzas neutros** | **20%** | Bordas, dividers, texto secundário, hover states |
| **Navy `#1e2044`** | **7%** | Títulos, botões primários, ícones de destaque, números importantes |
| **Dourado `#987814`** | **3%** | Indicador de seleção ativa, badge premium, logo, hover de links |

> **Dourado é especiaria, não molho.** Navy é tinta, não base.

### Referências de boa prática que adotamos

- **Linear** — densidade controlada, motion sutil, atalhos de teclado.
- **Notion** — hierarquia tipográfica, lateral persistente.
- **Stripe Dashboard** — tabelas densas, estados visuais ricos.
- **Vercel** — modo escuro elegante, foco em conteúdo.
- **Clio / MyCase** — referências de mercado em legal-tech (sem copiar; melhor que elas).

### O que **rejeitamos**

- ❌ Aesthetic genérico de "SaaS azul" com ilustrações de pessoinhas.
- ❌ "Material Design puro" — frio demais para o segmento.
- ❌ Skeumorfismo de papel/livro/processo.
- ❌ Acordeões e modais sobre modais.

---

## 2. Princípios

| # | Princípio | Manifestação concreta |
|---|---|---|
| **DP0** | **Whitespace é luxo** | Cada tela tem **48px** de respiração no topo. Cards têm padding interno de 24px. Densidade vem do número de elementos, não da redução de margens. |
| **DP1** | **Próxima ação sempre visível** | Todo card (caso, tarefa, oportunidade) exibe explicitamente "o que fazer agora" no rodapé. Nunca o usuário precisa adivinhar. |
| **DP2** | **Densidade controlada** | Listas têm 3 modos: confortável (8 itens/tela), padrão (15), compacto (25). Default: padrão. |
| **DP3** | **Estados ricos** | Macrostatus, badges, dias-em-estado: cor + ícone + texto, nunca só cor (acessibilidade). |
| **DP4** | **Atalhos de teclado obrigatórios** | `⌘K` para busca global, `g` `c` para Casos, `g` `t` para Tarefas, etc. |
| **DP5** | **Feedback imediato** | Optimistic UI para ações reversíveis; spinners apenas para >300ms. |
| **DP6** | **Erros recuperáveis** | Toda mensagem de erro diz: o que aconteceu + por quê + o que fazer. Nunca só "Erro 500". |
| **DP7** | **Modo claro e escuro** | Ambos suportados; escuro é default em horários noturnos (opt-in). |
| **DP8** | **Mobile no que é móvel** | Portal do Cliente, agente WhatsApp: mobile-first. App interno: desktop-first com responsivo até tablet. |
| **DP9** | **Confirmação proporcional ao risco** | Editar nota: salva automático. Cancelar caso: confirmação dupla com tipagem do código do caso. |
| **DP10** | **Auditoria visível** | Toda mudança consequente registra "quem, quando, o quê" no lateral do registro. |

---

## 3. Brand foundations

### 3.1 Logo

- **Versão primária:** logo HV (símbolo dourado) + texto "HYAGOVIANA ADVOCACIA" navy, separado por barra vertical.
- **Versão app interno (header):** apenas símbolo HV em dourado sobre fundo navy (`#1e2044`).
- **Versão monocromática:** preto sobre claro / branco sobre escuro.
- **Área de proteção mínima:** altura do "H" da palavra "HYAGOVIANA" ao redor.
- **Tamanho mínimo:** 24px de altura para o símbolo isolado.

### 3.2 Cores principais (já definidas)

```
Navy   #1e2044   (primária, autoridade)
Gold   #987814   (secundária, premium accent)
Light  #e8e8e8   (neutro claro)
Black  #000000   (texto sobre claro)
```

### 3.3 Personalidade da marca

| Eixo | Posição | Anti-posição |
|---|---|---|
| Formal ↔ Casual | **Formal** | (não casual) |
| Sério ↔ Lúdico | **Sério** | (não lúdico) |
| Tradicional ↔ Inovador | **Inovador com respeito ao tradicional** | (não disruptivo agressivo) |
| Premium ↔ Acessível | **Premium** | (não popular) |
| Quente ↔ Frio | Equilibrado, levemente quente (gold) | (não gelado) |

---

## 4. Design tokens

> Tokens publicados em `tokens.json` (Style Dictionary) e exportados como CSS vars + Tailwind config + tipos TS.

### 4.1 Cores semânticas (paleta expandida)

```yaml
# === BASE PALETTE ===
navy:
  50:  '#f4f5fa'
  100: '#dadcec'
  200: '#b5b9d9'
  300: '#8c92be'
  400: '#5e6699'
  500: '#3a4275'
  600: '#1e2044'   # ★ brand primary
  700: '#181a37'
  800: '#11132a'
  900: '#0b0c1d'

gold:
  50:  '#fbf8ee'
  100: '#f3eccc'
  200: '#e6d68f'
  300: '#d8be53'
  400: '#bc9d2c'
  500: '#987814'   # ★ brand secondary
  600: '#7b6010'
  700: '#5d490c'
  800: '#3e3108'
  900: '#1f1804'

neutral:
  0:   '#ffffff'
  50:  '#fafafa'
  100: '#f5f5f5'
  200: '#e8e8e8'   # ★ brand light
  300: '#d4d4d4'
  400: '#a3a3a3'
  500: '#737373'
  600: '#525252'
  700: '#404040'
  800: '#262626'
  900: '#171717'
  1000: '#000000'  # ★ brand black

# === SEMANTIC ===
semantic:
  success:  '#16a34a'   # green-600
  warning:  '#ca8a04'   # yellow-600
  danger:   '#dc2626'   # red-600
  info:     '#2563eb'   # blue-600

# === STATUS (módulo FIES — usados em badges de macrostatus) ===
status:
  onboarding:           '#737373'   # neutral
  triagem:              '#737373'
  docs-pendentes:       '#ca8a04'   # yellow
  dgm-enviada:          '#ea580c'   # orange
  pronto-protocolo:     '#2563eb'   # blue
  acompanhamento-adm:   '#0891b2'   # cyan
  judicial-operacional: '#7c3aed'   # purple
  implantado:           '#16a34a'   # green
  encerrado-operacional:'#15803d'   # green dark
  cancelado:            '#525252'   # dark neutral
  ativo:                '#0d9488'   # teal
  inadimplente:         '#dc2626'   # red
  judicial-financeiro:  '#9333ea'   # purple dark
  quitado:              '#16a34a'
  suspenso:             '#737373'

# === DIAS EM ESTADO (semáforo) ===
sla:
  ok:      '#16a34a'   # < 30d
  warning: '#ca8a04'   # 30-45d
  danger:  '#dc2626'   # > 45d
```

### 4.2 Cores funcionais (modo claro — ★ light-first)

| Token | Hex | Uso |
|---|---|---|
| `bg.app` | `#ffffff` | Fundo geral do app (branco puro) |
| `bg.surface` | `#ffffff` | Cards, modais, painéis (mesmo do app — diferença é só border) |
| `bg.subtle` | `#fafafa` | Áreas secundárias, hover state em itens |
| `bg.muted` | `#f5f5f5` | Skeletons, áreas inertes |
| `bg.sidebar` | `#ffffff` | **Sidebar branca** (border-right define separação) |
| `bg.sidebar.item.active` | `#fafafa` | Item ativo da sidebar (sutil) |
| `bg.topbar` | `#ffffff` | TopBar (border-bottom define separação) |
| `text.primary` | `#171717` | Texto principal |
| `text.secondary` | `#525252` | Texto secundário, items inativos da sidebar |
| `text.muted` | `#a3a3a3` | Texto desabilitado / placeholder |
| `text.accent.navy` | `#1e2044` | Títulos importantes, item sidebar ativo, números destacados |
| `text.accent.gold` | `#987814` | Reservado para badges premium e hover links |
| `border.default` | `#e8e8e8` | Bordas de cards, sidebar, topbar |
| `border.subtle` | `#f5f5f5` | Divisores muito sutis |
| `border.strong` | `#d4d4d4` | Inputs em foco |
| `mark.active` | `#987814` | **Faixa dourada 2px** indicando item ativo (assinatura da marca) |
| `accent.primary` | `#1e2044` | Botões primários (texto: `#ffffff`), links |
| `accent.secondary` | `#987814` | Badges premium, indicador seleção, hover links |
| `focus.ring` | `#987814` 40% alpha | Anel de foco (3px) |

> **Regra de ouro:** se você vê navy ou dourado ocupando mais de **uma faixa fina**, você está usando errado.

### 4.3 Modo escuro

| Token | Hex | Uso |
|---|---|---|
| `bg.app` | `#0b0c1d` | Fundo |
| `bg.surface` | `#11132a` | Cards |
| `bg.sidebar` | `#0b0c1d` (com border gold sutil) | Sidebar |
| `text.primary` | `#fafafa` | Texto |
| `text.secondary` | `#a3a3a3` | Secundário |
| `border.default` | `#262626` | Bordas |
| `accent.primary` | `#bc9d2c` | Botões (gold 400) |

### 4.4 Radius

```
radius.none = 0
radius.sm   = 4px
radius.md   = 6px        ← default
radius.lg   = 8px
radius.xl   = 12px
radius.full = 9999px     (avatares, pills)
```

### 4.5 Shadow (elevação)

```
shadow.none  = none
shadow.sm    = 0 1px 2px rgba(30,32,68,0.06)
shadow.md    = 0 4px 12px rgba(30,32,68,0.08)        ← cards
shadow.lg    = 0 8px 24px rgba(30,32,68,0.12)        ← modais
shadow.xl    = 0 16px 40px rgba(30,32,68,0.16)
shadow.focus = 0 0 0 3px rgba(152,120,20,0.40)        ← anel de foco gold
```

---

## 5. Tipografia

### 5.1 Famílias

| Função | Família | Fallback |
|---|---|---|
| **Display / títulos H1-H2** | **Playfair Display** (serif, eco da logo) | Georgia, serif |
| **Heading H3-H6 / UI** | **Inter** (sans, geometric humanist) | system-ui, -apple-system, sans-serif |
| **Body / parágrafos** | **Inter** | system-ui, sans-serif |
| **Monospace** (dados, código, IDs) | **JetBrains Mono** | ui-monospace, monospace |
| **Tabular** (números em tabelas) | Inter com `font-feature-settings: 'tnum'` | — |

### 5.2 Escala (modular 1.250 — major third)

| Token | Tamanho | Line-height | Uso |
|---|---|---|---|
| `text.2xs` | 11px | 1.4 | Captions, badges pequenos |
| `text.xs` | 12px | 1.5 | Meta-info, helper text |
| `text.sm` | 14px | 1.5 | UI default (botões, labels, tabelas) |
| `text.base` | 16px | 1.6 | Body / parágrafos |
| `text.lg` | 18px | 1.5 | Subtítulos, ênfase |
| `text.xl` | 20px | 1.4 | H4 |
| `text.2xl` | 24px | 1.3 | H3 |
| `text.3xl` | 30px | 1.2 | H2 |
| `text.4xl` | 38px | 1.1 | H1 (página interna) |
| `text.5xl` | 48px | 1.0 | Hero / landing |

### 5.3 Pesos

- Inter: 400 (regular), 500 (medium, para UI labels), 600 (semibold, ênfase), 700 (bold, raro).
- Playfair: 400, 700.
- **Não use 300 (light)** — perde legibilidade em telas operacionais.

---

## 6. Iconografia & ilustração

### 6.1 Sistema de ícones

- **Biblioteca primária:** [Lucide](https://lucide.dev) (open-source, MIT, ~1.500 ícones, traço consistente).
- **Estilo:** outline 1.5px, 24×24 default; variantes 16px (inline) e 32px (destaque).
- **Cor:** herda `currentColor` (controlado por CSS).
- **Regras:**
  - Ícones nunca são clicáveis isoladamente sem `aria-label`.
  - Sempre acompanhados de texto, EXCETO em barras de ação com tooltip obrigatório.

### 6.2 Ilustrações

- **Estado vazio (empty states):** ilustrações geométricas abstratas em navy + gold, sem personagens.
- **Erros 404/500:** ilustração discreta (símbolo HV estilizado).
- **Onboarding:** screenshots reais anotados, não personagens cartunizados.

---

## 7. Grid, espaçamento e elevação

### 7.1 Sistema de espaçamento (base 4px)

```
space.0  = 0
space.1  = 4px
space.2  = 8px
space.3  = 12px
space.4  = 16px        ← padding default de cards
space.5  = 20px
space.6  = 24px        ← margin entre seções
space.8  = 32px
space.10 = 40px
space.12 = 48px
space.16 = 64px        ← top de página
space.20 = 80px
```

### 7.2 Layout app interno (★ light + generous whitespace)

```
┌──────────────────────────────────────────────────────────────────────┐
│ TopBar #ffffff (64px, border-bottom #e8e8e8)         [⌘K]   [👤]    │
├──────┬───────────────────────────────────────────────────────────────┤
│      │                                                               │
│ Side │                                                               │
│ bar  │           Main content (max-width 1280px, centered)           │
│ #fff │           Padding-top: 48px · Padding-x: 32px                 │
│ 240px│           Section gap: 48px                                   │
│ bord-│                                                               │
│ right│                                                               │
│ #e8e8│                                                               │
│      │                                                               │
└──────┴───────────────────────────────────────────────────────────────┘
```

- Sidebar **branca** (`#ffffff`) com `border-right: 1px solid #e8e8e8`. **Nunca navy.**
- Sidebar **persistente** em ≥1280px, **collapsible** em 1024-1279px (apenas ícones), **drawer** em <1024px.
- Main content **max-width 1280px** centralizado (mais respiração que 1440px).
- **Padding top de página: 48px** (não 24px).
- **Section gap: 48px** (espaço entre blocos lógicos da página).
- **Padding-x: 32px** em desktop, 24px em tablet, 16px em mobile.

### 7.3 Grid de colunas (responsivo)

| Breakpoint | Colunas | Gutter |
|---|---|---|
| Mobile (<640px) | 4 | 16px |
| Tablet (640-1023px) | 8 | 20px |
| Desktop (1024-1535px) | 12 | 24px |
| Wide (≥1536px) | 12 | 32px |

### 7.4 Z-index escala

```
z.base       = 0
z.dropdown   = 100
z.sticky     = 200
z.fixed      = 300       ← sidebar, topbar
z.overlay    = 400       ← backdrops
z.modal      = 500
z.popover    = 600
z.toast      = 700
z.tooltip    = 800
```

---

## 8. Componentes UI

> Implementação base: **shadcn/ui** (Radix UI primitives + Tailwind). Cada componente recebe **customização HV** (cores, tipografia, motion).

### 8.1 Inventário (todos serão construídos)

| Categoria | Componentes |
|---|---|
| **Layout** | AppShell, Sidebar, TopBar, PageHeader, ContentContainer, Drawer |
| **Navegação** | Breadcrumb, Tabs, Pagination, CommandPalette (⌘K), Stepper |
| **Forms** | Input, Textarea, Select, Combobox, MultiSelect, DatePicker, DateRangePicker, TimePicker, FileUpload, Checkbox, Radio, Switch, FormField (wrapper RHF+Zod), FormSection |
| **Botões & ações** | Button (variants: primary/secondary/ghost/destructive/link), IconButton, ButtonGroup, SplitButton, FAB (mobile) |
| **Dados** | Table (TanStack), DataGrid, KanbanBoard, KanbanCard, TimelineFeed, StatCard, Sparkline, ProgressBar |
| **Feedback** | Toast, Alert (info/warn/error/success), Skeleton, Spinner, EmptyState, ErrorBoundary |
| **Overlays** | Modal, Drawer, Popover, Tooltip, ContextMenu, Sheet |
| **Display** | Card, Badge, Tag, Avatar, AvatarGroup, Chip, Divider, Accordion, CodeBlock, JSONViewer, DiffViewer |
| **Domínio** | CaseCard (caso FIES), TaskCard, ClientHeader, MacrostatusBadge, NextActionFooter, AlertStrip, DocumentRow, EventTimelineItem, TermoSnapshotViewer, ParcelaRow, AuditEntry |

### 8.2 Anatomia: `CaseCard` (componente central do app)

```
┌─────────────────────────────────────────────────────────────┐
│ ┌──────────┬──────────┬─────────┬────────────┐ ┌──┐ ┌──┐  │
│ │FIES-2026 │ESF/DGM   │RENOV.   │Aparecida-GO│  │⚖│ │💰│  │ ← Cabeçalho
│ │  -0042   │          │         │            │  │  │ │  │  │   (ID, tipo, origem, município, flags)
│ └──────────┴──────────┴─────────┴────────────┘ └──┘ └──┘  │
│                                                             │
│ Dr. João Silva  •  CRM 12345/AL  •  CPF 123.456.789-00     │ ← Identificação
│                                                             │
│ ┌──────────────────────────┐  ┌──────────────────────────┐ │
│ │ 🟦 OPERACIONAL           │  │ 🟩 FINANCEIRO            │ │ ← Dois rastros
│ │ ACOMPANHAMENTO_ADM       │  │ ATIVO                    │ │   lado a lado
│ │ 32 dias  ⚠               │  │ Parcela 3/12 em 25/05    │ │
│ │ Próx: protocolar         │  │ Próx: cobrar D+5         │ │
│ │ Responsável: Maria       │  │ Responsável: Pedro       │ │
│ └──────────────────────────┘  └──────────────────────────┘ │
│                                                             │
│ ⚠ DGM pendente há 22 dias    📎 3 docs   💬 5 msgs  Abrir →│ ← Rodapé alertas
└─────────────────────────────────────────────────────────────┘
```

**Variantes:** `compact` (lista densa, sem rodapé), `default`, `expanded` (com timeline mini).

### 8.3 Anatomia: `MacrostatusBadge`

```tsx
<MacrostatusBadge
  status="ACOMPANHAMENTO_ADM"
  diasEmEstado={32}
  sla={45}
  variant="rastro-operacional"
/>

// Renderiza:
// ┌────────────────────────────────────┐
// │ 🟦  ACOMPANHAMENTO ADM  · 32d ⚠   │
// └────────────────────────────────────┘
//   ↑ cor de status     ↑ semáforo SLA
```

- Cor de fundo: cor do status com 10% alpha.
- Cor do texto: cor do status com 100%.
- Ícone do semáforo: muda conforme `diasEmEstado / sla`.
- Sempre acessível (`aria-label="ACOMPANHAMENTO ADM, 32 dias, atenção"`).

### 8.4 Anatomia: `NextActionFooter`

```
┌────────────────────────────────────────────────────────────┐
│ 👉 Próx. ação: Protocolar requerimento no eGov            │
│    Maria Santos (OPE)  •  Prazo sugerido: 18/05/2026      │
│                                          [Iniciar →]       │
└────────────────────────────────────────────────────────────┘
```

Sempre presente em CaseCard expandido, no painel "Hoje" e na ficha do caso.

### 8.5 Tabela (DataGrid) — convenções

- Linhas com altura **48px** (default) ou **36px** (compacto).
- Header sticky, sortable, filtrável por coluna.
- Hover row: `bg.subtle`.
- Linhas selecionadas: borda esquerda 3px em gold + background gold/5.
- Paginação footer com tamanhos 25/50/100/250.
- **Acessibilidade**: navegação completa por teclado, `role="grid"`, `aria-sort`.

### 8.6 KanbanBoard — convenções

- Colunas com **largura fixa** (320px), scroll horizontal quando necessário.
- Drag-drop com **gate visual** (coluna acende verde se aceita drop; vermelha + tooltip se bloqueia).
- Header da coluna mostra: nome do macrostatus + contagem + valor agregado (R$ se aplicável).
- Card padrão (densidade): mostra `CaseCard` em variante `compact`.
- Toggle Kanban ↔ Lista no canto superior direito.

---

## 9. Padrões de layout (templates de página)

### 9.1 Página de listagem (ex: `/casos`)

```
┌────────────────────────────────────────────────────────────┐
│ Casos                                                       │ ← PageHeader
│ 2.547 ativos                                                │
│                                                             │
│ [Filtros] [Kanban|Lista] [Densidade]    [+ Novo caso]      │ ← Toolbar
├────────────────────────────────────────────────────────────┤
│                                                             │
│ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐         │ ← Colunas
│ │  │ │  │ │  │ │  │ │  │ │  │ │  │ │  │ │  │ │  │         │   Kanban
│ │  │ │  │ │  │ │  │ │  │ │  │ │  │ │  │ │  │ │  │         │
│ └──┘ └──┘ └──┘ └──┘ └──┘ └──┘ └──┘ └──┘ └──┘ └──┘         │
└────────────────────────────────────────────────────────────┘
```

### 9.2 Ficha de cliente / caso (Cliente 360°)

```
┌────────────────────────────────────────────────────────────┐
│ ← Voltar    Dr. João Silva                          [Ações]│ ← Header com volta
│ CRM 12345  •  CPF ***.***.789-00  •  3 casos ativos        │
│ ⚠ Inadimplente em 1 caso  •  📞 (82) 99999-9999            │ ← Alertas no header
├────────────────────────────────────────────────────────────┤
│ [Casos] [Documentos] [Timeline] [Financeiro] [Comunicação] │ ← Tabs
├────────────────────────────────────────────────────────────┤
│                                                             │
│ ┌─ Caso FIES-2026-0042 ─────────────────────────────┐      │
│ │ [conteúdo do caso com dois rastros lado a lado]   │      │
│ └───────────────────────────────────────────────────┘      │
│                                                             │
│ ┌─ Caso COVID-2026-0017 ────────────────────────────┐      │
│ │ ...                                                │      │
│ └───────────────────────────────────────────────────┘      │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

### 9.3 Painel "Hoje" (dashboard pessoal)

```
┌────────────────────────────────────────────────────────────┐
│ Bom dia, Maria 👋   Hoje, 15 de maio                       │
│ Você tem 3 urgências, 7 tarefas para hoje, 5 amanhã        │
├────────────────────────────────────────────────────────────┤
│                                                             │
│ 🔴 URGENTE (3)                                              │
│ ┌────────────────────────────────────────────────────┐     │
│ │ Protocolar FIES-2026-0042 hoje  •  Dr. Hyago     →│     │
│ │ Conferir Termo COVID-2026-0017  •  Pedro Silva   →│     │
│ │ Responder discordância FIES-2026-0021            →│     │
│ └────────────────────────────────────────────────────┘     │
│                                                             │
│ 🟡 HOJE (7)                                                 │
│ ┌────────────────────────────────────────────────────┐     │
│ │ ...                                                 │     │
│ └────────────────────────────────────────────────────┘     │
│                                                             │
│ 🔵 PRÓXIMOS DIAS (5)                                        │
│ 🟢 CONQUISTAS (12 esta semana)                              │
└────────────────────────────────────────────────────────────┘
```

### 9.4 Portal do Cliente (mobile-first)

```
┌─────────────────────────┐
│   HV  Hyago Viana       │
│   Dr. João              │
├─────────────────────────┤
│                         │
│ Seus casos              │
│                         │
│ ┌─────────────────────┐ │
│ │ FIES-2026-0042      │ │
│ │ ACOMPANHAMENTO      │ │
│ │ Tudo certo, aguarde │ │
│ │ resposta do MS      │ │
│ │ [Ver detalhes →]    │ │
│ └─────────────────────┘ │
│                         │
│ Documentos pendentes (2)│
│ Boletos em aberto (1)   │
│ Mensagens (3)           │
│                         │
└─────────────────────────┘
```

---

## 10. Estados, feedback e motion

### 10.1 Estados de componentes

Cada componente interativo possui **6 estados** definidos:

1. **Default** — repouso
2. **Hover** — cursor sobre (shadow.sm + brilho 5%)
3. **Focus** — teclado/screen reader (anel gold `shadow.focus`)
4. **Active** — pressionado (escurece 10%)
5. **Disabled** — opacity 0.5 + cursor not-allowed
6. **Loading** — spinner inline + texto desabilitado

### 10.2 Estados de página

| Estado | Quando | Padrão visual |
|---|---|---|
| **Loading** | Dados sendo buscados | Skeletons (não spinners centralizados) |
| **Empty** | Sem dados ainda | Ilustração + título + CTA "Criar primeiro X" |
| **Error** | Falha de carga | EmptyState com tom de erro + botão "Tentar novamente" |
| **Permission denied** | Sem acesso | Mensagem clara + link "Solicitar acesso ao admin" |
| **Offline** | Sem internet | Banner topo + dados em cache |

### 10.3 Motion principles

- **Duração padrão:** 150ms (rápido demais → não enxerga; lento demais → atrapalha).
- **Easing:** `ease-out` para entradas, `ease-in` para saídas.
- **Reduzir motion:** respeita `prefers-reduced-motion: reduce` (todas animações viram fade simples).
- **Sem animações decorativas** — toda animação tem função (revelar estado, guiar foco, confirmar ação).
- **Toasts**: slide-in 150ms da direita, slide-out 200ms.
- **Modais**: fade 200ms + scale 0.96→1.0.
- **Skeletons**: shimmer 1.2s loop, opacidade 0.4↔0.7.
- **Drag-drop**: card eleva (shadow.lg) + escala 1.02 + cursor grab/grabbing.

### 10.4 Toasts (`<Toast>`)

```
┌────────────────────────────────────────┐
│ ✅ Caso atualizado                  ✕ │
│ Próx. ação atribuída a Maria Santos    │
│                              [Desfazer]│
└────────────────────────────────────────┘
```

- Posição: top-right, stack vertical.
- Auto-dismiss: success 4s, info 5s, warning 6s, error nunca.
- **Sempre oferecer "Desfazer"** para ações reversíveis.

---

## 11. Acessibilidade

### 11.1 WCAG 2.2 nível AA — obrigatório

| Critério | Implementação |
|---|---|
| **Contraste 4.5:1 (texto pequeno)** | Auditado via Stark/axe; tokens validados. |
| **Contraste 3:1 (texto grande/UI)** | Idem. |
| **Foco visível** | `focus.ring` gold com 3px sempre; nunca `outline: none` sem alternativa. |
| **Navegação por teclado** | Tab order lógico; skip-to-content em `<header>`. |
| **ARIA labels** | Toda imagem decorativa `aria-hidden`; ícones interativos com `aria-label`. |
| **Estado anunciado** | `aria-live="polite"` para toasts; `aria-busy` para loading. |
| **Forms** | `<label>` sempre associado; erros com `aria-describedby`. |
| **Tabelas** | `<th>` com `scope`; `aria-sort` em colunas ordenáveis. |
| **Modais** | Focus trap + `aria-modal` + retorno ao trigger ao fechar. |
| **Cor não é o único indicador** | Macrostatus tem cor + ícone + texto. |

### 11.2 Atalhos de teclado globais

| Atalho | Ação |
|---|---|
| `⌘K` / `Ctrl+K` | Busca global / Command Palette |
| `g c` | Ir para Casos |
| `g t` | Ir para Tarefas (Painel Hoje) |
| `g h` | Ir para Home (Painel Hoje) |
| `g p` | Ir para Pipeline |
| `g d` | Ir para Dashboards |
| `n c` | Novo caso |
| `n t` | Nova tarefa |
| `?` | Mostrar atalhos |
| `Esc` | Fechar modal/drawer |

### 11.3 Teste obrigatório
- **axe-core** integrado no Playwright (zero erros críticos).
- **Teste manual com NVDA** (Windows) em fluxos críticos.
- **Teste com teclado puro** em 100% dos fluxos.

---

## 12. Internacionalização

- **Idioma único: pt-BR** (V1).
- **Estrutura preparada para i18n:** `next-intl` ou similar, com chaves de tradução em todos os textos (zero strings hardcoded).
- **Formatação localizada:** datas (`pt-BR`), moedas (`BRL`), números (1.234,56), CPF/CNPJ máscaras nativas.
- **Timezone:** America/Maceio (UTC-3) — armazena UTC, exibe local.

---

## 13. Performance UX

### 13.1 Métricas-alvo

| Métrica | Alvo (P75) |
|---|---|
| **LCP** (Largest Contentful Paint) | < 2.5s |
| **INP** (Interaction to Next Paint) | < 200ms |
| **CLS** (Cumulative Layout Shift) | < 0.1 |
| **TTFB** | < 600ms |
| **JS bundle inicial** (gzipped) | < 200kb |

### 13.2 Estratégias

- **RSC by default** (React Server Components) — só hidrata o que precisa.
- **Code splitting** por rota (Next.js automático) + dinâmico em componentes pesados (TipTap editor, chart libs).
- **Image optimization:** `<Image>` do Next.js, formatos AVIF/WebP, lazy load.
- **Streaming SSR** com `<Suspense>` para painéis pesados.
- **Cache em camadas:** SWR no client + Supabase Edge cache + Vercel ISR onde aplicável.
- **Pré-fetch inteligente** em hover de links (Next.js Link automático).
- **Indicadores de progresso** em ações > 1s.

---

## 14. Voz, tom e microcopy

### 14.1 Princípios de copy

- **Direto** — sem rodeios. "Caso atualizado" > "Seu caso foi atualizado com sucesso".
- **Específico** — diz o quê. "Termo aprovado por Hyago" > "Aprovado".
- **Humano sem ser informal** — "Vamos preparar a minuta?" não "🚀 Bora gerar minuta?!".
- **Sem jurisprudência decorativa** — fala português comum onde possível.
- **Pluralidade evitada na 2ª pessoa** — use "você", nunca "vocês".

### 14.2 Padrões de microcopy

| Contexto | Texto sugerido |
|---|---|
| **Empty state** | "Nenhum caso ativo ainda. [Importar do Excel] ou [Criar caso manualmente]." |
| **Confirmar ação destrutiva** | "Cancelar o caso FIES-2026-0042?" + "Digite o código do caso para confirmar" |
| **Erro de rede** | "Não consegui salvar agora. Tentei 3 vezes. [Tentar de novo]" |
| **Sucesso após ação longa** | "Termo aprovado. Cliente notificado por WhatsApp." |
| **Permissão negada** | "Você não tem permissão para editar este caso. Quer pedir acesso ao admin?" |
| **Login** | "Entrar na plataforma" (não "Login" sozinho) |
| **Botão primário** | Verbo de ação. "Aprovar Termo", "Protocolar", "Salvar caso", "Enviar minuta". |
| **Validação de campo** | "O CPF parece estar inválido. Exemplo: 123.456.789-00" |

### 14.3 Glossário de termos visíveis (para usar consistentemente)

| Use ✅ | Não use ❌ |
|---|---|
| Caso | Processo, demanda |
| Cliente | Pessoa, parte |
| Documento | Arquivo, doc |
| Tarefa | To-do, atividade |
| Macrostatus | Status, estado (no contexto FIES) |
| Termo | Acordo, instrumento (no contexto FIES) |
| Próx. ação | "O que fazer", próximo passo |
| Aprovar | OK, validar |

---

## 15. Mapa de telas global

```
APP INTERNO (app.hyagoviana.adv.br)
├─ /login
├─ / (Painel "Hoje")
├─ /clientes
│   └─ /clientes/[id] (Cliente 360°)
│       ├─ Casos
│       ├─ Documentos
│       ├─ Timeline
│       ├─ Financeiro
│       └─ Comunicação
├─ /casos
│   ├─ /casos (Pipeline Operacional)
│   ├─ /casos/financeiro (Pipeline Financeira)
│   ├─ /casos/renovacoes
│   └─ /casos/[id] (Ficha do caso)
├─ /tarefas
├─ /controladoria (Projeto 2)
│   ├─ /controladoria/painel
│   ├─ /controladoria/excecoes
│   ├─ /controladoria/teses
│   └─ /controladoria/decisoes
├─ /peticionamento (Projeto 3)
│   ├─ /peticionamento/minutas
│   └─ /peticionamento/banco-pecas
├─ /comercial (Projeto 4)
│   ├─ /comercial/leads
│   ├─ /comercial/oportunidades
│   ├─ /comercial/funil
│   └─ /comercial/email-marketing
├─ /marketing (Projeto 5)
│   ├─ /marketing/calendario
│   ├─ /marketing/conteudos
│   └─ /marketing/banco-midia
├─ /whatsapp (Projeto 6)
│   ├─ /whatsapp/conversas
│   └─ /whatsapp/agente-config
├─ /dashboards
│   ├─ /dashboards/operacional
│   ├─ /dashboards/financeiro
│   ├─ /dashboards/comercial
│   └─ /dashboards/admin (consolidado)
├─ /configuracoes
│   ├─ /configuracoes/usuarios
│   ├─ /configuracoes/permissoes
│   ├─ /configuracoes/integracoes
│   └─ /configuracoes/auditoria
└─ /perfil

PORTAL DO CLIENTE (portal.hyagoviana.adv.br)
├─ /entrar
├─ /  (visão geral dos casos)
├─ /caso/[id]
│   ├─ Timeline simplificada
│   ├─ Documentos
│   └─ Aceite Termo
├─ /documentos
├─ /boletos
└─ /mensagens

PAINEL INSTITUCIONAL (painel.hyagoviana.adv.br)
└─ ANMR / AMPB — dados agregados anonimizados
```

---

## 16. Wireframes-chave

> Versão ASCII abaixo. Mockups Figma high-fidelity serão produzidos antes do início da implementação.

### 16.1 Cliente 360° — desktop

```
┌────────────────────────────────────────────────────────────────────────────────┐
│ HV│  ⌘K Buscar...                                            🔔  👤 Maria      │ TopBar
├───┼────────────────────────────────────────────────────────────────────────────┤
│   │ ← Voltar    Dr. João Silva                                  [⋮ Ações ▾]   │
│ 🏠│ CRM 12345/AL  •  CPF ***.***.789-00  •  3 casos  •  Cliente desde 2024     │
│ 📋│ ⚠ Inadimplente em FIES-2026-0021  •  📞 (82) 99999-9999  •  📧 j@x.com    │
│ ⚖ │                                                                            │
│ 💰│ [Casos (3)] [Docs (12)] [Timeline] [Financeiro] [Comunicação (47)]        │
│ 📊│ ━━━━━━━━━━━━                                                              │
│ 🔧│                                                                            │
│   │ ┌─ FIES-2026-0042  ESF/DGM  RENOV.  Aparecida-GO ─────────────────────┐   │
│   │ │                                                                      │   │
│   │ │ ┌── OPERACIONAL ────────────┐  ┌── FINANCEIRO ────────────────┐    │   │
│   │ │ │ ACOMPANHAMENTO_ADM  32d⚠ │  │ ATIVO  (parcela 3/12)         │    │   │
│   │ │ │ Próx: protocolar resposta│  │ Próx: cobrar D+5 — 25/05/26  │    │   │
│   │ │ │ Resp: Maria Santos       │  │ Resp: Pedro Lima              │    │   │
│   │ │ └──────────────────────────┘  └───────────────────────────────┘    │   │
│   │ │                                                                      │   │
│   │ │ ⚠ DGM pendente 22d  📎12docs  💬5  📅 Última mov: 12/05  [Abrir →] │   │
│   │ └──────────────────────────────────────────────────────────────────────┘   │
│   │                                                                            │
│   │ ┌─ COVID-2026-0017 ...                                                ┐   │
│   │ └──────────────────────────────────────────────────────────────────────┘   │
└───┴────────────────────────────────────────────────────────────────────────────┘
```

### 16.2 Pipeline Operacional — Kanban

```
┌────────────────────────────────────────────────────────────────────────────────┐
│ Pipeline Operacional · 487 casos ativos                                       │
│ [Filtros: tipo, banco, UF, advogado, SLA]  [Kanban | Lista]  [+ Novo caso]   │
├────────────────────────────────────────────────────────────────────────────────┤
│ ┌ONBOARD─┐┌TRIAGEM┐┌DOCS_PEN┐┌DGM_ENV┐┌PRONTO─┐┌ACOMP─┐┌JUDICIAL┐┌IMPLAN─┐    │
│ │   12   ││   8   ││  47    ││  23   ││  19   ││ 156  ││  31    ││  47   │    │
│ │        ││       ││        ││       ││       ││      ││        ││       │    │
│ │ [card] ││[card] ││[card]  ││[card] ││[card] ││[card]││[card]  ││[card] │    │
│ │ [card] ││[card] ││[card]  ││[card] ││[card] ││[card]││[card]  ││[card] │    │
│ │  ...   ││  ...  ││  ...   ││  ...  ││  ...  ││ ...  ││  ...   ││  ...  │    │
│ └────────┘└───────┘└────────┘└───────┘└───────┘└──────┘└────────┘└───────┘    │
└────────────────────────────────────────────────────────────────────────────────┘
```

### 16.3 Portal do Cliente — mobile

```
┌─────────────────────────┐
│ ⓘ  Olá, Dr. João        │
├─────────────────────────┤
│ Seus casos (3)          │
│                         │
│ ┌─────────────────────┐ │
│ │ 🟦  FIES ESF/DGM    │ │
│ │ Em acompanhamento   │ │
│ │                     │ │
│ │ Aguarde resposta    │ │
│ │ do Ministério.      │ │
│ │ Avisaremos você.    │ │
│ │                     │ │
│ │ [Ver detalhes  →]   │ │
│ └─────────────────────┘ │
│                         │
│ 📎 2 docs pendentes     │
│ 💰 1 boleto em aberto   │
│ 💬 3 mensagens          │
│                         │
│ ──────────────────────  │
│                         │
│ 🏠 Casos                │
│ 📂 Documentos           │
│ 💳 Boletos              │
│ 💬 Mensagens            │
│ ⚙ Perfil                │
└─────────────────────────┘
```

---

## 17. Padrões transversais por módulo

| Módulo | Padrões herdados | Padrões próprios |
|---|---|---|
| **1 — Plataforma + FIES** | Tudo + CaseCard + dois rastros | Bifurcação visual, gates, snapshot viewer |
| **2 — Controladoria** | Tudo + DataGrid de prazos | "Centro de Exceções" (lista categorizada com badges) |
| **3 — Peticionamento** | Tudo + DiffViewer | "Mapa de fontes" lateral, marcação MINUTA NÃO REVISADA |
| **4 — CRM** | Tudo + Funil (Kanban derivado) | "Card de oportunidade" com motivo da sugestão |
| **5 — Marketing** | Tudo + Calendário | Pipeline editorial com "estágio do conteúdo" |
| **6 — WhatsApp** | Tudo | Chat-like UI com painel lateral de classificação |

---

## 18. Métricas UX e validação

### 18.1 Pesquisa antes do design final
- 5 entrevistas com usuários internos (Hyago + 4 funcionários representando setores).
- Mapa de tarefas críticas (top-15) com tempo atual no Excel/Trello vs. tempo esperado no app.

### 18.2 Validação durante implementação
- **Testes de usabilidade moderados** (3 usuários, 1h cada) ao final do Projeto 1.
- **Card sorting** para validar arquitetura de informação do Cliente 360°.
- **Heatmaps + session replay** (PostHog) em ambiente staging.

### 18.3 Métricas de produto (Health)
- **SUS (System Usability Scale)** ≥ 75 após 30d de uso.
- **Time to first value** (do login ao primeiro caso visualizado) < 30s.
- **Taxa de erro do usuário** (ação desfeita) < 5%.
- **Adoção de atalhos de teclado** > 30% dos power users (Admin, Controladoria).

---

## 19. Entregáveis & implementação

### 19.1 Entregáveis deste PRD

- ✅ `design-system/tokens.json` (Style Dictionary)
- ✅ `tailwind.config.ts` (com tokens importados)
- ✅ `app/globals.css` (variáveis CSS, modo claro/escuro)
- ✅ Biblioteca **`@hv/ui`** (monorepo package) com todos os componentes shadcn customizados
- ✅ Storybook publicado em `storybook.hyagoviana.adv.br`
- ✅ Figma com **6 frames-chave** em high-fidelity (Painel Hoje, Cliente 360, Pipeline Op, Pipeline Fin, Portal Cliente Mobile, Login)
- ✅ Guia de uso de componentes (`/docs/design-system.md`)
- ✅ Auditoria axe-core integrada em CI

### 19.2 Stack de implementação

```typescript
// package.json (frontend root)
{
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "@supabase/supabase-js": "^2.45.0",
    "@supabase/ssr": "^0.5.0",
    "@tanstack/react-query": "^5.50.0",
    "@tanstack/react-table": "^8.20.0",
    "zustand": "^5.0.0",
    "react-hook-form": "^7.53.0",
    "zod": "^3.23.0",
    "@hookform/resolvers": "^3.9.0",
    "tailwindcss": "^4.0.0",
    "class-variance-authority": "^0.7.0",
    "tailwind-merge": "^2.5.0",
    "lucide-react": "^0.460.0",
    "next-intl": "^3.20.0",
    "next-themes": "^0.4.0",
    "sonner": "^1.5.0",
    "@radix-ui/*": "latest"
  }
}
```

### 19.3 Cronograma de design

| Fase | Duração | Entregáveis |
|---|---|---|
| **Discovery** | 5 dias | Entrevistas, jornadas, mapa de tarefas |
| **Tokens + Foundations** | 3 dias | tokens.json, paleta expandida, tipografia, Tailwind |
| **Componentes core** | 10 dias | shadcn customizado, Storybook |
| **Templates de página** | 7 dias | 6 frames Figma high-fi |
| **Wireframes módulos 2-6** | 5 dias | Low-fi de telas específicas dos módulos |
| **Validação** | 3 dias | Testes com 5 usuários, ajustes |
| **Total** | **~33 dias úteis** | Sistema pronto para consumir |

### 19.4 Critério de aceitação do PRD 0

- ✅ Storybook publicado com 100% dos componentes do inventário §8.1
- ✅ Score Lighthouse ≥ 90 em Acessibilidade nas 6 telas-chave
- ✅ Zero erros críticos axe-core
- ✅ Validação visual aprovada por Hyago (apresentação Figma)
- ✅ Documentação de uso publicada para devs

---

## 📌 Checklist de QA + Arquiteto (validação interna deste PRD)

### QA
- [x] Cobre **estados de erro e edge cases** (offline, permissão negada, dados vazios)
- [x] Acessibilidade especificada e mensurável (WCAG 2.2 AA)
- [x] Métricas de performance definidas (LCP, INP, CLS)
- [x] Critérios de aceitação testáveis

### Arquiteto
- [x] Stack alinhada ao project-brief.md (§6)
- [x] Tokens publicáveis e versionáveis
- [x] Componentes isolados em package monorepo (`@hv/ui`)
- [x] Sem lock-in: shadcn é copy-paste, não dependência
- [x] Performance budget definido

### UX
- [x] Princípios mapeados a manifestações concretas
- [x] Mapa de telas completo
- [x] Wireframes-chave produzidos (ASCII; high-fi virá em Figma)

---

---

## 📎 ADDENDUM v1.1 — Direção Clean Light Premium

> **Adicionado em 2026-05-15** após validação @ux-design-expert + skill `frontend-design`.
> **Override:** este addendum tem precedência sobre qualquer especificação anterior conflitante.

### A.1 Sidebar light — especificação completa

```
┌─────────────────────┐
│ ▴HV  Hyago Viana    │ ← Logo (símbolo dourado 24px) + texto navy 14px medium
│                     │
│ ╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴ │ ← border-bottom 1px #f5f5f5
│                     │
│ 🏠  Painel          │ ← inativo: #525252 / weight 500
│ │👥  Clientes        │ ← ATIVO: faixa esq. 2px #987814 + bg #fafafa
│ │    └ texto: #1e2044 weight 600
│ ⚖  Casos            │
│ 📋  Tarefas          │
│ ─────────────       │ ← group separator (border 1px #f5f5f5)
│ 🔧  Controladoria   │
│ 🤖  Peticionamento  │
│ 💼  Comercial       │
│ 📣  Marketing       │
│ 💬  WhatsApp        │
│ ─────────────       │
│ 📊  Dashboards      │
│ ⚙   Configurações   │
│                     │
│ [stretch fill]      │
│                     │
│ ─────────────       │
│ ⓐ Maria Santos     │ ← Footer user (avatar 32px circular)
│   ADM/Operacional   │
└─────────────────────┘

Especificação técnica:
  width:                    240px
  background:               #ffffff
  border-right:             1px solid #e8e8e8
  padding:                  24px 0 16px 0
  logo area padding:        0 20px 16px
  item:
    padding:                10px 20px 10px 22px
    font:                   Inter 14px / weight 500
    color (inativo):        #525252
    color (hover):          #1e2044 (sutil, sem mudar weight)
    background (hover):     #fafafa
    transition:             color 150ms ease-out, background 150ms ease-out
  item ativo:
    background:             #fafafa
    color:                  #1e2044
    weight:                 600
    pseudo (::before):      conteúdo "", abs left 0, w 2px, h 100%, bg #987814
                            ← essa faixa dourada é a assinatura da marca
  ícone:
    size:                   18px
    stroke:                 1.5px
    color:                  currentColor (herda do item)
  group separator:
    margin:                 12px 20px
    border-top:             1px solid #f5f5f5
  footer:
    padding:                16px 20px
    border-top:             1px solid #f5f5f5
    avatar:                 32px circular
    nome:                   Inter 14px weight 500 / #171717
    role:                   Inter 12px weight 400 / #a3a3a3
```

### A.2 TopBar light

```
height:        64px
background:    #ffffff
border-bottom: 1px solid #e8e8e8
padding:       0 32px
content:
  esquerda:    breadcrumb (texto 14px / #525252)
  centro:      [⌘K  Buscar tudo...]  (input com border, w 480px)
  direita:     🔔 (notif sino)  ·  👤 (avatar do user logado, 32px)
```

Nada de navy bar. Nada de banner colorido.

### A.3 Botões — clean spec

| Variant | Background | Border | Text color | Hover |
|---|---|---|---|---|
| **Primary** | `#1e2044` (navy) | none | `#ffffff` | bg `#181a37` |
| **Secondary** | `#ffffff` | 1px `#e8e8e8` | `#171717` | bg `#fafafa`, border `#d4d4d4` |
| **Ghost** | transparent | none | `#525252` | bg `#fafafa`, color `#1e2044` |
| **Destructive** | `#ffffff` | 1px `#dc2626` | `#dc2626` | bg `#fef2f2` |

- **Padding:** 10px 16px (default), 8px 12px (small), 12px 20px (large)
- **Border-radius:** 6px (md)
- **Font:** Inter 14px / weight 500
- **Não usar:** sombras pesadas em botões. Só foco ring (gold 40%).

### A.4 Cards — clean spec

```
background:      #ffffff
border:          1px solid #e8e8e8     ← define o card, não shadow
border-radius:   8px (lg)
padding:         24px
shadow:          none (default)
                 OR 0 1px 2px rgba(0,0,0,0.04) (subtle, opt-in)
gap entre cards: 16px ou 24px conforme contexto

Hover (se clicável):
  border-color:  #d4d4d4
  transition:    border-color 150ms

Active/Selected:
  border-left:   3px solid #987814 (faixa dourada lateral)
  background:    #fafafa
```

### A.5 Inputs — clean spec

```
height:          40px (default), 32px (small)
background:      #ffffff
border:          1px solid #e8e8e8
border-radius:   6px (md)
padding:         10px 12px
font:            Inter 14px / weight 400 / #171717

Focus:
  border-color:  #987814
  box-shadow:    0 0 0 3px rgba(152,120,20,0.15)
  outline:       none

Disabled:
  background:    #fafafa
  color:         #a3a3a3
  cursor:        not-allowed

Placeholder:
  color:         #a3a3a3
```

### A.6 Tabelas — clean spec

```
background:       #ffffff
border:           1px solid #e8e8e8 (ao redor da tabela)
header:
  background:     #fafafa
  text:           Inter 12px / weight 600 / #525252 / uppercase / letter-spacing 0.05em
  padding:        12px 16px
  border-bottom:  1px solid #e8e8e8
row:
  height:         56px (confortável) / 44px (compacto)
  padding:        16px
  border-bottom:  1px solid #f5f5f5 (mais sutil que o externo)
  hover:          bg #fafafa
row selected:
  background:     #fafafa
  border-left:    2px solid #987814
text:             Inter 14px / weight 400 / #171717
numerical:        font-feature-settings: 'tnum' (tabular)
```

### A.7 Macrostatus badges — clean spec

```
Format:           [● TEXTO_DO_STATUS · 32d ⚠]

background:       cor do status com alpha 8%   (ex: #16a34a14 para implantado)
text color:       cor do status 100%
border:           none
padding:          4px 8px
border-radius:    4px (sm)
font:             Inter 11px / weight 600 / uppercase / letter-spacing 0.03em
ícone bullet:     • (6px) na cor do status

Dias em estado:   inline após texto, separado por ·
                  cor: cinza (#737373) se OK, amarelo (#ca8a04) se atenção, vermelho (#dc2626) se vencido
ícone semáforo:   ⚠ (atenção) ou 🔴 (crítico) apenas se aplicável
```

### A.8 Tipografia — refinamento

| Hierarquia | Família | Size | Weight | Letter-spacing | Line-height | Cor |
|---|---|---|---|---|---|---|
| **H1 (page title)** | Playfair Display | 38px | 700 | -0.02em | 1.1 | #1e2044 |
| **H2** | Playfair Display | 30px | 700 | -0.01em | 1.2 | #1e2044 |
| **H3** | Inter | 24px | 600 | -0.005em | 1.3 | #171717 |
| **H4** | Inter | 20px | 600 | normal | 1.4 | #171717 |
| **H5** | Inter | 16px | 600 | normal | 1.5 | #171717 |
| **Body** | Inter | 14px | 400 | normal | 1.6 | #171717 |
| **Body large** | Inter | 16px | 400 | normal | 1.6 | #171717 |
| **Caption** | Inter | 12px | 500 | 0.02em | 1.4 | #525252 |
| **Eyebrow / Label** | Inter | 11px | 600 | 0.05em uppercase | 1.3 | #525252 |
| **Numerical** | Inter | 14px | 500 | tabular nums | 1.4 | #1e2044 (destaque) |

**Regra:** máximo **2 weights por tela** (geralmente 400 + 600). Disciplina = premium.

### A.9 Whitespace — escala revisada

| Token | Valor | Uso prescrito |
|---|---|---|
| `space.xs` | 4px | Apenas dentro de chips/badges |
| `space.sm` | 8px | Gap entre ícone e texto |
| `space.md` | 12px | Gap entre form fields adjacentes |
| `space.lg` | 16px | Gap entre cards na mesma linha |
| `space.xl` | 24px | Padding interno de cards |
| `space.2xl` | 32px | Padding-x de container |
| `space.3xl` | 48px | Section gap · padding-top de página |
| `space.4xl` | 64px | Hero space · top em landing pages |
| `space.5xl` | 96px | Vertical breathing em landing |

### A.10 Don'ts críticos (auditáveis em code review)

| # | Don't | Por quê |
|---|---|---|
| 1 | ❌ Sidebar com `background: #1e2044` (navy) | Viola "predominantemente branco" |
| 2 | ❌ Hero/banner section com background navy ou gold | Cria peso visual, destrói clean |
| 3 | ❌ Gradient `linear-gradient(navy → gold)` ou similar | Aesthetic AI-slop |
| 4 | ❌ `border-radius >= 12px` em cards/botões | Curvas grandes → infantil |
| 5 | ❌ `box-shadow` pesado (≥ 8px blur) em cards | Floating cards parecem datados |
| 6 | ❌ `font-weight: 300` (light) em texto operacional | Perde legibilidade em telas densas |
| 7 | ❌ 3+ pesos de fonte na mesma tela | Falta disciplina = parece amador |
| 8 | ❌ Backgrounds coloridos para "destacar" seções | Use whitespace + tipografia |
| 9 | ❌ Glassmorphism, neon glow, noise textures | Não combina com identidade jurídica |
| 10 | ❌ Botões "outline gold" com texto gold sobre branco | Baixo contraste; navy é o primary |

### A.11 Mockup de validação — Cliente 360° (clean light)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ HV │ ⌘K Buscar tudo...                                  🔔  ⓘ Maria S.   │ ← TopBar branca
├────┼──────────────────────────────────────────────────────────────────────┤
│    │                                                                     │
│ 🏠 │   Clientes  ›  Dr. João Silva                              [⋮ Ações]│
│ 👥 │                                                                     │
││⚖ │   ░Dr. João Silva                                                    │ ← H1 Playfair navy
│ 📋 │   CRM 12345/AL  ·  CPF ***.***.789-00  ·  3 casos ativos             │ ← caption cinza
│    │                                                                     │
│ ───│   ⚠ Inadimplente em FIES-2026-0021  ·  📞 (82) 99999-9999            │ ← alert strip
│ 🔧 │                                                                     │
│ 🤖 │   [Casos (3)] [Documentos (12)] [Timeline] [Financeiro] [Comunicação]│ ← Tabs underline
│ 💼 │   ━━━━━━━━━━                                                         │
│ 📣 │                                                                     │
│ 💬 │   ┌─────────────────────────────────────────────────────────────┐  │
│ ───│   │  FIES-2026-0042  ·  ESF/DGM  ·  RENOV.  ·  Aparecida-GO     │  │ ← Card branco
│ 📊 │   │                                                              │  │   border #e8e8e8
│ ⚙  │   │  ┌─OPERACIONAL─────────┐  ┌─FINANCEIRO───────────┐         │  │
│    │   │  │ ACOMPANHAMENTO_ADM   │  │ ATIVO                 │         │  │
│ ───│   │  │ 32 dias ⚠            │  │ Parcela 3/12 · 25/05  │         │  │
│ ⓐ  │   │  │ Próx: protocolar     │  │ Próx: cobrar D+5      │         │  │
│ Ma. │   │  │ Maria Santos         │  │ Pedro Lima            │         │  │
│ ADM│   │  └──────────────────────┘  └───────────────────────┘         │  │
│    │   │                                                              │  │
│    │   │  📎 12 docs   💬 5 msgs   📅 Última mov: 12/05  [Abrir →]   │  │
│    │   └─────────────────────────────────────────────────────────────┘  │
│    │                                                                     │
└────┴─────────────────────────────────────────────────────────────────────┘
```

**Observe:** sidebar branca (item `Casos` ativo com faixa dourada esquerda + bg `#fafafa`). Conteúdo predominantemente branco. Navy só nos títulos e nos rastros internos do card. Dourado só na faixa lateral do item da sidebar.

### A.12 Cronograma adicional pós-addendum

| Fase | Duração | Entregável |
|---|---|---|
| **Re-spike Figma** (a partir desta v1.1) | 3 dias | 6 frames clean light HF |
| **Validação Hyago** | 1 dia | Aprovação visual |
| **Storybook update** | 2 dias | Componentes atualizados |

---

## ✅ Validação cruzada deste addendum

### @ux-design-expert
- [x] **Whiteboard refinado** estabelecido como direção
- [x] **Proporção 70/20/7/3** entre branco/cinza/navy/gold
- [x] Sidebar light com faixa dourada como assinatura
- [x] Whitespace generoso codificado (48px top, 24px card padding)
- [x] 10 don'ts auditáveis

### skill `frontend-design`
- [x] Compromisso com aesthetic **refined minimalism** (executado com precisão)
- [x] **Tipografia distintiva** (Playfair + Inter) com hierarquia clara
- [x] **Cores dominantes + accents cirúrgicos** — não palette tímida
- [x] **Atenção meticulosa a espaçamento e detalhes**
- [x] Evita AI-slop: sem gradients clichê, sem fontes genéricas isoladas

### skill `web-design-guidelines`
- [x] Contraste WCAG 2.2 AA mantido (navy `#1e2044` sobre branco = 13.4:1 ✓)
- [x] Foco visível com gold ring 3px
- [x] Border + texto comunicam estado (não só cor)
- [x] Whitespace promove escaneabilidade

---

> **Status:** Aprovado v1.1.
> _— @ux-design-expert, com skills `frontend-design` + `web-design-guidelines`, sob coordenação de Orion 🎯_

---

# 📐 ADDENDUM v1.2 — SISTEMA UNIFICADO END-TO-END

> **Este addendum é o "design bible" completo do sistema.** Cobre cada tela, cada estado, cada microinteração. É consumido por TODOS os 6 PRDs de módulo e por TODO dev/designer que trabalhar no projeto.
>
> **Estratégia de execução (decidida pelo cliente):**
> 1. Construir **TODO o design do sistema primeiro** (todas telas, navegação, estados)
> 2. Depois, aplicar lógica e backend **projeto por projeto** sobre as telas prontas
>
> **Versão:** 1.2 · **Data:** 2026-05-15 · **Owner:** @ux-design-expert + skills `frontend-design` + `web-design-guidelines`

---

## B.0 Filosofia — Um sistema, não seis

> **A plataforma Hyago Viana é UM produto integrado.** Não é "6 sistemas em uma URL". Cada módulo (Plataforma, Controladoria, Peticionamento, Comercial, Marketing, WhatsApp) é uma **seção** desse produto, herdando os mesmos componentes, navegação, hierarquia visual e linguagem.

### Princípios de unidade

| # | Princípio | Manifestação |
|---|---|---|
| **U1** | **Mesma sidebar, sempre** | Navegação principal nunca muda; itens se acendem por contexto |
| **U2** | **Mesmos componentes** | `CaseCard`, `Table`, `Kanban`, `Modal` são idênticos em todos os módulos |
| **U3** | **Mesma tipografia** | Playfair só em H1-H2, Inter no resto, weights restritos |
| **U4** | **Mesma paleta** | 70/20/7/3 (branco/cinza/navy/dourado) inviolável |
| **U5** | **Mesma microinteração** | Hover, focus, transitions idênticos em todos os módulos |
| **U6** | **Navegação fluida cross-módulo** | Cliente em Controladoria → click → Cliente 360 → click → Peças geradas |
| **U7** | **Logo e brand presentes** | Símbolo HV dourado no topo da sidebar SEMPRE |
| **U8** | **Mesma estratégia de loading/erro** | Skeletons idênticos, empty states com mesma estética |
| **U9** | **Mesma command palette** | ⌘K abre busca global em todas as telas |
| **U10** | **Nenhuma exceção visual** | Marketing não é mais "colorido" só porque "é marketing". Tudo segue o mesmo padrão. |

### O que faz este sistema **NÃO ser igual aos outros**

> Maioria dos CRMs jurídicos parecem "sistemas internos enterprise feios" (Projuris, Clio bagunçado, Astrea cru). Os que tentam ser "modernos" caem em **gradients roxos** e **layouts genéricos shadcn** (SaaS-tédio).
>
> **Nosso diferencial visual:**
>
> 1. **Playfair Display em H1** — eco da seriedade da advocacia, mas em **light mode**, traz personalidade que `Inter / Geist / Space Grotesk` não traz.
> 2. **Faixa dourada 2px** como única assinatura permanente — branding sem peso.
> 3. **Whitespace generoso (48px top, 1280 max-width)** — diz "premium" sem precisar gritar.
> 4. **Cards com border-only** (sem shadow pesada) — refinamento Linear/Stripe, não Material Design.
> 5. **Cliente 360 com 2 rastros lado a lado** — UX inédita no segmento jurídico-brasileiro.
> 6. **Cor não decora — significa.** Todo amarelo é alerta, todo dourado é "ativo/premium", todo verde é sucesso. Nunca "decorativo".

---

## B.1 Autenticação completa

### B.1.1 Tela de Login (`/entrar`)

```
                                                                              
   ╔══════════════════════════════════════════════════════════════════════╗
   ║                                                                       ║
   ║                                                                       ║
   ║                                                                       ║
   ║                          ▴HV                                          ║
   ║                                                                       ║
   ║                                                                       ║
   ║                    Hyago Viana Advocacia                              ║  ← Playfair 32px navy
   ║                                                                       ║
   ║                 Acesse sua plataforma                                 ║  ← Inter 16px cinza
   ║                                                                       ║
   ║                                                                       ║
   ║       ┌─────────────────────────────────────────────────┐             ║
   ║       │  E-mail                                          │             ║
   ║       │  ┌─────────────────────────────────────────────┐ │             ║
   ║       │  │ seu.email@escritorio.com                    │ │             ║
   ║       │  └─────────────────────────────────────────────┘ │             ║
   ║       │                                                  │             ║
   ║       │  Senha                                           │             ║
   ║       │  ┌─────────────────────────────────────────────┐ │             ║
   ║       │  │ ••••••••••                            👁  │ │             ║
   ║       │  └─────────────────────────────────────────────┘ │             ║
   ║       │                                                  │             ║
   ║       │              [   Entrar →   ]                    │             ║  ← Botão primary navy
   ║       │                                                  │             ║
   ║       │       Esqueceu sua senha?  ·  Enviar magic link  │             ║  ← link gold hover
   ║       └─────────────────────────────────────────────────┘             ║
   ║                                                                       ║
   ║                                                                       ║
   ║                                                                       ║
   ║              Maceió/AL  ·  Suporte: suporte@hv.adv.br                ║  ← footer 12px cinza
   ║                                                                       ║
   ╚══════════════════════════════════════════════════════════════════════╝
```

**Especificação:**

- Background da página: `#ffffff` (puro). Sem hero image, sem gradient, sem ilustração.
- Container do form: `width: 420px`, centrado vertical e horizontalmente.
- Logo HV dourado: 64px (símbolo isolado), centralizado.
- Spacing logo → título: 24px. Título → subtítulo: 8px. Subtítulo → form: 48px.
- Form: border `1px solid #e8e8e8`, padding 32px, border-radius 8px.
- Inputs: 44px altura (maior que padrão para sensação premium).
- Botão Entrar: full-width, navy (`#1e2044`), texto branco, padding 12px, weight 600.
- Links secundários: 13px, cinza (`#525252`), hover vira gold (`#987814`).
- Footer 32px do bottom: cinza claro, 12px Inter.

**Estados:**
- Foco em input → border `#987814` + ring 3px gold/15%
- Botão hover → bg `#181a37` (navy 700)
- Erro de credencial → toast topo direito + input vermelho (border `#dc2626`)
- Loading → botão mostra spinner inline + "Entrando..."

**MFA obrigatório (segunda tela):**
```
   Verificação em duas etapas

   Insira o código de 6 dígitos do seu autenticador
   (Google Authenticator, 1Password, Authy)

   ┌───┬───┬───┬───┬───┬───┐
   │ 4 │ 8 │ 2 │ 7 │ 1 │ _ │     ← 6 inputs separados, auto-advance
   └───┴───┴───┴───┴───┴───┘

   [    Verificar →    ]

   Perdeu acesso ao app autenticador? Contatar admin
```

### B.1.2 Recuperação de senha (`/recuperar-senha`)

```
   ▴HV
   Hyago Viana Advocacia

   Recuperar senha

   Digite seu e-mail e enviaremos um link para você
   redefinir sua senha.

   [  seu.email@escritorio.com                       ]

   [    Enviar link →    ]

   ← Voltar ao login
```

Após submit: confirmação inline (não muda de tela):
```
   ✓ Verifique sua caixa de entrada

   Enviamos um link para seu.email@escritorio.com.
   Válido por 60 minutos.

   Não recebeu? Verifique o spam ou [tentar novamente].
```

### B.1.3 Redefinir senha (`/redefinir-senha/:token`)

```
   ▴HV
   Hyago Viana Advocacia

   Defina sua nova senha

   Senha
   [ ••••••••••••••                                  ]

   Confirmar senha
   [ ••••••••••••••                                  ]

   Sua senha deve ter:
   ✓ Pelo menos 12 caracteres
   ✓ 1 letra maiúscula
   ✓ 1 número
   ✗ 1 caractere especial

   [    Redefinir senha →    ]
```

Validações em tempo real, lista de critérios marcando ✓ verde / ✗ cinza conforme digita.

### B.1.4 Convite primeiro acesso (`/convite/:token`)

Quando admin convida usuário:

```
   ▴HV
   Hyago Viana Advocacia

   Você foi convidado!

   Dr. Hyago Viana convidou você para a plataforma
   Hyago Viana Advocacia como Controladoria Jurídica.

   ┌────────────────────────────────────────────────┐
   │ Convite para:  renata.silva@escritorio.com    │
   │ Papel:         Controladoria Jurídica          │
   │ Permissões:    Painel, prazos, exceções,       │
   │                base de teses/decisões          │
   └────────────────────────────────────────────────┘

   Crie sua senha:
   [ ••••••••••••••                                ]

   Confirmar senha:
   [ ••••••••••••••                                ]

   [✓] Li e aceito os Termos de Uso e Política de Privacidade

   [    Aceitar convite e entrar →    ]
```

Após aceite: vai direto para tour de onboarding (B.4).

### B.1.5 Verificação de e-mail (`/verificar-email`)

Para mudanças de e-mail ou cadastro novo:

```
   📧

   Verifique seu e-mail

   Enviamos um código de 6 dígitos para
   novo.email@escritorio.com

   [_][_][_][_][_][_]

   Não recebeu? [Reenviar em 30s]
```

### B.1.6 Setup MFA (`/configuracoes/seguranca/mfa`)

```
   Configurar Autenticação em 2 Etapas

   ┌─────────────────────────────────────────────────┐
   │                                                  │
   │   1. Instale um app autenticador                 │
   │      Google Authenticator, 1Password, Authy      │
   │                                                  │
   │   2. Escaneie o QR code com o app                │
   │                                                  │
   │              ┌───────────────┐                   │
   │              │ ▮▮▮ ▮ ▮ ▮▮▮ │                   │
   │              │ ▮  ▮▮▮▮ ▮  │                    │
   │              │ ▮ ▮ ▮▮▮ ▮▮ │                    │
   │              │ ▮▮▮▮▮ ▮ ▮▮ │                    │
   │              └───────────────┘                   │
   │                                                  │
   │      Não consegue escanear? [Ver código manual]  │
   │                                                  │
   │   3. Insira o código gerado                      │
   │      [_][_][_][_][_][_]                          │
   │                                                  │
   │   [Cancelar]              [Ativar 2FA →]         │
   │                                                  │
   └─────────────────────────────────────────────────┘

   ⚠ Códigos de recuperação serão exibidos uma única vez.
     Guarde-os em local seguro.
```

---

## B.2 Multi-tenancy UX

### B.2.1 V1 — Single-tenant (Hyago Viana)

Mesmo com `organization_id` em tudo, **V1 opera com 1 organização**. O usuário **não vê** menus de "trocar de tenant".

**Identidade do tenant aparece em:**
- Logo no topo da sidebar (sempre)
- Footer das telas de auth: "Maceió/AL · Suporte: suporte@hv.adv.br"
- Header do navegador (favicon HV + título "Hyago Viana — [seção]")
- Configurações da Organização (acessível só pelo admin)

### B.2.2 V2 (preparação) — Multi-tenant

> **Não implementar em V1, mas estrutura pronta.**

Quando o sistema vira SaaS para outros escritórios:

```
┌──────────┐
│ ▴HV  ▾  │  ← Logo vira dropdown (org switcher)
├──────────┤
│ 🏠 Painel│
│ ...      │
└──────────┘
```

Click no logo HV → abre dropdown:

```
┌──────────────────────────────────┐
│ ★ Hyago Viana Advocacia     (atual)│
│ ─────────────────────────────────│
│ ▴SC   Silva & Costa Advogados   │
│ ▴JR   José Rocha & Associados   │
│ ─────────────────────────────────│
│ ⚙  Configurar organização       │
│ ↗  Convidar para outra org      │
└──────────────────────────────────┘
```

Comportamento:
- Trocar org: refaz auth context + recarrega contexto (não persiste sessão entre orgs por segurança).
- Cada org tem `brand_config` próprio (cores, logo, nome).
- A paleta HV (navy + gold) é **default white-label**. Outras orgs podem ter outras cores aplicadas via tokens.

### B.2.3 Configurações da Organização

Tela `/configuracoes/organizacao` (admin-only):

```
   Organização

   Identidade
   ┌──────────────────────────────────────────────────┐
   │ Nome                                              │
   │ [ Hyago Viana Advocacia                        ]  │
   │                                                   │
   │ CNPJ                                              │
   │ [ 62.880.271/0001-36                           ]  │
   │                                                   │
   │ Endereço                                          │
   │ [ Maceió/AL — Rua tal, número, bairro, CEP    ]  │
   │                                                   │
   │ Logo (PNG, max 2MB)                               │
   │ [▴HV  Logo HV (1).png]   [Substituir]            │
   │                                                   │
   │ Marca primária                                    │
   │ [■ #1e2044]    [■ #987814]                       │
   │                                                   │
   │ [Salvar alterações]                               │
   └──────────────────────────────────────────────────┘

   Domínio personalizado (V2)
   ┌──────────────────────────────────────────────────┐
   │ app.hyagoviana.adv.br  ✓ Ativo                   │
   │ [Configurar DNS]                                  │
   └──────────────────────────────────────────────────┘
```

---

## B.3 Sitemap exaustivo expandido

### B.3.1 App Interno (`app.hyagoviana.adv.br`)

| Rota | Tela | Permissão | Purpose |
|---|---|---|---|
| `/entrar` | Login | público | Auth |
| `/recuperar-senha` | Recovery | público | Recovery flow |
| `/redefinir-senha/:token` | Reset | público (token) | Reset password |
| `/convite/:token` | Aceite convite | público (token) | Primeiro acesso |
| `/mfa` | MFA prompt | autenticado parcialmente | Verificação 2FA |
| `/` | **Painel "Hoje"** | autenticado | Dashboard pessoal: urgente/hoje/próximos/conquistas |
| `/onboarding` | Tour guiado | primeiro login | Welcome |
| **CLIENTES** | | | |
| `/clientes` | Lista | clients.read | Tabela + filtros + busca |
| `/clientes/novo` | Novo cliente | clients.write | Form criar |
| `/clientes/:id` | **Cliente 360°** | clients.read | Detail (5 abas) |
| `/clientes/:id/casos` | Casos do cliente | clients.read | Aba dentro do 360° |
| `/clientes/:id/documentos` | Docs do cliente | clients.read | Aba |
| `/clientes/:id/timeline` | Timeline | clients.read | Aba |
| `/clientes/:id/financeiro` | Financeiro | clients.read | Aba |
| `/clientes/:id/comunicacao` | Comunicação | clients.read | Aba |
| `/clientes/:id/editar` | Editar | clients.write | Form edit |
| **CASOS** | | | |
| `/casos` | **Pipeline Operacional** | cases.read | Kanban 10 colunas |
| `/casos/lista` | Lista alternativa | cases.read | Tabular |
| `/casos/financeiro` | Pipeline Financeira | cases.read | Kanban 15 colunas + 8 views |
| `/casos/financeiro/aguardando-ativacao` | View | cases.read | View complementar |
| `/casos/financeiro/parcelas-atrasadas` | View | cases.read | View |
| `/casos/financeiro/inadimplencia` | View | cases.read | View |
| `/casos/financeiro/pendencias-judiciais` | View | cases.read | View |
| `/casos/financeiro/readequacao-parcela` | View | cases.read | View |
| `/casos/financeiro/cliente-inerte` | View | cases.read | View |
| `/casos/financeiro/cobranca-judicial` | View | cases.read | View |
| `/casos/financeiro/tramitacao-judicial` | View | cases.read | View |
| `/casos/financeiro/analise-pre-decisao` | View | cases.read | View |
| `/casos/renovacoes` | Renovações | cases.read | Calendário ESF |
| `/casos/novas-solicitacoes` | Novas | cases.read | Lista |
| `/casos/:id` | **Ficha do Caso** | cases.read | Detail com 2 rastros |
| `/casos/:id/operacional` | Rastro Op | cases.read | Sub-detail |
| `/casos/:id/financeiro` | Rastro Fin | cases.read | Sub-detail |
| `/casos/:id/documentos` | Docs do caso | cases.read | Aba |
| `/casos/:id/timeline` | Timeline | cases.read | Aba |
| `/casos/:id/comunicacao` | Comunicação | cases.read | Aba |
| `/casos/:id/auditoria` | Audit log | cases.read.audit | Aba |
| `/casos/:id/termo` | Termo Acerto | termo.* | Snapshot viewer |
| `/casos/:id/termo/elaborar` | Elaborar | termo.elaborate | Form elaboração |
| `/casos/:id/termo/conferir` | Conferir | termo.confirm | Conferência |
| **TAREFAS** | | | |
| `/tarefas` | Minhas tarefas | tasks.read | Lista pessoal |
| `/tarefas/equipe` | Tarefas equipe | tasks.read.all | Visão gestor |
| `/tarefas/:id` | Detalhe | tasks.read | Modal/page |
| **CONTROLADORIA (P2)** | | | |
| `/controladoria` | Painel | controladoria.* | Dashboard contr. |
| `/controladoria/prazos` | Prazos | controladoria.read | Lista + calendário |
| `/controladoria/prazos/:id` | Detalhe prazo | controladoria.read | Detail |
| `/controladoria/movimentacoes` | Movimentações | controladoria.read | Lista com filtros |
| `/controladoria/movimentacoes/validar` | Fila validação | controladoria.read | Validação baixa-confiança |
| `/controladoria/excecoes` | Centro de Exceções | controladoria.read | 8 categorias |
| `/controladoria/teses` | Base de Teses | tese.read | Lista + busca |
| `/controladoria/teses/nova` | Nova tese | tese.write | Editor |
| `/controladoria/teses/:id` | Detalhe tese | tese.read | Detail |
| `/controladoria/decisoes` | Base de Decisões | decisao.read | Lista + busca semântica |
| `/controladoria/decisoes/nova` | Nova decisão | decisao.write | Form/upload |
| `/controladoria/decisoes/:id` | Detalhe | decisao.read | Detail |
| `/controladoria/projuris` | Saúde integração | controladoria.read | Status sync |
| **PETICIONAMENTO (P3)** | | | |
| `/peticionamento` | Minutas | peticao.read | Lista |
| `/peticionamento/nova` | Gerar nova | peticao.write | Wizard tipo/caso |
| `/peticionamento/checklist/:caseId` | Prontidão | peticao.read | Checklist viewer |
| `/peticionamento/:id` | **Editor de Minuta** | peticao.read | Editor + fontes + issues |
| `/peticionamento/:id/versoes` | Versões | peticao.read | Histórico |
| `/peticionamento/banco-pecas` | Banco peças | peticao.read | Lista |
| `/peticionamento/banco-pecas/nova` | Adicionar | peticao.write | Upload |
| `/peticionamento/banco-pecas/:id` | Detalhe | peticao.read | Detail |
| `/peticionamento/templates` | Templates | peticao.admin | Editor de prompts |
| **COMERCIAL (P4)** | | | |
| `/comercial` | Painel comercial | commercial.read | Dashboard |
| `/comercial/funil` | **Funil Kanban** | commercial.read | 5+ etapas |
| `/comercial/leads` | Lista leads | commercial.read | Tabular |
| `/comercial/leads/novo` | Novo lead | commercial.write | Form |
| `/comercial/leads/:id` | Detalhe lead | commercial.read | Detail |
| `/comercial/oportunidades` | Cross-sell | commercial.read | Lista oportunidades |
| `/comercial/oportunidades/:id` | Detalhe op | commercial.read | Detail |
| `/comercial/campanhas` | Meta + Google Ads | commercial.read | Lista campanhas |
| `/comercial/campanhas/:id` | Detalhe campanha | commercial.read | Métricas |
| `/comercial/email-marketing` | E-mail mkt | commercial.read | Lista campanhas |
| `/comercial/email-marketing/novo` | Nova campanha | commercial.write | Editor |
| `/comercial/email-marketing/templates` | Templates | commercial.read | Editor |
| **MARKETING (P5)** | | | |
| `/marketing` | Painel marketing | marketing.read | Dashboard |
| `/marketing/calendario` | Calendário editorial | marketing.read | Calendário visual |
| `/marketing/conteudos` | Lista conteúdos | marketing.read | Lista |
| `/marketing/conteudos/novo` | Novo briefing | marketing.write | Wizard |
| `/marketing/conteudos/:id` | Editor conteúdo | marketing.read | Editor multi-tab |
| `/marketing/banco-midia` | Banco mídia | marketing.read | Grid + busca |
| `/marketing/banco-midia/upload` | Upload | marketing.write | Drop-zone |
| `/marketing/banco-midia/:id` | Asset detail | marketing.read | Preview + tags |
| `/marketing/brand-guidelines` | Guidelines | marketing.admin | Editor |
| **WHATSAPP (P6)** | | | |
| `/whatsapp` | Inbox | whatsapp.read | Lista conversas |
| `/whatsapp/conversas/:id` | Detalhe conversa | whatsapp.read | Chat UI |
| `/whatsapp/agente` | Config agente | whatsapp.admin | Templates + plantão |
| `/whatsapp/handoffs` | Handoffs ativos | whatsapp.read | Fila handoff |
| **DASHBOARDS** | | | |
| `/dashboards` | Hub dashboards | dashboards.read | Index |
| `/dashboards/operacional` | Op | dashboards.read | KPIs operacionais |
| `/dashboards/financeiro` | Fin | dashboards.read | KPIs financeiros |
| `/dashboards/comercial` | Comercial | dashboards.read | KPIs comerciais |
| `/dashboards/marketing` | Marketing | dashboards.read | KPIs conteúdo |
| `/dashboards/whatsapp` | WhatsApp | dashboards.read | KPIs atendimento |
| `/dashboards/admin` | **Consolidado** | dashboards.admin | Visão executiva |
| `/dashboards/admin/cohort` | Cohort | dashboards.admin | Análise temporal |
| **CONFIGURAÇÕES** | | | |
| `/configuracoes` | Hub config | settings.read | Index |
| `/configuracoes/organizacao` | Org | settings.org | Identidade tenant |
| `/configuracoes/usuarios` | Usuários | settings.users | Lista + convites |
| `/configuracoes/usuarios/:id` | Detalhe user | settings.users | Edit |
| `/configuracoes/papeis` | Papéis | settings.roles | RBAC editor |
| `/configuracoes/papeis/:id` | Papel detalhe | settings.roles | Perms |
| `/configuracoes/integracoes` | Integrações | settings.integrations | Status todas |
| `/configuracoes/integracoes/projuris` | Projuris | settings.integrations | Config |
| `/configuracoes/integracoes/zapsign` | ZapSign | settings.integrations | Config |
| `/configuracoes/integracoes/conta-azul` | Conta Azul | settings.integrations | Config |
| `/configuracoes/integracoes/asaas` | Asaas | settings.integrations | Config |
| `/configuracoes/integracoes/chatguru` | ChatGuru | settings.integrations | Config |
| `/configuracoes/integracoes/gmail` | Gmail | settings.integrations | Config OAuth |
| `/configuracoes/integracoes/drive` | Drive | settings.integrations | Config OAuth |
| `/configuracoes/integracoes/evolution` | Evolution API | settings.integrations | Config WA |
| `/configuracoes/integracoes/meta-ads` | Meta Ads | settings.integrations | Config |
| `/configuracoes/integracoes/google-ads` | Google Ads | settings.integrations | Config |
| `/configuracoes/auditoria` | Audit log | settings.audit | Log explorável |
| `/configuracoes/lgpd` | LGPD | settings.lgpd | Consents, exports |
| `/configuracoes/billing` | Faturamento | settings.billing | (V2 multi-tenant) |
| `/configuracoes/seguranca` | Segurança | settings.security | MFA, sessions |
| **PERFIL** | | | |
| `/perfil` | Meu perfil | self | Dados pessoais |
| `/perfil/preferencias` | Preferências | self | Tema, atalhos |
| `/perfil/notificacoes` | Notif config | self | Canais |
| `/perfil/seguranca` | Segurança | self | Senha, MFA, sessions |
| **NOTIFICAÇÕES** | | | |
| `/notificacoes` | Central notif | self | Histórico completo |
| **AJUDA** | | | |
| `/ajuda` | Help center | self | Docs + FAQ |
| `/ajuda/atalhos` | Atalhos | self | Lista teclado |
| `/ajuda/changelog` | Changelog | self | Releases |
| `/ajuda/contato` | Contato suporte | self | Form |

**Total app interno: ~95 telas**

### B.3.2 Portal do Cliente (`portal.hyagoviana.adv.br`)

| Rota | Tela | Purpose |
|---|---|---|
| `/entrar` | Login cliente | E-mail/CPF + senha |
| `/recuperar` | Recuperar senha | Recovery |
| `/primeiro-acesso/:token` | Primeiro acesso | Set password + LGPD |
| `/` | Home | Lista casos + atalhos |
| `/casos/:id` | Caso detalhe | Timeline + status + próx ação |
| `/documentos` | Documentos | Pendentes + recebidos |
| `/documentos/upload` | Upload | Câmera/arquivo |
| `/boletos` | Boletos | Abertos + pagos |
| `/boletos/:id` | Boleto detail | Download + Pix |
| `/mensagens` | Mensagens | WhatsApp + portal |
| `/mensagens/:thread` | Thread | Chat UI |
| `/termos` | Termos pendentes | Lista |
| `/termos/:id/aceitar` | Aceite Termo | PDF + 2FA |
| `/perfil` | Meu perfil | Dados |
| `/perfil/privacidade` | Privacidade | LGPD opções |

**Total portal: ~14 telas**

### B.3.3 Painel Institucional (`painel.hyagoviana.adv.br`)

| Rota | Tela | Purpose |
|---|---|---|
| `/entrar` | Login institucional | Auth |
| `/` | Dashboard | Visão geral agregada |
| `/associados` | Associados | Mapa + filtros |
| `/demandas` | Tipos de demanda | Distribuição |
| `/resultados` | Resultados | Taxa êxito |
| `/relatorios` | Relatórios | PDF exports |

**Total painel: ~6 telas**

### B.3.4 Total geral: **~115 telas no produto inteiro.**

---

## B.4 Onboarding primeiro acesso

### B.4.1 Modal de boas-vindas (logo após primeiro login)

```
   ┌──────────────────────────────────────────────────────┐
   │                                                       │
   │                       ▴HV                             │
   │                                                       │
   │           Bem-vinda, Renata!                          │
   │                                                       │
   │  Você foi adicionada como Controladoria Jurídica      │
   │  na plataforma Hyago Viana Advocacia.                 │
   │                                                       │
   │  Quer fazer um tour rápido (2 min) para conhecer      │
   │  as principais áreas?                                  │
   │                                                       │
   │                                                       │
   │  [Pular tour]              [Começar tour →]           │
   │                                                       │
   └──────────────────────────────────────────────────────┘
```

### B.4.2 Tour guiado (4 steps, com overlay + spotlight)

```
   Step 1/4 — Sidebar
   ─────────────────────
   "Esta é sua navegação principal.
    Use g + c para Casos, g + t para Tarefas."
   [Pular]  [Próximo →]

   Step 2/4 — Painel "Hoje"
   ─────────────────────
   "Aqui aparecem suas urgências do dia.
    Comece o trabalho daqui."
   [Voltar]  [Próximo →]

   Step 3/4 — Busca global
   ─────────────────────
   "Pressione ⌘K para buscar qualquer coisa
    no sistema (clientes, casos, teses)."
   [Voltar]  [Próximo →]

   Step 4/4 — Notificações
   ─────────────────────
   "Acompanhe atualizações importantes aqui.
    Configure canais em Perfil → Notificações."
   [Voltar]  [Concluir]
```

### B.4.3 Preferências iniciais (segundo modal opcional)

```
   ┌──────────────────────────────────────────────────────┐
   │  Configure suas preferências                          │
   │                                                       │
   │  Tema da interface                                    │
   │  ○ Claro (padrão)                                     │
   │  ○ Escuro                                             │
   │  ◉ Automático (segue sistema)                         │
   │                                                       │
   │  Densidade das listas                                 │
   │  ○ Confortável     ◉ Padrão     ○ Compacto           │
   │                                                       │
   │  Canais de notificação                                │
   │  ☑ In-app (sino)                                      │
   │  ☑ E-mail (urgentes apenas)                           │
   │  ☐ WhatsApp                                           │
   │                                                       │
   │  Idioma                                               │
   │  ◉ Português (Brasil)                                 │
   │                                                       │
   │  [Pular]                       [Salvar e continuar →] │
   └──────────────────────────────────────────────────────┘
```

---

## B.5 Empty states (catálogo completo)

> **Princípio:** todo empty state tem 1) ícone discreto (não ilustração cartoon), 2) título humano, 3) explicação, 4) CTA primário, 5) CTA secundário (opcional).

### B.5.1 Sem casos ainda

```
   ┌──────────────────────────────────────────────────────┐
   │                                                       │
   │                                                       │
   │                       📂                              │  ← Lucide icon 48px gray
   │                                                       │
   │                Nenhum caso ativo                      │
   │                                                       │
   │     Você ainda não criou ou importou nenhum caso.     │
   │                                                       │
   │  [Importar do Excel →]    [Criar caso manualmente]    │
   │                                                       │
   │                                                       │
   └──────────────────────────────────────────────────────┘
```

### B.5.2 Sem clientes

```
   👥
   Nenhum cliente cadastrado
   Comece criando seu primeiro cliente ou importando.
   [Criar cliente →]    [Importar planilha]
```

### B.5.3 Sem tarefas hoje

```
   🌿
   Tudo limpo por hoje
   Você não tem tarefas urgentes ou para hoje.
   Aproveite para revisar sua semana ou se atualizar.
   [Ver tarefas próximas]
```

### B.5.4 Sem documentos no caso

```
   📎
   Nenhum documento ainda
   Você pode enviar documentos por upload direto,
   ou solicitar ao cliente pelo Portal/WhatsApp.
   [Enviar documento]    [Solicitar ao cliente]
```

### B.5.5 Sem teses cadastradas

```
   ⚖
   Base de teses vazia
   Cadastre a primeira tese do escritório para começar
   a construir o conhecimento jurídico recuperável.
   [Cadastrar primeira tese →]
```

### B.5.6 Sem decisões cadastradas

```
   📜
   Base de decisões vazia
   Cadastre decisões relevantes (manualmente ou via PDF)
   para alimentar a inteligência do sistema.
   [Cadastrar decisão →]    [Upload PDF]
```

### B.5.7 Sem leads no funil

```
   🎯
   Nenhum lead ativo
   Conecte seus canais de captação (formulário, Meta Ads,
   Google Ads, WhatsApp) para começar a receber leads.
   [Conectar canais →]    [Adicionar lead manualmente]
```

### B.5.8 Sem oportunidades de cross-sell

```
   ✨
   Nenhuma oportunidade detectada
   Nosso engine de cross-sell ainda não identificou
   oportunidades. Roda diariamente às 3h da manhã.
   [Ver regras do engine]
```

### B.5.9 Sem conteúdos no calendário

```
   📅
   Calendário vazio
   Crie um briefing ou peça uma sugestão à IA para
   começar seu calendário editorial.
   [Sugerir conteúdos IA →]    [Criar briefing manual]
```

### B.5.10 Sem conversas WhatsApp

```
   💬
   Nenhuma conversa ainda
   Quando alguém enviar uma mensagem para o número
   do escritório, aparecerá aqui.
   [Configurar agente]    [Ver número conectado]
```

### B.5.11 Sem prazos próximos

```
   📅
   Sem prazos imediatos
   Você não tem prazos legais nos próximos 15 dias.
   [Ver todos os prazos]
```

### B.5.12 Sem exceções abertas

```
   ✅
   Tudo sob controle
   Não há exceções operacionais abertas no momento.
   O sistema verifica automaticamente a cada 15 minutos.
```

### B.5.13 Busca sem resultados

```
   🔍
   Nada encontrado para "[termo]"
   Tente ajustar sua busca ou filtros.
   [Limpar filtros]
```

### B.5.14 Filtro sem resultados

```
   🔍
   Nenhum item corresponde aos seus filtros
   Tente remover algum filtro ou ampliar o critério.
   [Limpar filtros]
```

---

## B.6 Error states

### B.6.1 404 — Página não encontrada

```
   ┌──────────────────────────────────────────────────────┐
   │                                                       │
   │                                                       │
   │                                                       │
   │                     ▴HV                               │  ← Logo discreto
   │                                                       │
   │                                                       │
   │                     404                               │  ← Playfair 64px navy
   │                                                       │
   │           Esta página não existe                      │
   │                                                       │
   │  A página que você procura pode ter sido movida       │
   │  ou nunca existiu. Verifique o link ou volte ao       │
   │  início.                                              │
   │                                                       │
   │                                                       │
   │  [← Voltar]              [Ir ao painel inicial →]    │
   │                                                       │
   │                                                       │
   └──────────────────────────────────────────────────────┘
```

### B.6.2 500 — Erro do servidor

```
   ▴HV
   500
   Algo deu errado do nosso lado

   Tentamos exibir esta página mas encontramos um erro
   interno. Já registramos o ocorrido e estamos olhando.

   ID do incidente: incident_abc123 (informe ao suporte)

   [Tentar novamente]    [Voltar ao painel]    [Reportar]
```

### B.6.3 403 — Permissão negada

```
   🔒
   Você não tem acesso a esta área

   Esta seção requer permissões que seu papel atual
   não inclui. Se você acredita que isso é um engano,
   solicite acesso ao administrador.

   [← Voltar]                [Solicitar acesso ao admin]
```

### B.6.4 Offline

```
   📡  Sem conexão

   Banner topo + dados em cache:

   ╔══════════════════════════════════════════════════════╗
   ║ ⚠ Você está offline. Exibindo dados em cache.        ║
   ║ Mudanças serão sincronizadas quando voltar à rede.   ║
   ╚══════════════════════════════════════════════════════╝
```

### B.6.5 Permissão de operação negada (in-line)

Quando user tenta ação não-permitida (botão clicado):

```
   Toast:
   ┌──────────────────────────────────────────┐
   │ 🔒 Operação não permitida                │
   │ Você não pode aprovar o Termo. Apenas    │
   │ Jurídico Titular pode.                   │
   │                            [Solicitar →] │
   └──────────────────────────────────────────┘
```

### B.6.6 Erro de integração externa

```
   ⚠ Falha na integração ChatGuru
   Não conseguimos enviar a mensagem agora. Tentaremos
   novamente em 5 minutos.
   [Tentar agora]      [Ver detalhes]
```

### B.6.7 Sessão expirada

```
   ┌────────────────────────────────────┐
   │ Sua sessão expirou                 │
   │ Por segurança, faça login novamente │
   │                                     │
   │ [Fazer login →]                    │
   └────────────────────────────────────┘
```

---

## B.7 Loading states sofisticados

### B.7.1 Skeleton patterns

**Card skeleton:**
```
┌──────────────────────────────────────────────────┐
│ ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒                            │  ← linha 16px shimmer
│                                                   │
│ ▒▒▒▒▒▒▒▒▒▒▒▒▒▒                                  │  ← linha 12px shimmer
│ ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒                              │
│                                                   │
│ ▒▒▒▒▒▒▒▒▒▒  ▒▒▒▒▒▒▒▒▒▒                          │  ← duas colunas (rastros)
└──────────────────────────────────────────────────┘
```

Shimmer: `bg #fafafa` com gradient `#fafafa → #f0f0f0 → #fafafa` animado em 1.2s.

**Table skeleton:**
- Header preserva alturas reais
- 5 linhas de skeleton para evitar layout shift
- Cores neutras (cinza claro), sem animação agressiva

**Pipeline Kanban skeleton:**
- Colunas vazias com header preservado
- 3 skeleton cards por coluna

### B.7.2 Streaming SSR com Suspense

Padrão Next.js 15 + RSC:

```tsx
<Suspense fallback={<ClientHeaderSkeleton />}>
  <ClientHeader id={id} />
</Suspense>

<Suspense fallback={<CasesListSkeleton />}>
  <CasesList clientId={id} />
</Suspense>

<Suspense fallback={<TimelineSkeleton />}>
  <Timeline clientId={id} />
</Suspense>
```

Cada bloco aparece quando ready, sem bloquear os outros.

### B.7.3 Long operations (com progresso)

**Migração de 2.500 casos:**

```
┌──────────────────────────────────────────────────────────┐
│ Importando casos do Excel                                 │
│                                                           │
│ ████████████████░░░░░░░░░  62%  (1.547 / 2.500)         │
│                                                           │
│ ✓ 1.490 importados com sucesso                            │
│ ⚠ 23 com warnings (revisar depois)                       │
│ ✗ 34 com erro (ver log)                                   │
│                                                           │
│ Tempo restante estimado: ~8 minutos                       │
│                                                           │
│ [Pausar]                                  [Ver log →]    │
└──────────────────────────────────────────────────────────┘
```

**IA gerando minuta (streaming):**

```
┌──────────────────────────────────────────────────────────┐
│ ✨ Gerando minuta de Inicial FIES                         │
│                                                           │
│ [streaming text aparecendo gradualmente]                 │
│                                                           │
│ EXMO. SR. SECRETÁRIO DE GESTÃO DO TRABALHO E DA          │
│ EDUCAÇÃO NA SAÚDE...                                      │
│                                                           │
│ JOÃO SILVA, brasileiro, casado, médico, CRM 12345/AL,    │
│ inscrito no CPF 123.456.789-00, residente e domiciliado  │
│ na...                                                     │
│                                                           │
│ ▊                                                         │  ← cursor pulsando
│                                                           │
│ Tokens gerados: 1.247  •  Custo: $0.18                   │
└──────────────────────────────────────────────────────────┘
```

Stream em tempo real (Server-Sent Events ou Vercel AI SDK).

### B.7.4 Optimistic UI

Quando user muda macrostatus (drag-drop):
1. UI atualiza **imediatamente** (card move).
2. Toast "Atualizando...".
3. Se sucesso: toast vira "Atualizado ✓".
4. Se erro: rollback automático + toast erro com botão "Tentar novamente".

---

## B.8 Command Palette (⌘K)

### B.8.1 Trigger
- `⌘K` (Mac) / `Ctrl+K` (Windows)
- Click no input "Buscar tudo..." na TopBar

### B.8.2 Layout

```
┌──────────────────────────────────────────────────────────┐
│  🔍  Digite para buscar ou comando...                     │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  AÇÕES RÁPIDAS                                            │
│  ⏎  + Criar caso                                          │
│  ⏎  + Novo cliente                                        │
│  ⏎  + Gerar minuta                                        │
│  ⏎  + Cadastrar tese                                      │
│                                                           │
│  IR PARA                                                  │
│  ⏎  Painel Hoje                          g h              │
│  ⏎  Pipeline Operacional                 g c              │
│  ⏎  Pipeline Financeiro                  g f              │
│  ⏎  Controladoria                        g k              │
│  ⏎  Configurações                        g s              │
│                                                           │
│  RESULTADOS RECENTES                                      │
│  📂 FIES-2026-0042 — Dr. João Silva                       │
│  👤 Dra. Maria Oliveira (CPF ***...456-12)                │
│  ⚖  Tese: FIES abatimento COVID                            │
│                                                           │
└──────────────────────────────────────────────────────────┘

  ↑↓ navegar    ⏎ selecionar    esc fechar
```

### B.8.3 Busca digitada

Conforme digita "joão":

```
┌──────────────────────────────────────────────────────────┐
│  🔍  joão|                                                │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  CLIENTES (3)                                             │
│  👤 Dr. João Silva — CPF 123.456.789-00                   │
│  👤 João Pereira — CPF 987.654.321-00                     │
│  👤 João Carlos Souza — CPF 111.222.333-44                │
│                                                           │
│  CASOS (5)                                                │
│  📂 FIES-2026-0042 — Dr. João Silva (ACOMPANHAMENTO)      │
│  📂 COVID-2026-0017 — Dr. João Silva (IMPLANTADO)         │
│  ...                                                      │
│                                                           │
│  MENSAGENS (2)                                            │
│  💬 "Dr. João pediu retorno hoje" — 12:34                  │
│                                                           │
│  TAREFAS (1)                                              │
│  📋 Protocolar resposta FIES-2026-0042                    │
│                                                           │
└──────────────────────────────────────────────────────────┘
```

### B.8.4 Categorias buscadas (cross-módulo)
- Clientes
- Casos
- Tarefas
- Documentos (por título + OCR text)
- Teses
- Decisões
- Conversas WhatsApp
- Comerciais (leads + oportunidades)
- Configurações (ir para tela)
- Comandos (criar X, gerar Y)

### B.8.5 Comandos especiais
- `>` no início: filtra só comandos (não busca dados)
- `?`: mostra atalhos
- `@maria`: filtra por usuário
- `#FIES-2026`: prefixo de caso

---

## B.9 Notificações end-to-end

### B.9.1 Sino na TopBar

```
   🔔  ← com badge "3" gold se >0 não-lidas
```

Click abre dropdown:

```
┌──────────────────────────────────────────────────────┐
│ Notificações (3)              [Marcar todas lidas]   │
├──────────────────────────────────────────────────────┤
│                                                       │
│ 🔴  FIES-2026-0042 — prazo vence em 1 dia          ↗ │
│     atribuído a você há 2h                           │
│                                                       │
│ 🟡  Cliente discordou do Termo COVID-2026-0017     ↗ │
│     há 5h                                            │
│                                                       │
│ 🔵  Nova movimentação Projuris no processo ...     ↗ │
│     há 1 dia                                         │
│                                                       │
├──────────────────────────────────────────────────────┤
│              [Ver todas →]                            │
└──────────────────────────────────────────────────────┘
```

### B.9.2 Página `/notificacoes`

```
┌──────────────────────────────────────────────────────────┐
│ Notificações                                              │
│ [Todas] [Não lidas (3)] [Por tipo ▾]                     │
├──────────────────────────────────────────────────────────┤
│ HOJE                                                      │
│ 🔴 09:14  Prazo crítico em FIES-2026-0042                │
│ 🟡 11:30  Cliente João discordou do Termo                │
│ 🔵 14:22  Nova movimentação no proc 0001234-56...        │
│                                                           │
│ ONTEM                                                     │
│ 🔵 16:45  Tarefa atribuída: Conferir Termo               │
│ ...                                                       │
└──────────────────────────────────────────────────────────┘
```

### B.9.3 Configuração de canais (`/perfil/notificacoes`)

Tabela editable: por tipo de evento × por canal (sino/e-mail/whatsapp).

```
┌──────────────────────────────────────────────────────────────┐
│ Notificações                                                  │
│                                                               │
│ Tipo de evento          │ Sino  │ E-mail │ WhatsApp           │
│ ───────────────────────┼───────┼────────┼────────            │
│ Tarefa atribuída        │  [✓]  │  [✓]   │  [ ]              │
│ Prazo vencendo          │  [✓]  │  [✓]   │  [✓]              │
│ Macrostatus mudou       │  [✓]  │  [ ]   │  [ ]              │
│ Cliente discordou Termo │  [✓]  │  [✓]   │  [✓]              │
│ ...                                                           │
└──────────────────────────────────────────────────────────────┘
```

---

## B.10 Modais, drawers, sheets, popovers

### B.10.1 Quando usar cada um

| Componente | Quando | Largura | Backdrop |
|---|---|---|---|
| **Modal** | Confirmação curta, info focal, decisão única | 480px | Sim |
| **Drawer (lateral)** | Edição de item, ação contextual, settings | 480-640px | Sim (overlay translúcido) |
| **Sheet (bottom)** | Mobile-first ações, filtros mobile | 100% width × 75% height | Sim |
| **Popover** | Info detalhada hover, dropdown rico | auto | Não |
| **Tooltip** | Label curto em ícones | auto | Não |

### B.10.2 Modal padrão

```
                  ┌──────────────────────────────┐
                  │ Título do modal           ✕  │  ← header 56px com close
                  ├──────────────────────────────┤
                  │                              │
                  │ [conteúdo do modal           │
                  │  com padding 24px]           │
                  │                              │
                  ├──────────────────────────────┤
                  │ [Cancelar]    [Confirmar]    │  ← footer com ações
                  └──────────────────────────────┘
```

- Width: 480px (default), 600px (large)
- Border-radius: 12px (modal pode ter mais raio que cards)
- Shadow: `0 16px 40px rgba(30,32,68,0.16)` (mais expressiva)
- Backdrop: `rgba(0,0,0,0.40)` + blur 4px
- Animation: fade-in 200ms + scale 0.96→1.0
- Click outside fecha (ESC também)

### B.10.3 Confirmação destrutiva (modal especial)

Para ações como "Cancelar caso", "Excluir cliente":

```
┌────────────────────────────────────────────────────────┐
│ ⚠ Cancelar caso FIES-2026-0042?                       │
├────────────────────────────────────────────────────────┤
│                                                         │
│ Esta ação não pode ser desfeita. O caso será marcado   │
│ como CANCELADO e arquivado.                            │
│                                                         │
│ Para confirmar, digite o código do caso:               │
│                                                         │
│ [____________________________________________]         │
│  digite FIES-2026-0042                                  │
│                                                         │
│ Motivo (opcional):                                      │
│ [____________________________________________]         │
│                                                         │
├────────────────────────────────────────────────────────┤
│ [Voltar]              [Sim, cancelar caso]              │
│                       (botão destrutivo - vermelho)     │
└────────────────────────────────────────────────────────┘
```

Botão "Sim, cancelar" só fica clicável quando código digitado corresponde.

### B.10.4 Drawer lateral (editar caso)

```
┌────────────────────────────────────┐  ┌──────────────────┐
│                                    │  │ Editar caso   ✕  │
│       [conteúdo da página          │  ├──────────────────┤
│        permanece visível]          │  │                  │
│                                    │  │ [form fields]    │
│                                    │  │                  │
│                                    │  │                  │
│                                    │  │                  │
│                                    │  ├──────────────────┤
│                                    │  │ [Salvar]         │
└────────────────────────────────────┘  └──────────────────┘
```

Drawer entra deslizando da direita em 250ms ease-out.

---

## B.11 Print stylesheet (PDF exports)

### B.11.1 Dossiê do cliente (`@media print` + react-to-print)

```
┌──────────────────────────────────────────────────────────┐
│ ▴HV  Hyago Viana Advocacia                                │  ← Header sempre
│ Maceió/AL · CNPJ 62.880.271/0001-36                       │
│ ──────────────────────────────────────────────────────── │
│                                                           │
│ DOSSIÊ DO CLIENTE                                         │  ← Playfair 24pt navy
│ Emitido em 15/05/2026 · Por Maria Santos                  │
│                                                           │
│ ─── IDENTIFICAÇÃO ─────────────────────────────────────   │
│ Nome: Dr. João Silva                                      │
│ CPF: 123.456.789-00                                       │
│ CRM: 12345/AL                                             │
│ E-mail: joao@hosp.al.gov.br                              │
│ Telefone: (82) 99999-9999                                 │
│                                                           │
│ ─── CASOS ATIVOS ──────────────────────────────────────   │
│ • FIES-2026-0042 — ESF/DGM Aparecida-GO                  │
│   Operacional: ACOMPANHAMENTO_ADM (32 dias)               │
│   Financeiro: ATIVO (3/12 parcelas)                       │
│                                                           │
│ • COVID-2026-0017 — Maceió/AL                            │
│   Operacional: IMPLANTADO                                 │
│   Financeiro: TERMO_ACEITO (R$ 8.400)                     │
│                                                           │
│ ─── HISTÓRICO FINANCEIRO ──────────────────────────────   │
│ Valor total recuperado: R$ 24.800,00                      │
│ Honorários: R$ 3.720,00 (15%)                             │
│ Parcelas pagas: 8/12                                       │
│                                                           │
│ ────────────────────────────────────────────────────────  │
│                                          Página 1 de 3   │  ← Footer
└──────────────────────────────────────────────────────────┘
```

CSS:
- `@page { margin: 24mm 16mm }`
- Color print-safe (navy + preto, dourado vira preto se mono)
- Tabelas com header repetido em cada página
- Quebras de página inteligentes (`page-break-inside: avoid` em sections)

### B.11.2 Termo de Acerto (PDF oficial)

```
┌──────────────────────────────────────────────────────────┐
│                                                           │
│                        ▴HV                                │  ← Logo centralizado
│                                                           │
│             HYAGO VIANA ADVOCACIA                         │
│                                                           │
│                                                           │
│           TERMO DE ACERTO PARCIAL                         │  ← Playfair 28pt navy
│                                                           │
│                v1 · 15/05/2026                            │
│                                                           │
│ ────────────────────────────────────────────────────────  │
│                                                           │
│ Pelo presente Termo de Acerto Parcial, JOÃO SILVA,        │
│ brasileiro, casado, médico, CRM 12345/AL, inscrito no    │
│ CPF 123.456.789-00, residente e domiciliado em...        │
│                                                           │
│ [texto formal completo]                                   │
│                                                           │
│ ─── VALORES ───────────────────────────────────────────  │
│                                                           │
│ Saldo FIES antes:       R$ 145.300,00                     │
│ Saldo FIES após:        R$ 121.500,00                     │
│ Parcelas pagas:         R$ 0,00 (suspensão FIES)         │
│ Valor efetivo:          R$ 23.800,00                      │
│                                                           │
│ Honorários (15%):       R$ 3.570,00                       │
│ Parcelas:               7x R$ 500,00 + 1x R$ 70,00       │
│ À vista (10% desc):     R$ 3.213,00                       │
│                                                           │
│ ─── ASSINATURAS ───────────────────────────────────────  │
│                                                           │
│ ___________________________________                       │
│ JOÃO SILVA · CPF 123.456.789-00                          │
│                                                           │
│ ___________________________________                       │
│ HYAGO VIANA · OAB/AL 12345                                │
│                                                           │
│                                                           │
│ Hash: SHA256-abc123def456 (verificável)                   │  ← Auditoria
│ Documento gerado eletronicamente em 15/05/2026 14:32     │
└──────────────────────────────────────────────────────────┘
```

### B.11.3 Relatórios

Mesma estrutura, com header HV + título + tabela/charts + footer paginação.

---

## B.12 Responsividade exaustiva

### B.12.1 Breakpoints

```
xs  : < 640px   (mobile)
sm  : 640px     (mobile landscape / tablet portrait)
md  : 768px     (tablet)
lg  : 1024px    (tablet landscape / laptop)
xl  : 1280px    (desktop)
2xl : 1536px    (wide desktop)
```

### B.12.2 App interno — responsividade

| Tela | xs/sm | md | lg | xl+ |
|---|---|---|---|---|
| **Sidebar** | Drawer (hambúrguer) | Drawer | Compact (só ícones, 64px) | Full (240px) |
| **TopBar** | Hambúrguer + logo + sino | Idem | Idem + busca | Idem + busca + user full |
| **Cliente 360°** | Tabs stack vertical | Tabs horizontais | 2 colunas | 3 colunas |
| **Pipeline Kanban** | View Lista forçada | View Lista forçada | Kanban scroll horizontal | Kanban full |
| **Tabela** | Cards stackados | Tabela horizontal scroll | Tabela full | Tabela full |
| **Modal** | Full-screen | 90% width | 480px centered | 480px centered |

### B.12.3 App interno em mobile (uso limitado intencional)

> O app interno é **desktop-first**. Mobile é para emergências ("estou fora do escritório, preciso ver caso urgente").

Funcionalidades disponíveis em mobile:
- ✅ Ler Painel Hoje
- ✅ Ver detalhes de caso
- ✅ Aceitar tarefa
- ✅ Mensagens WhatsApp
- ✅ Notificações
- ⚠ Pipeline em modo Lista
- ⚠ Edição de campos simples
- ❌ Edição de Termo (bloqueado mobile)
- ❌ Geração de Minuta (bloqueado)
- ❌ Configurações complexas

Banner discreto no topo:
```
   📱 Modo móvel — algumas funcionalidades limitadas. Use desktop para experiência completa.
```

### B.12.4 Portal do Cliente — mobile-first

> O portal é **construído para mobile primeiro**. Desktop é versão alargada.

Padrões mobile portal:
- Touch targets ≥ 44px
- Bottom nav (5 ícones) em vez de sidebar
- Câmera para upload de docs
- Aceite Termo com pinch-zoom no PDF
- Boletos com swipe entre eles
- Pull-to-refresh em listas

```
┌─────────────────────┐
│  Olá, João  🔔  ⚙  │  ← topbar simples
├─────────────────────┤
│                     │
│  Casos (3)          │
│  [card]             │
│  [card]             │
│                     │
│  Pendências         │
│  📎 2 docs          │
│  💳 1 boleto        │
│  💬 3 mensagens     │
│                     │
├─────────────────────┤
│ 🏠  📂  💳  💬  👤 │  ← bottom nav fixa
└─────────────────────┘
```

### B.12.5 Painel Institucional — desktop + tablet

> ANMR/AMPB acessam mais de desktop. Suporte tablet básico, mobile opcional.

---

## B.13 Microinterações premium (discretas)

### B.13.1 Princípio
> **Premium é silencioso.** Microinterações não pedem atenção; elas confirmam, guiam ou refinam. **Nada de confetti, popups, badges piscando.**

### B.13.2 Lista curada

| Interação | Comportamento |
|---|---|
| **Hover em link** | Cor texto: cinza → navy + underline gold expand left-to-right 200ms |
| **Hover em CaseCard** | Border: `#e8e8e8` → `#d4d4d4` + shadow `0 1px 2px` aparece 150ms |
| **Hover em item sidebar** | Background fade-in `#fafafa` 150ms, color sutil shift |
| **Focus em input** | Border 1px → 1px gold + ring 3px gold/15% — 150ms ease-out |
| **Click em botão** | Scale 1 → 0.98 → 1 em 100ms (tactile feedback) |
| **Drag-drop** | Card eleva (shadow.lg), tilt 1deg, cursor grabbing |
| **Drop válido** | Coluna acende verde sutil (border + bg #16a34a/5) |
| **Drop inválido** | Coluna pulsa vermelho 1x + tooltip motivo |
| **Toast aparece** | Slide-in 200ms da direita + leve scale |
| **Toast desaparece** | Slide-out 250ms + fade |
| **Modal aparece** | Backdrop fade 150ms + modal scale 0.96→1.0 200ms |
| **Tab switch** | Underline gold slide-out + slide-in 200ms ease |
| **Skeleton shimmer** | Gradient horizontal 1.2s loop |
| **Stream IA** | Cursor pulsa, texto aparece char-by-char com easing |
| **Loading button** | Texto + spinner inline (não substitui o texto) |
| **Counter update** | Number tick suave (1→2→3) com 100ms transition |
| **Drag handle** | Aparece só no hover do card (gold) — não polui idle state |
| **Underline em link** | Aparece com gradient gold left-to-right (effect Linear) |
| **Tooltip** | Fade-in 100ms após 500ms hover delay |

### B.13.3 Page transitions

Padrão Linear-style:
- Mudança de rota: conteúdo principal slide-fade 200ms
- Sidebar permanece estática (sem reanimar)
- TopBar permanece estática
- URL atualiza, document.title atualiza

### B.13.4 Easing functions

```
ease-out:    cubic-bezier(0.16, 1, 0.3, 1)        ← default para entradas
ease-in:     cubic-bezier(0.4, 0, 1, 1)           ← saídas
ease-in-out: cubic-bezier(0.65, 0, 0.35, 1)       ← reversíveis
```

Nunca `linear`. Nunca animação > 300ms.

---

## B.14 Padrões transversais (reforço cross-módulo)

### B.14.1 Toda listagem do sistema usa o mesmo padrão

```
┌──────────────────────────────────────────────────────────┐
│ Page Title                                                │  ← Playfair H1 navy
│ Subtitle / count (opcional)                               │  ← Inter caption cinza
│                                                           │
│ ┌─Toolbar───────────────────────────────────────────────┐ │
│ │ [Filtros▾] [View: Kanban|Lista] [Densidade▾] [+ Novo]│ │
│ └───────────────────────────────────────────────────────┘ │
│                                                           │
│ [conteúdo da listagem]                                    │
│                                                           │
│ ┌─Pagination────────────────────────────────────────────┐ │
│ │ < 1 2 3 ... 15 >       Por página: [25 ▾]             │ │
│ └───────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

### B.14.2 Toda página detail usa o mesmo padrão

```
┌──────────────────────────────────────────────────────────┐
│ ← Voltar  ›  Breadcrumb  ›  Item atual         [⋮ Ações] │
│                                                           │
│ ░Título do item                                           │  ← Playfair H1
│ Subtitle / metadados                                      │
│ ⚠ Alertas (se houver)                                     │
│                                                           │
│ [Tabs] [se houver]                                        │
│ ─────                                                     │
│                                                           │
│ [conteúdo do detail]                                      │
└──────────────────────────────────────────────────────────┘
```

### B.14.3 Toda criação usa o mesmo padrão

```
┌──────────────────────────────────────────────────────────┐
│ ← Voltar                                                  │
│                                                           │
│ ░Criar [Item]                                              │
│                                                           │
│ ┌─Form section──────────────────────────────────────────┐ │
│ │ Section title                                          │ │
│ │ [fields]                                               │ │
│ └───────────────────────────────────────────────────────┘ │
│                                                           │
│ ┌─Form section──────────────────────────────────────────┐ │
│ │ ...                                                    │ │
│ └───────────────────────────────────────────────────────┘ │
│                                                           │
│ [Cancelar]                              [Salvar →]        │
└──────────────────────────────────────────────────────────┘
```

### B.14.4 Toda Kanban board do sistema (Pipeline Op, Pipeline Fin, Funil Comercial) tem a mesma estrutura

(Já especificada em §8.6 do PRD original — reforçando que **não há variação visual entre módulos**.)

### B.14.5 Toda timeline do sistema (caso, cliente, oportunidade, conversa) usa o mesmo `TimelineFeed`

Item da timeline:
```
   ┌─ 14:32 · 15/05 ─────────────────────────────────────┐
   │ ●                                                    │
   │ │  Maria Santos                                       │
   │ │  Mudou macrostatus de ACOMPANHAMENTO_ADM            │
   │ │  para IMPLANTADO em FIES-2026-0042                  │
   │ │  💬 "Resposta MS recebida em 14/05"                 │
   │                                                       │
   └──────────────────────────────────────────────────────┘
```

---

## B.15 Mockups ASCII de TODAS telas-chave

### B.15.1 Painel "Hoje" (`/`)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ▴HV  Hyago Viana          ⌘K Buscar tudo...               🔔3  ⓘ Maria S.    │
├──────┬───────────────────────────────────────────────────────────────────────┤
│      │                                                                       │
│ 🏠   │  Bom dia, Maria 👋                                                    │
│ 👥   │  Hoje, 15 de maio · Você tem 3 urgências, 7 tarefas para hoje, 5 amanhã│
│ ⚖   │                                                                       │
│ 📋   │                                                                       │
│ ─── │  🔴  URGENTE (3)                                                       │
│ 🔧   │  ┌────────────────────────────────────────────────────────────────┐  │
│ 🤖   │  │ Protocolar FIES-2026-0042 hoje  •  Dr. Hyago atribuiu        →│  │
│ 💼   │  │ Conferir Termo COVID-2026-0017  •  Pedro elaborou             →│  │
│ 📣   │  │ Responder discordância FIES-2026-0021                         →│  │
│ 💬   │  └────────────────────────────────────────────────────────────────┘  │
│ ─── │                                                                       │
│ 📊   │  🟡  HOJE (7)                                                         │
│ ⚙   │  ┌────────────────────────────────────────────────────────────────┐  │
│      │  │ Solicitar Doc 06 (Declaração) para COVID-2026-0023            →│  │
│      │  │ QA Declaração recebida — COVID-2026-0019                      →│  │
│      │  │ Acompanhar SEI NUP 12345.678/2024-12                          →│  │
│      │  │ ... (4 mais)                                                   │  │
│      │  └────────────────────────────────────────────────────────────────┘  │
│      │                                                                       │
│      │  🔵  PRÓXIMOS DIAS (5)        🟢  CONQUISTAS DA SEMANA (12)          │
│      │  [lista]                       [Implantado: FIES-2026-0010 (R$8.4k)] │
│      │                                                                       │
│ ─── │                                                                       │
│ ⓐ   │                                                                       │
│ Maria│                                                                       │
└──────┴───────────────────────────────────────────────────────────────────────┘
```

### B.15.2 Cliente 360° (`/clientes/:id`)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ← Voltar  ›  Clientes  ›  Dr. João Silva                       [⋮ Ações ▾]  │
│                                                                              │
│ ░Dr. João Silva                                                              │
│ CRM 12345/AL  ·  CPF ***.***.789-00  ·  3 casos ativos  ·  Cliente desde 2024│
│ ⚠ Inadimplente em FIES-2026-0021  ·  📞 (82) 99999-9999  ·  📧 j@hosp.com.br│
│                                                                              │
│ [Casos (3)] [Docs (12)] [Timeline] [Financeiro] [Comunicação (47)]          │
│ ━━━━━━━━━━                                                                  │
│                                                                              │
│ ┌────────────────────────────────────────────────────────────────────────┐  │
│ │ FIES-2026-0042 · ESF/DGM · RENOV. · Aparecida-GO                       │  │
│ │                                                                         │  │
│ │ ┌──OPERACIONAL─────────────┐  ┌──FINANCEIRO──────────────────┐        │  │
│ │ │ ACOMPANHAMENTO_ADM  32d ⚠│  │ ATIVO  (parcela 3/12)         │        │  │
│ │ │ Próx: protocolar resposta │  │ Próx: cobrar D+5 — 25/05/26   │        │  │
│ │ │ Resp: Maria Santos        │  │ Resp: Pedro Lima               │        │  │
│ │ └──────────────────────────┘  └────────────────────────────────┘        │  │
│ │                                                                         │  │
│ │ ⚠ DGM pendente 22d  📎12docs  💬5  📅 Última mov: 12/05  [Abrir →]    │  │
│ └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│ ┌────────────────────────────────────────────────────────────────────────┐  │
│ │ COVID-2026-0017 · IMPLANTADO                                            │  │
│ │ ...                                                                      │  │
│ └────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
```

### B.15.3 Pipeline Operacional (`/casos`)

(Detalhado em §16.2 original — reforço de que **fundo branco**, colunas brancas com borders sutis.)

### B.15.4 Ficha do Caso (`/casos/:id`)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ← Voltar  ›  Casos  ›  FIES-2026-0042                          [⋮ Ações ▾]  │
│                                                                              │
│ ░FIES-2026-0042                                                              │
│ ESF/DGM · RENOV. · Aparecida-GO  ·  Dr. João Silva  ·  CRM 12345/AL          │
│ ⚠ DGM pendente há 22d                                                        │
│                                                                              │
│ [Visão] [Docs (12)] [Timeline] [Financeiro] [Comunicação] [Auditoria]       │
│ ━━━━━                                                                        │
│                                                                              │
│ ┌─OPERACIONAL──────────────────────────┐  ┌─FINANCEIRO─────────────────────┐ │
│ │ Macrostatus: ACOMPANHAMENTO_ADM       │  │ Macrostatus: ATIVO              │ │
│ │ Dias em estado: 32 ⚠ (SLA 45)         │  │ Dias em estado: 17              │ │
│ │ Responsável: Maria Santos             │  │ Responsável: Pedro Lima         │ │
│ │ Próx ação:    protocolar resposta MS  │  │ Próx ação:    cobrar D+5        │ │
│ │ NUP:          12345.678/2024-12       │  │ Parcela atual: 3/12 (R$ 500)   │ │
│ │ flag_judicial: false                  │  │ Valor recuperado: R$ 8.400      │ │
│ │                                       │  │ Honorários totais: R$ 1.260     │ │
│ │ [Mudar macrostatus]                   │  │ [Ver Termo v1]                  │ │
│ └───────────────────────────────────────┘  └────────────────────────────────┘ │
│                                                                              │
│ ─── DOCUMENTOS CANÔNICOS (8/10) ───────────────────────────────────────────  │
│ ✓ DOC-01 Procuração            ✓ DOC-04 CRM             ✗ DOC-06 DGM        │
│ ✓ DOC-02 Contrato              ✓ DOC-05 CNES            ✓ DOC-07 ...        │
│                                                                              │
│ ─── PRÓXIMAS AÇÕES ──────────────────────────────────────────────────────── │
│ • Protocolar resposta MS  (Maria, hoje 17h)                                  │
│ • Verificar planilha banco quando IMPLANTADO  (Carlos, a definir)            │
└──────────────────────────────────────────────────────────────────────────────┘
```

### B.15.5 Pipeline Financeira (`/casos/financeiro`)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ░Pipeline Financeira  ·  487 casos ativos                                    │
│ [Filtros] [Kanban|Lista] [Views complementares ▾]              [+ Novo caso] │
│                                                                              │
│ Views: [Aguardando Ativação] [Parcelas Atrasadas] [Inadimplência] [+5]       │
│                                                                              │
│ ┌ELABORANDO┐┌CONFERINDO┐┌APROV_JUR┐┌COMUNICANDO┐┌APRESENTANDO┐...           │
│ │    12   ││    8     ││    19   ││    23     ││    156      │              │
│ │         ││          ││         ││           ││             │              │
│ │ [card]  ││ [card]   ││ [card]  ││ [card]    ││ [card]      │              │
│ │ [card]  ││ [card]   ││ [card]  ││ [card]    ││ [card]      │              │
│ └────────┘└──────────┘└─────────┘└───────────┘└─────────────┘              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### B.15.6 Painel Controladoria (`/controladoria`)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ░Controladoria · Bom dia, Renata                                             │
│ 🔥 Prazos próximos (15d): 23  ⚠ Exceções: 11  📈 Hoje: +5 movimentações      │
│                                                                              │
│ [Painel] [Prazos] [Movimentações] [Exceções] [Teses] [Decisões] [Projuris]  │
│ ━━━━━━━                                                                      │
│                                                                              │
│ ─── PRAZOS DE HOJE (3) ─────────────────────────────────────────────────── │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ 🔴 CONTESTACAO  ·  FIES-2026-0042  ·  Maria  ·  Até 17h                 │ │
│ │ 🔴 RECURSO      ·  COVID-2026-0017  ·  Pedro  ·  Até 16h                │ │
│ │ 🟡 MANIFESTACAO ·  ESF-2026-0033   ·  Maria  ·  Até 18h                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│ ─── EXCEÇÕES ABERTAS (11) ─────────────────────────────────────────────── │
│ 🔴 PRAZO_CONFLITANTE (1)    🟡 MOVIMENTACAO_BAIXA_CONFIANCA (7)              │
│ 🔴 ERRO_INTEGRACAO (1)       🟢 DECISAO_NAO_CLASSIFICADA (3)                 │
│                                                                              │
│ ─── BASE DE CONHECIMENTO ──────────────────────────────────────────────── │
│ 📜 Teses: 47 aprovadas   ⚖ Decisões: 128 cadastradas (78% favoráveis)        │
└──────────────────────────────────────────────────────────────────────────────┘
```

### B.15.7 Editor de Minuta (`/peticionamento/:id`)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ← Caso FIES-2026-0042  ›  Inicial FIES Adm  ·  v1                            │
│ ⚠ MINUTA — NÃO REVISADA                            [Salvar] [Regenerar tudo] │
├──────────────────┬───────────────────────────────────────────────────────────┤
│                  │                                                           │
│ 📚 FONTES (12)   │ EXMO. SR. SECRETÁRIO DE GESTÃO DO TRABALHO                │
│ ──────────────   │                                                           │
│ 📜 Teses (3)     │ JOÃO SILVA, brasileiro, casado, médico, CRM 12345/AL,    │
│ • FIES Abatim... │ inscrito no CPF 123.456.789-00, residente e domiciliado  │
│ • ESF DGM alt... │ na Rua tal...                                             │
│ • Suspensão...   │                                                           │
│                  │ DOS FATOS                                                  │
│ ⚖ Decisões (5)   │                                                           │
│ • TRF1 3ª T...   │ 1. O Requerente é médico atuante na Estratégia Saúde da │
│ • STJ Resp...    │ Família (ESF) [Tese 1] desde 2018, conforme...           │
│ • TRF1 1ª T...   │                                                           │
│                  │ DO DIREITO                                                 │
│ 📋 Docs (4)      │                                                           │
│ • CPF.pdf        │ Conforme entendimento desta Casa, o abatimento de 1%      │
│ • CRM.pdf        │ mensal previsto no art. 6º-B da Lei 10.260/2001 [Tese 1]│
│ • Contrato.pdf   │                                                           │
│ • DGM.pdf        │ DOS PEDIDOS                                                │
│                  │                                                           │
│ ──────────────   │ a) [DADO FALTANTE: % solicitado]                          │
│ ⚠ ISSUES (2)     │ b) Concessão do abatimento de 1% (um por cento)...       │
│ ✓ CPF: ok        │                                                           │
│ ✓ Nome: ok       │                                                           │
│ ⚠ 1 inferência   │                                                           │
│ ⚠ 1 dado falt.   │                                                           │
│                  │                                                           │
│ [Regen. seção]   │                                                           │
├──────────────────┴───────────────────────────────────────────────────────────┤
│ Score validação: 87/100  ·  [Editar manual] [Aprovar como revisada]          │
└──────────────────────────────────────────────────────────────────────────────┘
```

### B.15.8 Funil Comercial (`/comercial/funil`)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ░Funil Comercial · 234 leads ativos                                          │
│ [Filtros] [Período▾] [Equipe▾]                              [+ Novo lead]    │
│                                                                              │
│ ┌LEAD CAPT.┐┌QUALIFICADO┐┌PROPOSTA┐┌NEGOCIAÇÃO┐┌CONTRATO┐┌CLIENTE┐┌PERDIDO┐ │
│ │   47     ││    32     ││   28   ││    19     ││   12   ││  84  ││  12  │ │
│ │  R$ -    ││ R$ 60K    ││R$ 75K  ││R$ 45K     ││R$ 30K  ││R$210K││  -   │ │
│ │          ││           ││        ││           ││        ││      ││      │ │
│ │ [card]   ││ [card]    ││[card]  ││[card]     ││[card]  ││[card]││[card]│ │
│ │ [card]   ││ [card]    ││[card]  ││[card]     ││[card]  ││[card]││      │ │
│ └─────────┘└───────────┘└────────┘└───────────┘└────────┘└──────┘└──────┘ │
│                                                                              │
│ Cards mostram: nome + source + score + dias-em-etapa + responsável           │
└──────────────────────────────────────────────────────────────────────────────┘
```

### B.15.9 Calendário Editorial (`/marketing/calendario`)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ░Calendário Editorial · Maio 2026                                            │
│ [Mês|Semana|Lista]                       [Sugerir IA] [+ Nova ideia]         │
│                                                                              │
│         Seg     Ter     Qua     Qui     Sex     Sáb     Dom                  │
│                                                                              │
│   1                                     [R]            [F]                    │
│   2     [F]                                                                   │
│   3                                                                           │
│   4                            [I]      [F]                                   │
│   5     [P]                                                                   │
│  ...                                                                          │
│                                                                              │
│ Legenda: [F]eed [P]odcast [R]eel [I]dea [E]mail                             │
│ Cores discretas: [F]navy outline, [P]gold outline, etc.                      │
└──────────────────────────────────────────────────────────────────────────────┘
```

### B.15.10 WhatsApp Inbox (`/whatsapp`)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ░WhatsApp · 47 conversas hoje · 38 in / 9 out                                │
│ [Inbox (3)] [Em atendimento (5)] [Aguardando cliente (12)] [Encerradas]      │
│                                                                              │
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │ 📞 João Silva (+5582 99999-9999) — Não cliente               há 30s    →│ │
│ │ 🤖 Resumo IA: Lead externo, médico, interesse em FIES                    │ │
│ │ "Quero falar com um humano por favor"                                    │ │
│ │ [Pegar conversa]                                                          │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │ 📞 Maria Pereira (+5582 88888-8888) — Cliente ativa          há 2min   →│ │
│ │ 🤖 Resumo IA: Cliente perguntou sobre 2ª via boleto                      │ │
│ │ "Não consegui pagar o boleto, posso ter outra via?"                      │ │
│ │ [Pegar conversa]                                                          │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

### B.15.11 Conversa WhatsApp aberta

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ← Voltar  João Silva (+5582 99999-9999) — Lead              ⓘ atendendo: Camila│
├──────────────────┬───────────────────────────────────────────────────────────┤
│ 🤖 RESUMO IA     │ ┌──────────────────────────────────────────────────────┐  │
│ ──────────────   │ │ João Silva                                09:15        │  │
│ Lead externo     │ │ Olá! Vi seu anúncio sobre FIES                       │  │
│ Médico           │ └──────────────────────────────────────────────────────┘  │
│ CRM 12345/AL     │                                                           │
│ Demanda: FIES    │                       ┌──────────────────────────────────┐│
│                  │                       │ 🤖 Agente IA                09:15 ││
│ COLETADO:        │                       │ Olá! Sou o assistente virtual... ││
│ ✓ Nome           │                       └──────────────────────────────────┘│
│ ✓ CPF            │                                                           │
│ ✓ Profissão      │ ┌──────────────────────────────────────────────────────┐  │
│ ✓ CRM            │ │ João Silva                                09:18        │  │
│ ✓ Demanda        │ │ ACEITO                                                │  │
│                  │ └──────────────────────────────────────────────────────┘  │
│ HANDOFF:         │                                                           │
│ Solicitado pelo  │ ...                                                       │
│ usuário às 09:22 │                                                           │
│                  │ ┌──────────────────────────────────────────────────────┐  │
│ AÇÕES:           │ │ João Silva                                09:22        │  │
│ [Criar lead]     │ │ Quero falar com um humano por favor                   │  │
│ [Vincular client.]│ └──────────────────────────────────────────────────────┘  │
│ [Encerrar]       │                                                           │
├──────────────────┴───────────────────────────────────────────────────────────┤
│ [Digite uma resposta...]                          🎤  📎  📋 Template  ⏎ Enviar│
└──────────────────────────────────────────────────────────────────────────────┘
```

### B.15.12 Dashboard Admin Consolidado (`/dashboards/admin`)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ░Dashboard Admin · Visão executiva                                           │
│ [Período: últimos 30 dias ▾]              [Export PDF] [Compartilhar]        │
│                                                                              │
│ ─── INDICADORES PRINCIPAIS ─────────────────────────────────────────────── │
│ ┌──────────────┬──────────────┬──────────────┬──────────────┬──────────────┐│
│ │ Casos ativos │ Implantados  │ Receita      │ Inadimplência│ Leads novos  ││
│ │              │ no mês       │ recuperada   │              │              ││
│ │   2.547     │     142     │  R$ 487K    │    6.4%     │     47      ││
│ │  ↑ +3.2%    │  ↑ +12.5%   │  ↑ +18.4%   │  ↓ -1.1%    │  ↑ +21.3%   ││
│ └──────────────┴──────────────┴──────────────┴──────────────┴──────────────┘│
│                                                                              │
│ ─── MATRIZ OP × FIN (heatmap) ──────────────────────────────────────────── │
│ [matriz colorida com counts]                                                │
│                                                                              │
│ ─── COHORT IMPLANTAÇÕES ───────────────────────────────────────────────── │
│ [gráfico cohort por mês]                                                     │
│                                                                              │
│ ─── PERFORMANCE POR TIPO DE CASO ──────────────────────────────────────── │
│ [tabela]                                                                     │
└──────────────────────────────────────────────────────────────────────────────┘
```

### B.15.13 Configurações Hub (`/configuracoes`)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ░Configurações                                                               │
│                                                                              │
│ ─── ORGANIZAÇÃO ───────────────────────────────────────────────────────────│
│ ⓘ Identidade                                                                │
│ 👥 Usuários e papéis                                                         │
│ 🛡 Permissões                                                                │
│                                                                              │
│ ─── INTEGRAÇÕES ───────────────────────────────────────────────────────────│
│ 🔌 Projuris               🟢 Conectada      ⓘ                                │
│ 🔌 ZapSign                🟢 Conectada      ⓘ                                │
│ 🔌 Conta Azul             🟢 Conectada      ⓘ                                │
│ 🔌 Asaas                  🟢 Conectada      ⓘ                                │
│ 🔌 ChatGuru               🟢 Conectada      ⓘ                                │
│ 🔌 Gmail                  🟢 Conectada      ⓘ                                │
│ 🔌 Google Drive           🟢 Conectada      ⓘ                                │
│ 🔌 Evolution WhatsApp     🟡 Verificar      ⓘ                                │
│ 🔌 Meta Ads               🟢 Conectada      ⓘ                                │
│ 🔌 Google Ads             ⚪ Desconectada    [Conectar →]                    │
│                                                                              │
│ ─── COMPLIANCE ─────────────────────────────────────────────────────────── │
│ 📋 Auditoria                                                                 │
│ 🔒 LGPD (consents, exports)                                                  │
│ 🔐 Segurança                                                                 │
└──────────────────────────────────────────────────────────────────────────────┘
```

### B.15.14 Portal Cliente — Home (mobile)

```
┌─────────────────────┐
│                     │
│ Olá, Dr. João  🔔 ⓘ │
│                     │
├─────────────────────┤
│                     │
│ Seus casos (3)      │
│                     │
│ ┌─────────────────┐ │
│ │ FIES ESF/DGM    │ │
│ │ • Acompanhando  │ │
│ │                 │ │
│ │ Aguardamos      │ │
│ │ resposta do MS. │ │
│ │ Avisaremos.     │ │
│ │                 │ │
│ │ [Ver detalhes →]│ │
│ └─────────────────┘ │
│                     │
│ ┌─────────────────┐ │
│ │ COVID           │ │
│ │ • Implantado ✓  │ │
│ │ ...             │ │
│ └─────────────────┘ │
│                     │
│ Pendências          │
│ 📎 2 docs           │
│ 💳 1 boleto         │
│ 💬 3 mensagens      │
│                     │
├─────────────────────┤
│ 🏠 📂 💳 💬 👤      │
└─────────────────────┘
```

### B.15.15 Portal Cliente — Aceite Termo (mobile)

```
┌─────────────────────┐
│ ← Termo de Acerto   │
├─────────────────────┤
│                     │
│ FIES-2026-0042      │
│ Termo v1            │
│                     │
│ ┌─────────────────┐ │
│ │ [PDF embed     │ │
│ │  preview]       │ │
│ │  ↑↓ scroll      │ │
│ │  pinch zoom     │ │
│ │                 │ │
│ │  Página 1 de 3  │ │
│ └─────────────────┘ │
│                     │
│ Detalhes principais:│
│ Valor: R$ 24.800    │
│ Honorários: R$ 3.720│
│ Parcelas: 7x R$500  │
│ + 1x R$ 220         │
│                     │
│ ☐ Li o documento     │
│   completo e estou  │
│   de acordo         │
│                     │
│ [Aceitar Termo ]    │
│ (desativado até     │
│  marcar checkbox    │
│  + 2FA)             │
│                     │
├─────────────────────┤
│ 🏠 📂 💳 💬 👤      │
└─────────────────────┘
```

### B.15.16 Configuração Agente WhatsApp (`/whatsapp/agente`)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ░Agente WhatsApp · Configuração                                              │
│                                                                              │
│ ─── STATUS ─────────────────────────────────────────────────────────────── │
│ 🟢 Evolution API: Conectada (instância oficial-hv)                          │
│ Última mensagem: há 2min                                                    │
│ Mensagens hoje: 47 in / 38 out                                              │
│                                                                              │
│ ─── MENSAGENS-MODELO ───────────────────────────────────────────────────── │
│ [✏ Saudação]        [✏ LGPD consent]      [✏ Coleta de dados]               │
│ [✏ Confirmação]     [✏ Handoff]           [✏ Fora de horário]               │
│                                                                              │
│ ─── HORÁRIO DE ATENDIMENTO HUMANO ─────────────────────────────────────── │
│ Segunda a Sexta: 09:00 - 18:00                                              │
│ Sábado: 09:00 - 12:00                                                       │
│ Fora desse horário: agente informa retorno em horário comercial             │
│                                                                              │
│ ─── TEAMS DE PLANTÃO ──────────────────────────────────────────────────── │
│ Comercial:    Camila, Pedro                              [Editar]            │
│ Jurídico:     Dra. Patrícia                              [Editar]            │
│ Adm:          Maria                                       [Editar]            │
│                                                                              │
│ ─── PALAVRAS-CHAVE HANDOFF ────────────────────────────────────────────── │
│ [humano] [atendente] [pessoa] [real]              [+ adicionar]              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### B.15.17 Onboarding migração (`/configuracoes/migracao`)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ░Migração de dados                                                           │
│                                                                              │
│ ─── STATUS DA MIGRAÇÃO ─────────────────────────────────────────────────── │
│ ████████████████░░░░░░░  62%  (1.547 / 2.500 casos)                         │
│                                                                              │
│ ✓ 1.490 importados com sucesso                                              │
│ ⚠ 23 com warnings (revisar)                                                 │
│ ✗ 34 com erro (verificar)                                                   │
│                                                                              │
│ Tempo restante estimado: ~8 minutos                                         │
│                                                                              │
│ [Pausar]  [Cancelar]                              [Ver log detalhado →]     │
│                                                                              │
│ ─── HISTÓRICO DE LOTES ─────────────────────────────────────────────────── │
│ Lote 2026-05-15 14:30  ·  2.500 casos  ·  Em andamento                       │
│ Lote 2026-05-14 16:00  ·  50 casos     ·  Concluído (47 ok, 3 erro)          │
│ Lote 2026-05-13 10:15  ·  50 casos     ·  Concluído (50 ok)                  │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## B.16 Estratégia de implementação design-first

### B.16.1 Filosofia

> **Construir a "casca visual" inteira do produto antes de aplicar qualquer lógica de backend.**

Benefícios:
- Stakeholder (Hyago) vê o sistema **completo navegável** antes do build de lógica.
- Devs frontend trabalham **sem bloqueio** no backend.
- Testes de usabilidade com 5 usuários acontecem **antes de qualquer linha de SQL** ser escrita.
- Refatorações visuais são **baratas** (afetam só componentes).
- Adicionar nova feature de módulo vira **plugar lógica em tela pronta**.

### B.16.2 Roadmap design-first

```
PHASE 0 — DESIGN BIBLE (este PRD 0)
  └─ Tokens + componentes + 115 telas mockup ASCII
     │
     └─ Output: PRD 0 completo

PHASE 1 — FIGMA HIGH-FIDELITY (3 semanas)
  └─ Designer transforma ASCII em Figma editável
  └─ 6 frames master + 30 sub-frames
  └─ Validação Hyago em sessões semanais
     │
     └─ Output: Figma file linked + protótipo clicável

PHASE 2 — IMPLEMENTAÇÃO FRONTEND (4 semanas)
  └─ Dev frontend constrói todas 115 telas
     com dados MOCK (fixtures + MSW para APIs falsas)
  └─ Storybook com 100% dos componentes
  └─ Sistema navegável end-to-end SEM BACKEND
     │
     └─ Output: deploy preview Vercel acessível por Hyago

PHASE 3 — TESTES DE USABILIDADE (1 semana)
  └─ 5 usuários reais (Hyago, Maria, Pedro, Camila, Dra. Patrícia)
  └─ Tarefas: top-15 jornadas críticas
  └─ Ajustes finais baseados em feedback
     │
     └─ Output: design system congelado para implementação

PHASE 4-9 — APLICAR LÓGICA POR MÓDULO
  └─ Projeto 1 → trocar mocks por Supabase real
  └─ Projeto 2 → idem
  └─ ... (sequência 1→2→6→3→4→5)
```

### B.16.3 Stack para frontend mock-first

```
apps/interno/
├─ app/                        # Next.js 15 App Router
├─ components/                 # Componentes consumindo @hv/ui
├─ lib/
│  ├─ supabase/               # Cliente (não usado em mock phase)
│  ├─ fixtures/               # Dados mock organizados por entidade
│  │  ├─ clients.ts           # 50 clientes fake realistas
│  │  ├─ cases.ts             # 200 casos fake (todos estados)
│  │  ├─ termos.ts            # snapshots fake
│  │  └─ ...
│  └─ msw/                    # Mock Service Worker
│     └─ handlers.ts          # responde como se fosse API real
├─ mocks/
│  └─ browser.ts              # MSW config browser
```

Toggle via env var:
- `NEXT_PUBLIC_DATA_MODE=mock` → usa MSW + fixtures
- `NEXT_PUBLIC_DATA_MODE=real` → usa Supabase

### B.16.4 Critério de "tela pronta" antes de aplicar lógica

Para cada tela:
- ✅ Visual idêntico ao Figma
- ✅ Storybook com 5+ variantes (default, loading, empty, error, full)
- ✅ Responsivo testado em xs/md/xl
- ✅ Acessibilidade axe-core: zero erros críticos
- ✅ Atalhos de teclado funcionando
- ✅ Hover/focus/active states
- ✅ Aprovação visual pelo stakeholder

---

## ✅ Validação cruzada final v1.2

### @ux-design-expert
- [x] **115 telas catalogadas** com purpose e permissões
- [x] **Filosofia "um sistema, não seis"** estabelecida (princípios U1-U10)
- [x] **Autenticação completa** especificada (6 telas)
- [x] **Multi-tenancy UX** preparado V1 + V2
- [x] **14 empty states + 7 error states** catalogados
- [x] **Loading states sofisticados** (skeleton, streaming, long ops)
- [x] **Command Palette ⌘K** completo
- [x] **Notificações** end-to-end
- [x] **Print stylesheets** para Dossiê e Termo
- [x] **Responsividade exaustiva**
- [x] **Microinterações premium** (21 padrões)

### skill `frontend-design`
- [x] **Direção visual bold com refinement** (Whiteboard refinado)
- [x] **Typography como hierarquia primária**
- [x] **Cor com função, não decoração**
- [x] **Microinterações com propósito** (não delight gratuito)
- [x] **Anti-genericidade** explicitada (B.0 "o que faz NÃO ser igual aos outros")

### skill `web-design-guidelines`
- [x] **Contraste WCAG 2.2 AA** verificado
- [x] **Foco visível** em todos os componentes
- [x] **Estado nunca só por cor**
- [x] **Whitespace promove escaneabilidade**
- [x] **Touch targets ≥ 44px** em mobile/portal

### @architect
- [x] **Stack mock-first viável** (MSW + fixtures)
- [x] **Storybook como contrato** entre design e dev
- [x] **Componentes em @hv/ui** monorepo
- [x] **Toggle mock/real via env** sem refatoração

### @qa
- [x] **Cada tela tem 5 estados** documentados (default/loading/empty/error/full)
- [x] **Testes E2E** sobre mock-first são possíveis (Playwright vê telas reais)
- [x] **Acessibilidade auditável** axe-core
- [x] **Print testável** (snapshot test PDFs)

### @pm
- [x] **115 telas** = scope claro
- [x] **Roadmap 4 fases pré-código** definido
- [x] **Critério "tela pronta"** mensurável

---

> **Status:** PRD 0 v1.2 — APROVADO como Design Bible do sistema.
>
> **Próximo:** Iniciar Fase 1 (Figma high-fidelity) com designer.
>
> _— @ux-design-expert + skills `frontend-design` + `web-design-guidelines`, sob coordenação de Orion 🎯_
