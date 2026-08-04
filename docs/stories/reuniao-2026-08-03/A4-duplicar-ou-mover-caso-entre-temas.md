# Story A4: Duplicar ou Mover caso entre temas (popup de escolha)

**Épico:** Reunião 2026-08-03 — 8 Ajustes
**ID:** A4
**Status:** Ready for Review
**Estimativa relativa:** M
**Executor sugerido:** @dev · Quality gate: @qa
**Risco:** MÉDIO

---

## Story

**Como** operador do sistema (com permissão de edição no módulo operacional),
**quero** que, ao vincular um caso a outro tema, o sistema abra um popup me perguntando se quero **DUPLICAR** ou **MOVER/TRANSFERIR** o caso entre os temas,
**para que** eu possa escolher conscientemente entre manter o caso nos dois temas (duplicar) ou transferi-lo do tema de origem para o tema de destino (mover), exatamente como já funciona no envio ao financeiro.

**Decisão do owner (travada):** _"deixar a opção do usuário escolher se quer DUPLICAR ou MOVER o caso pelos temas, igual funciona quando vamos mandar para a pipeline financeira: abre um popup perguntando se quer duplicar ou mover."_ O comportamento **atual** (Iago pediu) deve permanecer disponível como a opção **Duplicar**; a novidade é a opção **Mover/Transferir** com confirmação clara.

---

## Contexto / o que JÁ EXISTE vs NOVO

### JÁ EXISTE
- **Diálogo de vínculo:** `sistema-hv/src/components/cases/LinkCaseToTemaDialog.tsx` — hoje tem UMA ação só ("Vincular ao tema"). Chama o hook `useMoverCasoParaTema()` (`LinkCaseToTemaDialog.tsx:28,48`) que executa `moverCasoParaTema` (`LinkCaseToTemaDialog.tsx:55-72`).
- **ACHADO IMPORTANTE (divergência com o brief):** o serviço `moverCasoParaTema` (`sistema-hv/src/lib/cases-service.ts:1238-1382`) **não duplica** — ele **reatribui o caso NO LUGAR** (`UPDATE system_cases` em `cases-service.ts:1345-1351`): troca `case_type`, zera `service_type_id` (deixa o trigger `system_fn_sync_stage_ids` reprojetar), grava `tema_id`/`frente_slug`, reprojeta `macrostatus_op`/`macrostatus_fin` (`cases-service.ts:1320-1327`). Ou seja: **hoje o botão já MOVE, não duplica.** A opção "Duplicar" (que o owner descreve como comportamento atual) **NÃO existe ainda no serviço** e precisa ser criada. Confirmar com o owner na dúvida, mas a story implementa AMBAS as ações e mantém "Mover" ligado ao serviço atual.
- **Padrão popup "duplicar vs mover":** `sistema-hv/src/components/cases/MoveCaseFinDialog.tsx` (envio ao financeiro). Também `sistema-hv/src/components/cases/MoveCaseDialog.tsx`. Espelhar a UX (título/descrição, footer Cancelar+Confirmar, toasts via `sonner`, estado de `isPending`).
- **RPC:** `moverCasoParaTemaFn` (`sistema-hv/src/rpc/cases.ts:268-274`) via `createServerFn` + `handleManage` (gate `casos.manage`). Schema `moverParaTemaSchema` (`cases.ts:262-266`).
- **Timeline (A6):** todos os fluxos gravam em `system_case_events` (ex.: evento `vinculado_a_tema` em `cases-service.ts:1356-1372`). `listCaseEvents` (`cases-service.ts:1645`).
- **Etapas do tema destino:** `system_pipeline_stages` filtradas por `service_type_id` do tema (`cases-service.ts:1272-1311`); a 1ª etapa é `firstOpSlug` (`cases-service.ts:1281`).
- **Campos/filtros por tema:** `system_tema_field_defs` por `tema_id` + `canonical_fields` no caso (memória `project_filtros_por_tema_r209`).
- **Gate de escrita por módulo:** hook `usePodeEditar`/`usePodeEditarAlgum` (`sistema-hv/src/hooks/usePermissions.ts`) no front; `requireModule`/`requireAnyModule('edit')` no back (ref `reference_rbac_edit_gate`). O botão que abre o diálogo na ficha (`sistema-hv/src/routes/casos.$id.tsx`) já é gate-ado.
- **Criação de caso (base p/ duplicar):** `createCase` (`sistema-hv/src/lib/cases-service.ts:93-268`) — grava evento de criação em `system_case_events` (`cases-service.ts:264-268`).

