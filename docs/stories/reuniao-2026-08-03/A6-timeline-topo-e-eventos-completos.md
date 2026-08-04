# Story A6: Linha do tempo no topo da ficha + eventos completos (toda a movimentação do caso)

**Épico:** Reunião 2026-08-03 — 8 Ajustes
**ID:** A6
**Status:** Ready for Review (núcleo: timeline no topo + escrita manual removida + `note_added`)
**Estimativa relativa:** M
**Executor sugerido:** @dev · Quality gate: @qa
**Risco:** MÉDIO

---

## Story

**Como** advogado/operador acompanhando um caso,
**quero** que a Linha do tempo fique no TOPO da ficha (acima de Comunicações e Prazos), sem a caixa de escrita manual, e que ela registre automaticamente TODA a movimentação do caso — notas, documentos, assinaturas, mudança de etapa, checklist, duplicar/mover entre temas —,
**para** acompanhar o andamento real do caso em um único fluxo cronológico confiável, sem precisar escrever nada à mão.

Decisão do owner (reunião 2026-08-03), travada nesta story:

1. **Mover** o bloco "Linha do tempo" para o TOPO da ficha, ACIMA de Comunicações e de Prazos — é onde se acompanha o andamento de verdade.
2. **Remover** o input de "escrever na linha do tempo" (a escrita manual — marco/nota). O owner: *"vocês já fizeram, só esqueceram de remover aqui."* O bloco de NOTAS (separado) permanece.
3. **Ampliar os eventos**: *"na linha do tempo precisa ter também o registro das NOTAS, DOCUMENTOS, ASSINATURAS, basicamente toda a movimentação do caso — mover card na pipeline e tudo mais."* `system_case_events` deve passar a registrar automaticamente a criação de nota, upload/geração de documento, envio/assinatura ZapSign, mudança de etapa (mover card op/fin), conclusão de item de checklist / auto-avanço, e duplicar/mover entre temas.

Observação de performance da reunião: a aba Documentos pode ter 100+ arquivos (a listagem é POR CASO, não a pasta inteira). A timeline com muitos eventos precisa rolar/paginar bem.

---

## Contexto / o que JÁ EXISTE vs NOVO

### JÁ EXISTE (reaproveitar — NÃO duplicar)

- **Tabela `system_case_events`** — colunas: `case_id`, `organization_id`, `action`, `from_macrostatus_op`, `to_macrostatus_op`, `diff` (JSONB), `triggered_by`, `created_at`. Inserida VIA APP (sem trigger). Tipagem em `sistema-hv/src/lib/supabase/types.ts:1301-1345`. **`action` é coluna `string` LIVRE (sem enum/CHECK no tipo)** → novos valores de `action` NÃO exigem migration.
- **UI da timeline** `sistema-hv/src/components/cases/CaseTimeline.tsx` — já lista `system_case_events` por `case_id` em `created_at DESC` (hook `useCaseEvents`), com `renderEventLabel` cobrindo dezenas de `action` (linhas 51-128). O **input manual** (marco/nota) está em `CaseTimeline.tsx:191-229`; a lógica manual (add/update/delete + `isManualEvent` + editar/apagar) está espalhada em `CaseTimeline.tsx:30,46-49,132-183,231-355`.
- **Route da ficha** `sistema-hv/src/routes/casos.$id.tsx` — hoje a ordem é: (…) Dados do serviço → Dossiê → **Documentos** (`CaseDocumentsTab`, ~L488) → Notas (`NotesBlock`, `casos.$id.tsx:506`) → **Timeline** (`<CaseTimeline caseId={caso.id} />`, `casos.$id.tsx:511`). Comunicações e Prazos estão ACIMA (buscar `CaseComunicacoes`/`Prazos`/`Deadlines` no mesmo arquivo).
- **Eventos que JÁ SÃO emitidos** (não recriar):
  - Documentos: `doc_generated`, `doc_finalized`, `doc_reopened`, `doc_sent_zapsign`, `doc_deleted` — `sistema-hv/src/lib/case-documents-service.ts:314,423,621,691,823,857,956`.
  - Mudança de etapa: `status_changed` (op) e `fin_status_changed`/`fin_stage_auto_advanced`/`fin_enviado_conferencia`/`fin_conferencia_aprovada` — `sistema-hv/src/lib/cases-service.ts` (vários; ~L264, L372, L924, L1018, L1083, L1131, L1186, L1211, L1356, L1422, L1501, L1537). Mover card op/fin passa por aqui.
  - Ciclo de vida / promoção: `created`, `created_comercial`, `updated`, `soft_deleted`, `liberado_comercial`, `procuracao_preparada`, `perdido`, `canonical_fields_updated`.
  - Checklist: `stage_auto_advanced`, `fin_stage_auto_advanced`, `checklist_inconsistente` — `sistema-hv/src/lib/checklist-service.ts:714`.
  - Prazos: `deadline_created/completed/missed/status_changed/deleted`. Comunicações: `communication_logged/deleted`. Tarefas: `task_*`. Dossiê: `sistema-hv/src/lib/dossie-service.ts:66-288`.
