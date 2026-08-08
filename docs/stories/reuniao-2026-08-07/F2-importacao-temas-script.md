# Story F2: Processo/script de importação genérico (contrato JSON) para os demais temas

- **Épico:** Futuro (pós-segunda) — Reunião 2026-08-07
- **ID:** F2
- **Status:** **Backlog / Futuro**
- **Estimativa relativa:** L
- **Executor sugerido:** @data-engineer + @dev · Quality gate: @qa + @architect
- **Risco:** MÉDIO — importa cliente/caso/campos-por-tema em prod; erro no de-para de `field_def` (key/ID) suja o `canonical_fields`. Exige dry-run + validação de contrato antes de gravar.
- **Origem:** Reunião 2026-08-07 (bloco FUTURO, **F2**). Transcrição `Dr. Thiago Correia [0000] se tiver.txt` (parte 2): *"tenho 3, 4 temas pequenos… eu construiria esse motor de implantação… te forneceria o entregável na forma que precisa"*, *"o ideal é JSON… algo sistêmico"*, *"você tem que me entregar esse ID com essa informação da pessoa"* (IDs de campo personalizado).

> ⚠️ **NÃO É PARA ANTES DE SEGUNDA.** O próprio Thiago: *"não seria para antes da reunião de segunda."* O Matheus vai passar o script **depois** da reunião de segunda. Trabalho de FUTURO.

---

## Story

**Como** time de dados (Matheus) que precisa trazer os demais temas do escritório para o sistema,
**quero** um **processo/script de importação genérico** com um **contrato de JSON** bem definido (colunas/campos por **cliente**, **caso** e **tema**, incluindo os **IDs dos campos personalizados**),
**para que** o Thiago possa montar o "motor intermediário" dele (com GPT/Gemini) que lê as bases bagunçadas do escritório e **entrega o JSON já no formato que o sistema importa**, sem consumir dias de dev por tema — cada tema é implantado, o pessoal completa no dia a dia.

> **DECISÕES TRAVADAS (reunião 2026-08-07):**
> 1. **Formato = JSON.** O Thiago quer "algo sistêmico"; JSON é o entregável. Ele vai gerar via GPT/Gemini a partir das bases dele (ProJuris export, planilhas, workspace).
> 2. **O CONTRATO é o entregável de dev.** O que o dev entrega ao Thiago é a **especificação do JSON**: quais campos de cliente/caso, e — crucial — **os IDs/keys dos campos personalizados por tema** (`system_tema_field_defs`), para o valor cair no `canonical_fields` certo. O Thiago: *"para o sistema identificar qual é o campo personalizado, isso aqui se chama ID… você tem que me entregar esse ID com a informação da pessoa."*
> 3. **Não é fluxo recorrente.** É implantação única por tema; depois do import, o time só acrescenta pelo sistema (não há necessidade de re-importar continuamente).
> 4. **Um tema por vez.** Implanta tema → cria a pipeline/campos → importa → time usa. Espelha como foi feito Mais Médicos (J2 do lote 08-05).

---

## Contexto / o que JÁ EXISTE vs NOVO

### JÁ EXISTE (reusar — NÃO reconstruir)

- **Import de Mais Médicos (precedente real):** foi importado "em código" (transcrição). Reaproveitar o approach/scripts desse import como base; F2 generaliza para outros temas via contrato JSON. Ver J2 (`docs/stories/reuniao-2026-08-05/J2-ajuste-dados-mais-medicos.md`) e o padrão de scripts em `sistema-hv/scripts/`.
- **Aplicação de migrations/scripts via pg direto:** `sistema-hv/scripts/db-apply-pg.ts` + `reference_aplicar_migrations_pg_direto` (Supabase CLI quebrado no Windows/OneDrive; dev=prod). O import roda por script server-only análogo.
- **Definições de campo por tema:** `system_tema_field_defs` (via `sistema-hv/src/lib/tema-field-defs-service.ts`) — cada campo tem `key` (canônico, estável no JSONB) + `type` (`text/select/multiselect/money/number/date/boolean`) + `scope` (`caso`/`cliente`) + `options`. **O `key`/ID por tema é exatamente o "ID do campo personalizado" que o Thiago precisa receber** para montar o JSON. `toKey()` (mesmo arquivo) mostra como a key é derivada.
- **Valor por caso:** `system_cases.canonical_fields` (JSONB) — para campos `scope='caso'`; `system_clients.custom_fields` — para `scope='cliente'` (bifurcação B1 do lote 08-05). O import escreve nesses baldes usando as keys corretas.
- **Serviços de gravação:** `sistema-hv/src/lib/cases-service.ts`, `clients-service.ts` — o import chama/espelha essa lógica (validação de tipo, org_id) em vez de escrever cru.

