# Story M9: Peso ajustável do executor (base 100 = distribui igual) para quem está saindo/entrando + confirmar que o motor usa o peso atual na data

- **Épico:** ProJuris / Distribuição — Reunião 2026-08-07
- **ID:** M9
- **Status:** Ready for Review
- **Estimativa relativa:** S/M
- **Executor sugerido:** @dev + @architect · Quality gate: @qa
- **Risco:** BAIXO — o campo "Peso na fila" JÁ existe na UI (H5) e o motor já usa o peso na fórmula de crédito proporcional. Esta story é sobretudo **confirmação + UX de base 100** + documentar a semântica. Migration só se o default precisar mudar.
- **Origem:** Reunião 2026-08-07, item **M9**. Refinamento de **H5** (peso já entregue como `weight` no mapping) e do motor v1.0 (`responsible-engine.ts` fila geral proporcional ao peso).

> **O MOTOR v1.0 JÁ EXISTE.** O peso já é entregue: campo "Peso na fila" no diálogo de editar usuário (H5), gravado em `system_projuris_executor_mapping.weight`, e consumido pelo motor como `general_weight` no crédito proporcional da fila geral. M9 é REFINAMENTO: (a) padronizar a **base 100** ("distribui igual"), (b) dar UX de "reduzir quando sai / aumentar quando entra", (c) **confirmar** que o motor usa o peso ATUAL na data e documentar.

---

## Story

**Como** administrador/controladoria do motor de distribuição,
**quero** que o peso padrão do executor seja **100** (todos com 100 ⇒ distribuição igual) e poder **reduzir** o peso de quem está **saindo** (recebe menos tarefas) ou **aumentar** o de quem está **entrando/voltando** (recebe mais), com a garantia de que o motor usa o **peso atual na data** da distribuição,
**para** modular a carga sem tirar ninguém do rodízio de forma abrupta (rampa de saída/entrada), mantendo a fila proporcional e previsível.

> **DECISÕES TRAVADAS (reunião 2026-08-07):**
> 1. **Peso padrão = 100** = "distribui igual" (base de referência, não 1.0).
> 2. **Mecanismo de ajuste:** reduzir o peso de quem está saindo (recebe menos) / aumentar de quem entra. É **ajuste de UI** do valor já existente — não um novo motor.
> 3. **Peso atual na data:** o motor sempre considera o **peso vigente no momento** da distribuição. **CONFIRMAR** se o comportamento atual já faz isso; se sim, documentar; se não, ajustar.

---

## Contexto / o que JÁ EXISTE vs NOVO

### JÁ EXISTE (reusar — NÃO reconstruir)

- **Campo Peso na UI:** `sistema-hv/src/components/settings/UsersAdmin.tsx` — Input "Peso na fila" (`type=number`, `min=0.1 max=10 step=0.1`) no bloco "Distribuição (ProJuris)"; salva via `setDistribution` (H5).
- **Persistência:** `sistema-hv/src/lib/users-service.ts` `setUserDistribution({ weight })` → upsert em `system_projuris_executor_mapping.weight`. Coluna criada em `sistema-hv/supabase/migrations/20260728000003_distribution_config.sql:30` — `weight NUMERIC(5,2) NOT NULL DEFAULT 1.0`.
- **Motor usa o peso (proporcional):** `sistema-hv/src/lib/distribuicao/engine/responsible-engine.ts` — `creditGeneralQueue()`: `credit = final_points * executor.general_weight / sum_eligible_weights`; `getEligibleExecutors()` exige `general_weight > 0` na fila GENERAL. A fila COMPLEX é **igual** (`creditComplexQueue`: `points / count`) — **não** usa peso (por design). `general_weight` vem de `system_projuris_executor_mapping.weight` em `sync-core.ts:303` (`general_weight: m?.weight ?? 1`).
- **Leitura do peso "na data":** `sync-core.ts` lê `weight` do mapping **no momento do `runSync(distributionDate)`**. Não há versionamento temporal do peso — o "peso atual na data" = o valor gravado no mapping quando a rodada roda.

### NOVO / A CONFIRMAR nesta story

- **Base 100 (UX/semântica):** hoje o default do banco é `1.0` e a UI limita `min=0.1 max=10`. Para "100 = igual", ou (a) **reinterpretar** a UI para base 100 (default 100, range ex.: 0–200) — exige migration de default + normalização (o motor usa **razão** `weight/soma`, então 100/100/100 ≡ 1/1/1; só muda a escala de exibição), ou (b) manter internamente 1.0 e rotular a UI como "100%" (peso 1.0 = 100%). **Decisão de arquitetura em T0.**
- **Ajuste "saindo/entrando":** a UI já permite editar o peso; M9 só melhora a orientação (helper text / presets tipo "saindo: 50", "entrando: 100"). Sem novo backend.
- **Confirmação "peso atual na data":** documentar que o `runSync` lê o `weight` vigente no mapping no instante da rodada (não há histórico); se o owner quiser peso **agendado** (ex.: "a partir de tal data o peso vira X"), isso é escopo FUTURO — registrar como fora deste recorte.

