# Reforma Estrutural — Modelo TEMA→CASO→TIPO, Módulos e Permissões

> **Documento-mestre de arquitetura.** Fonte de verdade para TODAS as alterações desta rodada.
> Baseado em: `observações Sistema 120726.docx` (Hyago), `Transcrição sistema hyago.txt` (reunião 15/07) e cartografia do código atual (`sistema-hv/`).
> Data: 2026-07-18 · Status: **aprovado para servir de base** (decisões de arquitetura travadas).
> **Regra de ouro deste documento:** o sistema tem perfil de forte acoplamento (mexer num lado espalha no outro). Nada aqui deve ser implementado sem respeitar a **Matriz de Impacto (§5)** e a **Sequência Segura (§7)**.

---

## 1. Objetivo

Compilar, num único mapa, **onde tudo se liga hoje** e **onde tudo vai se conectar depois**, para executar as mudanças pedidas pelo dono (Hyago) e pela reunião de alinhamento **sem quebrar a lógica existente**. As mudanças são muitas e tocam o núcleo do sistema; por isso este documento privilegia o mapeamento de dependências antes de qualquer código.

---

## 2. Decisões de arquitetura travadas (2026-07-18)

| # | Decisão | Escolha | Consequência |
|---|---------|---------|--------------|
| **D1** | O que o `service_type` atual (FIES_ESF, FIES_DGM…) vira | **Vira TEMA (remodelar)** | FIES_ESF + FIES_DGM se fundem no tema **FIES/1%**; ESF/DGM/Censo/Portaria viram o **campo TIPO** do caso. É o item mais sensível → migração faseada obrigatória. |
| **D2** | Pipeline operacional das frentes de um mesmo tema | **Uma pipeline por TEMA (unificar)** | Todas as frentes do tema compartilham as MESMAS etapas op. Exige consolidar as etapas hoje separadas por `service_type`. |
| **D3** | Permissão por módulo (ver/editar/não ver) | **Aditivo: papel + overrides por módulo** | Mantém os 9 papéis como base; adiciona overrides por usuário×módulo. Gates passam a ler "permissão efetiva". Migração incremental dos 42 pontos. |
| **D4** | Profundidade deste documento | **Fundação detalhada + resto em alto nível** | Detalha modelo Tema/Caso, pipeline, permissões, desacoplamento financeiro e bugs do Hyago. Controladoria/Inteligência ficam como design de alto nível (dependem de API ProIuris + regras do cliente). |

---

## 3. Como o sistema se liga HOJE (mapa atual)

### 3.1 Stack e camadas
- **Front/rotas:** TanStack Start (`src/routes/*.tsx`), 75+ rotas file-based.
- **RPC (server functions):** `src/rpc/*.ts` — fronteira cliente→servidor.
- **Serviços (lógica):** `src/lib/*-service.ts`.
- **Banco:** Supabase/Postgres, tabelas com prefixo `system_*`, 70+ migrations em `sistema-hv/supabase/migrations/`.
- **Externos:** Google Drive (Service Account), ZapSign, Conta Azul, Asaas, n8n.

### 3.2 Entidade central e o efeito-dominó do "tipo"
O núcleo é o **`service_type`** (`system_service_types`: `id`, `slug` imutável, `name` editável, `active`, `ordem`). Um `service_type` **é dono de**, hoje:

```
system_service_types (FIES_ESF, FIES_DGM, COVID, MAIS_MEDICOS, RESIDENCIA, CFM_CRM, OUTROS)
├── system_pipeline_stages         → 3 esteiras (op / fin / comercial), op CUSTOMIZADA por tipo
├── system_service_type_folders    → pastas Drive (kind: 'caso' | 'procuracao')
├── system_document_templates      → modelos (via case_type OU source_folder_id)
├── system_stage_checklist_defs    → checklist por (service_type_id, stage_slug)
└── case_code prefix               → derivado do name do tipo
```

**O acoplamento crítico** é o **trigger de dual-write** `trg_system_cases_sync_stages` (`system_fn_sync_stage_ids()`), disparado em INSERT/UPDATE de `system_cases`:

