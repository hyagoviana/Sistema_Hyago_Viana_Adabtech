# 🏗️ Sprint 1 — Fundação Técnica (Passo a Passo)

> **Versão:** 1.0 · **Status:** Pronto para execução
> **Pré-requisitos:** Node.js 20.18+, pnpm 9.12+, Git instalados

---

## 🎯 Objetivo

Construir a **base técnica imutável** do monorepo. Ao final deste sprint, qualquer dev clona o repo, roda `pnpm install && pnpm dev` e vê **3 apps Next.js** rodando com **login mock funcional**, **tokens HV aplicados**, **Storybook publicado** e **CI verde**.

## 📦 Definição de Pronto Sprint 1

- [ ] `pnpm install` completa em < 3min sem erros
- [ ] `pnpm dev` sobe 3 apps (interno:3000, portal:3001, painel:3002)
- [ ] Login mock funciona em interno (admin/comercial/advogado)
- [ ] Sidebar branca com faixa dourada no item ativo aparece
- [ ] Tokens HV (`#1e2044`, `#987814`) aplicados visualmente
- [ ] Storybook (`localhost:6006`) com 5 componentes seed
- [ ] CI verde: lint + typecheck + test
- [ ] axe-core: zero violations no Login + Dashboard placeholder
- [ ] Aprovação multi-agente registrada

---

## 📋 Passo a passo

### FASE 1 — Setup Inicial (Passos 1-8)

#### Passo 1 · Criar estrutura de pastas raiz

```bash
cd "C:/Users/mathe/OneDrive/Área de Trabalho/Projeto Hytalo advogado/Sistema_Hyago_Viana_Adabtech"
mkdir -p sistema-hv && cd sistema-hv
mkdir -p apps/interno apps/portal apps/painel
mkdir -p packages/ui packages/tokens packages/api-client packages/mocks packages/utils
mkdir -p configs/eslint-config configs/tsconfig configs/tailwind-config
mkdir -p .github/workflows .vscode
```

**Validação:** `ls -la` mostra todas as pastas criadas.

#### Passo 2 · Inicializar Git + .gitignore

```bash
git init
```

Criar `.gitignore`:
```
node_modules/
.next/
dist/
.turbo/
coverage/
playwright-report/
storybook-static/
.env*.local
.DS_Store
*.log
```

#### Passo 3 · `pnpm-workspace.yaml`

```yaml
packages:
  - "apps/*"
  - "packages/*"
  - "configs/*"
```

#### Passo 4 · `package.json` raiz

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

#### Passo 5 · `turbo.json`

```json
{
  "$schema": "https://turbo.build/schema.json",
  "ui": "tui",
  "globalDependencies": ["**/.env.*local"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"]
    },
    "dev": { "cache": false, "persistent": true },
    "lint": { "outputs": [] },
    "typecheck": { "dependsOn": ["^build"], "outputs": [] },
    "test": { "outputs": ["coverage/**"] },
    "test:e2e": { "dependsOn": ["build"], "outputs": ["playwright-report/**"] }
  }
}
```

