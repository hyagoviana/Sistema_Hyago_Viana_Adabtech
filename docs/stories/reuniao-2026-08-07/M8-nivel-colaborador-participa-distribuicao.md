# Story M8: Modelo REAL de cadastro do colaborador (Perfil/Cargo/Unidade/Status) + DUAS flags do motor (Peticionante × Participa-da-distribuição-geral) + igualar tela de Convite à de Editar

- **Épico:** ProJuris / Distribuição — Reunião 2026-08-07
- **ID:** M8
- **Status:** Ready for Review
- **Estimativa relativa:** M/G (cresceu com o retorno do Thiago: passou de 1 campo `nivel` para o modelo completo de cadastro + 2 flags)
- **Executor sugerido:** @dev + @data-engineer · Quality gate: @qa
- **Risco:** MÉDIO — migration aditiva (várias colunas em `system_users`) + mexe nas telas de Usuários (editar e **convite**) e no filtro de executores do motor (que passa a respeitar DUAS flags). Sem tocar RBAC de login.
- **Origem:** Reunião 2026-08-07 (`docs/reunioes/reuniao-2026-08-07-melhorias-ate-segunda.md`), item **M8**. Refinamento de **H5** (2026-08-05, já entregue — bloco "Distribuição (ProJuris)" no diálogo de editar usuário). **v0.2:** incorpora o retorno REAL do Thiago em `docs/reunioes/dados-thiago-2026-08-08.md` (planilha preenchida + áudios).

> **O MOTOR v1.0 JÁ EXISTE.** Esta story é REFINAMENTO. O cadastro de distribuição do executor (ID ProJuris + participa + peso + elegível-complexo) já foi entregue em H5, gravando em `system_projuris_executor_mapping` via `setUserDistribution`. M8 acrescenta o **modelo real de cadastro do colaborador** que o Thiago definiu (Perfil, Cargo/nível, Unidade Organizacional, Status colaborador, Status ProJuris) e — o ponto crítico — separa as **DUAS flags distintas** do motor (Peticionante e Participa-da-distribuição-geral), levando tudo também para a tela de **convite** (que hoje não o tem).

> **⚠️ MUDANÇA DE FONTE DA VERDADE (2026-08-08).** O Thiago devolveu a planilha `Cadastro-Colaboradores-PREENCHIDO-2026-08-08.xlsx` com as colunas REAIS + regras por áudio. Antes M8 previa **1 só eixo** ("só sênior distribui"). Agora são **DUAS flags independentes** (ver decisões abaixo). Também: o **ID ProJuris mudou de formato** para `PES.XXXXXXX` (ex.: `PES.0000030`), não mais número puro tipo `128858` — o de-para de executores tem que casar por `PES.*`.

---

## Story

**Como** administrador do escritório (gestão de Usuários e Permissões),
**quero** cadastrar o colaborador com o **modelo real** que o Thiago definiu (**Perfil**, **Cargo/nível**, **Unidade Organizacional**, **Status colaborador**, **Status ProJuris**) e com as **DUAS flags do motor** — **Peticionante** e **Participa da distribuição padrão/geral** — tanto ao **editar** quanto ao **convidar**,
**para** que a distribuição respeite as regras reais (quem **nem entra** no motor, quem entra na **fila geral**, quem só recebe **por exceção**) e para que a tela de **convite** deixe de estar "incompleta" em relação à de editar (o Matheus notou na reunião: "a tela de convite está diferente da de editar").

