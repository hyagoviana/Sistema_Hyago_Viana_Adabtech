# Story H4: `resolveTema()` inteligente (assunto/marcador/campo → motor_theme_id)

**Épico:** ProJuris / Distribuição — Reunião 2026-08-05
**ID:** H4
**Status:** Ready for Review
**Estimativa:** M
**Executor sugerido:** @data-engineer + @dev · Quality gate: @qa
**Risco:** MÉDIO — de-para de tema errado → `multiplier` errado → distribuição injusta silenciosa; mitigado por fallback + alerta (não falha o batch)

---

> **NOTA DE ESCOPO:** O **motor v1.0 JÁ EXISTE** (engine + `sync-core.ts` + `normalizer.ts` + tabelas). Esta story **NÃO reconstrói o motor** — torna a **resolução de tema** determinística e por de-para (`system_theme_mapping`), fechando a ponta que hoje usa só o *assunto cru*. Reusa o `resolveTema()` já esboçado no `normalizer.ts` (com `TODO(A9/Thiago)`) e as tabelas de mapping existentes.

---

## Story

**Como** motor de distribuição,
**quero** resolver o **TEMA SHV** (`motor_theme_id`) de uma intimação a partir de assunto / marcador / campo-personalizado do ProJuris via de-para (`system_theme_mapping`), com fallback para alerta quando não casar,
**para** que o `multiplier` correto seja aplicado na pontuação — hoje o `normalizer.ts`/`sync-core.ts` casam o **assunto cru** direto contra `projuris_tema_codigo` (que ainda é NOME placeholder), o que é frágil (variação de acento/caixa/near-miss faz a tarefa cair fora do mapa e sumir da distribuição).

---

## Contexto / o que JÁ EXISTE vs NOVO

### JÁ EXISTE (reusar — NÃO reconstruir)

- **`resolveTema()` esboçado:** `sistema-hv/src/lib/projuris/normalizer.ts` — já implementa uma heurística CONFIGURÁVEL que tenta, em ordem: (1) campo personalizado "TEMA" (`codigoCampoDinamico=10021`, `PROJURIS_CAMPO_TEMA_CODIGO`), (2) qualquer campo cujo nome bata `/tema|assunto|frente/i`, (3) `assunto` do processo, (4) 1º marcador. Retorna **string livre** (o nome), com `TODO(A9/Thiago)` para fixar a fonte canônica. **Falta o passo final: string → código → `motor_theme_id` via de-para.**
- **Candidatos já extraídos:** `TemaCandidatos` em `normalizer.ts` já traz `assunto`, `assuntoCnj`, `marcadores[]`, `camposPersonalizados[]` (achatados via `flattenCampo`) do `GET /processo/{cod}` — os 3 baldes crus para o Thiago inspecionar.
- **Achado-chave do A9 (2026-08-05):** o TEMA SHV está HOJE no campo **`assunto` do PROCESSO** — valores reais (`1% ESF`, `1% COVID`, `CÍVEIS`, `CONCESSÃO`) **casam** com os placeholders de `system_theme_mapping`. O `GET /processo/assunto` só devolve os 17 assuntos CNJ de topo (não os temas SHV) — por isso o casamento é pelo `assunto` do processo, não pela lista CNJ. Existe TAMBÉM o campo dedicado "TEMA" (10021), porém VAZIO nos processos vistos (provável destino oficial ainda não preenchido).
- **De-para consumido no batch:** `sistema-hv/src/lib/distribuicao/sync-core.ts` monta `thMap` de `system_theme_mapping` (`projuris_tema_codigo → { motor_theme_id, multiplier, temporal_level, exclusive_executor_id }`) e hoje faz `thMap.get(assunto)` — **casamento exato do assunto cru**; se `!th` a tarefa é **descartada silenciosamente** (`continue`), sem alerta. Este é o ponto frágil que H4 corrige.
- **Tabela de mapping:** `system_theme_mapping` (`projuris_tema_codigo`, `projuris_tema_descricao`, `motor_theme_id`, `multiplier`, `temporal_level`, `exclusive_executor_id`, `active`) — **26 temas** (A9). `projuris_tema_codigo` hoje = NOME placeholder (ex.: `INDENIZAÇÃO PMMB`, `TEMFC`, `1% COVID`).
- **Alertas:** `sistema-hv/src/lib/distribuicao/engine/alerts.ts` — catálogo de `ALT-*`; padrão de "alerta não-fatal que não quebra o batch". `NormalizedIntimacao.alerts[]` já acumula avisos não-fatais no normalizer.