#### Passo 6 · `configs/tsconfig/base.json`

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "jsx": "preserve",
    "incremental": true
  },
  "exclude": ["node_modules", "dist", ".next", "coverage"]
}
```

Criar também `configs/tsconfig/nextjs.json` e `configs/tsconfig/react-library.json` (estendem `base.json` com paths específicos).

`configs/tsconfig/package.json`:
```json
{ "name": "@hv/tsconfig", "version": "0.1.0", "private": true }
```

#### Passo 7 · `configs/eslint-config/`

`configs/eslint-config/base.js`:
```js
export default [
  {
    rules: {
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "no-console": ["warn", { allow: ["warn", "error"] }],
    }
  }
];
```

`configs/eslint-config/package.json`:
```json
{ "name": "@hv/eslint-config", "version": "0.1.0", "private": true, "type": "module" }
```

#### Passo 8 · `prettier.config.js` raiz

```js
export default {
  semi: true,
  singleQuote: false,
  trailingComma: "all",
  printWidth: 100,
  plugins: ["prettier-plugin-tailwindcss"],
};
```

**🛑 CHECKPOINT 1 (Fase 1):**
```bash
pnpm install
```
Deve completar sem erros. Estrutura básica do monorepo no lugar.

---

### FASE 2 — Design Tokens (Passos 9-13)

#### Passo 9 · `packages/tokens/package.json`

```json
{
  "name": "@hv/tokens",
  "version": "0.1.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": { "typecheck": "tsc --noEmit" },
  "devDependencies": { "@hv/tsconfig": "workspace:*", "typescript": "5.7.2" }
}
```

#### Passo 10 · `packages/tokens/src/colors.ts`

```ts
export const colors = {
  navy: {
    DEFAULT: "#1e2044",
    50: "#f4f4f7",
    100: "#e6e7ee",
    200: "#c4c6d6",
    400: "#5c5f8a",
    500: "#3a3e6e",
    700: "#252852",
    900: "#1e2044",
  },
  gold: {
    DEFAULT: "#987814",
    50: "#fdfaf2",
    100: "#fbf3dd",
    200: "#e8d4a0",
    400: "#d4a832",
    500: "#c79b1a",
    700: "#987814",
    900: "#6b5510",
  },
  fg: { DEFAULT: "#171717", muted: "#6b7280", subtle: "#9ca3af" },
  bg: { DEFAULT: "#ffffff", subtle: "#fafafa", muted: "#f5f5f5" },
  border: { DEFAULT: "#e8e8e8", strong: "#d4d4d8", subtle: "#f5f5f5" },
  semantic: {
    success: "#16a34a",
    warning: "#d97706",
    danger: "#dc2626",
    info: "#2563eb",
  },
} as const;
```

#### Passo 11 · `packages/tokens/src/typography.ts`

```ts
export const fontFamily = {
  display: ["Playfair Display", "Georgia", "serif"],
  sans: ["Inter", "system-ui", "sans-serif"],
  mono: ["JetBrains Mono", "ui-monospace", "monospace"],
};

export const fontSize = {
  xs: ["0.75rem", { lineHeight: "1rem" }],
  sm: ["0.875rem", { lineHeight: "1.25rem" }],
  base: ["1rem", { lineHeight: "1.5rem" }],
  lg: ["1.125rem", { lineHeight: "1.75rem" }],
  xl: ["1.25rem", { lineHeight: "1.75rem" }],
  "2xl": ["1.5rem", { lineHeight: "2rem" }],
  "3xl": ["1.875rem", { lineHeight: "2.25rem" }],
  "4xl": ["2.25rem", { lineHeight: "2.5rem" }],
  "5xl": ["3rem", { lineHeight: "1" }],
};
```

#### Passo 12 · `packages/tokens/src/spacing.ts`, `radii.ts`, `shadows.ts`, `motion.ts`

```ts
// spacing.ts
export const spacing = {
  "page-top": "48px",
  "section-gap": "48px",
  "card-padding": "24px",
};

// radii.ts
export const borderRadius = {
  none: "0",
  sm: "0.25rem",
  md: "0.5rem",
  lg: "0.75rem",
  card: "12px",
  input: "8px",
  full: "9999px",
};

// shadows.ts
export const boxShadow = {
  card: "0 1px 3px 0 rgb(0 0 0 / 0.04), 0 1px 2px -1px rgb(0 0 0 / 0.04)",
  popover: "0 4px 6px -1px rgb(0 0 0 / 0.06)",
  modal: "0 25px 50px -12px rgb(0 0 0 / 0.15)",
};

// motion.ts
export const motion = {
  duration: { fast: "150ms", normal: "200ms", slow: "300ms" },
  easing: {
    "ease-out": "cubic-bezier(0.16, 1, 0.3, 1)",
    "ease-in": "cubic-bezier(0.4, 0, 1, 1)",
  },
};
```

#### Passo 13 · `packages/tokens/src/index.ts`

```ts
export * from "./colors";
export * from "./typography";
export * from "./spacing";
export * from "./radii";
export * from "./shadows";
export * from "./motion";
```

`packages/tokens/tsconfig.json`:
```json
{ "extends": "@hv/tsconfig/base.json", "include": ["src/**/*"] }
```

**🛑 CHECKPOINT 2:** `pnpm --filter @hv/tokens typecheck` deve passar.

---

### FASE 3 — Utils + API Client + Mocks (Passos 14-22)

#### Passo 14 · `packages/utils/`

`package.json`:
```json
{ "name": "@hv/utils", "main": "./src/index.ts", "types": "./src/index.ts" }
```

`src/cn.ts`:
```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
```

`src/formatters.ts`:
```ts
export const formatCPF = (cpf: string) =>
  cpf.replace(/\D/g, "").replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");

