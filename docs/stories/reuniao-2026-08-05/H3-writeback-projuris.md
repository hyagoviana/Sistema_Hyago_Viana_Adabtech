# Story H3: Writeback ao ProJuris (gravar a atribuição da tarefa/responsável)

**Épico:** ProJuris / Distribuição — Reunião 2026-08-05
**ID:** H3
**Status:** Draft
**Estimativa:** XL
**Executor sugerido:** @architect + @dev + @data-engineer · Quality gate: @qa + @architect
**Risco:** **ALTO** — **ESCRITA EM PRODUÇÃO EXTERNA (ProJuris real).** Efetivar atribuição/responsável no ProJuris é irreversível pela API. Exige dry-run obrigatório + confirmação humana (H2) antes do 1º batch efetivo.

---

> **NOTA DE ESCOPO:** O **motor v1.0 JÁ EXISTE** e roda hoje **só como SIMULAÇÃO** (`sync-core.ts` grava `system_distribution_results` com `writeback_pending=true`, `batch_logs.is_simulation=true`, e **ZERO escrita no ProJuris** — comentário explícito no arquivo: "REGRA CRÍTICA: ZERO writeback ao ProJuris"). Esta story **NÃO reconstrói o motor** — ela **liga a ponta de escrita** (do estado atual `writeback_pending=true` → efetivação no ProJuris), respeitando o portão de aprovação (H2). O design do writeback **já está pronto** (flag, tabela de log, alerta) — falta implementar.

---

## Story

**Como** controladoria/gestor,
**quero** que, **após a aprovação** (H2), o sistema **efetive** a atribuição da tarefa/responsável **no ProJuris** — registrando cada tentativa (status/erro) de forma idempotente e retomável —,
**para** que a distribuição deixe de ser apenas simulação e a agenda real do ProJuris reflita quem ficou com cada prazo (era exatamente o gap da reunião: "rodou como simulador, não gerou tarefa real").

> **Pré-condição dura:** writeback SÓ dispara para tarefas **aprovadas em H2**. Sem H2 aprovado, nada é escrito no ProJuris.

---

## Contexto / o que JÁ EXISTE vs NOVO

### JÁ EXISTE (reusar — NÃO reconstruir)

- **Design do writeback (0% implementado, mas modelado):**
  - Flag `system_distribution_results.writeback_pending` (BOOLEAN) — o `runSync` já grava `true` nas distribuídas; é a **única** coluna que o trigger de imutabilidade permite atualizar por UPDATE.
  - Tabela `system_distribution_writeback_log` (migration `20260728000001`): `distribution_result_id` (FK), `task_id`, `executor_id` (UUID → `system_users`), **`projuris_responsavel_id` TEXT**, `error`, `attempt` INTEGER (default 1), `status` enum `writeback_status` (`pending`/`success`/`failed`), `created_at`. Índice parcial `idx_dist_writeback_status WHERE status='pending'` (fila de retry).
  - Alerta `ALT-SYNC-001` no catálogo (`sistema-hv/src/lib/distribuicao/engine/alerts.ts`): *"Write-back de responsavel no Projuris falhou (retry pendente)"* (warning, não-blocking). (Nota: o levantamento chama de `ALT-RESP-005`; o código real é `ALT-SYNC-001` — usar o do código.)
- **Cliente ProJuris:** `sistema-hv/src/lib/projuris/client.ts` — auth OAuth2/Keycloak (token 8h) + `projurisGet` (leitura) + `projurisPostConsulta` (POST de CONSULTA = leitura). **NÃO tem método de escrita** — o comentário do client é enfático que `projurisPostConsulta` NÃO deve ser usado para escrita. Escrita = método novo.
- **Endpoints de ESCRITA descobertos no A9 (a confirmar o correto):** o A9 listou como "endpoints que GRAVAM (não usar na fase de leitura)": `/v2/intimacao/novas-tarefas-em-lote`, `/v2/intimacao/cadastro`, `/v2/intimacao/arquivar`, `/intimacao/{cod}/vincular/processo/{cod}`, `/v2/intimacao/remover*`. **⚠ Qual deles ATRIBUI responsável/tarefa (o objetivo de H3) precisa ser confirmado** — provavelmente `novas-tarefas-em-lote` (cria a tarefa já com responsável) ou um endpoint de tarefa/responsável do módulo `/processo/{cod}/tarefa`. É um BLOQUEIO de design (T0).
- **Executor → código ProJuris:** o `projuris_responsavel_id` (código ProJuris, ex.: THIAGO=`128858`) vem de `system_projuris_executor_mapping` (ver H5) — necessário para dizer ao ProJuris **para quem** atribuir.
- **Núcleo do batch:** `sistema-hv/src/lib/distribuicao/sync-core.ts` (`runSync`) — hoje termina em "grava results + batch_log, ZERO writeback". H3 adiciona uma **fase pós-aprovação** separada (não dentro do `runSync` de leitura).
- **RPC/cron:** `sincronizarDistribuicaoFn` (`src/rpc/distribuicao.ts`) e `api.cron.distribuicao.tsx` — o writeback é um **passo distinto** (não roda no mesmo disparo da leitura; roda após aprovação).
- **H2 (esta rodada):** portão de aprovação — H3 consome "tarefas aprovadas da data".

