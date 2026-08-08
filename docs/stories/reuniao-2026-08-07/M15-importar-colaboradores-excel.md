# Story M15: Importar o cadastro de colaboradores a partir do Excel do Thiago (usuários + ID ProJuris + nível/participa/peso + permissões por módulo + vê-valores)

- **Épico:** ProJuris / Distribuição — Reunião 2026-08-07
- **ID:** M15 (deriva de M8/M9 + cadastro de colaboradores da reunião 2026-08-07)
- **Status:** **Dry-run feito + 14 ARQUIVADOS aplicados** (2026-08-08). Falta: ATIVOS (dados sem convite) + disparo de convites — aguarda (a) Thiago confirmar Wdyson (petic=Não×participa=Sim), (b) decisão onboarding/Auth, (c) telefones.
- **Estimativa relativa:** M/L
- **Executor sugerido:** @data-engineer + @dev · Quality gate: @qa
- **Risco:** MÉDIO — cria/atualiza `system_users` (contas de login) + mapping ProJuris + permissões RBAC de uma vez; erro de e-mail/ID vaza para acesso indevido ou distribuição errada. Mitigado por dry-run, idempotência e casamento por e-mail. **Nova faceta:** ~24 das 39 linhas são usuários ARQUIVADOS (sem acesso) — ver **M17** (o importador só os cria como registro, sem convite/login).
- **Origem:** `docs/reunioes/reuniao-2026-08-07-melhorias-ate-segunda.md` (M8/M9 + "O que falta o Thiago mandar" item 1) + transcrição "Matheus Torquato [0601]" (linhas 49–75, 249–263, 383–393) + a planilha devolvida `docs/reunioes/Cadastro-Colaboradores-PREENCHIDO-2026-08-08.xlsx` (aba **Colaboradores** + aba **Instruções**) + regras dos áudios em `docs/reunioes/dados-thiago-2026-08-08.md`.

---

> **NOTA DE ESCOPO:** Esta story descreve o **script/tela de importação idempotente** que consome a planilha padronizada que o Thiago devolveu. As tabelas de destino **já existem** (`system_users`, `system_projuris_executor_mapping`, `system_user_module_perms`). O convite/onboarding por e-mail (`inviteUser` → link → cria senha) **já existe**. Falta: o importador que casa cada linha → usuário + mapping + permissões, com **dry-run** e **idempotência por e-mail** — tratando **usuários arquivados** (ver **M17**) como registro sem acesso (sem convite). NÃO reescrever RBAC nem o fluxo de convite.

---

## Colunas REAIS da planilha (aba "Colaboradores")

Confirmadas lendo `docs/reunioes/Cadastro-Colaboradores-PREENCHIDO-2026-08-08.xlsx` (o Thiago **expandiu** o template: 20 colunas, 39 linhas). Ordem/nomes EXATOS dos cabeçalhos:

`Nome completo | Perfil | E-mail corporativo | Telefone | Status colaborador/e-mail | Unidade Organizacional | Cargo | Time / Equipe | ID ProJuris | Status usuário projuris | Peticionante | Participa da distribuição padrão | Peso (padrão 100) | Ver Operacional | Ver Comercial | Ver Financeiro | Ver Judicial | Ver Controladoria | Vê valores (R$) | Observações`