### NOVO
- Transformar `LinkCaseToTemaDialog.tsx` num popup de **duas ações**: **Duplicar** e **Mover/Transferir**, com seletor de tema destino e **confirmação explícita** ("você está transferindo o caso do tema X para o tema Y").
- Novo serviço `duplicateCaseToTema` em `cases-service.ts` (cria cópia no tema destino; mantém o original no tema de origem).
- Renomear/expor semanticamente o serviço de transferência: manter `moverCasoParaTema` (transferência in-place) e garantir que o evento de timeline distinga **mover** de **duplicar** (ex.: `action: 'movido_entre_temas'` / `action: 'duplicado_em_tema'`, ou reutilizar `vinculado_a_tema` com `diff.modo`).
- Novo(s) RPC e hook(s) para o fluxo de duplicar, espelhando o de mover.

---

## Acceptance Criteria

1. **Popup com escolha Duplicar/Mover + confirmação:** ao acionar "Vincular a um tema" na ficha do caso, abre um popup que permite (a) selecionar o **tema destino** e (b) escolher entre **Duplicar** e **Mover/Transferir**. Antes de efetivar, exibe **confirmação clara** com nomes dos temas — ex.: "Você está **transferindo** o caso do tema **X** para o tema **Y**" (mover) ou "Você está **duplicando** o caso no tema **Y** (o original permanece em **X**)" (duplicar). UX espelha `MoveCaseFinDialog.tsx` (footer Cancelar+Confirmar, `isPending`, toasts).
2. **Mover transfere:** a opção **Mover** remove o caso do tema de origem e o coloca no tema de destino (comportamento in-place atual de `moverCasoParaTema`): troca `tema_id`/`service_type_id`/`case_type`/`frente_slug` e **projeta a etapa no destino** — mantém a etapa op se existir na pipeline do destino, senão reseta para a 1ª etapa (`opResetado`), com aviso no toast. Idem financeiro (só reprojeta se já bifurcado). Após mover, o caso **não** aparece mais no tema de origem.
3. **Duplicar mantém nos dois:** a opção **Duplicar** cria uma **cópia** do caso no tema de destino e **preserva o caso original** no tema de origem (ambos existem e são acessíveis). A cópia entra na 1ª etapa (ou etapa mapeada) da pipeline do tema destino.
4. **Campos/filtros do tema destino passam a valer:** no caso movido (e na cópia duplicada), as definições de campos do tema destino (`system_tema_field_defs` por `tema_id`) passam a reger a ficha/filtros; `canonical_fields` compatíveis são mantidos e os incompatíveis com o destino **não** quebram a ficha (ausência = campo vazio, não erro).
5. **Evento na timeline em ambos os fluxos:** tanto **Mover** quanto **Duplicar** registram evento em `system_case_events` distinguindo o modo. Na **duplicação**, registrar evento no **original** (referenciando o caso criado) e no **novo caso** (referenciando a origem). No **mover**, registrar a transferência (tema origem → tema destino). Os eventos aparecem na Timeline (A6) via `listCaseEvents`.
6. **Gate de edição por módulo respeitado:** o botão/popup só aparece e as duas ações só executam para quem tem `edit` no módulo operacional (`usePodeEditar` no front) e o RPC valida no servidor (`handleManage`/`requireModule`/`requireAnyModule('edit')`). Sem permissão → botão oculto + 403 no back se forçado.
7. **Sem quebrar casos existentes:** casos já vinculados a temas continuam funcionando; o fluxo antigo de "vincular" continua acessível (agora como "Mover"), sem migração destrutiva. `system_cases_active` e o Kanban do tema destino refletem o resultado corretamente (sem órfão de etapa / `stage_op_id` nulo).
8. **i18n/labels claros (pt-BR):** rótulos, descrições e toasts em português, sem ambiguidade entre "Duplicar" e "Mover"; título do popup, ação primária e mensagens de confirmação/sucesso/erro consistentes com o restante do app.