```
case_type (TEXT, slug)   ──►  service_type_id (UUID FK)
macrostatus_op (TEXT)    ──►  stage_op_id (UUID FK)
macrostatus_fin (TEXT)   ──►  stage_fin_id (UUID FK)   [NAO_APLICAVEL → NULL]
macrostatus_comercial    ──►  stage_comercial_id (UUID FK)
```
Fonte de verdade = colunas TEXT (slugs). Projeções UUID = para joins. **Deletar `case_type` ou `macrostatus_*` quebra o trigger** (risco CRÍTICO — ver §5).

### 3.3 As 3 esteiras (pipelines)
| Esteira | `kind` | Escopo hoje | Origem das etapas |
|---------|--------|-------------|-------------------|
| **Operacional** | `op` | **Por `service_type`** (customizada — ex.: DGM tem `DGM_ENVIADA`) | `system_pipeline_stages` filtrado por `service_type_id` + `kind='op'` |
| **Financeira** | `fin` | **Unificada** (funil sentinela global `…0000f0`/`…0003`) | Etapas compartilhadas; caso entra por bifurcação manual |
| **Comercial** | `comercial` | **Unificada** (sentinela global) | Idem |

- **Kanban** (`src/routes/pipeline.tsx`): search param `?cat={service_type_id}` escolhe a categoria; colunas = `useStages(serviceTypeId, kind)`; cards = `useCasesByServiceType(serviceTypeId)`; DnD → `moveCaseToStageOp/Fin` → `UPDATE macrostatus_*` → dispara o trigger dual-write.
- **Lista** (`src/routes/casos.lista.tsx`): tabela com busca client-side por código/cliente/tipo/status.

### 3.4 Lifecycle lead → cliente (por CASO, não por pessoa)
- **Pessoa** = `system_clients` (única). **Caso** = `system_cases` com coluna `lifecycle` ∈ {`LEAD`,`CLIENTE`,`PERDIDO`}.
- Views agregam pessoas por lifecycle: `system_clients_leads`, `system_clients_clientes`, `system_clients_perdidos`.
- Transições:
  - `procuracao_assinada_at` → esteira **comercial** (`GANHO`), **continua LEAD**.
  - `assinatura_liberada_at` (contrato) → **força `lifecycle≠LEAD`** → vira **CLIENTE** (CHECK constraint).
- CHECKs críticos: `lifecycle IN (...)`, `assinatura_liberada_at ⇒ lifecycle≠LEAD`, `perdido_at ⇒ lifecycle=PERDIDO`.

### 3.5 Drive + documentos
- Estrutura: `Cliente/Caso-{code}/`. `system_cases.drive_folder_id/url` (+ flags de erro `drive_sync_failed/error`).
- Criar caso (`cases-service.createCase`): valida cliente → gera `case_code` → resolve 1ª etapa op → nasce **comercial** (`aguardando_assinatura_at`) → cria pasta Drive (best-effort) → vincula responsáveis (N:N). **Não gera doc automático** (decisão 2026-07-08).
- Anexar doc (`api.cases.$id.documents.upload` → `uploadCaseDocument`): valida MIME + magic-bytes → `ensureCaseFolder` → `uploadFile` Drive → registra `system_case_documents`.
- Gerar doc de template (`generateCaseDocumentFromTemplate`): copia Google Doc → `replacePlaceholders` (autofill de cliente/caso) → link editável → registra (`doc_kind` procuracao/contrato).
- Modelos filtrados por **categoria**: `system_service_type_folders` (kind caso/procuracao) → `useTypeFolders` → `useTemplatesByFolders` (por `source_folder_id`), com fallback legado por `case_type`.
- Assinatura ZapSign (`sendCaseDocumentToZapsign` + `zapsign/webhook.ts`): doc assinado → `registrarProcuracaoAssinada` (segue LEAD) e/ou `promoverCasoOperacional` (vira CLIENTE).