| Coluna da planilha | Valores REAIS observados | Destino no sistema |
|---|---|---|
| **Nome completo** | (texto; ⚠️ vários vêm com `\n` no fim — **trim obrigatório**) | `system_users.full_name` |
| **Perfil** | `Administrador` / `Usuário padrão` / `Coordenador` / `Financeiro` | mapeia p/ `system_users.role` (ver Dev Notes / de-para de papel) |
| **E-mail corporativo** | corporativo real (⚠️ alguns com `\n`) | `system_users.email` (chave de casamento/idempotência, **trim + lowercase**) |
| **Telefone** | **em branco** (Thiago manda depois) | `system_users.phone` (fica nulo por ora) |
| **Status colaborador/e-mail** | `ativo` / `Inativo` | `Inativo` ⇒ **arquivado/sem acesso** (M17) |
| **Unidade Organizacional** | Administração/Operacional/Comercial/Financeiro/Controladoria/Suporte/Administrativo | anotação (não estrutural hoje; pode virar `time`/setor) |
| **Cargo** | `Sênior` / `Júnior` / `Estagiário` / `Prestador de serviço` / `Administrador` | **nível** (coluna nova — ver NOVO); "Prestador de serviço"/"Administrador" mapeiam p/ `nivel=null` ou valor próprio |
| **Time / Equipe** | `-` ou `Equipe 1..5` | **time** (coluna nova). Equipes: 1=Ana Patrícia · 2=Maxwel+Amanda+Pedro · 3=Keilane+Sarah · 4=Wdyson+Leslie · 5=Thaíse |
| **ID ProJuris** | formato **`PES.XXXXXXX`** (ex.: `PES.0000030`); ⚠️ vários com `\n`; alguns `-` ou "projuris não puxou identificador" | `system_projuris_executor_mapping.projuris_responsavel_id` (**trim**; formato mudou dos números antigos — o de-para casa por `PES.*`) |
| **Status usuário projuris** | `Habilitado` / `Desabilitado` / `-` | `Desabilitado` ⇒ **arquivado/sem acesso** (M17) |
| **Peticionante** | `Sim` / `Não` | **NOVA flag do motor** — `Não` ⇒ pessoa NEM é considerada pelo motor. Guardar em `system_projuris_executor_mapping` (coluna nova `peticionante` — ver R5) |
| **Participa da distribuição padrão** | `Sim` (só **Keilane, Maxwel, Wdyson**) / `Não` | flag "participa" → `system_projuris_executor_mapping.active` (fila ordinária/geral) |
| **Peso (padrão 100)** | `100` para quase todos; em branco p/ alguns | `system_projuris_executor_mapping.weight` (normalizar 100→1.0 — ver Dev Notes) |
| **Ver Operacional/Comercial/Financeiro/Judicial/Controladoria** | **3 estados: `Não vê` / `Vê` / `Edita`** | `system_user_module_perms` (`module`, `access` ∈ none/view/edit) por módulo. ⚠️ **Judicial NÃO está no CHECK** — ver R2 |
| **Vê valores (R$)** | `Sim` / `Não` | `system_user_module_perms.can_view_values` |
| **Observações** | livre (ex.: nota do "Usuário master" sobre API) | anotação — não estrutural |

**Achados importantes na planilha real (leia antes de importar):**
- **39 linhas, ~30 pessoas úteis; ~24 vêm `Desabilitado`/`Inativo`** → entram como **registro SEM acesso** (M17), não como convite.
- **Nomes/e-mails/IDs vêm com `\n` no fim** em muitas linhas → **normalizar (trim de `\r\n`)** antes de casar.
- **Duplicata legítima:** `Nicole Rocha Ribas Lopes` aparece **2×** — (a) `controladoria@…` ativa/Coordenador (ID `PES.0003061`) e (b) `nicole@…` Inativa/Júnior (ID `PES.0000001`, Desabilitado). São **2 registros distintos** (e-mails diferentes) — o casamento por e-mail já os separa; NÃO fundir por nome.
- **"Usuário master"** (`contato@…`) tem "projuris não puxou identificador" e obs pedindo que a **API fique sempre vinculada a esse usuário** → mapping fica sem `projuris_responsavel_id`; é o `role=admin` de sistema.
- **Perfil × Cargo são coisas distintas:** *Perfil* (Administrador/Coordenador/Usuário padrão/Financeiro) tende ao papel/permissão; *Cargo* (Sênior/Júnior/Estagiário) é o **nível** do motor. O Thiago deixou Perfil/Cargo mirando **permissão por cargo no futuro** (não escopo desta story — pessoa a pessoa por ora).

Aba **Instruções** e os áudios (`dados-thiago-2026-08-08.md`) confirmam as regras do motor: **(1)** *Peticionante=Não ⇒ fora do motor*; **(2)** só **sêniores marcados "Sim"** na distribuição padrão entram na **fila geral** (os "Não" recebem só por **regra específica/exceção** — ex.: Thiago, Ana Patrícia, Thaíse); **(3)** Júnior/Estagiário nunca recebem agenda direto (vêm do sênior via **time**); **(4)** **Complexidade** (`eligible_complex=true`) só para **Bruno, Hudson, Patrícia, Keilane** — passada por áudio (não há coluna). ⚠️ interpretação a confirmar: **Bruno=Maxwel Bruno Santos Costa**, **Hudson=Wdyson Neres Moreira da Costa**, **Patrícia=Ana Patrícia Cruz**, **Keilane=Keilane Alves** — **confirmar com o Thiago antes de gravar** (default do importador: não setar `eligible_complex` até confirmação, ou aplicar via lista de nomes parametrizável).

