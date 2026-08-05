# Story A9: Motor de Distribuição de Tarefas (integração ProJuris)

**Épico:** ProJuris / Distribuição
**ID:** A9
**Status:** Draft
**Estimativa:** XL
**Executor sugerido:** @data-engineer + @dev + @architect · Quality gate: @qa + @architect
**Risco:** ALTO — integração externa (ProJuris) + escrita em produção (write-back de tarefas)

---

## Story

**Como** controladoria/gestor do escritório,
**quero** que o sistema autentique no ProJuris, importe o relatório de intimações (prazos), **pontue** cada intimação pela dificuldade operacional (tipo de tarefa × assunto/tema), aplique as exceções de responsável-exclusivo e **distribua** as tarefas balanceando a carga entre os executores,
**para** substituir a distribuição manual de prazos por um motor justo e auditável — parando de sobrecarregar uns e ociosar outros — e materializar cada tarefa na agenda (SHV e/ou ProJuris) com prazo previsto e prazo fatal.

> **NOTA DE ESCOPO (travada nesta story):** A infraestrutura do motor (tabelas, RLS, imutabilidade, pgcron, telas de configuração, hook `useDistribuicao`) **JÁ EXISTE** — foi entregue nas migrations `20260728*`/`20260729*`. Esta story NÃO reconstrói o motor: ela **liga o motor à realidade do escritório** — semear a pontuação/exceções da planilha do Thiago, cadastrar os executores, gravar as credenciais ProJuris na config, e construir/validar o fluxo fim-a-fim (autenticar → importar intimações → pontuar → distribuir → agendar), com dry-run antes de qualquer efetivação.

---

## Contexto / o que JÁ EXISTE vs NOVO

### JÁ EXISTE (reusar — NÃO reconstruir)

**Modelo de dados / migrations (`sistema-hv/supabase/migrations/`):**
- `20260728000001_distribution_schema.sql` — schema v1.0: 8 tabelas + enums (`distribution_flow`, `batch_status`, `calendar_block_type`, `writeback_status`) + RLS org-scoped + **triggers de imutabilidade** (`system_prevent_distribution_modification`, `system_prevent_batch_log_modification`) + RPC `system_get_queue_state`. Tabelas: `system_distribution_results`, `system_distribution_queue_state`, `system_distribution_batch_logs`, `system_projuris_executor_mapping`, `system_task_type_mapping`, `system_theme_mapping`, `system_distribution_calendar`, `system_distribution_writeback_log`.
- `20260728000002_distribution_pgcron.sql` — agendamento (batch por `batch_hour`).
- `20260728000003_distribution_config.sql` — `system_distribution_config` (`mode` HIGH_PRODUCTION/HIGH_CONTROL, `batch_hour`) + estende `system_projuris_executor_mapping` com `weight`, `eligible_complex`, `authorized_task_types[]`, `authorized_themes[]`; estende `task_type_mapping`/`theme_mapping` com `*_descricao`. **Seed default** para `organization_id='00000000-0000-0000-0000-000000000001'`.
- `20260728000004_distribution_exceptions.sql` — `system_distribution_exceptions` (responsável exclusivo por tipo/tema).
- `20260728000005_distribution_simulations.sql` — `system_distribution_simulations` (dry-run/what-if).
- `20260729000001_distribution_projuris_credentials.sql` — adiciona à config: `projuris_base_url`, `projuris_auth_type` (`basic`/`bearer`/`apikey`, default `bearer`), `projuris_username`, `projuris_password`, `projuris_token`, `projuris_api_key`. **A auth do ProJuris vive AQUI (no banco, org-scoped, lida pelo service_role) — NÃO no `.env`.**

**Pontuação (as tabelas onde a planilha é semeada):**
- `system_task_type_mapping` (`projuris_tipo_codigo`, `motor_task_type_id`, **`points`** NUMERIC, `complexity_level` 0-2, `temporal_level` 0-2, `active`, `projuris_tipo_descricao`) — pontuação por **TIPO** de tarefa. UNIQUE `(projuris_tipo_codigo, organization_id)`.
- `system_theme_mapping` (`projuris_tema_codigo`, `motor_theme_id`, **`multiplier`** NUMERIC, `temporal_level`, `active`, `projuris_tema_descricao`) — pontuação por **ASSUNTO/tema**. UNIQUE `(projuris_tema_codigo, organization_id)`.
- **Pontuação final ≈ `points` (tipo) × `multiplier` (assunto)** — validar a fórmula exata contra a implementação do motor antes de semear.