### 3.6 Financeiro (já parcialmente desacoplado)
- **Entrada manual** (S19): `system_fn_entrar_financeiro(case_id, remover_operacional)` — resolve 1ª etapa fin real, flag reversível `removido_do_operacional_at`. Trigger automático antigo (`trg_system_cases_bifurcacao`) **dropado**.
- **Termo de acerto** (`system_termo_snapshots`, versionado): `calcularTermo` com defaults **15% honorários / R$500 parcela / 10% desconto** (`TERMO_DEFAULTS`) → workflow RASCUNHO→…→ACEITO → gera `system_parcelas` → caso `ATIVO`. Imutável pós-aprovação (trigger).
- **Honorários do caso** (`system_case_honorarios`, 1 por caso): persiste valores da revisão da procuração p/ pré-preencher o termo.
- **Cobrança/sync:** Conta Azul (cron 08:30) + Asaas (webhook tempo real); `system_parcelas.provider/provider_ext_id`.
- **Painel financeiro do cliente:** `ClientFinanceiroSection` na ficha do cliente **agrega todos os casos** — porém **renderizado SEM gate de permissão** (qualquer autenticado vê $). Idem `TermoPanel`/`AsaasCobrancasPanel` na ficha do caso e `dashboards/financeiro`. **← ponto a desacoplar.**
- **Inadimplência** (`casos.financeiro.inadimplencia`): casos com `macrostatus_fin='INADIMPLENTE'`.

### 3.7 RBAC, visibilidade e menu
- **9 papéis** (`system_users.role`, 1 por usuário, CHECK): admin, advogado_titular, advogado_associado, prestador_externo, controladoria, comercial, financeiro, operacional, marketing (`src/lib/rbac.ts`).
- **7 capabilities** (`ROLE_CAPABILITIES` + `can(role,cap)`): clientes/casos/financeiro/documentos/dossie/usuarios/config `.manage`.
- **Navegação** (`ROLE_NAV` + `canSeeRoute`) e **Sidebar** (`components/hv/Sidebar.tsx`, 5 grupos: Operação, Comercial, Inteligência, Marketing, Sistema).
- **Visibilidade de dados** (`src/lib/visibility.ts`): 3 papéis (`OWN_CASES_ONLY_ROLES`) veem só casos onde são criador / responsável / assignee de checklist. Aplicada em dossiê, responsáveis, tarefas.
- **Guardas:** `requireAuth` (checa `system_users` ACTIVE/INVITED) e `requireRole([...])`.
- **`role` é lido em 42 pontos** (16 arquivos) — este é o acoplamento a tratar de forma aditiva (D3).

---

## 4. Como tudo vai se conectar DEPOIS (modelo alvo)

### 4.1 Nova hierarquia canônica
```
TEMA            (universo próprio: 1%/FIES, Indenização, COVID, Residência, Cível/Outros, Inadimplentes)
 │  · detém a PIPELINE OPERACIONAL ÚNICA (D2)
 │  · detém campos personalizados do tema
 │  · agrupa FRENTES/TIPOS
 │
 ├── FRENTE/TIPO  (ESF, DGM, Censo, Portaria…)   ← hoje: parte via service_type, vira CAMPO+config
 │     · pastas Drive + modelos de documento próprios da frente
 │     · campos personalizados da frente (opcional)
 │
 └── CASO          (system_cases — a instância do cliente)
       · pertence a 1 TEMA e carrega o campo TIPO/FRENTE
       · roda na pipeline do TEMA
       · lifecycle LEAD/CLIENTE/PERDIDO permanece por caso
```

> **Nota sobre a palavra "caso":** na reunião ela é usada com 2 sentidos. Canonizamos assim: **CASO = `system_cases`** (instância do cliente). O que o admin "cria/vincula no Drive" ao montar o tema são **FRENTES/TIPOS** (configuração: pasta + modelos + campos). Esta distinção é obrigatória para não colidir com o código.