---

## Contexto / o que JÁ EXISTE vs NOVO

### JÁ EXISTE (reusar — NÃO reconstruir)

- **Usuários + convite:** `sistema-hv/src/lib/users-service.ts` — `inviteUser({email, full_name, role})` (dispara `inviteUserByEmail` → `/nova-senha`, cria `system_users` status `INVITED`; ativa em `activateUser` no primeiro login). `getMyProfile` já lê `phone`. Papéis validados por `assertRole`.
- **Mapping ProJuris:** `system_projuris_executor_mapping` (`projuris_responsavel_id` TEXT, `executor_id` FK `system_users`, `active`, `weight`, `eligible_complex`, `authorized_task_types`, `authorized_themes`) — migrations `20260728000001` / `20260805000001` (seed dos 15 do ProJuris já existe — a importação vai ATUALIZAR esses, casando por e-mail/ID).
- **Permissões por módulo:** `system_user_module_perms` (`user_id`, `module` ∈ comercial/operacional/financeiro/controladoria/inteligencia/marketing/sistema, `access` ∈ none/view/edit NULLABLE, `can_view_values` BOOLEAN NULL) — migrations `20260718000001` + `20260719000009`. Serviço `sistema-hv/src/lib/rbac-perms-service.ts`; gates em `sistema-hv/src/lib/rbac.ts`.
- **Peso considerado na data (M9):** `sync-core.ts` já lê `weight` do mapping ativo na hora da distribuição (a regra "considera o peso atual na data" já é o comportamento — a importação só popula o `weight`).
- **Convite/onboarding (M8/F5):** e-mail → link → cria senha → entra conforme permissões — JÁ existe (`inviteUser` + `/nova-senha` + `activateUser`). Ao apagar o e-mail corporativo, o usuário **não some** (histórico preservado; suspender/excluir com reatribuição já existe — `project_categoria_delete_e_convite`).
- **Migrations via pg direto:** `npx tsx scripts/db-apply-pg.ts` da pasta `sistema-hv/`; dev=prod; rollback simétrico.

### NOVO (a construir nesta story)

- **Colunas nível + time em `system_users`** (M8): `nivel TEXT NULL CHECK IN ('estagiario','junior','senior')` e `time TEXT NULL`. Aditivas, nullable, + rollback + `db:types`. (Hoje `system_users` não guarda nível/time.)
- **Tratamento de usuários ARQUIVADOS (M17):** linhas com `Status usuário projuris = Desabilitado` **OU** `Status colaborador/e-mail = Inativo` **OU** sem e-mail ProJuris válido entram como **registro SEM acesso** — o importador **NÃO chama `inviteUser`** e marca o registro como arquivado/sem-acesso (mecanismo em **M17**: `status='ARCHIVED'` ou flag `sem_acesso`). Sem disparo de e-mail, sem conta Auth. (Motivo: aparecem como autor nas tarefas espelhadas do ProJuris — ver M17.)
- **Coluna `peticionante` no mapping (R5):** a planilha tem **Peticionante (Sim/Não)** distinta de "Participa da distribuição". `Não ⇒ a pessoa NEM é considerada pelo motor`. Como `system_projuris_executor_mapping` hoje não guarda isso, **decidir**: (a) `ADD COLUMN peticionante BOOLEAN DEFAULT TRUE` (recomendado — o motor passa a filtrar `peticionante=true`), ou (b) tratar `active` como composto (participa E peticionante). Migration aditiva se (a). (Ver Dev Notes / R5.)
- **Importador idempotente** (script `scripts/import-colaboradores.ts` — recomendado — e/ou tela admin) que, por linha da planilha (após **trim de `\r\n`** em nome/e-mail/ID):
  1. **Casa por e-mail** (`system_users.email`, lower+trim): existe ⇒ ATUALIZA (`full_name`, `phone`, `nivel`, `time`, `role`); não existe ⇒ **cria**. Se ARQUIVADO (M17) ⇒ insert como registro sem acesso (SEM `inviteUser`); senão insert `INVITED` (disparo de convite fica no passo separado T4).
  2. **Upsert do mapping ProJuris** (`system_projuris_executor_mapping`) por `executor_id`: `projuris_responsavel_id` = ID `PES.*` (se em branco/`-`, deixa nulo/pendente e sinaliza), `weight` = Peso (100→1.0), `active` = (Participa=="Sim"), `peticionante` = (Peticionante=="Sim"), `eligible_complex` só p/ a lista confirmada (Bruno/Hudson/Patrícia/Keilane). "Só Sênior participa" ⇒ validação/aviso se Júnior/Estagiário vier Participa=Sim.
  3. **Upsert das permissões por módulo** (`system_user_module_perms`): **5 linhas** (Operacional/Comercial/Financeiro/Judicial/Controladoria) mapeando os **3 estados** "Não vê/Vê/Edita" → none/view/edit; `can_view_values` = (Vê valores=="Sim"). **Judicial** não está no CHECK atual de `module` (operacional/comercial/financeiro/controladoria/inteligencia/marketing/sistema) → **decidir**: ampliar o CHECK para incluir 'judicial' OU mapear "Ver Judicial" ao módulo correspondente. (Ver Dev Notes / R2.) Arquivados podem receber permissões `none`/skip (não logam de qualquer forma).
