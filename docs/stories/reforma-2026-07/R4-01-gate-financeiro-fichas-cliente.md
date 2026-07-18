# Story R4-01: Gate de $ nas telas do CLIENTE (`ClientFinanceiroSection`)

- **Épico:** R4 — Desacoplar Financeiro (bloco B4 + E5)
- **ID:** R4-01
- **Status:** Ready for Review
- **Estimativa relativa:** S (gate de render + esconder totais na ficha do cliente)
- **Executor sugerido:** @dev · Quality gate: @architect
- **Prioridade no épico:** 1 (primeiro gate — isola o vazamento mais óbvio: painel financeiro do cliente)

---

## Story

**Como** administrador/financeiro,
**quero** que a seção "Financeiro do cliente" (valores $, total cobrado/recebido/a receber, parcelas) só apareça para quem tem permissão financeira,
**para que** estagiários/operacional/áreas não vejam quanto o cliente pagou/deve (só, no máximo, um selo "devendo / em dia").

---

## Contexto / o que JÁ EXISTE vs NOVO

- **JÁ EXISTE (o vazamento):** `ClientFinanceiroSection` é renderizado **SEM gate** em `clientes.$id.tsx:265` (`<ClientFinanceiroSection clientId={cliente.id} />`). Qualquer usuário autenticado que abra a ficha do cliente vê todos os valores $ (doc-mestre §3.6:89, §5.3:164).
- **JÁ EXISTE (fonte do papel no front):** `useAuth()` (`src/lib/auth.tsx:106`) devolve `{ role }` a partir de `system_users_active`. `can(role, cap)` em `src/lib/rbac.ts:86`.
- **JÁ EXISTE (padrão de gate no front):** `casos.$id.tsx:99-100` já faz `const { role } = useAuth(); const podeFinanceiro = can(role, "financeiro.manage");` — **replicar esse padrão**.
- **JÁ EXISTE (dados agregados):** `ClientFinanceiroSection` usa `useAllParcelas({ clientId })` (`ClientFinanceiroSection.tsx:27`) que já agrega os casos do cliente. **NÃO mexer na agregação aqui** (o espelhamento é R4-04).
- **NOVO:** gate de render envolvendo `ClientFinanceiroSection` + estado alternativo "devendo / em dia" (selo simples sem valores) para quem NÃO tem `financeiro:view`.

> **DECISÃO TRAVADA (doc-mestre §4.4):** "dados de valor ($) exigem `financeiro:view` no mínimo (Operacional/Jurídico não veem $)". Para áreas que não têm o gate, mostrar **apenas** "devendo / em dia" — nunca o valor.

---

## DEPENDÊNCIA CRÍTICA — R3 (`permissaoEfetiva`)

- Este gate **deve** usar `permissaoEfetiva(user, 'financeiro', 'view')` da infra do épico **R3 (story R3-01)**.
- **Enquanto R3-01 não existir**, usar a **ponte** `can(role, 'financeiro.manage')` (já disponível em `rbac.ts:86`). Deixar um `// TODO(R4/R3): trocar por permissaoEfetiva(user,'financeiro','view')` no ponto do gate.
- **Habilita a troca:** quando R3-01 entregar `permissaoEfetiva`, substituir o `can(...)` por ela num único ponto (o valor booleano `podeVerFinanceiro`), sem mudar a UI.

---

## Acceptance Criteria

1. Usuário **com** `financeiro:view` (ponte: `financeiro.manage`) — admin, advogado_titular, financeiro — vê a `ClientFinanceiroSection` completa (valores, resumo, tabela) exatamente como hoje.
2. **[C9] O gate (esconder valores) é OBRIGATÓRIO; o selo é OPCIONAL não-bloqueante nesta story.** Usuário **sem** o gate (ex.: operacional, comercial, advogado_associado, prestador_externo, marketing) **NÃO** vê **nenhum** valor $ na ficha do cliente — este é o critério **mandatório e bloqueante** de R4-01. O selo "Em dia"/"Devendo" é **desejável mas opcional aqui**: pode aparecer como "—" no MVP se o sinal binário ainda não estiver pronto, **desde que NENHUM valor apareça**. O sinal binário mandatório é entregue por **R4-04** (AC-3 de lá); R4-01 apenas consome-o quando existir. Sem ambiguidade: a story não é bloqueada pela ausência do selo, só pela presença de qualquer valor.
3. A decisão do gate é um **único booleano** (`podeVerFinanceiro`) trocável por `permissaoEfetiva` quando R3 existir, sem refatorar a UI.
4. Nenhuma requisição de $ vaza no cliente sem gate: se `podeVerFinanceiro` for falso, o componente **não** dispara `useAllParcelas` com dados (ou o hook não expõe valores) — o gate do RPC (R4-03) é a defesa final.