### NOVO (a construir nesta story)

- **Casamento normalizado (não exato):** resolver o tema ignorando acento/caixa/espaços e cobrindo os candidatos (assunto → campo 10021 → marcador), retornando o **`motor_theme_id`** (não só a string).
- **Fonte configurável/priorizada:** ordem de preferência entre `assunto` vs campo "TEMA" (10021) vs marcador, parametrizável quando o Thiago confirmar a fonte canônica (`TODO` do `resolveTema`).
- **Fallback com ALERTA (não descarte silencioso):** intimação cujo tema não casa gera **alerta** (`ALT-*` de tema não mapeado) e é reportada — em vez de sumir com `continue`. O batch continua.
- **De-para real do `projuris_tema_codigo`** (opcional/coordenado com H1): trocar o NOME placeholder pelo código/valor canônico do ProJuris quando o Thiago confirmar a fonte — mas o casamento por nome normalizado funciona já com o placeholder.

---

## Acceptance Criteria

1. **`resolveTemaId()` retorna código do motor:** dada uma intimação normalizada (com `TemaCandidatos`), a resolução devolve o **`motor_theme_id`** (+ `multiplier`/`temporal_level`/`exclusive_executor_id` da linha `system_theme_mapping`) — não apenas a string do tema. A string resolvida (`tema_resolvido`) continua disponível para exibição/diagnóstico.

2. **Casamento por nome normalizado:** o de-para casa ignorando **acento, caixa e espaços extras** (ex.: `INDENIZAÇÃO PMMB` == `indenizacao pmmb`), cobrindo os placeholders atuais de `system_theme_mapping`. Assim variações de grafia deixam de derrubar o casamento.

3. **Ordem de fontes configurável:** a resolução tenta os candidatos numa ordem parametrizável — default (do achado A9): campo "TEMA" (10021) **se preenchido** → `assunto` do processo → marcador. Quando o Thiago confirmar a fonte canônica, basta ajustar a config/constante (documentado no `resolveTema`).

4. **Fallback com alerta (SEM descarte silencioso):** intimação cujo tema **não casa** com nenhuma linha de `system_theme_mapping` gera um **alerta não-fatal** (código dedicado, ex.: `ALT-TEMA-001` "tema não mapeado") anexado à intimação/resultado, e o **batch continua** (não trava, não some sem rastro). O `sync-core.ts` deixa de fazer `continue` silencioso no caso "tema não mapeado" e passa a registrar o alerta.

5. **Integração no batch:** `sync-core.ts` usa `resolveTemaId()` no lugar do `thMap.get(assunto)` exato. Tarefas com tema resolvido são pontuadas com o `multiplier` correto; tarefas sem tema aparecem no resumo com o alerta (contabilizadas, não descartadas).

6. **Diagnóstico:** para cada intimação, os 3 baldes candidatos (`assunto`, campo 10021, marcadores) e o tema resolvido (ou o motivo do não-casamento) ficam disponíveis (em `raw_data`/log/normalizer) para o owner auditar a cobertura do de-para.

7. **Regressão / segurança:** só LEITURA no ProJuris; `npm run typecheck` + `npm run lint` verdes; RLS/imutabilidade preservadas; nenhum segredo em log/front. Sem DDL nova exigida (usa `system_theme_mapping` como está); se o de-para real do código for aplicado, seed idempotente + rollback (coordenar com H1).

---

## Tasks / Subtasks

### T0 — Confirmar fonte canônica do tema (@data-engineer)
- [ ] Com o owner/Thiago: fixar se o tema canônico é `assunto` do processo (populado hoje) ou o campo "TEMA" (10021, hoje vazio). Ajustar a ordem default em `resolveTema()`. (AC-3)
- [ ] Levantar a cobertura atual: quais valores de `assunto` reais casam com os 26 temas (near-miss?), reusando o smoke `projuris-normalize-smoke.ts` citado no A9. (AC-2, AC-6)

