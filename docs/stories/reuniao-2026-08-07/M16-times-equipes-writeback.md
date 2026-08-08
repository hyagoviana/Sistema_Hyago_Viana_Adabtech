# Story M16: TIME/EQUIPE do sênior (júnior + estagiário) — distribuição vai ao SÊNIOR, write-back cria a tarefa no ProJuris com o TIME INTEIRO

- **Épico:** ProJuris / Distribuição — Reunião 2026-08-07
- **ID:** M16
- **Status:** Draft
- **Estimativa relativa:** M/L
- **Executor sugerido:** @data-engineer + @dev + @architect · Quality gate: @qa
- **Risco:** MÉDIO — migration aditiva (modelo de times) + estende o WRITE-BACK (H3), que escreve em produção externa (ProJuris). O motor de distribuição em si (`sync-core.ts`) **não** muda (continua distribuindo só ao sênior); o novo comportamento vive na fase de efetivação (`writeback.ts`), gateada por dry-run/confirmação (herdada de H3).
- **Origem:** Reunião/retorno do Thiago 2026-08-08 (`docs/reunioes/dados-thiago-2026-08-08.md`, seção **"Times / Equipes (conceito NOVO — importante para o write-back)"**). Refina **H3** (write-back) e relaciona com **M8** (nível) e **H5** (ID ProJuris no usuário).

> **O MOTOR v1.0 e o WRITE-BACK (H3) JÁ EXISTEM.** Esta story é REFINAMENTO. A distribuição (`sync-core.ts` → `system_distribution_results`) elege **um** responsável (o sênior) e não muda. O que muda é a **efetivação no ProJuris** (`writeback.ts` → `client.projurisPut(...)`): na hora de criar/atribuir a tarefa, além do sênior, adicionam-se os **IDs ProJuris de TODO o time** (júnior + estagiário da mesma equipe).

---

## Story

**Como** controladoria/gestor (dono do motor de distribuição),
**quero** que a distribuição continue elegendo **apenas o sênior** (fila geral), mas que, na hora de **criar a tarefa no ProJuris** (write-back), o sistema adicione **o time inteiro** — sênior + júnior + estagiário da mesma equipe —,
**para** que a tarefa no ProJuris já nasça com todos os responsáveis reais que vão tocá-la, refletindo como o escritório trabalha por equipe (ex.: *Equipe 2 = Maxwel(sr) + Amanda(est) + Pedro(jr)* → a tarefa recebe os 3), sem que júnior/estagiário entrem na fila de distribuição (eles vêm "de carona" do sênior).

> **DECISÕES TRAVADAS (retorno do Thiago, 2026-08-08 — `docs/reunioes/dados-thiago-2026-08-08.md`):**
> 1. **Conceito de TIME/EQUIPE:** cada **sênior** tem uma equipe (0..N membros júnior/estagiário). O sênior é o "líder" da equipe; os membros são júnior/estagiário.
> 2. **Distribuição vai ao SÊNIOR (não muda):** o motor (`sync-core.ts`) continua distribuindo à fila geral **só de sêniores** (M8: `nivel='senior'` + participa). Júnior/estagiário **nunca** entram na eleição de responsável.
> 3. **Write-back adiciona o TIME INTEIRO:** ao efetivar no ProJuris (`writeback.ts`), a tarefa do sênior eleito recebe os `projuris_responsavel_id` do **sênior + todos os membros da equipe dele**. Ex. do Thiago: *"time do Bruno = Pedro + Amanda → cria a tarefa com Bruno, Pedro e Amanda"* (Bruno = Maxwel, Equipe 2).
> 4. **Equipes REAIS (da planilha):**
>    - **Equipe 1:** Ana Patrícia Cruz (Sênior) — sem membros.
>    - **Equipe 2:** Maxwel Bruno Santos Costa (Sênior) + Amanda Campos (Estagiário) + Pedro Holanda (Júnior).
>    - **Equipe 3:** Keilane Alves (Sênior) + Sarah Helena (Júnior).
>    - **Equipe 4:** Wdyson Neres Moreira da Costa (Sênior) + Leslie Souza (Júnior).
>    - **Equipe 5:** Thaíse (Sênior) — sem membros.
> 5. **Membros SEM ID ProJuris não quebram a efetivação:** se um membro do time não tiver `projuris_responsavel_id` mapeado, ele é **omitido** da lista de responsáveis (com aviso/alerta), mas a tarefa **ainda** é criada com o sênior (e demais membros mapeados). Nunca bloquear o sênior por falta de mapeamento de um membro.
> 6. **A eleição já existente por override (H2) é preservada:** se o gestor trocou o responsável na tela de aprovação (`override_executor_id`), o "líder efetivo" da tarefa passa a ser o executor do override, e o time expandido é o **da equipe desse executor** (se ele for sênior). Se o executor efetivo não for sênior de nenhuma equipe, escreve-se só ele (comportamento atual).

