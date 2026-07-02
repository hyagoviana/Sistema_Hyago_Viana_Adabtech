# Plano de Sprints — Rodada pós-reunião (2026-07-02)

> **Revisão v2 — incorpora parecer @architect + @qa (2026-07-02).** Correções factuais (trigger de bifurcação dropado na 0022), bug do no-op de `liberarCasoComercial`, ancoragem de checklist por `stage_slug`, guarda de reprocesso do webhook ZapSign no cutover, reversão CLIENTE→PERDIDO, CAs de RBAC/auditoria/LGPD testados no servidor e nova seção "Matriz de Testes Mínimos". Ver CHANGELOG v1→v2 no fim do arquivo.
>
> **Revisão v2.1 — pedido do owner (2026-07-02): bug de UX transversal do breadcrumb/título por ID.** Adicionada **S4-06 — Breadcrumbs e títulos por NOME, nunca ID** (Sprint 4, UX transversal, baixo esforço / alta visibilidade): páginas de detalhe abertas por rota com UUID nunca podem exibir o ID cru no breadcrumb nem no título da aba — devem SEMPRE mostrar o nome legível do registro. Solução genérica (resolver de nome por param→entidade), não conserto pontual. Levantamento de rotas afetadas no código incluído na story. +1 caso na Matriz de Testes Mínimos (caso 18). Ver CHANGELOG v2→v2.1 no fim do arquivo.
>
> **Revisão v2.2 — 4 decisões do owner (2026-07-02) que SIMPLIFICAM o plano.** (1) **ZapSign fica em SANDBOX** por enquanto; o objetivo agora é validar a lógica da virada automática lead→cliente em sandbox (simulação/replay do webhook) — S4-01 deixa de ser "habilitar produção" bloqueante e vira "validar a lógica em sandbox"; o **cutover de produção** (virar a chave + cadastrar webhook em prod + guarda anti-replay ex-R-ARCH-8) vira **GATE FUTURO documentado** (não bloqueia a S1); **S1-07 deixa de estar bloqueada por produção** e passa a ser validável em sandbox. (2) **Qualquer usuário autenticado promove** lead→cliente e marca PERDIDO — sem restrição por cargo; procuração assinada promove automaticamente; removidas as CAs de RBAC-por-papel de S1-03 (mantida a auditoria de ator/timestamp) e **relaxada a trava de RBAC das notas jurídicas** em S4-03 (qualquer usuário lê/escreve; mantém soft-delete + trilha). (3) **Regras de nome do Drive virão depois** — S2-06 marcada DEPENDENTE de input do owner (matching parametrizável/aguardando); não bloqueia a Sprint 2 (checklist manual S2-04/05 funciona sem auto-check). (4) **Migração MANUAL** — S1-06 reescrita: sem dry-run/relatório de ambíguos; migration só adiciona `lifecycle` + DEFAULT não-disruptivo p/ legados; divisão real é MANUAL pelo usuário (botões "marcar como cliente / não é cliente" + anexar doc assinado com validação de magic bytes). Ver CHANGELOG v2.1→v2.2 no fim do arquivo.
>
> **Revisão v2.3 — decisão do owner (2026-07-02) sobre o estado inicial dos legados na S1-06.** A migração deixa de ser **100% manual** e passa a **REGRA SIMPLES INICIAL + CORREÇÃO MANUAL**. (a) **Classificação inicial determinística** (uma migration idempotente): caso com **procuração assinada no sistema** — `system_cases.assinatura_liberada_at IS NOT NULL` **OU** existe `system_case_documents` com `doc_kind='procuracao'` e `status='ASSINADO'` para o caso — **nasce CLIENTE**; **todo o resto nasce LEAD**. (b) **Correção manual das exceções** (principalmente os "assinados por fora", que começam LEAD por não terem sinal no sistema): botão "marcar como cliente / não é cliente" por caso (S1-03) + **anexar o documento assinado** (upload existente com validação de magic bytes). (c) A regra é **idempotente e reversível**: rodar 2x dá o mesmo resultado e **só classifica quem ainda está sem `lifecycle` definido** — correções manuais posteriores **não são sobrescritas**. Removida a nota ⚠ pendente do v2.2 (o default dos legados está **DECIDIDO**). S1-06 reescrita; Matriz de Testes ajustada (grupo C). Ver CHANGELOG v2.2→v2.3 no fim do arquivo.
>
> **Autor:** @pm (Product Manager, AIOS) · **Data:** 2026-07-02
> **Escopo:** destravar o uso real do sistema (lead/cliente por caso), estruturar onboard por checklist, montar a estrutura do funil financeiro e habilitar a virada automática via ZapSign.
> **Fonte de decisão:** reunião do owner de 2026-07-02 (decisões travadas) + auditoria de código do @architect + edge cases do @qa.
> **Convenção:** docs de sprint vivem na RAIZ do git em `docs/sprints-*`; migrations em `sistema-hv/supabase/migrations/`; tabelas com prefixo `system_`.

---

## 0. Princípios travados nesta rodada

1. **Pessoa única por CPF; status DERIVADO por caso.** Cadastro (pessoa) ≠ lead ≠ cliente. As "abas" Leads/Clientes são **filtros/views** sobre a mesma base `system_clients`, não tabelas físicas separadas. O ciclo de vida (LEAD | CLIENTE | PERDIDO) vive **no caso** (`system_cases`), não na pessoa. Uma pessoa pode ser LEAD num caso e CLIENTE em outro **ao mesmo tempo**.
2. **Gatilho lead→cliente = procuração assinada** (ZapSign, `doc_kind='procuracao'`) referente **àquele caso**. Como nem tudo passa por ZapSign, **botões manuais lead→cliente por caso são obrigatórios**.
3. **IA no lead: só preparar a estrutura** (campos `status_lead`, `dias_parado`, timeline manual). Sem IA nesta rodada.
4. **Financeiro: só a ESTRUTURA agora** — etapas editáveis + gates "OK para avançar" + persistência no banco + edição. Os critérios de cada gate o owner define depois.
5. **Adiado (documentado no BACKLOG, não fazer agora):** termo financeiro completo (calculadora, parcial/complementar, preview do termo, % êxito), ERP Conta Azul + Asaas, boleto/link/follow-up, e-mail vs Meta, monitoramento WhatsApp, painel de renovação anual.

---

## 1. Estado atual do banco (JÁ EXISTE — não reconstruir)

Anexado aos nomes REAIS lidos no código/migrations:

| Recurso | Onde | Observação |
|---|---|---|
| `system_clients` — pessoa única por CPF | `20260523000001_init.sql` | Índice **único parcial** `system_clients_cpf_cnpj_org_active_unique` (por org, só ativos). `custom_fields JSONB` (mig. 0025). |
| `system_cases` (1:N com cliente) | `20260523000004_cases.sql` | `macrostatus_op`, `macrostatus_fin`, `service_type_id`, `stage_op_id`, `stage_fin_id`. **CHECK de `macrostatus_op` já foi RELAXADO** (mig. 0017). |
| Fase comercial no caso | `20260622000003_caso_comercial.sql` | Colunas `aguardando_assinatura_at`, `assinatura_liberada_at/_by`. `system_case_documents.doc_kind` (ex.: `'procuracao'`). |
| Flag de saída do operacional | `20260610000001_entrada_financeiro.sql` | `removido_do_operacional_at` + funções `system_fn_entrar_financeiro(uuid,bool)` e `system_fn_voltar_ao_operacional(uuid)` (padrão idempotente de gate — **modelo a reusar**). **Esta migration (0022) DROPA `trg_system_cases_bifurcacao` (`:28`)** — o trigger de bifurcação **não dispara mais**; a função homônima fica só p/ rollback. |
| Pipeline configurável por tipo | `20260608000003_s13_espinha.sql` + `20260609000001_pipelines_por_tipo.sql` | `system_service_types`, `system_pipeline_stages (kind op/fin, slug, label, ordem, stage_role won/lost/closed/normal)`. Trigger `system_fn_sync_stage_ids()` projeta `macrostatus_* → stage_*_id`. |
| Termo (snapshot imutável) | `20260608000007_s17_termo.sql` | `system_termo_snapshots` já modelado (NÃO mexer nesta rodada além de ligar preview). |
| Docs por caso | `20260608000001_case_documents.sql` + `20260622000006` | `system_case_documents (case_id, doc_kind, zapsign_doc_token, status, drive_file_id)`. |
| Timeline (base) | `20260523000004_cases.sql` | `system_case_events (action, from/to_macrostatus_op, diff, triggered_by)`. |
| Virada lead→cliente automática | `sistema-hv/src/lib/zapsign/webhook.ts` | Ao assinar `doc_kind='procuracao'`, chama `liberarCasoComercial(caseId,{via:'webhook'})`. `liberarCasoComercial` já existe e é **idempotente**. **⚠ NO-OP (`cases-service.ts:469`):** se `aguardando_assinatura_at IS NULL` retorna `alreadyLiberado:true` sem promover — por isso o botão manual precisa de `promoverCasoManual` (S1-03). Dedupe por token via `system_webhook_dedupe` (**só `UNIQUE(provider,external_id)`, SEM janela temporal** — ver S4-01 R-ARCH-8). |
| Criação de caso comercial | `sistema-hv/src/lib/cases-service.ts:46` (`createCase`) e `:376` (`createComercialCaseAndGenerateProcuracao`) | Caso "comercial" nasce com `aguardando_assinatura_at` setado. |
| RBAC + LGPD | `20260602000004_rbac_lgpd.sql` | `system_users` (1 papel/usuário), `system_consent_records`. |
| Kanban DnD | (front, já implementado) | Fase 1 concluída 2026-06-05. **Coexistência com auto-avanço é risco a tratar (S3).** |

