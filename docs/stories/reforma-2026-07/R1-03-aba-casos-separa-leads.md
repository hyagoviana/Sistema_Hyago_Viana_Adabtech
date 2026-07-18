# Story R1-03: Aba "Casos" do cliente separa casos em LEAD (aguardando assinatura) — N7

- **Sprint/Epic:** Reforma 2026-07 · **R1 — Modelo Pessoa/Lead/Cliente por caso** (bloco B1)
- **ID:** R1-03
- **Status:** Draft
- **Estimativa relativa:** S (agrupamento/seção na lista de casos da ficha; sem migration)
- **Executor sugerido:** @dev (UI) · Quality gate: @qa

---

## Story

**Como** advogado (pedido do Iago),
**quero** que, na ficha da pessoa, os casos ainda em **LEAD** (aguardando assinatura) fiquem **separados** dos casos já efetivados (CLIENTE),
**para que** eu não confunda o que já está fechado com o que ainda depende de assinatura.

---

## Contexto / o que JÁ EXISTE vs NOVO

> **Pedido do Iago (doc-mestre B1 / item N7):** *"casos ainda em 'lead' devem ficar SEPARADOS na aba de casos do cliente, não misturados."*

- **JÁ EXISTE (lista única, sem separação):** `ClientCasesSection` (`src/components/cases/ClientCasesSection.tsx:29-102`) lista **todos** os casos do cliente numa única `<ul>` (`:64-98`), via `useCasesList({ client_id })` (`:30`). Não há agrupamento por lifecycle.
- **JÁ EXISTE (dado de lifecycle no caso):** `system_cases_active` expõe `lifecycle` (`20260702000001_case_lifecycle.sql:88-93`), retornado por `listCases` (`cases-service.ts:1330` faz `.select("*")`). O componente já recebe `c.lifecycle` implicitamente (basta ler).
- **JÁ EXISTE (sinal de "aguardando assinatura"):** `aguardando_assinatura_at` no caso (comercial). Um caso LEAD aguardando assinatura tem lifecycle='LEAD' e/ou esse carimbo.
- **JÁ EXISTE (uso do componente):** `src/routes/clientes.$id.tsx:255-261` renderiza `<ClientCasesSection>`.
- **NOVO:** separar visualmente a lista em duas seções — **"Casos ativos (clientes)"** (`lifecycle='CLIENTE'`) e **"Aguardando assinatura (leads)"** (`lifecycle='LEAD'`), além de eventual **"Perdidos"** recolhido. Sem novas queries (particiona client-side o resultado já carregado).

> **DECISÃO TRAVADA:** separação é **por lifecycle do caso** (LEAD vs CLIENTE), computada no cliente a partir de `c.lifecycle` já presente em `system_cases_active`. Nenhuma migration.

---

## Acceptance Criteria

1. Na ficha do cliente, os casos aparecem em **grupos distintos**: "Aguardando assinatura" (LEAD) e "Casos efetivados" (CLIENTE); casos PERDIDO num grupo próprio (recolhível ou ao final).
2. Um caso em LEAD **nunca** aparece misturado na lista de casos efetivados (e vice-versa).
3. Cada grupo mostra sua contagem; grupo vazio some (ou exibe estado vazio discreto).
4. Ao assinar o contrato de um caso LEAD (promoção a CLIENTE), ele **migra** de grupo após refresh/invalidação da query.
5. Nenhuma query nova ao servidor além da já existente (`useCasesList({ client_id })`); particionamento é client-side.

---

## Tasks / Subtasks

- [ ] **Particionar por lifecycle** (AC:1,2,5) — em `ClientCasesSection`, dividir `cases` em `leads`/`clientes`/`perdidos` por `c.lifecycle` (`useMemo`).
- [ ] **Renderizar grupos** (AC:1,3) — cabeçalhos de seção com contagem; reusar o `card-editorial` de cada item (não reescrever o card). Grupo vazio oculto.
- [ ] **Ordenação** — dentro de cada grupo, manter a ordem atual (mais recente primeiro).
- [ ] **Estado vazio** (AC:3) — se o cliente não tem nenhum caso, manter a mensagem atual ("Novo caso").
- [ ] **Invalidação** (AC:4) — confirmar que a promoção a CLIENTE invalida `queryKeys.cases.list({ client_id })` (já ocorre nos mutations existentes; só validar).
- [ ] **Testes** (AC:1-5) — ver Testing; `npx tsc --noEmit` / `npm run lint` verdes.

---

## Dev Notes

**Arquivos a tocar:**
- `sistema-hv/src/components/cases/ClientCasesSection.tsx` (particionar + seções).
- (Sem migration; sem serviço novo.)

**Regras de ouro (pertinentes):**
- Ler `lifecycle` de `system_cases_active` (já exposto) — **não** adicionar coluna nem tocar a view.
- Não introduzir status na pessoa (a separação é do CASO).

**Riscos de regressão:**
- Se `c.lifecycle` vier `undefined` para casos muito antigos, tratar como LEAD (default da coluna) para não sumir card.
- Manter o `Link to="/casos/$id"` e o layout do card intactos (só envolvê-los em seções) para não quebrar navegação.

### Testing
- Cliente com 2 casos LEAD + 1 CLIENTE → 2 grupos, contagens 2 e 1.
- Promover o CLIENTE não some da ficha; grupos corretos.
- Cliente só com casos CLIENTE → grupo "Aguardando assinatura" oculto.
- `npm run typecheck` / `npm run lint` verdes.

---

## Dependências

- **Depende de:** R1-01 (lifecycle validado) e, idealmente, R1-02 (dados saneados, para os grupos não mostrarem incoerência).
- **Habilita:** R1-04 (a ramificação por TEMA se apoia nesta mesma lista particionada).
- **Cruzamento com R2 (TEMA):** **parcial.** Esta story separa por LEAD/CLIENTE. A separação/agrupamento por **TEMA** é R1-04 e só ativa quando R2 existir. R1-03 deve deixar o particionamento por lifecycle **composável** com o agrupamento por tema (ex.: função de partição reutilizável), sem depender de R2.

## File List

- `sistema-hv/src/components/cases/ClientCasesSection.tsx` (seções por lifecycle)

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-18 | 0.1 | Draft inicial (N7 / B1) | @sm |