### 4.2 Mapeamento das entidades atuais → alvo
| Hoje | Vira | Observação |
|------|------|-----------|
| `system_service_types` (FIES_ESF, FIES_DGM) | **TEMA** (fundir ESF+DGM em "FIES/1%") | D1. `slug` do tema preservado como chave; `name` editável. |
| Distinção ESF vs DGM | **Campo TIPO/FRENTE do caso** | Novo campo em `system_cases` (ex.: `frente_slug`) + tabela de frentes por tema. |
| `system_pipeline_stages` (op por service_type) | **op por TEMA (unificada)** | D2. Consolidar/migrar etapas divergentes (ex.: `DGM_ENVIADA` vira etapa do tema OU condicional por frente). |
| `system_service_type_folders` | **pastas por (TEMA, FRENTE)** | Modelos passam a ser filtrados por frente dentro do tema. |
| `system_stage_checklist_defs` (por service_type_id, stage_slug) | **por (TEMA, stage_slug)** + opcional frente | Reancorar defs ao tema. |
| `case_code` prefix (por tipo) | **prefixo por TEMA** | `caseCodePrefix()` passa a derivar do nome do tema. |

### 4.3 Módulos (desacoplar) — alvo
`Comercial` · `Operacional` · **`Financeiro`** (módulo, com pipeline unificada + painel do cliente + relatórios) · **`Controladoria`** (novo, integra ProIuris) · **`Inteligência`** (novo: dashboards + IA). Menu reorganizado por esses módulos; visibilidade por permissão efetiva (§4.4).

### 4.4 Permissões (D3, aditivo)
- Nova tabela `system_user_module_perms (user_id, module, access ∈ {none,view,edit})`.
- `permissaoEfetiva(user, module, action)` = override do usuário **se existir**, senão deriva do papel (mapa atual). Todos os gates (`can`, `canSeeRoute`, `requireRole`, Sidebar, visibility) migram **incrementalmente** para consultar essa função.
- Regra transversal: **dados de valor ($) exigem `financeiro:view`** no mínimo (Operacional/Jurídico não veem $).

---

## 5. Matriz de Impacto (efeito-dominó) — o coração

> Ordem de leitura obrigatória antes de tocar em qualquer item. Risco: **CRÍTICO** = pode quebrar casos existentes / gravação.

### 5.1 Núcleo TEMA/CASO/TIPO
| Alteração | Espalha em | Risco | Mitigação |
|-----------|-----------|-------|-----------|
| `service_type` → TEMA (fundir ESF+DGM) | trigger `sync_stage_ids`, `case_type` CHECK, `system_cases.case_type`, todas as queries por `service_type_id`, `case_code` prefix, dashboards que agrupam por `case_type` | **CRÍTICO** | Manter `case_type`/`macrostatus_*` como dual-write (não deletar). Introduzir TEMA como camada; migrar dados em migration idempotente com backfill; só depois soft-deletar service_types órfãos. |
| Unificar pipeline op por tema | `system_pipeline_stages` (op), `stage_op_id`, gates `system_fn_avancar_se_checklist_ok`, checklist defs ancoradas em `stage_slug`, Kanban `useStages` | **CRÍTICO** | Mapear cada etapa divergente (ex.: `DGM_ENVIADA`) → decidir se vira etapa comum do tema ou condicional por frente. Backfill de `macrostatus_op` legados. Reviver etapas via ON CONFLICT. |
| Novo campo TIPO/FRENTE no caso | `CaseFormDialog`, criação de caso, filtro de modelos, campos personalizados, lista/Kanban | ALTO | Campo aditivo `frente_slug` nullable; default a partir do case_type legado no backfill. |
| `case_code` prefixo por tema | `caseCodePrefix()`, códigos existentes | MÉDIO | Só afeta casos novos; não reescrever códigos antigos (ou script único opt-in). |

### 5.2 Documentos / Drive
| Alteração | Espalha em | Risco | Mitigação |
|-----------|-----------|-------|-----------|
| Pastas por (tema,frente) | `service_type_folders`, `useTypeFolders`, `useTemplatesByFolders`, `GenerateCaseDocumentFlow`, `CaseSignActions`, sync de modelos | ALTO | Reaproveitar `system_service_type_folders` apontando p/ tema; adicionar `frente_slug` na vinculação. Manter fallback por `case_type`. |
| Preenchimento de variáveis (bug Hyago) | `document-autofill.ts`, templates Drive | MÉDIO | Ver §8 (root cause: modelos sem placeholders `<...>`). |

