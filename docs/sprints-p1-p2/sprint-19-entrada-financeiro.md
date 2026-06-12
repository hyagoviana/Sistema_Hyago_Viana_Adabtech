# S19 — Entrada no Financeiro: Duplicar vs Somente Financeiro (botão + popup)

> **Autoria:** @pm John · **Validação:** @architect Winston + @qa Quinn · **Orquestração:** Orion (aios-master)
> **Data:** 2026-06-10 · **Status:** ✅ **APROVADO COM RESSALVAS** (v1.1 incorpora os BLOCKERs das duas revisões) · **Projeto:** P2
> **Base:** pedido do owner 2026-06-10 + decisões travadas D1 (reversível) e D2 (só manual) · reusa mecânica de S16 (`system_fn_bifurcar_financeiro`, ADR-009/010).
> **Próxima migration:** `20260610000001_entrada_financeiro.sql` (a última é `20260609000001_pipelines_por_tipo.sql`).

---

## 0. Vereditos da validação

| Validador | Veredito | Convergência |
|---|---|---|
| **@architect** Winston | APROVADO COM RESSALVAS | 4 BLOCKERs (filtro no consumidor errado · RBAC server-side ausente · drop preciso do trigger · "1ª etapa fin" ≠ `ELABORANDO`) + 5 ADRs |
| **@qa** Quinn | APROVADO COM RESSALVAS | 9 gaps (G-01..G-09) + 6 casos P0 adicionais + atualizar `test-cases.ts` |

**Os dois bateram nos mesmos pontos:** RBAC só na UI não basta, o filtro do "somente financeiro" não pode ir na fonte única (sumiria das duas pipelines), há um terceiro trigger de projeção que precisa sobreviver, e "1ª etapa fin" precisa ser resolvida por `ordem` (não pelo slug fixo `ELABORANDO`). Tratados como **condição de entrada**.

---

## 1. Objetivo

Substituir o botão simples "Enviar para o financeiro" da ficha do caso (`casos.$id.tsx`, ~linha 245) por um botão que abre um **dialog com duas escolhas**: (1) **Duplicar para o financeiro** — o caso permanece nas duas pipelines (op + fin); (2) **Somente financeiro** — entra no financeiro e **sai da pipeline operacional** via flag de data reversível `removido_do_operacional_at`. Em ambos os casos o caso cai na **primeira etapa fin real** do seu tipo de serviço. Como decisão travada (**D2**), a sprint **desliga a bifurcação automática** (trigger `trg_system_cases_bifurcacao` da migration 0007): a entrada no financeiro passa a ser **sempre manual**. A saída do operacional é **reversível** ("Trazer de volta ao operacional"), com histórico e auditoria. Escopo **só código**: Supabase + backend (service/rpc/hooks) + frontend; **nada de n8n** nesta sprint.

---

## 2. BLOCKERs incorporados (condição para codar)

| # | Achado | Correção | Entra em |
|---|---|---|---|
| B1 | O filtro do "somente financeiro" estava previsto na fonte única de leitura — mas op e fin leem a **mesma** view/hook. Filtrar lá some o caso das DUAS pipelines. | Filtro **por contexto de Kanban**: esconder `removido_do_operacional_at IS NOT NULL` **só no ramo op do `/pipeline`**; NUNCA na view `system_cases_active`, em `listCases` ou em `getCase`. | S19-6 (ADR-016) |
| B2 | Nenhum `createServerFn` de pipeline/casos aplica RBAC hoje (`rpc/pipeline.ts` é aberto). "+RBAC" não é trivial — não existe gate server-side pra reusar. | Estabelecer o **padrão de gate server-side** (ler papel da sessão → `can(role,"financeiro.manage")` → 403). Spike na S19-0. | S19-0 (ADR-015) + S19-5 |
| B3 | Há **três** triggers em `system_cases`. Desligar errado quebra projeção/carimbo. | Dropar **só** `trg_system_cases_bifurcacao` (preservar a função p/ rollback). **Preservar** `trg_system_cases_status_fin_changed_at` e `trg_system_cases_sync_stages` (projeção `stage_fin_id`). | S19-2 |
| B4 | "1ª etapa fin" como `ELABORANDO` hard-coded falha: a etapa `ordem=0` semeada é `NAO_APLICAVEL` (= "não bifurcado"); etapas são configuráveis por tipo. | Resolver destino = `MIN(ordem)` em `system_pipeline_stages WHERE service_type_id=<do caso> AND kind='fin' AND slug<>'NAO_APLICAVEL' AND deleted_at IS NULL`, gravando via `macrostatus_fin = <slug>` (dual-write; a projeção preenche `stage_fin_id`). | S19-3 (ADR-014) |
| B5 | Erro de pré-condição (ex.: tipo sem etapa fin) hoje vira **500**, mascarado pelo gateway Vercel. | Mapear falhas de negócio/dependência para **424** (mensagem chega ao front). | S19-5 |
| B6 | `test:cases` (steps 10-13) hoje **afirma que a bifurcação automática funciona** — vai quebrar ao desligar o trigger. | Reescrever esses asserts **na mesma story** que desliga o trigger (passam a afirmar que op→IMPLANTADO **não** bifurca). | S19-2 / S19-9 |

