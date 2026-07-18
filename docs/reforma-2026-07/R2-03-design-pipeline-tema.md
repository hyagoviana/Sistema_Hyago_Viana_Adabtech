# R2-03 — Design da pipeline operacional no modelo de TEMAS manuais

> **Documento de DESIGN (Winston, Arquiteto).** NÃO é implementação — é a decisão de arquitetura que trava R2-03 e destrava R2-04/R2-05.
> Contexto: doc-mestre `docs/reforma-tema-caso-modulos-2026-07-18.md` (§3.2, §4.2, §5.1); story `docs/stories/reforma-2026-07/R2-03-pipeline-op-unica-por-tema.md`.
> Base de código: R2-01 aplicada (`sistema-hv/supabase/migrations/20260719000001_tema_frente_modelagem.sql`), R2-06 feita (`sistema-hv/src/lib/tema-service.ts`, com `// TODO(R2-03)` em `createTema`).
> Data: 2026-07-18 · Status: **proposta para travar**.

---

## 0. DECISÃO DE NEGÓCIO PARA O DONO (levar antes de implementar)

Tecnicamente o design abaixo roda **hoje, sem depender de nada do cliente**. Mas há **uma** pergunta de negócio, e ela é pequena:

> **Quando o admin cria um TEMA novo do zero, quais são as ETAPAS operacionais iniciais desse tema?**
> Proponho semear um conjunto genérico padrão (`ONBOARDING → TRIAGEM → DOCS_PENDENTES → PRONTO_PROTOCOLO → ACOMPANHAMENTO_ADM → JUDICIAL_OPERACIONAL → IMPLANTADO → ENCERRADO_OPERACIONAL → CANCELADO`, o mesmo dos temas atuais), 100% **editável** depois pelo dono no editor de etapas que já existe. O dono não precisa decidir isso antes — o padrão serve e ele ajusta por tema quando quiser.

Tudo o mais (fusão de FIES_ESF+FIES_DGM, lista definitiva de temas/frentes) é **R2-02** e continua bloqueado pela lista do cliente. **R2-03 (temas manuais) não espera essa lista.**

---

## 1. Modelo de conexão TEMA ↔ motor — RECOMENDAÇÃO: Opção (1), "service_type interno espelho 1:1"

### 1.1 O descompasso, em uma frase
O motor inteiro (trigger `system_fn_sync_stage_ids`, checklist defs, `useStages`, `caseCodePrefix`, auto-avanço) resolve tudo por **`service_type_id`**. Um TEMA (`system_temas`) não é um `service_type` — logo um tema criado do zero não tem etapas, nem projeção, nem checklist. Precisamos ligar os dois **sem tocar no trigger**.

### 1.2 As três opções avaliadas

| Opção | O que faz | Toca o trigger / dual-write? | Blast radius |
|-------|-----------|------------------------------|--------------|
| **(1) service_type interno espelho 1:1** *(RECOMENDADA)* | Ao criar um TEMA, cria-se também **um** `system_service_types` interno vinculado (`service_type.tema_id = tema.id`), já com as etapas op/fin/comercial semeadas (reusa `createServiceType`). O tema é a "cara"; o service_type é o motor. Casos rodam por `service_type_id` **exatamente como hoje**. Frentes = `frente_slug` do caso. | **NÃO.** Zero alteração em `system_fn_sync_stage_ids`. | **Mínimo.** Reusa 100% do motor. |
| **(2) Reancorar o motor em `tema_id`** | Muda o trigger e todas as queries para resolver `stage_op_id` por `(tema_id, slug)`; etapas passam a ter `tema_id`. | **SIM** — reescreve o coração do dual-write. | **Máximo.** Toca as 2 funções de auto-avanço, `moveCaseToStageOp/Fin`, `softDeleteStage`, `useStages`, checklist, criação, `system_cases_active` (se colunas mudarem). |
| **(3) Híbrido: 1 tema = N service_types (uma por frente)** | Cada frente vira um service_type interno; o tema agrega N service_types. | NÃO (trigger intocado), mas... | **Alto** de gestão: cria explosão de service_types e reintroduz o problema que D2 quer eliminar (pipeline por frente, não por tema). Volta ao que já existe (FIES_ESF vs FIES_DGM). |

### 1.3 Por que a Opção (1) vence

