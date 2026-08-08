# Story M13: Motor puxa COMPLEXO/COLETIVO de MARCADOR do ProJuris (v1, com fallback individual/não-complexo) + campo URGENTE/PRIORITÁRIO nativo do NOSSO sistema (não existe no ProJuris)

- **Épico:** ProJuris / Distribuição — Reunião 2026-08-07
- **ID:** M13
- **Status:** Núcleo implementado (marcadores→complexo/coletivo + diag) · Pendentes: T3 URGENTE nativo + T4b seed eligible_complex
- **Estimativa relativa:** M
- **Executor sugerido:** @dev + @data-engineer · Quality gate: @qa
- **Risco:** **MÉDIO** — mexe na ENTRADA do scoring (`complexity`/`temporal`/`collective`), que hoje entra fixa `0/false` no `sync-core.ts`. Casamento errado de marcador ⇒ modificador errado ⇒ pontuação/data injusta silenciosa. Mitigado por fallback determinístico (sem info = individual/não-complexo) + diagnóstico.
- **Origem:** `docs/reunioes/reuniao-2026-08-07-melhorias-ate-segunda.md` (M13) + transcrição "Matheus Torquato [0601]" (linhas 177–191): "hoje essas informações estão como marcadores … puxar de marcador … Se não tiver informação se é coletivo ou complexo, aí é uma regra de fallback … é individual … urgente e prioritário … não tem lugar nenhum … algo que eu acho que nós temos que adicionar".

---

> **NOTA DE ESCOPO:** O **scoring já consome** `complexity_level`/`temporal_level`/`collective` (`engine/scoring.ts` + `engine/types.ts`). O buraco é a **ENTRADA**: hoje o `sync-core.ts` monta `Process.collective=false`, `Process.complexity_level=0`, `Process.temporal_level=0` e `task_override_*=0` **fixos**, ignorando o ProJuris. Esta story LIGA os marcadores COMPLEXO/COLETIVO do processo a esses campos (v1) e ADICIONA um campo URGENTE/PRIORITÁRIO no NOSSO banco (o ProJuris não tem). Não reescreve o scoring. **v0.2 (2026-08-08):** acrescenta a regra de **recebe-complexidade por executor** — `eligible_complex=true` só para 4 pessoas (Bruno, Hudson, Patrícia, Keilane).

> **⚠️ INTERPRETAÇÃO A CONFIRMAR COM O THIAGO (não gravar no sistema antes de confirmar).** Os nomes "Bruno" e "Hudson" não estão literais na planilha `Cadastro-Colaboradores-PREENCHIDO-2026-08-08.xlsx`. Interpretação atual (a validar):
> - **Bruno** = **Maxwel Bruno Santos Costa** (bate: o áudio diz "time do Bruno = Pedro + Amanda", que é a Equipe 2 = Maxwel).
> - **Hudson** = **Wdyson Neres Moreira da Costa** (grafia fonética).
> - **Patrícia** = **Ana Patrícia Cruz** · **Keilane** = **Keilane Alves**.
> Enquanto não confirmado, tratar como **decisão pendente**: não persistir o `eligible_complex` desses executores até o Thiago confirmar o de-para de nomes. (O campo `eligible_complex` por executor já existe em `system_projuris_executor_mapping` e é lido em `sync-core.ts:284/304` — só a lista de QUEM recebe true é que muda.)

---

## Story

**Como** motor de distribuição,
**quero** derivar **COMPLEXO** e **COLETIVO** de um **MARCADOR do processo no ProJuris** (v1), com **fallback** para "individual e não-complexo" quando o marcador não vier, e derivar **URGENTE/PRIORITÁRIO** de um **campo marcado no NOSSO sistema no caso** (porque essa informação **não existe no ProJuris**, era "humana, na cabeça da pessoa"),
**para** que os modificadores de scoring (`complexity` +0.2/+0.3, `collective` +0.2, `temporal` +0.1/+0.3) reflitam a realidade em vez de entrarem sempre zerados como hoje.