---

## 3. Tabela de stories (v1.1)

| ID | Título | Agente | Est. |
|---|---|---|---|
| S19-0 | **ADR-012..016** (flag vs tabela · drop vs guard · destino 1ª etapa fin · **RBAC server-side** · **semântica do filtro por consumidor**) + spike "de onde vem o `role` no createServerFn" | @architect | M |
| S19-1 | Migration: coluna `removido_do_operacional_at TIMESTAMPTZ NULL` + índice parcial `WHERE removido_do_operacional_at IS NOT NULL` + refresh `system_cases_active` (DROP+CREATE, GRANTs) | @data-engineer | P |
| S19-2 | **Desligar bifurcação automática** (D2/B3): `DROP TRIGGER IF EXISTS trg_system_cases_bifurcacao` (mantém a função) **+ reescrever steps 10-13 de `scripts/test-cases.ts`** (B6) + bloco de rollback documentado | @data-engineer + @qa | P |
| S19-3 | Função idempotente `system_fn_entrar_financeiro(p_case_id, p_remover_operacional)` — resolve 1ª etapa fin por `MIN(ordem)` (B4), seta `macrostatus_fin`, seta/limpa flag conforme modo; guarda de idempotência composta | @data-engineer | M |
| S19-4 | Função `system_fn_voltar_ao_operacional(p_case_id)` — zera **apenas** `removido_do_operacional_at`; NÃO toca `macrostatus_fin`/`stage_fin_id`/`status_fin_changed_at`; idempotente | @data-engineer | P |
| S19-5 | Service `entrarNoFinanceiro`/`voltarAoOperacional` + rpc + hooks **com gate RBAC server-side** (B2) + auditoria com `organization_id`+`actor_id` + erros **424** (B5) | @dev | M |
| S19-6 | Filtro **por contexto de Kanban** (B1): esconder removidos só no ramo op do `/pipeline`; financeiro e lista geral intactos | @dev | P |
| S19-7 | Dialog "Enviar para o Financeiro" (duas escolhas) na ficha + wiring (substitui botão ~linha 245); botão desabilita em `isPending`; gate `financeiro.manage` na UI | @dev + @ux | M |
| S19-8 | Ação "Trazer de volta ao operacional" (visível quando removido) + badge "Fora do operacional" | @dev + @ux | P |
| S19-9 | QA: matriz de estados + idempotência composta/concorrente + RBAC na RPC + 424 + harness de RPC autenticada + baseline pré-migração | @qa | G |

---

## 4. Critérios de aceite por story

**S19-0 — ADRs + spike (bloqueante)**
- ADR-012..016 escritos em `_adrs/` e aceitos (decisões técnicas já recomendadas pelo @architect — ver §6).
- Spike define de onde o `role` do usuário vem dentro de um `createServerFn` (sessão Supabase, não argumento do cliente).

**S19-1 — Migration coluna + view**
- `ALTER TABLE system_cases ADD COLUMN IF NOT EXISTS removido_do_operacional_at TIMESTAMPTZ` (nullable, default NULL).
- Índice parcial `WHERE removido_do_operacional_at IS NOT NULL`.
- `system_cases_active` recriada (DROP+CREATE) expondo a coluna; GRANTs preservados. Idempotente.

**S19-2 — Desligar trigger (D2/B3/B6)**
- `DROP TRIGGER IF EXISTS trg_system_cases_bifurcacao ON system_cases;` — **só esse**.
- Função `system_cases_bifurcacao_trg()` **permanece** (rollback de 1 linha).
- `trg_system_cases_status_fin_changed_at` e `trg_system_cases_sync_stages` **intactos**.
- Bloco de rollback (`CREATE TRIGGER` de volta) documentado em `supabase/rollbacks/`.
- `scripts/test-cases.ts` steps 10-13 reescritos: mover op→IMPLANTADO **não** bifurca mais.

