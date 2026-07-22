# Story R2-11: Fluxo procuração → lead/comercial → operacional (por tema/caso)

- **Épico:** R2 — Camada TEMA→CASO→TIPO
- **ID:** R2-11
- **Status:** Implementado (Ready for Review) — núcleo + req.5 + NIT do botão Promover
- **Estimativa:** XL — máquina de estados do ciclo de vida (comercial × operacional). Alto risco.
- **Executor:** @dev + @data-engineer (migration provável) · Quality gate: @qa
- **Origem:** Owner 2026-07-22 (após R2-10).

---

## Fluxo desejado (owner, textual)

1. **Criar uma PROCURAÇÃO (antes do caso)** → cria um **card novo no LEAD/comercial**.
2. **Procuração assinada** → a pessoa **vira CLIENTE**, mas **continua na pipeline COMERCIAL**
   (não vai direto pro operacional).
3. **Só vai para o OPERACIONAL** quando eu **vincular um TEMA e um CASO** àquele cliente.
4. Pode ir para o operacional **sem o caso estar assinado** — porque a **procuração já foi
   assinada**.
5. No **card da pipeline operacional** (do tema vinculado), ficam **os documentos da PROCURAÇÃO
   e do CASO juntos** dentro do card.

---

## Como é hoje (a confirmar/ajustar)

- Caso nasce `lifecycle='LEAD'`. Com `comercial=true` → `macrostatus_comercial` + `aguardando_
  assinatura_at` carimbados → aparece no **comercial**, escondido do **operacional**
  (`cases-service.ts:226,236`).
- **Procuração assinada** → sai de `aguardando_assinatura_at`, marca comercial GANHO; **NÃO muda
  `lifecycle`** (segue LEAD) — `cases-service.ts:884-885`.
- **CONFLITO com R2-09:** em `pipeline.tsx` a regra "Melhoria 3" (esconder `aguardando_assinatura_
  at` do Kanban operacional) foi **removida** a pedido do owner numa rodada anterior (mostrar todos
  os casos). **Este fluxo exige REVERTER isso** — comercial não pode aparecer no operacional até
  vincular tema+caso.

## Mudanças previstas (design — CONFIRMAR)

- **Procuração → card comercial:** gerar procuração (sem caso) cria/garante um card no comercial
  (lead). *(Já existe parte disso via `comercial=true` + envio da procuração.)*
- **Procuração assinada → CLIENTE + fica no comercial:** o gatilho de assinatura da procuração
  passa a setar `lifecycle='CLIENTE'` **mantendo** o card na esteira comercial (não promove ao
  operacional automaticamente).
- **Entrada no operacional = vincular TEMA+CASO (manual):** botão/fluxo "Vincular a um tema"
  (LinkCaseToTemaDialog) passa a ser o gatilho que coloca o cliente no operacional — **mesmo sem o
  caso assinado**, pois a procuração já foi. Reverter o filtro do Kanban: operacional só mostra
  quem tem tema+caso vinculado e procuração assinada.
- **Card operacional com os 2 documentos:** o card/ficha do caso no operacional lista a
  **procuração** (do estágio comercial) + os **documentos do caso** juntos.

## Decisões a confirmar com o owner (antes de implementar)

1. "Vincular tema e caso" cria um NOVO caso operacional (ligado ao mesmo cliente/procuração) ou
   reusa o caso comercial existente mudando de esteira? (impacta R2-10 — documento de caso = caso)
2. Reverter a mudança do Kanban (voltar a esconder comercial/aguardando do operacional) — confirmar,
   pois foi pedida antes.
3. O que exatamente conta como "procuração assinada" (ZapSign webhook vs "Confirmar assinatura"
   manual) para virar CLIENTE.
4. Numeração/financeiro do caso operacional quando criado a partir do vínculo.

## Riscos

- Máquina de estados: mexer em `lifecycle`, `macrostatus_comercial`, `aguardando_assinatura_at`,
  gatilhos de assinatura (ZapSign webhook + manual) e visibilidade do Kanban. Alto risco de
  regressão no funil comercial e nas dashboards.
- Interação com R2-10 (documento de caso = caso) e com a mudança do Kanban (R2-09).

## Decisão do owner (confirmada)

"Cliente = SELO; vira operacional só no vincular tema" — procuração assinada mostra selo
"Cliente" mas o caso segue LEAD no comercial; entra no operacional (lifecycle=CLIENTE) só ao
"Vincular a um tema", sem exigir contrato.

## Implementado (núcleo)

- `cases-service.ts` `moverCasoParaTema`: promove a CLIENTE quando o caso é LEAD + procuração
  assinada (limpa `aguardando_assinatura_at`, `macrostatus_comercial='GANHO'`, NÃO carimba
  `assinatura_liberada_at`). CHECK `assinatura_liberada_at IS NULL OR lifecycle<>'LEAD'` satisfeito.
- `pipeline.tsx`: Kanban operacional esconde leads comerciais (`LEAD && (aguardando||procuração)`);
  reverte a mudança R2-09 (que mostrava tudo).
- `casos.$id.tsx`: selo "Cliente" quando LEAD + `procuracao_assinada_at`.

## PENDENTE (req.5 — docs juntos) + NITs do QA

- **req.5:** procuração + caso no MESMO card operacional. Hoje o caso doc via R2-10 cria caso novo
  → separa da procuração. Proposta: 1º "Documento de caso" do caso promovido FICA nele (só cria
  caso novo se já houver caso doc). A confirmar com owner (mexe no R2-10 aprovado).
- **NIT (QA):** botão "Promover" segue visível quando o selo já diz "Cliente" (LEAD+procuração) —
  confirmar com owner se some.

## QA Results

**QA (Quinn):** APROVADO-COM-RESSALVAS. Sem BLOCKER/MAJOR. Validou o CHECK constraint real
(`assinatura_liberada_at IS NULL OR lifecycle<>'LEAD'` — promoção a CLIENTE sem contrato PERMITIDA)
e a coerência comercial×operacional (caso promovido fica em EXATAMENTE um lugar). Legados não
escondidos. typecheck/eslint verdes. 2 NITs (story versionar; botão Promover).

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-22 | 0.1 | Draft — fluxo descrito pelo owner. | @sm (via Orion) |
| 2026-07-22 | 1.0 | Núcleo implementado (@dev): promoção via vínculo-de-tema + filtro operacional + selo Cliente. QA aprovado. Falta req.5 (docs juntos). | @dev + @qa (via Orion) |