- **Dry-run**: modo que lê a planilha e mostra o plano (criaria/atualizaria N usuários — X ativos + Y arquivados —, M mappings, K permissões, avisos) SEM escrever — antes de rodar de verdade (padrão do owner: "dry-run → prod").
- **Relatório de importação**: por linha, o que foi feito + avisos (ID ProJuris ausente, nível vs participa inconsistente, arquivado, peticionante=Não, e-mail inválido, near-miss de ID, complexidade não confirmada).

## ⏳ PENDÊNCIAS RESTANTES (não bloqueiam o importador)

1. ✅ **Planilha recebida** (`Cadastro-Colaboradores-PREENCHIDO-2026-08-08.xlsx`).
2. **Telefones** — coluna veio em branco; o Thiago manda depois. Importador roda com `phone=null` e reprocessa quando chegarem (idempotente).
3. **Confirmar interpretação Bruno=Maxwel / Hudson=Wdyson** (complexidade) antes de gravar `eligible_complex`.
4. **Os 14 tipos** (quais ficam/saem + pontuação) — outra story (motor/pontuação).

---

## Acceptance Criteria

1. **Idempotência por e-mail:** rodar o importador 2× com a mesma planilha não duplica usuários/mappings/permissões (casa por `email`/`user_id`+`module`); a 2ª execução só reflete diferenças.
2. **Usuário criado/atualizado:** cada linha vira/atualiza um `system_users` com `full_name`, `email`, `phone`, `nivel` (Estagiário/Júnior/Sênior), `time`, `role`. Novos entram `INVITED`; existentes preservam status/histórico (não rebaixa ACTIVE→INVITED).
3. **Mapping ProJuris:** `system_projuris_executor_mapping` recebe `projuris_responsavel_id` (ID `PES.*`), `weight` (Peso, default 100 → normalizado p/ a escala do motor — ver Dev Notes), `active` = (Participa=="Sim"), `peticionante` = (Peticionante=="Sim"). ID ProJuris em branco/`-` ⇒ mapping fica pendente e é listado no relatório (não quebra o batch).
3b. **Usuários arquivados (M17):** linha com `Status usuário projuris = Desabilitado` OU `Status colaborador = Inativo` OU sem e-mail ProJuris ⇒ vira **registro SEM acesso** (sem `inviteUser`, sem conta Auth, marcado arquivado por M17). O relatório lista quantos ativos vs arquivados. O importador **nunca** envia convite a arquivado.
3c. **Peticionante:** `Peticionante=="Não"` ⇒ o registro NÃO é considerado pelo motor (grava `peticionante=false` — ou não cria mapping de distribuição). Só há flag "participa" efetiva quando `peticionante=true`.
4. **Regra "só Sênior participa":** se uma linha Júnior/Estagiário vier com Participa=Sim (ou Sênior com Não), o importador **avisa** no relatório (e aplica o que a planilha diz, ou bloqueia — decidir com owner; default: avisa e aplica a planilha). Na planilha real só **Keilane, Maxwel, Wdyson** vêm Participa=Sim.
5. **Permissões por módulo:** as 5 colunas de acesso viram `system_user_module_perms` (none/view/edit); `Vê valores` vira `can_view_values`. Ausência de override ⇒ segue padrão do papel (não força).
6. **Dry-run primeiro:** existe modo dry-run que imprime o plano completo (criações/atualizações/avisos) sem escrever; a execução real só ocorre com flag explícita.
7. **Convite opcional/controlado:** o disparo de e-mail de convite (`inviteUser`) é **separado** da importação de dados (o owner decide quando "o pessoal vai começar a usar" e dispara) — a importação pode rodar sem enviar e-mail (cadastro pré-montado), como o Thiago pediu ("já deixo cadastrado … depois disparo os e-mails").
8. **Regressão/segurança:** `npm run typecheck` + `npm run lint` verdes; `db:types` regenerado (colunas nível/time); RLS org-scoped preservada; casamento por e-mail case-insensitive/trim; nenhum segredo/senha em log; SÓ LEITURA no ProJuris (a importação não escreve lá).