> **DECISÕES TRAVADAS (reunião 2026-08-07 + retorno Thiago 2026-08-08):**
> 1. **v1 = MARCADOR.** Hoje COMPLEXO e COLETIVO são **marcadores** no ProJuris (não campo personalizado). O Dadá confirmou que trocar para campo personalizado depois "só muda onde o sistema busca". v1 puxa de marcador; a fonte fica configurável para virar campo personalizado sem retrabalho (espelha o padrão de `resolveTema`/`TEMA_SOURCE_ORDER_DEFAULT`).
> 2. **Fallback determinístico.** Sem marcador de coletivo/complexo ⇒ **individual e não-complexo** (`collective=false`, `complexity_level=0`). Nunca "chuta" complexo.
> 3. **URGENTE/PRIORITÁRIO é NOSSO.** Não existe no ProJuris → **campo no nosso banco** (marcado no caso), que alimenta `temporal_level`. Enquanto ninguém marca, `temporal_level=0` (normal).
> 4. **RECEBE COMPLEXIDADE = só 4 pessoas (retorno Thiago 2026-08-08, por áudio).** O Thiago ESQUECEU a coluna na planilha e passou por áudio: `eligible_complex` (recebe complexidade) = **`false` para todos, EXCETO 4 pessoas** → `eligible_complex = true` para **Bruno, Hudson, Patrícia e Keilane**. Ou seja: mesmo um processo marcado COMPLEXO só pode ser **atribuído** a esses 4; os demais executores não são elegíveis para complexo (é um filtro de **elegibilidade de executor**, complementar aos marcadores de complexidade do processo). Fonte: `docs/reunioes/dados-thiago-2026-08-08.md`.

---

## Contexto / o que JÁ EXISTE vs NOVO

### JÁ EXISTE (reusar — NÃO reconstruir)

- **Scoring consome os 3 sinais:** `sistema-hv/src/lib/distribuicao/engine/scoring.ts` — `COLLECTIVE_MODIFIER {false:0, true:0.2}`, `COMPLEXITY_MODIFIER {0:0,1:0.2,2:0.3}`, `TEMPORAL_MODIFIER {0:0,1:0.1,2:0.3}`; `calculateFinalComplexity`/`calculateFinalTemporal` já fazem `max(process, theme, task_type, task_override)`.
- **Contrato de entrada:** `sistema-hv/src/lib/distribuicao/engine/types.ts` — `Process.collective`, `Process.complexity_level`, `Process.temporal_level`; `Task.task_override_complexity_level`, `Task.task_override_temporal_level`, `Task.theme_temporal_level`, `Task.task_type_temporal_level` etc. **Os campos já existem; só chegam zerados.**
- **Marcadores já extraídos do processo:** `sistema-hv/src/lib/projuris/normalizer.ts` — `TemaCandidatos.marcadores[]` (via `marcadorNames(proc.marcadorWs)`) e `camposPersonalizados[]` (via `flattenCampo`) já vêm do `GET /processo/{cod}`. **O balde de marcadores já está na mão** — falta interpretá-lo para complexo/coletivo.
- **Onde a entrada é montada (a mudar):** `sistema-hv/src/lib/distribuicao/sync-core.ts` — no laço `for (const rt of rawTasks)` monta `processMap.set(..., { collective:false, complexity_level:0, temporal_level:0 })` e `task_override_*: 0` FIXOS. Hoje o `sync-core` só lê `proc.assunto` (para tema); **não lê `marcadorWs`**. Precisa passar a ler os marcadores por processo (como o normalizer já faz).
- **Padrão de fonte configurável:** `TEMA_SOURCE_ORDER_DEFAULT` + `resolveTema` no `normalizer.ts` — modelo para "puxar de marcador hoje, campo personalizado amanhã" sem retrabalho.
- **Ficha do caso / campos por tema:** `system_tema_field_defs` + `canonical_fields` (motor de campos por tema) — base possível para o campo URGENTE aparecer/ser marcado no caso, se preferirmos campo por tema. (Ver Dev Notes para a decisão de onde guardar o URGENTE.)
- **Migrations via pg direto:** `npx tsx scripts/db-apply-pg.ts` da pasta `sistema-hv/`; dev=prod; rollback simétrico.