**Telas / UI (`sistema-hv/src/routes/controladoria.distribuicao.*`):**
- `controladoria.distribuicao.tsx` (layout) + `.index.tsx` (dashboard).
- `.configuracao.tsx` — config do motor + **card de credenciais ProJuris** (grava `projuris_base_url`/`auth_type`/`username`/`password`/`token`/`api_key` na config; ver commit `226aa83`).
- `.executores.tsx` — cadastro/mapeamento de executores.
- `.tipos-tarefa.tsx` — pontuação por tipo (`task_type_mapping`).
- `.temas.tsx` — pontuação por assunto (`theme_mapping`).
- `.excecoes.tsx` — exceções (responsável exclusivo).
- `.calendario.tsx` — bloqueios de calendário.
- `.simulador.tsx` — dry-run / simulação.
- `.lista.tsx` / `.historico.tsx` / `.relatorio.tsx` / `.indicadores.tsx` — resultados, batches, relatórios, KPIs.

**Hook / dados:**
- `sistema-hv/src/hooks/useDistribuicao.ts` + `sistema-hv/src/hooks/useDistribuicaoDashboard.ts`.
- Tipos das tabelas/funções já saneados em `types.ts` (commit `cfcbfbc`).

**Insumos entregues pelo Thiago (2026-08-04):**
- **Credenciais:** `PROJURIS_API_CLIENTE_CODIGO=87696` + client secret (gravados no `.env.local`, mas o app autentica pela **config no banco** — o env é só cópia de referência).
- **Doc `PROJURIS PARA SISTEMA HVA.docx`** = mapeamento oficial (ver seção Mapeamento).
- **Planilha `regras pontuação dificuldade operacional (3).xlsx`** — aba `pontuacao_tarefa` (44 tipos) + aba `pontuacao_assunto` (27 assuntos) + coluna "responsável exclusivo" (ver Regras de pontuação).

### NOVO (a construir/executar nesta story)

- **Seed reprodutível** (script idempotente + rollback) que popula `system_task_type_mapping` e `system_theme_mapping` a partir da planilha; e `system_distribution_exceptions` a partir da coluna "responsável exclusivo".
- **Cadastro dos executores** reais (mapeamento `system_projuris_executor_mapping` — `projuris_responsavel_id` ↔ `system_users.id`), com `weight`/`eligible_complex`/autorizações.
- **Gravação das credenciais + base_url + auth_type** na `system_distribution_config` via tela de Configuração (não commitar segredo em migration/repo).
- **Cliente ProJuris** (Edge Function / server): autenticar (basic/bearer/apikey conforme `auth_type`) + importar o relatório de intimações + rate-limit (backoff ao bater limite) + write-back opcional da tarefa/responsável.
- **Fio do motor fim-a-fim**: importar → pontuar (tipo×assunto) → aplicar exceções → distribuir balanceando carga (grava `system_distribution_results`; usa `system_distribution_queue_state`) → materializar tarefa (SHV aba Tarefas + `system_distribution_calendar` e/ou write-back ProJuris).
- **Dry-run/simulação** (`system_distribution_simulations`) antes de efetivar.

---

## Mapeamento SHV↔ProJuris

Fonte: `PROJURIS PARA SISTEMA HVA.docx` (Thiago, 2026-08-04).

| Conceito SHV / Motor | Campo ProJuris | Observação |
|---|---|---|
| TEMA (frente) | **Assunto** | dirige o `multiplier` de `system_theme_mapping` |
| Individual / Coletivo | **Marcador** ProJuris | classificação do processo/tarefa |
| Complexo (N2) | **Marcador** ProJuris | alimenta `complexity_level` / `eligible_complex` |
| Prioritário | **Marcador** ProJuris | alimenta `temporal_level` / prioridade |
| Tipo de tarefa | **Tipo de tarefas** | dirige `points` de `system_task_type_mapping` |
| Prazo limite interno | **Prazo previsto** | `preferred_date` / `applicable_limit` |
| Prazo fatal | **Prazo fatal** | `final_date` (data-limite dura) |

**NÃO existem no ProJuris (regra 100% do lado SHV):**
- Pontuação (`points`, `multiplier`).
- Níveis de complexidade (`complexity_level`, `temporal_level`, N2).
- Responsável-exclusivo (exceções) → `system_distribution_exceptions`.

> Consequência de design (ver D3): os "marcadores" do ProJuris (Individual/Coletivo/Complexo/Prioritário) são hoje **marcadores** — decidir se migram para **campos personalizados** no ProJuris ou se o SHV os lê como marcadores e deriva os níveis internamente.

---

## Regras de pontuação (fonte)

Planilha `regras pontuação dificuldade operacional (3).xlsx`.

**Aba `pontuacao_tarefa` (44 tipos → `system_task_type_mapping.points`):**
- Ex.: Despacho **3.0**, Apelação **2.0**, Protocolo **0.5** (amostra; os 44 tipos vêm da planilha).
- Cada linha: `projuris_tipo_codigo` (código/descrição ProJuris do tipo) → `points` (+ `complexity_level`/`temporal_level` quando a planilha indicar).