**Bloqueantes de infra herdados (NÃO ignorar):**
- **ZapSign FICA em SANDBOX nesta rodada (decisão do owner v2.2).** O objetivo agora **não** é produção, e sim **validar a lógica da virada automática lead→cliente em sandbox** (simulação/replay do evento de assinatura no webhook). Como o sandbox **não dispara e-mail real**, a validação da promoção automática **cobre o caminho do webhook/simulação**, não o e-mail. Tratado na **Sprint 4 (S4-01 reescrita)**. O **cutover para produção** (virar a chave + cadastrar webhook em prod + guarda anti-replay) é um **GATE FUTURO documentado** (ver "Cutover ZapSign — futuro" no BACKLOG) e **NÃO bloqueia a S1**.
- **`createCase` vincula procuração/comercial no ato da criação** (`comercial===true` seta `aguardando_assinatura_at`). A decisão do owner é **desacoplar** (criar caso ≠ enviar procuração). Tratado na **Sprint 1 (S1-02)**.

---

## 2. Sequenciamento e dependências

```
SPRINT 1  (AUTOSSUFICIENTE — inclui virada automática validada em SANDBOX)
   │           S4-01 (validar lógica da virada em sandbox) roda dentro do escopo;
   │           NÃO depende de cutover de produção. S1-07 validável em sandbox.
   ├── SPRINT 2  (onboard/checklist; depende de estado de caso + editor de funil)
   └── SPRINT 3  (estrutura financeira; reusa padrão de gate da S2)
SPRINT 4 (telas)  S4-02 / S4-03 / S4-04  ← em PARALELO com/depois de S4-01
Cutover ZapSign → produção  ← GATE FUTURO (BACKLOG), NÃO bloqueia S1
```

- **S1 é autossuficiente para "começar a usar".** Como o ZapSign fica **sandbox** (decisão v2.2), a S1 **não depende de cutover de produção**. A validação da **virada automática lead→cliente é feita em sandbox** (simulação/replay do webhook) **dentro do escopo** — via S4-01 reescrita. S1-01 CA automática é provada em sandbox.
- **S1-07 (bug procuração não dispara) NÃO fica mais bloqueada por produção** — passa a ser validável em sandbox (criação do doc/token + caminho do webhook/simulação).
- **S1 é pré-requisito duro** de S2 e S3 (o estado LEAD/CLIENTE/PERDIDO e o find-or-create são base).
- **S4-02/03/04 (telas de leitura) seguem em paralelo**, sem bloquear S2/S3.
- **S2 e S3 compartilham** o padrão de "gate idempotente que avança etapa" (`system_fn_entrar_financeiro` como molde). Fazer S2 primeiro para amadurecer o padrão.
- **Cutover ZapSign → produção é GATE FUTURO** (virar a chave + cadastrar webhook em prod + guarda anti-replay ex-R-ARCH-8) — documentado no BACKLOG, **não bloqueia** esta rodada.

---

# SPRINT 1 — Lead/Cliente por caso (destrava o uso) `[M2]`

**Objetivo:** Transformar o modelo de "abas físicas" em **pessoa única + status derivado por caso**, com botões manuais de promoção, find-or-create por CPF na entrada comercial, estado terminal PERDIDO, desacoplamento do envio de procuração e migração segura dos dados atuais. Inclui 2 bugs bloqueantes de uso.

**Dependências:** nenhuma (fundação). **AUTOSSUFICIENTE (v2.2):** a virada automática lead→cliente é **validada em SANDBOX** dentro do escopo (S4-01 reescrita, simulação/replay do webhook) — **não depende de cutover de produção**. **S1-07 NÃO fica mais bloqueada por produção** (validável em sandbox). Habilita S2, S3, S4.

**Riscos de regressão (CORRIGIDO v2):**
- **`trg_system_cases_bifurcacao` foi DROPADO** na migration 0022 (`20260610000001_entrada_financeiro.sql:28`). **Não é risco vivo** — o trigger **não dispara mais**. A função homônima segue no banco **só para rollback**, mas está desconectada. **Nenhuma migration de S1/S3 pode RECRIAR esse trigger** (ver Matriz de Testes, caso 13).
- Os concorrentes reais no fluxo de escrita de `system_cases` são `system_fn_entrar_financeiro` (entrada manual no fin) + a projeção `system_fn_sync_stage_ids` (trigger **BEFORE**). Ambos **convivem bem** com a nova coluna `lifecycle` desde que a migration não introduza triggers AFTER conflitantes.
- Geração procuração→ZapSign (`CaseFormDialog`); unicidade de CPF; view `system_cases_active` (é `DROP+CREATE` a cada migration que toca colunas de `system_cases` — deve expor `lifecycle`/`perdido_at` e manter grants).

### Stories

**S1-01 — Estado de ciclo de vida explícito do caso (LEAD | CLIENTE | PERDIDO)** · NOVO
Hoje "lead perdido" **não tem estado terminal** — só existe `aguardando_assinatura_at` (LEAD implícito) e `assinatura_liberada_at` (CLIENTE implícito). Precisamos de estado 1ª classe.
- **NOVO:** migration adiciona `system_cases.lifecycle` TEXT com CHECK `IN ('LEAD','CLIENTE','PERDIDO')`, default `'LEAD'`, + coluna `perdido_at TIMESTAMPTZ` e `perdido_motivo TEXT`. **Coluna materializada** (não view derivada) para permitir index/filtro barato nas abas.
- **NOVO (R-ARCH-2) — Invariantes declaradas + CHECK/trigger de consistência:**
  - `assinatura_liberada_at IS NOT NULL ⇒ lifecycle = 'CLIENTE'`.
  - `perdido_at IS NOT NULL ⇒ lifecycle = 'PERDIDO'`.
  - **Nunca** `lifecycle = 'LEAD'` com `assinatura_liberada_at` preenchido.
  - Implementar como `CHECK` constraint quando expressável, senão trigger `BEFORE INSERT/UPDATE` de consistência (sem recriar nenhum trigger AFTER de bifurcação — ver riscos).
- **NOVO (R-ARCH-2) — Escrita centralizada:** TODA escrita de `lifecycle` passa por funções server-side (`liberarCasoComercial`, `promoverCasoManual`, `marcarCasoPerdido`, e a reversão de S1-01b). **Nunca** o front escreve `lifecycle` direto (RPC-only).
- **NOVO:** backfill na própria migration: `assinatura_liberada_at IS NOT NULL → 'CLIENTE'`; senão `'LEAD'` (o passo de exceções/ambíguos fica em S1-06).
- **JÁ EXISTE (reusar):** `liberarCasoComercial` deve passar a setar `lifecycle='CLIENTE'` (além de limpar `aguardando_assinatura_at`).
- **CA (testáveis):**
  1. Migration aplica **recriando `system_cases_active` (DROP+CREATE)** expondo `lifecycle`/`perdido_at`/`perdido_motivo` e mantendo grants `anon/authenticated/service_role`.
  2. Caso com procuração já assinada → `lifecycle='CLIENTE'` após backfill.
  3. Caso novo comercial → nasce `lifecycle='LEAD'`.
  4. **(Q-1 — reescrita)** Ao liberar (webhook OU manual), grava `system_case_events(action='liberado_comercial', diff.via ∈ {'webhook','manual'}, triggered_by)`. No caminho **manual**, `triggered_by` é **obrigatoriamente o usuário autenticado (não-null)**; no **webhook**, `triggered_by = null` e `diff.via='webhook'`.
  5. Marcar PERDIDO grava `perdido_at`, `perdido_motivo` e evento; caso some das views ativas de LEAD.
  6. **Invariante:** tentativa de gravar `lifecycle='LEAD'` com `assinatura_liberada_at` preenchido é **rejeitada** pelo CHECK/trigger.
  7. **Edge (QA):** pessoa é LEAD no caso A e CLIENTE no caso B **simultaneamente** — as duas views retornam a mesma pessoa sem duplicar.

**S1-01b — Reversão CLIENTE→PERDIDO (distrato/desistência pós-assinatura)** · NOVO (Q-3)
Hoje o plano só cobria LEAD→CLIENTE e LEAD→PERDIDO. Cliente que **distrata ou desiste DEPOIS de assinar** precisa poder voltar a PERDIDO, com auditoria.
- **NOVO:** `marcarCasoPerdido` (mesma RPC de S1-03) aceita origem `lifecycle='CLIENTE'`, transicionando para `PERDIDO` com motivo obrigatório. A invariante `perdido_at IS NOT NULL ⇒ lifecycle='PERDIDO'` continua válida; `assinatura_liberada_at` permanece registrado (histórico), mas o estado terminal passa a PERDIDO.
- **CA:**
  1. Caso `CLIENTE` (com `assinatura_liberada_at` preenchido) → `marcarCasoPerdido(motivo, userId)` → `lifecycle='PERDIDO'`, `perdido_at`/`perdido_motivo` gravados.
  2. Evento `system_case_events(action='perdido')` com `triggered_by` = usuário autenticado (não-null) e o motivo em `diff`.
  3. **(v2.2)** Ação exige apenas **login** — **qualquer usuário autenticado** pode reverter (sem restrição por cargo). A auditoria (ator não-null + timestamp) continua obrigatória.

**S1-02 — Desacoplar criação de caso do envio de procuração** · NOVO (ajuste de fluxo existente)
Decisão do owner: criar caso ≠ virar lead automaticamente por procuração. O envio da procuração é um **ato explícito**.
- **JÁ EXISTE:** `createCase` (`cases-service.ts:46`) seta `aguardando_assinatura_at` quando `comercial===true`; `createComercialCaseAndGenerateProcuracao` (`:376`) gera+prepara.
- **NOVO:** separar em 2 momentos — (a) criar caso em `lifecycle='LEAD'` **sem** disparar procuração; (b) ação "Enviar procuração" no caso, que gera doc + envia ZapSign. `aguardando_assinatura_at` passa a ser setado **no envio**, não na criação.
- **CA:**
  1. Criar caso comum não cria doc de procuração nem seta `aguardando_assinatura_at`.
  2. Botão "Enviar procuração" gera `system_case_documents(doc_kind='procuracao')` e (quando ZapSign prod, S4) dispara envio; seta `aguardando_assinatura_at`.
  3. **Regressão:** `CaseFormDialog` (fluxo de 2 etapas revisão→envio) continua funcionando; nenhum caso comercial existente perde a procuração já gerada.