### NOVO (a construir nesta story)

- **Método de escrita no client** (`projurisPost`/`projurisPut` server-only) — separado e explicitamente marcado como ESCRITA, usado só por H3.
- **Rotina de efetivação (writeback):** para cada `result` **aprovado** com `writeback_pending=true`, chamar o endpoint de escrita do ProJuris atribuindo a tarefa ao `projuris_responsavel_id`; em sucesso → `writeback_log.status='success'` + `results.writeback_pending=false`; em falha → `status='failed'` + `error` + incrementa `attempt` + emite `ALT-SYNC-001`.
- **Idempotência/retomada:** a fila é o índice `status='pending'`; reprocessar não duplica atribuição (guardar marca de idempotência / checar se já escrito).
- **Dry-run obrigatório:** modo simulação do writeback (não chama a API de escrita; só mostra o que SERIA feito) antes do 1º batch real; flag de "produção" explícita.

---

## Acceptance Criteria

1. **Método de escrita isolado no client:** `client.ts` ganha um método de ESCRITA server-only (ex.: `projurisWrite(method, path, body)`), documentado como o **único** ponto de escrita, distinto de `projurisGet`/`projurisPostConsulta` (que continuam só-leitura). Nunca importado no bundle do browser.

2. **Endpoint de atribuição confirmado:** o endpoint ProJuris que **atribui responsável/cria a tarefa** está confirmado (T0) e documentado (contrato do corpo). H3 usa exatamente esse — não um endpoint de consulta.

3. **Writeback só de tarefas aprovadas (H2):** a rotina de efetivação processa **apenas** resultados `approved` em H2 **e** `writeback_pending=true`. Tarefas não-aprovadas/rejeitadas/blocked NUNCA são escritas no ProJuris.

4. **Dry-run obrigatório antes de produção:** existe um modo `dry_run` que percorre a mesma seleção e **loga o que SERIA escrito** (executor→`projuris_responsavel_id`, tarefa, processo) **sem chamar a API de escrita**. O 1º batch real exige confirmação humana explícita e uma flag de produção; o dry-run é o default.

5. **Registro por tentativa:** cada efetivação grava/atualiza uma linha em `system_distribution_writeback_log` com `distribution_result_id`, `task_id`, `executor_id`, `projuris_responsavel_id`, `attempt`, `status` (`pending`→`success`/`failed`), `error` (quando falha). Em sucesso, `system_distribution_results.writeback_pending` vira `false` (único UPDATE permitido pelo trigger).

6. **Idempotente / retomável:** re-rodar a rotina **não** cria atribuição duplicada no ProJuris — resultados já com `status='success'`/`writeback_pending=false` são pulados; só os `pending`/`failed` são (re)tentados. Um hit de erro no meio do batch não corrompe o restante (fila por índice `status='pending'`).

7. **Retry com teto + alerta:** falhas incrementam `attempt` até um teto; ao falhar, emite `ALT-SYNC-001` (warning, não-blocking) e a tarefa fica visível como "writeback pendente" para reprocessamento manual. Rate-limit (429/limite ProJuris) → backoff, sem corromper o log.

8. **Confirmação humana + gate:** disparar o writeback real é gateado por `requireModule("controladoria","edit")` e requer confirmação explícita (não roda automaticamente no cron de leitura). Decisão D1 (ProJuris=fonte / SHV espelha) permanece o default até o piloto validar; H3 é a virada opcional para "SHV escreve".