**S19-3 — Função de entrada (B4)**
- `system_fn_entrar_financeiro(p_case_id UUID, p_remover_operacional BOOLEAN)`:
  - Resolve a 1ª etapa fin = `MIN(ordem)` com `slug<>'NAO_APLICAVEL'` e `deleted_at IS NULL` do `service_type_id` do caso; grava `macrostatus_fin = <slug>` (a projeção preenche `stage_fin_id`).
  - Idempotente: só promove se ainda não bifurcado (`macrostatus_fin IS NULL OR ='NAO_APLICAVEL'`); não reseta etapa de caso já bifurcado.
  - `p_remover_operacional = TRUE` → `removido_do_operacional_at = NOW()` (não sobrescreve se já setado); `FALSE` → garante `= NULL` (modo duplicar).
  - `RAISE` controlado se o tipo não tem etapa fin ativa.
  - `GRANT EXECUTE` a `service_role, authenticated`.

**S19-4 — Reverter**
- `system_fn_voltar_ao_operacional(p_case_id)` seta `removido_do_operacional_at = NULL`; idempotente (no-op se já nulo, sem erro); **não** altera estado fin nem o carimbo.
- `GRANT EXECUTE` a `service_role, authenticated`.

**S19-5 — Service + rpc + hooks + RBAC + auditoria (B2/B5)**
- `pipeline-service.ts`: `entrarNoFinanceiro({caseId, removerOperacional})` e `voltarAoOperacional(caseId)`.
- `rpc/pipeline.ts`: `entrarFinanceiroFn` / `voltarOperacionalFn` com **gate `can(role,"financeiro.manage")` → 403** dentro do handler.
- `hooks/usePipeline.ts`: `useEntrarFinanceiro()` / `useVoltarOperacional()` invalidando `["case"]`, `["cases"]`, `["cases-by-service"]`.
- Auditoria `case.entrar_financeiro` (payload com `removerOperacional`) e `case.voltar_operacional`, **com `organization_id` e `actor_id`**.
- Falha de dependência/negócio → **424** (não 500).

**S19-6 — Filtro por contexto (B1)**
- No `/pipeline` ramo `kind==="op"`: esconder casos com `removido_do_operacional_at IS NOT NULL` (filtro client-side já existente ali, ou parâmetro opcional em `listCasesByServiceType` sem mudar o default).
- Ramo `fin`, `casos.financeiro.*`, `listCases`, `getCase`, view: **sem** filtro.

**S19-7 — Dialog**
- Botão "Enviar para o Financeiro" (condicionado a `!finBifurcated`) abre dialog (shadcn) com "Duplicar para o financeiro" e "Somente financeiro", cada uma com 1 linha de explicação.
- Confirmar chama `useEntrarFinanceiro({caseId, removerOperacional})`; toast; desabilita em `isPending`.
- Botão oculto/desabilitado sem `financeiro.manage`.

**S19-8 — Reverter na ficha**
- Com `removido_do_operacional_at != null`: badge "Fora do operacional" + ação "Trazer de volta ao operacional" (com confirmação).
- Some quando a flag volta a NULL.

**S19-9 — QA**
- Cobre §5 (matriz + P0).

---

## 5. Definição de "Pronto" + QA

### DoD da sprint
- [ ] Botão abre dialog com as duas escolhas; ambas levam à 1ª etapa fin real do tipo.
- [ ] "Duplicar" mantém nas duas pipelines (`removido_do_operacional_at IS NULL`); "Somente financeiro" remove do Kanban op e mantém no fin.
- [ ] Bifurcação automática **desligada**; entrada sempre manual; rollback documentado; `test:cases` verde com asserts invertidos.
- [ ] Flag filtra **só** o Kanban op; "Trazer de volta" reexibe sem alterar estado fin.
- [ ] RBAC `financeiro.manage` validado **na RPC** (403), não só na UI; auditoria com org+ator.
- [ ] Erros de dependência retornam **424**; `lint` + typecheck limpos; migration idempotente.

### Matriz de estados (QA)
{não-bifurcado, duplicado, somente-financeiro, revertido} × {criado novo, **legado bifurcado pelo trigger antigo**}.

| Estado | aparece no op? | aparece no fin? | `removido_..._at` | `macrostatus_fin` |
|---|---|---|---|---|
| não-bifurcado | sim | não | null | NAO_APLICAVEL |
| legado (trigger antigo) | sim | sim | null | preenchido |
| duplicado (S19) | sim | sim | null | 1ª etapa fin |
| somente-financeiro (S19) | **não** | sim | timestamp | 1ª etapa fin |
| revertido | sim | sim | null | inalterado |