**S1-03 — Botões manuais lead→cliente e lead→perdido, POR CASO** · NOVO (front) + reusa serviço
- **BUG CRÍTICO (R-ARCH-3) — o no-op de `liberarCasoComercial`:** `liberarCasoComercial` (`cases-service.ts:469`) faz **NO-OP** quando `aguardando_assinatura_at IS NULL` (retorna `alreadyLiberado:true`). Portanto o botão manual lead→cliente **NÃO pode reusar essa função crua** — senão um LEAD sem procuração ZapSign nunca vira CLIENTE. É **obrigatório** criar `promoverCasoManual` que seta `lifecycle='CLIENTE'` **INDEPENDENTE** da flag comercial (`aguardando_assinatura_at`).
- **NOVO:** RPC `promoverCasoManual(caseId, userId)` — seta `lifecycle='CLIENTE'` mesmo com `aguardando_assinatura_at IS NULL`; grava evento manual; idempotente para caso já CLIENTE. **Não** delega o caminho de decisão ao no-op de `liberarCasoComercial`.
- **NOVO:** RPC `marcarCasoPerdido(caseId, motivo, userId)` (também usada por S1-01b para reverter CLIENTE→PERDIDO).
- **NOVO (UI):** na ficha do caso e/ou no card do Kanban, botões "Marcar como cliente" e "Marcar como perdido".
- **DECISÃO DO OWNER (v2.2) — SEM restrição por cargo:** **qualquer usuário autenticado** pode promover lead→cliente e marcar PERDIDO. A ação exige **apenas login** (`userId` não-null); **não** há mais capability RBAC específica nem 403-por-papel para promoção/perda. **Confirmado:** quando a procuração é assinada (webhook, mesmo em sandbox), o caso **promove a cliente automaticamente** (via `liberarCasoComercial` → `lifecycle='CLIENTE'`). A **auditoria permanece obrigatória** (ator + timestamp em `system_case_events`).
- **CA:**
  1. **(Q-2)** `promoverCasoManual` promove um LEAD **SEM** `aguardando_assinatura_at` → `lifecycle` vira `CLIENTE` (prova que o no-op foi **tratado**, não herdado do `liberarCasoComercial` cru).
  2. Botão manual em caso **já** CLIENTE → no-op idempotente (não duplica evento nem erra).
  3. "Marcar como perdido" pede motivo, grava `perdido_at/motivo`, remove das views de LEAD ativas.
  4. **(v2.2 — sem RBAC por cargo)** Promoção e perda exigem **apenas usuário autenticado**; **qualquer** papel logado consegue executar (sem 403-por-cargo). RPC rejeita apenas chamada **não autenticada** (`userId` null).
  5. **(auditoria — mantida)** Toda promoção/perda manual grava **ator (`triggered_by` não-null) + timestamp** em `system_case_events`.

**S1-04 — Find-or-create por CPF na entrada comercial** · NOVO
Impede erro "seco" de unicidade quando um CPF já cadastrado entra como lead de **novo** caso.
- **JÁ EXISTE:** índice `system_clients_cpf_cnpj_org_active_unique`.
- **NOVO:** função `system_fn_find_or_create_client(cpf, full_name, ...)` (ou serviço equivalente em `clients-service`) que retorna o `client_id` existente (ativo) OU cria. A entrada comercial e o form de caso passam a usar isso.
- **NOVO (R-ARCH-4) — padrão upsert sob concorrência:** a função deve capturar `23505` (unique_violation) — que pode ocorrer entre o SELECT e o INSERT sob concorrência — e **RE-SELECIONAR** o registro existente, retornando-o. **Nunca estourar 500.** (find → não achou → tenta INSERT → colidiu 23505 → re-SELECT → retorna o existente.)
- **CA:**
  1. CPF **novo** → cria pessoa e retorna id.
  2. **(Q-4 — reescrita)** CPF **existente ativo com `full_name` divergente** → retorna o **existente**, **NÃO** sobrescreve o nome; retorna flag `conflitos: [{ campo, valor_atual, valor_novo }]` para o front exibir. **Merge só em campos vazios** (preenche o que estava null; nunca substitui valor existente).
  3. CPF de pessoa **soft-deleted** → cria nova (o índice é parcial em ativos) — comportamento consistente com o índice.
  4. **(R-ARCH-4)** Sob concorrência (2 inserts simultâneos do mesmo CPF), o 2º captura `23505` e **retorna o existente** — sem 500, sem duplicar cadastro.
  5. **Edge (QA):** pessoa já existente vira lead de 2º caso sem duplicar cadastro.

**S1-05 — Abas Leads/Clientes como filtros (views) sobre a base única** · NOVO (front) + views
- **NOVO:** views/consultas derivadas — LEAD = casos `lifecycle='LEAD'` (não perdidos, ativos); CLIENTE = casos `lifecycle='CLIENTE'`. A "aba" lista **pessoas** com pelo menos um caso naquele estado. Estrutura de campos p/ IA futura: `status_lead` (livre/enum), `dias_parado` (derivado de `status_changed_at`/último evento).
- **CA:**
  1. Aba Leads mostra pessoas com ≥1 caso LEAD; Aba Clientes idem para CLIENTE.
  2. Pessoa aparece nas DUAS abas se tiver casos em estados diferentes — sem duplicar linha dentro da mesma aba.
  3. `dias_parado` calculado e exibido (sem IA — só o número).
  4. PERDIDO não aparece em Leads (view separada/filtro "Perdidos").

**S1-06 — Migração: REGRA SIMPLES INICIAL + CORREÇÃO MANUAL** · REESCRITA (v2.3)
> **DECISÃO DO OWNER (v2.3):** a migração da base atual **deixa de ser 100% manual** e passa a **REGRA SIMPLES INICIAL + CORREÇÃO MANUAL**. Uma **migration idempotente** classifica os legados por uma **regra objetiva** e o time **corrige à mão** apenas as exceções (principalmente os "assinados por fora"). O default dos legados está **DECIDIDO** — não há mais nota pendente para o owner.

- **NOVO (classificação inicial determinística — migration idempotente):** a migration de S1-01 já adiciona `system_cases.lifecycle`. Esta story define a **regra objetiva** que popula `lifecycle` dos **registros legados**:
  - **Caso com procuração assinada NO SISTEMA → `lifecycle='CLIENTE'`.** Sinal de "assinada" (verificado no schema real):
    - `system_cases.assinatura_liberada_at IS NOT NULL` (mig. `20260622000003_caso_comercial.sql:17`), **OU**
    - existe `system_case_documents` para o caso com `doc_kind='procuracao'` **e** `status='ASSINADO'` (`status` CHECK em `20260608000001_case_documents.sql:33-35`; `ASSINADO` é valor válido).
  - **Todo o resto → `lifecycle='LEAD'`** (estado menos disruptivo; é também o default da coluna).
  - **Não altera** posição no Kanban op/fin nem `macrostatus_*` — só popula o novo campo `lifecycle`. **Nenhum caso é "perdido" nem promovido em massa** além do que a regra objetiva determina.
  - **Idempotente e reversível:** a migration **só classifica quem ainda está sem `lifecycle` definido** (ex.: `WHERE lifecycle IS NULL`, ou coerente com o default/backfill de S1-01). Rodar 2x **dá o mesmo resultado** e **NÃO sobrescreve** correções manuais feitas depois (um caso já ajustado à mão para CLIENTE/PERDIDO não volta a LEAD ao reprocessar). Respeita a invariante de S1-01 (`assinatura_liberada_at IS NOT NULL ⇒ CLIENTE`).
  - **Novos casos** criados a partir de agora seguem o fluxo normal: nascem **`'LEAD'`** ao enviar procuração (S1-02); promoção a CLIENTE só por assinatura (auto) ou botão manual.
- **NOVO (correção manual das exceções — integra com S1-03):** a regra acerta a maioria, mas **não** enxerga os **"assinados por fora"** (procuração assinada em papel/fora do sistema, sem sinal no banco) — esses **começam LEAD** e precisam de correção. Pelo botão **por caso** "marcar como cliente / não é cliente":
  - "marcar como cliente" → reusa `promoverCasoManual` (S1-03) → `lifecycle='CLIENTE'` + evento auditado.
  - "não é cliente" → o caso **permanece LEAD** (ou vai a PERDIDO se o usuário marcar via `marcarCasoPerdido`) — sem promoção.
- **NOVO (anexar documento assinado):** ao corrigir um "assinado por fora", **anexar o documento assinado** reusando o **upload existente com validação de magic bytes** (mesmo pipeline de S4-02) — grava em `system_case_documents` (`doc_kind='procuracao'`).
- **CA:**
  1. **Regra inicial — CLIENTE:** caso legado com procuração assinada **no sistema** (`assinatura_liberada_at IS NOT NULL` **OU** doc `doc_kind='procuracao'` com `status='ASSINADO'`) → nasce `lifecycle='CLIENTE'` (respeita a invariante de S1-01).
  2. **Regra inicial — LEAD:** caso legado **sem** sinal de assinatura no sistema → nasce `lifecycle='LEAD'`; posição no Kanban e `macrostatus_*` **inalterados**; **nenhum** caso ativo do operacional é rebaixado nem promovido em massa.
  3. **Idempotência/reversibilidade:** rodar a migration **2x não muda** as classificações e **não sobrescreve** correções manuais (caso ajustado à mão para CLIENTE/PERDIDO **permanece**; só entra na regra quem ainda está sem `lifecycle`).
  4. **Correção manual "assinado por fora":** caso assinado fora do sistema começa **LEAD**; usuário clica **"marcar como cliente"** → vira **CLIENTE** com evento auditado (ator + timestamp) **e anexa o doc assinado** — o anexo passa pela **validação de magic bytes** (inválido rejeitado; válido registrado em `system_case_documents`).
  5. Botão **"não é cliente"** → o caso **permanece LEAD** (não promove).

