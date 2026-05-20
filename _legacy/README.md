# _legacy/ — Arquivos arquivados

Esta pasta preserva código histórico que foi substituído mas não deletado, para fins de consulta e auditoria.

## Conteúdo

### `sistema-hv-nextjs/`

**O que era:** Monorepo Turborepo + pnpm contendo 3 apps Next.js 14:
- `apps/portal` — Portal do cliente
- `apps/painel` — Painel administrativo
- `apps/interno` — Sistema interno

Mais 5 packages compartilhados:
- `packages/api-client`
- `packages/mocks`
- `packages/tokens` (design tokens)
- `packages/ui` (componentes compartilhados)
- `packages/utils`

**Por que foi arquivado:** Em 2026-05-20 a decisão foi adotar o layout completo produzido no Lovable como a base oficial do sistema. O layout do Lovable é um único app TanStack Start + Vite + Cloudflare que já contém todas as 53 telas necessárias (clientes, casos, peticionamento, controladoria, comercial, marketing, dashboards, WhatsApp, portal cliente etc.) com visual finalizado e aprovado.

**Estado em que foi arquivado:**
- Sem `node_modules` (removidos para reduzir tamanho — eram recriáveis via `pnpm install`)
- Sem `.next/` (caches de build)
- Sem `.turbo/` (cache do Turborepo)
- Com `.git/` interno preservado (era repo independente)
- Código-fonte e configurações 100% preservados

**Como restaurar (se necessário):**
```bash
# Reinstalar dependências
cd _legacy/sistema-hv-nextjs
pnpm install

# Rodar app individual
pnpm --filter portal dev
pnpm --filter painel dev
pnpm --filter interno dev
```

**Lições e código aproveitável:**
- Design tokens em `packages/tokens` podem inspirar refinamentos no `sistema-hv/src/styles.css` atual
- Estrutura de mocks em `packages/mocks` é referência útil
- Configuração de monorepo (turbo.json, pnpm-workspace.yaml) ficou documentada caso queiramos voltar para arquitetura multi-app no futuro

---

## Política

- **NÃO deletar** sem revisão explícita do owner do projeto.
- **NÃO modificar** o conteúdo arquivado — se precisar evoluir algo, copie para o projeto ativo.
- Itens nesta pasta são **read-only** por convenção.