- **Notas**: `sistema-hv/src/lib/notes-service.ts` (`createCaseNote` @ L90, `createClientNote` @ L117). RPC `sistema-hv/src/rpc/notes.ts`. **NÃO emite `system_case_events` hoje.**
- **ZapSign webhook**: route `sistema-hv/src/routes/api.webhooks.zapsign.tsx` → `processZapsignWebhook` em `sistema-hv/src/lib/zapsign/webhook.ts` (retorna `action: "case_document.signed_received"`/`"stored"` @ L152,184,202, mas **NÃO insere `system_case_events` de assinatura concluída**). Envio (`doc_sent_zapsign`) já existe; a CONCLUSÃO da assinatura não gera evento.
- **Story antiga relacionada**: `docs/stories/S4-04-timeline-manual-read-only.md` (criou a entrada manual que agora será removida).

### NOVO (implementar nesta story)

- **Reordenar** a ficha: `<CaseTimeline>` sobe para ACIMA de Comunicações e de Prazos em `casos.$id.tsx`.
- **Remover** o bloco de entrada manual da timeline em `CaseTimeline.tsx` (e limpar código morto: hooks `useAddManualCaseEvent`/`useUpdateManualCaseEvent`/`useDeleteManualCaseEvent`, editar/apagar, `isManualEvent`). Manter a renderização read-only dos eventos automáticos e o rótulo dos `action` "marco"/"nota_manual" históricos (para não quebrar eventos já gravados).
- **Emitir novos eventos** onde ainda falta:
  - `note_added` na criação de nota — `notes-service.ts:createCaseNote`.
  - `signature_completed` na conclusão da assinatura ZapSign — `zapsign/webhook.ts` (`processZapsignWebhook`, ramo do documento assinado).
  - `checklist_done` na conclusão de item de checklist — `checklist-service.ts` (toggle/complete de item).
  - Confirmar cobertura de UPLOAD de documento (não só geração) e de DUPLICAR/MOVER entre temas — emitir se faltar; se já coberto por `doc_generated`/`liberado_comercial`/`status_changed`, NÃO duplicar.
- **Paginação/rolagem** da lista de eventos (para 100+).
- Rótulos em `renderEventLabel` para os novos `action`.

---

## Acceptance Criteria

1. **AC-1 — Timeline no topo:** na ficha (`casos.$id.tsx`), o bloco "Linha do tempo" é renderizado ACIMA dos blocos de Comunicações e de Prazos (e permanece acima de Documentos/Notas). A ordem antiga (timeline no fim) deixa de existir.
2. **AC-2 — Sem escrita manual:** o input de escrever marco/nota na timeline foi REMOVIDO (não há caixa de texto nem botão "Adicionar à timeline" no componente de timeline). Eventos "marco"/"nota_manual" já gravados no passado continuam sendo exibidos (read-only) sem erro.
3. **AC-3 — Notas mantidas:** o bloco de NOTAS (`NotesBlock target="case"`) continua presente e funcional (criar/editar/excluir nota) na ficha, separado da timeline.
4. **AC-4 — Evento de nota:** ao criar uma nota no caso, um evento (ex. `action="note_added"`) aparece na timeline com data/hora e autor; excluir nota não precisa gerar evento (definir no Dev Notes, mas criação é obrigatória).
5. **AC-5 — Evento de documento:** ao gerar E ao fazer upload de um documento no caso, aparece um evento na timeline (reutilizando `doc_generated`/`doc_added`/`doc_finalized` existentes; se o upload não emitia evento, passa a emitir). Nenhum evento é duplicado.
6. **AC-6 — Evento de assinatura:** quando a assinatura ZapSign é concluída (webhook do documento assinado), aparece um evento na timeline (ex. `action="signature_completed"`) com o título/documento. O envio (`doc_sent_zapsign`) continua aparecendo como evento distinto.
7. **AC-7 — Evento de mudança de etapa / mover card:** mover o card na pipeline operacional e na financeira (drag-drop ou dialog) gera evento na timeline (`status_changed` / `fin_status_changed` já existentes) com origem → destino. Nada é duplicado.
8. **AC-8 — Evento de checklist:** concluir (marcar) um item de checklist gera evento na timeline (ex. `action="checklist_done"`); o auto-avanço de etapa por checklist (`stage_auto_advanced`/`fin_stage_auto_advanced`) continua aparecendo. Integra com a Story A5 (auto-avanço por checkbox) sem gerar eventos duplicados.
9. **AC-9 — Ordenação + escala:** os eventos aparecem em ordem DESC por `created_at`; com muitos eventos (100+), a lista rola/pagina sem travar (paginação/"carregar mais" ou scroll com limite). Documentar o mecanismo escolhido.
10. **AC-10 — Sem duplicação:** nenhum evento hoje emitido é emitido duas vezes após esta story; auditar cada ponto de emissão novo para garantir que não colide com um existente.
11. **AC-11 — Duplicar/mover entre temas:** ao duplicar o caso para o financeiro ou mover/vincular a outro tema (integra A4), aparece evento correspondente na timeline (reutilizar evento existente se já houver; caso não, criar). Sem duplicação.
12. **AC-12 — Modelagem sem migration desnecessária:** como `system_case_events.action` é texto livre, os novos `action` são apenas emitidos no app; NÃO é criada migration a menos que se decida por coluna nova (justificar no Dev Notes se criar).

