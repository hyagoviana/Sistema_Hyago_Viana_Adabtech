# Story R2-10: "Documento de caso" gera um CASO próprio (documento = caso)

- **Épico:** R2 — Camada TEMA→CASO→TIPO
- **ID:** R2-10
- **Status:** Ready for Review (implementado + QA aprovado)
- **Estimativa:** L/XL (mexe em criação de caso + geração de doc + navegação; toca financeiro/ciclo de vida)
- **Executor:** @dev + @data-engineer (se migration) · Quality gate: @qa
- **Origem:** Testes do owner 2026-07-22 — decisão confirmada.

---

## Decisão travada (owner 2026-07-22)

> **Cada documento gerado pela opção "Documento de caso" É UM CASO próprio**, independente
> (card no funil, filtros e financeiro separados). **Procuração / "Contrato e procuração"
> NÃO é caso** — é o documento de assinatura do caso.

## Comportamento atual (o que está errado p/ o owner)

- "Gerar documento → Documento de caso" (na ficha e na aba Documentos) **anexa** o doc ao caso
  ATUAL. Ex.: cliente Thiago tem 1 caso (0123) com 4 docs (Declaração/Requerimento/…) — o owner
  esperava 4 casos. Só há 2 casos no banco (0122 lead, 0123 cliente).

## Comportamento desejado

1. Ao gerar um **"Documento de caso"** a partir de um caso existente (ficha "Enviar contrato e
   procuração" com modo Documento de caso, ou aba Documentos "Gerar documento" → Documento de
   caso): **criar um NOVO caso** (clonando `client_id`, `tema_id`, `frente_slug` do caso de
   origem; `caso_pasta_nome`/`caso_pasta_drive_id` da pasta escolhida), e **gerar o documento no
   NOVO caso**. Abrir o editor do Word do novo caso; ao concluir, o pop-up de filtros é do NOVO
   caso; **navegar** para o novo caso.
2. **Procuração / Contrato e procuração** (modo procuração) → continua no caso atual (NÃO cria caso).
3. **"Novo caso"** (ClientCasesSection) já cria o caso — o 1º Documento de caso desse fluxo é o
   doc DESSE caso (NÃO criar outro). Ou seja: o flag "criar novo caso ao gerar" é FALSE só nesse
   fluxo; TRUE na ficha e na aba Documentos.

## Design de implementação (proposto)

- **Serviço/RPC combinado** `gerarDocumentoComoNovoCaso(sourceCaseId, templateId, title, values,
  casoPastaNome, casoPastaDriveId?)`:
  1. Carrega o caso de origem (`client_id`, `tema_id`, `frente_slug`, `organization_id`).
  2. `createCase({ client_id, tema_id, caso_pasta_nome, caso_pasta_drive_id, frente_slug })` →
     novo caso (lifecycle default LEAD; sem `aguardando_assinatura_at` — S1-02). Reusa toda a
     lógica de `createCase` (código, etapas, pastas Drive).
  3. `generateCaseDocumentFromTemplate({ caseId: novoCaso.id, templateId, values, docKind:
     'contrato', title })`.
  4. Retorna `{ caseId: novoCaso.id, doc }`.
- **UI** `GenerateCaseDocumentFlow` + `CaseDocumentsTab`: prop `casoCriaNovoCaso` (default false).
  Quando `mode === 'caso'` && `casoCriaNovoCaso` → chama a RPC combinada; senão gera normal. Após
  gerar como novo caso: abre editor do novo doc; `editorDocId`/pop-up de filtros usam o novo
  `caseId`; navega para `/casos/{novoId}` ao fechar o editor.
- **Entrypoints:** ficha ("Enviar contrato e procuração") e aba Documentos ("Gerar documento") →
  `casoCriaNovoCaso=true`. `ClientCasesSection` ("Novo caso") → `false`.

## Riscos / pontos de atenção

- **Financeiro:** cada novo caso nasce sem parcelas/termo (correto — financeiro próprio). Não
  duplicar cobranças do caso de origem.
- **Ciclo de vida:** novo caso nasce LEAD; entra em operacional/financeiro pelo fluxo normal
  (assinatura → promoção). Com a mudança do Kanban (R2-09) que mostra todos os casos, o novo card
  aparece imediatamente.
- **Numeração:** `nextCaseCode` já gera código novo por tema.
- **NÃO quebrar** os fluxos "Novo caso" e "Enviar procuração" (modo procuração fica no caso atual).
- **Navegação:** ao criar o novo caso, redirecionar o usuário para ele (senão fica confuso).
- **Visibilidade/RBAC:** novo caso herda created_by do usuário; gate de escrita `requireManage`.

## Acceptance Criteria

1. Gerar "Documento de caso" a partir de um caso existente cria um NOVO caso (mesmo cliente/tema),
   com o doc nele; o card aparece no funil do tema; navega para o novo caso.
2. Gerar "Procuração"/"Contrato e procuração" NÃO cria caso (fica no atual).
3. "Novo caso" continua criando 1 caso (o 1º doc de caso é dele, sem duplicar).
4. Pop-up de filtros pós-Word e financeiro do novo caso são independentes (em branco).
5. Sem regressão nos fluxos existentes; typecheck/eslint/test:rbac verdes; QA aprova.

## File List

- `sistema-hv/src/lib/case-documents-service.ts` (`generateDocumentAsNewCase`)
- `sistema-hv/src/rpc/case-documents.ts` (`generateDocumentAsNewCaseFn`)
- `sistema-hv/src/hooks/useCaseDocuments.ts` (`useGenerateDocumentAsNewCase`)
- `sistema-hv/src/components/cases/GenerateCaseDocumentFlow.tsx` (prop `casoCriaNovoCaso` + bifurcação + navegação)
- `sistema-hv/src/routes/casos.$id.tsx` (liga `casoCriaNovoCaso` na ficha)
- `sistema-hv/src/components/cases/CaseDocumentsTab.tsx` (bifurcação + `activeCaseId` + navegação sem corrida)

## QA Results

**QA (Quinn):** APROVADO-COM-RESSALVAS → ressalva corrigida.
- AC-1..AC-5: PASS. Regra central (documento de caso = caso; procuração fica no caso; "Novo caso" não duplica) correta; máquina de navegação sem corrida sólida (4 caminhos → navega 1×).
- **BUG-1 (MAJOR) — CORRIGIDO:** `GenerateDialog` da aba Documentos tinha `pending={generate.isPending}` sem `|| genAsNewCase.isPending` → double-click podia criar 2 casos. Corrigido.
- BUG-2 (MINOR, aceito): finalize/sendZap invalidam cache do caseId de origem, não do novo — sem bug visível (navega pro novo, refetch fresco).
- Novo caso nasce LEAD sem disparar procuração/comercial/aguardando-assinatura; RBAC via `requireAnyModule(edit)`.

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-22 | 0.1 | Draft — decisão "Documento de caso = caso" confirmada pelo owner. | @sm (via Orion) |
| 2026-07-22 | 1.0 | Implementado (@dev): RPC combinada `generateDocumentAsNewCase` + wiring na ficha e aba Documentos + navegação. QA aprovado; BUG-1 corrigido. typecheck/eslint/test:rbac verdes. Status → Ready for Review. | @dev + @qa (via Orion) |