### NOVO (a construir nesta story — FUTURO)

- **Especificação do contrato JSON** (documento + schema): estrutura por linha/registro com blocos `cliente {}`, `caso {}` e `campos_por_tema { <field_key>: valor }`, mais metadados (`tema_slug`, `pipeline`, `etapa` inicial). Publicar um **catálogo de field keys por tema** (dump de `system_tema_field_defs`) que o Thiago injeta no GPT/Gemini como referência.
- **Validador de contrato:** valida o JSON contra o schema + contra os `field_defs` reais do tema (key existe? tipo bate? option válida?) antes de gravar. Erros claros por linha.
- **Script de importação idempotente:** lê o JSON validado, cria/atualiza cliente+caso+valores (`canonical_fields`/`custom_fields`), idempotente por chave natural (ex.: CPF do cliente + tema + identificador de origem). Dry-run que reporta o que SERIA criado/atualizado.
- **Gerador do catálogo:** comando que exporta, por tema, as field keys + tipo + options em JSON (o "dicionário" que o Thiago recebe).

---

## Acceptance Criteria

1. **Contrato JSON documentado:** existe uma especificação clara do JSON de importação — blocos `cliente`, `caso`, `campos_por_tema` (mapa `field_key → valor`), `tema`/`pipeline`/`etapa` — publicada como doc + schema (ex.: JSON Schema) que o Thiago consegue seguir/alimentar num LLM.
2. **Catálogo de field keys por tema:** um comando/gerador exporta, por tema, as `key` + `type` + `options` de `system_tema_field_defs` (o "ID do campo personalizado" que o Thiago pediu). O Thiago recebe esse dicionário para gerar o JSON com as keys certas.
3. **Validador antes de gravar:** o script valida o JSON contra o schema **e** contra os field_defs reais do tema (key existe, tipo compatível, option pertence ao select). Registros inválidos são reportados por linha e **não** são gravados pela metade.
4. **Import idempotente + dry-run:** o script tem modo `dry_run` (default) que lista o que SERIA criado/atualizado sem escrever; rodar 2× o import real **não** duplica (idempotência por chave natural — ex.: CPF + tema + origem).
5. **Escreve nos baldes certos:** valores `scope='caso'` vão para `system_cases.canonical_fields[key]`; `scope='cliente'` vão para `system_clients.custom_fields[key]` (respeita a bifurcação B1). Cliente/caso criados com `organization_id` correto (evitar o bug legado de org_id inválido do fluxo n8n).
6. **Espelha o precedente Mais Médicos:** o resultado no sistema (nome do caso, CPF, campos) fica consistente com o que a importação de Mais Médicos produziu (J2), para não haver dois padrões.
7. **Não recorrente:** documentado que é implantação **única por tema** (depois o time só acrescenta pelo sistema) — não é um pipeline de sync contínuo.
8. **Regressão/segurança:** roda server-only (service_role), via `scripts/` (padrão pg direto); `npm run typecheck`/`lint` verdes; nenhum segredo em log; nenhuma escrita fora do org do escritório.

---

## Tasks / Subtasks

### T1 — Especificar contrato + catálogo (@data-engineer + @architect)
- [ ] Redigir a spec do JSON (blocos cliente/caso/campos_por_tema + tema/pipeline/etapa) + JSON Schema. (AC-1)
- [ ] Gerador do catálogo de field keys por tema (dump de `system_tema_field_defs`: key/type/options). (AC-2)

### T2 — Validador (@dev)
- [ ] `sistema-hv/scripts/import-tema/validate.ts`: valida JSON × schema × field_defs do tema; erros por linha. (AC-3)