1. **Reusa mais, toca menos.** O trigger `system_fn_sync_stage_ids` (`20260608000003_s13_espinha.sql:124-151`) resolve `stage_op_id` por `(service_type_id, kind, slug)`. Na Opção (1) esse caminho continua **idêntico**: o caso tem `service_type_id` (do service_type interno do tema) e o trigger acha a etapa. **Nenhuma linha do trigger muda.**
2. **`createServiceType` já semeia o conjunto completo** de etapas op+fin+comercial (`pipeline-service.ts:52-111`), com os slugs de fin/comercial espelhando o funil sentinela — exatamente o requisito para o tema "nascer não-quebrado" no funil único. R2-06 já deixou o gancho: `createTema` tem `// TODO(R2-03): semear a pipeline op inicial` (`tema-service.ts:85-87`) referenciando esse mesmo seeding.
3. **É a Opção A da story, formalizada.** A story R2-03 já propõe "manter `system_pipeline_stages` por service_type, unificação lógica por tema, trigger intocado" (linhas 33, 81). A Opção (1) é essa decisão levada à sua conclusão limpa: **cada tema tem exatamente 1 service_type interno** — então "todos os service_types do tema têm os mesmos slugs" é trivialmente verdadeiro (há só um), e a "unificação" nem precisa de upsert de reconciliação entre múltiplos service_types. O upsert multi-service_type da story só é necessário no **caso legado de fusão FIES_ESF+FIES_DGM (R2-02)**, não no caminho de tema manual.
4. **Frentes ficam onde já estão:** `system_cases.frente_slug` (criado em R2-01, `20260719000001:140`). A frente é um atributo do caso, não uma pipeline — coerente com D2 ("uma pipeline por tema, frentes compartilham as etapas").

> **Modelo canônico da Opção (1):**
> `system_temas (1) ──1:1── (1) system_service_types [interno]` · o service_type interno é o **motor**; o tema é a **identidade/UX**.
> `system_cases.tema_id` = tema · `system_cases.service_type_id` = service_type interno do tema · `system_cases.frente_slug` = frente escolhida.
> **Regra:** casos rodam por `service_type_id` (como hoje). `tema_id` é a chave de agrupamento na UI/relatórios.

### 1.4 Impacto por consumidor (Opção 1)

| Consumidor | Arquivo:linha | Impacto na Opção (1) |
|------------|---------------|----------------------|
| **`createTema` (seeding)** | `tema-service.ts:85-87` (TODO) | **Muda.** Após inserir o tema, cria o service_type interno (reusar `createServiceType({name, slug, ordem})` de `pipeline-service.ts:38-112`) e vincula `service_type.tema_id = tema.id`. O seeding de etapas vem de graça (o `createServiceType` já faz). |
| **Trigger dual-write** | `s13_espinha.sql:124-151` | **Zero.** Intocado. |
| **Criação de caso (R2-05)** | `cases-service.ts:74-117` | **Baixo.** Hoje resolve etapa/código por `case_type`→service_type. Passa a: gravar `tema_id`+`frente_slug`; resolver o `service_type_id` = service_type interno do tema; 1ª etapa op via esse service_type (query `:104-112` inalterada, só muda de onde vem o `service_type.id`). |
| **`caseCodePrefix`/`nextCaseCode`** | `cases-service.ts:39-69` | **Baixo (R2-05).** `caseCodePrefix()` já deriva do **nome** (`:39-46`); só muda a fonte do nome: buscar `system_temas.name` por `tema_id` em vez de `system_service_types.name` por slug (`:53-59`). |
| **Pastas/modelos (R2-04)** | `system_service_type_folders` + `pipeline-service.ts:169-197` | **Médio.** R2-04 adiciona `frente_slug` ao vínculo de pasta; como cada tema tem 1 service_type interno, as pastas ficam nesse service_type + `frente_slug`. Fallback por `case_type` mantido. |
| **Checklist defs** | `system_stage_checklist_defs (service_type_id, stage_slug)` (`20260703000001`) | **Zero estrutural.** Continuam ancoradas no service_type interno + slug. Nada a reancorar em tema manual (não há rename de slug: os slugs nascem do seeding). |
| **Kanban / `useStages`** | `pipeline.tsx`, `pipeline-service.ts:228-238` | **Médio (R2-05).** Board por tema = board do service_type interno do tema. `useStages(serviceTypeId, kind)` recebe o service_type interno. Filtro por frente = filtro de `frente_slug` na etapa (§2) + no card. |
| **`moveCaseToStageOp/Fin`** | `pipeline-service.ts:490-544` | **Zero.** Já validam etapa×service_type do caso (`loadStageForServiceType:469-486`). Funcionam sem alteração. |
| **Auto-avanço** | `20260703000003:59-79`, `20260704000001:71-93` | **Ver §2 (C2).** Só relevante se houver etapa condicional por frente. |