**S1-07 — BUG bloqueante: procuração não dispara** · JÁ EXISTE (corrigir) · **VALIDÁVEL EM SANDBOX (v2.2 — não bloqueada por produção)**
> **v2.2:** Como o ZapSign fica **sandbox**, esta story **NÃO** fica mais bloqueada por produção/webhook cadastrado. A validação é feita em **sandbox**: (a) criação do doc + `zapsign_doc_token`, e (b) o **caminho do webhook/simulação** que dispara a virada automática. Como o sandbox **não envia e-mail real**, a virada automática é provada **via replay/simulação do evento de assinatura**, não pela chegada do e-mail.

Sintoma herdado: e-mail ZapSign não chegava (envio era manual + sandbox não dispara e-mail; ver `project_procuracao_revisao_envio`).
- **CA:**
  1. O ato "Enviar procuração" cria o doc no ZapSign (sandbox) e registra `zapsign_doc_token` em `system_case_documents`; erro de dependência externa retorna **424** (não 5xx — ver `reference_vercel_5xx_gateway`) com mensagem legível no front.
  2. **(v2.2)** Simular/replay do evento de assinatura da procuração (webhook sandbox) → `liberarCasoComercial` roda → caso vira `lifecycle='CLIENTE'` com evento auditado — **provando a lógica da virada automática sem depender de e-mail real** (cobre o caminho do webhook/simulação, ver S4-01).

**S1-08 — BUG bloqueante: CEP/CEP-lookup não pode travar cadastro** · JÁ EXISTE (corrigir)
- **CA:** falha/timeout do lookup de CEP **não bloqueia** salvar o cadastro; campos de endereço continuam editáveis manualmente; erro vira aviso não-fatal.

---

# SPRINT 2 — Onboard: subetapas/checklist por etapa `[M4]`

**Objetivo:** Permitir que cada etapa do funil (por tipo de serviço) tenha um **checklist** de itens; um **gate idempotente** avança o caso à próxima etapa quando o checklist conclui; **editor de funil por tipo**; **auto-check por Drive em modo SUGESTÃO**; e **campos canônicos no caso** (ex.: nº FIES) em JSONB.

**Dependências:** S1 (estado do caso e find-or-create). Reusa `system_pipeline_stages` e o padrão idempotente de `system_fn_entrar_financeiro`.

**Riscos de regressão:** trigger de projeção `system_fn_sync_stage_ids`; DnD manual do Kanban (coexistência com auto-avanço — tratada aqui); unicidade de defs por (service_type+stage+key).

### Stories

**S2-01 — Tabelas de checklist (def + instância)** · NOVO
> **ANCORAGEM (R-ARCH-5):** o checklist é ancorado em **`stage_slug` + `service_type_id`**, **NÃO** em `stage_id`. Motivo: etapas **revivem por slug** via `ON CONFLICT` (recriar etapa com mesmo slug reusa/atualiza a linha), então `stage_id` não é estável entre migrations; `stage_slug` é a chave lógica durável.
- **NOVO:** `system_stage_checklist_defs` (`organization_id`, `service_type_id`, **`stage_slug`** (chave de ancoragem), `key`, `label`, `ordem`, `required BOOLEAN`, `active`, soft-delete; UNIQUE por `(service_type_id, stage_slug, key)` entre ativos). Segue padrão de `system_client_field_defs`.
- **NOVO:** `system_case_checklist_items` (instância por caso: `case_id`, `def_id`, **`stage_slug`**, `done BOOLEAN`, `done_at`, `done_by`, `source TEXT CHECK IN ('manual','drive_suggest')`, `drive_file_id` p/ dedupe, soft-delete).
- **CA:**
  1. Migrations criam ambas com RLS por org + grants no padrão do sistema.
  2. UNIQUE impede def duplicada por etapa; UNIQUE `(case_id, def_id)` impede item duplicado.
  3. `system_cases_active` intacta (não é afetada).

**S2-02 — Editor de funil por tipo (etapas + checklist)** · NOVO (front) + reusa infra
- **JÁ EXISTE:** `system_pipeline_stages` já é editável no schema (CRUD por tipo).
- **NOVO (UI):** tela admin que edita etapas (label/ordem/stage_role) e os itens de checklist (`defs`) por etapa/tipo. Gated por RBAC.
- **REGRA (R-ARCH-7) — editor não altera slug em uso:** o editor **NUNCA** altera o `slug` de uma etapa **em uso** (só `label`/`ordem`/`stage_role`). **Criar etapa nova = novo slug.** **Bloquear delete** de etapa em uso (que tenha casos ou checklist items ancorados).
- **CA:**
  1. Admin cria/edita/reordena etapas de um tipo sem quebrar casos existentes. **Delete de etapa em uso é bloqueado** (não órfã casos); editar `label`/`ordem`/`role` de etapa em uso é permitido.
  2. **(R-ARCH-7)** Tentar alterar o `slug` de uma etapa em uso é **rejeitado**; nova etapa é criada com **novo slug**.
  3. Admin adiciona/edita itens de checklist por etapa; `required` marcável.
  4. Alteração de defs **não** reescreve retroativamente instâncias já concluídas.

**S2-03 — Instanciar checklist ao entrar na etapa** · NOVO
- **NOVO (R-ARCH-5) — instanciação SERVER-SIDE dentro da transição:** ao caso entrar numa etapa (via move manual ou auto), materializar os `defs` ativos daquela etapa/tipo (por `stage_slug` + `service_type_id`) em `system_case_checklist_items` **dentro da transição de estado no servidor** (função/RPC de transição) — **NÃO** no componente front. Idempotente — não duplica se já instanciado.
- **CA:**
  1. Mover caso para etapa X cria os itens de X uma única vez, **disparado no servidor** (não depende de o front chamar).
  2. Re-mover para X (ida-e-volta) não duplica itens; preserva os já `done`.

**S2-04 — Gate idempotente "checklist conclui → avança etapa"** · NOVO (molde: `system_fn_entrar_financeiro`)
- **NOVO:** função `system_fn_avancar_se_checklist_ok(case_id)` — se todos os itens `required` da etapa atual estão `done`, promove o caso à próxima etapa `op` (menor `ordem` > atual, `deleted_at IS NULL`), via dual-write `macrostatus_op` (a projeção preenche `stage_op_id`).
- **NOVO (R-ARCH-5) — guarda de idempotência sob concorrência (molde `system_fn_entrar_financeiro`):** a função **lê o `macrostatus_op` no início** e aplica a promoção com a guarda `WHERE macrostatus_op = <etapa_esperada lida no início>` **DENTRO** da função (comparação após lock). Assim duas chamadas concorrentes não avançam 2 etapas — a 2ª vira no-op porque a guarda não casa mais.
- **CA:**
  1. Concluir o último item `required` avança o caso 1 etapa e grava `system_case_events`.
  2. Itens `required` pendentes → NÃO avança.
  3. Chamar 2x (concorrência) → avança 1 vez só (no-op na 2ª, pela guarda `WHERE macrostatus_op = esperado`).
  4. Última etapa (won/closed) → não tenta avançar além.

**S2-05 — Coexistência auto-avanço × DnD manual (precedência)** · NOVO (regra) — atende QA
- **NOVO:** definir precedência: **ação humana explícita (DnD) tem prioridade**; auto-avanço só dispara em resposta a `done` de checklist e nunca "puxa de volta" um card movido manualmente à frente. Guardar contra race: o gate só promove se a etapa atual ainda for a esperada.
- **CA:**
  1. Mover card manualmente para frente e depois concluir checklist da etapa antiga → NÃO regride o card.
  2. Concluir checklist e mover manualmente quase simultâneos → estado final é determinístico (sem duplicar eventos, sem "pingue-pongue").
  3. **(Q-6 — edge faltante)** Desmarcar um item `required` de uma etapa **JÁ ultrapassada** pelo gate **NÃO regride** o card automaticamente; em vez disso gera **alerta/evento "checklist inconsistente"** e **exige ação humana** (default = alerta, não regressão automática).

**S2-06 — Auto-check por upload no Drive (modo SUGESTÃO)** · NOVO — atende Architect/QA · **DEPENDENTE DE INPUT DO OWNER (v2.2) — NÃO bloqueia a Sprint 2**
Reconhecidamente **frágil**: só **sugere**; a promoção do item exige **confirmação humana**. Dedupe por `drive_file_id`.
> **DECISÃO DO OWNER (v2.2) — regra de matching pendente:** as **regras de nomenclatura dos arquivos** (convenção de nomes usada pelo auto-check) **virão depois** do owner. Portanto: a **estrutura pode ser construída** (tabelas, sugestão, dedupe, confirmação humana), mas a **regra de matching nome→item fica PARAMETRIZÁVEL/aguardando** o input do owner — sem regras fixas hardcoded. **Esta story NÃO bloqueia a Sprint 2:** o **checklist manual (S2-04/S2-05) funciona sem o auto-check**. Enquanto a convenção não chega, o auto-check pode ficar **desligado/em stub** e todos os itens são marcados manualmente.
> **MECANISMO DE DETECÇÃO (R-ARCH-6):** a sugestão nasce **NO MOMENTO DO UPLOAD PELO APP** (o fluxo de upload já grava `drive_file_id`), **NÃO** por polling do n8n — **esse polling não existe hoje**. Polling externo do Drive (varredura de arquivos criados fora do app) vai para o **BACKLOG (B-08)**.
- **CA:**
  1. Upload **pelo app** que casa um padrão de nome de item → cria **sugestão** (`source='drive_suggest'`, `done=false`), não marca `done` sozinho.
  2. Usuário confirma → `done=true`, `done_by` = usuário.
  3. **Dedupe:** mesmo `drive_file_id` não gera 2 sugestões.
  4. **(Q-7)** Sugestão `source='drive_suggest', done=false` **NÃO satisfaz** o gate de S2-04 — **só itens `done=true` (confirmados)** contam como `required` cumprido. Uma sugestão pendente não avança o card.
  5. **Edge (QA):** nome fora do padrão → **fallback manual + alerta**, nunca trava silenciosamente nem marca item errado.
  6. **(v2.2)** A regra de matching nome→item é **parametrizável** (não hardcoded) e **fica aguardando a convenção do owner**; com o auto-check **desligado/em stub**, o **checklist manual funciona normalmente** e o gate de S2-04 conclui só com itens marcados manualmente (a Sprint 2 não fica bloqueada).