> **DECISÕES TRAVADAS (planilha + áudios do Thiago, 2026-08-08 — fonte: `docs/reunioes/dados-thiago-2026-08-08.md`):**
> 1. **Perfil (do sistema):** `Administrador` / `Usuário padrão` / `Coordenador` / `Financeiro`. (O Thiago deixou registrado que Perfil/Cargo servem de base para uma futura **permissão por cargo** — feature futura, não nesta story.)
> 2. **Cargo / nível:** `Sênior` / `Júnior` / `Estagiário` / `Prestador de serviço` / `Administrador`.
> 3. **Unidade Organizacional:** texto (unidade/filial).
> 4. **Status colaborador:** `ativo` / `inativo`.
> 5. **Status ProJuris:** `Habilitado` / `Desabilitado` (= arquivado no ProJuris).
> 6. **DUAS FLAGS DISTINTAS DO MOTOR (não confundir):**
>    - **(a) Peticionante (Sim/Não):** se **Não → a pessoa NEM é considerada pelo motor** (não entra em fila nenhuma). Se **Sim** → pode receber (pela fila geral OU por exceção/regra específica).
>    - **(b) Participa da distribuição padrão/geral (Sim/Não):** só entra na **fila ordinária/geral** quem está `Sim`. Só **sêniores marcados `Sim`** entram na fila geral. Sêniores `Não` (ex.: Thiago, Ana Patrícia, Thaíse) recebem **só por exceção/regra específica**. Júnior/estagiário = `Não` (não recebem agenda direto — vêm do sênior).
>    - **Na planilha, `Sim` na distribuição padrão:** **Keilane, Maxwel, Wdyson**.
> 7. **Preencher ao convidar:** todos os campos acima + ID ProJuris devem existir **também** no diálogo de convite, não só no de editar. **Igualar as duas telas.**
> 8. **Reuso de H5:** não recriar o bloco "Distribuição (ProJuris)". Estender o `setUserDistribution`/mapping. As duas flags mapeiam: **Peticionante** e **Participa-geral** (a antiga `participa` do H5 = mapping `.active` vira **Peticionante**; a **Participa-geral** é a flag NOVA que restringe a fila ordinária — ver Dev Notes).
> 9. **ID ProJuris = `PES.XXXXXXX`** (ex.: `PES.0000030`). Formato mudou; o de-para (`system_projuris_executor_mapping.projuris_responsavel_id`) tem que casar por `PES.*`.
> 10. **Usuários arquivados (áudio 4):** usuários `Desabilitado/Inativo` (ex.: Nicole júnior, Micael, Rodrigo, Matheus Rocha) entram como **REGISTRO no sistema, SEM acesso** (sem convite/e-mail) — servem só de arquivo/vínculo para o espelhamento das tarefas do ProJuris não quebrar. (Detalhe operacional; o cadastro-em-massa é tratado em M15, mas M8 precisa suportar `status inativo` + `sem convite`.)

---

## Contexto / o que JÁ EXISTE vs NOVO

### JÁ EXISTE (reusar — NÃO reconstruir)

- **Tela de editar usuário** com bloco "Distribuição (ProJuris)": `sistema-hv/src/components/settings/UsersAdmin.tsx` (state `editing` com `projurisId`/`participa`/`eligibleComplex`/`weight`; `salvarPerfil()` chama `setDistribution.mutateAsync`; badge "Distribuição · <código>" na lista).
- **Tela de convite (a completar):** `sistema-hv/src/components/settings/InviteUserDialog.tsx` — hoje só tem e-mail, nome, papel e `ModulePermsGrid`. **Não** tem ID ProJuris / nível / participa.
- **Camada de dados:** `sistema-hv/src/lib/users-service.ts` — `listUsers()` (`select id, email, full_name, phone, role, status, created_at` + lookup em `system_projuris_executor_mapping` → `UserWithDistribution` com `projuris_responsavel_id`, `participa_distribuicao`, `weight`, `eligible_complex`); `setUserDistribution(userId, {...})` (upsert no mapping por `executor_id`); `updateUserProfile(id, { full_name, phone })`; `inviteUser({ email, full_name, role, redirectTo })` (cria auth user + `system_users` status INVITED).
- **Server fns / hooks:** `sistema-hv/src/rpc/users.ts` (`setUserDistributionFn`, `updateUserProfileFn`, `inviteUserFn`, gate admin); `sistema-hv/src/hooks/useUsers.ts` (`useSetUserDistribution`, `useUpdateUserProfile`, `useInviteUser`).
- **Filtro de executores do motor:** `sistema-hv/src/lib/distribuicao/sync-core.ts:296-308` — monta `executors` a partir de `system_users` (`select("id, full_name, status")`, linha 246; filtra `status === "ACTIVE"`) ∩ `system_projuris_executor_mapping` (`.eq("active", true)`, linha 245; select em `sync-core.ts:242`); mapeia `general_weight`, `complex_eligible`, `authorized_*`. **HOJE há UMA só condição de participação** (`active` do mapping = a antiga flag `participa` do H5). É AQUI que as **DUAS flags** precisam entrar.
- **Serviço de dados:** `sistema-hv/src/lib/users-service.ts` — `getUserDistribution`/`setUserDistribution` mapeiam `participa_distribuicao = mapping.active` (linhas ~47-95, ~114-159). É onde a antiga flag única vive.
- **Tabela `system_users`:** hoje sem `perfil`/`cargo`/`nivel`/`unidade_organizacional`/flags do motor. Colunas de distribuição (`weight`/`eligible_complex`) vivem no mapping, não em `system_users`.