---

## Tasks / Subtasks

- [x] **Gate no render** (AC: 1,2) — em `clientes.$id.tsx`, computar `const { role } = useAuth();` + `const { data: perms } = useMyModulePerms();` + `const podeVerFinanceiro = permissaoEfetiva(role, perms ?? {}, "financeiro", "view");`. **Desvio positivo:** R3-01 já está pronto e aplicado no banco, então usei `permissaoEfetiva` DIRETO (não a ponte `can`). Com a tabela de overrides vazia isso é idêntico ao papel (regressão zero) — comentário explicativo deixado no código.
  - [x] Se `podeVerFinanceiro` → renderiza `<ClientFinanceiroSection clientId={cliente.id} />` (como hoje).
  - [x] Senão → renderiza bloco inline "Situação financeira" com selo `—` SEM valores.
- [x] **Selo devendo/em dia** (AC: 2, opcional) — MVP: selo textual `—` (o sinal binário mandatório vem de R4-04). Nenhum valor $ é buscado nem exibido no caminho sem gate.
- [x] **Não disparar fetch de $ sem gate** (AC: 4) — `ClientFinanceiroSection` (que chama `useAllParcelas`) NÃO é montado quando `podeVerFinanceiro` for falso (short-circuit no render).
- [x] **Testes** (AC: 1-4) — `npm run typecheck` (0 erros novos; 22 pré-existentes de R3-01/types fora de sync, não relacionados), `npm run lint` no arquivo alterado (verde), `npm run test:rbac` (todos passam).

---

## Dev Notes

**Telas/arquivos a receber gate:**
- `sistema-hv/src/routes/clientes.$id.tsx:265` — envolver `ClientFinanceiroSection` com `podeVerFinanceiro`.
- `sistema-hv/src/components/clients/ClientFinanceiroSection.tsx` — opcionalmente aceitar prop `mode: "full" | "badge"` para reusar; ou manter só o caminho "full" e criar o selo fora.

**Padrão a reusar (não inventar):**
- `useAuth()` + `can(role, "financeiro.manage")` — idêntico a `casos.$id.tsx:99-100`.

**Riscos de regressão / vazamento de $:**
- **Vazamento:** deixar `useAllParcelas` montado sem gate faz o cliente buscar valores mesmo sem exibir — o request pode ser inspecionado. Mitigar não montando o hook + gate no RPC (R4-03).
- **Falso "em dia":** se o selo derivar de valores agregados sem checar todos os casos, pode enganar. Preferir sinal binário simples; se indisponível, exibir "—" (nunca $).
- Não alterar a lógica de agregação por caso aqui (é R4-04).

### Testing
- Logar como `operacional` → ficha do cliente: nenhum "R$", nenhuma tabela de parcelas; no máximo selo textual.
- Logar como `admin`/`financeiro` → seção completa igual a hoje.
- `npm run typecheck` / `npm run lint` verdes.

---

## Dependências

- **Depende de:** **R3-01** (`permissaoEfetiva`) — usa a ponte `can(role,'financeiro.manage')` até R3 existir. **R4-03** (gate no RPC `listAllParcelas`) como defesa final do fetch.
- **Habilita:** R4-04 (espelhamento — o painel completo que este gate protege) e R4-05 (mover gerar-fatura para dentro do painel do cliente).

---

## File List

- `sistema-hv/src/routes/clientes.$id.tsx` (MODIFICADO) — gate `podeVerFinanceiro` via `permissaoEfetiva`; imports de `useAuth`, `useMyModulePerms`, `permissaoEfetiva`, `Badge`; render condicional do `ClientFinanceiroSection` vs. bloco "Situação financeira" com selo `—`.

_Não foi necessário tocar em `ClientFinanceiroSection.tsx`: o gate fica no ponto de montagem (route), então o componente que busca $ nem é montado sem permissão — mais simples e sem prop `mode`._