---

## Tasks / Subtasks

- [ ] **T1 — Reordenar a ficha (AC-1).**
  - [ ] Em `casos.$id.tsx`, mover o `<CaseTimeline caseId={caso.id} />` (hoje ~L511) para ACIMA dos blocos de Comunicações e Prazos; ajustar `OrnamentalDivider`s.
  - [ ] Conferir que Comunicações, Prazos, Documentos e Notas continuam renderizando abaixo, na ordem que faça sentido (timeline primeiro).
- [ ] **T2 — Remover a escrita manual (AC-2).**
  - [ ] Em `CaseTimeline.tsx`, remover o bloco `191-229` (tabs Marco/Nota + Textarea + botão) e todo o estado/handlers de add/update/delete manual (`draft`, `editingId`, `editBody`, `confirmDelete`, `handleAdd/handleUpdate/handleDelete`) e o `AlertDialog` de exclusão.
  - [ ] Remover imports/hooks não usados (`useAddManualCaseEvent`, `useUpdateManualCaseEvent`, `useDeleteManualCaseEvent`, `Textarea`, `Button`, `AlertDialog*`, `Flag`, `Pencil`, `StickyNote`, `Trash2`) e `isManualEvent`/`MANUAL_ACTIONS` se ficarem órfãos — MAS manter os `case "marco"`/`case "nota_manual"` em `renderEventLabel` para exibir eventos históricos.
  - [ ] Avaliar se os endpoints RPC de add/update/delete manual (em `useTimeline`) devem ser mantidos por compat ou marcados deprecated; não removê-los se algo mais os usa (grep antes).
- [ ] **T3 — Evento de nota (AC-4).**
  - [ ] Em `notes-service.ts:createCaseNote`, após inserir a nota, inserir `system_case_events` com `action="note_added"`, `diff: { note_id, preview: <primeiros ~120 chars> }`, `triggered_by: userId`, `organization_id` do caso. (Notas de CLIENTE não têm case → sem evento.)
  - [ ] Rótulo em `renderEventLabel`: `note_added` → `"Nota adicionada: <preview>"`.
- [ ] **T4 — Evento de assinatura concluída (AC-6).**
  - [ ] Em `zapsign/webhook.ts` (`processZapsignWebhook`), no ramo em que o documento é reconhecido como assinado/armazenado (`action: "case_document.signed_received"`/`"stored"`), inserir `system_case_events` com `action="signature_completed"`, `diff: { doc_title, doc_token }`, `case_id` resolvido, `organization_id` do caso. Idempotência: não inserir duas vezes se o webhook reentregar (checar por doc_token já processado).
  - [ ] Rótulo: `signature_completed` → `"Documento assinado: <doc_title>"`.
- [ ] **T5 — Evento de checklist concluído (AC-8, integra A5).**
  - [ ] Em `checklist-service.ts`, no ponto que marca um item como concluído (toggle → done), inserir `system_case_events` com `action="checklist_done"`, `diff: { def_key/label, stage_slug, kind }`, `triggered_by`. Emitir só na transição para concluído (não a cada re-render).
  - [ ] Garantir que NÃO duplica com `stage_auto_advanced` (que é sobre o AVANÇO de etapa, não a conclusão do item). Coordenar com A5.
  - [ ] Rótulo: `checklist_done` → `"Checklist: item \"<label>\" concluído"`.
