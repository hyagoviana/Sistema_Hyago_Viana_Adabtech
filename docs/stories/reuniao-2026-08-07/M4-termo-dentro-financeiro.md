# Story M4: "Termo" migra para DENTRO da aba Financeiro (é 100% financeiro)

**Épico:** Reunião 2026-08-07 — Melhorias até segunda
**ID:** M4
**Status:** Ready for Review
**Estimativa relativa:** M
**Executor sugerido:** @dev (rotas + sub-navegação do Financeiro + gate) · Quality gate: @qa
**Risco:** MÉDIO — reorganiza rotas do caso (Termo deixa de ser aba de topo) e move conteúdo para dentro do submenu financeiro, que é **gate-ado por `financeiro:view`**; cuidar de `routeTree.gen.ts` e da regra de que quem NÃO tem financeiro não pode mais acessar o Termo por rota própria.

---

## Story

**Como** usuário do financeiro,
**quero** que o **Termo** deixe de ser uma aba solta de topo e passe a viver **dentro da aba Financeiro** (é 100% financeiro, nas palavras do Thiago),
**para que** o financeiro concentre tudo que é financeiro (parcelas, cobranças, conferência e o termo de honorários) num só lugar, e a nav de topo do caso fique mais enxuta.

Hoje o **Termo** é uma **aba de topo própria** do caso (`casos.$id.termo.tsx`, com sub-rota `casos.$id.termo.elaborar.tsx`), montada na nav do layout (`casos.$id.tsx`). O Thiago confirmou (transcrição ~379-381): "esse termo é dentro dessa aba de financeiro, ele é 100% financeiro". Esta story **remove Termo da nav de topo** e o coloca **dentro do submenu Financeiro** (`casos.$id.financeiro.tsx`), seja como bloco/seção ou como sub-navegação do Financeiro.

---

## Contexto / o que JÁ EXISTE vs NOVO

### JÁ EXISTE (reusar — NÃO reconstruir)