export const formatBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

export const formatDate = (date: Date | string) =>
  new Intl.DateTimeFormat("pt-BR").format(typeof date === "string" ? new Date(date) : date);
```

`src/index.ts`:
```ts
export * from "./cn";
export * from "./formatters";
```

Deps: `clsx`, `tailwind-merge`.

#### Passo 15 · `packages/api-client/` — schemas Zod

`package.json` com deps: `zod`, `ky`.

`src/schemas/cliente.ts`:
```ts
import { z } from "zod";

export const ClienteSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string(),
  nome: z.string(),
  cpf: z.string().regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/),
  crm: z.string().nullable(),
  email: z.string().email(),
  telefone: z.string(),
  cidade: z.string(),
  uf: z.string().length(2),
  criadoEm: z.string().datetime(),
});

export type Cliente = z.infer<typeof ClienteSchema>;
```

Schemas similares para: `caso.ts`, `usuario.ts`, `tese.ts`, `peticao.ts`, `evento.ts`, `lead.ts`.

#### Passo 16 · `packages/api-client/src/http.ts`

```ts
import ky, { type KyInstance } from "ky";

export function createClient(baseURL: string, organizationId: string): KyInstance {
  return ky.create({
    prefixUrl: baseURL,
    headers: { "X-Org-Id": organizationId, "Content-Type": "application/json" },
    retry: { limit: 2, methods: ["get"] },
    timeout: 30_000,
  });
}
```

#### Passo 17 · `packages/api-client/src/endpoints/clientes.ts`

```ts
import { ClienteSchema, type Cliente } from "../schemas/cliente";
import type { KyInstance } from "ky";
import { z } from "zod";

const ListResponseSchema = z.object({
  data: z.array(ClienteSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});

export async function listarClientes(http: KyInstance, params: { q?: string; page?: number; pageSize?: number } = {}) {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.page) search.set("page", String(params.page));
  if (params.pageSize) search.set("pageSize", String(params.pageSize));
  const res = await http.get(`api/clientes?${search.toString()}`).json();
  return ListResponseSchema.parse(res);
}

export async function obterCliente(http: KyInstance, id: string): Promise<Cliente> {
  const res = await http.get(`api/clientes/${id}`).json();
  return ClienteSchema.parse(res);
}
```

#### Passo 18 · `packages/api-client/src/index.ts`

```ts
export * from "./schemas/cliente";
export * from "./schemas/caso";
// ... outros
export * from "./endpoints/clientes";
export * from "./http";
```

#### Passo 19 · `packages/mocks/` — setup

`package.json` com `msw`, `@faker-js/faker`, `@hv/api-client`.

#### Passo 20 · `packages/mocks/src/factories/cliente.factory.ts`

```ts
import { faker } from "@faker-js/faker";
import { ClienteSchema, type Cliente } from "@hv/api-client";

faker.seed(42); // deterministic

export function createCliente(overrides: Partial<Cliente> = {}): Cliente {
  const cpf = faker.helpers.fromRegExp(/\d{3}\.\d{3}\.\d{3}-\d{2}/);
  return ClienteSchema.parse({
    id: faker.string.uuid(),
    organizationId: "org-hv-default",
    nome: faker.person.fullName(),
    cpf,
    crm: faker.helpers.maybe(() => `${faker.number.int({ min: 10000, max: 99999 })}/AL`) ?? null,
    email: faker.internet.email().toLowerCase(),
    telefone: faker.phone.number({ style: "national" }),
    cidade: faker.helpers.arrayElement(["Maceió", "Arapiraca", "Penedo"]),
    uf: "AL",
    criadoEm: faker.date.past({ years: 2 }).toISOString(),
    ...overrides,
  });
}