### NOVO (a construir nesta story)

- **Colunas em `system_users`** (migration aditiva + rollback + `db:types`; todas NULL/opcionais para não regredir os existentes):
  - `perfil TEXT` CHECK `('administrador','usuario_padrao','coordenador','financeiro')`.
  - `cargo TEXT` (nível) CHECK `('senior','junior','estagiario','prestador_servico','administrador')`.
  - `unidade_organizacional TEXT`.
  - `peticionante BOOLEAN NOT NULL DEFAULT false` — flag (a).
  - `participa_distribuicao_padrao BOOLEAN NOT NULL DEFAULT false` — flag (b) NOVA (fila geral).
  - `status` do colaborador (ativo/inativo) e `status_projuris` (habilitado/desabilitado) — se já não estiverem cobertos por `system_users.status` existente; documentar (ver Dev Notes: `status` de login ≠ status colaborador/ProJuris).
  - **Nota:** as flags (a)/(b) PODEM ficar em `system_users` (recomendado, pois "peticionante" e "participa-geral" são atributos do colaborador) OU no `system_projuris_executor_mapping`. Documentar a escolha; o filtro do motor precisa ler ambas.
- **Campos no diálogo de EDITAR** (`UsersAdmin.tsx`): Selects Perfil, Cargo/nível, Unidade Organizacional, Status; toggles **Peticionante** e **Participa da distribuição geral**; ID ProJuris já no formato `PES.*`.
- **Igualar CONVITE ao EDITAR** (`InviteUserDialog.tsx`): mesmos campos acima + bloco "Distribuição (ProJuris)". Ao convidar, após criar o usuário (que já retorna `id`), gravar via `setUserDistribution` + os campos de `system_users` (mesmo padrão que o convite já usa para `setPerms` após criar — ver `InviteUserDialog.tsx:72` `setPerms.mutateAsync`).
- **Persistência:** estender `updateUserProfile`/`updateUserProfileFn` (e o caminho de convite) para aceitar os campos novos; `listUsers()` passa a devolvê-los.
- **DUAS flags no motor:** em `sync-core.ts`, o filtro de `executors` passa a exigir, para a **fila geral/ordinária**: `peticionante === true` **E** `participa_distribuicao_padrao === true` (além de mapping ativo + status ACTIVE). Quem tem `peticionante=false` **NEM entra** no conjunto de executores. Quem tem `peticionante=true` mas `participa_geral=false` fica de fora da fila geral e só é elegível por **exceção/regra específica** (ver M14 — exceções/responsável exclusivo).

---

## Acceptance Criteria

1. **Schema (colaborador):** `system_users` ganha `perfil`, `cargo` (nível), `unidade_organizacional`, `peticionante BOOLEAN DEFAULT false`, `participa_distribuicao_padrao BOOLEAN DEFAULT false` (+ status colaborador/ProJuris se não cobertos pelo `status` atual). CHECKs conforme domínios das decisões 1/2. Migration aditiva + rollback simétrico + `db:types` regenerado. Usuários existentes ficam com valores default/NULL (sem regressão). ID ProJuris aceita/exibe formato **`PES.XXXXXXX`**.
2. **Campos no editar:** o diálogo "Editar usuário" (`UsersAdmin.tsx`) mostra e edita: Select **Perfil**, Select **Cargo/nível**, campo **Unidade Organizacional**, Select **Status**, toggle **Peticionante** e toggle **Participa da distribuição geral**; salvar persiste em `system_users`.
3. **Convite = editar:** o diálogo `InviteUserDialog.tsx` passa a ter **os mesmos campos** do AC-2 + o bloco **"Distribuição (ProJuris)"** (ID ProJuris `PES.*` + as duas flags), **igualando** a tela de editar. Ao enviar o convite, o usuário criado recebe todos os campos + o mapping de distribuição (via `setUserDistribution`, mesmo padrão do `setPerms` pós-convite em `InviteUserDialog.tsx:72`).
4. **DUAS flags no motor:** em `sync-core.ts`, o conjunto de `executors` elegíveis para a **fila geral** exige `peticionante === true` **E** `participa_distribuicao_padrao === true` (além de mapping `active` + `system_users.status === 'ACTIVE'`). (a) `peticionante === false` ⇒ o usuário **nem entra** no conjunto de executores. (b) `peticionante=true` + `participa_geral=false` ⇒ fica **fora da fila geral** e só é elegível por **exceção** (M14). Validar com a planilha: fila geral = **Keilane, Maxwel, Wdyson**.
5. **Sêniores "Não" e time:** sêniores com `participa_geral=false` (Thiago, Ana Patrícia, Thaíse) **não** entram na fila ordinária (só exceção). Júnior/estagiário (`participa_geral=false`) **não** recebem agenda direto — mas **continuam visíveis** na agenda/carga do time (não são removidos da visualização, só da eleição de responsável). Documentar onde a agenda lê os membros (separar "distribuíveis" de "visíveis na agenda" se hoje for o mesmo array).
6. **Leitura na lista:** `listUsers()` devolve os campos novos; a lista/badges de `UsersAdmin.tsx` deixam claro cargo/perfil e as flags (ao menos no diálogo; badge na linha é nice-to-have).
7. **Autorização:** gravar os campos e a distribuição (editar e convite) exige **admin** (mesmo gate de `setUserDistributionFn`/`inviteUserFn`).
8. **Regressão/segurança:** `npm run typecheck` + `npm run lint` verdes; `db:types` regenerado; RLS org-scoped preservada; o bloco de H5 no editar continua funcionando; nenhum segredo/PII em log.