**S2-07 — Campos canônicos no CASO (ex.: nº FIES) — JSONB no caso** · NOVO
Distinto dos custom fields de CLIENTE (`system_clients.custom_fields`).
- **NOVO:** `system_cases.canonical_fields JSONB` + índice GIN; defs opcionais por tipo (reusar padrão de `field_defs` se o owner quiser editor; MVP pode ser conjunto fixo por tipo).
- **CA:**
  1. Salvar nº FIES no caso persiste em `canonical_fields`, não em `custom_fields` do cliente.
  2. Campo aparece na ficha do caso e é buscável (ao menos por match de texto).

---

# SPRINT 3 — Estrutura do funil financeiro (SEM termo completo) `[M5]`

**Objetivo:** Deixar o **funil financeiro editável**, com **gates "OK para avançar"** que **movem o card** e **persistem no banco** + edição. **NÃO** entra o termo completo (calculadora/parcial/complementar/preview/% êxito → BACKLOG). Se couber, ligar o **preview do termo** (bug de UX).

**Dependências:** S1 (estado de caso) e S2 (padrão de gate + editor de funil reusados). `system_fn_entrar_financeiro` já existe como entrada no funil fin.

**Riscos de regressão:** trigger de projeção `stage_fin_id`; `system_fn_entrar_financeiro` (entrada no fin); `system_termo_snapshots` (não alterar schema — só leitura no preview). **Nenhuma migration de S3 pode recriar `trg_system_cases_bifurcacao` (dropado na 0022 — ver riscos de S1).**

### Stories

**S3-01 — Funil financeiro editável por tipo** · JÁ EXISTE (infra) + NOVO (UI)
- **JÁ EXISTE:** etapas `kind='fin'` em `system_pipeline_stages` (seed em mig. 0015); `system_fn_entrar_financeiro` resolve a 1ª etapa fin real.
- **NOVO (UI):** reusar o editor de funil da S2-02 para o `kind='fin'` (label/ordem/stage_role) — **incluindo a regra R-ARCH-7:** não altera `slug` de etapa em uso, bloqueia delete de etapa em uso.
- **CA:**
  1. Admin edita etapas fin de um tipo; `system_fn_entrar_financeiro` continua achando a 1ª etapa real (`slug<>'NAO_APLICAVEL'`, menor `ordem`).
  2. Editar etapas não corrompe casos já no financeiro.
  3. **(R-ARCH-7)** Editor não altera `slug` de etapa fin em uso; delete de etapa fin em uso é bloqueado.

**S3-02 — Checklist/gate por etapa financeira ("OK para avançar")** · NOVO (reusa S2)
- **NOVO:** aplicar `system_stage_checklist_defs`/`system_case_checklist_items` também a `kind='fin'` e criar `system_fn_avancar_fin_se_ok(case_id)` (molde do gate op). Critérios específicos de cada gate ficam **editáveis** (owner define os itens depois).
- **CA:**
  1. Concluir itens `required` da etapa fin avança o card fin (dual-write `macrostatus_fin` → projeção `stage_fin_id`) e grava evento.
  2. Pendências `required` → não avança.
  3. Idempotente sob concorrência (guarda `WHERE macrostatus_fin = esperado`, molde de S2-04).
  4. Persistência: recarregar a página mantém posição do card e estado do checklist (nada só-em-memória).
  5. **(Q-8)** Mover card fin de volta para `NAO_APLICAVEL` **permanece bloqueado** (regra de `moveCaseStatusFin`) **após** o refactor do editor de funil — o editor não abre brecha para regredir ao `NAO_APLICAVEL`.

**S3-03 — Mover/editar card financeiro + persistência** · JÁ EXISTE (parcial) + NOVO
- **JÁ EXISTE:** `moveCaseStatusFin` (`cases-service.ts:574`).
- **NOVO:** garantir edição das etapas e do checklist reflete no banco; coexistência DnD × auto-avanço no Kanban fin segue a regra da S2-05.
- **CA:**
  1. DnD manual no Kanban fin persiste e não é revertido por auto-avanço.
  2. Evento registrado em `system_case_events` em toda transição fin.

**S3-04 — (Se couber) Ligar preview do termo** · JÁ EXISTE (corrigir UX)
- **JÁ EXISTE:** `system_termo_snapshots`.
- **NOVO:** apenas **exibir** o preview (leitura) onde hoje falha; **sem** implementar calculadora/parcial/complementar/% êxito (BACKLOG).
- **CA:** abrir preview de um termo existente renderiza sem erro; ação de cálculo/edição do termo permanece fora de escopo (desabilitada/BACKLOG visível).

---

# SPRINT 4 — Virada automática em SANDBOX + docs/notas/timeline `[M3 + infra]`

**Objetivo:** **Validar a lógica da virada automática** lead→cliente **em SANDBOX** (simulação/replay do webhook ZapSign) e entregar as telas de leitura: **docs por caso**, **bloco de notas** (cliente/caso) e **timeline manual read-only**. **v2.2:** produção fica para depois — o **cutover** é GATE FUTURO no BACKLOG.

**Dependências:** **S4-01 (validar a virada em sandbox) roda dentro do escopo da S1** — é ele que **prova a AC de virada automática da S1** (S1-01 CA-4) e **valida S1-07** sem depender de produção. S4-02/03/04 (telas) seguem em paralelo. Requer apenas o ambiente **sandbox** já configurado (sem cutover na Vercel).

**Riscos de regressão:** idempotência do webhook (`system_webhook_dedupe`); upload/download com magic bytes. **O risco de reprocesso de histórico ao virar produção migra para o GATE FUTURO de cutover (BACKLOG) — não é risco desta rodada.**

### Stories

**S4-01 — Validar a lógica da virada automática em SANDBOX** · JÁ EXISTE (código) — REESCRITA (v2.2) — **roda dentro do escopo da S1; valida S1-01 auto e S1-07 sem produção**
> **DECISÃO DO OWNER (v2.2):** o ZapSign **fica em sandbox**; produção fica para depois. O objetivo desta story **deixa de ser "habilitar produção + cadastrar webhook"** (não é mais bloqueante) e **passa a ser validar a lógica da virada automática lead→cliente em sandbox**. Como o sandbox **não dispara e-mail real**, o teste **cobre o caminho do webhook/simulação** (replay do evento de assinatura), provando a promoção automática sem depender do e-mail.
- **JÁ EXISTE:** `processZapsignWebhook` (`src/lib/zapsign/webhook.ts`), rota `api.webhooks.zapsign.tsx`, dedupe, `liberarCasoComercial` (idempotente).
- **NOVO (sandbox):** **simular/replay** o evento de assinatura da procuração (`doc_kind='procuracao'`) contra a rota do webhook (payload sandbox ou fixture/smoke `scripts/zapsign-smoke.mjs`) e **provar ponta-a-ponta** que o caso vira **CLIENTE** (lifecycle) com evento auditado. Sem cutover, sem cadastrar webhook em prod.
- **CA:**
  1. **Simular/receber** o evento de assinatura da procuração (sandbox/replay) → doc vira `ASSINADO`, arquivo cai na **pasta do caso**, e `liberarCasoComercial` roda → caso vira `lifecycle='CLIENTE'` com **evento auditado** (`action='liberado_comercial', diff.via='webhook'`).
  2. **Idempotência (dedupe):** reenviar o **mesmo evento (mesmo token)** → **ignorado por dedupe** (não duplica arquivo nem promove 2x).
  3. **Sem e-mail real:** a virada automática é provada **via webhook/simulação** (sandbox não envia e-mail) — o teste **não** depende da chegada de e-mail.

> **GATE FUTURO — Cutover ZapSign → produção (ex-R-ARCH-8, movido para o BACKLOG):** virar credenciais sandbox→produção na Vercel + **cadastrar o webhook** no painel ZapSign + smoke em prod. **Antes de ligar produção** aplicar a guarda anti-replay OBRIGATÓRIA (o dedupe `system_webhook_dedupe` tem só `UNIQUE(provider,external_id)`, **SEM janela temporal**; ao virar produção, se o ZapSign reenviar histórico, promove casos indevidamente). Mitigantes: (a) **pré-popular** o dedupe com tokens conhecidos, (b) **guarda por data** `webhook_ativo_desde` ignorando `signed_at` anterior ao cutover, ou (c) **confirmar no painel** que não há replay. **NÃO faz parte desta rodada** — ver "Cutover ZapSign — futuro" no BACKLOG.

**S4-02 — Docs por caso (aba na ficha)** · JÁ EXISTE (revisar/consolidar)
- **JÁ EXISTE:** `system_case_documents`, `ClientCaseDocumentsSection`, `CaseDocumentsTab`, upload/download com magic bytes.
- **NOVO:** garantir que **todo doc vive dentro do caso** (Fase 2 do pedido do owner, ainda pendente), incluindo os recebidos por ZapSign.
- **CA:**
  1. Doc gerado/enviado/recebido aparece na aba do caso correto.
  2. **Regressão:** upload/download preserva validação de magic bytes.

**S4-03 — Bloco de notas (cliente e caso)** · NOVO
- **NOVO:** `system_case_notes` (e/ou notas de cliente) `case_id`/`client_id`, `body TEXT`, `created_by`, timestamps, soft-delete (`deleted_by`/`deleted_at`); RLS + grants padrão.
- **DECISÃO DO OWNER (v2.2) — sem restrição por papel:** o owner definiu que **"qualquer usuário pode fazer"** as notas. Portanto a trava de RBAC-por-papel é **RELAXADA**: **qualquer usuário autenticado lê/escreve** as notas (ação exige apenas login). **REMOVIDA** a exigência do set `advogado_titular / advogado_associado / admin` e o 403-por-papel. **MANTIDOS:** soft-delete com `deleted_by`/`deleted_at`, **nunca hard-delete**, e a trilha de auditoria (ator + timestamps). RLS continua por **org** (isolamento de organização), só **sem** filtro por cargo.
- **CA:**
  1. Criar/editar/excluir nota no caso e no cliente; persiste. **Qualquer usuário autenticado** consegue (sem 403-por-cargo); só chamada não autenticada é rejeitada.
  2. **(v2.2)** RLS/guard garantem apenas **isolamento por org** (usuário de outra org não vê); **não** há mais bloqueio por papel dentro da mesma org.
  3. Nota some da lista ao soft-delete (**nunca hard-delete**); `deleted_by`/`deleted_at` gravados e preservados (trilha de auditoria intacta).