**Aba `pontuacao_assunto` (27 assuntos → `system_theme_mapping.multiplier`):**
- Ex.: DEFESA MÉDICA **2.0**, INDENIZAÇÃO PMMB **1.7** (amostra; os 27 assuntos vêm da planilha).
- Cada linha: `projuris_tema_codigo` (código/assunto ProJuris) → `multiplier`.

**Coluna "responsável exclusivo" (→ `system_distribution_exceptions`):**
- Audiência → **Thiago**
- Sustentação Oral → **Thiago** (e/ou indenização PMMB)
- INDENIZAÇÃO PMMB → **Thaise**
- TEMFC → **Patrícia**

> A pontuação final de uma intimação combina o `points` do TIPO com o `multiplier` do ASSUNTO. Quando houver responsável-exclusivo aplicável, a exceção **sobrepõe** o balanceamento de carga (a tarefa vai obrigatoriamente para o executor da exceção). Validar precedência exata (exceção > carga) contra o motor.

---

## Acceptance Criteria

1. **Semear pontuação (tipos):** script idempotente + rollback popula `system_task_type_mapping` com os 44 tipos da aba `pontuacao_tarefa` (`projuris_tipo_codigo`, `points`, `complexity_level`, `temporal_level` quando houver, `active=true`), respeitando o UNIQUE `(projuris_tipo_codigo, organization_id)` (upsert `ON CONFLICT`). Confirmado por contagem (44) e amostragem (Despacho 3.0, Apelação 2.0, Protocolo 0.5).

2. **Semear pontuação (assuntos):** mesmo script popula `system_theme_mapping` com os 27 assuntos da aba `pontuacao_assunto` (`projuris_tema_codigo`, `multiplier`, `temporal_level` quando houver, `active=true`), upsert `ON CONFLICT`. Confirmado por contagem (27) e amostragem (DEFESA MÉDICA 2.0, INDENIZAÇÃO PMMB 1.7).

3. **Semear exceções (responsável exclusivo):** as regras da coluna "responsável exclusivo" (Audiência→Thiago; Sustentação Oral→Thiago/PMMB; INDENIZAÇÃO PMMB→Thaise; TEMFC→Patrícia) são gravadas em `system_distribution_exceptions`, referenciando os `system_users.id` reais dos executores.

4. **Cadastrar executores:** os 4-5 executores reais são mapeados em `system_projuris_executor_mapping` (`projuris_responsavel_id` ↔ `executor_id`), com `weight`, `eligible_complex`, `authorized_task_types[]`, `authorized_themes[]` conforme regra do escritório. UNIQUE `(projuris_responsavel_id, organization_id)` respeitado.

5. **Gravar credenciais na config (banco, não env):** pela tela de Configuração (`controladoria.distribuicao.configuracao.tsx`), o admin grava `projuris_base_url`, `projuris_auth_type` e as credenciais correspondentes (`username`/`password` para basic, `token` para bearer, `api_key` para apikey) em `system_distribution_config`. Segredos NÃO são commitados no repo (nem em migration). Máscara/write-only na UI para os campos de segredo.

6. **Autenticar + importar intimações (entrada):** o cliente ProJuris (Edge Function/server) lê a config, autentica no `projuris_base_url` pelo `auth_type` (basic/bearer/apikey) e importa o **relatório de intimações**. Cada intimação é normalizada (tipo de tarefa, assunto/tema, marcadores, prazo previsto, prazo fatal) e o payload bruto é guardado em `system_distribution_results.raw_data` (auditoria/reprocessamento).

7. **Pontuar cada intimação (tipo × assunto):** o motor calcula `final_points` cruzando `points` do tipo (`task_type_mapping`) × `multiplier` do assunto (`theme_mapping`), derivando `flow` (ABSOLUTE/COMPLEX/GENERAL) a partir de complexidade/marcadores. Tipo/assunto sem mapeamento gera **alerta** (`alerts[]`) em vez de falhar o batch.

8. **Aplicar exceções (responsável exclusivo):** quando a intimação bate uma exceção (`system_distribution_exceptions`), a tarefa é atribuída ao executor da exceção com `preference_applied=true`, **sobrepondo** o balanceamento de carga. Precedência: exceção > carga.

9. **Distribuir balanceando carga:** as intimações sem exceção são distribuídas entre executores elegíveis minimizando desequilíbrio de carga (usando `system_distribution_queue_state` para persistir saldos entre batches; respeitando `weight`, `eligible_complex`, `authorized_*`, e bloqueios de `system_distribution_calendar`). Resultado gravado em `system_distribution_results` (append-only/imutável).

10. **Materializar a tarefa (agenda):** para cada resultado, a tarefa é criada **no SHV** (aparece na aba Tarefas + no calendário `system_distribution_calendar`) e/ou é feito **write-back ao ProJuris** (registro em `system_distribution_writeback_log`, com `attempt`/`status`/`error`). O modo (SHV, ProJuris, ou ambos) depende da decisão D1.