---

## Tasks / Subtasks

### T1 — Schema (@data-engineer)
- [ ] Migration `20260808xxxxxx_system_users_cadastro_colaborador.sql`: `ALTER TABLE system_users ADD COLUMN IF NOT EXISTS` para `perfil TEXT`, `cargo TEXT`, `unidade_organizacional TEXT`, `peticionante BOOLEAN NOT NULL DEFAULT false`, `participa_distribuicao_padrao BOOLEAN NOT NULL DEFAULT false` (+ status colaborador/ProJuris se necessário). CHECKs nomeados para `perfil`/`cargo`. Rollback simétrico em `supabase/rollbacks/`. Aplicar via `npx tsx scripts/db-apply-pg.ts` (CLI Supabase quebrado no Windows/OneDrive). Atualizar `src/lib/supabase/types.ts`. **Decidir e documentar** se as 2 flags ficam em `system_users` (recomendado) ou no mapping. (AC-1)

### T2 — Camada de dados (@dev)
- [ ] `updateUserProfile`/`updateUserProfileFn` aceitam os campos novos (validar domínios). `listUsers()`/`UserWithDistribution` incluem os campos. Se as flags ficarem no mapping, estender `getUserDistribution`/`setUserDistribution` (`users-service.ts`) para as DUAS flags (`peticionante` + `participa_distribuicao_padrao`), em vez da única `participa`. (AC-2, AC-6)
- [ ] ID ProJuris `PES.*`: garantir que `setUserDistribution` grava/normaliza o novo formato em `projuris_responsavel_id`. (AC-1)
- [ ] Caminho de convite: `inviteUser`/`inviteUserFn` gravam os campos no `system_users` criado (ou o front chama `updateUserProfile` logo após, como já faz com `setPerms`). Suportar `status inativo`/sem convite para usuários arquivados (decisão 10). (AC-3)

### T3 — UI editar (@dev)
- [ ] Em `UsersAdmin.tsx`: Selects Perfil, Cargo/nível, Unidade Organizacional, Status; toggles **Peticionante** e **Participa da distribuição geral**; ID ProJuris `PES.*`. `salvarPerfil()` envia tudo. (AC-2)

### T4 — UI convite = editar (@dev)
- [ ] Adicionar ao `InviteUserDialog.tsx` **os mesmos campos** do T3 + bloco "Distribuição (ProJuris)" (reusar componentes/labels do editar). Após `invite.mutateAsync` retornar `id`, chamar `setDistribution` + gravar os campos (mesmo padrão do `setPerms` pós-convite, `InviteUserDialog.tsx:72`; falha não reverte o convite, só avisa). (AC-3)

### T5 — Motor: DUAS flags (@dev + @architect)
- [ ] `sync-core.ts`: o select de `system_users` (linha 246) inclui as flags; o `.filter(...)` que monta `executors` (linhas 296-308) passa a exigir `peticionante === true` **E** `participa_distribuicao_padrao === true` para a fila geral. `peticionante=false` some do conjunto. `peticionante=true`+`participa_geral=false` fica reservado a exceções (M14). Confirmar/ajustar que a agenda/carga ainda enxerga o time (AC-5). Documentar. (AC-4, AC-5)

