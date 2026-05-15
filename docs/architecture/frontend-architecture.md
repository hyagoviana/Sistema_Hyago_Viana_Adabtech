# 🏗️ Arquitetura Técnica — Frontend Mock-First

> **Plataforma Hyago Viana Advocacia · Fase F2**
> **Versão:** 1.0 · **Owner:** @architect · **Data:** 2026-05-15 · **Status:** Pronto para 8 sprints

Este documento é a **fonte de verdade técnica** para a construção do frontend. Consumido por todos os sprints (S1-S8). Resultado da consultoria do agente @architect (Plan).

---

## 0. Premissas

- **Mock-first**: nenhum endpoint Supabase real é chamado até F4. Toda I/O passa por MSW + fixtures locais. A camada de serviço (`packages/api-client`) já tem a forma final dos contratos para que o swap mock → real seja troca de baseURL + remoção do worker.
- **Monorepo Turborepo + pnpm workspaces**: 3 apps Next.js + 6 packages compartilhados. Build cache + remote cache (Turbo cloud) já no Sprint 1.
- **Server-first**: tudo que pode ser RSC, é RSC. Client components são fronteiras explícitas (`"use client"` no topo do arquivo).
- **Type-safety end-to-end**: Zod é a fonte de verdade. Schemas geram tipos TS e validam tanto formulários quanto respostas mockadas.
- **Acessibilidade WCAG 2.2 AA é gate de PR**: axe-core no Storybook test-runner; Playwright com `@axe-core/playwright` nos fluxos críticos.

---

## 1. Estrutura exata do monorepo

```
hyago-viana-platform/   (será criada como sistema-hv/ no projeto)
├── apps/
│   ├── interno/                      # app.hyagoviana.adv.br (95 telas)
│   │   ├── src/
│   │   │   ├── app/                  # App Router
│   │   │   │   ├── (auth)/           # login, recover (sem layout dashboard)
│   │   │   │   ├── (dashboard)/      # autenticadas (com AppShell)
│   │   │   │   │   ├── layout.tsx    # Sidebar + Topbar
│   │   │   │   │   ├── hoje/
│   │   │   │   │   ├── clientes/[clienteId]/{@timeline,@docs}
│   │   │   │   │   ├── casos/, fies/, controladoria/, etc.
│   │   │   │   ├── api/              # route handlers
│   │   │   │   ├── layout.tsx
│   │   │   │   └── globals.css
│   │   │   ├── features/             # vertical slices
│   │   │   │   ├── fies/, controladoria/, etc.
│   │   │   │   └── {components,hooks,schemas,services,types.ts}
│   │   │   ├── lib/{msw,providers,auth-mock}
│   │   │   └── middleware.ts
│   │   ├── tests/{e2e,setup}
│   │   ├── {next,tailwind,tsconfig,playwright}.config
│   │   └── package.json
│   ├── portal/                       # mobile-first (14 telas)
│   └── painel/                       # institucional (6 telas)
│
├── packages/
│   ├── ui/                           # design system shadcn customizado
│   │   ├── src/components/{primitives,composites,layout,feedback}
│   │   ├── stories/                  # Storybook
│   │   └── tailwind.preset.ts
│   ├── tokens/                       # design tokens (cores, tipo, espaço)
│   ├── api-client/                   # camada de serviço (zod + clients)
│   │   ├── src/schemas/, endpoints/, http.ts
│   ├── mocks/                        # MSW handlers + fixtures
│   │   ├── src/{handlers,fixtures,factories,scenarios}
│   │   └── {browser,node}.ts
│   └── utils/                        # helpers puros
│
├── configs/
│   ├── eslint-config/, tsconfig/, tailwind-config/
│
├── .github/workflows/
│   ├── ci.yml, e2e.yml, chromatic.yml
├── pnpm-workspace.yaml, turbo.json
└── package.json
```

**Decisões-chave:**
- Vertical slices em `apps/*/src/features/` (não em packages — só o reusável vai para `packages/ui`).
- `packages/api-client` define contratos. Quando backend real chegar (F4), só essa package muda.
- `packages/mocks` isolado em pacote próprio para rodar em browser (MSW worker), node (Vitest) e Storybook.

---

## 2. Dependências exatas (versões pinadas)

### Root `package.json`

```json
{
  "name": "hyago-viana-platform",
  "private": true,
  "packageManager": "pnpm@9.12.0",
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test",
    "test:e2e": "turbo run test:e2e",
    "storybook": "pnpm --filter @hv/ui storybook",
    "format": "prettier --write \"**/*.{ts,tsx,md}\""
  },
  "devDependencies": {
    "turbo": "2.3.3",
    "prettier": "3.4.2",
    "prettier-plugin-tailwindcss": "0.6.9",
    "typescript": "5.7.2"
  },
  "engines": { "node": ">=20.18.0", "pnpm": ">=9.12.0" }
}
```

