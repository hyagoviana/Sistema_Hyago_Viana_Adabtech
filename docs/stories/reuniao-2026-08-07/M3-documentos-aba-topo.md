# Story M3: "Documentos" vira ABA no topo do caso (ao lado de Judicial)

**Épico:** Reunião 2026-08-07 — Melhorias até segunda
**ID:** M3
**Status:** Ready for Review
**Estimativa relativa:** M
**Executor sugerido:** @dev (nova rota no Outlet + mover o bloco) · Quality gate: @qa
**Risco:** MÉDIO-BAIXO — cria sub-rota no layout Outlet já existente e move um componente pesado (`CaseDocumentsTab`) da ficha para a rota; cuidar do `routeTree.gen.ts` (OneDrive trava — rebuild).

---

## Story

**Como** advogado/operacional que gerencia os documentos de um caso,
**quero** que **Documentos** seja uma **aba no topo** do caso (ao lado de **Judicial**), em vez de um bloco no fim da ficha,
**para que** a documentação — que "vira uma bagunça com muito documento por cliente" (palavras do Thiago) — tenha um espaço próprio e a ficha comum fique mais limpa.

Hoje o `CaseDocumentsTab` é montado **no fim** da ficha (`casos.$id.index.tsx:616`). A ficha do caso já é um **layout com `<Outlet/>`** e uma **nav de abas** (Ficha / Financeiro / Judicial / Termo — `casos.$id.tsx`). Esta story adiciona uma aba **Documentos** a essa nav e move o conteúdo para uma **nova rota** `casos.$id.documentos.tsx`, removendo o bloco do fim da ficha.

---

## Contexto / o que JÁ EXISTE vs NOVO

### JÁ EXISTE (reusar — NÃO reconstruir)

**Layout com Outlet + nav de abas (F1/G1 2026-08-05):**
- `sistema-hv/src/routes/casos.$id.tsx` — LAYOUT fino: breadcrumb + `<nav>` com `<Link>` para **Ficha** (`/casos/$id`), **Financeiro** (`/casos/$id/financeiro`), **Judicial** (`/casos/$id/judicial`), **Termo** (`/casos/$id/termo`) + `<Outlet/>`. Usa `useMatchRoute` para marcar a aba ativa (`isFin`/`isJud`/`isTermo`/`isIndex`) e `tabCls(active)` para o estilo. **É AQUI que entra a aba "Documentos"** (ao lado de Judicial).
- As sub-rotas já seguem o padrão `casos.$id.<sub>.tsx` (ex.: `casos.$id.judicial.tsx`, `casos.$id.financeiro.tsx`, `casos.$id.termo.tsx`). O molde de rota é o `casos.$id.judicial.tsx` (mesma estrutura: `createFileRoute`, `useParams({ from: ... })`, `useCase`, `useDocumentTitle`).

**Bloco de documentos (a mover):**
- `sistema-hv/src/components/cases/CaseDocumentsTab.tsx` — o componente pesado. Assinatura (`:89-109`): `{ caseId, caseType, frenteSlug?, temaId?, clientId?, canonicalFields?, clientName?, clientCpf?, municipio?, autoFillExtra? }`.
- Montagem atual na ficha (`casos.$id.index.tsx:616-629`) passa: `caseId`, `caseType`, `frenteSlug`, `temaId`, `clientId`, `canonicalFields`, `clientName={cliente?.full_name}`, `clientCpf={cliente?.cpf_cnpj}`, `municipio`, `autoFillExtra={docAutoFill}`. O `docAutoFill` é montado na própria ficha (`:237-250`) via `buildAutoFillFromClient` + `augmentWith*` (municipio/perfil/honorarios/responsaveis). **Esses insumos precisam ser reconstruídos na nova rota** (ou movidos para lá).

**Insumos do autofill (para reproduzir na nova rota):**
- `sistema-hv/src/lib/cases/document-autofill.ts` (`buildAutoFillFromClient`, `augmentWithMunicipio/Perfil/Honorarios/Responsaveis`).
- Hooks: `useClient` (cliente), `useMunicipios`/`usePerfis` (`useReferencias`), `useCaseHonorarios` (`useTermo`), `useCaseResponsaveis` (`useCases`). Todos já importados na ficha.