---

## Contexto / o que JÁ EXISTE vs NOVO

### JÁ EXISTE (reusar — NÃO reconstruir)

- **Modelo de nível do colaborador (M8):** coluna `system_users.nivel` (`estagiario`/`junior`/`senior`) — introduzida em M8. É a base para saber quem é sênior (líder) e quem é membro.
- **Mapeamento executor → código ProJuris (H5):** `system_projuris_executor_mapping` (`executor_id UUID → system_users.id`, `projuris_responsavel_id TEXT`, `active`, `weight`, `eligible_complex`). É de onde sai o código ProJuris de **cada** pessoa do time. Formato do ID mudou para `PES.XXXXXXX` (ver M8/H5).
- **Write-back (H3) — o ponto de extensão:** `sistema-hv/src/lib/distribuicao/writeback.ts` — `runWriteback(distributionDate, confirm)`. Hoje, por result aprovado (H2) + `writeback_pending`, resolve **um** `executor_id → projuris_responsavel_id` (mapa `projurisByExecutor`, linhas ~209-222) e monta **um** `ProjurisWriteBackItem` `{ codigoTarefa, codigoResponsavel, codigoResponsavelAnterior? }` (linhas ~315-331). É AQUI que o time entra: em vez de 1 código, enviar N.
- **Cliente ProJuris (escrita):** `sistema-hv/src/lib/projuris/client.ts` — `projurisPut(route, items[])`, `PROJURIS_WRITEBACK_ROUTES.addResponsible = "v2/tarefa/adicionar-responsavel-em-lote"` e `.replaceResponsible = "v2/tarefa/substituir-responsavel-em-lote"`; tipo `ProjurisWriteBackItem`. **BLOQUEIO de design (T0):** confirmar se o endpoint `adicionar-responsavel-em-lote` aceita **múltiplos responsáveis por tarefa** num único lote (um item por responsável, mesma `codigoTarefa`) ou se exige um formato próprio de "lista de responsáveis" — isso decide o formato do payload.
- **Distribuição (não muda):** `sistema-hv/src/lib/distribuicao/sync-core.ts` — elege o sênior; grava `system_distribution_results` (imutável, só `writeback_pending` muda). M16 **não** toca este arquivo.
- **Portão H2 (aprovação) + override:** `writeback.ts` já lê `system_distribution_approvals` (`status='approved'`, `override_executor_id`). M16 reusa isso para achar o executor efetivo.
- **Alerta de falha de write-back:** `ALT-SYNC-001` (`WRITEBACK_ALERT_CODE` em `writeback.ts`). Reusar para "membro do time sem mapeamento".

### NOVO (a construir nesta story)