### `apps/interno/package.json` (essencial)

```json
{
  "name": "@hv/interno",
  "dependencies": {
    "@hv/ui": "workspace:*",
    "@hv/tokens": "workspace:*",
    "@hv/api-client": "workspace:*",
    "@hv/mocks": "workspace:*",
    "@hv/utils": "workspace:*",
    "next": "15.1.3",
    "react": "19.0.0",
    "react-dom": "19.0.0",
    "@tanstack/react-query": "5.62.7",
    "@tanstack/react-table": "8.20.6",
    "zustand": "5.0.2",
    "react-hook-form": "7.54.1",
    "@hookform/resolvers": "3.9.1",
    "zod": "3.24.1",
    "date-fns": "4.1.0",
    "lucide-react": "0.468.0",
    "msw": "2.7.0",
    "sonner": "1.7.1",
    "nuqs": "2.2.3",
    "next-themes": "0.4.4"
  },
  "devDependencies": {
    "@playwright/test": "1.49.1",
    "@axe-core/playwright": "4.10.1",
    "vitest": "2.1.8",
    "@testing-library/react": "16.1.0",
    "tailwindcss": "4.0.0-beta.7",
    "@tailwindcss/postcss": "4.0.0-beta.7"
  }
}
```

### `packages/ui` (chave)

```json
{
  "dependencies": {
    "@hv/tokens": "workspace:*",
    "class-variance-authority": "0.7.1",
    "clsx": "2.1.1",
    "tailwind-merge": "2.5.5",
    "@radix-ui/react-*": "latest",
    "cmdk": "1.0.4",
    "lucide-react": "0.468.0"
  },
  "devDependencies": {
    "storybook": "8.4.7",
    "@storybook/nextjs": "8.4.7",
    "@storybook/addon-a11y": "8.4.7",
    "msw-storybook-addon": "2.0.4"
  }
}
```

### `packages/mocks`

```json
{
  "dependencies": {
    "msw": "2.7.0",
    "@faker-js/faker": "9.3.0",
    "@hv/api-client": "workspace:*"
  }
}
```

---

## 3. ADRs (Decisões Arquiteturais)

| # | ADR | Resumo |
|---|---|---|
| **001** | Organização por feature, não por tipo | `features/<dominio>/{components,hooks,services,schemas}` em vez de globais |
| **002** | RSC default, Client opt-in | `"use client"` só em estado/efeitos/libs client-only |
| **003** | Data fetching strategy | RSC + fetch (estável) / TanStack Query (filtros) / Realtime via refetchInterval |
| **004** | State management boundaries | Server→TanStack / URL→nuqs / UI ephemeral→Zustand / local→useState. **Dados de backend nunca em Zustand.** |
| **005** | MSW único | Intercepta browser + node + Storybook a partir de `packages/mocks` |
| **006** | Theming via CSS vars | Tokens TS → CSS vars → Tailwind 4 `@theme` |
| **007** | i18n preparada | `messages/pt-BR/` com `t()` simples; next-intl plugável depois |
| **008** | Composition: compound + slot | shadcn pattern (Radix Slot + asChild); compound em densos |
| **009** | Multi-tenancy preparada | `X-Org-Id` header injetado pelo `api-client/http.ts` |
| **010** | LGPD by design | Cookie banner, `<MaskedField />`, logUserAction() wrapper |

---

## 4. Configurações chave (snippets prontos)

### TypeScript base

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "jsx": "preserve",
    "incremental": true
  }
}
```

### Tailwind preset

```ts
// packages/ui/tailwind.preset.ts
import type { Config } from "tailwindcss";
import { colors, fontFamily, fontSize, spacing, borderRadius, boxShadow } from "@hv/tokens";

export const preset: Partial<Config> = {
  theme: {
    extend: {
      colors, fontFamily, fontSize, spacing, borderRadius, boxShadow,
      maxWidth: { content: "1280px", prose: "65ch" },
    },
  },
};
```

### `globals.css` (Tailwind 4)

```css
@import "tailwindcss";
@import "@hv/ui/styles.css";