### 🔴 Casos P0 (bloqueiam release)
1. **Idempotência** simples (chamar 2x) — 1 efeito, 1 auditoria.
2. **Somente financeiro** some do op e aparece no fin (asserção dupla na mesma carga — B1).
3. **Reversão** reexibe no op sem mudar `{macrostatus_fin, stage_fin_id, status_fin_changed_at}`.
4. **Trigger desligado**: op→IMPLANTADO **não** bifurca.
5. **Legado** já bifurcado + `entrar_financeiro` → idempotente, não duplica/reseta.
6. **Caso sem etapa fin** → **424** tratado (não 500).
7. **RBAC na RPC**: papel sem `financeiro.manage` → 403 (não só UI ocultar).
8. **Rollback** da migration em staging sem órfãos.
9. **Idempotência composta**: duplicar→somente-fin→reverter→somente-fin → estado fin único, auditoria sem duplicatas.
10. **Concorrência / clique-duplo paralelo** (`Promise.all` de 2 chamadas) → 1 efeito.
11. **Coexistência com projeção** (`system_fn_sync_stage_ids`): após entrar/reverter, `stage_fin_id` e `macrostatus_fin` coerentes (projeção não zera).

### Baseline pré-migração (staging)
- Snapshot `macrostatus_fin GROUP BY` + coerência stage↔macrostatus (op e fin).
- `test:cases` + `test:rls` verdes (baseline). Critério de paridade depois: contagens idênticas para casos não tocados; zero `removido_do_operacional_at` setado logo após a migration.

### Testabilidade
- Novo `scripts/test-entrada-financeiro.ts` (script `test:entrada-fin`) no molde de `test-cases.ts` (service via admin) cobre P0 1–6, 9, 10, 11 + auditoria + 1ª etapa por ordem.
- **Novo harness de RPC autenticada** (estilo `test-rls.ts`, JWT de papel restrito) para P0-07 (RBAC) e B5 (424) — hoje **não existe** teste na camada `src/rpc/*`.

---

## 6. ADRs obrigatórios (decisões já recomendadas pelo @architect)

1. **ADR-012 — Remoção do operacional: flag vs tabela** → **coluna `removido_do_operacional_at TIMESTAMPTZ NULL`** (D1, single-tenant, casa com `status_fin_changed_at`/`deleted_at`). Tabela = over-engineering.
2. **ADR-013 — Desligar automático: drop vs guard** → **DROP do `trg_system_cases_bifurcacao`**, preservando a função; rollback = recriar o trigger.
3. **ADR-014 — Destino "1ª etapa fin"** → **`MIN(ordem)` com `slug<>'NAO_APLICAVEL'`** ativa, por `service_type_id`. Remove acoplamento à string (B1 do P1).
4. **ADR-015 — Gate RBAC server-side em `createServerFn`** → padronizar leitura do papel da sessão + 403; retroaplicar nas rotas hoje abertas (`bifurcarCaseFn`/`moveCaseToStageFinFn`).
5. **ADR-016 — Semântica do filtro por consumidor** → `removido_do_operacional_at` filtra **apenas o Kanban op**; `listCases`/view/`getCase`/financeiro permanecem sem filtro. Sem ADR isso vira regressão na 1ª refatoração.

---

## 7. Pré-requisitos e riscos

- **Janela cega de deploy:** S19-2 (drop do trigger) **não** pode ir a produção antes de S19-3+S19-5+S19-7, senão fica sem bifurcação automática **e** sem botão funcional. Deployar no mesmo release (ou manter `bifurcarCaseFn` ativo até o botão novo entrar).
- **Casos legados** bifurcados pelo trigger antigo: flag NULL = comportam-se como "duplicado" (correto, sem migração de dados).
- **Idempotência composta:** os 2 efeitos (estado fin + flag) precisam ser idempotentes separadamente.
- **Concorrência:** garantir que clique-duplo paralelo gere 1 efeito (UPDATE condicional vence só 1 transação; cobrir em QA).
- **RBAC:** `financeiro.manage` já existe em `rbac.ts` mas **não é consumida no backend** — é trabalho de design (ADR-015), não "+RBAC".
- **Ordenação:** S19-0 → S19-1 → (S19-3/S19-4) → S19-5/6/7/8 → S19-2 (no release final) → S19-9.

---

## 8. Ordem de execução + gate

1. Fechar **ADR-012..016** + spike RBAC (S19-0).
2. SM materializa stories no formato do projeto → Dev/Data → QA (gate) → commit.
3. Deploy: agrupar S19-2 com backend+front no mesmo release (evitar janela cega).

> **Aguardando aprovação do owner para iniciar a execução (começando por S19-0/S19-1).**