---

## Acceptance Criteria

1. **Decisão de base 100 (T0):** documentado se a base 100 será (a) escala real no banco (migration de default + range da UI) ou (b) apresentação ("peso 1.0 exibido como 100%"). Como o motor usa a **razão** entre pesos, a escolha **não** altera a distribuição relativa — só a leitura humana. A story registra a decisão no Change Log.
2. **Default/again coerente:** o valor padrão para um novo executor corresponde a "distribui igual" (100 na escala escolhida). Se a opção (a), migration aditiva ajusta o `DEFAULT` sem quebrar os registros existentes (normalização documentada); se (b), a UI mostra 100 quando `weight=1.0`.
3. **UI de ajuste saída/entrada:** o campo Peso em `UsersAdmin.tsx` orienta o admin a **reduzir** (quem sai) / **aumentar** (quem entra) — helper text e/ou presets, respeitando o range da escala escolhida. Salvar persiste o novo peso no mapping (reuso de `setUserDistribution`).
4. **Peso atual na data (confirmação + doc):** confirmado por leitura de código que `runSync` usa o `weight` **vigente** no mapping no instante da rodada (via `sync-core.ts` → `general_weight`). A story documenta essa semântica e deixa explícito que **não** há histórico/agendamento de peso (peso agendado = FUTURO, fora do recorte).
5. **Fila complexa inalterada:** documentado que a fila COMPLEX distribui **igual** (não usa peso, por design de `creditComplexQueue`); o ajuste de peso afeta só a fila GERAL. Sem mudança de comportamento aqui.
6. **Regressão/segurança:** se houver migration, `db:types` regenerado e rollback simétrico; `npm run typecheck` + `npm run lint` verdes; RLS org-scoped preservada; distribuição relativa entre executores idêntica antes/depois (a menos do peso que o admin mudar).

---

## Tasks / Subtasks

### T0 — Decisão de arquitetura: base 100 real vs apresentação (@architect + @dev) — antes de codar
- [ ] Escolher (a) escala real no banco (default 100, range UI ex. 0–200, migration de `DEFAULT` + normalização documentada) OU (b) apresentação (interno 1.0, UI mostra "100%"). Registrar no Change Log. Fator-chave: o motor usa `weight / sum_weights` (razão), então 100/100 ≡ 1/1 — a escolha é de legibilidade, não de matemática. (AC-1)

### T1 — Confirmação do motor (@dev + @architect)
- [ ] Ler `sync-core.ts` (`general_weight: m?.weight ?? 1`) + `responsible-engine.ts` (`creditGeneralQueue`) e **documentar** que o peso usado é o vigente no mapping no instante do `runSync(distributionDate)`; sem histórico. Anotar que fila COMPLEX ignora peso. (AC-4, AC-5)

### T2 — UI base 100 + ajuste (@dev)
- [ ] `UsersAdmin.tsx`: ajustar Input "Peso na fila" à escala escolhida (default/placeholder/range) + helper text "Padrão 100 = distribui igual. Reduza para quem está saindo; aumente para quem entra." (AC-2, AC-3)
- [ ] (se opção b) mapear 1.0↔100 na leitura/gravação sem tocar no banco; (se opção a) usar o valor direto. (AC-1,2)

### T3 — Migration (só se opção a) (@data-engineer)
- [ ] `ALTER TABLE system_projuris_executor_mapping ALTER COLUMN weight SET DEFAULT 100` + (opcional) normalizar existentes `weight = weight * 100` **uma vez** (cuidado: idempotência — não multiplicar 2×; usar migration versionada não-reexecutável ou guarda). Rollback simétrico. `db:types`. **Só se T0 = opção (a).** (AC-2, AC-6)

### T4 — QA (@qa)
- [ ] 3 executores com peso 100 → distribuição igual na simulação. (AC-2)
- [ ] Reduzir 1 para 50 → ele recebe ~metade da proporção dos de 100 na fila GERAL. (AC-3,4)
- [ ] Confirmar que a fila COMPLEX não muda com o peso. (AC-5)
- [ ] `typecheck` + `lint` verdes. (AC-6)

---

## Dev Notes

**A matemática não muda com a escala.** `creditGeneralQueue` usa `weight_i / Σ weight`. Portanto 100/100/100 produz exatamente o mesmo crédito que 1/1/1. A "base 100" é uma escolha de **legibilidade** para o admin (é intuitivo pensar "esse recebe 50% do padrão"). Preferir a opção que menos mexe no banco se o owner topar (b); (a) é mais "honesta" mas exige migration + normalização cuidadosa.