@theme {
  --color-navy: #1e2044;
  --color-gold: #987814;
  --color-bg: #ffffff;
  --color-bg-subtle: #fafafa;
  --color-border: #e8e8e8;
  --color-fg: #171717;
  --color-fg-muted: #6b7280;
  --font-display: "Playfair Display", serif;
  --font-sans: "Inter", system-ui, sans-serif;
  --radius-card: 12px;
  --shadow-card: 0 1px 3px 0 rgb(0 0 0 / 0.04);
}
```

### `next.config.ts`

```ts
import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true,
    optimizePackageImports: ["lucide-react", "@hv/ui"],
  },
  transpilePackages: ["@hv/ui", "@hv/tokens", "@hv/api-client", "@hv/mocks", "@hv/utils"],
  headers: async () => [{
    source: "/(.*)",
    headers: [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    ],
  }],
};
export default config;
```

### `turbo.json`

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": [".next/**", "!.next/cache/**"] },
    "dev": { "cache": false, "persistent": true },
    "lint": { "outputs": [] },
    "typecheck": { "dependsOn": ["^build"], "outputs": [] },
    "test": { "outputs": ["coverage/**"] },
    "test:e2e": { "dependsOn": ["build"], "outputs": ["playwright-report/**"] }
  }
}
```

---

## 5. Estratégia de testes

### Pirâmide

| Camada | Ferramenta | Cobertura alvo |
|---|---|---|
| Unit (utils, schemas, hooks) | Vitest + jsdom | 80% |
| Componente (UI primitives) | Storybook + interactions | 100% das stories |
| Acessibilidade | axe via Storybook + Playwright | 100% telas críticas |
| Integração (feature) | Vitest + Testing Library + MSW | fluxos principais |
| E2E (jornadas) | Playwright | 10 jornadas críticas |

### `tests/setup/vitest.setup.ts`

```ts
import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "@hv/mocks/node";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

### `playwright.config.ts`

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  use: { baseURL: "http://localhost:3000", trace: "on-first-retry" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-safari", use: { ...devices["iPhone 14"] }, testMatch: /portal\/.*/ },
  ],
  webServer: { command: "pnpm dev", url: "http://localhost:3000", reuseExistingServer: !process.env.CI },
});
```

### 10 jornadas E2E críticas

1. Login → painel Hoje → abrir caso FIES → ver Cliente 360°
2. Pipeline FIES: arrastar card de coluna A para B
3. Gerar minuta de petição (streaming mock Claude)
4. Aceitar Termo no portal cliente (jornada mobile)
5. Triagem WhatsApp: ver thread → fazer handoff
6. Criar tese no módulo controladoria
7. Filtros URL persistem em listagem de casos
8. Toggle dark mode persiste após reload (V2 plugável)
9. Permissão: usuário "Comercial" não vê módulo Controladoria
10. A11y: navegação completa por teclado em todas as 10 jornadas

---

## 6. CI/CD — GitHub Actions

### `ci.yml`

```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9.12.0 }
      - uses: actions/setup-node@v4
        with: { node-version: 20.18.0, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo run lint typecheck test
```

### `e2e.yml`

```yaml
name: E2E
on: [pull_request]
jobs:
  playwright:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9.12.0 }
      - uses: actions/setup-node@v4
        with: { node-version: 20.18.0, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec playwright install --with-deps chromium webkit
      - run: pnpm --filter @hv/interno test:e2e
      - uses: actions/upload-artifact@v4
        if: failure()
        with: { name: playwright-report, path: apps/interno/playwright-report/ }
```

### Deploy
Vercel via integração GitHub: 3 projetos (interno/portal/painel) com Root Directory distinto. Preview por PR automático.

---

## 7. Convenções de código

| Tipo | Convenção | Exemplo |
|---|---|---|
| Componente | PascalCase | `PipelineBoard.tsx` |
| Hook | `use` prefix | `useCliente360.ts` |
| Schema Zod | `Schema` suffix | `ClienteSchema` |
| Type | `z.infer<>` | `type Cliente = z.infer<typeof ClienteSchema>` |
| Pasta feature | kebab-case | `peticionamento/` |
| Constante | UPPER_SNAKE | `MACROSTATUS_OPERACIONAL` |
| Server action | `action` prefix | `actionCriarCaso` |
| Service | verbo + entidade | `listarCasos`, `obterCliente` |

**Padrões de composição:**
- **Compound** para widgets densos (DataTable.Toolbar, PipelineBoard.Column)
- **AsChild via Radix Slot** quando precisa virar outro elemento
- **Polymorphism `as` prop** apenas em Text, Heading
- **Render prop** raro (só quando consumer controla N filhos)

**Ordem de imports (ESLint rule):**
```ts
import { Button } from "@hv/ui";              // 1. packages internos
import { useState } from "react";             // 2. libs externas
import { CasoCard } from "@/features/fies";   // 3. alias interno
import { cn } from "@/lib/utils";             // 4. relativos curtos
```

---

## 8. Estratégia de fixtures e MSW

### Estrutura