### T1 — Resolver string → `motor_theme_id` (@dev + @data-engineer)
- [x] Função `resolveTemaId(cand, themeMap)` que normaliza (acento/caixa/espaço) e casa contra `system_theme_mapping`, retornando `{ theme:{ motor_theme_id, multiplier, temporal_level, exclusive_executor_id }, tema_resolvido, source } | null`. Reusa/estende `resolveTema()`. + `buildThemeMap()` e `normalizeTemaKey()`. (AC-1, AC-2)
- [x] Ordem de fontes configurável (`TEMA_SOURCE_ORDER_DEFAULT` = campo 10021 → campo-nome → assunto → marcador). (AC-3)

### T2 — Fallback com alerta no batch (@dev)
- [x] Adicionar código de alerta de tema não mapeado (`ALT-TEMA-001`) ao catálogo `alerts.ts` (warning, não-blocking). (AC-4)
- [x] `sync-core.ts`: trocar o `continue` silencioso do "tema não mapeado" por registro de alerta (`preBatchAlerts["ALT-TEMA-001"]`) + contabilização no resumo (`mergedAlertsSummary`) e no batch_log (`alerts_generated`/`temas_nao_mapeados`). (AC-4, AC-5)

### T3 — Pontuação com tema resolvido (@dev)
- [x] `sync-core.ts` casa o tema por NOME NORMALIZADO (`thMap.get(normalizeTemaKey(assunto))`) via `buildThemeMap`; `theme_id`/`theme_multiplier`/`theme_temporal_level`/`theme_exclusive_executor_id` da `Task` preenchidos com a linha resolvida. (AC-5)

### T4 — Diagnóstico (@data-engineer)
- [x] `temaDiag` (assunto cru → motor_theme_id resolvido/null) persistido no `metrics.tema_diag` do batch_log (cap 50) + `metrics.temas_nao_mapeados`. (AC-6)

### T5 — QA / regressão (@qa)
- [x] `typecheck` verde (só o erro pré-existente de `contaazul/service.ts`); `eslint` verde nos arquivos tocados; só LEITURA no ProJuris. (AC-7)
- [ ] Smoke em runtime (intimações reais → grafia variante CASA / tema inexistente → `ALT-TEMA-001` contabilizado) — pendente @qa com credenciais ProJuris.

---

## Dev Notes

- **O achado do A9 é o alicerce:** o tema mora HOJE no `assunto` do PROCESSO (não na lista CNJ). H4 não "descobre" a fonte — ele torna o casamento robusto (normalizado) e não-silencioso (fallback com alerta) e devolve o `motor_theme_id`.
- **Não falhar o batch é regra:** hoje `sync-core.ts` faz `continue` quando `!th` — a tarefa some sem rastro. H4 troca isso por alerta + contabilização (AC-4). Esse é o ganho operacional real (o owner enxerga "N intimações sem tema mapeado" em vez de um total que não fecha).
- **Coordenar com H1:** H1 sincroniza `projuris_*_descricao`; H4 pode aproveitar para, quando o Thiago confirmar, gravar o `projuris_tema_codigo` real (hoje NOME placeholder). Mas H4 **funciona já** com o placeholder via casamento por nome normalizado — não bloqueia em H1.
- **Campo 10021 vazio hoje:** a ordem default prefere o campo "TEMA" **quando preenchido**, caindo para `assunto`. Isso deixa a virada para o campo dedicado sem retrabalho quando o escritório começar a preenchê-lo.
- **Exceções de tema** (`exclusive_executor_id` em `system_theme_mapping`, ex.: INDENIZAÇÃO PMMB→Thaise, TEMFC→Ana Patricia) dependem do tema resolvido corretamente — H4 alimenta a precedência de exceção do `flow-selector`. Casamento errado aqui vaza para a atribuição.
- **Migrations via pg direto** (`reference_aplicar_migrations_pg_direto`) se houver seed do código real: `npx tsx scripts/db-apply-pg.ts`; dev=prod; rollbacks em `sistema-hv/supabase/rollbacks/`.