**S4-04 — Timeline manual read-only** · JÁ EXISTE (base) + NOVO (UI + entradas manuais)
- **JÁ EXISTE:** `system_case_events` alimenta transições; `listCaseEvents` (`cases-service.ts:653`).
- **NOVO:** permitir **entrada manual** de eventos de timeline (nota/marco) exibidos read-only na ficha (base p/ IA futura, sem IA agora).
- **CA:**
  1. Timeline mostra eventos automáticos (created, status_changed, liberado_comercial, perdido) + manuais, ordenados por data desc.
  2. Entrada manual grava `triggered_by` e aparece imediatamente; itens são read-only após criados.
  3. **(Q-10)** Entrada manual de timeline é **gated por RBAC** (guard no servidor) e **NÃO permite editar/apagar eventos automáticos do sistema** — eventos automáticos são **read-only reais** (bloqueio no RPC, não só na UI).

---

## UX transversal (Sprint 4)

**S4-06 — Breadcrumbs e títulos por NOME, nunca ID** · **JÁ EXISTE** (breadcrumb + PageHeader) + **NOVO** (resolver de nome genérico) — **pedido do owner 2026-07-02**
Bug de UX transversal reportado pelo owner: páginas de detalhe abrem por rota com UUID e o **breadcrumb** (e o **título da aba do navegador**) mostram o **ID cru** em vez do nome legível. Exemplo real: `Painel / Casos / c18e562e-7a59-44bf-bc94-a473ed2b7e81`. **Exigência do owner:** **NUNCA** aparecer o ID — deve **SEMPRE** aparecer o **nome legível** do registro aberto (código/nome do caso, nome do cliente, nome do lead, título do doc, etc.). Como há **MUITAS abas que abrem por ID**, a solução precisa ser **TRANSVERSAL** (resolvedor genérico param→nome), não um conserto pontual por tela.

- **JÁ EXISTE:** o componente `Breadcrumb` (`src/components/hv/primitives.tsx:48`) e `PageHeader` (`:15`) já renderizam labels/títulos vindos da página. Algumas rotas já resolvem o nome corretamente — `casos.$id.tsx:164` usa `caso.case_code` e `clientes.$id.tsx:97` usa `cliente.full_name`. O que **falta** é: (a) rotas de detalhe que ainda exibem o segmento cru, (b) título da aba dinâmico e (c) fallback/erro padronizados.
- **JÁ EXISTE (limitação):** o título da aba é **estático global** — `__root.tsx:79` (`head: () => ({ meta:[{ title: "Hyago Viana Advocacia" }] })`). **Nenhuma** rota de detalhe hoje define `document.title`/`head` dinâmico por registro. Isso é o pedaço NOVO principal.
- **NOVO — resolver genérico param→nome:** um utilitário/hook (ex.: `useEntityLabel(entidade, id)` ou um mapa de resolvers por tipo de entidade) que, a partir do dado **já carregado no loader/página** (TanStack Router), produz o **label legível** e o injeta tanto no `Breadcrumb` quanto no título da aba (via `head`/`document.title`). O front **nunca** monta o segmento de breadcrumb/título com o UUID — o UUID vira só o argumento de resolução.
- **NOVO — fallback obrigatório:** enquanto o nome carrega, mostrar **placeholder** ("Carregando…" ou skeleton), **NUNCA** o UUID. Em registro inexistente/erro (404), mostrar **rótulo genérico** por entidade ("Caso não encontrado", "Cliente não encontrado", "Conversa não encontrada", etc.), **NUNCA** o UUID.
- **NOVO — título da aba (`document.title`):** cada rota de detalhe passa a compor o título da aba com o **nome** do registro (padrão sugerido: `"{Nome} — Hyago Viana Advocacia"`), via `head` dinâmico do TanStack Router (com acesso ao dado do loader) ou set explícito em efeito. Placeholder/erro seguem a mesma regra do breadcrumb (nunca UUID).

**Levantamento — rotas de detalhe afetadas (lidas no código, `src/routes/`):**

| Rota | Param | Estado hoje | Ação |
|---|---|---|---|
| `casos.$id.tsx` | `$id` | Breadcrumb **OK** (`caso.case_code`), **título da aba estático** | Só ligar título da aba por nome |
| `clientes.$id.tsx` | `$id` | Breadcrumb **OK** (`cliente.full_name`), **título da aba estático** | Só ligar título da aba por nome |
| `casos.$id.termo.tsx` | `$id` | **Sem** breadcrumb por caso; `PageHeader` fixo "Termo de Acerto" | Breadcrumb `Casos / {case_code} / Termo` + título por nome |
| `casos.$id.termo.elaborar.tsx` | `$id` | Detalhe aninhado sob `$id`; sem nome do caso no topo | Breadcrumb/título por nome do caso |
| `peticionamento.$id.tsx` | `$id` | `PageHeader` fixo "Editor de Minuta"; sem nome/nº | Resolver nome da peça/minuta; título por nome |
| `whatsapp.conversas.$id.tsx` | `$id` | `PageHeader` fixo "Conversa"; sem nome do contato | Resolver nome do contato; título por nome |
| `portal.casos.$id.tsx` | `$id` | `PageHeader` fixo "Meu Caso"; sem código do caso | Resolver código/nome do caso; título por nome |
| `api.clients.$id.documents.$docId.tsx` e `.download.tsx` | `$id`/`$docId` | Rotas **de API** (sem breadcrumb/UI), mas carregam IDs no path | Fora do breadcrumb; garantir que labels derivados (nome do doc) usem título, não `$docId`, onde renderizados na aba de docs |

> Observação: `casos.$id.tsx` e `clientes.$id.tsx` **já cobrem o breadcrumb** — o defeito visível do owner (`Casos / <uuid>`) reaparece nas rotas **de detalhe aninhadas/irmãs** que herdam o segmento sem resolver o nome, e o **título da aba** está errado em **todas** (estático global). O resolver genérico padroniza os dois pontos e evita regressão futura em novas telas `$id`.

- **CA (testáveis):**
  1. Abrir **qualquer** página de detalhe por ID → o **breadcrumb** exibe o **nome legível** do registro (código/nome do caso, nome do cliente, nome do contato, título do doc), **nunca o UUID**.
  2. O **título da aba do navegador** (`document.title`) usa o **nome** do registro (não o ID, não o título global estático).
  3. Durante o carregamento, breadcrumb e título mostram **placeholder/skeleton** ("Carregando…"), **nunca o UUID**; em **erro/404**, exibem **rótulo genérico por entidade** ("Caso não encontrado" etc.), **nunca o UUID**.
  4. **Varredura:** nenhuma rota de detalhe conhecida (lista da tabela acima — casos, clientes/pessoas, termo, peticionamento, conversa WhatsApp, portal do caso, documentos) renderiza o **UUID** no breadcrumb nem no título — validado rota a rota.
  5. **Regressão:** rotas que já resolviam o nome (`casos.$id`, `clientes.$id`) continuam corretas; o resolver genérico **não** quebra o breadcrumb existente.

---

# BACKLOG — Adiado (documentado como certo p/ depois)

> Não fazer nesta rodada. Registrado para não se perder.

- **B-01 — Termo financeiro completo:** calculadora (centavos), parcial/complementar, preview completo do termo, honorário de êxito %. Base já existe em `system_termo_snapshots` (mig. 0019) — só falta ligar UI/regra. (S3-04 liga só o preview de leitura.)
- **B-02 — Integração ERP:** Conta Azul + Asaas (via n8n).
- **B-03 — Cobrança:** boleto / link de pagamento / follow-up automático.
- **B-04 — Canal de comunicação:** e-mail vs Meta (definição + implementação).
- **B-05 — Monitoramento WhatsApp.**
- **B-06 — Painel de renovação anual.**
- **B-07 — IA no lead:** classificação/insights automáticos (esta rodada só deixa a **estrutura**: `status_lead`, `dias_parado`, timeline manual).
- **B-08 — Polling externo do Drive (auto-check):** varredura de arquivos criados **fora do app** (via n8n ou job) para sugerir itens de checklist. Não existe hoje; S2-06 cobre só o auto-check **no momento do upload pelo app**.
- **B-09 — Cutover ZapSign → produção (ex-parte da S4-01, GATE FUTURO / v2.2):** virar credenciais **sandbox→produção** na Vercel + **cadastrar o webhook** no painel ZapSign (rota `api.webhooks.zapsign.tsx`) + smoke em prod. **Pré-requisito OBRIGATÓRIO — guarda anti-replay (ex-R-ARCH-8):** o dedupe `system_webhook_dedupe` tem só `UNIQUE(provider,external_id)`, **SEM janela temporal**, e tokens de sandbox nunca foram gravados — ao virar produção, se o ZapSign reenviar histórico, o webhook **baixa PDFs e promove casos indevidamente**. Antes de ligar, aplicar um mitigante: (a) **pré-popular** o dedupe com tokens conhecidos, (b) **guarda por data** `webhook_ativo_desde` ignorando eventos com `signed_at` anterior ao cutover, ou (c) **confirmar no painel** que não há replay de histórico. Nesta rodada o ZapSign fica **sandbox** e a lógica da virada é validada por simulação/replay (S4-01).

---

## Resumo por sprint