```
packages/mocks/src/
├── factories/        # faker-based, seedado (determinístico)
├── fixtures/         # seed.ts orquestra
│   ├── clientes.ts   # 50 clientes
│   ├── casos.ts      # 200 casos FIES + 80 outros
│   ├── teses.ts      # 40 teses
│   ├── peticoes.ts   # 30 peças validadas
│   ├── leads.ts      # 100 leads
│   ├── eventos.ts    # 500 eventos timeline
│   └── seed.ts
├── handlers/         # por domínio
├── scenarios/        # error, slow, offline, empty
├── browser.ts
└── node.ts
```

### Factory exemplo

```ts
// factories/cliente.factory.ts
import { faker } from "@faker-js/faker";
import { ClienteSchema, type Cliente } from "@hv/api-client";

faker.seed(42); // determinístico

export function createCliente(overrides: Partial<Cliente> = {}): Cliente {
  return ClienteSchema.parse({
    id: faker.string.uuid(),
    nome: faker.person.fullName(),
    cpf: faker.helpers.fromRegExp(/[0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2}/),
    crm: faker.helpers.maybe(() => `${faker.number.int({ min: 10000, max: 99999 })}/AL`),
    email: faker.internet.email(),
    organizationId: "org-hv-default",
    criadoEm: faker.date.past({ years: 2 }).toISOString(),
    ...overrides,
  });
}
```

### Handler exemplo

```ts
// handlers/casos.handlers.ts
import { http, HttpResponse, delay } from "msw";
import { seedDB } from "../fixtures/seed";

export const casosHandlers = [
  http.get("/api/casos", async ({ request }) => {
    await delay(120);
    const url = new URL(request.url);
    const q = url.searchParams.get("q")?.toLowerCase() ?? "";
    const macrostatus = url.searchParams.get("macrostatus");
    const page = Number(url.searchParams.get("page") ?? 1);
    const pageSize = Number(url.searchParams.get("pageSize") ?? 20);

    let casos = seedDB.casos;
    if (q) casos = casos.filter(c => c.titulo.toLowerCase().includes(q));
    if (macrostatus) casos = casos.filter(c => c.macrostatusOperacional === macrostatus);

    return HttpResponse.json({
      data: casos.slice((page-1)*pageSize, page*pageSize),
      total: casos.length, page, pageSize,
    });
  }),
];
```

### Cenários (toggle DevTools)

- `happy` (default)
- `slow` (2-5s delays)
- `error` (todas rotas 500)
- `empty` (listagens vazias)
- `offline` (network errors)

---

## 9. Theming

### `packages/tokens/src/colors.ts`

```ts
export const colors = {
  navy: { DEFAULT: "#1e2044", 50: "#f4f4f7", 500: "#3a3e6e", 900: "#1e2044" },
  gold: { DEFAULT: "#987814", 500: "#c79b1a", 700: "#987814" },
  fg: { DEFAULT: "#171717", muted: "#6b7280" },
  bg: { DEFAULT: "#ffffff", subtle: "#fafafa", muted: "#f5f5f5" },
  border: { DEFAULT: "#e8e8e8", strong: "#d4d4d8" },
  semantic: { success: "#16a34a", warning: "#d97706", danger: "#dc2626", info: "#2563eb" },
} as const;
```

Dark mode (V2 opt-in): `next-themes` com `attribute="data-theme"`, tokens duplicados em `[data-theme="dark"]`.

---

## 10. Riscos técnicos (top 5)

| # | Risco | Mitigação |
|---|---|---|
| **TR-1** | Tailwind 4 beta com bugs | Pinar versão exata; fallback documentado para Tailwind 3.4 |
| **TR-2** | React 19 + Storybook 8 incompatibilidades | Smoke test S1; plano B React 18.3 |
| **TR-3** | RSC + MSW (worker não funciona em SSR) | `setupServer` no entry; gerar `route.ts` a partir dos handlers se preciso |
| **TR-4** | Drift `api-client` Zod vs backend real F4 | Schemas nascem dos PRDs; comparar com tipos gerados do Supabase em F4 |
| **TR-5** | Acessibilidade quebrar silenciosamente | axe-core como gate de PR; Playwright a11y nas 10 jornadas |

---

## 11. Princípios não-negociáveis

1. **Nenhum `fetch` direto em componente.** Tudo via `@hv/api-client`.
2. **Nenhum estado de servidor em Zustand.**
3. **Nenhuma tela sem story no Storybook** (compostas) ou sem componente do design system (atômicas).
4. **PR só passa se:** typecheck verde, lint verde, vitest verde, axe sem violations critical/serious.
5. **Toda fixture é determinística** (faker seedado).
6. **`organizationId` em toda entidade** desde dia 1.
7. **CPF, CRM, e-mail nunca em logs.** Componente `<MaskedField />` é o único caminho.

---

> _— @architect, sob coordenação de Orion 🎯_