11. **Rate-limit da API:** o cliente ProJuris respeita o limite de requisições da API — ao receber `429`/limite, aplica backoff/retry com teto e registra no `batch_logs.metrics`; um hit de limit NÃO corrompe o batch (retomável via `queue_state`).

12. **Simulação / dry-run antes de efetivar:** antes de gravar resultados definitivos e/ou fazer write-back, o operador roda uma **simulação** (`controladoria.distribuicao.simulador.tsx` → `system_distribution_simulations`) que mostra a distribuição projetada (quem recebe o quê, carga resultante) SEM efetivar. Só após revisão o batch é confirmado.

13. **Regressão / segurança:** RLS org-scoped e imutabilidade dos `results`/`batch_logs` preservadas; nenhum segredo vaza para logs/repo/front. `npm run typecheck` e `npm run lint` passam; `db:types` regenerado se houver DDL nova. Nenhuma tabela legada tocada.

---

## Tasks / Subtasks

### T0 — Design & desbloqueio (SPIKE — @architect, antes de codar)
- [ ] Obter e travar os BLOQUEIOS (ver "Perguntas em aberto"): `projuris_base_url` + `auth_type`; documentação/contrato da API ProJuris (endpoints de auth, relatório de intimações, write-back); códigos ProJuris de cada tipo/tema; os 4-5 executores (nome ↔ `projuris_responsavel_id` ↔ `system_users.id`); o relatório de intimações de teste; respostas D1/D2/D3. (todos os ACs)
- [ ] Validar a **fórmula de pontuação** real do motor (`points × multiplier`? soma de níveis?) contra a implementação existente antes de semear. (AC-7)
- [ ] Confirmar `organization_id` alvo (seed usa `...0001`). (AC-1..4)

### T1 — Seed de pontuação e exceções (@data-engineer)
- [ ] Ler as abas `pontuacao_tarefa` (44) e `pontuacao_assunto` (27) da planilha e mapear cada linha para o schema. (AC-1, AC-2)
- [ ] Script idempotente `scripts/seed-distribution-scoring.mjs` (upsert `ON CONFLICT`) + rollback SQL. Aplicar em dev via `npx tsx scripts/db-apply-pg.ts` (dev=prod). (AC-1, AC-2)
- [ ] Semear `system_distribution_exceptions` a partir da coluna "responsável exclusivo" (resolver nome→`system_users.id`). (AC-3)
- [ ] Validar por contagem + amostragem (Despacho 3.0 / Apelação 2.0 / Protocolo 0.5 / DEFESA MÉDICA 2.0 / INDENIZAÇÃO PMMB 1.7). (AC-1..3)

### T2 — Executores + credenciais (@dev)
- [ ] Cadastrar os 4-5 executores em `system_projuris_executor_mapping` (via tela `.executores.tsx` ou seed), com `weight`/`eligible_complex`/`authorized_*`. (AC-4)
- [ ] Gravar `base_url`/`auth_type`/segredos na config pela tela `.configuracao.tsx`; confirmar máscara/write-only e que nada vaza para repo/logs. (AC-5)

### T3 — Cliente ProJuris: auth + importação (@dev + @architect)
- [ ] Edge Function/server que lê a config, autentica pelo `auth_type` e chama o endpoint de intimações. (AC-6)
- [ ] Normalizar intimação → {tipo, assunto, marcadores, prazo previsto, prazo fatal}; guardar `raw_data`. (AC-6)
- [ ] Rate-limit: backoff/retry com teto ao bater 429/limite; registrar em `batch_logs.metrics`; batch retomável. (AC-11)

### T4 — Motor: pontuar → exceções → distribuir (@dev + @architect)
- [ ] Pontuar cada intimação (tipo×assunto → `final_points`, `flow`); tipo/assunto sem mapeamento → `alerts[]` (não falha o batch). (AC-7)
- [ ] Aplicar exceções (responsável exclusivo) sobrepondo carga (`preference_applied=true`). (AC-8)
- [ ] Distribuir por carga com `queue_state`/`weight`/`eligible_complex`/`authorized_*`/calendário; gravar `system_distribution_results`. (AC-9)

### T5 — Materializar tarefa (agenda) (@dev)
- [ ] Criar a tarefa no SHV (aba Tarefas + `system_distribution_calendar`) conforme D1. (AC-10)
- [ ] Write-back opcional ao ProJuris com log em `system_distribution_writeback_log` (attempt/status/error). (AC-10)

### T6 — Dry-run / simulação (@dev)
- [ ] Fluxo de simulação (`.simulador.tsx` → `system_distribution_simulations`) mostra distribuição projetada sem efetivar; confirmação explícita antes do batch real. (AC-12)

### T7 — QA / regressão (@qa + @architect)
- [ ] `npm run typecheck` + `npm run lint` verdes; `db:types` regenerado se houve DDL. (AC-13)
- [ ] Confirmar RLS org-scoped + imutabilidade `results`/`batch_logs`; nenhum segredo em log/repo/front. (AC-13)
- [ ] Smoke fim-a-fim com o relatório de intimações de teste: importar → pontuar → simular → efetivar → agenda. (AC-6..12)