---

## Tasks / Subtasks

### T0 — Receber a planilha preenchida (@sm / owner) — ✅ DESBLOQUEADO
- [x] **Planilha recebida:** `docs/reunioes/Cadastro-Colaboradores-PREENCHIDO-2026-08-08.xlsx` (39 linhas, 20 colunas). IDs ProJuris no formato `PES.*`. Colunas reais mapeadas acima.
- [ ] Pendências não-bloqueantes: **telefones** (Thiago manda), confirmação **Bruno=Maxwel / Hudson=Wdyson** (complexidade), 14 tipos (outra story).

### T1 — Schema nível + time + peticionante (@data-engineer)
- [ ] Migration aditiva `2026080700000X_users_nivel_time.sql` (+ rollback): `ADD COLUMN IF NOT EXISTS nivel TEXT CHECK (nivel IN ('estagiario','junior','senior'))`, `time TEXT` em `system_users`. `db:types` atualizado. Aplicar via `db-apply-pg.ts` (2× idempotente).
- [ ] Coluna **`peticionante BOOLEAN DEFAULT TRUE`** em `system_projuris_executor_mapping` (R5) + ajuste no `sync-core.ts` para filtrar `peticionante=true`. Aditiva + rollback.
- [ ] Depende de **M17** para o mecanismo de arquivado (`status='ARCHIVED'` ou flag `sem_acesso`). Alinhar a migration com M17 (mesmo passo de DDL, se conveniente).
- [ ] Decidir sobre módulo **'judicial'** no CHECK de `system_user_module_perms.module` (ampliar ou mapear) — R2.

### T2 — Parser da planilha (@dev)
- [ ] Ler a aba "Colaboradores" da planilha real, **trim de `\r\n`** em nome/e-mail/ID, normalizar cabeçalhos exatos (acentos: "Vê valores (R$)", "Status usuário projuris"), mapear Sim/Não e os **3 estados** Não vê/Vê/Edita para os enums. Validar e-mail (reusar `email-verify.ts` se aplicável). Tratar duplicata legítima Nicole (2 e-mails) sem fundir.

### T3 — Importador idempotente + dry-run (@dev + @data-engineer)
- [ ] `scripts/import-colaboradores.ts` (server, service role): por linha → classificar **ativo × arquivado** (M17) → upsert usuário (por e-mail; arquivado SEM `inviteUser`) → upsert mapping (por executor_id: `active`/`peticionante`/`weight`/`eligible_complex`) → upsert 5 permissões + can_view_values. Flag `--dry-run` (default) e `--apply`. Relatório por linha + avisos (ID ausente, nível×participa, arquivado, peticionante=Não, e-mail inválido, complexidade não confirmada).
- [ ] (Opcional) Tela admin de importação (upload do xlsx → preview do plano → aplicar) reusando o mesmo core — se o owner preferir UI ao script.

### T4 — Disparo de convite (@dev) — separado
- [ ] Comando/flag para disparar `inviteUser` aos importados (quando o owner autorizar "começar a usar"). Não acoplado à importação de dados.

### T5 — QA (@qa)
- [ ] Dry-run mostra plano correto; apply cria/atualiza sem duplicar; 2ª execução idempotente; permissões/valores/peso/participa corretos; avisos disparam nos casos previstos; `typecheck`/`lint` verdes.

---

## Dev Notes