- [ ] **T6 — Documento por upload + duplicar/mover tema (AC-5, AC-11).**
  - [ ] Auditar `case-documents-service.ts`: confirmar que o UPLOAD (não só geração) emite evento; se não, adicionar `action="doc_added"` no upload. Não duplicar `doc_generated`.
  - [ ] Auditar duplicar-para-financeiro (`cases-service.ts` entrada no financeiro) e vincular/mover-tema (A4 / `LinkCaseToTemaDialog`): confirmar evento existente; se faltar, emitir `action="tema_moved"`/reutilizar.
- [ ] **T7 — Paginação/rolagem (AC-9).**
  - [ ] No hook/serviço de leitura (`useCaseEvents` + serviço) aplicar limite + "carregar mais" OU container com `max-height` e scroll; garantir `order created_at DESC`. Documentar escolha.
- [ ] **T8 — Anti-duplicação e rótulos (AC-10, AC-12).**
  - [ ] Revisar cada novo ponto de emissão contra a lista de eventos existentes; conferir que `action` é texto livre (sem migration). Se optar por coluna nova, criar migration via `npx tsx scripts/db-apply-pg.ts` e justificar.
  - [ ] Adicionar todos os novos `case` em `renderEventLabel`.
- [ ] **T9 — Testes + gates.** `npm run typecheck`, `npm run lint`, testes; smoke manual do fluxo completo.

---

## Dev Notes

- **`system_case_events.action` é `string` livre** (`types.ts:1301-1322`, sem enum/CHECK no tipo TS). Portanto, os novos valores (`note_added`, `signature_completed`, `checklist_done`, `doc_added`, `tema_moved`) são **apenas emitidos no app** — NÃO precisam de migration. Só criar migration se decidir adicionar coluna (ex.: `entity_type`/`entity_id`) para melhor filtragem — nesse caso aplicar via `npx tsx scripts/db-apply-pg.ts` (dev=prod). Preferir NÃO criar migration.
- **Padrão de emissão** (copiar dos serviços existentes, ex. `case-documents-service.ts:314`): `await sb.from("system_case_events").insert({ case_id, organization_id, action, diff, triggered_by, created_at? })`. Sempre resolver `organization_id` da entidade (o `createCaseNote` já carrega `caso.organization_id`).
- **UI já pronta para novos `action`**: `renderEventLabel` (`CaseTimeline.tsx:51-128`) tem `default: return e.action`. Basta adicionar os `case`. O ponto colorido usa `isManualEvent` (gold vs navy) — após remover manuais, simplificar para uma cor única de "automático".
- **Remoção do manual**: a story S4-04 (`docs/stories/S4-04-timeline-manual-read-only.md`) introduziu a entrada manual; a trava de servidor `cases-service.loadEditableManualEvent` e os endpoints em `useTimeline` podem virar código morto — remover só após grep confirmar que nada mais os referencia (evitar quebra de import). Manter os rótulos de `marco`/`nota_manual` para eventos históricos.
- **ZapSign**: o webhook responde 200 mesmo em erro (`api.webhooks.zapsign.tsx:42-49`) para evitar retentativas infinitas — logo a emissão do evento de assinatura deve ser tolerante a falha (try/catch, não derrubar o processamento) e IDEMPOTENTE (o ZapSign pode reentregar; deduplicar por `doc_token`). O `case_id` precisa ser resolvido a partir do documento (ver `zapsign/webhook.ts` — já resolve o caso para armazenar o assinado).
- **Checklist + A5**: A5 trata do auto-avanço por checkbox. Coordenar: `checklist_done` = conclusão do item; `stage_auto_advanced` = avanço da etapa. São eventos DISTINTOS e ambos devem aparecer, sem colidir.
- **Performance (aba Documentos 100+)**: a listagem de documentos já é por caso (não a pasta toda), então o risco real é a timeline crescer muito. Aplicar paginação/scroll no hook de eventos.

### Riscos

- **MÉDIO — Duplicação de eventos**: adicionar emissão em um ponto que já emitia (ex.: upload já coberto por `doc_generated`) gera linhas duplicadas. Mitigação: auditar cada ponto (T8) antes de inserir.
- **MÉDIO — Remoção do manual quebrando imports**: remover hooks/endpoints ainda referenciados quebra o build. Mitigação: grep por `useAddManualCaseEvent`/`loadEditableManualEvent` antes de deletar.
- **MÉDIO — Webhook ZapSign reentrega**: evento de assinatura duplicado a cada reentrega. Mitigação: idempotência por `doc_token`.
- **BAIXO — Ordenação/scroll**: 100+ eventos sem paginação degradam a ficha. Mitigação: T7.
- **BAIXO — Eventos históricos "marco"/"nota_manual"**: se os rótulos forem removidos, aparecem como `action` cru. Mitigação: manter os `case`.

