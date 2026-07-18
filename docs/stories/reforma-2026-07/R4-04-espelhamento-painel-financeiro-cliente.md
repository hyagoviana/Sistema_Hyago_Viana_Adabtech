# Story R4-04: Espelhamento — painel financeiro do cliente agrega TODOS os casos (N4)

- **Épico:** R4 — Desacoplar Financeiro (bloco B4 + E5)
- **ID:** R4-04
- **Status:** Draft
- **Estimativa relativa:** M (consolidar/validar agregação por cliente + selo devendo/em dia + valor MIX/PLA)
- **Executor sugerido:** @dev · Quality gate: @architect
- **Prioridade no épico:** 4 (o painel "só admin/financeiro" que agrega tudo — depende dos gates R4-01/03)

---

## Story

**Como** administrador/financeiro,
**quero** que o painel financeiro **do cliente** agregue TODAS as parcelas de TODOS os casos dele (não só de um caso), mostrando valores por caso e o total consolidado,
**para que** eu veja num só lugar quanto o cliente cobrou/pagou/deve em toda a carteira; e que para áreas sem permissão isso vire só "devendo / em dia".

---

## Contexto / o que JÁ EXISTE vs NOVO

- **JÁ EXISTE (o espelhamento base):** `listAllParcelas({ clientId })` (`src/lib/financeiro-service.ts:57`) já busca **todas** as parcelas, resolve `case_code`/`client_id`/`client_name` (linhas 80-107) e **filtra por cliente** (`financeiro-service.ts:112-113` — `result.filter(p => p.client_id === filters.clientId)`), agregando parcelas de todos os casos daquele cliente.
- **JÁ EXISTE (a UI que consome):** `ClientFinanceiroSection` (`ClientFinanceiroSection.tsx:27` — `useAllParcelas({ clientId })`) já soma `totalValor`/`totalPago`/`totalPendente` (linhas 30-37) e lista as parcelas com link para cada caso (linhas 94-136). **O espelhamento por cliente, na prática, já funciona** — este story **valida, robustece e nomeia** (N4), não reconstrói.
- **A CONFIRMAR (MIX/PLA):** o doc pede "valor MIX/PLA". Não há coluna óbvia `mix`/`pla` no select de parcelas — investigar de onde vem essa classificação (provável distinção de **plano de pagamento** vs **valor misto** de honorários no `system_termo_snapshots`/`system_case_honorarios`). Se não existir, exibir como **enriquecimento opcional** (não bloquear N4) e registrar a pendência.
- **NOVO:** selo binário "devendo / em dia" derivado da agregação (para o caminho SEM gate de R4-01), e — se aplicável — a coluna/rótulo MIX/PLA.

> **DECISÃO (doc-mestre §3.6:89):** `ClientFinanceiroSection` "agrega todos os casos" — este story torna isso explícito, testado e com sinal binário para áreas.

---

## ⚠️ PENDÊNCIA FORMAL DO OWNER (C7) — classificação MIX/PLA

- O doc-mestre pede "valor **MIX/PLA**" no painel, mas **não há coluna óbvia** `mix`/`pla` no select de parcelas nem fonte clara na modelagem atual (provável origem: distinção de **plano de pagamento** vs **valor misto** de honorários em `system_termo_snapshots` / `system_case_honorarios` — a confirmar).
- **Bloco de pendência (a resolver com o owner):**
  1. O que exatamente significa "MIX/PLA" (rótulo de plano de pagamento? valor misto de honorários? outra classificação)?
  2. De qual campo/tabela a classificação deve ser derivada?
  3. Ela é **obrigatória** para aceitar N4 ou é **enriquecimento opcional**?
- **Resolução default registrada:** enquanto a pendência não for respondida, **N4 pode ser aceito SEM a classificação MIX/PLA** (enriquecimento opcional, não-bloqueante), com esta pendência registrada explicitamente. Ver AC-4.

## DEPENDÊNCIA CRÍTICA — R3 (`permissaoEfetiva`)

- O painel completo (com valores) é protegido por **R4-01** (gate `permissaoEfetiva('financeiro','view')`; ponte `can(role,'financeiro.manage')`). Este story entrega o **conteúdo** que só admin/financeiro vê.
- O **selo "devendo/em dia"** (sem valores) é o que sobra para papéis sem o gate — deve ser derivável **sem** expor centavos.

---

## Acceptance Criteria

