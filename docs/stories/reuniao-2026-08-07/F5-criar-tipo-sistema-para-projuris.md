# Story F5: Criar tipo de tarefa NO nosso sistema e espelhar (escrever) no ProJuris — v2 do H7

- **Épico:** Futuro (pós-segunda) — Reunião 2026-08-07
- **ID:** F5
- **Status:** **Backlog / Futuro (depende de spike de endpoint de escrita)**
- **Estimativa relativa:** M/L
- **Executor sugerido:** @architect (spike) + @dev + @data-engineer · Quality gate: @qa + @architect
- **Risco:** MÉDIO/ALTO — **escrita em produção externa (ProJuris real):** criar um tipo de tarefa via API é escrita irreversível; depende de existir endpoint de criação de tipo na API ProJuris (a confirmar).
- **Origem:** Reunião 2026-08-07 (bloco FUTURO, **F5**). Transcrição `Matheus Torquato [0601] Opa, Thiago.txt`: *"se deixa criar um tipo de tarefa por fora (pelo sistema) ou é certo criar no ProJuris primeiro e depois vincular?"* Thiago: *"o ideal seria criar dentro do sistema… mas pelo menos de começo é criar no ProJuris."* → **v1 = criar no ProJuris primeiro (caminho atual); v2 (esta story) = criar no sistema e espelhar no ProJuris.**

> ⚠️ **NÃO É PARA ANTES DE SEGUNDA.** É a **v2** de H7. A **v1 já é o caminho atual** e está documentada/decidida no lote 08-05 (H6/H7): criar o tipo **no ProJuris primeiro** e o sync espelha no sistema (de-para por nome). F5 só inverte a origem (criar no sistema → escrever no ProJuris) **quando** houver endpoint de escrita confirmado (spike).

---

## Story

**Como** controladoria/admin do motor de distribuição,
**quero** poder **criar um tipo de tarefa no nosso sistema** e que ele seja **escrito/espelhado automaticamente no ProJuris** (criando/retornando o código ProJuris casável),
**para que** a gestão de tipos passe a ter o nosso sistema como origem (sem depender de abrir o ProJuris para cada tipo novo) — mantendo os dois sistemas sincronizados.

> **DECISÕES TRAVADAS (reunião 2026-08-07):**
> 1. **v1 (atual, NÃO é esta story):** criar o tipo **no ProJuris primeiro**; o sync do sistema espelha por leitura (de-para por nome já casou 39/44 tipos — A9/H6). É o fluxo seguro e vigente.
> 2. **v2 (ESTA story, FUTURO):** criar o tipo **no sistema** e **escrever no ProJuris** — só quando confirmado que a API ProJuris tem endpoint de **criação de tipo de tarefa** (spike). O Thiago: *"o ideal seria criar dentro do sistema, mas de começo é criar no ProJuris."*
> 3. **Casamento por código:** o tipo precisa ter um `projuris_tipo_codigo` real para o motor casar (H1/H6); a criação-no-ProJuris deve retornar/permitir vincular esse código.

---

## Contexto / o que JÁ EXISTE vs NOVO

### JÁ EXISTE (reusar — NÃO reconstruir)

- **Menu de Tipos de Tarefa (fonte da verdade interna):** `sistema-hv/src/routes/controladoria.distribuicao.tipos-tarefa.tsx` (H6, Ready for Review) — CRUD com `projuris_tipo_codigo`, `projuris_tipo_descricao`, `points`, `complexity_level`, `temporal_level`, `prazo_previsto_dias`, `prazo_fatal_dias`, `active`; **botão "Sincronizar tipos do ProJuris"** (v1, só-leitura) via `sincronizarTiposTarefaFn`. Hooks em `sistema-hv/src/hooks/useDistribuicao.ts`.
- **Tabela:** `system_task_type_mapping` (`sistema-hv/supabase/migrations/20260728000001_distribution_schema.sql` + aditivos) — UNIQUE `(projuris_tipo_codigo, organization_id)`.
- **De-para por nome (v1):** `sistema-hv/src/lib/distribuicao/sync-task-types.ts` (`syncTaskTypesCore`, só leitura do ProJuris) + `scripts/reconcile-projuris-tipos.ts` (casa por nome normalizado, idempotente, lista near-miss/colisão).
- **Endpoint de listagem de tipos (leitura):** `GET /tipo?chave-tipo=tarefa-tipo` (52 tipos; envelope `consultaTipoRetorno[0].simpleDto`) — usado pelo sync v1.
- **Método de ESCRITA no client (já existe, isolado):** `sistema-hv/src/lib/projuris/client.ts` → `projurisPut(path, body)` (server-only, único ponto de escrita; hoje usado pelo writeback de responsável H3, rotas `v2/tarefa/*-responsavel-em-lote`). **NÃO há método/rota para criar TIPO** — é o gap de F5 (spike + rota nova).
- **Precedente de escrita controlada:** `sistema-hv/src/lib/distribuicao/writeback.ts` (H3) — molde de escrita externa com dry-run + gate + log/idempotência.