**Custo total da Opção (1) para tema manual:** essencialmente **1 função** (`createTema` chama `createServiceType` e vincula) + os reaproveitamentos naturais de R2-04/R2-05. O motor não é tocado.

---

## 2. Etapa comum vs condicional por frente (`DGM_ENVIADA`) + solução do C2

### 2.1 O problema C2 (recapitulado do código real)
As duas funções de auto-avanço escolhem a **próxima etapa** por `service_type_id` + `ordem`, **sem filtrar frente**:
- `system_fn_avancar_se_checklist_ok` — `20260703000003_fn_avancar_checklist.sql:72-79` (`ordem > v_current_ordem ORDER BY ordem LIMIT 1`).
- `system_fn_avancar_fin_se_ok` — `20260704000001_fn_avancar_fin.sql:85-93` (idem). *(Obs.: o nome real é `system_fn_avancar_fin_se_ok`, não `system_fn_avancar_fin` como consta na story — corrigir a referência ao aplicar C2.)*

Se `DGM_ENVIADA` estiver no conjunto de etapas do service_type como etapa "no meio da fila", um caso de **outra frente** (ex.: ESF) com checklist completo **para em `DGM_ENVIADA`** ao auto-avançar, porque a query pega a menor `ordem` seguinte sem olhar `frente_slug`.

### 2.2 RECOMENDAÇÃO: **Opção (b) — condicionais viram etapas comuns do tema** (para o caminho de TEMA MANUAL)

Para **temas criados manualmente**, recomendo **eliminar o conceito de etapa condicional por frente na origem**: o conjunto op semeado é **comum a todas as frentes do tema**. Consequências:

- **`system_fn_avancar_se_checklist_ok` e `system_fn_avancar_fin_se_ok` NÃO são tocadas.** O gap C2 **não existe** porque nenhuma etapa tem `frente_slug` setado — a "menor ordem seguinte" é sempre válida para qualquer frente. Menor risco possível: zero mudança nas funções críticas de gravação.
- A coluna **`system_pipeline_stages.frente_slug` ainda deve ser criada** (é aditiva, nullable, custo ~zero), mas usada **só como filtro de EXIBIÇÃO** no Kanban (R2-05), **nunca** consultada pelo auto-avanço. Assim, se o dono um dia quiser esconder uma coluna de certas frentes, o mecanismo existe sem reabrir C2.

### 2.3 E o legado FIES/1% (`DGM_ENVIADA` real)?
`DGM_ENVIADA` só existe hoje em **FIES_DGM** (`20260609000001_pipelines_por_tipo.sql:37`), não em FIES_ESF. Isso é problema **da fusão (R2-02/R2-03-legado)**, não do tema manual. Recomendação para quando a fusão acontecer:

- Ao fundir FIES_ESF+FIES_DGM no tema FIES/1%, **`DGM_ENVIADA` vira etapa comum do tema** (aparece para todas as frentes). Trade-off aceito: uma coluna a mais no board unificado — inócua para ESF (fica vazia), sem risco de auto-avanço travar. Se incomodar visualmente, esconder via `frente_slug='DGM'` **só na UI**.
- **Se, e somente se,** o dono exigir que `DGM_ENVIADA` seja invisível E que o auto-avanço a pule para ESF, aí sim aplica-se a **Opção (a)**: patch das duas funções com `AND (frente_slug IS NULL OR frente_slug = <frente do caso>)` (o caso traz `frente_slug` — R2-01/R2-02). Fica registrado como **plano B**, não como default.

> **Decisão travada:** tema manual = **etapas comuns (Opção b)**, funções de auto-avanço intocadas, `frente_slug` na etapa só para exibição. Etapa condicional real (`DGM_ENVIADA`) tratada na fusão como comum; patch das funções (Opção a) fica como contingência documentada.

---

## 3. R2-03 roda SEM a lista do cliente e SEM o backfill dos legados? **SIM.**

Na Opção (1), o seeding de tema manual é **auto-contido**:

- `createTema` cria tema + service_type interno + etapas semeadas. Nada disso lê `case_type` legado, `FIES_ESF`, nem a tabela de mapa de R2-02.
- Um tema novo nasce **completo e funcional**: tem pipeline op/fin/comercial, resolve `stage_op_id` pelo trigger, aceita casos, gera checklist. **Independente dos service_types legados.**
- A **fusão** FIES_ESF+FIES_DGM (D1) e o backfill de `frente_slug` dos casos existentes continuam em **R2-02**, que **permanece bloqueado** pela lista definitiva do cliente (doc-mestre §9 item 1). Mas **R2-03 (tema manual) não depende de R2-02.**

> **O que fica bloqueado:** apenas o *backfill/fusão dos legados* (R2-02). O *seeding de tema manual* (R2-03) está livre.

---

## 4. Coexistência legados × temas novos — SEM conflito

| Aspecto | Comportamento | Risco |
|---------|---------------|-------|
| Casos antigos | Continuam rodando no seu `service_type_id` legado (FIES_ESF, COVID…). `tema_id` NULL até R2-02 rodar. Trigger, Kanban por `cat=service_type_id`, checklist — tudo intacto. | Nenhum. |
| Casos novos em tema novo | Rodam no service_type **interno** do tema. Mesmo motor, mesmas queries. | Nenhum. |
| Kanban | Hoje `?cat={service_type_id}`. Temas novos aparecem como mais uma "categoria" (o service_type interno). R2-05 troca para `?tema=` mantendo `cat` como alias. | Baixo (R2-05). |
| `caseCodePrefix` | Legado deriva do nome do service_type; tema novo deriva do nome do tema (= nome do service_type interno, então bate). | Nenhum. |
| Slugs | Slug do tema e slug do service_type interno podem ser **iguais** (derivados do mesmo nome). `toSlug` (tema-service.ts:32-41) e o slug do service_type usam a mesma convenção MAIÚSCULA. **Atenção:** garantir que o slug do service_type interno não colida com um slug legado existente (ex.: criar tema "COVID" quando já existe service_type COVID). Ver §6 (Risco R-3). | Médio — mitigável. |
| Funil sentinela (fin/comercial) | O seeding de `createServiceType` já espelha os slugs do sentinela (`pipeline-service.ts:54-104`), então o tema novo funciona no board fin/comercial global. | Nenhum. |

---

## 5. Sequência recomendada das próximas fases

Dado o design da Opção (1), a ordem que **maximiza o que dá para entregar já** (sem a lista do cliente):

```
JÁ (não espera a lista):
  R2-03  ► seeding de tema manual (createTema cria service_type interno + etapas).
           Migration só ADITIVA: system_pipeline_stages.frente_slug NULL (exibição).
           Funções de auto-avanço INTOCADAS (Opção b).
  R2-04  ► pastas/modelos/checklist por (service_type interno, frente_slug).
           Reusa system_service_type_folders + coluna frente_slug aditiva.
  R2-05  ► CaseFormDialog escolhe tema→frente; createCase grava tema_id/frente_slug
           e resolve service_type interno; Kanban/lista por tema; case_code por tema.
           (parte "soft-delete de service_types órfãos" NÃO roda ainda — depende de R2-02)

ESPERA A LISTA DO CLIENTE (doc-mestre §9 item 1):
  R2-02  ► backfill/fusão dos legados: FIES_ESF+FIES_DGM → tema FIES/1%,
           frente_slug dos casos existentes, tema_id nos service_types legados.
           Só aqui entra a decisão DGM_ENVIADA (comum vs patch das funções, §2.3).
  R2-05 (cauda) ► soft-delete de service_types legados órfãos, DEPOIS da fusão.
```

**Justificativa da inversão R2-03/04/05 antes de R2-02:** na Opção (1), temas manuais são um universo paralelo autossuficiente. O cliente pode **começar a operar temas novos hoje** (criar tema → frente → caso → Kanban → docs), enquanto a migração dos dados legados (o risco crítico R1 do doc-mestre) espera a lista com calma. Isso desacopla o risco alto (fusão) da entrega de valor (temas manuais).