### NOVO (a construir nesta story)

- **Interpretação de marcadores → complexo/coletivo:** um mapa/config de nomes de marcador normalizados (acento/caixa/espaço, reusa `normalizeTemaKey`) que sinaliza `collective=true` e/ou `complexity_level>=1`. Ex.: marcador "COLETIVO" ⇒ `collective=true`; "COMPLEXO" ⇒ `complexity_level=1` (ou 2 se houver "MUITO COMPLEXO"/"COMPLEXO 2"). Configurável e tolerante a grafia.
- **`sync-core.ts` lê os marcadores por processo** (hoje só lê `assunto`) e popula `Process.collective`/`Process.complexity_level` a partir deles; sem marcador ⇒ fallback `false`/`0` (AC-2/decisão 2).
- **Campo URGENTE/PRIORITÁRIO no nosso banco**, marcável no caso, que o `sync-core` lê e converte em `temporal_level` (prioritário=1, urgente=2) via `task_override_temporal_level` (ou `process.temporal_level`). Sem marca ⇒ 0.
- **Diagnóstico:** por processo, quais marcadores viraram complexo/coletivo e se houve urgente — no `metrics` do batch_log (como o `tema_diag` do H4).
- **Recebe-complexidade por executor (retorno Thiago 2026-08-08):** garantir/ajustar que `eligible_complex=true` só nos 4 executores (Bruno/Hudson/Patrícia/Keilane, **de-para a confirmar**). O campo já existe no mapping (`system_projuris_executor_mapping.eligible_complex`) e já é consumido pelo motor (`sync-core.ts:284` no `ExecRow`, `sync-core.ts:304` `complex_eligible: m?.eligible_complex ?? true`). **Atenção:** hoje o default é `?? true` (todos elegíveis quando NULL) — a regra do Thiago inverte a expectativa (a maioria = false). Definir os 4 como `true` e os demais como `false` (via cadastro/M8 ou seed), sem alterar o engine.

---

## Acceptance Criteria

1. **Complexo/Coletivo de marcador (v1):** ao montar a entrada, `sync-core.ts` lê os **marcadores do processo** (`marcadorWs`, como o `normalizer.marcadorNames` já faz) e, casando por **nome normalizado** contra a config, seta `Process.collective=true` quando há marcador de coletivo e `Process.complexity_level>=1` quando há marcador de complexo. O scoring aplica os modificadores correspondentes.
2. **Fallback determinístico:** processo **sem** marcador de coletivo/complexo ⇒ `collective=false` e `complexity_level=0` (individual/não-complexo). Nunca inferir complexo por ausência.
3. **Fonte configurável (marcador → campo personalizado):** a leitura de complexo/coletivo é parametrizável (default = marcador), de modo que virar para campo personalizado no futuro seja só trocar a fonte/config, sem reescrever a lógica (espelha `TEMA_SOURCE_ORDER_DEFAULT`).
4. **URGENTE/PRIORITÁRIO nativo:** existe um campo no NOSSO banco, marcável no caso (UI), que o `sync-core` traduz em `temporal_level` — **prioritário ⇒ 1**, **urgente ⇒ 2** (via `task_override_temporal_level`/`process.temporal_level`). Sem marca ⇒ 0. **Não** buscar isso no ProJuris (não existe lá).
5. **Reflexo no scoring:** para um processo marcado coletivo+complexo+urgente, `final_points` reflete `collective(+0.2)+complexity(+0.2/0.3)+temporal(+0.3)` respeitando o teto `MAX_TOTAL_MODIFIER=0.8` (já no engine). Sem regressão para processos sem marcador (continuam 0/false como hoje).
6. **Diagnóstico:** o batch_log (`metrics`) lista, por amostra de processos, os marcadores encontrados e o `collective`/`complexity`/`temporal` derivado (para o owner auditar o casamento).
7. **Recebe-complexidade (4 executores):** `eligible_complex=true` **apenas** para os 4 executores definidos pelo Thiago (Bruno/Hudson/Patrícia/Keilane); os demais = `false`. Um processo marcado COMPLEXO só é elegível para atribuição a esses 4. **BLOQUEADO até o Thiago confirmar o de-para de nomes** (interpretação Bruno=Maxwel / Hudson=Wdyson — ver box no topo). Não persistir antes da confirmação.
8. **Regressão/segurança:** `npm run typecheck` + `npm run lint` verdes; `db:types` regenerado se houver coluna nova (campo URGENTE); RLS org-scoped preservada; SÓ LEITURA no ProJuris; nenhum segredo em log.