### NOVO (a construir nesta story — FUTURO, condicionado ao spike)

- **Spike (T0):** confirmar na doc REST do ProJuris se existe endpoint de **criação de tipo de tarefa** (ex.: `POST /tipo` / `/tarefa-tipo`) e o contrato do corpo. **Sem endpoint → F5 não é implementável; permanece v1** (criar no ProJuris manual + vincular).
- **Rota de escrita de tipo no client:** se o endpoint existir, adicionar `projurisPost`/reusar `projurisPut` para criar o tipo e capturar o código retornado.
- **Fluxo "criar no sistema → escrever no ProJuris":** ao criar um tipo em `tipos-tarefa.tsx`, opção de "criar também no ProJuris" que escreve e grava o `projuris_tipo_codigo` retornado; com **dry-run** + confirmação (padrão H3) e idempotência (não recriar se já existe código).

---

## Acceptance Criteria (condicionados ao spike T0)

1. **Spike documentado:** a story registra (Dev Notes/Change Log) se a API ProJuris **tem** endpoint de criação de tipo de tarefa e o contrato. Se **não tiver**, F5 fica bloqueada e o caminho oficial permanece **v1** (criar no ProJuris + vincular via "Sincronizar tipos").
2. **(Se houver endpoint) Rota de escrita isolada:** a criação de tipo usa o método de ESCRITA server-only do `client.ts` (reuso/extensão de `projurisPut`), nunca `projurisGet`/`projurisPostConsulta`; server-only, sem segredo no bundle.
3. **(Se houver endpoint) Criar no sistema → espelhar:** criar um tipo em `tipos-tarefa.tsx` com a opção "espelhar no ProJuris" escreve o tipo no ProJuris e grava o `projuris_tipo_codigo` retornado em `system_task_type_mapping` (casável pelo motor).
4. **Dry-run + confirmação (padrão H3):** a escrita real exige confirmação explícita e tem modo dry-run (mostra o que SERIA criado) como default; gate `requireModule("controladoria","edit")`.
5. **Idempotente:** re-disparar não cria tipo duplicado no ProJuris (checar se já há `projuris_tipo_codigo`); a UNIQUE `(projuris_tipo_codigo, org)` é respeitada.
6. **v1 preservada:** o botão "Sincronizar tipos" (leitura + de-para por nome) continua funcionando; criar sem espelhar continua gravando só o registro interno (com aviso de que falta o código casável, como hoje).
7. **Regressão/segurança:** `npm run typecheck`/`lint` verdes; nenhuma escrita no ProJuris exceto a criação explicitamente disparada; nenhum segredo em log/front; RLS org-scoped.

---

## Tasks / Subtasks

### T0 — Spike: ProJuris permite criar tipo via API? (@architect + @data-engineer) — BLOQUEIO
- [ ] Investigar na doc REST se há endpoint de criação de tipo de tarefa + contrato. Registrar. Se não houver → encerrar F5 como bloqueada e manter v1. (AC-1)

### T1 — (Se houver) Rota de escrita no client (@dev)
- [ ] `client.ts`: método/rota de criação de tipo (reuso/extensão de `projurisPut`), server-only, marcado como ESCRITA; testes com fetch mockado. (AC-2)

### T2 — (Se houver) Fluxo criar→espelhar (@dev + @data-engineer)
- [ ] Em `tipos-tarefa.tsx` + `sincronizar*`/novo RPC: opção "espelhar no ProJuris" → escreve, captura o código, grava em `system_task_type_mapping`. Dry-run default + confirmação (padrão H3) + idempotência. (AC-3, AC-4, AC-5)