- **Modelo de TIME/EQUIPE.** Duas opções de modelagem (decisão D-team em T0):
  - **Opção A (recomendada) — tabela `system_teams` + membros:** `system_teams (id, organization_id, name, senior_user_id UUID → system_users, created_at, updated_at, UNIQUE(organization_id, senior_user_id))` + `system_team_members (team_id, user_id, role_in_team? , UNIQUE(team_id, user_id))`. Modela N membros por equipe de forma limpa e permite um membro em 0..1 equipe (ou N, se decidido). Rótulo/numeração da equipe (1..5) vira `name`.
  - **Opção B (mais simples) — coluna `time` em `system_users`:** `system_users.team_slug TEXT NULL` (ex.: `equipe-2`) + o sênior identificado por `nivel='senior'` dentro do mesmo `team_slug`. Menos flexível (1 membro = 1 time; sênior implícito), sem tabela de junção.
  - **Travar em T0.** Opção A é preferível pela clareza do write-back (dado o sênior, `JOIN` traz os membros); Opção B evita migration de junção. Documentar a escolha no ChangeLog.
- **Resolução "sênior → time (IDs ProJuris)":** função server-only `resolveTeamProjurisIds(seniorExecutorUserId)` que devolve a lista de `projuris_responsavel_id` do sênior + membros (via mapping ativo), pulando quem não tem código (com aviso). Vive em `writeback.ts` (ou um helper `team-writeback.ts`).
- **Expansão do payload no write-back:** em `runWriteback`, para cada result elegível, montar **N itens** (`ProjurisWriteBackItem[]`) — um por responsável do time — para a mesma `codigoTarefa`, respeitando `add` vs `replace` (o `replace` só faz sentido para o **líder**; membros entram como `add`). Um log por tarefa (ou por tarefa×responsável — decidir em T0 conforme o formato do endpoint).
- **Seed das 5 equipes reais:** migration de seed idempotente que cria `system_teams` 1..5 e vincula os membros conforme a planilha (casando por `full_name`/`projuris_responsavel_id` já semeados em `20260805000001`). ⚠️ nomes "Bruno"/"Hudson" são apelidos — usar o de-para confirmado (Bruno=Maxwel, Hudson=Wdyson) **somente após** confirmação do Thiago (ver M8/dados-thiago).
- **(nice-to-have) UI de gestão de times** na tela de Usuários/Permissões (admin): definir o sênior e adicionar membros. Mínimo desta story: o **modelo + seed + write-back**; a UI pode ficar para follow-up se o tempo apertar (documentar).

---

## Acceptance Criteria

1. **Modelo de time (schema):** existe um modelo que relaciona **um sênior** a **N membros** (júnior/estagiário) por organização (Opção A `system_teams`+`system_team_members`, ou Opção B `system_users.team_slug` — travado em T0). Migration **aditiva** + rollback simétrico + `db:types` regenerado. Sem regressão: usuários/equipes ausentes = comportamento atual (sem time = só o próprio executor no write-back).
2. **Seed das 5 equipes:** as equipes 1..5 da planilha existem no banco, com o sênior e os membros corretos (Equipe 2 = Maxwel+Amanda+Pedro; 3 = Keilane+Sarah; 4 = Wdyson+Leslie; 1 = Ana Patrícia; 5 = Thaíse). Seed **idempotente** (re-rodar não duplica). Vínculos de apelido (Bruno=Maxwel/Hudson=Wdyson) só entram após confirmação (senão, seed parcial + TODO documentado).
3. **Distribuição inalterada:** `sync-core.ts` continua elegendo **só o sênior** (M8). Nenhum júnior/estagiário passa a receber atribuição pela fila do motor por causa desta story (regressão zero na eleição).
4. **Write-back expande para o time:** ao efetivar (`runWriteback`, `confirm=true` + infra habilitada), para cada tarefa aprovada cujo executor efetivo é um **sênior com equipe**, o payload enviado ao ProJuris inclui o `projuris_responsavel_id` do **sênior + todos os membros da equipe** (mapeados e ativos). Sênior sem equipe → só ele (comportamento atual). Ex.: tarefa do Maxwel → ProJuris recebe Maxwel + Amanda + Pedro.
5. **Membro sem mapeamento não quebra:** se um membro não tem `projuris_responsavel_id` (ou mapping inativo), ele é **omitido** da lista, um `ALT-SYNC-001` (warning) é emitido/logado, e a tarefa **ainda** é criada com o sênior + membros restantes. Falta de código do **líder** continua sendo o único caso que marca o result como pendente/não-efetivado (comportamento atual de H3).
6. **Dry-run mostra o time:** no modo dry-run (default de H3), o plano/preview lista, por tarefa, **todos** os responsáveis que SERIAM escritos (líder + membros), sem chamar a API. `WritebackSummary`/`WritebackItemPlan` são estendidos para expor a lista de responsáveis do time (não só um `projurisResponsavelId`).
7. **Override (H2) respeitado:** se houver `override_executor_id`, o time expandido é o da equipe **do executor do override** (se ele for sênior); se o executor efetivo não liderar equipe, escreve-se só ele. Nenhuma tarefa não-aprovada é escrita (portão H2 intacto).
8. **Idempotência preservada:** re-rodar o write-back não duplica responsáveis no ProJuris — results já `success`/`writeback_pending=false` são pulados; o registro de idempotência cobre a tarefa (e, se o endpoint exigir, por responsável). Um erro num membro não corrompe o restante do batch.
9. **Autorização/segurança/regressão:** disparar o write-back real continua gateado (`requireModule("controladoria","edit")` + confirmação — herdado de H3); a gestão de times (se houver UI/endpoint) exige **admin**; `npm run typecheck` + `npm run lint` verdes; RLS org-scoped nas tabelas novas; nenhum segredo ProJuris em log/front; imutabilidade de `results` preservada (só `writeback_pending` muda).