9. **Regressão / segurança:** `npm run typecheck` + `npm run lint` verdes; nenhum segredo ProJuris em log/repo/front; RLS org-scoped no `writeback_log`; imutabilidade de `results` preservada (só `writeback_pending` muda); `db:types` regenerado se houve DDL.

---

## Tasks / Subtasks

### T0 — Design & confirmação do endpoint (SPIKE — @architect + @data-engineer, antes de codar)
- [ ] **BLOQUEIO:** confirmar (doc ProJuris / probe controlado / Thiago) o endpoint EXATO que atribui responsável/cria tarefa e o contrato do corpo (candidatos: `/v2/intimacao/novas-tarefas-em-lote`, endpoint de tarefa do `/processo/{cod}/tarefa`). Documentar. (AC-2)
- [ ] Definir a marca de idempotência (como saber que uma tarefa/atribuição já foi escrita — ex.: código retornado pela API guardado no `writeback_log`/`raw_data`). (AC-6)
- [ ] Confirmar D1 com o owner: ligar writeback agora (piloto) vs permanecer só-leitura. (AC-8)

### T1 — Método de escrita no client (@dev)
- [ ] `client.ts`: `projurisWrite(method, path, body)` server-only, com auth/token reuso, retry Bearer, e marcação explícita de ESCRITA. Testes de unidade com fetch mockado (sem tocar ProJuris real). (AC-1)

### T2 — Rotina de efetivação (@dev + @architect)
- [ ] Módulo `src/lib/distribuicao/writeback.ts` (server-only): seleciona `results` aprovados (H2) + `writeback_pending=true`; resolve `executor_id → projuris_responsavel_id` (`system_projuris_executor_mapping`); chama `projurisWrite`; grava `writeback_log` + flip `writeback_pending`. Modo `dry_run` (default). (AC-3, AC-4, AC-5, AC-6)
- [ ] Retry com teto + backoff em 429 + `ALT-SYNC-001` em falha. (AC-7)

### T3 — Disparo com gate + confirmação (@dev)
- [ ] Server function `efetivarWritebackFn` em `src/rpc/distribuicao.ts` (gate `requireModule("controladoria","edit")`, exige `confirmProduction:true` para modo real; default dry-run). Botão na tela de aprovação (H2) "Efetivar no ProJuris" com dupla confirmação. (AC-4, AC-8)

### T4 — QA / regressão (@qa + @architect)
- [ ] `typecheck`/`lint` verdes; RLS + imutabilidade; nenhum segredo em log/front. (AC-9)
- [ ] **Dry-run fim-a-fim** (sem escrever no ProJuris): aprovar batch teste → rodar writeback dry-run → conferir "o que SERIA escrito"; forçar falha (mock) → `attempt`/`ALT-SYNC-001`; re-rodar → idempotente (não duplica). Teste real de escrita SÓ com o Thiago, em processo de teste, com confirmação explícita. (AC-3..7)

---

## Dev Notes

- **Escrita é irreversível pela API (R1).** Ordem de segurança obrigatória: **(1)** motor roda → **(2)** H2 aprova → **(3)** H3 dry-run → **(4)** confirmação humana → **(5)** writeback real. O default do sistema permanece D1 (ProJuris=fonte, só-leitura) até o piloto do Thiago validar (registrado no A9).
- **Writeback é passo SEPARADO da leitura.** NÃO acoplar ao `runSync`/cron de leitura (que roda 08:00 BRT e é idempotente por DELETE+INSERT). Se o writeback rodasse dentro do `runSync`, um re-sync poderia reescrever/duplicar no ProJuris. H3 lê o estado aprovado e efetiva sob demanda.
- **A única coluna mutável de `results` é `writeback_pending`** (trigger `system_prevent_distribution_modification`). O flip para `false` no sucesso é permitido; todo o resto do estado de tentativa vive em `system_distribution_writeback_log` (append/update próprio).
- **`projuris_responsavel_id` vem de H5/mapeamento** (ex.: THIAGO=128858, THAISE=204546). Sem esse código, o writeback não sabe para quem atribuir — dependência de H5.
- **Alerta:** o catálogo real usa `ALT-SYNC-001` (não `ALT-RESP-005` do levantamento). Emitir esse código em falha de writeback.
- **Rate-limit ProJuris:** 480 req/min, token 8h (A9). Backoff em 429; token renovado pelo client.
- **Migrations via pg direto** (`reference_aplicar_migrations_pg_direto`): `npx tsx scripts/db-apply-pg.ts <arquivo.sql>`; dev=prod; rollbacks em `sistema-hv/supabase/rollbacks/`. (H3 pode não precisar de DDL nova — `writeback_log` já existe; só se a marca de idempotência exigir coluna extra.)