### T3 — Import idempotente (@dev + @data-engineer)
- [ ] `sistema-hv/scripts/import-tema/run.ts` (dry-run default): cria/atualiza cliente+caso+valores nos baldes certos, idempotente por chave natural, reusando `cases-service`/`clients-service`. (AC-4, AC-5, AC-6)

### T4 — QA (@qa)
- [ ] Dry-run mostra o previsto sem gravar; import real 2× → sem duplicata; JSON inválido é rejeitado por linha; valores caem em canonical_fields/custom_fields corretos; `typecheck`/`lint` verdes. (AC-3..5, AC-8)

---

## Dev Notes

- **O contrato é o produto.** O trabalho central de F2 não é "importar dados X", é **entregar ao Thiago a spec + o dicionário de keys** para ele gerar o JSON no motor intermediário dele. Sem o catálogo de field keys por tema, o JSON dele "não bate" e o import quebra — foi exatamente o receio do Thiago.
- **Keys estáveis.** As keys de `system_tema_field_defs` são canônicas (`toKey()` em `tema-field-defs-service.ts`); usá-las como identificador no JSON. NÃO importar por label (label muda; key é estável).
- **Bifurcação B1.** Campo `scope='cliente'` grava no cliente e reflete nos temas vinculados; `scope='caso'` grava no caso. O import tem que respeitar o scope do def, não chutar.
- **Idempotência.** Chave natural sugerida: CPF/CNPJ do cliente + tema + um `origem_id` (id do registro na base do Thiago) para reprocessar sem duplicar.
- **org_id.** Cuidado com o bug conhecido do fluxo n8n (org_id inválido) — o import deve usar o org do escritório explicitamente.
- **Precedente.** Mais Médicos foi importado em código; reaproveitar esse script como base e generalizar. Não construir "tela de importação no sistema" — o Thiago concordou que script/entregável fora do sistema já resolve ("não precisa de uma lógica de importação dentro do sistema").
- **pg direto / dev=prod.** Aplicar via `scripts/` no padrão `db-apply-pg.ts` (`reference_aplicar_migrations_pg_direto`).

**Riscos:**
- **R1 — de-para de campo errado** (key/tipo) suja `canonical_fields`. Mitigar com validador estrito + dry-run.
- **R2 — org_id inválido** (bug n8n). Mitigar setando org explícito.
- **R3 — JSON do LLM inconsistente** entre execuções do Thiago. Mitigar publicando schema versionado + validador que rejeita cedo.

---

## Testing

- **Contrato:** validar um JSON de exemplo contra o schema; keys inexistentes/tipo errado → rejeitados por linha.
- **Import:** dry-run lista previsto; real grava nos baldes certos; 2× → idempotente.
- **Consistência:** resultado bate com o padrão Mais Médicos (nome do caso, CPF).
- **Segurança/regressão:** server-only; sem segredo em log; `typecheck`/`lint` verdes.

## Dependências

- **Depende de:** `system_tema_field_defs` estável por tema (o tema precisa ter os campos criados **antes** do import — "cria a pipeline, deixa pronta, com os campos que precisa"); `cases-service`/`clients-service`; padrão `scripts/db-apply-pg.ts`.
- **Relaciona com F1** (Trello): o import pode pré-carimbar o `trello_card_id` no caso para F1 vincular comentários sem passo manual.
- **Precedente J2** (Mais Médicos) — reusar o approach.

## File List

**A definir na implementação (FUTURO). Previsto:**
- `docs/import/contrato-json-importacao-tema.md` + `schema.json` (spec do contrato).
- `sistema-hv/scripts/import-tema/catalog.ts` (dump de field keys por tema).
- `sistema-hv/scripts/import-tema/validate.ts` (validador).
- `sistema-hv/scripts/import-tema/run.ts` (import idempotente, dry-run default).

## Change Log

| Data | Versão | Descrição | Autor |
|------|--------|-----------|-------|
| 2026-08-07 | v0.1 | Draft inicial (FUTURO). Contrato JSON de importação (cliente/caso/campos-por-tema com field keys), catálogo de keys por tema para o Thiago alimentar o motor intermediário (GPT/Gemini), validador estrito + import idempotente com dry-run. Não recorrente, um tema por vez, espelha Mais Médicos. Passa depois de segunda. | @sm (Bob) |