---

## Tasks / Subtasks

- [ ] **T1 — Serviço `duplicateCaseToTema`** (`sistema-hv/src/lib/cases-service.ts`)
  - [ ] Ler o caso origem (mesmos campos de `moverCasoParaTema`, `cases-service.ts:1246-1253`) + `canonical_fields`, cliente, honorários aplicáveis.
  - [ ] Resolver `service_type` interno do tema destino (mesma lógica `cases-service.ts:1256-1270`); calcular 1ª etapa op (`firstOpSlug`).
  - [ ] Criar novo `system_cases` no tema destino (reusar/derivar de `createCase` para consistência de `case_code`, evento de criação e defaults). Preservar `canonical_fields` compatíveis; NÃO copiar campos que não fazem sentido (ex.: assinaturas/anexos gerados) — decidir com Dev Notes.
  - [ ] Retornar `{ novoCasoId }`.
- [ ] **T2 — Distinguir modo na timeline**
  - [ ] Em `moverCasoParaTema` (AC5): garantir que o evento (`cases-service.ts:1356+`) marque `modo: 'mover'` no `diff` (ou `action` dedicada) e registre `from_tema_id`/`to_tema_id`.
  - [ ] Em `duplicateCaseToTema`: gravar evento no ORIGINAL (`action: 'duplicado_em_tema'`, `diff.novo_caso_id`) e no NOVO (`diff.origem_caso_id`).
- [ ] **T3 — RPC + hooks para duplicar** (`sistema-hv/src/rpc/cases.ts`, `sistema-hv/src/hooks/useCases.ts`)
  - [ ] `duplicarCasoParaTemaFn` via `createServerFn` + `handleManage` (espelhar `moverCasoParaTemaFn`, `cases.ts:268-274`) + schema Zod.
  - [ ] Hook `useDuplicarCasoParaTema()` espelhando `useMoverCasoParaTema()` (invalidar as mesmas queries + a do tema destino).
- [ ] **T4 — Popup de escolha** (`sistema-hv/src/components/cases/LinkCaseToTemaDialog.tsx`)
  - [ ] Adicionar seleção de MODO (Duplicar × Mover) — RadioGroup/SegmentedControl ou dois botões.
  - [ ] Manter o `Select` de tema destino existente (`LinkCaseToTemaDialog.tsx:88-99`).
  - [ ] Passo/estado de **confirmação** com nomes dos temas (origem = `currentTemaId` → destino selecionado).
  - [ ] Ramificar `confirmar()` para chamar `mover` ou `duplicar`; toasts distintos (incluindo aviso de reset de etapa `opResetado`).
  - [ ] Ajustar título/descrição/Alert p/ refletir os dois fluxos.
- [ ] **T5 — Gate de edição** (`sistema-hv/src/routes/casos.$id.tsx`)
  - [ ] Confirmar que o botão que abre o diálogo respeita `usePodeEditar` (operacional). Ajustar se necessário.
- [ ] **T6 — QA/Testes** (ver Testing).
- [ ] **T7 — Atualizar File List + Change Log.**

---

## Dev Notes

