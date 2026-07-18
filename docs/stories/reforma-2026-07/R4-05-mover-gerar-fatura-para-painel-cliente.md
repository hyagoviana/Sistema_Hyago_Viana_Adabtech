# Story R4-05: Mover "Gerar fatura / Conta Azul" para dentro do painel financeiro do CLIENTE

- **Épico:** R4 — Desacoplar Financeiro (bloco B4 + E5)
- **ID:** R4-05
- **Status:** Draft
- **Estimativa relativa:** M (reposicionar criação de cobrança + gate de edição, sem quebrar fluxo por caso)
- **Executor sugerido:** @dev · Quality gate: @architect
- **Prioridade no épico:** 5 (reposiciona UI — depende dos gates R4-01/02/03 e do painel R4-04)

---

## Story

**Como** administrador/financeiro,
**quero** que a ação "Gerar fatura / Nova cobrança (Conta Azul/Asaas)" fique **dentro do painel financeiro do cliente** (área só admin/financeiro), e saia do painel geral onde o estagiário/operacional enxerga,
**para que** quem não é financeiro não veja nem acione a geração de cobrança.

---

## Contexto / o que JÁ EXISTE vs NOVO

- **JÁ EXISTE (onde a ação mora hoje):** a criação de cobrança é o dialog "Nova cobrança" dentro de `AsaasCobrancasPanel` (`src/components/cases/AsaasCobrancasPanel.tsx:155` botão "Nova cobrança"; `:316` `useCreateContaAzulCharge`; `:397` `DialogTitle "Nova cobrança"`; `:527` "Gerar cobrança"). Cobre **Conta Azul e Asaas** (seletor de provider em `:418`).
- **JÁ EXISTE (onde é renderizado):** `AsaasCobrancasPanel` é montado na **ficha do CASO** (`casos.$id.tsx:382`) — hoje **sem gate** (R4-02 passa a gate-á-lo). É o "painel geral" onde alguém com acesso ao caso (ex.: operacional/estagiário) pode ver/gerar cobrança.
- **JÁ EXISTE (painel do cliente):** `ClientFinanceiroSection` (`clientes.$id.tsx:265`) agrega parcelas de todos os casos (R4-04) mas **não tem** ação de gerar cobrança.
- **NOVO:** disponibilizar a criação de cobrança **no painel financeiro do cliente** (dentro do gate de R4-01), permitindo escolher o caso-alvo (a cobrança é por caso — `createChargeSchema` exige `caseId`). Retirar/gate-ar a ação no "painel geral" para não-financeiro.

> **DECISÃO (epic R4):** "Mover 'Gerar fatura / Conta Azul' para dentro do painel financeiro do cliente (sair do painel geral onde o estagiário vê)."

---

## DEPENDÊNCIA CRÍTICA — R3 (`permissaoEfetiva`)

- A ação de **gerar cobrança** é escrita ($) → gate `permissaoEfetiva(user, 'financeiro', 'edit')` no alvo.
- **Ponte até R3-01:** `can(role, 'financeiro.manage')` no front + `requireRole(FINANCEIRO_ROLES)` no RPC (`createChargeFn`/`createContaAzulChargeFn`, reforçados em **R4-03**). Marcar `// TODO(R4/R3): permissaoEfetiva(...,'financeiro','edit')`.
- **Ordem:** este story assume que **R4-02** já gate-ou o `AsaasCobrancasPanel` na ficha do caso e **R4-03** já barrou os RPCs — aqui é reposicionamento/UX + garantir que a ação viva no lugar certo.

---

## Acceptance Criteria

1. No painel financeiro **do cliente** (`ClientFinanceiroSection`, área com gate), existe a ação "Nova cobrança / Gerar fatura" que permite escolher o **caso** do cliente e criar a cobrança (Conta Azul/Asaas) — reusando o fluxo atual.
2. A ação **não** aparece para papéis sem `financeiro:view/edit` (herda o gate de R4-01).
3. No "painel geral" onde não-financeiro transita (ficha do caso para operacional), **não** há botão de gerar cobrança (coberto por R4-02, que oculta o `AsaasCobrancasPanel` inteiro para não-financeiro). Confirmar que não sobrou nenhum ponto de "Nova cobrança" fora do gate.
4. O fluxo de cobrança por caso segue funcional para admin/financeiro na ficha do caso (não remover a capacidade; só garantir que também exista no painel do cliente e que esteja gate-ada).
5. RPCs `createChargeFn`/`createContaAzulChargeFn` exigem papel financeiro (R4-03) — nenhuma criação por não-financeiro mesmo via chamada direta.

---

## Tasks / Subtasks