## Dev Agent Record

### Agent Model Used
Opus 4.8 (1M) — @dev (James)

### Debug Log / Decisões
- **Desvio da story (positivo):** a story assumia a ponte `can(role, 'financeiro.manage')` enquanto R3-01 não existisse. R3-01 **já está implementado e aplicado no banco** (`permissaoEfetiva` em `rbac.ts`, `useMyModulePerms` em `usePermissions.ts`, migration `20260718000001_user_module_perms`). Por isso usei `permissaoEfetiva(role, perms ?? {}, "financeiro", "view")` DIRETO — cumpre AC-3 (único booleano) sem TODO pendente. Com a tabela de overrides vazia o resultado é idêntico ao papel (regressão zero); deixei comentário no código explicando.
- **AC-4 (sem vazamento de fetch):** o gate é short-circuit no JSX da route — quando `podeVerFinanceiro` é falso, `<ClientFinanceiroSection>` não é montado, logo `useAllParcelas({clientId})` nunca dispara. Nenhum request de $ sai.
- **AC-2 (mandatório):** caminho sem permissão renderiza só um cabeçalho "Financeiro do cliente" + bloco "Situação financeira" com `Badge` `—`. Zero `R$`, zero tabela de parcelas.
- **Selo (opcional):** deixado como `—` no MVP; o sinal binário Em dia/Devendo vem de R4-04.
- **Line endings:** o ambiente (OneDrive/Windows) reconverteu o arquivo para CRLF ao editar, gerando ~392 erros `prettier/prettier` (Delete `␍`). Rodei `npx prettier --write` no arquivo p/ voltar a LF; diff final = 29 inserções / 1 deleção (só as mudanças lógicas), eslint exit 0.

### Validação
- `npm run typecheck`: **0 erros novos** introduzidos por esta story. Existem 22 erros **pré-existentes** (confirmado revertendo só este arquivo: mesma contagem 22) vindos do estado atual de R3-01 (`src/lib/supabase/types.ts` fora de sync p/ `system_case_checklist_item_assignees`/`system_user_module_perms`, + `dossie-service.ts`, `visibility.ts`, `termo-service.ts`, `casos.$id.tsx`, `casos.financeiro.index.tsx`) — nenhum toca `clientes.$id.tsx`.
- `npx eslint src/routes/clientes.$id.tsx`: **verde** (exit 0).
- `npm run test:rbac`: **todos passam** (inclui os casos de `permissaoEfetiva` financeiro/view por override e por papel).

### Restrições respeitadas
- Só front, sem migration. Sem commit/push. Não toquei na agregação de parcelas (`useAllParcelas` / R4-04). Nada existente removido.

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-18 | 0.1 | Draft inicial do épico R4 (B4/E5) — gate na ficha do cliente | @sm |
| 2026-07-18 | 0.2 | C9 (QA): AC frouxo resolvido — AC-2 explicita que o **gate (esconder valores) é obrigatório/bloqueante** e o **selo "Em dia"/"Devendo" é opcional não-bloqueante** nesta story (pode ficar "—" no MVP, desde que nenhum valor apareça). O sinal binário mandatório fica em R4-04. | @sm |
| 2026-07-18 | 0.3 | Implementado. Gate `podeVerFinanceiro` na route `clientes.$id.tsx` usando `permissaoEfetiva` DIRETO (R3-01 já pronto/aplicado — não usou a ponte `can`; regressão zero com overrides vazios). `ClientFinanceiroSection` não é montado sem permissão (AC-4). Caminho sem gate mostra só selo `—`, zero valores (AC-2). typecheck sem erros novos, eslint verde, test:rbac passa. | @dev |
| 2026-07-18 | 0.4 | Régua base do módulo `financeiro` restrita a `admin`+`financeiro` por decisão do dono; advogados (titular/associado) e demais papéis = `none` por padrão, só veem $ via override por usuário (`permissaoEfetiva`). Ajuste em `src/lib/rbac.ts` (override pós-derivação sobrescreve SÓ o módulo financeiro; demais espelham o NAV). Com isso o gate desta story passa a esconder $ de advogados automaticamente — `permissaoEfetiva('advogado_associado', {}, 'financeiro', 'view') === false`. Gate não mudou; só a régua base. `test:rbac` verde com casos novos. | @dev |