### T6 — QA (@qa)
- [ ] Cadastrar 3 usuários cobrindo os domínios (Perfil/Cargo/Unidade/Status) e conferir persistência. (AC-1,2)
- [ ] Convidar um usuário com todas as flags + ID `PES.*` → conferir 1 linha no mapping + campos no `system_users`. (AC-3)
- [ ] **Matriz das 2 flags** no `runSync`/simulação: (i) `peticionante=false` não aparece; (ii) `peticionante=true`+`participa_geral=false` não recebe na fila geral; (iii) `peticionante=true`+`participa_geral=true` recebe. Conferir que a fila geral = Keilane/Maxwel/Wdyson. (AC-4)
- [ ] Confirmar que o time (júnior/estagiário) ainda aparece na agenda. (AC-5)
- [ ] `typecheck` + `lint` verdes. (AC-8)

---

## Dev Notes

**Onde as DUAS flags entram.** O motor v1.0 filtra executores em `sync-core.ts:296-308`. Hoje há UMA condição (`execMappingIds.has(u.id) && u.status === "ACTIVE"` — o mapping `active` é a antiga `participa` do H5). Passa a haver DUAS: `peticionante` (se false, o usuário nem entra no `.filter`) e `participa_distribuicao_padrao` (se false, fica fora da fila geral, elegível só por exceção — M14). Adicionar as flags ao `select("id, full_name, status")` da linha 246 (se ficarem em `system_users`) ou ler do mapping. NÃO mexer no engine puro (`responsible-engine.ts`) — é "quem entra na lista de executores", não scoring.

**Mapeamento das flags vs H5.** A H5 tinha uma flag única `participa` = `system_projuris_executor_mapping.active` (ver `users-service.ts:93` `participa_distribuicao: m?.active`). Agora são duas. Sugestão: manter `mapping.active` como o **Peticionante** (pré-condição de "está no motor") OU introduzir colunas dedicadas em `system_users`. O importante: o motor precisa das duas condições. Documentar a escolha na T1/T2 para não confundir com M9 (peso).

**Agenda vs distribuição (AC-5).** Verificar como a agenda/calendário lê os membros do time. Se reaproveita o mesmo array `executors`, separar: (a) **distribuíveis (fila geral)** = mapping ativo + ACTIVE + `peticionante` + `participa_geral`; (b) **visíveis na agenda** = todos os membros ativos (inclui júnior/estagiário e sêniores de exceção). Se a agenda lê de outra fonte, documentar que não há impacto.

**Convite = mesmo padrão do `setPerms`.** O `InviteUserDialog` cria o usuário (status INVITED) e, se houver overrides, chama `setPerms.mutateAsync` com o `created.id` (`InviteUserDialog.tsx:72`). Replicar para `setDistribution` + os campos de cadastro — inclusive tratamento de falha (convite já enviado; avisar sem reverter). Para usuários **arquivados** (decisão 10): registrar sem convite/e-mail.

**ID ProJuris `PES.*`.** Formato mudou (era número puro tipo `128858`; agora `PES.0000030`). O de-para (`system_projuris_executor_mapping.projuris_responsavel_id`) e qualquer validação de input têm que aceitar `PES.*`. Conferir se M15 (import Excel) e o espelhamento de tarefas casam por esse formato.

**Migrations via pg direto.** `npx tsx scripts/db-apply-pg.ts <arquivo.sql>` da pasta `sistema-hv/` (ver `reference_aplicar_migrations_pg_direto`). dev=prod; rollback simétrico obrigatório.

**Riscos:**
- **R1 — CHECK/DEFAULT bloqueando dados legados.** Colunas devem nascer com DEFAULT seguro (`false`/NULL) para não quebrar usuários existentes.
- **R2 — confundir as duas flags.** `peticionante` e `participa_geral` são condições **combinadas e independentes** (uma remove do motor, a outra remove só da fila geral). Documentar; validar contra a planilha (fila geral = Keilane/Maxwel/Wdyson; sêniores Thiago/Ana Patrícia/Thaíse = peticionante mas fora da geral).
- **R3 — regressão na agenda.** Se o filtro do AC-4 vazar para a agenda, o time some. Mitigar com AC-5 explícito.

### Testing
- Migration: `system_users` tem `nivel` com CHECK; usuário existente = NULL.
- Editar → nível=senior salva; convite → nível+distribuição gravados no created user.
- Júnior com participa=on não recebe tarefa no `runSync`; sênior recebe.
- `npm run typecheck` + `npm run lint` verdes.