| Sprint | Tema | Stories | Depende de | Habilita |
|---|---|---|---|---|
| S1 | Lead/Cliente por caso (destrava) — **autossuficiente (v2.2)** | 9 (S1-01…08 + S1-01b) | — (virada auto validada em **sandbox** no escopo; **sem** cutover de prod) | S2, S3, S4 |
| S2 | Onboard checklist + editor de funil | 7 (S2-06 **dependente de input do owner**, não bloqueia) | S1 | S3 (padrão de gate) |
| S3 | Estrutura financeira (sem termo) | 4 | S1, S2 | — |
| S4 | Virada auto em **sandbox** + docs/notas/timeline + UX transversal | 5 (S4-01…04 + S4-06) | S4-01 no escopo da S1; S4-02/03/04 paralelos; S4-06 independente | valida S1 auto; valida S1-07 (sem prod) |

**Regras de ouro de execução:**
1. **Nunca** reconstruir o que a seção 1 marca como JÁ EXISTE — só estender.
2. Toda migration que toca colunas de `system_cases` deve **recriar `system_cases_active`** (DROP+CREATE) no final, **expondo `lifecycle`/`perdido_at`** e mantendo grants `anon/authenticated/service_role` — é o padrão observado (mig. 0022/0026).
3. Todo novo gate segue o **molde idempotente** de `system_fn_entrar_financeiro` (guarda `WHERE macrostatus_* = esperado` reavaliada após lock).
4. Erros de dependência externa → **424**, nunca 5xx (ver `reference_vercel_5xx_gateway`).
5. Migrations aplicadas via **conexão pg direta** (CLI quebrado no Windows/OneDrive — ver `reference_aplicar_migrations_pg_direto`).
6. **Nenhuma migration pode RECRIAR `trg_system_cases_bifurcacao`** (dropado na 0022; a função homônima fica só para rollback).
7. **Toda escrita de `lifecycle` é server-side (RPC-only)** — o front nunca escreve `lifecycle` direto.

---

# MATRIZ DE TESTES MÍNIMOS (obrigatória — v2.3)

> 20 casos de teste obrigatórios que fecham o escopo desta rodada. Referenciados pelas CAs acima. Cada linha é um teste passa/falha.

### A) Pessoa única, find-or-create e coexistência de estados
1. **LEAD ⇄ CLIENTE simultâneos:** pessoa é **LEAD no caso A** e **CLIENTE no caso B** ao mesmo tempo → aparece nas **2 abas**, **sem duplicar cadastro**. (S1-01 CA-7, S1-05)
2. **find-or-create de 2º caso:** CPF existente entra como **LEAD de 2º caso** → retorna o **id existente**, **sem violar unique**, **sem sobrescrever o nome**. (S1-04 CA-2/CA-4)
3. **Mesmo tipo repetido:** **2 casos FIES** para o **mesmo CPF** → coexistem, **`case_code` distinto**. (S1-04)

### B) Promoção manual, perda e reversão
4. **Fix do no-op:** **LEAD sem procuração ZapSign** → botão manual → **CLIENTE** (prova que o no-op de `liberarCasoComercial` foi tratado por `promoverCasoManual`). (S1-03 CA-1)
5. **Idempotência manual:** botão manual em caso **já CLIENTE** → **idempotente**, **sem duplicar evento**. (S1-03 CA-2)
6. **Marcar PERDIDO:** **some de Leads**, **aparece em Perdidos**, grava **motivo + ator**. (S1-03 CA-3/CA-5)
7. **Reversão pós-assinatura:** cliente que **distrata/desiste após assinar** → **CLIENTE→PERDIDO** possível e **auditado**. (S1-01b)

### C) Migração — REGRA SIMPLES INICIAL + CORREÇÃO MANUAL (v2.3)
8. **Regra inicial → CLIENTE:** caso legado com procuração **assinada no sistema** (`assinatura_liberada_at IS NOT NULL` **OU** doc `doc_kind='procuracao'` com `status='ASSINADO'`) → nasce **`lifecycle='CLIENTE'`** (respeita a invariante de S1-01). (S1-06 CA-1)
9. **Regra inicial → LEAD:** caso legado **sem** sinal de assinatura no sistema → nasce **`lifecycle='LEAD'`**; **nenhum** caso ativo do operacional é rebaixado/promovido em massa; posição no Kanban e `macrostatus_*` **inalterados**. (S1-06 CA-2)
10. **Idempotência/reversibilidade:** rodar a migration **2x não muda** classificações e **não sobrescreve** correções manuais (caso ajustado à mão para CLIENTE/PERDIDO **permanece**; só classifica quem ainda está sem `lifecycle`). (S1-06 CA-3)
11. **Correção manual "assinado por fora":** caso assinado **fora do sistema** começa **LEAD** → usuário clica **"marcar como cliente"** + **anexa doc assinado** (passa por **magic bytes**: inválido rejeitado, válido registrado) → vira **CLIENTE** com **evento auditado**; botão **"não é cliente"** → **permanece LEAD**. (S1-06 CA-4/CA-5)

### D) Checklist / gate op
12. **Avanço por checklist:** concluir o **último item required** → **avança 1 etapa + evento**; **2x concorrente → avança 1 vez só**. (S2-04)
13. **Sugestão não fecha gate:** sugestão de auto-check **não confirmada** (`done=false`) **não fecha o gate**. (S2-06 CA-4)
14. **Desmarcar required após avanço:** **não regride sozinho** + **gera alerta** "checklist inconsistente". (S2-05 CA-3)

### E) Regressões críticas
15. **Trigger de bifurcação:** **NÃO recriar `trg_system_cases_bifurcacao`** (dropado na 0022); testar que **`system_fn_entrar_financeiro`** (entrada manual no fin) **continua funcionando**. (Riscos S1/S3)
16. **Procuração→ZapSign no `CaseFormDialog`:** o fluxo de **2 etapas** continua funcionando **após desacoplar criação de caso (S1-02)**; **casos comerciais existentes não perdem** a procuração já gerada. (S1-02 CA-3)
17. **Magic bytes:** **upload/download preserva magic bytes** na estrutura **por-caso**. (S4-02 CA-2)
18. **View recriada:** toda migration que toca `system_cases` **RECRIA `system_cases_active` (DROP+CREATE)** expondo **`lifecycle`/`perdido_at`** e mantendo grants **anon/authenticated/service_role**. (S1-01 CA-1)

### F) Webhook / virada automática em SANDBOX (v2.2)
19. **Virada auto em sandbox + dedupe:** **simular/replay** o evento de assinatura da procuração (sandbox) → doc `ASSINADO`, arquivo na pasta do caso, `liberarCasoComercial` roda → caso vira **`lifecycle='CLIENTE'`** com evento auditado (`diff.via='webhook'`) — **sem depender de e-mail real**; reenvio do **mesmo token** → **ignorado por dedupe** (não duplica arquivo nem promove 2x). (S4-01 CA-1/CA-2/CA-3)
   - **NOTA (v2.2):** o teste do **cutover de produção** (histórico anterior ao `webhook_ativo_desde` / tokens pré-populados NÃO reprocessados) migra para o **GATE FUTURO B-09** — **não** é caso desta rodada.

### G) UX transversal — breadcrumb/título por NOME
20. **Breadcrumb e título por NOME, nunca UUID:** abrir **cada** rota de detalhe (caso / cliente / lead / doc / termo / peticionamento / conversa WhatsApp / portal do caso) → **breadcrumb e título da aba exibem o NOME**, **nunca o UUID**, **incluindo os estados de loading** (placeholder/skeleton) **e 404** (rótulo genérico por entidade). (S4-06 CA-1…4)

---

# CHANGELOG v1 → v2 (por sprint)

> Revisão incremental incorporando parecer @architect (R-ARCH-1…9) + @qa (Q-1…10). Todo conteúdo v1 válido foi preservado.

**Global / cabeçalho**
- Nota de revisão v2 no topo. Sequenciamento atualizado: **S1 + S4-01 começam juntos**; S4-02/03/04 em paralelo depois; **S1-07 bloqueada por S4-01** (R-ARCH-9). Tabela-resumo e regras de ouro atualizadas (regras 6 e 7 novas).
- **Correção factual (R-ARCH-1):** trigger `trg_system_cases_bifurcacao` **DROPADO na 0022** — não é risco vivo. Ajustado na seção 1 (tabela), nos "Riscos" de S1 e S3, e na Matriz (caso 13). Concorrentes reais = `system_fn_entrar_financeiro` + projeção `system_fn_sync_stage_ids`.
- **Nova seção "Matriz de Testes Mínimos"** com 17 casos obrigatórios.

**Sprint 1**
- **S1-01:** coluna `lifecycle` materializada + **invariantes declaradas com CHECK/trigger** (R-ARCH-2); escrita de `lifecycle` centralizada em RPCs server-side; CA-4 reescrita (Q-1: `diff.via`, `triggered_by` não-null no manual); CA-1 agora exige recriar `system_cases_active` com grants; CA de invariante adicionada.
- **S1-01b (NOVO):** reversão **CLIENTE→PERDIDO** com auditoria (Q-3).
- **S1-03:** documentado o **bug do no-op de `liberarCasoComercial` (`:469`)** e a obrigatoriedade de `promoverCasoManual` independente da flag comercial (R-ARCH-3); 3 CAs novas — promoção de LEAD sem flag, **RBAC 403 no servidor**, auditoria de ator/timestamp (Q-2).
- **S1-04:** padrão **upsert capturando `23505`** e re-SELECT sob concorrência (R-ARCH-4); CA-2 reescrita — retorna existente, não sobrescreve nome, flag `conflitos[]`, merge só de campos vazios (Q-4); CA de concorrência adicionada.
- **S1-06:** CAs novas — categoria "múltiplos casos do mesmo tipo p/ mesmo CPF", contagem CLIENTE via backfill vs manual, e assinado-por-fora → "revisar manualmente" (Q-5).
- **S1-07:** marcada **BLOQUEADA por S4-01** (R-ARCH-9).

