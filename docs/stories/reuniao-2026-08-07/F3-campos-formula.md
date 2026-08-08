# Story F3: Campo com FÓRMULA estilo Excel (valor calculado a partir de outros campos)

- **Épico:** Futuro (pós-segunda) — Reunião 2026-08-07
- **ID:** F3
- **Status:** **Backlog / Futuro (ADIADO — alta complexidade)**
- **Estimativa relativa:** XL
- **Executor sugerido:** @architect (design/spike) + @dev · Quality gate: @qa + @architect
- **Risco:** ALTO — introduz um mini-motor de expressões (parser/avaliador) sobre `canonical_fields`; superfície de bug grande (recálculo, dependências, tipos, segurança de avaliação). Owner e dev concordaram em **adiar**.
- **Origem:** Reunião 2026-08-07 (bloco FUTURO, **F3**). Transcrição `Dr. Thiago Correia [0000] se tiver.txt` (parte 2, abertura): *"a gente vai adicionar uma fórmula ali e o sistema vai mostrar só o resultado… igual Excel, você clica na célula e tá a fórmula, quando sai é só a informação."* Exemplo: *"período de atuação + 3 anos quando é portaria 10%."*

> ⚠️ **NÃO É PARA ANTES DE SEGUNDA. ADIADO por decisão conjunta.** O Matheus: *"tem uma complexidade muito grande… é uma programação quase."* O Thiago: *"de início, vamos deixar isso fora, é meio complexo."* Esta story existe para **registrar o pedido e a abordagem**, não para execução imediata. A **alternativa recomendada** (mapear a lógica em código por tema) está descrita abaixo e pode ser feita pontualmente quando um caso concreto exigir, sem construir o motor genérico.

---

## Story

**Como** Thiago (acostumado a Excel), configurando um tema,
**quero** poder definir um campo cujo **valor é uma FÓRMULA** que referencia outros campos do caso/cliente (ex.: `período_de_atuação + 3 anos` quando `município = 10%`), exibindo apenas o **resultado** na ficha, mas revelando a **fórmula ao clicar/editar** (ir e voltar como célula de Excel),
**para que** campos derivados (datas-limite, percentuais, prazos calculados) fiquem sempre coerentes com os campos-fonte sem redigitação, e de forma flexível/configurável em vez de hard-coded.

> **DECISÕES TRAVADAS (reunião 2026-08-07):**
> 1. **ADIAR.** Owner e dev concordaram que o motor genérico de fórmula é alta complexidade e fica FORA de início.
> 2. **Alternativa aceita para o curto prazo:** **mapear a lógica em código** por tema quando necessário ("é mais fácil a gente mapear esses campos e colocar na lógica", disse o Matheus; o Thiago aceitou "beleza, deixa para outro momento"). Ou seja: campos derivados específicos podem ser calculados em código, sem UI de fórmula.
> 3. **Comportamento-alvo (quando/se for feito):** resultado visível na ficha; ao editar o campo, mostra a fórmula; ao sair, mostra o resultado (UX de célula Excel). Fórmula referencia campos existentes do caso (e possivelmente do cliente).
> 4. **Campos de importação "bagunçados" (`import_batch…object object`)** provavelmente eram justamente esses campos-fórmula do sistema antigo do Thiago — F3 é a "versão certa" desse conceito.

---

## Contexto / o que JÁ EXISTE vs NOVO

### JÁ EXISTE (reusar / referência)

- **Definições de campo por tema:** `system_tema_field_defs` (via `sistema-hv/src/lib/tema-field-defs-service.ts`), tipos atuais `text/select/multiselect/money/number/date/boolean`. Um novo tipo `formula` (ou um flag `source='formula'` + `formula_expr`) entraria aqui.
- **Valores por caso:** `system_cases.canonical_fields` (JSONB) — os campos-fonte que a fórmula leria. `system_clients.custom_fields` para fontes de cliente.
- **Motor de preenchimento "1x no caso" (2026-07-21):** já existe a noção de `source` de campo (`manual`/auto) e "auto_field" no editor de campos (`project_motor_preenche1x_2026_07_21`). F3 estenderia esse eixo com `source='formula'`, reusando a infra de origem de campo em vez de criar um conceito paralelo.
- **Precedente de campo derivado hard-coded:** os campos FIES (`fies-fields.ts`) já calculam/derivam por domínio fechado — molde da **alternativa** (lógica em código por tema).
- **Renderização da ficha:** `sistema-hv/src/components/cases/` (células canônicas, ex.: `InlineCanonicalCell.tsx`) — onde um campo-fórmula exibiria resultado (read) e fórmula (edit).

### NOVO (se/quando implementado — FUTURO)

- **Tipo/flag `formula` no field_def** + coluna `formula_expr TEXT` (a expressão) em `system_tema_field_defs`.
- **Mini-linguagem de expressão** restrita e segura: referências a outras field keys (`{periodo_atuacao}`), operadores aritméticos, funções de data (`addYears`, `addDays`), condicionais simples (`if município == '10%' then … else …`). **Sem** `eval` de JS cru (superfície de segurança).
- **Parser + avaliador** determinístico (server-side de preferência, para o valor persistir consistente) com resolução de **dependências** (que campos a fórmula lê) e recálculo quando uma fonte muda.
- **UX de célula Excel:** na ficha, read = resultado; edit = expressão; validação da expressão (campos existem, tipos batem, sem ciclo).

---

## Acceptance Criteria (aplicáveis SE for implementado — hoje é registro/adiamento)