---

## Tasks / Subtasks

### T1 — Config de marcadores complexo/coletivo (@data-engineer)
- [ ] Constante/config (nomes de marcador normalizados) que mapeia → `{ collective?: true, complexity_level?: 1|2 }`. Tolerante a grafia (reusa `normalizeTemaKey`). Documentar a lista inicial (COMPLEXO, COLETIVO, e variações) e como estendê-la. **Confirmar com o owner os nomes EXATOS dos marcadores no ProJuris** (o Thiago disse "considera que vai estar como marcador também … pessoal começa a preencher").

### T2 — `sync-core.ts` lê marcadores e popula a entrada (@dev)
- [ ] No laço de processos, além de `proc.assunto`, capturar `marcadorNames(proc.marcadorWs)`; guardar por `process_id`. Ao montar `Process`, setar `collective`/`complexity_level` pela config; fallback `false`/`0`. Manter `theme_temporal_level`/`task_type_*` como já vêm dos mappings.
- [ ] Fonte configurável (default marcador; hook para campo personalizado depois).

### T3 — Campo URGENTE/PRIORITÁRIO nativo (@data-engineer + @dev)
- [ ] **Decisão de storage (ver Dev Notes):** (a) coluna em `system_cases` (ex.: `distribution_urgency TEXT NULL CHECK IN ('normal','prioritario','urgente')`) OU (b) campo por tema em `system_tema_field_defs`/`canonical_fields`. Preferência: coluna simples no caso (é regra do motor, transversal a tema). Migration aditiva + rollback + `db:types`.
- [ ] UI: marcar urgência no caso (na aba/ficha; pequeno select prioritário/urgente). Gate de escrita coerente com RBAC (`requireModule`/`usePodeEditar`).
- [ ] `sync-core.ts` lê a urgência do caso do processo e converte em `temporal_level` (prioritário=1/urgente=2) via `task_override_temporal_level`.

### T4 — Diagnóstico (@data-engineer)
- [ ] `metrics.marcador_diag` (amostra: process_id → marcadores + collective/complexity/temporal derivado), cap ~50, no `system_distribution_batch_logs` (padrão do `tema_diag` do H4).

### T4b — Recebe-complexidade por executor (@data-engineer) — BLOQUEADA (confirmar de-para)
- [ ] Após confirmação do Thiago do de-para de nomes (Bruno=Maxwel? Hudson=Wdyson?), setar `eligible_complex=true` só para os 4 (Bruno/Hudson/Patrícia/Keilane) e `false` para os demais em `system_projuris_executor_mapping` (via cadastro do M8 ou seed/migration). Revisar o default `?? true` em `sync-core.ts:304` (hoje NULL vira elegível; com a regra do Thiago a maioria é não-elegível). **NÃO executar antes da confirmação.** (AC-7)