---

## Dev Notes

**A infra é reuso, não recriação.** O motor (8 tabelas + RLS + imutabilidade + pgcron + 13 rotas de UI + hook) já foi entregue nas migrations `20260728*`/`20260729*`. Esta story é sobre **dados reais + o fio da integração ProJuris + validação fim-a-fim**. Não recriar tabelas nem telas; estender só se um AC exigir DDL nova (então migration aditiva + rollback + `db:types`).

**Auth do ProJuris vive no BANCO.** `system_distribution_config.projuris_*` (migration `20260729000001`) guarda `base_url`/`auth_type`/`username`/`password`/`token`/`api_key`, org-scoped, lido pelo service_role na Edge Function. O `.env.local` com `PROJURIS_API_CLIENTE_CODIGO=87696` + secret é só cópia de referência — **a fonte de verdade para o app é a config no banco**. Nunca commitar segredo em migration/seed/repo (por isso o seed de T1 cobre pontuação/exceções, e credenciais vão pela TELA).

**Pontuação = combinação tipo × assunto.** `points` (`task_type_mapping`) e `multiplier` (`theme_mapping`) são multiplicados para `final_points`. Confirmar a fórmula exata (multiplicação pura? entra `complexity_level`/`temporal_level`?) contra a implementação do motor ANTES de semear, senão a pontuação semeada não bate com o cálculo em runtime.

**Marcadores × campos personalizados (D3).** Individual/Coletivo/Complexo(N2)/Prioritário são **marcadores** ProJuris. O motor precisa lê-los para derivar `complexity_level`/`temporal_level`/`flow`. Se ficarem como marcadores, o parser lê o marcador; se migrarem para campos personalizados (D3), o parser lê o campo. Decidir antes de escrever o normalizador (T3).

**Prazos.** Prazo previsto (ProJuris) → `preferred_date`/`applicable_limit`; Prazo fatal → `final_date`. `base_date` = data-base da distribuição. Validar como o motor deriva `applicable_limit` a partir de `flow` + calendário.

**Imutabilidade.** `system_distribution_results` e `system_distribution_batch_logs` têm triggers que bloqueiam UPDATE/DELETE (exceto `writeback_pending` no result e `running→completed/failed` no batch log). Qualquer correção de dados de teste em dev tem que respeitar isso (recriar org de teste ou usar harness com contexto controlado).

**Rate-limit.** Sem um limite conhecido da API ProJuris (BLOQUEIO), implementar backoff exponencial com teto + `Retry-After` se o header vier; registrar tentativas em `batch_logs.metrics`; o `queue_state` garante que um hit de limit no meio do batch seja retomável sem redistribuir o que já foi feito.

**Migrations via pg direto.** CLI Supabase quebrado no Windows/OneDrive — aplicar DDL/seed via `npx tsx scripts/db-apply-pg.ts` (ver `reference_aplicar_migrations_pg_direto`). dev=prod. Rollbacks em `sistema-hv/supabase/rollbacks/`.

**Riscos:**
- **R1 — write-back em produção.** Criar tarefa/mudar responsável no ProJuris real é irreversível pela API. Obrigatório dry-run (AC-12) + confirmação humana antes do 1º batch efetivo; começar com D1 = "SHV é fonte" (só leitura do ProJuris) se houver dúvida.
- **R2 — pontuação divergente.** Se a fórmula semeada ≠ fórmula do motor, a distribuição fica injusta silenciosamente. Mitigação: validar fórmula no T0 e conferir `final_points` de amostras contra cálculo manual.
- **R3 — mapeamento de código.** `projuris_tipo_codigo`/`projuris_tema_codigo` precisam ser os CÓDIGOS reais do ProJuris, não os rótulos da planilha. Sem os códigos (BLOQUEIO), a importação não casa tipo/assunto → tudo cai em `alerts[]`.
- **R4 — vazamento de segredo.** Máscara/write-only na UI + nunca logar a config crua + nunca commitar `.env.local`/seed com credencial.
- **R5 — rate-limit desconhecido.** Sem o teto da API, backoff conservador + monitorar `batch_logs`.

---

## Descobertas técnicas — 1ª fatia da integração (2026-08-04, @data-engineer)

Doc REST minerada (`SajAdv Rest Api.html` + `application.wadl` + Central de Ajuda Confluence do ProJuris ADV). **Namespace XSD:** `http://www.softplan.com.br/unj/schema/adv`.

### URL base + fluxo de autenticação (CONFIRMADO na doc)