---

## Tasks / Subtasks

### T0 — Decisões de design (SPIKE — @architect + @data-engineer, antes de codar)
- [ ] **D-team:** escolher Opção A (`system_teams`+`system_team_members`) vs Opção B (`system_users.team_slug`). Registrar no ChangeLog. (AC-1)
- [ ] **D-payload (BLOQUEIO):** confirmar (doc ProJuris / probe controlado / Thiago) se `v2/tarefa/adicionar-responsavel-em-lote` aceita **múltiplos responsáveis para a mesma `codigoTarefa`** (N itens, um por responsável) ou exige formato próprio. Isso define o shape do `ProjurisWriteBackItem[]` e do log (1 linha por tarefa vs por tarefa×responsável). (AC-4, AC-8)
- [ ] **D-membro-multi-time:** um membro pertence a no máximo 1 equipe? (assumir sim; UNIQUE `(user_id)` em `system_team_members` se for o caso). (AC-1)

### T1 — Schema + seed (@data-engineer)
- [ ] Migration `20260807xxxxxx_system_teams.sql` conforme D-team (tabelas + FKs + UNIQUEs + RLS org-scoped + grants no padrão `system_*`). Rollback simétrico em `supabase/rollbacks/`. `db:types` regenerado. (AC-1)
- [ ] Migration/seed `20260807xxxxxx_system_teams_seed.sql` (idempotente) das equipes 1..5 casando por `full_name` (ou pelos `system_users` sintéticos do seed `20260805000001`). Apelidos Bruno/Hudson só após confirmação (senão TODO). Aplicar via `npx tsx scripts/db-apply-pg.ts`. (AC-2)

### T2 — Resolução do time (@dev)
- [ ] `resolveTeamProjurisIds(seniorExecutorUserId)` (server-only, em `writeback.ts` ou `team-writeback.ts`): dado o `system_users.id` do líder, traz `[líder, ...membros]` e resolve cada um em `projuris_responsavel_id` (mapping ativo); omite não-mapeados e sinaliza. Retorna `{ leader, members[], missing[] }`. (AC-4, AC-5)

### T3 — Expansão do write-back (@dev + @architect)
- [ ] Em `runWriteback`, substituir o "1 código por result" pela lista do time: montar `ProjurisWriteBackItem[]` (líder em `add`/`replace` conforme `responsavel_atual`; membros sempre `add`) para a mesma `codigoTarefa`, conforme D-payload. (AC-4, AC-7)
- [ ] Estender `WritebackItemPlan`/`WritebackSummary` para carregar a lista de responsáveis do time (dry-run mostra todos). (AC-6)
- [ ] Emissão de `ALT-SYNC-001` quando um membro não tem código; nunca bloquear o líder por isso. Log idempotente por tarefa (ou tarefa×responsável, per D-payload). (AC-5, AC-8)