export const createClientes = (n: number) => Array.from({ length: n }, () => createCliente());
```

Factories similares para casos (30 mocks iniciais), usuários (3 mocks).

#### Passo 21 · `packages/mocks/src/fixtures/seed.ts`

```ts
import { createClientes } from "../factories/cliente.factory";
import { createCasos } from "../factories/caso.factory";

export const seedDB = (() => {
  const clientes = createClientes(10);
  const casos = createCasos(30, clientes);
  return { clientes, casos };
})();
```

#### Passo 22 · `packages/mocks/src/handlers/`

`auth.handlers.ts`:
```ts
import { http, HttpResponse } from "msw";

const USUARIOS_MOCK = [
  { email: "admin@hv.test", senha: "hyago123", role: "admin", nome: "Admin" },
  { email: "comercial@hv.test", senha: "hyago123", role: "comercial", nome: "Camila" },
  { email: "advogado@hv.test", senha: "hyago123", role: "advogado", nome: "Dr. Hyago" },
];

export const authHandlers = [
  http.post("/api/auth/login", async ({ request }) => {
    const { email, senha } = (await request.json()) as { email: string; senha: string };
    const user = USUARIOS_MOCK.find(u => u.email === email && u.senha === senha);
    if (!user) return HttpResponse.json({ error: "Credenciais inválidas" }, { status: 401 });
    return HttpResponse.json({ user: { email: user.email, role: user.role, nome: user.nome } });
  }),
  http.post("/api/auth/logout", () => HttpResponse.json({ ok: true })),
];
```

`clientes.handlers.ts`:
```ts
import { http, HttpResponse, delay } from "msw";
import { seedDB } from "../fixtures/seed";

export const clientesHandlers = [
  http.get("/api/clientes", async ({ request }) => {
    await delay(120);
    const url = new URL(request.url);
    const q = url.searchParams.get("q")?.toLowerCase() ?? "";
    const page = Number(url.searchParams.get("page") ?? 1);
    const pageSize = Number(url.searchParams.get("pageSize") ?? 20);
    let clientes = seedDB.clientes;
    if (q) clientes = clientes.filter(c => c.nome.toLowerCase().includes(q));
    return HttpResponse.json({
      data: clientes.slice((page - 1) * pageSize, page * pageSize),
      total: clientes.length, page, pageSize,
    });
  }),
];
```

`packages/mocks/src/browser.ts`:
```ts
import { setupWorker } from "msw/browser";
import { authHandlers } from "./handlers/auth.handlers";
import { clientesHandlers } from "./handlers/clientes.handlers";

export const worker = setupWorker(...authHandlers, ...clientesHandlers);
```

`packages/mocks/src/node.ts`:
```ts
import { setupServer } from "msw/node";
import { authHandlers } from "./handlers/auth.handlers";
import { clientesHandlers } from "./handlers/clientes.handlers";

export const server = setupServer(...authHandlers, ...clientesHandlers);
```

**🛑 CHECKPOINT 3:** `pnpm typecheck` em todos os packages. Tudo verde.

---

### FASE 4 — Package UI base (Passos 23-30)

#### Passo 23 · `packages/ui/` setup

`package.json` com deps: Radix primitives (Dialog, Slot, Label, etc.), `class-variance-authority`, `clsx`, `tailwind-merge`, `cmdk`, `lucide-react`, `@hv/tokens`, `@hv/utils`.

#### Passo 24 · `packages/ui/tailwind.preset.ts`

```ts
import type { Config } from "tailwindcss";
import { colors, fontFamily, fontSize, spacing, borderRadius, boxShadow } from "@hv/tokens";

export const preset: Partial<Config> = {
  theme: {
    extend: {
      colors,
      fontFamily,
      fontSize,
      spacing,
      borderRadius,
      boxShadow,
      maxWidth: { content: "1280px", prose: "65ch" },
    },
  },
};
```

#### Passo 25 · `packages/ui/src/styles.css`

```css
@import "tailwindcss";

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
  --font-mono: "JetBrains Mono", monospace;

  --radius-card: 12px;
  --radius-input: 8px;

  --shadow-card: 0 1px 3px 0 rgb(0 0 0 / 0.04), 0 1px 2px -1px rgb(0 0 0 / 0.04);
}