### NOVO nesta story

1. **Nova rota** `sistema-hv/src/routes/casos.$id.documentos.tsx` — página que monta `CaseDocumentsTab` com os mesmos props, reconstruindo o `docAutoFill` a partir de `useCase`/`useClient`/referências.
2. **Aba "Documentos"** na nav do layout (`casos.$id.tsx`), ao lado de Judicial (ícone `FolderOpen`/`Files`), com `isDoc = matchRoute({ to: "/casos/$id/documentos" })` e ajuste do `isIndex`.
3. **Remoção** do bloco `CaseDocumentsTab` do fim da ficha (`casos.$id.index.tsx`), incluindo o `OrnamentalDivider` órfão.

---

## Acceptance Criteria

1. **Aba Documentos no topo.** A nav de abas do caso (`casos.$id.tsx`) passa a ter uma aba **"Documentos"**, posicionada **ao lado de Judicial**. Clicar nela navega para `/casos/$id/documentos` e marca a aba como ativa (`tabCls(isDoc)`). O `isIndex` (aba Ficha) passa a considerar também `!isDoc`.

2. **Rota dedicada renderiza os documentos.** `/casos/$id/documentos` renderiza o `CaseDocumentsTab` com **os mesmos props** que a ficha passava (caseId, caseType, frenteSlug, temaId, clientId, canonicalFields, clientName, clientCpf, municipio, autoFillExtra), reconstruindo o `docAutoFill` corretamente (mesma lógica de `document-autofill`). O comportamento (listar/gerar/enviar documentos, filtros por pasta/tema) é idêntico ao de hoje.

3. **Ficha comum sem o bloco de documentos.** `CaseDocumentsTab` deixa de ser montado no fim de `casos.$id.index.tsx` (removido junto com o `OrnamentalDivider` que o precedia). A ficha fica mais curta.

4. **Título/breadcrumb.** A rota publica título "`<caso>` · Documentos" (`useDocumentTitle`) — mesmo padrão de `casos.$id.judicial.tsx`/`termo`. O breadcrumb do Topbar mostra o nome do caso + "Documentos".

5. **Sem regressão de rotas.** As abas/rotas existentes (Ficha, Financeiro, Judicial, Termo e `termo/elaborar`) continuam resolvendo. O `routeTree.gen.ts` é regenerado (OneDrive pode travar — rebuild). Nenhuma quebra na navegação entre abas.

6. **Gates.** `npm run typecheck` e `npm run lint` limpos. Nenhuma alteração de banco (story 100% front/rota).

---

## Tasks / Subtasks

### T1 — Nova rota Documentos (@dev)
- [ ] Criar `sistema-hv/src/routes/casos.$id.documentos.tsx` (molde: `casos.$id.judicial.tsx`): `createFileRoute("/casos/$id/documentos")`, `useParams({ from: "/casos/$id/documentos" })`, `useCase(id)`, `useClient`, `useMunicipios`/`usePerfis`, `useCaseHonorarios`, `useCaseResponsaveis`. Reconstruir `docAutoFill` (copiar o bloco `:237-250` da ficha). Montar `CaseDocumentsTab` com os props. `useDocumentTitle("<caso> · Documentos")`. (AC-2, AC-4)
- [ ] Estados loading/erro (Skeleton), como nas outras sub-rotas. (AC-2)

### T2 — Aba na nav do layout (@dev)
- [ ] Em `casos.$id.tsx`: adicionar `const isDoc = !!matchRoute({ to: "/casos/$id/documentos", params: { id } });` e incluir no cálculo `isIndex = !isFin && !isJud && !isTermo && !isDoc`. Adicionar `<Link to="/casos/$id/documentos" params={{ id }} className={tabCls(isDoc)}>` com ícone (`FolderOpen`/`Files`) **ao lado de Judicial**. (AC-1)

### T3 — Remover bloco da ficha (@dev)
- [ ] Em `casos.$id.index.tsx`: remover o `<CaseDocumentsTab ... />` (`:616-629`) e o `OrnamentalDivider` que o antecede (`:614`). Remover imports que ficarem órfãos (`CaseDocumentsTab` se não usado em mais nada na ficha; conferir se `docAutoFill` ainda é usado por `GenerateCaseDocumentFlow` — **é** usado em `:746`, então o `docAutoFill` e os hooks de referência PERMANECEM na ficha). (AC-3)