- **URL de autenticação:** `https://apigw.projurisadv.com.br/auth/token` (gateway **Keycloak / OAuth2**).
- **URL dos serviços REST:** `https://api.projurisadv.com.br/adv-service/` (host legado `https://api.sajadv.com.br/adv-service/` aponta pro mesmo serviço).
- **Auth — método/corpo:** `POST` com `Content-Type: application/x-www-form-urlencoded`, campos:
  - `grant_type=password`
  - `client_id` = **`api_cliente_codigo`** (o `87696` que o Thiago mandou)
  - `client_secret` = o secret do Thiago
  - `username` = **`USUARIO$$DOMINIO_ESCRITORIO`** (usuário ProJuris + `$$` + domínio do escritório, do menu "Dados da conta")
  - `password` = senha desse usuário ProJuris
- **Resposta (JSON):** `{ access_token, expires_in, refresh_token, refresh_expires_in, token_type: "Bearer", scope }`. **Token expira em ~8h; limite de 480 req/min.**
- **Token nas chamadas seguintes:** header `Authorization: <access_token>` + `Accept: application/json` (a doc do ADV usa o token **CRU**, sem o prefixo `Bearer `; o client tenta cru e cai p/ `Bearer <token>` se levar 401).
- **⚠ Correção ao briefing:** o `GET /permissao/token?token-permissao=...` do índice REST **NÃO é o login** — ele só resolve/valida um token de permissão e devolve um número. O login de verdade é o `POST /auth/token` acima (Keycloak), fora do `/adv-service`. `TipoAutenticacaoType` (`SENHA`/`CERTIFICADO_DIGITAL`/...) e `UsuarioAutenticacaoWs` são o **perfil do usuário retornado**, não o corpo do login.

### Endpoints de leitura mapeados (GET, `{URL_SERVICE}` = `.../adv-service`)

- **Colaboradores/usuários:** `GET /adv-service/usuario` (todos) · `/usuario/{codigo}` · `/usuario/nome?nome-usuario=` · `/usuario/consulta?quan-registros=&pagina=&filtro-geral=`.
- **Assuntos/temas (CNJ):** `GET /adv-service/processo/assunto`.
- **Tipos de tarefa / consultas genéricas:** `GET /adv-service/tipo?chave-tipo={CHAVE}` — chaves úteis: `tarefa-tipo` (tipos de tarefa), `usuario`, `assunto`, `andamento-tipo`. Lista de chaves em `GET /adv-service/tipo/chave`.
- **Tarefas / Andamentos / Processos:** páginas próprias na Central de Ajuda (fora do escopo desta fatia de leitura).

### Artefatos entregues nesta fatia (código)

- `sistema-hv/src/lib/projuris/client.ts` — client server-only: lê credenciais de `process.env` (ou por parâmetro), autentica no `/auth/token`, cacheia o token (renova 60s antes de expirar) e expõe `projurisGet(path, query?)` (só leitura). Não expõe segredo no browser.
- `sistema-hv/scripts/projuris-smoke.ts` — smoke **SÓ-LEITURA**: autentica → `GET /usuario` → `GET /processo/assunto` (conta + 10 amostras) → **reconciliação** (relatório) contra `system_theme_mapping`. Nenhum POST/PUT/DELETE de escrita. Rodar: `npx tsx --env-file=.env.local scripts/projuris-smoke.ts`.

### Resultado do smoke (2026-08-04)

- **AUTH = HTTP 401** (Keycloak, body vazio, `x-content-type-options: nosniff`). O gateway está **acessível** e aceita o formato do request (não é 404/DNS/URL errada) — a rejeição é de **credenciais**. Causa: só temos `client_id`(87696)+`client_secret`; o grant `password` **exige também `username` (USUARIO$$DOMINIO) + `password`** de um usuário ProJuris real (o `client_credentials` puro também deu 401). **→ BLOQUEIO: pedir ao Thiago o usuário+domínio+senha ProJuris de serviço** (ou habilitar o client p/ `client_credentials`, se a Softplan suportar).
- **Reconciliação (lado SHV validada):** `system_theme_mapping` tem **26 temas** e `system_task_type_mapping` **44 tipos**; hoje `projuris_tema_codigo` guarda o **NOME placeholder** (ex.: `1% COVID`, `ANISTIA`, `CÍVEIS`, `INDENIZAÇÃO PMMB`). O de-para nome→código real do ProJuris **só fecha depois que a auth funcionar** (aí o script lista `SHV placeholder → código ProJuris | nome` e imprime `casaram/total`). Nada foi gravado no banco.

### Decisões do owner registradas (2026-08-04)

- **D1 — ProJuris = fonte da verdade.** O SHV **espelha** o ProJuris (ProJuris→SHV): importa intimações, pontua, distribui e mostra na agenda SHV. Write-back ProJuris fica p/ fase posterior (R1). Esta fatia é **só leitura**.
- **D2 — Sim, haverá automação.** Concluir tarefa X dispara Y e distribui p/ Z (workflow encadeado sobre a distribuição) — escopo de fase seguinte, depois do fio de leitura/pontuação validado.
- **Códigos/executores descobertos via API** — os `projuris_tipo_codigo`/`projuris_tema_codigo`/`projuris_responsavel_id` reais saem dos GETs (`/tipo?chave-tipo=tarefa-tipo`, `/processo/assunto`, `/usuario`), não de digitação manual.
- **Entrada = relatório diário de intimações** (prazos do dia) — insumo do batch de distribuição.