@layer base {
  body {
    @apply bg-bg text-fg font-sans antialiased;
    font-feature-settings: "cv02", "cv03", "cv04", "cv11";
  }
  h1, h2 { font-family: var(--font-display); }
}
```

#### Passo 26 · `packages/ui/src/components/primitives/Button.tsx`

```tsx
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "@radix-ui/react-slot";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@hv/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-input font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-navy text-white hover:bg-navy-700",
        secondary: "bg-bg border border-border text-fg hover:bg-bg-subtle hover:border-border-strong",
        ghost: "bg-transparent text-fg-muted hover:bg-bg-subtle hover:text-navy",
        destructive: "bg-bg border border-semantic-danger text-semantic-danger hover:bg-red-50",
        link: "text-navy underline-offset-4 hover:underline hover:text-gold",
      },
      size: {
        sm: "h-8 px-3 text-sm",
        default: "h-10 px-4 text-sm",
        lg: "h-12 px-6 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "primary", size: "default" },
  }
);

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = "Button";
```

#### Passo 27 · Outros 4 componentes seed

Criar:
- `primitives/Input.tsx` (height 44px, border refinada)
- `primitives/Badge.tsx` (variants: navy, gold, success, warning, danger)
- `display/Card.tsx` (border `#e8e8e8`, radius 12px, padding 24px)
- `primitives/Avatar.tsx` (Radix + cn)

#### Passo 28 · `packages/ui/src/components/layout/Sidebar.tsx`

```tsx
"use client";
import { cn } from "@hv/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";

interface SidebarItem { href: string; label: string; icon: LucideIcon; }

export function Sidebar({ items, user }: { items: SidebarItem[]; user: { nome: string; role: string } }) {
  const pathname = usePathname();
  return (
    <aside className="flex h-screen w-60 flex-col border-r border-border bg-bg">
      <div className="px-5 pb-4 pt-6">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 bg-gold" /> {/* placeholder logo HV */}
          <span className="font-display text-sm font-semibold text-navy">Hyago Viana</span>
        </div>
      </div>
      <nav className="flex-1 px-2">
        {items.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex items-center gap-3 rounded-md px-4 py-2.5 text-sm transition-colors",
                active ? "bg-bg-subtle font-semibold text-navy" : "font-medium text-fg-muted hover:bg-bg-subtle hover:text-navy"
              )}
            >
              {active && <span className="absolute left-0 top-0 h-full w-0.5 bg-gold" />}
              <item.icon className="h-[18px] w-[18px]" strokeWidth={1.5} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border-subtle p-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-bg-muted" />
          <div>
            <div className="text-sm font-medium text-fg">{user.nome}</div>
            <div className="text-xs text-fg-muted">{user.role}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
```

#### Passo 29 · `packages/ui/src/components/layout/Topbar.tsx`

```tsx
"use client";
import { Bell, Command } from "lucide-react";
import { Button } from "../primitives/Button";

export function Topbar() {
  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-bg px-8">
      <div className="flex items-center gap-2 text-sm text-fg-muted">
        {/* Breadcrumb dinâmico */}
      </div>
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" className="gap-2">
          <Command className="h-3.5 w-3.5" />
          <span className="text-xs">Buscar tudo... ⌘K</span>
        </Button>
        <Button variant="ghost" size="icon"><Bell className="h-4 w-4" /></Button>
        <div className="h-8 w-8 rounded-full bg-bg-muted" />
      </div>
    </header>
  );
}
```

#### Passo 30 · `packages/ui/src/index.ts` (barrel export)

```ts
export * from "./components/primitives/Button";
export * from "./components/primitives/Input";
export * from "./components/primitives/Badge";
export * from "./components/primitives/Avatar";
export * from "./components/display/Card";
export * from "./components/layout/Sidebar";
export * from "./components/layout/Topbar";
```

**🛑 CHECKPOINT 4:** `pnpm --filter @hv/ui typecheck` verde.

---

### FASE 5 — App Interno (Passos 31-40)

#### Passo 31 · `apps/interno/package.json`

(Detalhes em `docs/architecture/frontend-architecture.md` §2.2)

#### Passo 32 · `apps/interno/next.config.ts`