### T4 — (nice-to-have) UI de gestão de times (@dev)
- [ ] Na tela de Usuários/Permissões (admin): definir sênior + membros da equipe. Se cortado por tempo, documentar como follow-up (o seed cobre as 5 equipes reais). (AC-9)

### T5 — QA (@qa)
- [ ] Dry-run de uma tarefa cujo executor é o Maxwel → preview lista Maxwel + Amanda + Pedro (sem chamar API). (AC-4, AC-6)
- [ ] Remover o código ProJuris de um membro → dry-run/efetivação omite o membro + emite `ALT-SYNC-001`, e o líder ainda entra. (AC-5)
- [ ] Sênior sem equipe → só ele no payload (regressão). (AC-4)
- [ ] Override para um sênior de outra equipe → expande a equipe do override. (AC-7)
- [ ] Re-rodar → idempotente (sem duplicar responsáveis). (AC-8)
- [ ] `typecheck` + `lint` verdes; RLS/imutabilidade preservadas. (AC-9)

---

## Dev Notes

**Onde o time entra (e onde NÃO entra).** O time é um conceito de **efetivação**, não de **eleição**. A distribuição (`sync-core.ts`) escolhe o sênior e grava o result — isso NÃO muda. A expansão para o time inteiro acontece **só** em `writeback.ts`, na montagem do payload do ProJuris. Assim, a carga/scoring do motor continua atribuída ao sênior (o time não "dilui" pontuação), e o júnior/estagiário aparecem na tarefa do ProJuris por serem responsáveis operacionais, não por terem recebido distribuição.

**Ponto exato de extensão em `writeback.ts`.** Hoje o mapa `projurisByExecutor` resolve **um** código por `effectiveExecutorId` (~247) e monta **um** `item` (~316). M16 troca isso por `resolveTeamProjurisIds(effectiveExecutorId)` → lista; o `item` do líder mantém a lógica `add`/`replace` (via `raw_data.responsavel_atual`), os membros são sempre `add`. Confirmar em T0 se o endpoint aceita vários itens com a mesma `codigoTarefa` num lote.

**Add vs Replace com time.** `replace` (substituir responsável) só se aplica ao **líder** quando havia um `responsavel_atual` diferente. Os **membros** entram sempre como **adição** (`addResponsible`) — não se "substitui" um membro por outro. Se o endpoint só aceitar um modo por lote, separar em duas chamadas (replace do líder + add dos membros) preservando idempotência.

**Casamento do seed por apelido.** Os áudios do Thiago usam apelidos ("time do Bruno = Pedro + Amanda"). O de-para **Bruno=Maxwel Bruno Santos Costa** e **Hudson=Wdyson Neres Moreira da Costa** está marcado como *A CONFIRMAR* em `dados-thiago-2026-08-08.md`. O seed **não** deve gravar esses vínculos até a confirmação — senão, semear só as equipes inequívocas e deixar TODO para Bruno/Hudson.

**Migrations via pg direto.** CLI Supabase quebrado no Windows/OneDrive — aplicar via `npx tsx scripts/db-apply-pg.ts <arquivo.sql>` da pasta `sistema-hv/` (ver `reference_aplicar_migrations_pg_direto`). dev=prod; rollback simétrico obrigatório em `supabase/rollbacks/`.

**Riscos:**
- **R1 — endpoint não aceita multi-responsável por tarefa (D-payload).** Mitigação: T0 confirma; se necessário, uma chamada por responsável (mais requests, mesma idempotência por tarefa×responsável no log).
- **R2 — membro sem código quebra a efetivação do líder.** Mitigação: AC-5 — omitir membro + alerta, nunca bloquear o líder.
- **R3 — apelido errado no seed.** Mitigação: seed só com vínculos confirmados; Bruno/Hudson via TODO até o Thiago confirmar.
- **R4 — duplicação de responsável ao re-rodar.** Mitigação: idempotência por tarefa (e por responsável, se o endpoint exigir) no `system_distribution_writeback_log`; pular `success`/`writeback_pending=false`.
- **R5 — vazamento da regra para a agenda/carga.** Não aplicável: M16 não toca `sync-core.ts`; a carga continua no sênior.