**Riscos:**
- **R1 — casamento errado → multiplier errado:** distribuição injusta silenciosa. Mitigação: normalização + diagnóstico (AC-6) + o owner audita a cobertura antes do piloto.
- **R2 — near-miss de tema** (como os 5 tipos near-miss do A9): temas com grafia sem equivalente exato caem no fallback. Aceitável (alerta), owner resolve.
- **R3 — fonte canônica muda** (assunto → campo 10021): mitigado por ordem configurável (AC-3).

---

## Testing

- **Resolução (unit):** `resolveTemaId()` — `INDENIZAÇÃO PMMB`/`indenizacao pmmb` casam o mesmo `motor_theme_id`; campo 10021 preenchido tem prioridade sobre `assunto`; sem candidato → `null`.
- **Batch:** lote de teste → tarefas com tema resolvido pontuadas com `multiplier` certo; tema inexistente → `ALT-TEMA-001` + intimação no resumo (não descartada); exceção de tema (PMMB→Thaise) dispara quando o tema casa.
- **Diagnóstico:** `raw_data`/log listam candidatos + tema resolvido/motivo.
- **Regressão:** só LEITURA no ProJuris; `typecheck`/`lint` verdes; RLS/imutabilidade preservadas.

---

## Dependências

- **`normalizer.ts` (`resolveTema` + `TemaCandidatos`)** e **`sync-core.ts` (`thMap`)** — JÁ existem; base desta story.
- **`system_theme_mapping`** (26 temas) — JÁ existe; H4 casa contra ele.
- **Achado A9 (tema = `assunto` do processo; campo 10021)** — insumo direto.
- **H1 (de-para/descrições)** — coordenar se for gravar `projuris_tema_codigo` real; **não bloqueante** (casamento por nome funciona com placeholder).
- **Confirmação do Thiago sobre a fonte canônica** (assunto vs campo 10021) — refina a ordem default, não bloqueia a implementação.

---

## File List

**Implementado (2026-08-05):**
- `sistema-hv/src/lib/projuris/normalizer.ts` — `resolveTemaId()`, `buildThemeMap()`, `normalizeTemaKey()`, `TEMA_SOURCE_ORDER_DEFAULT`, tipos `ThemeMapRow`/`ResolvedTema`/`TemaSource`.
- `sistema-hv/src/lib/distribuicao/sync-core.ts` — `thMap` normalizado; casamento por `normalizeTemaKey`; alerta `ALT-TEMA-001` + contabilização (`preBatchAlerts`/`mergedAlertsSummary`) + diagnóstico (`metrics.tema_diag`).
- `sistema-hv/src/lib/distribuicao/engine/alerts.ts` — +`ALT-TEMA-001` (warning, não-blocking).

**Não feito (fora do escopo desta rodada):**
- Seed do `projuris_tema_codigo` real (coordenar com H1; casamento por nome normalizado já funciona com o placeholder).

---

## Change Log

| Data | Versão | Descrição | Autor |
|------|--------|-----------|-------|
| 2026-08-05 | v0.1 | Draft inicial | @sm (Bob) |
| 2026-08-05 | v0.2 | Implementado (@dev via Orion). `resolveTemaId()`/`buildThemeMap()`/`normalizeTemaKey()`/`TEMA_SOURCE_ORDER_DEFAULT` em `src/lib/projuris/normalizer.ts` (casamento por nome normalizado acento/caixa/espaço, ordem de fontes configurável campo10021→campo-nome→assunto→marcador). `ALT-TEMA-001` (warning, não-blocking) em `src/lib/distribuicao/engine/alerts.ts`. `src/lib/distribuicao/sync-core.ts`: `thMap` agora normalizado via `buildThemeMap`; casamento por `normalizeTemaKey(assunto)`; o `continue` silencioso do tema não mapeado virou `preBatchAlerts["ALT-TEMA-001"]`, mesclado no resumo (`mergedAlertsSummary`), no batch_log (`alerts_generated`) e diagnóstico (`metrics.tema_diag`/`temas_nao_mapeados`). Sem migration (usa `system_theme_mapping` como está). Gates: typecheck verde (só pré-existente contaazul), eslint verde nos arquivos tocados. Só LEITURA no ProJuris. Pendente: smoke em runtime (@qa) + confirmação da fonte canônica pelo Thiago (ordem default já implementada, basta reordenar `TEMA_SOURCE_ORDER_DEFAULT`). | @dev |
