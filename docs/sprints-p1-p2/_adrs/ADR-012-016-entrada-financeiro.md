# ADR-012..016 — Entrada no Financeiro (Sprint S19)

> **Data:** 2026-06-10 · **Autor:** @architect Winston · **Status:** ACEITO (pré-S19)
> **Contexto:** novo fluxo "Enviar para o Financeiro" com escolha Duplicar vs Somente-financeiro. Decisões do owner travadas: D1 (reversível por flag), D2 (entrada só manual; desligar trigger automático).

---

## ADR-012 — Modelo da remoção do operacional: flag de data vs tabela

**Decisão:** coluna escalar **`system_cases.removido_do_operacional_at TIMESTAMPTZ NULL`**.

**Por quê:** single-tenant, reversível, barata; alinha com o padrão de carimbos já existente (`status_fin_changed_at`, `deleted_at`). O histórico de quem removeu/reverteu vive em `system_audit_log` (`case.entrar_financeiro` / `case.voltar_operacional`). Uma tabela dedicada de "remoções" seria over-engineering aqui.

**Consequência:** se no futuro precisar de histórico estruturado (várias remoções/reversões com motivo), migra-se para tabela — gatilho de revisão idêntico ao do ADR-010.

---

## ADR-013 — Desligar a bifurcação automática: DROP do trigger vs guard condicional

**Decisão:** **DROP** do trigger `trg_system_cases_bifurcacao`, **preservando a função** `system_cases_bifurcacao_trg()`.

**Por quê:** cumpre D2 (entrada só manual) sem adicionar estado/feature-flag ao trigger (que criaria caminho de teste extra). Rollback = `CREATE TRIGGER` a partir da função preservada (1 linha), documentado em `supabase/rollbacks/`.

**Não tocar:** `trg_system_cases_status_fin_changed_at` (carimbo) e `trg_system_cases_sync_stages` / `system_fn_sync_stage_ids` (projeção `macrostatus_fin → stage_fin_id`) — ambos continuam essenciais.

---

## ADR-014 — Destino canônico "primeira etapa fin"

**Decisão:** a 1ª etapa fin = **`MIN(ordem)`** em `system_pipeline_stages WHERE service_type_id = <do caso> AND kind='fin' AND slug <> 'NAO_APLICAVEL' AND deleted_at IS NULL`. Gravar via `macrostatus_fin = <slug dessa etapa>` (dual-write; a projeção preenche `stage_fin_id`).

**Por quê:** as etapas fin são configuráveis por tipo de serviço; a etapa `ordem=0` semeada é `NAO_APLICAVEL` (= "não bifurcado"). Usar `ELABORANDO` hard-coded (como `system_fn_bifurcar_financeiro` faz hoje) reintroduz o acoplamento à string de enum (BLOCKER B1 do P1). Resolver por `ordem` desacopla.

**Consequência:** `system_fn_entrar_financeiro` **substitui** o uso de `system_fn_bifurcar_financeiro` (que fica viva, deprecada, para rollback de D2). Falha controlada (424) se o tipo não tiver etapa fin ativa.

---

## ADR-015 — Gate RBAC server-side em `createServerFn`

**Decisão:** estabelecer o padrão de **verificação de papel dentro do handler** das server functions: obter o `role` da **sessão Supabase** (nunca de argumento do cliente) → `can(role, "financeiro.manage")` → **403** se negar. Aplicar nas novas `entrarFinanceiroFn` / `voltarOperacionalFn` e **retroaplicar** em `bifurcarCaseFn` / `moveCaseToStageFinFn` (hoje abertas).

**Por quê:** `rbac.ts` define `financeiro.manage` mas a capability **não é consumida no backend** — gate só na UI é burlável. É decisão com impacto além desta sprint.

**Pendência (spike S19-0):** confirmar de onde extrair o `role` no contexto do `createServerFn` (sessão/JWT). O QA criará um harness de RPC autenticada (estilo `test-rls.ts`) para cobrir o 403.

---

## ADR-016 — Semântica do filtro por consumidor

**Decisão:** `removido_do_operacional_at` filtra **apenas a renderização do Kanban operacional** (`/pipeline`, ramo `kind==="op"`). **Não** aplicar na view `system_cases_active`, em `listCases`, em `getCase`, no Kanban financeiro nem na lista geral.

**Por quê:** op e fin consomem a mesma fonte/hook. Filtrar na fonte única faria o caso "somente financeiro" sumir das **duas** pipelines — o oposto do desejado. O caso removido deve **sair do op e permanecer no fin**.

**Consequência:** regra registrada para evitar regressão na 1ª refatoração. A lista geral (`casos.lista`, `hoje`, Sidebar) mantém o caso visível, sinalizado pelo badge "Fora do operacional" (S19-8).
