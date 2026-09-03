# Story S4-03: Limpeza da aba Financeiro do caso

- **Sprint:** S4 — Caso
- **ID:** S4-03 · **Item do Thiago:** 10
- **Status:** Ready for Review
- **Estimativa relativa:** P
- **Executor sugerido:** @dev · Quality gate: @qa

---

## Story

**Como** quem usa a aba Financeiro do caso,
**quero** que ela mostre só o que está em uso,
**para que** o espaço não seja ocupado por painéis de ideias que ficaram para trás.

---

## Contexto

Anotações do Thiago no desenho 27:
- *"Esse painel é de uma ideia anterior de hyago, por hora vamos manter aqui para evitar retrabalho."*
  → **fica** (Termo de acerto / conferência).
- *"Esse painel era de uma ideia anterior sobre gerar cobrança no CA/ASAAS. Substituímos pelos paineis
  logo abaixo, vamos remover esse painel e reutilizar o espaço."* → **sai** (o bloco COBRANÇAS com
  "Sync Conta Azul / Sync Asaas / Nova cobrança", que hoje aparece vazio com "Nenhuma cobrança gerada
  ainda").

Atenção ao escopo: a **integração** Conta Azul/Asaas está fora desta leva. Esta story é só **remoção de
UI morta** — o backend fica intacto para quando a integração for retomada.

---

## Acceptance Criteria

1. O painel **COBRANÇAS** (com os botões Sync Conta Azul / Sync Asaas / Nova cobrança) sai da aba
   Financeiro do caso.
2. O espaço é reaproveitado pelos painéis que ficam (Valores do caso e, pela S4-02, o rastro financeiro).
3. **Backend intacto**: `NovaCobrancaDialog`, `AsaasCobrancasPanel`, RPCs e serviços de Conta Azul/Asaas
   continuam no repositório, apenas não referenciados por esta tela. Nada de apagar integração.
4. O botão **"Sincronizar ContaAzul/Asaas"** do cabeçalho permanece (é operação, não o painel morto) —
   salvo se o owner pedir o contrário na validação.
5. Nenhum caso com cobrança já criada perde a visualização dela: se houver cobrança registrada, ela
   aparece na lista de **Valores do caso**, como já acontece.
6. `npx tsc --noEmit` e `npm run lint` sem erro novo (sem imports órfãos).

---

## Tasks / Subtasks

- [x] Remover o bloco da tela (AC 1, 2). (`src/routes/casos.$id.financeiro.tsx`)
- [x] Conferir que nenhum caso com cobrança perde informação (AC 5) — 2 parcelas com `provider_ext_id`
      em 1 caso; ambas continuam listadas pelo `TermoPanel`, que fica logo acima na mesma página.
- [x] Limpar imports sem apagar componentes (AC 3, 6).

---

## Dev Notes

- Antes de remover, checar em produção se existe caso com cobrança criada por esse painel — se existir,
  garantir que os valores continuam listados.

## Definition of Done

- [ ] Aba Financeiro sem painel morto
- [ ] Integração preservada no código para retomada futura

---

## Dev Agent Record (03/09/2026)

**Implementado.** O bloco `AsaasCobrancasPanel` saiu de `casos.$id.financeiro.tsx`; o import foi removido.
O componente e todo o backend de Conta Azul/Asaas seguem intactos no repositório.

**Conferência de dado (AC 5):** consulta ao banco encontrou 2 parcelas com `provider_ext_id` em 1 caso.
As duas continuam visíveis no `TermoPanel` (mesma página, acima) — nada ficou escondido.

**Mantido:** o botão "Sincronizar ContaAzul/Asaas" do cabeçalho, conforme AC 4.

**Validação:** `npx tsc --noEmit` e `eslint` verdes.

---

## QA Results — 03/09/2026 (Quinn)

**Gate: PASS**

- AC 1-3 verificados: o painel saiu da tela, o import foi removido e `AsaasCobrancasPanel` + todo o backend
  de Conta Azul/Asaas continuam intactos no repositório.
- AC 5 (o que mais importava aqui) **verificado contra o banco**: existem 2 parcelas com `provider_ext_id`
  em 1 caso; as duas continuam listadas pelo `TermoPanel`, na mesma página, acima. Nenhuma informação
  ficou inacessível.
- AC 4: o botão "Sincronizar ContaAzul/Asaas" do cabeçalho foi mantido, como previsto.
