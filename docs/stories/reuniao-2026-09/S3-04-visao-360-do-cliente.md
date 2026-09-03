# Story S3-04: Visão 360 do cliente — casos com valor, etapa e rastros

- **Sprint:** S3 — Cliente
- **ID:** S3-04 · **Item do Thiago:** 7
- **Status:** Draft
- **Estimativa relativa:** G
- **Executor sugerido:** @dev · Quality gate: @qa + @ux-design-expert

---

## Story

**Como** advogado atendendo um cliente,
**quero** enxergar, na ficha dele, **tudo o que importa da vida dele com o escritório** — casos, etapa de
cada um, quanto tem a receber e a pagar, rastro comercial —,
**para que** eu não precise entrar caso a caso para montar essa foto na cabeça.

---

## Contexto

Anotações do Thiago nos desenhos 33-35:
- *"Vamos unificar a visualização de 'valores do cliente' junto aos casos de cada valor. Também vamos
  unificar a visualização da etapa principal de cada caso."*
- Nos rascunhos, por caso: **espelhamento etapa operacional (kanban principal)**, **espelhamento etapa
  financeiro (rastro financeiro)**, **Receitas do caso** (Registradas · Lançado · Devido · Vencido · Pago ·
  A vencer) e **Despesas do caso** com a mesma régua, mais o **rastro comercial**.
- *"A ideia não é ter todo o detalhamento, isso temos na página financeiro do próprio caso. Aqui é um
  visual geral integral de tudo que é do cliente como um todo. Dessa página, tenho uma visão 360% das
  principais informações gerais de toda a vida do cliente."*

Ordem da página que ele desenhou: **Dados de contato + dados do cliente/campos personalizados**
(+ botão da pasta no Drive) → **Casos do cliente + Financeiro do cliente** → **Notas** →
**Documentos do cliente**.

---

## Acceptance Criteria

1. A seção **Casos do cliente** passa a mostrar, em cada card: nome/código do caso, **etapa operacional
   atual** (kanban principal) e **etapa financeira atual** — as duas espelhadas do caso, sem duplicar dado.
2. Cada card traz o **resumo financeiro do caso**: receitas e despesas com Devido · Vencido · Pago ·
   A vencer, reusando a agregação que a aba Financeiro do caso já usa
   (`financeiro-caso-service.ts` / `financeiro-aggregation`). **Sem recalcular regra nova.**
3. O bloco separado de "valores do cliente" **deixa de existir** como ilha: o total do cliente vira o
   somatório dos casos exibido no topo da seção.
4. **Rastro comercial** por caso (mesma ideia do rastro operacional/financeiro): em que etapa comercial
   está ou como terminou.
5. Ordem da página conforme o desenho (AC do contexto), com **Notas** e **Documentos do cliente** ao final.
6. Nível de detalhe é **resumo**: nada de parcela a parcela na ficha do cliente; clicar leva ao financeiro
   do caso.
7. **Respeita o gate de valores**: quem não pode ver dinheiro (`podeVerValores`) não vê os números —
   e a seção não "quebra" por isso, só omite.
8. Performance: a ficha carrega os agregados em **uma** consulta por cliente (não N+1 por caso).
9. `npx tsc --noEmit` e `npm run lint` sem erro novo.

---

## Tasks / Subtasks

- [ ] Endpoint agregado `clientOverview(clientId)`: casos + etapas + agregados financeiros + comercial (AC 1-4, 8).
- [ ] Reescrever `ClientCasesSection` com o card novo (AC 1, 2, 4).
- [ ] Remover/absorver `ClientFinanceiroSection` como topo da seção de casos (AC 3).
- [ ] Reordenar a ficha (AC 5).
- [ ] Aplicar o gate de valores (AC 7).

---

## Dev Notes

- **Espelhar, não copiar**: etapa e valores são lidos do caso na hora; nada de coluna nova denormalizada.
- A régua financeira (Devido/Vencido/Pago/A vencer, "registros dispensados não entram") já existe — usar
  a mesma função, senão os números divergem entre as telas e a confiança no sistema cai.
- Componentes de hoje: `ClientCasesSection.tsx`, `ClientFinanceiroSection.tsx`,
  `ClientDocumentsSection.tsx`, `clientes.$id.tsx`.

## Definition of Done

- [ ] A ficha responde "como está esse cliente?" sem abrir nenhum caso
- [ ] Números batem com a aba Financeiro do caso
- [ ] Sem N+1 e sem vazamento de valores para quem não pode ver