> **Nota de ordenação vs stories atuais:** as stories numeram R2-02 antes de R2-03 (fase 5b antes de 5c). Este design mantém os *números*, mas recomenda **executar** R2-03/04/05 (trilha "tema manual") independentemente e **antes** de R2-02 (trilha "fusão legado"), já que a Opção (1) remove a dependência de dados. Ajustar o campo "Depende de: R2-02" na R2-03 para "R2-02 apenas para casos legados; tema manual não depende".

---

## 6. Riscos e mitigações

| # | Risco | Sev. | Mitigação |
|---|-------|------|-----------|
| **R-1** | `createTema` cria tema mas falha ao criar service_type interno → tema órfão sem pipeline (não aceita casos). | Alto | Transação: criar tema + service_type interno + etapas de forma atômica (ou compensar: se o seeding falhar, soft-delete o tema). `createServiceType` já insere as etapas num passo (`pipeline-service.ts:105-109`). Adicionar guarda: se seeding falha, reverter o tema. |
| **R-2** | Explosão de service_types "internos" polui a tela de categorias/Configurações (que lista `system_service_types`). | Médio | Marcar o service_type interno (ex.: flag `tema_id NOT NULL` já serve de discriminador) e **filtrar** da UI legada de categorias — a gestão passa a ser pela tela de Temas (R2-06). O `?cat=` legado continua funcionando por id. |
| **R-3** | Colisão de slug: criar tema "COVID" quando já existe service_type COVID legado → UNIQUE(org, slug) em `system_service_types` estoura 500. | Médio | Em `createTema`, ao derivar o slug do service_type interno, checar colisão e sufixar (ex.: `COVID_T`) OU bloquear com 409 legível. O slug do **tema** (tabela `system_temas`) é independente e já tem sua própria UNIQUE (R2-01:48). |
| **R-4** | Alguém aplica Opção (a) (patch das funções) por engano no caminho manual → funções passam a depender de `frente_slug` populado, quebrando casos com `frente_slug` NULL. | Médio | **Não** tocar as funções em R2-03 (Opção b). Se um dia aplicar (a) na fusão, garantir `frente_slug` NOT NULL nos casos do tema (R2-02) antes, e usar `(frente_slug IS NULL OR ...)` para tolerar NULL. |
| **R-5** | `frente_slug` na etapa criado mas consumido pelo auto-avanço por descuido → reabre C2. | Baixo | Comentar na migration que `system_pipeline_stages.frente_slug` é **exibição-only**; teste de regressão: caso sem `frente_slug` na etapa auto-avança normalmente. |
| **R-6** | R2-04 assume 1 service_type por tema; se no futuro virar N (Opção 3), a lógica de pastas quebra. | Baixo | Documentar a invariante **1 tema = 1 service_type interno** como contrato. Frentes = `frente_slug`, nunca service_types adicionais. |
| **R-7** | `system_cases_active` recriada à toa. | Baixo | R2-03 **não** adiciona coluna em `system_cases` (a `frente_slug`/`tema_id` já vieram em R2-01). Só `system_pipeline_stages` ganha `frente_slug` → **não** recria a view. Confirmar no AC-6 da story. |

---

## 7. Resumo executivo (o que travar)

1. **Modelo:** Opção (1) — **1 tema ⇔ 1 service_type interno espelho**. Tema = UX; service_type = motor. Trigger e dual-write **intocados**. `createTema` passa a semear o service_type interno (reusa `createServiceType`).
2. **Etapa condicional:** Opção (b) para tema manual — **etapas comuns**, funções de auto-avanço **não tocadas**, C2 **eliminado na raiz**. `system_pipeline_stages.frente_slug` criado mas **só para exibição**. `DGM_ENVIADA` real vira etapa comum na fusão (R2-02); patch das funções (Opção a) é contingência.
3. **Independência:** tema manual roda **sem a lista do cliente e sem R2-02**. Só a fusão dos legados espera a lista.
4. **Coexistência:** legados e temas novos coexistem sem conflito (mesmo motor). Único cuidado: colisão de slug (R-3).
5. **Sequência:** R2-03 → R2-04 → R2-05 (trilha tema manual, **já**) · R2-02 + soft-delete (trilha fusão, **quando a lista chegar**).
6. **Para o dono:** só uma pergunta pequena — o conjunto de etapas padrão de um tema novo (proponho o genérico, editável). Nada mais bloqueia.

*Fim do design R2-03. Não implementar migration/código a partir deste doc — ele trava as decisões; a implementação segue nas stories R2-03 (seeding), R2-04 (pastas) e R2-05 (UI/criação).*