1. Abrindo a ficha de um cliente com **múltiplos casos**, o painel (para admin/financeiro) mostra parcelas de **todos** os casos, com total cobrado/recebido/a receber consolidado e link por caso. (Confirmar o comportamento já existente com teste multi-caso.)
2. A agregação NÃO vaza parcelas de outro cliente (filtro por `client_id` correto).
3. **[C9] Selo binário OBRIGATÓRIO:** para papéis **sem** `financeiro:view`, o painel exibe um sinal **binário e mandatório** — exatamente um de **"Em dia"** ou **"Devendo"** — derivado da carteira do cliente (ex.: alguma parcela `VENCIDA`/`INADIMPLENTE` → "Devendo"), **sem** exibir valores. Não é opcional: é o estado mínimo que substitui os números para essas áreas (não deixar em branco/"—" no caminho sem gate quando há dados de parcela).
4. **[C7] MIX/PLA — enriquecimento OPCIONAL não-bloqueante:** se a classificação **MIX/PLA** existir na modelagem (ver Pendência Formal do Owner acima), o painel a exibe por caso; se **não** existir/estiver indefinida, a pendência fica registrada e **N4 é aceito sem ela** — a ausência de MIX/PLA **não bloqueia** a story.

---

## Tasks / Subtasks

- [ ] **Validar agregação por cliente** (AC: 1,2) — teste com cliente de ≥2 casos: `listAllParcelas({ clientId })` retorna parcelas dos 2 casos; totais batem; nenhum vazamento cross-cliente. Corrigir se o filtro (`financeiro-service.ts:112`) falhar em edge (client_id nulo → hoje vira `""`, revisar linha 106).
- [ ] **Sinal binário "devendo/em dia"** (AC: 3) — adicionar seletor derivado (no hook/serviço) que devolve `{ emDia: boolean }` a partir de status (`VENCIDA`/`INADIMPLENTE`), SEM centavos, para o caminho sem gate (usado por R4-01/R4-02).
- [ ] **[C7] MIX/PLA (investigar + elicitar owner)** (AC: 4) — localizar a origem de MIX/PLA (termo/honorários) e **levar as 3 perguntas do bloco "Pendência Formal do Owner" ao owner**. Se existir/definido, expor rótulo por caso no painel; senão, manter a pendência registrada e seguir — **N4 aceito sem MIX/PLA** (não-bloqueante).
- [ ] **Robustez** — tratar `client_id === ""` (parcela órfã sem caso) para não somar no cliente errado.
- [ ] **Testes** (AC: 1-4) — cliente multi-caso; isolamento entre clientes; selo binário; `npx tsc --noEmit` / `npm run lint` verdes.

---

## Dev Notes

**Arquivos:**
- `sistema-hv/src/lib/financeiro-service.ts:57-118` (`listAllParcelas` — validar filtro por cliente; edge `client_id` vazio).
- `sistema-hv/src/components/clients/ClientFinanceiroSection.tsx` (já consome; adicionar seletor binário para o caminho sem gate).
- `sistema-hv/src/hooks/useFinanceiro.ts` (`useAllParcelas` — eventual seletor `emDia`).
- (investigar MIX/PLA) `sistema-hv/src/lib/termo-service.ts` + `system_termo_snapshots` / `system_case_honorarios`.

**Riscos de regressão / vazamento de $:**
- **Vazamento entre clientes:** o `client_id` de uma parcela é resolvido via caso (`financeiro-service.ts:102-107`); parcela sem caso vira `client_id=""` e cairia fora do filtro — validar que não some no cliente errado.
- **Selo que vaza valor:** o sinal binário NÃO pode ser calculado no componente exibido a não-financeiro se isso exigir buscar centavos — derivar server-side/hook devolvendo só boolean.
- Não reconstruir o painel nem a pipeline (já unificada). Só validar espelhamento + sinal binário.
- Não tocar `macrostatus_fin`/dual-write.

### Testing
- Cliente com 2 casos e parcelas em ambos → painel soma os dois; totais corretos.
- Cliente A não vê parcelas do cliente B.
- Papel sem gate → "Em dia"/"Devendo", zero "R$".
- `npm run typecheck` / `npm run lint` verdes.

---

## Dependências

- **Depende de:** **R4-01** (gate que protege este painel) e **R4-03** (gate RPC do `listAllParcelasFn`). **R3-01** para o gate final.
- **Habilita:** R4-05 (mover "gerar fatura/Conta Azul" para dentro deste painel do cliente).

---

## File List

- `sistema-hv/src/lib/financeiro-service.ts` (validar/robustecer filtro por cliente + seletor binário)
- `sistema-hv/src/components/clients/ClientFinanceiroSection.tsx` (selo devendo/em dia; MIX/PLA se existir)
- `sistema-hv/src/hooks/useFinanceiro.ts` (seletor `emDia` sem valores)

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-18 | 0.1 | Draft inicial do épico R4 (B4/E5) — espelhamento painel do cliente (N4) | @sm |
| 2026-07-18 | 0.2 | C7 (QA): "valor MIX/PLA" elevado a **pendência formal do owner** (novo bloco com 3 perguntas) — N4 aceito sem ela, enriquecimento opcional não-bloqueante; task MIX/PLA e AC-4 atualizados. C9 (QA): AC frouxo resolvido — selo "Em dia"/"Devendo" cravado como **binário obrigatório** (AC-3) e MIX/PLA como **opcional não-bloqueante** (AC-4), sem ambiguidade. | @sm |