---

## Perguntas em aberto (bloqueiam design)

**Do Thiago (2026-08-04) — precisam de decisão do owner antes de finalizar o design:**

- **D1 — Fonte da verdade.** O ProJuris é a fonte da verdade e o SHV **espelha** (importa intimações, distribui, mostra na agenda SHV) — OU o SHV **alimenta** o ProJuris (write-back de tarefa/responsável)? Isso define se o AC-10 é só-SHV, só-write-back, ou ambos. **Recomendação SM:** começar em "ProJuris é fonte / SHV espelha" (só leitura) até o motor estar validado; ligar write-back depois (R1).

- **D2 — Automações/workflow nas tarefas criadas via SHV.** Quando uma tarefa criada pelo SHV é concluída (concluiu X), deve **iniciar Y e distribuir para Z** automaticamente? Se sim, isso é um motor de workflow encadeado sobre a distribuição — define escopo adicional (encadeamento de tipos de tarefa + regra de próximo-executor).

- **D3 — Migrar marcadores → campos personalizados.** Os marcadores ProJuris (Individual/Coletivo/Complexo/Prioritário) devem migrar para **campos personalizados** no ProJuris (mais estruturado, melhor parsing) ou o SHV lê como marcadores? Define o normalizador (T3) e possivelmente trabalho no lado ProJuris.

**BLOQUEIOS (insumos que faltam para executar):**
- ~~`projuris_base_url` + `projuris_auth_type` reais~~ **RESOLVIDO 2026-08-04** (ver "Descobertas técnicas": auth `https://apigw.projurisadv.com.br/auth/token` OAuth2/Keycloak `grant_type=password`; serviços `https://api.projurisadv.com.br/adv-service/`; token no header `Authorization`).
- **🔴 Usuário de serviço ProJuris** (`username` no formato `USUARIO$$DOMINIO` + `password`) — o grant `password` exige, e só temos `client_id`+`client_secret` (smoke deu **401**). Pedir ao Thiago.
- Os **códigos ProJuris** de cada tipo (44) e assunto (26) — saem via API (`/tipo?chave-tipo=tarefa-tipo` e `/processo/assunto`) assim que a auth funcionar; hoje `projuris_*_codigo` é NOME placeholder (R3).
- Os **4-5 executores** reais: nome ↔ `projuris_responsavel_id` ↔ `system_users.id` (código sai de `GET /usuario`).
- Um **relatório de intimações** (payload real anonimizado) para o smoke fim-a-fim.
- Resposta **D3** (D1/D2 já decididas — ver "Descobertas técnicas").

---

## Testing

- **Seed (DB):** rodar `seed-distribution-scoring.mjs` → contar 44 em `system_task_type_mapping` e 27 em `system_theme_mapping`; amostrar Despacho 3.0 / Apelação 2.0 / Protocolo 0.5 / DEFESA MÉDICA 2.0 / INDENIZAÇÃO PMMB 1.7; rodar 2× → sem duplicatas (upsert). Exceções: 4 regras em `system_distribution_exceptions` resolvendo para `system_users.id` corretos.
- **Auth/importação:** com a config gravada, autenticar no ProJuris (basic/bearer/apikey) e importar o relatório de teste; conferir normalização e `raw_data` preenchido; forçar 429 (mock) → backoff + `batch_logs.metrics`.
- **Pontuação:** conferir `final_points` de N intimações de teste contra cálculo manual (tipo×assunto); tipo/assunto sem mapeamento → `alerts[]`, batch não falha.
- **Exceções:** intimação de Audiência → Thiago (`preference_applied=true`), sobrepondo carga; TEMFC → Patrícia; INDENIZAÇÃO PMMB → Thaise.
- **Distribuição:** distribuir lote de teste sem exceção → carga balanceada respeitando `weight`/`eligible_complex`/`authorized_*`/calendário; `queue_state` persiste saldos entre 2 batches.
- **Materialização:** tarefa aparece na aba Tarefas + calendário SHV (D1); write-back (se ligado) registra em `writeback_log` com status.
- **Dry-run:** simulação mostra a distribuição projetada SEM gravar `results`; confirmar → efetiva.
- **Segurança/regressão:** RLS org-scoped (outra org não lê); imutabilidade de `results`/`batch_logs` (UPDATE/DELETE bloqueado); nenhum segredo em log/front; `npm run typecheck` + `npm run lint` verdes.

---

## Dependências

