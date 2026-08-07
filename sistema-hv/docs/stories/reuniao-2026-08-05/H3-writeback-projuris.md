# H3 — Write-back ao ProJuris (efetivar atribuição da tarefa/responsável)

- **Épico:** Reunião 2026-08-05 — Motor de Distribuição (gaps ProJuris)
- **Risco:** ALTO (escrita externa, irreversível)
- **Status:** Ready for Review
- **Depende de:** H2 (tela de aprovação / tabela satélite `system_distribution_approvals`)

## Contexto

O motor v1.0 já roda e grava `system_distribution_results` (imutável) apenas em
**simulação** (`writeback_pending=true` / batch_log `is_simulation=true`). Nada é
escrito no ProJuris. Esta story fecha o gap de **write-back = 0%**: gravar no
ProJuris a atribuição de responsável/tarefa que o motor calculou e um humano
aprovou.

A escrita **consome o portão da H2**: só resultados com aprovação
`status='approved'` na tabela satélite ficam elegíveis. Bloqueados,
não-aprovados e rejeitados nunca entram.

## Acceptance Criteria

- [x] **AC-1** Método de escrita ISOLADO no client ProJuris (`projurisPut`), separado
  do GET/POST-de-consulta. Endpoints reais (A9): `PUT
  /v2/tarefa/adicionar-responsavel-em-lote` (add) e `PUT
  /v2/tarefa/substituir-responsavel-em-lote` (replace).
- [x] **AC-2** Rotina `writeback.ts` **DRY-RUN POR PADRÃO**: sem flag de confirmação
  explícito NÃO há PUT no ProJuris — só monta o plano e registra tentativas
  `pending`.
- [x] **AC-3** Dependência dura de H2: só `status='approved'` é elegível
  (`system_distribution_approvals`). Override manual de executor (H2) tem
  precedência sobre o executor do motor.
- [x] **AC-4** Idempotente / retomável via `system_distribution_writeback_log`:
  result com log `success` é pulado; `pending`/`failed` são re-tentados; sucesso
  zera `writeback_pending` no result.
- [x] **AC-5** Alerta `ALT-SYNC-001` (código REAL do catálogo, warning + retry
  pendente) em falha de escrita ou executor sem mapeamento. Falha de 1 item não
  derruba o batch.
- [x] **AC-6** Confirmação humana obrigatória antes do 1º batch efetivo (R1
  irreversível): server fn exige `confirm:true` + `confirmText` igual à data; UI
  exige digitar a data.
- [x] **AC-7** Gate de permissão `requireModule("controladoria","edit")` em ambas as
  server functions.

## Tasks

- [x] Adicionar método de escrita isolado `projurisPut` + rotas de write-back no
  `src/lib/projuris/client.ts`.
- [x] Criar `src/lib/distribuicao/writeback.ts` (dry-run default, portão H2,
  idempotência via writeback_log, ALT-SYNC-001).
- [x] Criar `src/rpc/distribuicao-writeback.ts` (`previewWritebackFn` dry-run +
  `efetivarWritebackFn` com confirmação).
- [x] Hooks `usePreviewWriteback` / `useEfetivarWriteback` em
  `src/hooks/useDistribuicao.ts`.
- [x] UI: botão "Write-back ProJuris" + diálogo (preview + confirmação por data)
  em `src/routes/controladoria.distribuicao.lista.tsx`.
- [x] Gates: `typecheck` + `eslint` nos arquivos tocados.

## Notas de implementação / pendências

- **Segunda trava de infra:** mesmo com `confirm:true`, o PUT real só dispara se
  `PROJURIS_WRITEBACK_ENABLED === '1'` no ambiente. Sem a env, a rotina se comporta
  como dry-run (registra `pending`). Isso protege o ProJuris de teste/produção
  contra escrita acidental **até o owner validar o endpoint** e habilitar a env.
- **`responsavel_atual` no result:** o `sync-core` hoje não persiste o responsável
  anterior no `raw_data`, então toda operação cai em `add` (não-destrutivo). Quando
  o sync passar a gravar `raw_data.responsavel_atual`, o `replace` passa a ser
  escolhido automaticamente. Sem regressão.
- **Sem migration:** `system_distribution_writeback_log` já existe (schema v1.0) e
  os types já estão em `types.ts`.

## Change Log

| Data       | Versão | Descrição | Autor |
|------------|--------|-----------|-------|
| 2026-08-05 | v0.1   | Story criada (recorte H3 da reunião 2026-08-05). | @sm |
| 2026-08-05 | v0.2   | Implementado (@dev via Orion). Método de escrita isolado `projurisPut` + rotas (`v2/tarefa/{adicionar,substituir}-responsavel-em-lote`) em `client.ts`; núcleo `writeback.ts` (dry-run default, portão H2 `approved`, idempotência/retomada via `system_distribution_writeback_log`, override de executor, ALT-SYNC-001); RPC `distribuicao-writeback.ts` (preview dry-run + efetivar com `confirm:true`+`confirmText`==data); hooks + UI (botão + diálogo com preview e confirmação por digitação da data) em `lista.tsx`/`useDistribuicao.ts`. **Atrás do flag de confirmação:** o PUT real fica atrás de `confirm:true` (server) + digitação da data (UI) + `PROJURIS_WRITEBACK_ENABLED='1'` (infra, 2ª trava — validação do endpoint com o owner pendente). Sem migration. Gates: typecheck OK, eslint OK nos arquivos tocados. | @dev |