- **Espelhar exatamente `MoveCaseFinDialog.tsx`:** estrutura de `Dialog`/`DialogHeader`/`DialogFooter`, `Button variant="outline"` para Cancelar, botão primário com estado `isPending` ("Movendo…"/"Duplicando…"), toasts `toast.success`/`toast.error` com `err instanceof Error`. Referências: `MoveCaseFinDialog.tsx:74-111`.
- **Divergência crítica (validar com owner):** o brief diz que HOJE o botão "apenas DUPLICA", mas a leitura do código mostra que `moverCasoParaTema` **reatribui in-place (MOVE)** — `UPDATE system_cases` em `cases-service.ts:1345`. Portanto: a ação **Mover** já está pronta (reusar `moverCasoParaTema`); a ação **Duplicar** é a que precisa ser **construída do zero**. Se o owner de fato quer "manter o comportamento atual do Iago" como Duplicar, então o comportamento atual é MOVER e a Duplicação é nova. Deixar isso explícito no popup para não confundir o usuário.
- **Trigger de dual-write (não quebrar):** ao MOVER, zerar `service_type_id` é OBRIGATÓRIO — o trigger `system_fn_sync_stage_ids` só reprojeta `service_type_id`/`stage_op_id` quando ele é NULL (`cases-service.ts:1313-1327`). Na DUPLICAÇÃO, criar o novo caso já com o `case_type` do destino e deixar o mesmo trigger resolver os `stage_*_id` (preferir passar por `createCase` para herdar essa lógica).
- **Projeção de etapa (AC2):** manter etapa se `opSlugs.has(macrostatus_op)`, senão `firstOpSlug` (`cases-service.ts:1283-1288`). Financeiro: só reprojeta se `macrostatus_fin !== 'NAO_APLICAVEL'` (`cases-service.ts:1290-1311`). Emitir `opResetado`/`finResetado` no retorno para o toast.
- **Campos por tema (AC4):** as defs são por `tema_id` em `system_tema_field_defs`; `canonical_fields` fica no caso. Ao mover/duplicar, os defs do destino passam a reger a ficha automaticamente (a ficha lê defs por `tema_id`). Garantir que valores de `canonical_fields` sem def correspondente no destino não quebrem render (tratar como opcionais). Ver memória `project_filtros_melhorias_2026_07_29` (origem TEMA×CLIENTE, múltiplas ocorrências).
- **R2-11 (promoção ao operacional):** `moverCasoParaTema` também promove LEAD→CLIENTE quando há procuração assinada (`cases-service.ts:1329-1343`). Ao **duplicar**, decidir se a cópia herda esse estado — recomendação: a cópia entra "limpa" no funil do destino (não carimbar `assinatura_liberada_at`), preservando o original. Documentar a decisão.
- **Timeline (A6):** eventos em `system_case_events` (mesmo padrão de `cases-service.ts:1356-1372`). Usar `organization_id` do caso; `triggeredBy = userId` vindo do `handleManage`.

### Riscos
- **Perda de canonical incompatível:** ao mover/duplicar para um tema com defs diferentes, campos preenchidos podem ficar "órfãos". Mitigar: preservar `canonical_fields` no JSON (não apagar) e só deixar de exibir os sem def; nunca dropar dados na transferência.
- **Projeção de etapa errada:** se o destino não tiver etapa equivalente, o caso pode "sumir" do Kanban por `stage_op_id` nulo — garantir reset para 1ª etapa e teste de não-órfão (AC7).
- **RBAC:** duplicar cria um NOVO registro — garantir que o gate `edit`/`casos.manage` cubra a criação e que o caso duplicado herde visibilidade/responsáveis corretamente (não vazar caso para quem não deveria ver).
- **Confusão de UX Duplicar×Mover:** dado que o "atual" na verdade MOVE, textos ambíguos podem induzir erro destrutivo (usuário achar que duplica e na verdade transfere). Confirmação explícita com nomes dos temas é obrigatória.

---

## Testing

