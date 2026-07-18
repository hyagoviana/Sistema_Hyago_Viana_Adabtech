# Story R3-04: Sidebar por módulo + reorganização em Comercial/Operacional/Financeiro/Controladoria/Inteligência

- **Épico:** R3 — Permissões por módulo + reorganização de módulos (E3 + parte de B3)
- **ID:** R3-04
- **Status:** Draft
- **Estimativa relativa:** M (reagrupar itens do Sidebar por módulo + trocar filtro `canSeeRoute` por `permissaoEfetiva` por módulo)
- **Executor sugerido:** @dev + @ux-design-expert (agrupamento) · Quality gate: @architect
- **Ordem:** depois de R3-01 (infra). Pode ir após ou em paralelo a R3-02.

---

## Story

**Como** usuário,
**quero** o menu lateral **reorganizado nos módulos** Comercial · Operacional · Financeiro · Controladoria · Inteligência (+ Marketing/Sistema),
**para que** eu veja apenas os módulos a que tenho acesso (permissão efetiva) e novos módulos apareçam automaticamente conforme minha permissão.

---

## Contexto / o que JÁ EXISTE vs NOVO

### JÁ EXISTE (verificado)
- **Sidebar** `src/components/hv/Sidebar.tsx` — 5 grupos atuais: **Operação, Comercial, Inteligência, Marketing, Sistema** (`groups` em `Sidebar.tsx:73-118`).
- Filtro por papel: `visibleGroups` em `Sidebar.tsx:221-233` usa `canSeeRoute(role, it.to)` + regra especial `/permissoes` só admin (`:227-229`). Enquanto `role` é `null`, mostra tudo (`:233`).
- Rotas já existentes: `controladoria.*`, `inteligencia.*`, `comercial.*`, `casos.financeiro`, `relatorio-financeiro`, `dashboards`, `marketing`, `whatsapp`, `permissoes`, `configuracoes`.
- `ROLE_NAV`/`canSeeRoute` em `rbac.ts:118-169`.

### NOVO
- Reagrupar os `groups` do Sidebar nos módulos-alvo do doc-mestre §4.3: **Comercial · Operacional · Financeiro · Controladoria · Inteligência** (+ Marketing/Sistema como hoje).
- Cada grupo mapeia para um `Module` (R3-01) e o filtro passa a usar `permissaoEfetiva(role, overrides, module, 'view')`, com `canSeeRoute` mantido como **fallback por rota** onde a granularidade de módulo não é suficiente.

> **DECISÃO TRAVADA (doc-mestre §4.3, §5.4):** reorganização é de **apresentação**; rotas já existem. Novos módulos aparecem no Sidebar **por permissão**. Aditivo — não remover rotas nem quebrar o filtro por papel de quem não tem override.

---

## Reagrupamento proposto (itens já existentes, só reorganizados)

| Módulo (grupo) | Itens (rotas atuais) |
|----------------|----------------------|
| **Operacional** | `/hoje`, `/pipeline` (Pipeline Operacional), `/clientes`, `/tarefas` |
| **Comercial** | `/inteligencia/leads` (Cadastro), `/comercial`, `/comercial/leads` (Pipeline Comercial), `/comercial/assinaturas` (Assinatura) |
| **Financeiro** | `/casos/financeiro` (Pipeline Financeira), `/relatorio-financeiro` |
| **Controladoria** | `/controladoria`, `/peticionamento` |
| **Inteligência** | `/dashboards` (Dashboard), `/whatsapp` |
| **Marketing** | `/marketing`, `/design-system` |
| **Sistema** | `/referencias`, `/permissoes`, `/configuracoes` |

> Ajuste fino do agrupamento com @ux-design-expert; o que importa para R3 é: (a) cada grupo carrega um `module`; (b) o filtro usa permissão efetiva. `/hoje` fica em Operacional mas é visível a todos (ver AC-4).

---

## Acceptance Criteria