```ts
import type { NextConfig } from "next";
const config: NextConfig = {
  reactStrictMode: true,
  experimental: { typedRoutes: true, optimizePackageImports: ["lucide-react", "@hv/ui"] },
  transpilePackages: ["@hv/ui", "@hv/tokens", "@hv/api-client", "@hv/mocks", "@hv/utils"],
};
export default config;
```

#### Passo 33 · `apps/interno/tsconfig.json`

```json
{
  "extends": "@hv/tsconfig/base.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] },
    "plugins": [{ "name": "next" }]
  },
  "include": ["next-env.d.ts", "src/**/*.ts", "src/**/*.tsx", ".next/types/**/*.ts"]
}
```

#### Passo 34 · `apps/interno/tailwind.config.ts`

```ts
import type { Config } from "tailwindcss";
import { preset } from "@hv/ui/tailwind-preset";

export default {
  content: [
    "./src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  presets: [preset as Config],
} satisfies Config;
```

#### Passo 35 · `apps/interno/src/app/layout.tsx` (root)

```tsx
import { Inter, Playfair_Display } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair" });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${playfair.variable}`} suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

#### Passo 36 · `apps/interno/src/app/providers.tsx`

```tsx
"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { useEffect, useState } from "react";

const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 60_000 } } });

export function Providers({ children }: { children: React.ReactNode }) {
  const [mswReady, setMswReady] = useState(process.env.NODE_ENV !== "development");
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    import("@hv/mocks/browser").then(({ worker }) =>
      worker.start({ onUnhandledRequest: "bypass" }).then(() => setMswReady(true))
    );
  }, []);
  if (!mswReady) return null;
  return (
    <QueryClientProvider client={qc}>
      {children}
      <Toaster position="top-right" />
    </QueryClientProvider>
  );
}
```

#### Passo 37 · `apps/interno/src/app/globals.css`

```css
@import "@hv/ui/styles.css";
```

#### Passo 38 · `apps/interno/src/app/(auth)/login/page.tsx`

```tsx
import { LoginForm } from "@/features/auth/components/LoginForm";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-bg px-6">
      <div className="w-full max-w-[420px]">
        <div className="mb-12 text-center">
          <div className="mx-auto mb-6 h-16 w-16 bg-gold" />
          <h1 className="font-display text-3xl text-navy">Hyago Viana Advocacia</h1>
          <p className="mt-2 text-base text-fg-muted">Acesse sua plataforma</p>
        </div>
        <LoginForm />
        <p className="mt-8 text-center text-xs text-fg-muted">
          Maceió/AL · Suporte: suporte@hv.adv.br
        </p>
      </div>
    </main>
  );
}
```

#### Passo 39 · `apps/interno/src/features/auth/components/LoginForm.tsx`

```tsx
"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Input } from "@hv/ui";
import { toast } from "sonner";

const schema = z.object({
  email: z.string().email("E-mail inválido"),
  senha: z.string().min(1, "Senha obrigatória"),
});

type FormData = z.infer<typeof schema>;

export function LoginForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Credenciais inválidas");
      router.push("/hoje");
    } catch {
      toast.error("E-mail ou senha incorretos");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="rounded-card border border-border bg-bg p-8 shadow-card">
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-fg">E-mail</label>
          <Input {...register("email")} type="email" placeholder="seu.email@escritorio.com" />
          {errors.email && <p className="mt-1 text-xs text-semantic-danger">{errors.email.message}</p>}
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-fg">Senha</label>
          <Input {...register("senha")} type="password" placeholder="••••••••••" />
          {errors.senha && <p className="mt-1 text-xs text-semantic-danger">{errors.senha.message}</p>}
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading ? "Entrando..." : "Entrar →"}
        </Button>
        <div className="text-center text-xs text-fg-muted">
          <a href="/recuperar" className="hover:text-gold">Esqueceu sua senha?</a>
          {" · "}
          <a href="#" className="hover:text-gold">Enviar magic link</a>
        </div>
      </div>
    </form>
  );
}
```

#### Passo 40 · `apps/interno/src/app/(dashboard)/layout.tsx` + `hoje/page.tsx`