### T3 — QA (@qa)
- [ ] Dry-run mostra o previsto; escrita real cria 1× (idempotente); v1 (sync leitura) intacta; gate edit; sem segredo em log; `typecheck`/`lint` verdes. (AC-4..7)

---

## Dev Notes

- **v1 já resolve o dia a dia.** Criar no ProJuris primeiro + "Sincronizar tipos" (de-para por nome, 39/44) é o caminho vigente e seguro (H6). F5 é conforto/evolução — inverter a origem — **só** vale a pena se o ProJuris expuser criação de tipo por API.
- **Escrita externa = cautela H3.** Reusar o padrão do `writeback.ts`: método de escrita isolado, dry-run default, confirmação humana, gate `controladoria:edit`, idempotência. Nunca escrever em fluxo de leitura/sync.
- **Código casável é a razão de existir do tipo.** Sem `projuris_tipo_codigo` real, o motor não casa (H1/H6). A criação-no-ProJuris tem que **retornar/vincular** esse código; senão o tipo fica "órfão" e o fluxo v1 (vincular manual) é melhor.
- **Não recriar o menu.** `tipos-tarefa.tsx`, `system_task_type_mapping`, `syncTaskTypesCore` e o de-para por nome já existem (H6). F5 só adiciona a **escrita** de criação de tipo, condicionada ao spike.
- **Alinhado com o Thiago:** ele explicitamente aceitou "de começo, criar no ProJuris" (v1) e vê "criar no sistema" (v2/F5) como o ideal futuro.

**Riscos:**
- **R1 — endpoint inexistente** → F5 não é implementável (fica v1). Confirmar no T0 antes de qualquer código.
- **R2 — escrita irreversível** no ProJuris. Mitigar com dry-run + confirmação + teste em ambiente/tipo de teste.
- **R3 — duplicação de tipo** se sem idempotência. Mitigar checando `projuris_tipo_codigo` existente + UNIQUE.

---

## Testing

- **Spike:** documentar sim/não do endpoint + contrato.
- **(Se sim) Client (unit):** criação de tipo monta método/path/body corretos (fetch mockado, sem rede real).
- **(Se sim) Fluxo:** criar no sistema com "espelhar" → dry-run lista; real cria 1× e grava o código; re-disparo idempotente.
- **v1:** "Sincronizar tipos" (leitura) segue funcionando; criar sem espelhar grava só interno com aviso.
- **Segurança/regressão:** gate edit; sem segredo em log/front; RLS; `typecheck`/`lint` verdes.

## Dependências

- **BLOQUEIO:** spike T0 (endpoint de criação de tipo na API ProJuris).
- **Depende de (entregues):** H6 (menu de tipos-tarefa + `system_task_type_mapping` + de-para por nome + `syncTaskTypesCore`); `client.ts` com `projurisPut` (escrita isolada); padrão H3 (`writeback.ts`) para escrita controlada.
- **Relaciona com H1** (ID→nome) e **H6/H7** (v1 = criar no ProJuris + vincular).

## File List

**A definir na implementação (FUTURO, condicionado ao spike). Previsto:**
- `sistema-hv/src/lib/projuris/client.ts` (método/rota de criação de tipo — ESCRITA server-only; só se o endpoint existir).
- `sistema-hv/src/lib/distribuicao/sync-task-types.ts` / novo módulo de escrita de tipo (criar→vincular código, dry-run, idempotência).
- `sistema-hv/src/rpc/distribuicao.ts` (novo RPC "criar tipo no ProJuris", gate `controladoria:edit`, confirmação).
- `sistema-hv/src/routes/controladoria.distribuicao.tipos-tarefa.tsx` (opção "espelhar no ProJuris" + confirmação).

## Change Log

| Data | Versão | Descrição | Autor |
|------|--------|-----------|-------|
| 2026-08-07 | v0.1 | Draft inicial (FUTURO). v2 do H7: criar tipo de tarefa no nosso sistema e escrever no ProJuris. v1 (criar no ProJuris primeiro + de-para por nome) já é o caminho atual (H6). Depende de spike confirmando endpoint de criação de tipo na API ProJuris; escrita segue o padrão controlado do H3 (dry-run + confirmação + gate + idempotência). | @sm (Bob) |