### T5 — QA (@qa)
- [ ] Processo com marcador COLETIVO/COMPLEXO → modificadores aplicados; sem marcador → 0/false (fallback); caso marcado urgente → temporal=2; `typecheck`/`lint` verdes; SÓ LEITURA no ProJuris.
- [ ] Processo COMPLEXO só é atribuído a executor com `eligible_complex=true` (os 4); executor não-elegível não recebe complexo. (AC-7 — após confirmação do de-para)

---

## Dev Notes

- **A informação já está na mão para tema — replicar para marcadores.** O `normalizer.ts` já extrai `marcadores[]` do `GET /processo/{cod}`, mas o `sync-core.ts` (que roda o batch real) faz o GET do processo só para pegar `assunto`. Basta capturar também `marcadorWs` no mesmo GET (sem request extra).
- **Onde guardar o URGENTE:** o motor lê por **processo/caso**, não por tema. Uma coluna `distribution_urgency` em `system_cases` (ou tabela leve `system_case_distribution_flags`) é mais simples e transversal que um campo por tema. Campo por tema (`system_tema_field_defs`) só se o owner quiser configurá-lo por tema — mais custo, sem ganho aqui. **Recomendação: coluna no caso.**
- **Complexidade nível 1 vs 2:** o engine aceita 0/1/2. Se o ProJuris só tiver um marcador "COMPLEXO" (binário), mapear para 1; reservar 2 para um marcador dedicado ("MUITO COMPLEXO") se existir. Confirmar com o owner.
- **Precedência com theme/task_type:** `calculateFinalComplexity/Temporal` fazem `max(...)`. Então o marcador do processo **soma-se** (via max) ao que já vem de tema/tipo — não sobrescreve para baixo. Coerente: urgente do caso eleva mesmo que o tipo seja "normal".
- **v1 → v2 (campo personalizado):** decisão do Thiago de migrar marcador→campo personalizado depois; a config de fonte (T1/T3) deve deixar isso como troca de parâmetro.
- **Migrations via pg direto** (`reference_aplicar_migrations_pg_direto`): `npx tsx scripts/db-apply-pg.ts`; dev=prod; rollback simétrico.

**Riscos:**
- **R1 — nome do marcador não bate:** se a grafia real diferir da config, complexo/coletivo não é detectado (cai no fallback — seguro, mas subestima). Mitigação: normalização + `marcador_diag` para o owner auditar a cobertura.
- **R2 — dupla contagem:** urgente do caso + temporal do tema podem se somar via max (é o desejado); garantir que não haja soma dupla no mesmo eixo.
- **R3 — regressão:** processos sem marcador têm de continuar 0/false idênticos a hoje (testar).

### Testing
- Marcador "COLETIVO" → `collective=true` (+0.2); "COMPLEXO" → `complexity=1` (+0.2); ausência → 0/false.
- Caso marcado urgente → `temporal=2` (+0.3); prioritário → 1 (+0.1); nenhum → 0.
- Teto 0.8 respeitado quando somados.
- `runSync` sem regressão para processos sem marcador.

---

## Dependências

- **Depende de (entregues):** `engine/scoring.ts` + `engine/types.ts` (consomem os 3 sinais); `normalizer.ts` (`marcadorNames`/`marcadorWs`); `sync-core.ts` (montagem da entrada); `normalizeTemaKey`; `system_cases`; RBAC (`requireModule`/`usePodeEditar`).
- **Insumo do owner:** nomes EXATOS dos marcadores de complexo/coletivo no ProJuris (confirmar; o time começa preenchendo).
- **⚠️ Insumo do owner (BLOQUEIA T4b/AC-7):** confirmar o de-para de nomes de "recebe complexidade" — Bruno=Maxwel Bruno Santos Costa? Hudson=Wdyson Neres Moreira da Costa? (Patrícia=Ana Patrícia Cruz, Keilane=Keilane Alves).
- **Relaciona com M8:** `eligible_complex` por executor vive em `system_projuris_executor_mapping`, cadastrável no diálogo de usuário (M8). A regra "só 4 pessoas" é dado de cadastro, não código do engine.
- **Relaciona com:** H4 (mesmo GET de processo; padrão de config/diag), M12 (tipos), M14 (exceções).