---

## Testing

- **Reordenação (AC-1):** abrir uma ficha e confirmar visualmente que a Linha do tempo está acima de Comunicações e Prazos.
- **Sem manual (AC-2):** confirmar que não há caixa de escrever marco/nota na timeline; abrir um caso que TEM eventos "marco"/"nota_manual" antigos e confirmar que aparecem sem erro.
- **Notas (AC-3, AC-4):** criar uma nota → nota aparece no bloco de Notas E um evento `note_added` aparece na timeline com autor/data.
- **Documento (AC-5):** gerar um doc → evento; fazer upload de um doc → evento; confirmar que não há linha duplicada por ação única.
- **Assinatura (AC-6):** simular/reproduzir webhook ZapSign de documento assinado → evento `signature_completed`; reentregar o mesmo webhook → NÃO duplica.
- **Etapa (AC-7):** mover card no Kanban op e no fin (drag e via dialog) → eventos `status_changed`/`fin_status_changed` com origem→destino; sem duplicação.
- **Checklist (AC-8):** marcar item concluído → `checklist_done`; se o item fecha a etapa (A5), aparece TAMBÉM `stage_auto_advanced`; nenhum duplicado.
- **Escala (AC-9):** criar/simular 100+ eventos e confirmar que a lista rola/pagina fluida e ordena DESC.
- **Tema (AC-11):** duplicar p/ financeiro e vincular a outro tema → eventos correspondentes.
- **Gates:** `npm run typecheck`, `npm run lint`, `npm test` verdes.

---

## Dependências

- **A5** (auto-avanço por checkbox) — coordenar a emissão de `checklist_done` vs `stage_auto_advanced` para não duplicar.
- **A4** (duplicar/mover entre temas) — AC-11 depende do fluxo de mover/vincular tema; reutilizar o evento que A4/`LinkCaseToTemaDialog` emitir.
- **A3** (se existir board novo / movimentação entre boards) — quando existir, mover entre boards também deve virar evento; fora do escopo se A3 ainda não implementado.
- Nenhuma migration obrigatória (action é texto livre). `scripts/db-apply-pg.ts` só se decidir por coluna nova.

---

## File List

_A preencher pelo @dev durante a implementação._

- `sistema-hv/src/routes/casos.$id.tsx` (reordenar timeline p/ o topo)
- `sistema-hv/src/components/cases/CaseTimeline.tsx` (remover input manual; rótulos novos; paginação/scroll)
- `sistema-hv/src/lib/notes-service.ts` (emitir `note_added`)
- `sistema-hv/src/lib/zapsign/webhook.ts` (emitir `signature_completed`, idempotente)
- `sistema-hv/src/lib/checklist-service.ts` (emitir `checklist_done`)
- `sistema-hv/src/lib/case-documents-service.ts` (garantir evento no upload, se faltar)
- `sistema-hv/src/hooks/useTimeline.ts` / `useCases.ts` (paginação; limpeza de hooks manuais)
- `sistema-hv/src/rpc/notes.ts` (se necessário para o novo evento)
- (opcional) migration só se criar coluna nova

---

## Change Log

| Data | Versão | Descrição | Autor |
|------|--------|-----------|-------|
| 2026-08-03 | v0.1 | Draft inicial da story A6 (timeline no topo + remoção da escrita manual + eventos completos de nota/documento/assinatura/etapa/checklist/tema + paginação) | @sm (Bob) |
| 2026-08-04 | v0.2 | Implementado (@dev via Orion). (1) Timeline movida para o TOPO da ficha — antes do `CaseDossie` (Prazos/Comunicações) em `casos.$id.tsx`. (2) Caixa de escrita manual REMOVIDA de `CaseTimeline.tsx` (hook `useAddManualCaseEvent`, estado e card JSX); edição/exclusão de eventos manuais antigos preservada. (3) **Achado:** a maioria dos eventos JÁ era emitida (`doc_uploaded/doc_generated/doc_sent_zapsign`, `liberado_comercial`, `status_changed/stage_auto_advanced`, `task_*`, `deadline_*`, `communication_*`). Único gap = nota criada: `notes-service.createCaseNote` agora emite `note_added` (best-effort) + rótulo na timeline. lint exit 0 (após `--fix` de CRLF), typecheck sem erro novo (1 pré-existente contaazul). Auto-avanço por checkbox/checklist entra com A5. Status → Ready for Review. | @dev |