```tsx
// layout.tsx
import { Sidebar, Topbar } from "@hv/ui";
import { Home, Users, Briefcase, ListChecks, Wrench, Bot, Megaphone, MessageSquare, BarChart3, Settings } from "lucide-react";

const sidebarItems = [
  { href: "/hoje", label: "Painel Hoje", icon: Home },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/casos", label: "Casos", icon: Briefcase },
  { href: "/tarefas", label: "Tarefas", icon: ListChecks },
  { href: "/controladoria", label: "Controladoria", icon: Wrench },
  { href: "/peticionamento", label: "Peticionamento", icon: Bot },
  { href: "/comercial", label: "Comercial", icon: Megaphone },
  { href: "/marketing", label: "Marketing", icon: Megaphone },
  { href: "/whatsapp", label: "WhatsApp", icon: MessageSquare },
  { href: "/dashboards", label: "Dashboards", icon: BarChart3 },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar items={sidebarItems} user={{ nome: "Maria S.", role: "ADM/Operacional" }} />
      <div className="flex flex-1 flex-col">
        <Topbar />
        <main className="flex-1 px-8 pt-12 pb-16">{children}</main>
      </div>
    </div>
  );
}

// hoje/page.tsx
export default function HojePage() {
  return (
    <div className="mx-auto max-w-content">
      <h1 className="font-display text-4xl text-navy">Bom dia, Maria 👋</h1>
      <p className="mt-2 text-base text-fg-muted">
        Hoje, 15 de maio · Você tem 3 urgências, 7 tarefas para hoje, 5 amanhã.
      </p>
      <div className="mt-12 rounded-card border border-border bg-bg p-6 shadow-card">
        <p className="text-fg-muted">Conteúdo do Painel "Hoje" será implementado no Sprint 3.</p>
      </div>
    </div>
  );
}
```

**🛑 CHECKPOINT 5:** `pnpm --filter @hv/interno dev` → abrir `localhost:3000` → ver login → logar com `admin@hv.test / hyago123` → ver dashboard.

---

### FASE 6 — Apps Portal + Painel (Passos 41-43)

#### Passo 41 · `apps/portal/`

Estrutura mínima similar ao `interno`, com:
- Porta 3001
- Layout mobile-first (sem sidebar, bottom nav futuro)
- Login + home placeholder

#### Passo 42 · `apps/painel/`

Estrutura mínima:
- Porta 3002
- Layout desktop, sem sidebar (institucional simples)
- Home placeholder

#### Passo 43 · Validar `pnpm dev` sobe 3 apps

**🛑 CHECKPOINT 6:** 3 apps respondendo em portas distintas.

---

### FASE 7 — Storybook (Passos 44-47)

#### Passo 44 · Setup Storybook no `packages/ui`

```bash
pnpm --filter @hv/ui add -D storybook @storybook/nextjs @storybook/addon-essentials @storybook/addon-a11y msw-storybook-addon
```

`packages/ui/.storybook/main.ts`:
```ts
import type { StorybookConfig } from "@storybook/nextjs";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-essentials", "@storybook/addon-a11y"],
  framework: { name: "@storybook/nextjs", options: {} },
};
export default config;
```

#### Passo 45 · Stories dos 5 componentes seed

`Button.stories.tsx`:
```tsx
import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "../components/primitives/Button";

const meta: Meta<typeof Button> = { component: Button, parameters: { a11y: { test: "error" } } };
export default meta;

export const Primary: StoryObj<typeof Button> = { args: { children: "Entrar", variant: "primary" } };
export const Secondary: StoryObj<typeof Button> = { args: { children: "Cancelar", variant: "secondary" } };
export const Ghost: StoryObj<typeof Button> = { args: { children: "Ver mais", variant: "ghost" } };
export const Destructive: StoryObj<typeof Button> = { args: { children: "Excluir", variant: "destructive" } };
export const Disabled: StoryObj<typeof Button> = { args: { children: "Indisponível", disabled: true } };
```

Idem para Input, Badge, Card, Avatar.

#### Passo 46 · Rodar Storybook

```bash
pnpm storybook
```

Abre `localhost:6006`.

#### Passo 47 · Validar a11y no Storybook

Cada story passa axe-core sem violations critical/serious.

**🛑 CHECKPOINT 7:** Storybook publicado com 5 componentes verdes em a11y.

---

### FASE 8 — CI/CD + Testes (Passos 48-50)