---

## Dependências

- **Depende de (entregues):** H5 (bloco Distribuição no editar + `setUserDistribution` + `UserWithDistribution`); `system_projuris_executor_mapping` (`20260728000001`/`...000003`); motor v1.0 (`sync-core.ts`); telas/serviço/hooks de Usuários (`UsersAdmin.tsx`, `InviteUserDialog.tsx`, `users-service.ts`, `rpc/users.ts`, `useUsers.ts`).
- **Relaciona com M9** (peso ajustável): nível e peso são eixos distintos (nível decide quem entra; peso decide quanto recebe). Alinhar UI para não confundir.

## File List

**A definir na implementação. Previsto:**
- `sistema-hv/supabase/migrations/20260808xxxxxx_system_users_cadastro_colaborador.sql` (+ rollback) — perfil/cargo/unidade/peticionante/participa_distribuicao_padrao (+status colaborador/ProJuris).
- `sistema-hv/src/lib/supabase/types.ts` (Row/Insert `system_users` + campos novos).
- `sistema-hv/src/lib/users-service.ts` (campos novos em `updateUserProfile`/`inviteUser`/`listUsers`; DUAS flags em `getUserDistribution`/`setUserDistribution`; ID `PES.*`).
- `sistema-hv/src/rpc/users.ts` (aceitar campos novos nos fns correspondentes).
- `sistema-hv/src/hooks/useUsers.ts` (ajustar mutations se a assinatura mudar).
- `sistema-hv/src/components/settings/UsersAdmin.tsx` (Perfil/Cargo/Unidade/Status + 2 toggles no editar).
- `sistema-hv/src/components/settings/InviteUserDialog.tsx` (igualar ao editar: mesmos campos + bloco Distribuição).
- `sistema-hv/src/lib/distribuicao/sync-core.ts` (filtro das DUAS flags nos executores, linhas 296-308; select linha 246; separar agenda se necessário).

## Change Log

| Data | Versão | Descrição | Autor |
|------|--------|-----------|-------|
| 2026-08-07 | v0.1 | Draft inicial. Refinamento de H5: nova coluna `system_users.nivel` (Estagiário/Júnior/Sênior); regra "só sênior distribui" no filtro de executores do motor (`sync-core.ts`), com júnior/estagiário ainda visíveis na agenda; igualar o diálogo de **convite** (`InviteUserDialog.tsx`) ao de **editar** — nível + bloco "Distribuição (ProJuris)" (ID ProJuris + participa), gravando via `setUserDistribution` pós-convite (mesmo padrão do `setPerms`). Reusa mapping/serviço/hooks de H5. Motor v1.0 já existe — isto é refinamento. | @sm (Bob) |
| 2026-08-08 | v0.2 | Atualizada com dados reais do Thiago (2 flags peticionante×distribuição geral, perfil/cargo/unidade, ID PES.*). @sm |
| 2026-08-08 | v1.0 | **Implementado** (@aios-master/Orion). Decisão T1: flags/cadastro em `system_users`. Migration `20260808000030` (perfil/cargo/unidade_organizacional/peticionante/participa_distribuicao_padrao/status_projuris + CHECKs idempotentes) aplicada 2×; rollback simétrico. Camada de dados (`users-service.ts`): `UserWithDistribution` estendido, `listUsers` traz os campos, `updateUserProfile`/`inviteUser` aceitam o cadastro (gate admin p/ os campos no RPC — o próprio usuário só edita nome/telefone). RPC/hooks ampliados. UI **igualada** editar↔convite: novo módulo `lib/cadastro-colaborador.ts` (domínios PT-BR) reusado no `UsersAdmin` e no `InviteUserDialog` (Perfil/Cargo/Unidade/Status ProJuris + 2 toggles + bloco Distribuição ID `PES.*`); convite grava distribuição pós-invite (padrão `setPerms`). **Motor** (`sync-core.ts`): pool da fila geral agora exige `peticionante===true && participa_distribuicao_padrao===true` (+ mapping ativo + ACTIVE); as flags nascem false → pool geral fica vazio até popular (M15/admin) — seguro pois motor não está em produção (sem auth ProJuris). Typecheck+lint verdes. PENDENTE: types.ts editado à mão (CLI supabase indisponível); QA da matriz das 2 flags quando a auth ProJuris estiver viva; validar planilha (fila geral=Keilane/Maxwel/Wdyson). Não commitado/deployado. | @aios-master (Orion) |