### 5.3 Financeiro (desacoplar $)
| Alteração | Espalha em | Risco | Mitigação |
|-----------|-----------|-------|-----------|
| Gate de permissão em telas de $ | `ClientFinanceiroSection`, `clientes.$id`, `TermoPanel`, `AsaasCobrancasPanel`, `casos.$id`, `dashboards/financeiro`, `rpc/financeiro`, `rpc/asaas`, `rpc/contaazul` | MÉDIO | Envolver render com `permissaoEfetiva(...,'financeiro','view')` + reforçar gate nos RPCs (hoje só `requireAuth`). |
| Termo com 15%/R$500 editáveis (bug Hyago) | `termo-service.calcularTermo`, `TERMO_DEFAULTS`, `system_case_honorarios` | MÉDIO | Já há `system_case_honorarios`; expor edição no fluxo + puxar do contrato/caso. |

### 5.4 RBAC / módulos
| Alteração | Espalha em | Risco | Mitigação |
|-----------|-----------|-------|-----------|
| Permissão efetiva por módulo | 42 pontos de `role` (rbac.ts, visibility.ts, Sidebar, guards, CaseFormDialog…) | ALTO | D3 aditivo: `permissaoEfetiva()` cai de volta no papel se não houver override. Migrar ponto a ponto; testes de regressão por papel. |
| Novos módulos Controladoria/Inteligência | `ROLE_NAV`, Sidebar groups, rotas | BAIXO | Rotas já existem (`controladoria.*`, `inteligencia.*`); só reorganizar grupos + permissões. |

### 5.5 Views e constraints que quebram fácil (não esquecer)
- Views enumeram colunas (não `c.*`): `system_cases_active`, `system_clients_leads/_clientes/_perdidos` → **recriar DROP+CREATE** ao mudar colunas.
- CHECKs a **não** remover: lifecycle domain, `assinatura⇒≠LEAD`, `perdido⇒PERDIDO`.
- FKs `ON DELETE RESTRICT` em termo/parcelas → corretas, manter.

---

## 6. Blocos de trabalho

### Fundação (detalhada — construir primeiro)
- **B1 — Modelo Pessoa/Lead/Cliente por caso (E1).** Corrige bug B3 (lead+cliente juntos). Ficha ramificada por tema. Aba "casos" separa leads (aguardando assinatura). *Grande parte já existe no lifecycle atual — validar e ajustar UI.*
- **B2 — Camada TEMA + FRENTE/TIPO (E2, D1/D2).** Nova modelagem, migração faseada, pipeline op unificada por tema, criação manual de tema→frente(Drive+modelos)→caso. **Bloco mais sensível.**
- **B3 — Permissões por módulo (E4, D3).** `permissaoEfetiva`, tabela de overrides, migração incremental dos 42 pontos, tela de gestão (ver/editar/não ver por usuário×módulo).
- **B4 — Desacoplar Financeiro (E5).** Gates de $ nas fichas; painel financeiro do cliente só admin/financeiro; espelhamento de todos os casos; mover "gerar fatura/Conta Azul" p/ painel do cliente.
- **B5 — Bugs e ajustes do Hyago.** B1 (busca/lupa), B2 (RG 1 dígito a menos), B4 (anexar doc), B5 (mover etapa), A1 (base grad/residência), A2 (campos FIES estruturados), A3 (15%/R$500 editáveis), D1–D4 (variáveis dos documentos).

### Alto nível (design; dependem de pendências do cliente)
- **B6 — Módulo Controladoria + distribuição de tarefas (E6).** Integração ProIuris (API + cron), dedup de intimações, confirmar/arquivar, gerar tarefa, distribuição sequencial + fura-fila (Urgente/Complexo/Específico), obrigar observação na conclusão, painel de atrasos. **Bloqueado por:** API ProIuris + regras de distribuição por escrito + mockup.
- **B7 — Módulo Inteligência.** Dashboards com RBAC (admin vê totais; áreas veem o seu) + IA (futuro).
- **B8 — Relatório/Tema "Inadimplentes" (E8).** Relatório no Financeiro (>90 dias) + tema de atuação próprio. **Bloqueado por:** API ProIuris/Conta Azul.