**Nav de topo do caso (onde Termo é aba hoje):**
- `sistema-hv/src/routes/casos.$id.tsx` — LAYOUT com `<Link>` para Ficha/Financeiro/Judicial/**Termo**. O `<Link to="/casos/$id/termo">` está em `:81-83`, e `isTermo = matchRoute({ to: "/casos/$id/termo", fuzzy: true })` (`:52`, `fuzzy` para pegar `termo/elaborar`). **É AQUI que Termo sai da nav.**

**Rotas do Termo:**
- `sistema-hv/src/routes/casos.$id.termo.tsx` — preview do termo em leitura (`useTermos`, snapshot vigente, campos + status + link do PDF + botão "Elaborar / recalcular" → `termo/elaborar`). Página com seu próprio `page-container`/breadcrumb.
- `sistema-hv/src/routes/casos.$id.termo.elaborar.tsx` — a calculadora/elaboração do termo.
- **Nenhum gate hoje:** a rota `casos.$id.termo.tsx` não checa `financeiro:view` (é aberta a qualquer um que vê o caso). Ao migrar para dentro do financeiro, ela herda/ganha o gate financeiro (ver AC-2 / decisão D-M4b).

**Submenu Financeiro (destino):**
- `sistema-hv/src/routes/casos.$id.financeiro.tsx` — página gate-ada por `financeiro:view` (`:60`, mostra "Lock" sem permissão). Já monta `TermoPanel` (parcelas/honorários), `CaseConferenciaFinPanel`, `AsaasCobrancasPanel`, `MoveCaseFinDialog`, sync ContaAzul/Asaas e `FinNotesBlock`. **É AQUI que o Termo passa a viver** (como seção/sub-nav).
- Já existe o `TermoPanel` (`sistema-hv/src/components/cases/TermoPanel.tsx`) montado no financeiro — parte do conteúdo do termo já está lá; o que migra é a **rota de preview/elaboração** (`casos.$id.termo.tsx` / `elaborar`) e o **acesso** a ela.

**Referências ao Termo em outros pontos:**
- `casos.$id.termo.tsx:149` linka `/casos/$id/termo/elaborar`. `casos.$id.index.tsx` NÃO linka mais o termo diretamente na nav (a nav é do layout). Buscar por `to="/casos/$id/termo"` no repo antes de mexer (para não deixar link órfão).

### NOVO nesta story

1. **Termo sai da nav de topo** (`casos.$id.tsx`): remover o `<Link>` de Termo e o `isTermo`; ajustar `isIndex`.
2. **Termo dentro do Financeiro:** decidir (D-M4a) entre (a) **sub-navegação** dentro de `casos.$id.financeiro.tsx` (ex.: abas internas "Parcelas | Cobranças | Termo") que aponta para as rotas do termo, mantendo as rotas `casos.$id.termo*` mas acessíveis **a partir do** financeiro; OU (b) **mover o conteúdo** do preview do termo para uma seção dentro da página financeira. Recomendação SM: manter as rotas `casos.$id.termo`/`elaborar` (menos churn) e **linká-las de dentro do Financeiro** + aplicar o gate financeiro nelas.
3. **Gate financeiro no Termo** (D-M4b): a rota `casos.$id.termo.tsx` (e `elaborar`) passa a exigir `financeiro:view` (client guard + o TermoPanel/RPCs de termo já são financeiros). Quem não tem financeiro não acessa mais o Termo por URL direta.

---

## Acceptance Criteria

1. **Termo fora da nav de topo.** A nav do layout do caso (`casos.$id.tsx`) **não** tem mais a aba "Termo". A nav fica: Ficha, Financeiro, (Documentos — M3), Judicial. O `isTermo` é removido e o `isIndex` recalculado sem ele.

2. **Termo acessível DE DENTRO do Financeiro.** A partir do submenu Financeiro (`/casos/$id/financeiro`), o usuário chega ao Termo — via sub-navegação/aba interna do Financeiro **ou** seção dedicada. O conteúdo do termo (preview vigente + "Elaborar/recalcular") continua funcionando (reusa `casos.$id.termo.tsx`/`elaborar` ou o conteúdo movido).

3. **Gate financeiro no Termo.** O Termo (preview e elaboração) só é acessível a quem tem `financeiro:view` (client guard como em `casos.$id.financeiro.tsx`; os RPCs de termo já são de natureza financeira). Usuário sem `financeiro:view` que acessar `/casos/$id/termo` por URL direta recebe bloqueio (estado "sem permissão"/redirect), nunca o valor dos honorários.

4. **Sem link órfão.** Nenhum ponto do app aponta para uma aba de topo "Termo" inexistente. Todos os links para o termo passam pelo/dentro do Financeiro. Grep por `"/casos/$id/termo"` confirma que os usos restantes são coerentes (dentro do financeiro ou entre preview↔elaborar).

5. **Sem regressão de rotas.** Ficha, Financeiro, Judicial, Documentos (M3) e as rotas do termo (`termo`, `termo/elaborar`) continuam resolvendo. `routeTree.gen.ts` regenerado (OneDrive pode travar — rebuild). Navegação entre abas e para o termo (via financeiro) sem quebra.

6. **Gates.** `npm run typecheck` e `npm run lint` limpos. Nenhuma alteração de banco (story 100% front/rota). O `TermoPanel` já montado no Financeiro não é duplicado nem removido por engano.

---

## Tasks / Subtasks

### T0 — Decisão de arquitetura (SPIKE — @architect/@dev)
- [ ] **D-M4a: sub-nav vs conteúdo movido.** Recomendação SM: manter as rotas `casos.$id.termo(.elaborar)` e expô-las como **aba/sub-nav interna do Financeiro** (menos churn, deep-link preservado). Alternativa: mover o preview do termo para uma **seção** dentro de `casos.$id.financeiro.tsx`. Registrar a escolha. (AC-2)
- [ ] **D-M4b: gate financeiro no Termo.** Aplicar o mesmo guard client de `casos.$id.financeiro.tsx` (`podeVerValores(... "financeiro")` → "Lock") em `casos.$id.termo.tsx` e `elaborar`. Confirmar que os RPCs de termo (`sistema-hv/src/rpc/termo.ts` / `termo-service`) já exigem gate financeiro no servidor; se não, endurecer. (AC-3)

### T1 — Remover Termo da nav de topo (@dev)
- [ ] Em `casos.$id.tsx`: remover o `<Link>` de Termo (`:81-83`) e `isTermo` (`:52`); recalcular `isIndex = !isFin && !isJud && !isDoc` (Documentos vem do M3). (AC-1)

### T2 — Expor Termo dentro do Financeiro (@dev)
- [ ] Em `casos.$id.financeiro.tsx`: adicionar a entrada para o Termo (sub-nav/aba interna "Termo" ou seção), linkando `/casos/$id/termo` (D-M4a). Manter os blocos financeiros atuais (`TermoPanel`, conferência, cobranças) intactos. (AC-2, AC-6)

### T3 — Gate financeiro nas rotas do termo (@dev)
- [ ] Em `casos.$id.termo.tsx` e `casos.$id.termo.elaborar.tsx`: adicionar o guard client (`useMyModulePerms`/`useMyModuleValues` + `podeVerValores`) → estado "Lock"/redirect quando sem `financeiro:view`. Ajustar breadcrumb ("Financeiro › Termo"). (AC-3)
- [ ] Conferir/endurecer o gate server-side dos RPCs de termo (`requireModule("financeiro", "view"|"edit")`), se ainda não estiver. (AC-3)

### T4 — Link órfão + routeTree + QA (@dev/@qa)
- [ ] Grep `"/casos/$id/termo"` e `isTermo` no repo; corrigir usos que assumiam aba de topo. (AC-4)
- [ ] Regenerar `routeTree.gen.ts` (rebuild; OneDrive pode travar). (AC-5)
- [ ] `npm run typecheck` + `npm run lint` verdes. (AC-6)
- [ ] Matriz: com `financeiro:view` → chega ao Termo pelo Financeiro e por URL; sem → bloqueado no Financeiro e no `/termo` direto. Preview + elaborar funcionam. (AC-2, AC-3)

---

## Dev Notes

- **Termo já é financeiro no backend.** O `TermoPanel` (parcelas/honorários) já vive dentro de `casos.$id.financeiro.tsx`. O que M4 faz é (a) tirar a **aba de topo** e (b) trazer o **preview/elaboração** para dentro do financeiro + fechar o **acesso** por gate. Não é reconstrução — é reorganização de rota + gate.
- **Menos churn (D-M4a):** manter `casos.$id.termo(.elaborar)` como rotas e apenas expô-las de dentro do Financeiro evita mover a calculadora inteira. O `matchRoute` do layout perde o `isTermo`, mas as rotas continuam existindo (só não estão na nav de topo).
- **Gate crítico (AC-3):** hoje `casos.$id.termo.tsx` NÃO tem gate — qualquer um que vê o caso vê os honorários. Como Termo passa a ser financeiro, ele DEVE herdar `financeiro:view`. Reusar exatamente o padrão de `casos.$id.financeiro.tsx:60` (bloco "Lock"). Verificar `rpc/termo.ts`/`termo-service.ts` no servidor.
- **Coordenar com M3:** M3 também edita `casos.$id.tsx` (adiciona Documentos). M4 remove Termo dali. Fazer em sequência (ou juntas) para não conflitar no cálculo de `isIndex`/na lista de `<Link>`.
- **routeTree.gen.ts (OneDrive):** rebuild pode ser necessário (`reference_tanstack_nested_routes`).
- **dev=prod, sem migration:** 100% front/rota. Nenhuma alteração de banco.

**Riscos:**
- **R1 — vazamento de honorários** se o gate no `/termo` não for aplicado (a rota fica acessível por URL). Mitigação: guard client + confirmar gate server nos RPCs de termo (T3), QA da matriz.
- **R2 — link órfão** para aba de topo "Termo". Mitigação: grep (T4).
- **R3 — routeTree travado** (OneDrive). Mitigação: rebuild.

## Testing

- **Nav:** sem aba "Termo" no topo; Termo alcançável pelo Financeiro; abas restantes resolvem.
- **Gate:** `financeiro:view` chega ao termo (Financeiro + URL); sem view → bloqueado nos dois; preview + elaborar OK para quem tem.
- **Órfãos:** nenhum link para aba de topo "Termo".
- **Gates:** `npm run typecheck` + `npm run lint` limpos.

## Dependências

- **Submenu Financeiro** (`casos.$id.financeiro.tsx`, gate `financeiro:view`) — destino do Termo.
- **Rotas do termo** (`casos.$id.termo.tsx`/`elaborar`) + `TermoPanel` + RPCs de termo — reuso.
- **RBAC financeiro** (`podeVerValores`/`requireModule("financeiro", ...)`) — para o gate do termo.
- **M3** — edita o mesmo `casos.$id.tsx` (nav): coordenar a ordem/estado final da nav.

## File List

**Novos**
- (nenhum arquivo novo obrigatório se D-M4a = manter rotas + sub-nav)

**Alterados**
- `sistema-hv/src/routes/casos.$id.tsx` (remove aba/`isTermo`; recalcula `isIndex`)
- `sistema-hv/src/routes/casos.$id.financeiro.tsx` (expõe o Termo via sub-nav/seção)
- `sistema-hv/src/routes/casos.$id.termo.tsx` (gate `financeiro:view` + breadcrumb "Financeiro › Termo")
- `sistema-hv/src/routes/casos.$id.termo.elaborar.tsx` (gate `financeiro:view`)
- `sistema-hv/src/rpc/termo.ts` / `sistema-hv/src/lib/termo-service.ts` (endurecer gate financeiro server-side, se necessário)
- `sistema-hv/src/routeTree.gen.ts` (regenerado)

## Change Log

| Data | Versão | Descrição | Autor |
|---|---|---|---|
| 2026-08-07 | v0.1 | Draft inicial | @sm (Bob) |
| 2026-08-08 | v1.0 | Implementado (D-M4a = manter rotas + expor no Financeiro): Termo removido da nav de topo; botão "Termo de honorários" no header do Financeiro (`casos.$id.financeiro.tsx`); gate client `financeiro:view` (estado Lock) em `casos.$id.termo.tsx` e `.elaborar.tsx` + breadcrumb "Financeiro › Termo"; gate server-side `financeiro:view` nas leituras `listTermosFn`/`getTermoFn`/`listParcelasFn` (via `handleFinView`), preservando `getCaseHonorariosFn` aberto p/ autofill de docs. Sem link órfão. Typecheck OK. | @aios-master (Orion) |