#### Passo 48 · Vitest setup em `apps/interno`

```bash
pnpm --filter @hv/interno add -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom
```

`vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup/vitest.setup.ts"],
    globals: true,
  },
  resolve: { alias: { "@": resolve(__dirname, "./src") } },
});
```

`tests/setup/vitest.setup.ts`:
```ts
import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "@hv/mocks/node";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

Teste smoke `tests/login.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import LoginPage from "@/app/(auth)/login/page";

describe("Login", () => {
  it("renderiza heading HV", () => {
    render(<LoginPage />);
    expect(screen.getByText(/Hyago Viana Advocacia/i)).toBeInTheDocument();
  });
});
```

#### Passo 49 · GitHub Actions

`.github/workflows/ci.yml`:
```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]
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

#### Passo 50 · README + commit inicial

`README.md` raiz com setup instructions:
````markdown
# Hyago Viana Platform

## Setup
\`\`\`bash
pnpm install
pnpm dev
\`\`\`

## Apps
- Interno: http://localhost:3000
- Portal: http://localhost:3001
- Painel: http://localhost:3002
- Storybook: http://localhost:6006

## Login mock
- admin@hv.test / hyago123
- comercial@hv.test / hyago123
- advogado@hv.test / hyago123
````

```bash
git add -A
git commit -m "feat: sprint 1 — fundação técnica (monorepo + design tokens + 3 apps + login mock + storybook)"
```

**🛑 CHECKPOINT 8 (Final):**
- `pnpm dev` → 3 apps + storybook rodando
- Login funcional com 3 usuários
- Sidebar branca com faixa dourada
- Storybook a11y verde
- CI verde no push

---

## ✅ Validação multi-agente (cerimônia Sprint Review)

### @pm
- [ ] Stories S1.1 a S1.5 com ACs cumpridos
- [ ] Demo: clonar repo do zero + `pnpm install && pnpm dev` em < 5min

### @architect
- [ ] Estrutura de pastas conforme ADRs §1
- [ ] Versões pinadas (Next 15.1.3, React 19.0.0, Tailwind 4 beta.7)
- [ ] `@hv/api-client` é única fonte de fetch
- [ ] MSW funciona browser + node

### @ux-design-expert
- [ ] Login premium clean (sem decoração, navy/gold como accent)
- [ ] Sidebar branca + faixa dourada do item ativo
- [ ] Playfair em H1, Inter no resto
- [ ] Whitespace 48px top, 24px card padding

### @qa
- [ ] CI verde: lint + typecheck + vitest
- [ ] Lighthouse Accessibility ≥ 95 login
- [ ] axe-core zero violations Storybook
- [ ] Bundle inicial < 250KB

### skill `frontend-design`
- [ ] Aesthetic intencional (não AI-slop)
- [ ] Tipografia disciplinada (max 2 weights)
- [ ] Sem gradients/glassmorphism

### skill `web-design-guidelines`
- [ ] WCAG 2.2 AA conforme
- [ ] Foco visível gold ring 3px
- [ ] Estados nunca só por cor

---

## 📂 Arquivos criados (resumo)

**~80 arquivos:**
- 1 `pnpm-workspace.yaml`
- 1 `turbo.json` raiz
- 1 `package.json` raiz
- 3 `package.json` apps + ~7 `package.json` packages
- ~10 arquivos de config (TS, ESLint, Tailwind, Prettier)
- ~15 arquivos `@hv/tokens` (colors, typography, etc.)
- ~10 arquivos `@hv/api-client` (schemas + endpoints)
- ~10 arquivos `@hv/mocks` (factories + fixtures + handlers)
- ~10 arquivos `@hv/ui` (5 componentes + sidebar + topbar + stories)
- ~10 arquivos `apps/interno` (layout + login + hoje + providers)
- 3 `apps/portal` placeholder
- 2 `apps/painel` placeholder
- 1 `.github/workflows/ci.yml`
- 1 `README.md` raiz

---

## 🚀 Próximo Sprint

**Sprint 2 — Design System Core** (50 componentes). Depende deste Sprint 1 estar verde em todas validações.

---

> _Sprint 1 detalhado. Pronto para execução._
> _— Orion, orquestrando o sistema 🎯_