- **Infra do motor** (migrations `20260728*`/`20260729*` + rotas `controladoria.distribuicao.*` + `useDistribuicao.ts`) — JÁ APLICADA; base desta story.
- **Credenciais ProJuris + contrato da API** (Thiago) — BLOQUEIO.
- **Planilha `regras pontuação dificuldade operacional (3).xlsx`** — fonte do seed (T1).
- **Doc `PROJURIS PARA SISTEMA HVA.docx`** — fonte do mapeamento SHV↔ProJuris.
- **`system_users`** — executores precisam existir como usuários do sistema (para `executor_id`).
- **Aplicação de migrations/seed via pg direto** (`reference_aplicar_migrations_pg_direto`) — CLI Supabase indisponível no ambiente.
- **A6 (timeline)** — se a materialização da tarefa gerar evento, alinhar nome de evento com A6.
- **Decisões D1/D2/D3** — bloqueiam o design final de import×write-back e automações.

---

## File List

**A definir na implementação. Previsto:**

**Seed / scripts (novos):**
- `sistema-hv/scripts/seed-distribution-scoring.mjs` (task_type + theme + exceptions a partir da planilha) + rollback SQL em `sistema-hv/supabase/rollbacks/`.

**Cliente/motor (novos ou estendidos):**
- ✅ `sistema-hv/src/lib/projuris/client.ts` (server-only: auth OAuth2/Keycloak + `projurisGet` só leitura + cache de token) — **entregue 2026-08-04 (1ª fatia)**.
- ✅ `sistema-hv/scripts/projuris-smoke.ts` (smoke só-leitura: auth → `/usuario` → `/processo/assunto` → reconciliação com `system_theme_mapping`) — **entregue 2026-08-04**.
- Edge Function / server do cliente ProJuris (importação de intimações + rate-limit; write-back = fase posterior por D1). Reusa `client.ts`.
- Lógica de pontuação/exceção/distribuição (se não estiver 100% no motor existente).

**UI (estender existentes — sem reconstruir):**
- `sistema-hv/src/routes/controladoria.distribuicao.configuracao.tsx` (credenciais/base_url/auth_type — já tem card).
- `sistema-hv/src/routes/controladoria.distribuicao.executores.tsx` / `.tipos-tarefa.tsx` / `.temas.tsx` / `.excecoes.tsx` / `.simulador.tsx` (conferir cobertura dos ACs).
- `sistema-hv/src/hooks/useDistribuicao.ts` (novas mutations/queries se necessário).

**Migrations (só se algum AC exigir DDL nova):**
- `sistema-hv/supabase/migrations/2026080400000X_*.sql` + rollback simétrico + `db:types`.

---

## Change Log

| Data | Versão | Descrição | Autor |
|------|--------|-----------|-------|
| 2026-08-04 | v0.2 | **1ª fatia da integração ProJuris (leitura).** Minerada a doc REST (`SajAdv Rest Api.html` + `application.wadl` + Central de Ajuda). URL base descoberta: auth `https://apigw.projurisadv.com.br/auth/token` (OAuth2/Keycloak, `grant_type=password`, x-www-form-urlencoded, `client_id`=api_cliente_codigo 87696 + `client_secret` + `username`=USUARIO$$DOMINIO + `password`; resposta `access_token`/`Bearer`, 8h, 480 req/min); serviços `https://api.projurisadv.com.br/adv-service/`; token no header `Authorization`. Corrigido: `/permissao/token` NÃO é o login. Entregues `src/lib/projuris/client.ts` (server-only, `projurisGet` só leitura) + `scripts/projuris-smoke.ts` (auth + `/usuario` + `/processo/assunto` + reconciliação com `system_theme_mapping`, só leitura). Smoke: **AUTH 401** (gateway OK, faltam `username`+`password` do usuário ProJuris — só temos client_id+secret → novo BLOQUEIO). Reconciliação (lado SHV): 26 temas / 44 tipos, `projuris_tema_codigo` hoje é NOME placeholder; de-para fecha quando a auth passar. Decisões do owner: **D1** ProJuris=fonte (SHV espelha, só leitura nesta fatia); **D2** sim haverá automação (fase posterior); códigos/executores via API; entrada = relatório diário de intimações. `tsc`/`eslint` verdes nos arquivos novos (só o erro pré-existente em `contaazul/service.ts`). | @data-engineer |
| 2026-08-04 | v0.1 | Draft inicial da story A9 (motor de distribuição ProJuris). Infra JÁ existe (migrations `20260728*`/`20260729*` + rotas `controladoria.distribuicao.*` + `useDistribuicao`). Escopo: semear pontuação (44 tipos / 27 assuntos) + exceções da planilha do Thiago; cadastrar executores; gravar credenciais na config do banco; cliente ProJuris (auth+import+rate-limit+write-back); fio fim-a-fim pontuar→exceções→distribuir→agendar; dry-run. 13 ACs. BLOQUEIOS: base_url/auth_type, códigos ProJuris de tipo/tema, 4-5 executores, relatório de intimações de teste, respostas D1/D2/D3. | @sm |