1. Sidebar reagrupado nos módulos acima; cada `group` referencia seu `Module`.
2. O filtro de visibilidade usa `permissaoEfetiva(role, overrides, group.module, 'view')` para exibir/ocultar o grupo inteiro; itens individuais continuam podendo usar `canSeeRoute` como refinamento (fallback por rota).
3. **Regressão zero sem override:** para cada um dos 9 papéis, os itens visíveis no menu são **os mesmos de hoje** (comparado item a item) quando a tabela de overrides está vazia.
4. Itens universais (`/hoje`, `/configuracoes`) permanecem visíveis a todo autenticado (não somem por módulo). `/permissoes` continua **admin-only** (piso mantido).
5. **Padrão "esconder menu" (P6):** módulo com `access='none'` **não renderiza** o grupo (some do menu), replicando o padrão do Precifica.
6. Novos módulos (Controladoria/Inteligência) aparecem para quem tem `view` no módulo — sem hardcode por papel.

---

## Tasks / Subtasks

- [ ] Reescrever `groups` em `Sidebar.tsx:73-118` no reagrupamento por módulo, adicionando `module: Module` em cada grupo (AC: 1).
- [ ] Trocar `visibleGroups` (`Sidebar.tsx:221-233`) para filtrar por `permissaoEfetiva(role, overrides, g.module, 'view')` via `useMyModulePerms()`; manter `canSeeRoute` como refinamento por item e o piso `role==='admin'` para `/permissoes` (AC: 2,4,5).
- [ ] Preservar o comportamento "enquanto `role===null` mostra tudo" (evita piscar) — só filtrar após carregar papel+overrides (AC: 3).
- [ ] Garantir `/hoje` e `/configuracoes` sempre visíveis a autenticado (AC: 4).
- [ ] **Testes** (AC: 3) — para os 9 papéis, snapshot dos itens visíveis antes×depois (sem override) idêntico; caso de override `financeiro='none'` some o grupo Financeiro. `npx tsc --noEmit` + `npm run lint` verdes.

---

## Dev Notes

**Estratégia de fallback:** o mapa `ROLE_MODULE_ACCESS` (R3-01) foi calibrado a partir de `ROLE_NAV`; portanto, filtrar grupos por `permissaoEfetiva(...,module,'view')` sem override reproduz o conjunto de rotas que `canSeeRoute` liberava. Manter `canSeeRoute` por item cobre casos em que um mesmo módulo tem rotas que alguns papéis veem e outros não (ex.: `comercial` — o `financeiro` vê `/clientes` mas não `/comercial/leads`). **Regra prática:** grupo filtrado por módulo (grosso) + item filtrado por `canSeeRoute` (fino) = superconjunto seguro; validar por papel.

**P7 (design de alto nível, não implementar aqui):** permissão operacional na Controladoria (quais frentes/tipos cada usuário atende) — deixar comentário/ADR de que o grupo Controladoria futuramente filtra também por `system_user_module_perms`/vínculo usuário×frente (cruza com R6). Nesta story, só o grupo por módulo.

**Não fazer:** não alterar as rotas em si nem `ROLE_NAV` (mantido como fallback fino). Não remover grupos Marketing/Sistema.

**Regras de ouro:** aditivo; não quebrar filtro por papel; sem migration.

### Testing
- 9 papéis × menu: itens visíveis idênticos ao atual sem override.
- Override `financeiro='none'` ⇒ grupo Financeiro some; `controladoria='view'` num papel que não via ⇒ grupo aparece.
- `/permissoes` só admin; `/hoje` sempre visível.
- `npm run typecheck` / `npm run lint` verdes.

---

## Dependências

- **Depende de:** R3-01 (`permissaoEfetiva`, `useMyModulePerms`, `MODULES`). Idealmente após R3-02 (hook `useCan`) para reuso, mas não obrigatório.
- **Habilita:** R3-06 (a tela de gestão altera overrides e o efeito é visível no Sidebar).

---

## Cruzamentos

- **E3 (reorg de módulos):** esta story é o coração de E3 no menu.
- **R6/P7:** Controladoria por frente/tipo — desenho de alto nível referenciado aqui, implementação em R6.
- **R4:** grupo Financeiro visível só a quem tem `financeiro:view` (P3).

---

## File List

- `sistema-hv/src/components/hv/Sidebar.tsx` (reagrupamento + filtro por módulo)
- `sistema-hv/src/hooks/usePermissions.ts` (consumo de `useMyModulePerms`, se ainda não criado em R3-02)

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-18 | 0.1 | Draft inicial (fatiado de E3 + B3) | @sm |