**Riscos:**
- **R1 — escrita irreversível.** Mitigação: dry-run default + confirmação humana + piloto com Thiago em processo de teste.
- **R2 — endpoint errado/contrato errado.** Escrever no endpoint errado pode criar tarefa/intimação indevida. Mitigação: T0 confirma o endpoint com doc/Thiago; primeiro teste real em processo de teste isolado.
- **R3 — duplicação.** Sem marca de idempotência, re-rodar duplica atribuição. Mitigação: guardar retorno da API + checar `status='success'` antes de reescrever.
- **R4 — vazamento de segredo.** Nunca logar credenciais/token; máscara na config.
- **R5 — `projuris_responsavel_id` ausente** (H5 incompleto): writeback não resolve o destino → bloquear a tarefa com alerta em vez de escrever para o código errado.

---

## Testing

- **Client (unit):** `projurisWrite` com fetch mockado — monta método/path/body/headers corretos; retry Bearer em 401; NÃO chama rede real nos testes.
- **Dry-run:** aprovar batch de teste (H2) → writeback dry-run → lista "o que SERIA escrito" (executor→código, tarefa, processo); NENHUMA chamada de escrita real.
- **Falha/retry:** mock de erro/429 → `writeback_log.status='failed'`, `attempt` incrementado, `ALT-SYNC-001` emitido, backoff aplicado.
- **Idempotência:** re-rodar → `success`/`writeback_pending=false` pulados; só `pending`/`failed` retentados; sem duplicação.
- **Portão H2:** tarefa não-aprovada/rejeitada/blocked → nunca escrita.
- **Real (piloto, manual):** com Thiago, 1 tarefa em processo de teste, confirmação explícita → conferir no ProJuris que a atribuição apareceu; `writeback_pending=false` + `status='success'`.
- **Segurança/regressão:** sem `controladoria:edit` → 403; nenhum segredo em log/front; RLS/imutabilidade preservadas; `typecheck`/`lint` verdes.

---

## Dependências

- **H2 (tela de aprovação)** — **DEPENDÊNCIA DURA:** writeback só efetiva tarefas aprovadas em H2.
- **H5 (ID ProJuris no usuário / `projuris_responsavel_id`)** — necessário para saber PARA QUEM atribuir; sem ele, R5.
- **`system_distribution_writeback_log` + flag `writeback_pending`** (migration `20260728000001`) — JÁ existem; base desta story.
- **Cliente ProJuris** (`client.ts`) + **auth destravada** — JÁ existem (falta só o método de escrita).
- **Contrato do endpoint de escrita do ProJuris** (T0) — **BLOQUEIO** (confirmar com doc/Thiago qual endpoint atribui responsável/tarefa).
- **Decisão D1 do owner** (ligar writeback vs manter só-leitura) — bloqueia a virada para produção.

---

## File List

**A definir na implementação. Previsto:**

**Código (novo/estendido):**
- `sistema-hv/src/lib/projuris/client.ts` — +`projurisWrite` (ESCRITA server-only).
- `sistema-hv/src/lib/distribuicao/writeback.ts` (novo) — rotina de efetivação (dry-run + real), retry, log, flip `writeback_pending`.
- `sistema-hv/src/rpc/distribuicao.ts` — +`efetivarWritebackFn` (gate + confirmação de produção).
- `sistema-hv/src/routes/controladoria.distribuicao.lista.tsx` / `.aprovacao.tsx` (H2) — botão "Efetivar no ProJuris" + dupla confirmação.

**Migrations (só se a marca de idempotência exigir coluna nova):**
- `sistema-hv/supabase/migrations/2026080X_writeback_idempotency.sql` + rollback + `db:types`. (Caso contrário, `system_distribution_writeback_log` já basta.)

---

## Change Log

| Data | Versão | Descrição | Autor |
|------|--------|-----------|-------|
| 2026-08-05 | v0.1 | Draft inicial | @sm (Bob) |