---

## 7. Sequência segura de implementação (ordem que não quebra)

1. **B3-parte1 (permissão efetiva aditiva)** — infra `permissaoEfetiva()` caindo no papel. Zero mudança de comportamento (base para o resto). 
2. **B4 (desacoplar $)** — aplica gates usando B3. Isola dados sensíveis cedo.
3. **B1 (lead/cliente)** — ajustes de UI sobre o lifecycle existente. Baixo risco.
4. **B5 (bugs pontuais)** — quick wins independentes (busca, RG, anexar, mover, campos FIES, termo editável, variáveis).
5. **B2 (TEMA/CASO/TIPO)** — só depois da fundação estável. Fases internas:
   - 5a. Criar entidades TEMA/FRENTE **aditivas** (sem tocar service_types).
   - 5b. Backfill: mapear service_types → temas; `frente_slug` a partir do case_type.
   - 5c. Unificar pipeline op por tema (migrar etapas + `macrostatus_op`).
   - 5d. Migrar pastas/modelos/checklist para (tema,frente).
   - 5e. Reapontar Kanban/lista/criação/case_code. Só então soft-delete dos service_types órfãos.
6. **B6/B7/B8** — quando as pendências do cliente chegarem.

> Cada fase = migration idempotente + dual-write preservado + testes (`typecheck`, `lint`, testes) antes de avançar. Nunca deletar `case_type`/`macrostatus_*`.

---

## 8. Bugs e ajustes do Hyago — mapeados

| Item | Onde no código | Bloco |
|------|----------------|-------|
| B1 busca/lupa não funciona | investigar `system_search_clients()` + input | B5 |
| B2 RG 1 dígito a menos | `20260622000001_clients_rg.sql` + máscara no form | B5 |
| B3 lead+cliente juntos | lifecycle por caso (§3.4) | B1 |
| B4 erro ao anexar doc | `uploadCaseDocument` / rota upload | B5 |
| B5 erro ao mover etapa | `moveCaseToStageOp` + trigger | B5 |
| A1 base grad/residência | `professional_data` JSONB | B5 |
| A2 campos FIES estruturados | `client_custom_fields` / `case_canonical_fields` | B5 (alimenta B2) |
| A3 15%/R$500 editáveis | `TERMO_DEFAULTS` + `system_case_honorarios` | B4/B5 |
| D1–D4 variáveis de documentos | `document-autofill.ts` + modelos Drive (root cause: modelos sem `<...>`) | B5 |

---

## 9. Pendências do cliente (bloqueiam blocos)

1. **Lista definitiva de TEMAS** + frentes/tipos de cada + campos personalizados por frente → destrava B2 (backfill/mapeamento).
2. **Hierarquia TEMA/CASO/TIPO** confirmada (o Dr. Thiago prometeu um MD/desenho) → confirma §4.1.
3. **Regras de distribuição** de tarefas por escrito + **mockup** da Controladoria → destrava B6.
4. **API ProIuris** (credenciais/endpoints) + **Conta Azul** p/ inadimplência → B6/B8.
5. Confirmar **base de dados** de graduação/residência (A1).

---

## 10. Riscos-chave (resumo executivo)

- **R1 — Fusão de service_types (B2):** maior risco do projeto. Só executar após fundação estável e com migração faseada + backfill idempotente. Preservar dual-write.
- **R2 — Unificação de pipeline op:** etapas divergentes (ex.: `DGM_ENVIADA`) precisam de decisão explícita (etapa comum vs condicional por frente) antes de migrar `macrostatus_op`.
- **R3 — 42 pontos de `role`:** migração aditiva evita apagão, mas exige teste de regressão por papel.
- **R4 — Telas de $ sem gate hoje:** desacoplar cedo (B4) para não vazar valores a não-admin.
- **R5 — Views/CHECKs frágeis:** recriar views ao mudar colunas; nunca remover CHECKs de lifecycle.

---

*Fim do documento-mestre. Próximo passo sugerido: transformar os blocos B1–B5 em stories/sprints executáveis, começando pela Sequência Segura §7.*