**Sprint 2**
- **S2-01:** checklist ancorado em **`stage_slug` + `service_type_id`** (não `stage_id`, porque etapas revivem por slug) (R-ARCH-5).
- **S2-02:** regra R-ARCH-7 — editor **nunca altera `slug` em uso**, **bloqueia delete** de etapa em uso; nova etapa = novo slug. CAs adicionadas.
- **S2-03:** instanciação **server-side dentro da transição** (não no front) (R-ARCH-5).
- **S2-04:** guarda de idempotência `WHERE macrostatus_op = esperado` **dentro** da função (molde `system_fn_entrar_financeiro`) (R-ARCH-5).
- **S2-05:** CA nova — desmarcar `required` de etapa ultrapassada **não regride sozinho** + alerta "checklist inconsistente" (Q-6).
- **S2-06:** mecanismo definido = sugestão **no momento do upload pelo app** (não polling n8n); polling externo → BACKLOG **B-08** (R-ARCH-6); CA nova — sugestão `done=false` **não fecha o gate** (Q-7).

**Sprint 3**
- **S3-01:** editor fin herda a regra R-ARCH-7 (não altera slug em uso / bloqueia delete); CA adicionada.
- **S3-02:** guarda `WHERE macrostatus_fin = esperado`; CA nova — voltar card fin para `NAO_APLICAVEL` **permanece bloqueado** após refactor (Q-8).
- **Riscos S3:** nota de não recriar `trg_system_cases_bifurcacao`.

**Sprint 4**
- **S4-01:** **começa junto com S1**; **CA-3 REESCRITA (R-ARCH-8):** afirmação de que "dedupe/janela protege" era **FALSA** — `system_webhook_dedupe` só tem `UNIQUE(provider,external_id)`, sem janela; mitigantes obrigatórios antes de ligar produção (pré-popular tokens / `webhook_ativo_desde` / confirmar no painel).
- **S4-03:** notas jurídicas com **RBAC + LGPD testados no servidor** (RLS + guard no RPC), set de papéis definido, soft-delete preserva `deleted_by`/`deleted_at`, nunca hard-delete (Q-9).
- **S4-04:** entrada manual de timeline **gated por RBAC** e **eventos automáticos read-only reais** no servidor (Q-10).

**BACKLOG**
- **B-08 (NOVO):** polling externo do Drive para auto-check (fora do app).

---

# CHANGELOG v2 → v2.1 (por sprint)

> Revisão incremental atendendo pedido do owner de 2026-07-02 (bug de UX transversal: breadcrumb/título por ID). Todo conteúdo v2 preservado.

**Global / cabeçalho**
- Nota de revisão **v2.1** no topo.
- Tabela-resumo: Sprint 4 passa de **4 → 5 stories** (inclui S4-06); tema atualizado para incluir "UX transversal".
- Matriz de Testes Mínimos: **17 → 18 casos** (novo grupo **G) UX transversal**, caso 18).

**Sprint 4**
- **S4-06 (NOVO) — Breadcrumbs e títulos por NOME, nunca ID:** story de **UX transversal** (baixo esforço / alta visibilidade). Marca **JÁ EXISTE** (o `Breadcrumb`/`PageHeader` e a resolução em `casos.$id`/`clientes.$id`) vs **NOVO** (resolver genérico param→nome + título da aba dinâmico + fallback loading/404). Levantamento das rotas de detalhe afetadas lido no código (`src/routes/`): `casos.$id`, `clientes.$id`, `casos.$id.termo`, `casos.$id.termo.elaborar`, `peticionamento.$id`, `whatsapp.conversas.$id`, `portal.casos.$id`, `api.clients.$id.documents.$docId(.download)`. CAs testáveis: nome no breadcrumb, nome no `document.title`, placeholder/skeleton no loading e rótulo genérico no 404 (nunca UUID), varredura rota a rota e regressão das rotas já corretas. Constatado que o título da aba é **estático global** em `__root.tsx:79` — nenhuma rota de detalhe define título dinâmico hoje.

---

# CHANGELOG v2.1 → v2.2 (por sprint)

> Revisão incremental incorporando **4 decisões do owner (2026-07-02) que SIMPLIFICAM o plano**. Todo conteúdo v2.1 válido foi preservado; nenhuma story foi excluída (S1-06 reescrita, não removida).

**Global / cabeçalho**
- Nota de revisão **v2.2** no topo, resumindo as 4 decisões.
- **Seção 1 (bloqueantes de infra):** ZapSign **fica em SANDBOX**; objetivo agora é validar a virada automática em sandbox (webhook/simulação, sem e-mail real). Cutover de produção vira **GATE FUTURO** no BACKLOG e **não bloqueia S1**.
- **Sequenciamento:** S1 agora é **AUTOSSUFICIENTE** — não depende mais de cutover de produção; a virada automática é validada em sandbox dentro do escopo (S4-01 reescrita). S1-07 **deixa de estar bloqueada** por produção.
- **Tabela-resumo:** S1 marcada autossuficiente; S2 anota S2-06 como dependente de input do owner (não bloqueia); S4 renomeada para "virada auto em sandbox".
- **BACKLOG:** novo **B-09 — Cutover ZapSign → produção** (ex-parte da S4-01, com a guarda anti-replay ex-R-ARCH-8).
- **Matriz de Testes:** grupo C reescrito (migração manual, sem dry-run); grupo F reescrito (virada em sandbox); contagem permanece **18 casos**.

**Sprint 1 (Decisões 2 e 4)**
- **S1-01b:** CA-3 deixa de exigir RBAC-por-papel — reversão CLIENTE→PERDIDO exige **apenas login** (qualquer usuário autenticado); auditoria mantida.
- **S1-03 (Decisão 2):** **removidas** as CAs de RBAC-por-cargo (ex-Q2: capability + 403-por-papel) para promoção/perda — substituídas por "**qualquer usuário autenticado** pode; ação exige apenas login". Confirmado: **procuração assinada promove a cliente automaticamente**. **Auditoria (ator + timestamp) mantida.**
- **S1-06 (Decisão 4 — REESCRITA):** deixa de ser "dry-run + relatório de exceções". Agora: migration só adiciona `lifecycle` + **DEFAULT não-disruptivo** para legados (**proposta sinalizada ao owner**: não rebaixar clientes ativos; legados-sem-sinal → `LEAD`; novos casos nascem `LEAD` ao enviar procuração). Divisão real é **MANUAL** via botões "marcar como cliente / não é cliente" (S1-03) + **anexar doc assinado** (reusa upload com magic bytes).
- **S1-07 (Decisão 1):** **NÃO** fica mais bloqueada por produção — **validável em sandbox** (criação de doc/token + replay/simulação do webhook prova a virada automática sem e-mail real). CA-2 nova.

**Sprint 2 (Decisão 3)**
- **S2-06:** marcada **DEPENDENTE DE INPUT DO OWNER** — regras de nomenclatura dos arquivos virão depois; regra de matching fica **parametrizável/aguardando** (estrutura pode ser construída, mas sem regras fixas). Explicitado que **não bloqueia a Sprint 2** (checklist manual S2-04/05 funciona sem auto-check). CA-6 nova.

**Sprint 4 (Decisões 1 e 2)**
- **Cabeçalho da Sprint 4:** tema/objetivo mudam de "ZapSign produção" para "validar a virada automática em **sandbox**"; risco de reprocesso de histórico migra para o GATE FUTURO de cutover.
- **S4-01 (Decisão 1 — REESCRITA):** deixa de ser "habilitar produção + cadastrar webhook" bloqueante; vira **"validar a lógica da virada automática em sandbox"** (simular/receber o evento de assinatura → caso vira CLIENTE com evento auditado; dedupe testado; sem depender de e-mail real). O **cutover de produção + guarda anti-replay (ex-R-ARCH-8)** viram **GATE FUTURO (B-09)**.
- **S4-03 (Decisão 2):** **relaxada** a trava de RBAC-por-papel das notas jurídicas (ex-Q9) — **qualquer usuário autenticado lê/escreve**; removida a exigência do set `advogado_titular/associado/admin` e o 403-por-cargo. **Mantidos** soft-delete com `deleted_by`/`deleted_at` (nunca hard-delete), trilha de auditoria e isolamento por org via RLS.

---

# CHANGELOG v2.2 → v2.3 (por sprint)

> Revisão incremental incorporando **1 decisão do owner (2026-07-02)** sobre o **estado inicial dos legados na S1-06**. Todo conteúdo v2.2 válido foi preservado; nenhuma story foi excluída (S1-06 reescrita, não removida).

**Global / cabeçalho**
- Nota de revisão **v2.3** no topo, resumindo a decisão (regra simples inicial + correção manual) e confirmando os sinais de "assinada" verificados no schema.
- **Matriz de Testes:** grupo **C** reescrito e ampliado de **2 → 4 casos** (regra→CLIENTE, regra→LEAD, idempotência/reversibilidade, correção manual "assinado por fora"); renumeração dos grupos D–G em cadeia; contagem total **18 → 20 casos**.

**Sprint 1 (decisão sobre estado inicial dos legados)**
- **S1-06 (REESCRITA):** deixa de ser "migração **100% MANUAL** com default não-disruptivo" e passa a **REGRA SIMPLES INICIAL + CORREÇÃO MANUAL**.
  - **Classificação inicial determinística** por **migration idempotente**: caso com procuração **assinada no sistema** (`assinatura_liberada_at IS NOT NULL` **OU** `system_case_documents` com `doc_kind='procuracao'` e `status='ASSINADO'`) → **CLIENTE**; **todo o resto → LEAD**. Sinais **verificados no schema real** (`20260622000003_caso_comercial.sql:17`; CHECK de `status` em `20260608000001_case_documents.sql:33-35`).
  - **Idempotente e reversível:** a regra **só classifica quem ainda está sem `lifecycle`**; rodar 2x **não muda** o resultado nem **sobrescreve** correções manuais.
  - **Correção manual das exceções** (principalmente **"assinados por fora"**, que começam LEAD): botões "marcar como cliente / não é cliente" (S1-03) + **anexar doc assinado** (upload existente com **validação de magic bytes**) — mantido do v2.2.
  - **REMOVIDA** a nota ⚠ pendente do v2.2 (o default dos legados agora está **DECIDIDO**: regra simples, não mais "validar com o owner").
  - **CAs reescritas** (5): regra→CLIENTE, regra→LEAD (não-disruptivo), idempotência/reversibilidade, correção manual "assinado por fora" com anexo (magic bytes) + evento auditado, e "não é cliente" permanece LEAD.