1. **Registro do pedido + abordagem:** esta story documenta o comportamento-alvo, a complexidade e a **alternativa** (lógica em código por tema), servindo de referência quando um caso concreto surgir. Nenhum motor genérico é entregue nesta rodada.
2. **Alternativa viável descrita:** está claro como implementar um campo derivado **pontual** em código (molde `fies-fields.ts` / `source` do motor 1x) sem UI de fórmula — o caminho aprovado para o curto prazo.
3. **(Futuro) Definição do campo-fórmula:** `system_tema_field_defs` suportaria `type='formula'`/`source='formula'` + `formula_expr`, aditivo e nullable (campos sem fórmula continuam válidos).
4. **(Futuro) Linguagem segura:** a fórmula usa uma DSL restrita (refs a field keys, aritmética, funções de data, condicional simples), **sem** avaliação de código arbitrário; validação rejeita refs a campos inexistentes e ciclos.
5. **(Futuro) UX Excel:** ficha mostra o resultado; editar revela a fórmula; sair mostra o resultado; recálculo quando um campo-fonte muda.
6. **(Futuro) Determinismo/regressão:** o valor calculado é estável e reproduzível; `typecheck`/`lint` verdes; sem impacto nos campos não-fórmula.

---

## Tasks / Subtasks

### T0 — Decisão registrada (@sm/@architect) — feito nesta story
- [x] Registrar ADIAMENTO + alternativa (lógica em código por tema). (AC-1, AC-2)

### T1 — (Futuro) Spike da DSL (@architect)
- [ ] Definir a gramática mínima (refs, aritmética, datas, condicional), o avaliador seguro (sem `eval`), a estratégia de dependências/recálculo e onde avaliar (server). Estimar esforço real. (AC-3, AC-4)

### T2 — (Futuro) Schema + editor (@dev)
- [ ] `system_tema_field_defs`: `type='formula'`/`source='formula'` + `formula_expr` (migration aditiva). Editor de campo aceita a fórmula com validação. (AC-3, AC-4)

### T3 — (Futuro) Avaliador + recálculo (@dev + @architect)
- [ ] Parser/avaliador; recalcula quando fonte muda; persiste resultado no `canonical_fields`. (AC-4, AC-6)

### T4 — (Futuro) UX Excel + QA (@dev + @qa)
- [ ] Ficha: read=resultado, edit=fórmula; validação de ciclo/refs; testes determinísticos. (AC-5, AC-6)

---

## Dev Notes

- **Por que adiar:** um campo-fórmula genérico é um mini-Excel — parser, avaliador seguro, grafo de dependências, recálculo, tipos, edição inline. É "programação quase" (Matheus). O valor/entrega da semana não depende disso.
- **Alternativa recomendada (curto prazo):** quando um cálculo específico for realmente necessário (ex.: data-limite = período + 3 anos p/ município 10%), **implementar em código** por tema (molde `fies-fields.ts` / `source` do motor 1x) e persistir o resultado como campo comum. Sem UI de fórmula, sem DSL — resolve o caso concreto com risco baixo.
- **Segurança:** se um dia a DSL for feita, **jamais** `eval` de string arbitrária. Usar um avaliador de expressão restrito (whitelist de operadores/funções) — evita injeção e efeitos colaterais.
- **Reuso do eixo `source`:** o motor "preenche 1x" (2026-07-21) já tem `source` do campo (manual/auto). `formula` é o terceiro valor natural desse eixo — não criar um sistema paralelo.
- **Origem dos campos "bagunçados":** o Thiago associou os campos de import quebrados (`import_batch… object object`) a fórmulas do sistema antigo. Ao mapear em código (alternativa), esses viram campos limpos.

**Riscos (se implementado):**
- **R1 — superfície de bug** (recálculo/dependências/ciclos). Mitigar com DSL mínima + testes determinísticos.
- **R2 — segurança de avaliação.** Mitigar com avaliador restrito (sem eval).
- **R3 — escopo criativo** (usuários pedindo funções cada vez mais complexas). Mitigar fixando um conjunto pequeno de operadores/funções.

---

## Testing

- **Hoje:** nenhum — story é registro/adiamento. Validar apenas que a alternativa (código por tema) está descrita e é acionável.
- **(Futuro):** avaliador determinístico (mesma entrada → mesma saída); validação rejeita refs inexistentes e ciclos; UX read/edit; recálculo ao mudar fonte; `typecheck`/`lint` verdes.

## Dependências

- Reusa `system_tema_field_defs` + `canonical_fields`/`custom_fields` + eixo `source` do motor 1x + molde `fies-fields.ts`.
- **Sem dependência dura** — está adiada. A alternativa (código por tema) pode ser feita pontualmente a qualquer momento, isolada.

## File List

**Nada a implementar agora (ADIADO). Previsto (se/quando):**
- `sistema-hv/supabase/migrations/2026XXXX_field_formula.sql` (+ rollback + `db:types`).
- `sistema-hv/src/lib/formula/` (parser + avaliador seguro).
- editor de campo + célula da ficha (read=resultado / edit=fórmula).
- **Alternativa (curto prazo):** cálculo por tema em código (molde `sistema-hv/src/lib/fies-fields.ts`).

## Change Log

| Data | Versão | Descrição | Autor |
|------|--------|-----------|-------|
| 2026-08-07 | v0.1 | Draft inicial (FUTURO/ADIADO). Registra o pedido de campo-fórmula estilo Excel (resultado na ficha, fórmula ao editar), a complexidade (mini-motor de expressões) e a alternativa aprovada de curto prazo: mapear a lógica em código por tema (molde FIES). Sem execução imediata. | @sm (Bob) |