- [ ] **Expor "Nova cobrança" no painel do cliente** (AC: 1) — dentro de `ClientFinanceiroSection` (área com gate), adicionar entrada que abre o dialog de criação. Reusar o dialog existente do `AsaasCobrancasPanel` (extrair para componente compartilhado `NovaCobrancaDialog` que recebe `caseId` + `clientId`), OU renderizar o painel de cobrança do caso escolhido.
  - [ ] Seletor de **caso** do cliente (a cobrança é por `caseId` — `createChargeSchema`/`createContaAzulChargeSchema`). Listar os casos do cliente.
- [ ] **Reaproveitar, não duplicar** — extrair o dialog "Nova cobrança" (`AsaasCobrancasPanel.tsx:397-527`) para componente reutilizável usado pela ficha do caso E pelo painel do cliente. Evitar dois códigos de cobrança divergentes.
- [ ] **Garantir remoção do painel geral p/ não-financeiro** (AC: 3) — confirmar que, após R4-02, `AsaasCobrancasPanel` (com o botão) não renderiza para não-financeiro na ficha do caso. Buscar outros pontos de "Nova cobrança"/"gerar fatura" fora de gate (`casos.financeiro.*`).
- [ ] **Gate da ação no cliente** (AC: 2) — herda `podeVerFinanceiro` de R4-01; a ação só existe dentro do bloco gate-ado.
- [ ] **Testes** (AC: 1-5) — admin cria cobrança pelo painel do cliente escolhendo caso; operacional não vê o botão em lugar nenhum; RPC 403 para não-financeiro; `npx tsc --noEmit` / `npm run lint` verdes.

---

## Dev Notes

**Telas/arquivos:**
- `sistema-hv/src/components/cases/AsaasCobrancasPanel.tsx:155,397-527` — origem do dialog "Nova cobrança" (extrair reutilizável).
- `sistema-hv/src/components/clients/ClientFinanceiroSection.tsx` — destino da ação (dentro do gate).
- `sistema-hv/src/routes/clientes.$id.tsx` — hospeda o painel do cliente.
- `sistema-hv/src/routes/casos.$id.tsx:382` — mantém cobrança por caso para financeiro (gate de R4-02).
- RPCs de criação já gate-ados em R4-03: `rpc/asaas.ts` (`createChargeFn`), `rpc/contaazul.ts` (`createContaAzulChargeFn`).

**Riscos de regressão / vazamento de $:**
- **Ação órfã fora do gate:** ao mover, não deixar um botão "Nova cobrança" visível a não-financeiro em nenhuma rota (`casos.financeiro.cobrancas`, `casos.financeiro.index`). Varrer por "Nova cobrança"/"Gerar cobrança"/"fatura".
- **Duplicação divergente:** copiar o dialog em vez de extrair leva a dois fluxos de cobrança que desincronizam — extrair componente único.
- **Caso-alvo errado:** a cobrança precisa do `caseId` certo; validar seleção do caso do cliente (não permitir caso de outro cliente).
- Não alterar `financeiro-service`/providers; só reposicionar UI + reuso. Não tocar `macrostatus_fin`/dual-write.

### Testing
- Admin: painel do cliente → "Nova cobrança" → escolhe caso → cria (Conta Azul/Asaas) OK.
- Operacional: nenhum botão de cobrança na ficha do cliente nem do caso; RPC de criação → 403.
- Financeiro na ficha do caso: cobrança por caso segue funcionando.
- `npm run typecheck` / `npm run lint` verdes.

---

## Dependências

- **Depende de:** **R4-01** (gate do painel do cliente — hospeda a ação), **R4-02** (oculta o painel geral de cobrança para não-financeiro), **R4-03** (RPCs de criação gate-ados), **R4-04** (painel do cliente consolidado). **R3-01** para o gate final (`edit`).
- **Habilita:** encerra o desacoplamento financeiro (E5/B4): $ só admin/financeiro, cobrança só no painel do cliente.

---

## File List

- `sistema-hv/src/components/cases/AsaasCobrancasPanel.tsx` (extrair `NovaCobrancaDialog` reutilizável)
- `sistema-hv/src/components/clients/ClientFinanceiroSection.tsx` (ação "Nova cobrança" + seletor de caso, dentro do gate)
- `sistema-hv/src/routes/clientes.$id.tsx` (hospeda)
- (varrer) `sistema-hv/src/routes/casos.financeiro.cobrancas.tsx` / `casos.financeiro.index.tsx` (nenhum botão de cobrança fora de gate)

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-18 | 0.1 | Draft inicial do épico R4 (B4/E5) — mover gerar-fatura p/ painel do cliente | @sm |