**"Peso atual na data" = valor vigente no mapping.** O motor não versiona peso no tempo. Cada `runSync(distributionDate)` lê o `weight` que estiver no mapping naquele instante. Então "reduzir quem está saindo" funciona: o admin baixa o peso hoje, e as rodadas a partir de agora já usam o valor menor. Se o owner quiser "peso X só a partir do dia D" (agendamento), isso é FUTURO — registrar, não implementar.

**Fila complexa é igualitária por design.** `creditComplexQueue` divide os pontos igualmente entre elegíveis, ignorando peso (regra do motor v1.0). O ajuste de peso só modula a fila GERAL. Não "consertar" isso nesta story — é comportamento especificado.

**Não confundir com M8 (nível).** Nível (M8) decide **quem entra** no rodízio (só sênior). Peso (M9) decide **quanto** cada um que já está no rodízio recebe. Deixar isso claro na UI para o admin não achar que "peso 0" = tirar do rodízio (tirar = flag "participa" off, M8/H5).

**Migrations via pg direto.** `npx tsx scripts/db-apply-pg.ts <arquivo.sql>` da pasta `sistema-hv/` (ver `reference_aplicar_migrations_pg_direto`). dev=prod.

**Riscos:**
- **R1 — dupla normalização.** Se T3 multiplicar `weight*100` e a migration rodar 2×, os pesos explodem. Mitigar: migration não-reexecutável ou guarda (`WHERE weight <= 10`).
- **R2 — range da UI cortando peso alto.** `max=10` atual quebra a base 100. Ajustar o range junto da escala.
- **R3 — expectativa de agendamento.** O owner pode achar que "reduzir peso" já agenda no tempo. Documentar que é imediato (vigente na próxima rodada), não datado.

### Testing
- 3 pesos iguais → crédito igual na fila geral.
- 1 peso a 50% → metade da proporção; COMPLEX inalterada.
- Se opção (a): migration idempotente, existentes normalizados 1×.
- `npm run typecheck` + `npm run lint` verdes.

---

## Dependências

- **Depende de (entregues):** H5 (campo Peso + `setUserDistribution` + `weight` no mapping); motor v1.0 (`responsible-engine.ts` fila geral proporcional, `sync-core.ts` leitura do peso).
- **Relaciona com M8** (nível): eixos complementares (quem entra × quanto recebe).

## File List

**A definir na implementação. Previsto:**
- `sistema-hv/src/components/settings/UsersAdmin.tsx` (escala/base 100 + helper text no campo Peso).
- `sistema-hv/src/lib/distribuicao/sync-core.ts` / `responsible-engine.ts` (SÓ LEITURA/doc — confirmar peso vigente; provável zero alteração).
- `sistema-hv/supabase/migrations/20260807xxxxxx_executor_weight_base100.sql` (+ rollback) **só se** T0 = opção (a).

## Change Log

| Data | Versão | Descrição | Autor |
|------|--------|-----------|-------|
| 2026-08-07 | v0.1 | Draft inicial. Refinamento de H5 + motor v1.0: padronizar peso base **100** ("distribui igual"), UX para reduzir (saindo) / aumentar (entrando), e **confirmar/documentar** que o motor usa o peso vigente no mapping no instante do `runSync` (sem histórico; agendamento = futuro). T0 decide base 100 real (migration de default + normalização) vs apresentação (1.0↔100%). Fila COMPLEX permanece igualitária (não usa peso). Motor já usa o peso — story é confirmação + UX. | @sm (Bob) |
| 2026-08-08 | v1.0 | **Implementado** (@aios-master/Orion). **T0 = opção (a)** — base 100 REAL no banco. Migration `20260808000040` (`ALTER COLUMN weight SET DEFAULT 100` + normaliza existentes `weight*100 WHERE weight<=10`, guarda de idempotência R1) aplicada 2×; rollback simétrico (`/100 WHERE weight>10`). `setUserDistribution` default 1.0→100. UI (`UsersAdmin` + `InviteUserDialog`): campo Peso range `0–200 step 5`, default 100, helper "100 = distribui igual; reduza p/ quem sai, aumente p/ quem entra; vale na próxima rodada; não confundir com tirar do rodízio". T1 confirmado: `sync-core.ts` lê `general_weight = mapping.weight` no instante do `runSync` (peso vigente, sem histórico/agendamento=futuro); fila COMPLEX ignora peso (igualitária, `creditComplexQueue`) — SEM alteração no motor (AC-4/AC-5 = doc). Como o motor usa razão `weight/Σweight`, a distribuição relativa é idêntica (100/100 ≡ 1/1). Typecheck+lint verdes. Não commitado/deployado. | @aios-master (Orion) |