- **Casar por e-mail, não por nome.** O seed dos 15 (`20260805000001`) usa e-mails sintéticos `projuris-<codigo>@projuris.local`; a planilha traz o e-mail corporativo real. A importação deve **casar por ID ProJuris quando presente** (atualiza o mapping semeado) e **atualizar o e-mail para o corporativo**; onde não houver ID, casar por nome contra o seed e sinalizar. Documentar a estratégia de reconciliação (não criar duplicata do mesmo colaborador que já veio no seed).
- **Escala do peso (100 vs 1.0).** A planilha usa "Peso 100" (humano); `system_projuris_executor_mapping.weight` é NUMERIC (o seed usa 1.0). Decidir a normalização: guardar 100 como 1.0 (dividir por 100) OU passar a tratar 100 como base no `sync-core`. **Recomendação: normalizar 100→1.0 na importação** para não mudar o engine; documentar. (M9: o motor já considera o `weight` atual na data — só precisamos popular certo.)
- **Judicial (R2).** "Ver Judicial" está na planilha, mas `system_user_module_perms.module` hoje NÃO tem 'judicial' no CHECK. Opções: (a) ampliar o CHECK para incluir 'judicial' (migration aditiva) — provável, já que a aba Judicial existe no caso; (b) mapear "Ver Judicial" para o módulo que hoje cobre o judicial. Confirmar com owner/arquitetura antes de aplicar.
- **Convite ≠ importação.** O Thiago quer "deixar cadastrado" e disparar os e-mails só quando for usar. Manter os dois passos separados evita convidar antes da hora.
- **Não sumir com histórico.** Ao atualizar um usuário existente, nunca rebaixar ACTIVE→INVITED nem apagar vínculos; a importação é aditiva/atualizante. Suspender/excluir com reatribuição continua sendo fluxo manual separado.
- **Migrations via pg direto** (`reference_aplicar_migrations_pg_direto`): `npx tsx scripts/db-apply-pg.ts`; dev=prod; rollback simétrico.

**Riscos:**
- **R1 — e-mail duplicado/typo** → conta errada. Mitigação: validação + dry-run + casamento case-insensitive/trim.
- **R2 — módulo 'judicial' fora do CHECK** → insert de permissão falha. Mitigação: decidir schema em T1 antes de importar.
- **R3 — ID ProJuris ausente** → executor não distribui. Mitigação: relatório lista pendências; mapping fica `active=false`/sem código até resolver.
- **R4 — peso em escala errada** → distribuição desbalanceada. Mitigação: normalização documentada + revisão no dry-run.
- **R5 — Peticionante sem coluna no schema** → não dá pra filtrar "fora do motor". Mitigação: `ADD COLUMN peticionante BOOLEAN DEFAULT TRUE` no mapping (T1) + filtro no `sync-core.ts`; até lá, tratar Peticionante=Não como `active=false`.
- **R6 — convidar arquivado por engano** → e-mail para conta que não deve logar. Mitigação: classificação ativo×arquivado ANTES do upsert (M17); arquivado nunca chama `inviteUser`.
- **R7 — `\r\n` em nome/e-mail/ID** → e-mail não casa / ID `PES.*` inválido. Mitigação: trim obrigatório no parser (T2).

### Testing
- Planilha de 3 linhas (1 sênior participa, 1 júnior não, 1 sem ID) → dry-run: 3 usuários, 3 mappings (1 pendente), 15 permissões, 1 aviso (júnior×participa se aplicável).
- Apply → tabelas populadas; 2ª execução idempotente.
- Permissões refletem none/view/edit + can_view_values; peso normalizado; participa→active.
- Convite disparado só no passo dedicado.

---

## Dependências

- **Depende de (entregues):** `system_users` + `inviteUser`/`activateUser`/`/nova-senha` (users-service); `system_projuris_executor_mapping` (+ seed dos 15); `system_user_module_perms` (+ `can_view_values`); `rbac-perms-service.ts` / `rbac.ts`; `sync-core.ts` (lê `weight`/`active`).
- **Relaciona com:** **M17** (usuários arquivados — o importador consome o mecanismo de "registro sem acesso" dela), M8/M9 (nível/participa/peso — igualar tela de convite×editar é UI complementar), H5 (mapping por usuário — mesma tabela destino), M14 (Observações pode conter exceção de responsável exclusivo), M12/M13 (motor).

## File List (previsto — nada implementado até desbloqueio)