## File List (previsto)

- `sistema-hv/src/lib/distribuicao/sync-core.ts` — captura `marcadorWs` por processo; popula `Process.collective`/`complexity_level`; lê urgência do caso → `temporal_level`; `marcador_diag` no batch_log.
- `sistema-hv/src/lib/distribuicao/marcadores.ts` (NOVO — sugerido) — config marcador-normalizado → `{collective, complexity_level}` + fonte configurável.
- `sistema-hv/supabase/migrations/2026080700000X_case_distribution_urgency.sql` (+ rollback) — coluna `distribution_urgency` em `system_cases` (ou tabela leve).
- `sistema-hv/src/lib/supabase/types.ts` — coluna nova.
- UI da ficha/caso — controle de urgência (arquivo a confirmar na exploração da aba do caso).

## Change Log

| Data | Versão | Descrição | Autor |
|------|--------|-----------|-------|
| 2026-08-07 | v0.1 | Draft. v1 puxa COMPLEXO/COLETIVO de MARCADOR do processo (`marcadorWs`, que o `normalizer` já extrai mas o `sync-core` ainda não lê), casando por nome normalizado; fallback individual/não-complexo; fonte configurável p/ virar campo personalizado depois. URGENTE/PRIORITÁRIO = campo NATIVO nosso (não existe no ProJuris) em `system_cases`, marcável no caso, → `temporal_level` (prioritário=1/urgente=2). Buraco corrigido: hoje `sync-core` monta `collective=false`/`complexity=0`/`temporal=0` FIXOS. Diagnóstico `marcador_diag` no batch_log. | @sm (Bob) |
| 2026-08-08 | v0.2 | +regra recebe-complexidade (4 pessoas, interpretação Bruno/Hudson a confirmar). @sm |
| 2026-08-08 | v0.3 | CONFIRMADO pelo owner: Bruno=Maxwel Bruno Santos, Hudson=Wdyson Neres. Os 4 com eligible_complex=true = Maxwel, Wdyson, Ana Patrícia Cruz, Keilane Alves. Deixou de ser "a confirmar". | @sm |
| 2026-08-08 | v1.0 (parcial) | **NÚCLEO implementado** (@aios-master/Orion) — fecha o "buraco real". **T1:** novo `lib/distribuicao/marcadores.ts` (`MARCADOR_MAP` normalizado + `deriveFromMarcadores`, fonte configurável, tolerante a grafia via `normalizeTemaKey`; fallback determinístico false/0). **T2:** `marcadorNames` exportado do `normalizer.ts`; `sync-core.ts` captura `marcadorWs` no mesmo GET /processo (sem request extra) e popula `Process.collective`/`complexity_level` derivados (antes fixos `false`/`0`). **T4:** `marcador_diag` no `metrics` do batch_log (amostra ≤50, só processos com marcador). Typecheck+lint verdes. **PENDENTES (follow-up):** (T3) campo URGENTE/PRIORITÁRIO nativo → `temporal_level` — exige migration em `system_cases` + UI + join processo→caso (temporal segue 0, sem regressão); (T4b) setar `eligible_complex=true` só nos 4 (Maxwel/Wdyson/Ana Patrícia/Keilane) + revisar default `?? true` no `sync-core:304` — é seed de cadastro (precisa dos IDs; fazer via UI do M8 ou SQL); confirmar nomes EXATOS dos marcadores no ProJuris (auditar pelo `marcador_diag`). SÓ LEITURA no ProJuris. Não commitado. | @aios-master (Orion) |
