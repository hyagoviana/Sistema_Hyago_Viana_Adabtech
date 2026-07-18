# R2-02 — Construção manual de temas + vincular caso a tema + pasta do tema no Drive

Contexto: **Opção 1** do design R2-03 — cada **TEMA** tem um `system_service_type`
**INTERNO espelho 1:1** (o "motor"), resolvido por `getTemaServiceType(temaId)`.
Casos rodam por `service_type_id` (derivado de `case_type`/slug via trigger
`system_fn_sync_stage_ids`). `tema_id`/`frente_slug` são **aditivos** (dual-write vivo).

## 1. Temas fictícios via seed

Script idempotente `scripts/seed-temas-manuais.ts` cria `Tema 1..N` chamando
`createTema` (que já semeia o service_type interno + pipeline op/fin/comercial e
vincula `service_type.tema_id = tema.id`). Uso:

```
npx tsx scripts/seed-temas-manuais.ts 5
```

Pula nomes já existentes. Os temas são editáveis depois na UI (Temas → editar).

## 2. Vincular um CASO EXISTENTE a um TEMA (capacidade principal)

### Serviço — `moverCasoParaTema(caseId, temaId, frenteSlug?, triggeredBy?)` (`src/lib/cases-service.ts`)

1. Resolve o service_type interno do tema (`system_service_types.tema_id = temaId`,
   ativo). Sem service_type → **422** legível ("Tema sem pipeline configurada…").
2. Reatribui (nunca apaga) no caso:
   - `case_type` = **slug** do service_type interno (o trigger reprojeta
     `service_type_id`/`stage_op_id` a partir daí — trigger **intocado**);
   - `tema_id` = temaId; `frente_slug` = frenteSlug ?? null.
3. **macrostatus_op (evita órfão de etapa):** verifica se o slug atual existe em
   `system_pipeline_stages (service_type_id=interno, kind='op', deleted_at IS NULL)`.
   - **Existe** → mantém (preserva o progresso).
   - **Não existe** → reseta para a **1ª etapa op** (menor `ordem`).
4. **macrostatus_fin:** só reprojeta se o caso já **bifurcou** (`<> NAO_APLICAVEL`);
   se a etapa fin atual não existir na nova pipeline, reseta p/ a 1ª etapa fin. Se
   `NAO_APLICAVEL`, **deixa como está** (o caso não está no financeiro).
5. Grava evento `system_case_events` com `action='vinculado_a_tema'` (diff registra
   from/to de case_type e macrostatus_op + flags `op_resetado`/`fin_resetado`).

Retorna `{ case, opResetado, finResetado }`.

### RPC + hook

- `moverCasoParaTemaFn` (`src/rpc/cases.ts`) — gate **casos.manage** via
  `handleManage` (`requireModule("operacional","edit")`). Zod:
  `{ id, temaId, frenteSlug? }`.
- `useMoverCasoParaTema` (`src/hooks/useCases.ts`) — invalida caso
  (detalhe/listas/eventos) para refletir a nova pipeline/etapa.

### UI — `LinkCaseToTemaDialog` (`src/components/cases/LinkCaseToTemaDialog.tsx`)

Botão **"Vincular a um tema"** no topo da ficha (`casos.$id.tsx`), gate-ado por
`podeGerirCaso` (`can(role,"casos.manage")`). Abre um diálogo: seleciona **TEMA**
(`useTemas`) → **FRENTE opcional** (`useFrentes` do tema) → confirma. Mostra aviso
de que **a etapa pode ser reiniciada** se não houver equivalente; o toast avisa
quando `opResetado`.

## 3. Pasta do TEMA no Drive (capacidade 2)

No editor de tema (`TemasManagerDialog.tsx` → `FrentesEditor`), subcomponente
`TemaDriveFolder`: botão **"Criar pasta do tema"** que chama `useCreateTypeFolder`
→ `createAndLinkFolder` (`service-type-folders-service.ts`) com `kind='caso'` e
`frenteSlug=null` (pasta do **tema todo**, distinta das pastas por frente do
`CategoryFoldersEditor`). Lista as pastas comuns já vinculadas (frente NULL) com
link para abrir no Drive. Reusa a infra existente — sem duplicação.

## 4. Dual-write vivo + trigger intocado

- `case_type`/`macrostatus_op`/`macrostatus_fin` **nunca** são apagados — só
  reatribuídos. `tema_id`/`frente_slug` são aditivos.
- O trigger `system_fn_sync_stage_ids` e a view `system_cases_active` **não** foram
  tocados. A projeção de `service_type_id`/`stage_op_id` continua derivando de
  `case_type`/`macrostatus_op`.

## 5. Validação

- **Sem migration** (usa colunas/tabelas existentes: `system_cases.tema_id`,
  `frente_slug`, `system_service_types.tema_id`, `system_pipeline_stages`,
  `system_service_type_folders`).
- `npm run typecheck`: **zero erros novos** nos arquivos tocados (os erros
  remanescentes são pré-existentes — `types.ts` desatualizado vs. banco:
  `system_case_checklist_item_assignees`, `service_type_id` nullable, etc.).
- `npm run test:rbac`: **verde**.
- `npx eslint` nos arquivos tocados: **limpo**; `prettier --write` (LF) aplicado.