### Testing
- Seed: equipes 1..5 no banco com os membros certos (Bruno/Hudson pendentes de confirmação).
- Dry-run: tarefa do Maxwel → plano com Maxwel+Amanda+Pedro; nenhuma chamada real.
- Membro sem código → omitido + `ALT-SYNC-001`; líder mantido.
- Sênior sem equipe → só ele (regressão).
- Re-rodar → sem duplicação.
- `npm run typecheck` + `npm run lint` verdes.

---

## Dependências

- **Depende de (entregues/em andamento):**
  - **M8** (nível `senior`/`junior`/`estagiario` em `system_users`) — base para distinguir líder × membro.
  - **H5** (`system_projuris_executor_mapping`: `projuris_responsavel_id` por usuário) — fonte do código ProJuris de cada membro.
  - **H3** (`writeback.ts` + `client.projurisPut` + `PROJURIS_WRITEBACK_ROUTES` + portão H2) — ponto de extensão desta story.
  - Seed de executores `20260805000001` (os `system_users` sintéticos + mapping) para casar o seed das equipes.
- **BLOQUEIO (T0):** contrato do endpoint `v2/tarefa/adicionar-responsavel-em-lote` para multi-responsável (D-payload) + confirmação dos apelidos Bruno/Hudson com o Thiago.
- **Relaciona com M9** (peso do executor) — ortogonal (peso é do líder; time não altera peso).

## File List

**A definir na implementação. Previsto:**
- `sistema-hv/supabase/migrations/20260807xxxxxx_system_teams.sql` (+ rollback) — modelo de times (D-team).
- `sistema-hv/supabase/migrations/20260807xxxxxx_system_teams_seed.sql` — seed das 5 equipes (idempotente).
- `sistema-hv/src/lib/supabase/types.ts` — Row/Insert das tabelas novas (+ `team_slug` se Opção B).
- `sistema-hv/src/lib/distribuicao/writeback.ts` — `resolveTeamProjurisIds` + expansão do payload + plano com time; `WritebackItemPlan`/`WritebackSummary` estendidos.
- `sistema-hv/src/lib/distribuicao/team-writeback.ts` (opcional) — helper de resolução do time, se preferir isolar de `writeback.ts`.
- `sistema-hv/src/lib/projuris/client.ts` — só se D-payload exigir novo shape de item/rota (provável: sem mudança, reusa `adicionar-responsavel-em-lote`).
- `sistema-hv/src/rpc/distribuicao.ts` — só se o preview/summary precisar expor a lista do time à UI de aprovação.
- `sistema-hv/src/components/settings/UsersAdmin.tsx` (nice-to-have) — gestão de sênior + membros da equipe.

## Change Log

| Data | Versão | Descrição | Autor |
|------|--------|-----------|-------|
| 2026-08-07 | v0.1 | Draft inicial. Conceito de TIME/EQUIPE (sênior + júnior + estagiário). Distribuição (`sync-core.ts`) inalterada: elege só o sênior. Write-back (H3/`writeback.ts`) passa a expandir o payload do ProJuris para o time inteiro (`resolveTeamProjurisIds` → N `ProjurisWriteBackItem` na mesma `codigoTarefa`; líder add/replace, membros add). Modelo de times a travar em T0 (Opção A `system_teams`+`system_team_members` vs Opção B `system_users.team_slug`) + seed idempotente das 5 equipes reais (Bruno/Hudson pendentes de confirmação). Membro sem código é omitido + `ALT-SYNC-001`, sem bloquear o líder. Reusa M8 (nível), H5 (mapping) e portão H2. BLOQUEIO T0: contrato multi-responsável do endpoint `v2/tarefa/adicionar-responsavel-em-lote`. | @sm (Bob) |