### T4 — routeTree + QA (@dev/@qa)
- [ ] Regenerar `routeTree.gen.ts` (rebuild; OneDrive pode travar o arquivo). (AC-5)
- [ ] `npm run typecheck` + `npm run lint` verdes. (AC-6)
- [ ] Navegar Ficha ↔ Documentos ↔ Judicial ↔ Financeiro ↔ Termo sem quebra; aba ativa correta. (AC-1, AC-5)
- [ ] Documentos abre, lista, gera e envia igual a antes (com o mesmo autofill). (AC-2)

---

## Dev Notes

- **A ficha já é layout+Outlet** (F1/G1 fizeram a migração em 2026-08-05) — então M3 é barato: só mais uma sub-rota + um `<Link>` na nav. NÃO precisa recriar o layout.
- **Cuidado com o `docAutoFill`:** ele é usado em DOIS lugares na ficha hoje — no `CaseDocumentsTab` (que sai) **e** no `GenerateCaseDocumentFlow` (`:735-748`, que FICA na ficha, é o botão "Enviar contrato e procuração"). Portanto NÃO remova o cálculo de `docAutoFill` nem os hooks de referência da ficha; só remova o `CaseDocumentsTab`. Na nova rota, reconstrua o `docAutoFill` do zero (mesmo código).
- **Sem gate especial:** Documentos não é sensível como o financeiro; todos que veem o caso veem a aba (não há regra de sigilo como no Judicial). Manter a aba sempre visível.
- **routeTree.gen.ts (OneDrive):** ver memória `reference_tanstack_nested_routes` — o arquivo gerado pode travar no OneDrive; se o dev rodar e falhar, fechar o processo que segura o arquivo / rebuild.
- **dev=prod, sem migration:** 100% front. Nenhuma alteração de banco.

**Riscos:**
- **R1 — autofill divergente** na nova rota (documentos gerados com campos faltando). Mitigação: copiar exatamente o bloco de `docAutoFill` da ficha + os mesmos hooks.
- **R2 — routeTree travado** (OneDrive). Mitigação: rebuild / fechar processo.

## Testing

- **Navegação:** todas as abas resolvem; ativa correta; deep-link `/casos/$id/documentos` funciona.
- **Paridade:** listar/gerar/enviar documentos igual a antes; filtros por pasta/tema; autofill preenchendo.
- **Ficha:** bloco de documentos sumiu do fim; `GenerateCaseDocumentFlow` (botão contrato/procuração) continua funcionando.
- **Gates:** `npm run typecheck` + `npm run lint` limpos.

## Dependências

- **Layout+Outlet do caso** (`casos.$id.tsx` + sub-rotas F1/G1) — pré-requisito JÁ existente.
- **`CaseDocumentsTab`** + `document-autofill` + hooks de referência — reuso direto.
- **Coordena com M4** (que também mexe na nav do caso — Termo entra no Financeiro): ambas editam `casos.$id.tsx` (a nav). Fazer as duas em sequência para não conflitar no mesmo arquivo.

## File List

**Novos**
- `sistema-hv/src/routes/casos.$id.documentos.tsx` (aba Documentos)

**Alterados**
- `sistema-hv/src/routes/casos.$id.tsx` (aba "Documentos" na nav + `isDoc`/`isIndex`)
- `sistema-hv/src/routes/casos.$id.index.tsx` (remove `CaseDocumentsTab` + divider órfão; mantém `docAutoFill` p/ `GenerateCaseDocumentFlow`)
- `sistema-hv/src/routeTree.gen.ts` (regenerado)

## Change Log

| Data | Versão | Descrição | Autor |
|---|---|---|---|
| 2026-08-07 | v0.1 | Draft inicial | @sm (Bob) |
| 2026-08-08 | v1.0 | Implementado: rota `casos.$id.documentos.tsx` (autofill idêntico à ficha), aba "Documentos" na nav (ao lado de Judicial, ícone `FolderOpen`), removido `CaseDocumentsTab`+divider da ficha (import órfão limpo), routeTree regenerado. Typecheck OK. | @aios-master (Orion) |