- **Unit/serviço:**
  - `moverCasoParaTema`: caso deixa o tema origem, entra no destino, etapa projetada (mantida vs resetada), evento com `modo/from_tema/to_tema`.
  - `duplicateCaseToTema`: original permanece; novo caso criado no destino; ambos com eventos cruzados; `canonical_fields` preservados; etapa = 1ª do destino.
  - Caso financeiro bifurcado × `NAO_APLICAVEL` (reprojeção correta).
- **RBAC:** usuário sem `edit`/`casos.manage` → botão oculto (front) + 403 no RPC (`handleManage`) para mover e duplicar.
- **UI (Playwright smoke, padrão da casa):** abrir ficha → "Vincular a tema" → escolher destino → Mover (confirma origem→destino, some do tema origem) e Duplicar (fica nos dois). Verificar toasts e evento na Timeline.
- **Não-regressão:** casos já vinculados abrem normalmente; Kanban do tema destino sem órfão de etapa; `system_cases_active` consistente.
- **Gates:** `npm run typecheck`, `npm run lint`, e testes existentes verdes.

---

## Dependências

- **A6 (Timeline de eventos do caso):** ambos os fluxos gravam em `system_case_events`; a exibição do evento depende da Timeline. Coordenar `action`/`diff` com A6.
- **Infra RBAC por módulo** (`reference_rbac_edit_gate`): `usePodeEditar`/`requireModule` já existentes.
- **Motor de campos por tema** (`system_tema_field_defs` + `canonical_fields`, R2-09 / melhorias 2026-07-29): a ficha do destino deve reger os campos.
- **Confirmação do owner** sobre a semântica "atual = mover" antes de rotular a opção Duplicar como "comportamento do Iago".

---

## File List

_A preencher pelo @dev conforme implementa._

- `sistema-hv/src/components/cases/LinkCaseToTemaDialog.tsx` — popup com escolha Duplicar/Mover + confirmação (NOVO comportamento).
- `sistema-hv/src/lib/cases-service.ts` — novo `duplicateCaseToTema`; ajuste de evento/modo em `moverCasoParaTema`.
- `sistema-hv/src/rpc/cases.ts` — novo `duplicarCasoParaTemaFn` (+ schema).
- `sistema-hv/src/hooks/useCases.ts` — novo `useDuplicarCasoParaTema` (+ invalidações).
- `sistema-hv/src/routes/casos.$id.tsx` — confirmação do gate de edição no botão.
- (Ref. de padrão, não editar) `sistema-hv/src/components/cases/MoveCaseFinDialog.tsx`.

---

## Change Log

| Data | Versão | Descrição | Autor |
|------|--------|-----------|-------|
| 2026-08-03 | v0.1 | Draft inicial da story A4 | @sm (Bob) |
| 2026-08-04 | v0.2 | Implementado (@dev via Orion). Confirmado o achado da story: `moverCasoParaTema` já MOVE in-place → **Mover** reusado; **Duplicar** criado do zero. `cases-service.ts`: novo `duplicateCaseToTema` (via `createCase` → herda case_code/pasta Drive/evento; copia `canonical_fields`; lifecycle herdado; eventos cruzados `duplicado_em_tema`/`duplicado_de_caso`) + `modo:"mover"`/`from_tema_id` no evento do mover. `rpc/cases.ts`: `duplicarCasoParaTemaFn` (mesmo `handleManage`/schema). `useCases.ts`: `useDuplicarCasoParaTema`. `LinkCaseToTemaDialog.tsx`: popup com escolha Mover×Duplicar + destino (exclui o tema atual) + **confirmação explícita com nomes dos temas** + toasts distintos. `CaseTimeline.tsx`: rótulos p/ `vinculado_a_tema`/`duplicado_em_tema`/`duplicado_de_caso`. Sem migration. lint 0, typecheck sem erro novo. Gate `casos.manage` preservado. Status → Ready for Review; smoke UI p/ @qa. | @dev |