- `sistema-hv/supabase/migrations/2026080700000X_users_nivel_time.sql` (+ rollback) — `nivel`/`time` em `system_users`; (possível) 'judicial' no CHECK de `system_user_module_perms.module`; **`peticionante` em `system_projuris_executor_mapping`** (R5).
- (M17) migration do mecanismo de **arquivado/sem-acesso** em `system_users` (`status='ARCHIVED'` ou flag) — consumida por este importador.
- `sistema-hv/src/lib/supabase/types.ts` — colunas novas.
- `sistema-hv/src/lib/distribuicao/sync-core.ts` — filtrar `peticionante=true` (R5).
- `sistema-hv/scripts/import-colaboradores.ts` (NOVO) — parser (trim `\r\n`) + classificação ativo×arquivado + importador idempotente + dry-run/apply + relatório.
- (opcional) tela admin de importação reusando o core.

## Change Log

| Data | Versão | Descrição | Autor |
|------|--------|-----------|-------|
| 2026-08-07 | v0.1 | Draft. **Blocked** aguardando a planilha `Cadastro-Colaboradores-Sistema-HV.xlsx` preenchida. Colunas reais confirmadas na planilha (Nome/E-mail/Telefone/Cargo/Time/ID ProJuris/Participa/Peso/Ver 5 módulos/Vê valores/Observações). Importador idempotente por e-mail (dry-run→apply): upsert `system_users` (+ colunas novas `nivel`/`time`) + `system_projuris_executor_mapping` (ID/weight/active) + `system_user_module_perms` (none/view/edit + `can_view_values`). Convite (`inviteUser`) fica em passo separado. Pendências de decisão: escala do peso (100→1.0) e módulo 'judicial' no CHECK. Reusa fluxo de convite/onboarding e RBAC existentes. | @sm (Bob) |
| 2026-08-08 | v0.2 | Planilha recebida; mapeamento real + tratamento de arquivados. Pendente: telefones + confirmação complexidade. Colunas REAIS mapeadas (`Cadastro-Colaboradores-PREENCHIDO-2026-08-08.xlsx`, 39 linhas/20 colunas): Perfil × Cargo distintos, ID `PES.*`, `Status usuário projuris` (Habilitado/Desabilitado), **Peticionante** (nova flag do motor — R5, coluna nova no mapping), 5 módulos com **3 estados** (Não vê/Vê/Edita), Vê valores. ~24 linhas Desabilitado/Inativo → **registro sem acesso via M17** (importador NÃO convida). Achados: `\r\n` em nome/e-mail/ID (trim), duplicata legítima Nicole (2 e-mails, não fundir), "Usuário master" sem ID. Complexidade (Bruno/Hudson/Patrícia/Keilane) só por áudio — confirmar antes de gravar. Status **Blocked → Ready (planilha recebida)**. Depende de M17 (arquivado) + coluna `peticionante`. | @sm (Bob) |
| 2026-08-08 | v1.0 (parcial) | **DRY-RUN + arquivados aplicados** (@aios-master/Orion). NOTA: R5 (peticionante) e cargo/perfil já ficaram em `system_users` (M8), não no mapping — supersede o plano antigo. **Parser+dry-run** `scripts/import-colaboradores-dryrun.py` (openpyxl): 39 linhas → **25 ativos / 14 arquivados**; trim `\r\n`; classifica arquivado (status_projuris=Desabilitado ∨ status colab=Inativo ∨ sem e-mail); mapeia role/cargo/equipe/perms(none/view/edit)/can_view_values; grava JSON normalizado. **Achado do dry-run:** eligible_complex=4 OK (Ana Patrícia/Keilane/Maxwel/Wdyson); **fila geral só Keilane+Maxwel** — Wdyson vem **participa=Sim mas peticionante=Não** (contraditório → confirmar com Thiago); 11 sem PES = prestadores/suporte (fora do motor, ok). **Schema:** migration `20260808000070` (coluna `equipe` em system_users + `judicial` no CHECK de `system_user_module_perms.module`) aplicada 2× + rollback. **Importador** `scripts/import-colaboradores.ts` (pg direto). **APLICADO só os 14 ARQUIVADOS** (sem Auth/e-mail): upsert `system_users` status='ARCHIVED' + de-para `system_projuris_executor_mapping` active=false (p/ espelho judicial resolver autor). Idempotente (14 criado→14 atualizado). Typecheck+lint verdes. **PENDENTE:** ativos (data sem convite) + disparo de convites — precisa (a) Thiago confirmar Wdyson, (b) decisão de onboarding/Auth (pré-registro vs invite), (c) telefones. Não commitado. | @aios-master (Orion) |
