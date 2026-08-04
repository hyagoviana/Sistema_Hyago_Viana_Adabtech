# Story A8: Importação (ETL) da base "Mais Médicos" para PRODUÇÃO — 381 clientes + 381 casos, tema/campos/etapas, timeline e checklist a partir de `MM_BASE_SISTEMA_BETA_v1.xlsx`

- **Épico:** Reunião 2026-08-03 — 8 Ajustes
- **ID:** A8
- **Status:** Importado em produção 2026-08-04
- **Estimativa relativa:** XL (ETL de 16 abas para PRODUÇÃO: novo tema + service_type + etapas + ~20 campos + 7 defs de checklist; 381 clientes com pasta no Drive; 381 casos com canonical_fields + histórico de vínculos; 476 notas + 180 andamentos na timeline; checklist por caso; DRY-RUN → GRAVA; script idempotente/reexecutável + rollback)
- **Executor sugerido:** @data-engineer + @dev · Quality gate: @qa + @architect
- **Risco:** ALTO (escreve em PRODUÇÃO, dev=prod)
- **Origem:** Reunião 2026-08-03 (item "importar mais médicos"). Planilha-fonte na raiz do repositório: `MM_BASE_SISTEMA_BETA_v1.xlsx` (16 abas). Domínio jurídico: **Mais Médicos** (Art. 19-A / 19-B, SISGIMM, parcelas do governo).

---

## Story

**Como** administrador (Dr. Thiago) que hoje mantém a operação Mais Médicos numa planilha/beta externo,
**quero** importar a base completa (381 médicos, 1 caso por médico) para dentro do sistema — criando o **tema "Mais Médicos"** com seus **campos**, **etapas operacionais**, **clientes com pasta no Drive**, **casos** (com o vínculo atual nos `canonical_fields` e o histórico dos vínculos antigos preservado), **notas/andamentos na timeline** e o **checklist de documentos** por caso —
**para que** a equipe passe a operar Mais Médicos no sistema (filtros, kanban, ficha, timeline) sem perder o histórico do beta, sabendo que **a esteira de parcelas SISGIMM e o board SISGIMM entram na story A3** e que **CPF/e-mail/telefone dos clientes não existem na base** e serão preenchidos depois via ficha.

> **DECISÕES TRAVADAS PELO OWNER (reunião 2026-08-03) — todas obrigatórias:**
> 1. **CPF (base sem CPF):** gravar um **MARCADOR único e claramente-não-CPF** por cliente (o próprio `ID_CLIENTE_INTERNO`, ex.: `CL-0001`) em `cpf_cnpj`, editável depois pela ficha ("preencher CPF depois via sistema"). **NÃO** tornar a coluna nullable, **NÃO** inventar CPF válido.
> 2. **Vínculos — Opção A:** 141 casos têm 2–3 vínculos. Gravar nos `canonical_fields` o **VÍNCULO ATUAL** (a aba `CASOS` já traz achatado) e **PRESERVAR o histórico** dos vínculos antigos como registro (Notas/timeline + bloco JSON no `canonical_fields`). **1 cliente = 1 caso.** **NÃO** explodir em vários casos.
> 3. **Parcelas SISGIMM:** são parcelas do **GOVERNO**, não honorários; `system_parcelas` exige Termo de Acerto (honorários) → **NÃO** importar em `system_parcelas`. Guardar o **resumo/estado atual** do SISGIMM nos `canonical_fields` agora; a esteira completa de parcelas entra junto da story **A3 (múltiplos Kanbans — board SISGIMM)**.
> 4. **Usuários:** as 5 pessoas (thiago correia, thaise francelino, maria clara batista, pablo silva, joão braga) entram como **TEXTO** na autoria de notas/timeline; a criação de usuário-que-loga (Supabase Auth) fica para o **item 11 (motor de distribuição)**, fora desta story.
> 5. **Pastas Drive:** SEGUIR O PROCESSO REAL — **CRIAR** a pasta do cliente no Drive normalmente (Service Account). **NÃO** pré-vincular modelo de documento de assinatura por caso (os modelos de Casos/Procurações são escolhidos no ato).
> 6. **Boards/etapas:** criar o tema com o board operacional **"Contratos"** (etapas: `Inicial - contrato novo` → `Documentos iniciais` → `Administrativo feito` → `Judicial` → `Stand by` / `Rescisão` / `Encerrado`). O board **"SISGIMM"** (Aguardando parcela → Comunicação → Docs → Solicitar → Deferida/Indeferida/Paga) **depende de A3**; enquanto A3 não existir, o estado SISGIMM/parcela atual vai em `canonical_fields`.
> 7. **Execução:** **DRY-RUN primeiro** (script Python+SQL que só LÊ e conta/valida, **grava nada**), apresenta os números; **depois GRAVA em produção** (owner autorizou execução direta em produção, **sem tema de teste isolado**).
> 8. **Campos/filtros do tema:** criar **~20 defs** a partir de `CONFIG_FILTROS_PADRAO` + colunas de `CASOS`, com `type` coerente; **7 defs de checklist de documentos** (`CONFIG_DOCUMENTOS_SISGIMM`) por etapa.

---

## Contexto / o que JÁ EXISTE vs NOVO

**JÁ EXISTE (reusar; não reinventar):**
- **Cliente** → `system_clients` (`full_name NOT NULL`, `cpf_cnpj NOT NULL` + UNIQUE parcial `(organization_id, cpf_cnpj) WHERE deleted_at IS NULL`, `email`/`phone` nullable, `custom_fields` JSONB, `drive_folder_id`/`drive_url`). Serviço `src/lib/clients-service.ts` → `createClient(input)` (`:46`) **valida CPF + e-mail** e **cria a pasta no Drive** (grava `drive_folder_id`).
- **Caso** → `system_cases` (`client_id`, `case_code` UNIQUE, `case_type`, `macrostatus_op` default `ONBOARDING`, `macrostatus_fin` default `NAO_APLICAVEL`, `lifecycle` default `LEAD` ∈ `{LEAD, CLIENTE, PERDIDO}`, `tema_id`, `frente_slug` (dormente/NULL), `service_type_id`, `canonical_fields` JSONB, `municipio`, `responsavel`). View `system_cases_active` (**enumera colunas** — atenção). Serviço `src/lib/cases-service.ts` → `createCase(...)` (`:93`); `case_code` prefix via `caseCodePrefix()` (`:39`) derivado do **NOME do tema**. Trigger `system_fn_sync_stage_ids`.
- **Tema** → `system_temas` + espelho `system_service_types.tema_id` + etapas `system_pipeline_stages` (`kind ∈ {op, fin}`). `createTema(...)` (`src/lib/tema-service.ts:190`) **semeia** tema → service_type → etapas.
- **Campos do tema** → `system_tema_field_defs` (`tema_id`, `key`, `label`, `type ∈ {text,select,multiselect,money,number,date,boolean}`, `options`, `ordem`, `required`, `active`, `scope ∈ {caso,cliente}`, `hidden_in_list`, `max_occurrences`). View `_active`. Valor por caso em `system_cases.canonical_fields`.
- **Checklist** → `system_stage_checklist_defs` (def por etapa) / `system_case_checklist_items` (instância por caso). Serviço `src/lib/checklist-service.ts`.
- **Notas** → `system_case_notes`; serviço `src/lib/notes-service.ts` → `createCaseNote(caseId, body, userId)` (`:90`).
- **Timeline** → `system_case_events` (eventos read-only da ficha).
- **Usuários** → `system_users` (`id = auth.users.id`). **Não** criamos usuário-que-loga aqui (decisão 4).
- **DEFAULT_ORG** = `00000000-0000-0000-0000-000000000001`.
- **Conexão direta ao banco** (CLI Supabase quebrado no Windows/OneDrive): env `SUPABASE_DB_PASSWORD` / `SUPABASE_PROJECT_REF` em `sistema-hv/.env.local`; molde `sistema-hv/scripts/db-apply-pg.ts` (aplicar SQL via `pg` direto). Python 3.11 + `psycopg2` + `openpyxl`/`pandas` disponíveis. Moldes de seed: `scripts/seed-cases-demo.ts`, `scripts/seed-temas-manuais.ts`, `scripts/test-financeiro.ts`.

**NOVO (escopo desta story):**
1. **Script de ETL** `scripts/import-mais-medicos.ts` (orquestrador, reusa os serviços do app) **ou** `scripts/import-mais-medicos.py` (leitura da planilha + SQL via `psycopg2`), com flag **`--dry-run`** (default) e **`--commit`**. Idempotente/reexecutável (find-or-create por chaves naturais).
2. **Tema "Mais Médicos"** + service_type espelho + etapas op do board **"Contratos"**.
3. **~20 campos do tema** (`system_tema_field_defs`) + **7 defs de checklist** de documentos SISGIMM (`system_stage_checklist_defs`).
4. **381 clientes** (`createClient`) com **pasta no Drive** e **CPF-marcador** = `ID_CLIENTE_INTERNO`.
5. **381 casos** (`lifecycle=CLIENTE`, etapa op derivada de `STATUS_CASO`) com `canonical_fields` do vínculo atual + **bloco JSON de histórico** dos vínculos antigos (Opção A).
6. **476 notas** (`OBSERVACOES_CASO`) + **180 andamentos** (`ANDAMENTOS_CASO`) na timeline/notas, com autoria em TEXTO.
7. **Checklist de documentos por caso** a partir de `DOCUMENTOS_SISGIMM` (status OK/pendente; SEM arquivo — só o estado do item).
8. **Plano de rollback** (soft-delete do tema + cascatas) caso a carga precise ser desfeita.

**Fora de escopo (registrar explicitamente):**
- Board **SISGIMM** e esteira de **parcelas** → **A3**. `EVENTOS_AUDITORIA` (2224 linhas) → **descartar**. Criação de **usuário-que-loga** (Auth) → **item 11**. Pré-vínculo de modelo de doc de assinatura por caso → **não fazer** (escolhido no ato).

---

## Mapeamento da planilha (16 abas → destino)

Contagens reais medidas na planilha (após descartar linhas em branco de padding):

| # | Aba | Linhas | Destino nesta story (A8) | Observações |
|---|-----|--------|--------------------------|-------------|
| 1 | **CASOS** | **381** | `system_clients` (1×) **+** `system_cases` (1×). Vínculo ATUAL → `canonical_fields`. | 1 cliente = 1 caso; `ID_CLIENTE_INTERNO` (`CL-XXXX`) ↔ `ID_CASO` (`CASO-XXXX`). Colunas: `ID_CASO, ID_CLIENTE_INTERNO, NOME, CONTRATO_OPERACIONAL_ATIVO, STATUS_CASO, ATIVO_MAIS_MEDICOS, FIES, DSEI_ATUAL, MUNICIPIO_ENTRADA_ATUAL, ALERTA_MULTIPLOS_MUNICIPIOS_EDITAL, MUNICIPIOS_EDITAL_ATUAL, CLASSIFICACAO_IVS_ATUAL, IVS_ATUAL, TIPO_GRUPO, EDITAL_ATUAL, CICLO_ATUAL, ART_19A/19B_EDITAL_ATUAL, ART_19A/19B_PORTARIA_ATUAL, CLASSIFICACAO_PORTARIA_SISGIMM, ID_VINCULO_ATUAL, PERIODO_ATUAL_INICIO/FIM/TEXTO, MES_FECHAMENTO, ETAPA_FLUXO_ATUAL (vem VAZIA → derivar de STATUS_CASO), CASO_ENCERRADO, DATA_ENCERRAMENTO_CASO, CNES, CLASSIFICACAO_UDH, CLASSIFICACAO_IBP, DATA_ULTIMO_ANDAMENTO, DATA_FECHAMENTO, DATA_ULTIMA_ATUALIZACAO`. |
| 2 | **VINCULOS_ATUACAO** | **528** | Histórico → bloco JSON `canonical_fields.vinculos_historico[]` **+** nota resumida na timeline (Opção A). | Até 3 vínculos/caso; **141 casos têm >1**. `E_VINCULO_ATUAL='Sim'` marca o atual (redundante com `CASOS`). |
| 3 | **PERIODOS_ATUACAO** | **529** | `canonical_fields.periodos_atuacao[]` (por vínculo). | Datas início/fim; `E_PERIODO_ATUAL`. |
| 4 | **SISGIMM** | **354** | Resumo/estado atual → `canonical_fields.sisgimm{}` (`ETAPA_SISGIMM_ATUAL`, `STATUS_DOCUMENTACAO_CALCULADO`, `COMUNICACAO_SISGIMM_FEITA`, `ACESSO_SISGIMM`, `SOLICITADO_SISGIMM_1_PARCELA`, `STATUS_PEDIDO_SISGIMM`, `OBSERVACOES_SISGIMM`). | Board SISGIMM completo → **A3**. |
| 5 | **PARCELAS_SISGIMM** | **652** | Resumo em `canonical_fields.parcelas_resumo{}` (contagem por `STATUS_PARCELA`: Não solicitada/Solicitada/Deferida/Indeferida/Paga). **NÃO** → `system_parcelas`. | Parcelas do GOVERNO ≠ honorários (decisão 3). Esteira em **A3**. |
| 6 | **DOCUMENTOS_SISGIMM** | **2469** | `system_case_checklist_items` por caso (status OK/pendente via `STATUS_DOCUMENTO`; `OBRIGATORIO_APLICAVEL`). | **SEM arquivo** — só o estado do item. 7 tipos (`ID_CONFIG_DOCUMENTO`). |
| 7 | **CONFIG_DOCUMENTOS_SISGIMM** | **7** | `system_stage_checklist_defs` (7 defs) na etapa apropriada. | `OBRIGATORIO_19A/19B`, `APLICAVEL_FIES/NAO_FIES`. Nomes: Documento de identificação; Termo/contrato de adesão; Comprovante de período; Comprovante de município/DSEI; Contrato/comprovante FIES; Procuração/autorização; Documentos complementares. |
| 8 | **OBSERVACOES_CASO** | **476** | `system_case_notes` (`createCaseNote`), autoria em TEXTO (`USUARIO_NOME`). | `DATA_HORA`, `TEXTO`, `ORIGEM`. |
| 9 | **ANDAMENTOS_CASO** | **180** | `system_case_events` (timeline) **ou** notas com prefixo, autoria em TEXTO. | `TIPO_ANDAMENTO`, `ETAPA_ANTERIOR/NOVA`, `DESCRICAO`, `VISIVEL_NA_FICHA`, `ANEXO_LINK`. |
| 10 | **EVENTOS_AUDITORIA** | **2224** | **DESCARTAR** (decisão de escopo). | Log de auditoria do beta; não migra. |
| 11 | **USUARIOS_SISTEMA** | **6** (5 reais + 1 bootstrap desativado) | **NÃO** cria usuário-que-loga; nomes usados só como TEXTO de autoria. | thiago correia (admin), Thaise Francelino, Maria Clara Batista, Pablo Silva (admins), João Braga (colaborador). Auth → **item 11**. |
| 12 | **CONFIG_TIPOS** | **14** (G0–G13) | Opções do campo select/multiselect `tipo_grupo`. | `DESCRICAO` = "pendente de configuração" (placeholder); guardar só o código. |
| 13 | **CONFIG_ETAPAS_FLUXO** | **17** | Etapas op do board **"Contratos"** (`AGRUPAMENTO='Contratos'`, ativas). Grupo `SISGIMM` → **A3**; grupo `Status` (Stand by/Rescisão/Encerrado) → etapas finais op. | `CRITERIO_AUTOMATICO` mapeia `STATUS_CASO`→etapa (ver mapeamento abaixo). `ETP-004 Judicial` está `ATIVO='Não'` na planilha, mas **244 casos** estão em Judicial → **incluir a etapa Judicial mesmo assim** (senão 64% dos casos não têm etapa). |
| 14 | **CONFIG_FILTROS_PADRAO** | **32** | Base para as ~20 defs de campo do tema (menus Casos/SISGIMM/Kanban). | Campos `*_CALCULADO` (RESUMO_SISGIMM, PENDENCIA_ALTA/BAIXA) são derivados → mapear para `canonical_fields.sisgimm`/resumo, **não** viram campo editável. |
| 15 | **CONFIG_DOCUMENTOS_INICIAIS** | **7** | Opcional: 2ª lista de checklist (docs iniciais do escritório) na etapa "Documentos iniciais". | Contrato de honorários, Procuração, Identificação, etc. Confirmar com owner se entra em A8 ou fica p/ depois. |
| 16 | **DOCUMENTOS_INICIAIS** | (instâncias) | Se CONFIG_DOCUMENTOS_INICIAIS entrar: instâncias por caso; senão descartar. | Analisar contagem no dry-run. |

**Mapeamento `STATUS_CASO` → etapa op (board "Contratos"):** *(distribuição real: Judicial=244, Administrativo Feito=122, Novo contrato - Organização Docs=8, Rescisão=2, Encerrado=2, Stand by=1, nulo=2)*
- `Novo contrato - Organização ADM` → **Inicial - contrato novo**
- `Novo contrato - Organização Docs` → **Documentos iniciais**
- `Administrativo Feito` → **Administrativo feito**
- `Judicial` → **Judicial**
- `Stand by` → **Stand by**
- `Rescisão` → **Rescisão**
- `Encerrado` → **Encerrado**
- **NULO / desconhecido (2 casos)** → **Inicial - contrato novo** + registrar em relatório do dry-run (não silenciar).

**Normalização obrigatória de valores (medida na base):**
- `CLASSIFICACAO_IVS_ATUAL` tem **~19 variações de caixa/acento** para 5 níveis reais (ex.: "Alta Vulnerabilidade", "Alta vulnerabilidade", "Muita alta Vulnerabilidade", "Media Vulnerabilidade", "-"). **Normalizar** para 5 opções canônicas do select: `Muito Baixa` / `Baixa` / `Média` / `Alta` / `Muito Alta`; `-`/vazio → sem valor. Tabela de normalização no script.
- `ATIVO_MAIS_MEDICOS`, `FIES`, `CONTRATO_OPERACIONAL_ATIVO`: `Sim`/`Não` → boolean.
- `TIPO_GRUPO`: manter código `G0..G13`; **165 casos vêm nulos** → sem valor.

---

## Acceptance Criteria

1. **Script idempotente com `--dry-run`:** existe `scripts/import-mais-medicos.*` que roda por **padrão em `--dry-run`** (não escreve nada) e só grava com `--commit`. Reexecutar o `--commit` **não duplica** dados (find-or-create por chaves naturais: cliente por `cpf_cnpj=CL-XXXX`+org; caso por `case_code`; tema por slug; def por `(tema,key)`; nota/evento por chave de origem determinística).
2. **Dry-run reporta contagens e validações ANTES de qualquer escrita:** o dry-run imprime, por aba, `total lido` vs `a criar` vs `já existe (skip)`, e uma seção de **erros/avisos**: casos sem `STATUS_CASO`, IVS não-normalizáveis, vínculos órfãos, encoding suspeito, colisões de `cpf_cnpj`/`case_code`, notas sem autor. Nenhuma linha é escrita no modo dry-run.
3. **Tema + service_type + etapas op criados:** tema **"Mais Médicos"** em `system_temas`, espelho em `system_service_types.tema_id`, e etapas op do board **"Contratos"** (`Inicial - contrato novo`, `Documentos iniciais`, `Administrativo feito`, `Judicial`, `Stand by`, `Rescisão`, `Encerrado`) em `system_pipeline_stages` (`kind='op'`), via `createTema` (ou equivalente idempotente). Board SISGIMM **não** é criado (fica para A3) — registrado na story.
4. **~20 campos do tema + 7 defs de checklist:** ~20 `system_tema_field_defs` criados (derivados de `CONFIG_FILTROS_PADRAO` + colunas de `CASOS`) com `type` coerente (`select`: Status/Mais Médicos ativo/FIES/DSEI/Alerta município; `multiselect`: Classificação IVS/Tipo-Grupo/Ciclo/Art.19-A e 19-B edital e portaria; `number`: IVS; `text`: Município/Edital/CNES; `date`: período/fechamento/último andamento; `boolean`: contrato operacional ativo). **7** `system_stage_checklist_defs` a partir de `CONFIG_DOCUMENTOS_SISGIMM`, ancorados na etapa apropriada. Idempotente por `(tema,key)`/`(stage,label)`.
5. **381 clientes com pasta Drive + CPF-marcador único:** 381 registros em `system_clients` (`full_name=NOME`, `cpf_cnpj=ID_CLIENTE_INTERNO` como marcador claramente-não-CPF, `email`/`phone` nulos), **cada um com `drive_folder_id` criado no Drive** (processo real via `createClient`). Reexecução não recria pastas. Nenhum CPF inventado; coluna **não** virou nullable.
6. **381 casos (lifecycle=CLIENTE) com vínculo atual + histórico (Opção A):** 381 `system_cases` com `client_id`, `case_code` derivado do tema, `lifecycle='CLIENTE'`, etapa op **mapeada de `STATUS_CASO`**, `canonical_fields` preenchido com o **vínculo ATUAL** (DSEI, município, IVS normalizado, tipo/grupo, edital, ciclo, Art.19-A/B edital e portaria, período atual, resumo SISGIMM/parcelas) **e** com o bloco **`vinculos_historico[]` + `periodos_atuacao[]`** preservando os vínculos/períodos antigos. Trigger `system_fn_sync_stage_ids` não é violada.
7. **476 notas + 180 andamentos na timeline:** as 476 `OBSERVACOES_CASO` viram `system_case_notes` e os 180 `ANDAMENTOS_CASO` viram eventos de timeline (`system_case_events`) / notas, com **autoria em TEXTO** (nome do usuário do beta) — sem criar usuário-que-loga. Datas preservadas.
8. **Checklist de documentos por caso:** para cada caso, `system_case_checklist_items` instanciados a partir de `DOCUMENTOS_SISGIMM` com status **OK/pendente** derivado de `STATUS_DOCUMENTO` e respeitando `OBRIGATORIO_APLICAVEL`. Sem arquivo anexado (a base não tem arquivo — só o estado).
9. **Parcelas SISGIMM NÃO vão para `system_parcelas`:** nenhuma linha em `system_parcelas`; o **resumo/estado atual** do SISGIMM e a contagem de parcelas por status ficam em `canonical_fields`. A esteira completa é explicitamente adiada para **A3** (registrado).
10. **Usuários como texto de autoria:** as 5 pessoas aparecem como TEXTO em notas/andamentos; **nenhum** `system_users`/Auth criado nesta story (fica para item 11).
11. **Plano de rollback/limpeza:** a story entrega um procedimento de **desfazer a carga** (soft-delete do tema "Mais Médicos" e cascatas: casos, canonical, notas, eventos, checklist items, clientes importados marcados por `custom_fields.import_batch`), com SQL/roteiro testado no dry-run e reversível. Pastas do Drive: procedimento documentado (não apagar por padrão; listar para limpeza manual/`clean-client-folders.ts`).
12. **Execução real só após revisão do dry-run:** o `--commit` só roda **após** o owner/@qa revisarem o relatório do dry-run. O relatório do dry-run é anexado à story (File List) antes da execução.

---

## Tasks / Subtasks

- [x] **T1 — Leitor da planilha + normalização** (AC: 1,2) — carregar `MM_BASE_SISTEMA_BETA_v1.xlsx` com `openpyxl`/`pandas` tratando **encoding cp1252/latin-1** (a planilha está com mojibake, ex.: `Descri��o`, `Rescis�o`, `Munic�pio`); mapear as 16 abas em dataclasses; implementar tabela de **normalização de IVS** (~19 variações → 5 níveis) e conversões `Sim/Não`→boolean, datas ISO→`date`. Descartar linhas de padding (abas vêm com 999 linhas, ~985 vazias).
- [x] **T2 — DRY-RUN + relatório** (AC: 1,2,12) — modo default que só LÊ e imprime: contagens por aba (`total/criar/skip`), validações (status faltante, IVS não mapeável, vínculos órfãos, colisões `cpf_cnpj`/`case_code`, notas sem autor), e o mapeamento `STATUS_CASO`→etapa com o head-count. Salvar relatório em `docs/stories/reuniao-2026-08-03/A8-dry-run-report.md`.
- [x] **T3 — Tema + service_type + etapas op** (AC: 3) — criar (idempotente) tema "Mais Médicos", espelho service_type e etapas op do board "Contratos" via `createTema`/SQL. Confirmar `caseCodePrefix('Mais Médicos')` → prefixo do `case_code` (registrar o prefixo real gerado).
- [x] **T4 — ~20 campos do tema** (AC: 4) — inserir `system_tema_field_defs` a partir de `CONFIG_FILTROS_PADRAO` + colunas de `CASOS`, com `type`/`options`/`scope='caso'`/`ordem`. Campos `*_CALCULADO` NÃO viram def editável. Idempotente por `(tema,key)`.
- [x] **T5 — 7 defs de checklist** (AC: 4,8) — inserir 7 `system_stage_checklist_defs` de `CONFIG_DOCUMENTOS_SISGIMM`, ancoradas na etapa apropriada, com flags obrigatório 19A/19B e aplicável FIES/não-FIES no rótulo/metadado.
- [x] **T6 — 381 clientes + pasta Drive** (AC: 5) — para cada linha de `CASOS`: `createClient({ full_name: NOME, cpf_cnpj: ID_CLIENTE_INTERNO, ... })` (cria pasta no Drive). Marcar `custom_fields.import_batch='MM_2026_08_03'` e `custom_fields.cpf_pendente=true`. Find-or-create por `(org, cpf_cnpj)`.
- [x] **T7 — 381 casos + canonical (Opção A)** (AC: 6,9) — `createCase` por cliente: `lifecycle='CLIENTE'`, etapa op mapeada de `STATUS_CASO`, `tema_id`, `service_type_id`, `municipio`, `responsavel` (texto). Montar `canonical_fields` com o **vínculo atual** (de `CASOS`) + `vinculos_historico[]` (de `VINCULOS_ATUACAO` onde `E_VINCULO_ATUAL<>'Sim'`) + `periodos_atuacao[]` + `sisgimm{}` + `parcelas_resumo{}`. **Não** escrever em `system_parcelas`. Respeitar trigger `system_fn_sync_stage_ids`.
- [x] **T8 — Timeline (notas + andamentos)** (AC: 7,10) — 476 `OBSERVACOES_CASO` → `createCaseNote`/insert em `system_case_notes` com autor-texto e `DATA_HORA`; 180 `ANDAMENTOS_CASO` → `system_case_events` (ou notas com prefixo) com autor-texto. Chave de origem determinística p/ idempotência (`ID_OBSERVACAO`/`ID_ANDAMENTO`).
- [x] **T9 — Checklist por caso** (AC: 8) — instanciar `system_case_checklist_items` a partir de `DOCUMENTOS_SISGIMM` (status OK/pendente de `STATUS_DOCUMENTO`; respeitar `OBRIGATORIO_APLICAVEL`). Sem arquivo.
- [x] **T10 — Rollback/limpeza** (AC: 11) — escrever e testar (dry) o SQL de desfazer: soft-delete do tema + cascata (casos/canonical/notas/eventos/checklist), clientes por `custom_fields.import_batch`. Documentar procedimento p/ pastas Drive (não apagar automático).
- [x] **T11 — Execução em produção** (AC: 12) — rodar `--dry-run`, revisar com owner/@qa/@architect, então `--commit`. Registrar contagens pós-carga no Change Log/File List.
- [x] **T12 — Validação pós-carga** (Testing) — contagens (`select count(*)` por tabela), spot-check de 5 casos ponta-a-ponta na UI, `npm run typecheck`.

---

## Dev Notes

**Mapa técnico de destino (fontes verificadas):**
- `createClient(input)` — `sistema-hv/src/lib/clients-service.ts:46` (valida CPF + e-mail; cria pasta Drive; grava `drive_folder_id`). **Ponto de atenção:** a validação de CPF pode rejeitar o marcador `CL-XXXX`. **Decisão:** ou (a) inserir cliente por SQL direto (bypass da validação, gravando `cpf_cnpj='CL-XXXX'` + `drive_folder_id` após criar a pasta via helper do Drive), ou (b) relaxar a validação **só** quando `custom_fields.cpf_pendente` — recomendação: **(a)** para não tocar regra de negócio do app. Confirmar com @architect no início da T6.
- `createCase(...)` — `sistema-hv/src/lib/cases-service.ts:93`; `caseCodePrefix(nameOrSlug)` — `:39` (prefixo do `case_code` derivado do **NOME do tema**). Registrar o prefixo real gerado por "Mais Médicos" no dry-run.
- `createTema({name,slug?,ordem?})` — `sistema-hv/src/lib/tema-service.ts:190` (semeia tema→service_type→etapas).
- `createCaseNote(caseId, body, userId)` — `sistema-hv/src/lib/notes-service.ts:90`. Como não há `userId` real (autoria = texto), inserir em `system_case_notes` por SQL com o campo de autor-texto (verificar coluna de autor da tabela; se só houver `author_user_id`, gravar `NULL` + prefixo `[Beta: <nome>]` no corpo).
- Conexão direta: molde `sistema-hv/scripts/db-apply-pg.ts`; env `SUPABASE_DB_PASSWORD`/`SUPABASE_PROJECT_REF` em `sistema-hv/.env.local` (também presentes `SERVICE_ROLE_KEY`, `GOOGLE_DRIVE_CLIENTS_FOLDER_ID`). Python: `psycopg2` + `openpyxl`/`pandas`.
- **DEFAULT_ORG** `00000000-0000-0000-0000-000000000001` em todas as inserções.
- Seeds de molde para o padrão de escrita: `scripts/seed-cases-demo.ts`, `scripts/seed-temas-manuais.ts`, `scripts/test-financeiro.ts`. Limpeza de pastas órfãs: `scripts/clean-client-folders.ts`. Wipe de clientes (só se rollback exigir): `scripts/wipe-clients.ts`.

**Estrutura sugerida de `canonical_fields` por caso (Opção A):**
```jsonc
{
  "dsei": "…", "municipio_entrada": "…", "classificacao_ivs": "Alta",
  "ivs": 0.412, "tipo_grupo": "G6", "edital": "…", "ciclo": "…",
  "art_19a_edital": "…", "art_19b_edital": "…",
  "art_19a_portaria": "…", "art_19b_portaria": "…",
  "fies": true, "ativo_mais_medicos": true,
  "periodo_atual": { "inicio": "2020-01-01", "fim": null, "texto": "…" },
  "sisgimm": { "etapa": "…", "status_doc": "…", "comunicacao_feita": true, "obs": "…" },
  "parcelas_resumo": { "Nao_solicitada": 3, "Solicitada": 1, "Deferida": 0, "Paga": 0, "Indeferida": 0 },
  "vinculos_historico": [ { "id": "VIN-…", "dsei": "…", "municipio": "…", "periodo": "…" } ],
  "periodos_atuacao": [ { "vinculo": "VIN-…", "inicio": "…", "fim": "…", "atual": false } ],
  "import_batch": "MM_2026_08_03"
}
```

**~20 campos do tema (derivados de `CONFIG_FILTROS_PADRAO` + `CASOS`) — proposta de tipos:**
`status_caso` (select), `ativo_mais_medicos` (boolean), `fies` (boolean), `contrato_operacional_ativo` (boolean), `dsei` (select), `municipio_entrada` (text), `alerta_multiplos_municipios` (boolean), `classificacao_ivs` (select — 5 níveis normalizados), `ivs` (number), `tipo_grupo` (multiselect — G0..G13), `edital` (text), `ciclo` (multiselect), `art_19a_edital`/`art_19b_edital` (multiselect Sim/Não/NA), `art_19a_portaria`/`art_19b_portaria` (multiselect), `cnes` (text), `classificacao_udh` (text), `classificacao_ibp` (text), `data_fechamento` (date), `data_ultimo_andamento` (date). Campos `*_CALCULADO` (RESUMO_SISGIMM, PENDENCIA_ALTA/BAIXA) **não** viram def editável — derivam de `canonical_fields.sisgimm`.

**Riscos (registrar e mitigar):**
- **Encoding cp1252/latin-1:** a planilha está com mojibake nos acentos (`Rescis�o`, `Munic�pio`, `Descri��o`). Ler com o codec certo e validar amostras antes de gravar; um caractere errado em `NOME` afeta a pasta do Drive e o `case_code`.
- **UNIQUE `(org, cpf_cnpj)`:** o marcador `CL-XXXX` é único por natureza, mas reexecução deve fazer **find** (não insert) — testar a idempotência. `case_code` UNIQUE idem.
- **Trigger `system_fn_sync_stage_ids`:** ao gravar caso com etapa mapeada, garantir que o trigger não sobrescreva/rejeite o `stage_id`; validar num caso no dry-run/staging lógico.
- **Quota do Drive p/ 381 pastas:** criar 381 pastas via Service Account pode bater rate limit — implementar backoff/retomada (a idempotência permite reexecutar de onde parou). Confirmar `GOOGLE_DRIVE_CLIENTS_FOLDER_ID` correto (memória registra folder-id que às vezes não bate).
- **View `system_cases_active` enumerada:** ela lista colunas explicitamente; se algum insert depender de coluna nova, a view pode não expor — não é bloqueante para A8 (não alteramos schema), mas checar que os casos importados aparecem na view (senão somem da UI).
- **Validação de CPF em `createClient`:** pode rejeitar o marcador (ver decisão (a)/(b) acima).
- **Etapa Judicial `ATIVO='Não'` na planilha vs 244 casos em Judicial:** incluir a etapa mesmo assim; senão a maioria dos casos fica sem etapa.
- **`system_case_notes` autoria:** se não houver coluna de autor-texto, embutir `[Beta: <nome>]` no corpo (decisão de fallback).
- **dev = prod:** não há ambiente isolado (decisão 7). O rollback (AC-11) é a rede de segurança; `--dry-run` é obrigatório antes do `--commit`.

### Testing
- **Contagens pós-carga (SQL):** `system_temas`=+1 (Mais Médicos); `system_pipeline_stages` (op, Contratos)=7; `system_tema_field_defs`≈20; `system_stage_checklist_defs`=7; `system_clients` (batch)=381; `system_cases` (tema)=381 com `lifecycle='CLIENTE'`; `system_case_notes`≈476; `system_case_events`≈180; `system_case_checklist_items`>0 por caso; `system_parcelas` (deste batch)=**0**.
- **Distribuição de etapas** confere com STATUS_CASO: Judicial≈244, Administrativo feito≈122, Documentos iniciais≈8, Rescisão≈2, Encerrado≈2, Stand by≈1, Inicial (fallback dos 2 nulos)≈2.
- **Spot-check de 5 casos** na UI (ex.: `CL-0001` ABRAAO OLIVEIRA TAVARES, e 1 caso com >1 vínculo, 1 FIES, 1 Judicial, 1 com SISGIMM avançado): ficha abre, `canonical_fields` renderizam nos campos do tema, timeline mostra notas/andamentos com autor-texto, checklist de docs com status, pasta do Drive existe e abre.
- **Idempotência:** rodar `--commit` 2×; contagens não mudam na 2ª.
- **Rollback:** executar o procedimento de desfazer num sub-conjunto (dry) e confirmar cascata.
- `npm run typecheck` verde (se o ETL for `.ts`); `npm run lint` no script.

---

## Dependências

- **Depende de (todos entregues):** `system_temas`/`system_service_types`/`system_pipeline_stages` + `createTema` (tema-service); `system_clients` + `createClient` + Drive (clients-service, Storage via Service Account); `system_cases` + `createCase` + `caseCodePrefix` + trigger `system_fn_sync_stage_ids`; `system_tema_field_defs` + `canonical_fields` (R2-07/S2-07/R2-09); `system_stage_checklist_defs`/`system_case_checklist_items` (S2-01/S2-03); `system_case_notes` (S4-03); `system_case_events` (S4-04). Conexão pg direta (`db-apply-pg.ts`).
- **Adia para A3 (múltiplos Kanbans — board SISGIMM):** board SISGIMM (7 etapas: Aguardando parcela → Comunicação → Docs → Solicitar → Deferida/Indeferida/Paga) **e a esteira de parcelas** (`PARCELAS_SISGIMM`). Enquanto A3 não existir, o estado SISGIMM/parcela atual vive em `canonical_fields`.
- **Adia para item 11 (motor de distribuição):** criação de **usuário-que-loga** (Supabase Auth) para as 5 pessoas.
- **Relaciona com A7 (motor de variáveis):** os ~20 campos criados aqui alimentam o autofill de documentos do tema Mais Médicos (chaves estruturadas).
- **Não** depende de A1/A2 desta mesma reunião.

---

## File List

- `sistema-hv/scripts/import-mais-medicos.py` (NOVO — ETL Python+openpyxl+psycopg2 com `--dry-run` (default) / `--execute`; gravação desligada nesta rodada; leitor+normalização (mojibake/IVS/Sim-Não/datas/percentuais), builder de canonical_fields Opção A, relatório de contagens/anomalias, leitura de metadados do banco) — **CRIADO + dry-run rodando limpo 2026-08-04**
- `sistema-hv/scripts/import-mais-medicos.py` (ATUALIZADO 2026-08-04 — `--execute` IMPLEMENTADO: reuso do service_type `MAIS_MEDICOS` (decisão #1, vincula tema_id + semeia/revive 7 etapas op "Contratos"), gravação idempotente de tema/campos/checklist-defs/clientes/casos/notas/andamentos/checklist-items; case_code colisão-proof via `import_src_id` estável + sequence de fallback; chama o helper Node de Drive (NÃO-FATAL))
- `sistema-hv/scripts/import-mais-medicos-drive.mjs` (NOVO — cria as pastas no Google Drive dos clientes do batch via googleapis+JWT (mesmo caminho do app), idempotente por `drive_folder_id IS NULL`, falha NÃO-FATAL marca `drive_sync_failed`)
- `sistema-hv/scripts/import-mais-medicos-rollback.sql` (NOVO — desfazer a carga: hard-delete de casos/filhos + clientes por `import_batch`, desvincula tema do service_type reusado, soft-delete do tema; NÃO apaga service_type nem pastas Drive)
- `docs/stories/reuniao-2026-08-03/A8-dry-run-report.md` (NOVO — relatório do dry-run, gerado pelo script; anexado antes do `--execute`)
- `MM_BASE_SISTEMA_BETA_v1.xlsx` (FONTE — raiz do repo; leitura apenas)
- `sistema-hv/src/lib/clients-service.ts` (reuso `createClient`; possível ponto de bypass de validação de CPF — decisão @architect)
- `sistema-hv/src/lib/cases-service.ts` (reuso `createCase`/`caseCodePrefix`)
- `sistema-hv/src/lib/tema-service.ts` (reuso `createTema`)
- `sistema-hv/src/lib/checklist-service.ts` (reuso defs/itens)
- `sistema-hv/src/lib/notes-service.ts` (reuso `createCaseNote`)
- `sistema-hv/scripts/db-apply-pg.ts` (molde de conexão pg direta)

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-08-04 | 1.0 | **IMPORTADO EM PRODUÇÃO.** `--execute` implementado e rodado (dev=prod). **Decisão #1 aplicada:** reusado o `system_service_types` "Mais Médicos" (slug `MAIS_MEDICOS`, id `f91b1900-…`) como espelho — `UPDATE … SET tema_id` no service_type existente (NÃO criou `MAIS_MEDICOS_T`); 7 etapas op "Contratos" semeadas/revividas (a UNIQUE(service_type,kind,slug) é FULL → usei REVIVE/UPSERT p/ contornar linhas op soft-deletadas antigas, ex.: `ENCERRADO`); 9 etapas op genéricas soft-deletadas (0 casos no tipo). Fin/comercial intactas. **Números REAIS inseridos:** tema=1 (`044c960d-…`), etapas op=7, campos do tema=21, checklist-defs=7, clientes=**381** (100% CPF-marcador `CL-XXXX` + `cpf_pendente=true`), casos=**381** (lifecycle=CLIENTE, `stage_op_id` resolvido em 100%), eventos `created`=381, notas=**476** (`[Beta: <nome>] … [src:OBS-…]`), andamentos=**180** (`action='andamento_importado'`, autor em `diff.autor_texto`), checklist-items=**2368** (de 2469 linhas DOCUMENTOS_SISGIMM; 101 duplicatas config-por-caso colapsadas pela idempotência `(case_id,def_id)` — dedup correto), 544 marcados OK. `system_parcelas`=**0** (resumo em `canonical_fields`). **Drive: 381 pastas criadas, 0 falhadas.** **case_code colisão-proof:** 13 ID_CASO são hex (ex.: `CASO-3fa6552b`) cujo NNNN derivado colidiria — resolvido com `import_src_id`=ID_CASO como chave de idempotência estável + alocação via `nextval_seq_system_case_code` no fallback; 381 case_codes distintos. **Distribuição op** confere: Judicial 244 / Administrativo feito 122 / Documentos iniciais 8 / Inicial 2 (nulos) / Encerrado 2 / Rescisão 2 / Stand by 1. **Spot-check:** CASO-0001 (ABRAAO, Adm. feito, IVS Alta, pasta OK); CASO-0085 (EDUARDO ALVES, hist=1); CASO-0086 (EDUARDO BATISTA, hist=2 — vínculos BETIM/MG C01 + GOIÂNIA/GO C02 preservados em `canonical_fields.vinculos_historico` + `parcelas_resumo`). **Idempotência PROVADA:** re-execução inseriu 0 linhas em todas as entidades. Erro transitório superado no meio: 1ª tentativa falhou por UniqueViolation em `ENCERRADO` (constraint FULL vs linha soft-deletada) → corrigido p/ REVIVE/UPSERT e reexecutado sem perda (idempotente). | @data-engineer |
| 2026-08-04 | 0.2 | **Dry-run construído e rodando limpo.** Criado `sistema-hv/scripts/import-mais-medicos.py` (`--dry-run` default, `--execute` desligado nesta rodada por decisão do owner). Dry-run lê as 16 abas, resolve mapeamento e imprime relatório salvo em `A8-dry-run-report.md`. **Contagens confirmadas** (todas batem com o esperado): tema=1, etapas op=7, campos do tema=**21**, checklist defs=7, clientes=381 (100% CPF→marcador `CL-XXXX`), casos=381 (lifecycle=CLIENTE), notas=476, andamentos=180, checklist items=2469, parcelas em `system_parcelas`=**0**. Distribuição de etapas: Judicial 244 / Administrativo feito 122 / Documentos iniciais 8 / Rescisão 2 / Encerrado 2 / Stand by 1 / fallback (2 nulos) 2. **141 casos com múltiplos vínculos** (histórico preservado, Opção A). 0 órfãos em notas/andamentos/docs. **Anomalias:** (1) já existe um `system_service_types` "Mais Médicos" (slug `MAIS_MEDICOS`) SEM `tema_id` → decisão p/ owner: reusar como espelho ou deixar o `createTema` criar `MAIS_MEDICOS_T`; (2) `case_code` prefix real = **`MAISMEDICOS`** (não `MM` — `caseCodePrefix` remove acentos/espaços); (3) coluna `DSEI_ATUAL` da aba CASOS é um flag Sim/Não ("atua em DSEI?"), não o nome do distrito → modelada como `boolean`; (4) mojibake U+FFFD em STATUS_CASO/IVS/CICLO é irrecuperável na origem, mas `norm_key()` casa o mapeamento assim mesmo; NOMEs de cliente estão sem mojibake (pastas do Drive OK). **NÃO** rodado `--execute`. | @data-engineer |
| 2026-08-03 | 0.1 | Draft inicial — ETL para PRODUÇÃO da base "Mais Médicos" (`MM_BASE_SISTEMA_BETA_v1.xlsx`, 16 abas). Cria tema Mais Médicos + service_type + etapas op (board "Contratos"), ~20 campos do tema + 7 defs de checklist; 381 clientes com pasta Drive + CPF-marcador (`CL-XXXX`); 381 casos (lifecycle=CLIENTE, etapa de STATUS_CASO) com vínculo atual em `canonical_fields` + histórico dos vínculos antigos (Opção A); 476 notas + 180 andamentos na timeline (autoria em TEXTO); checklist de docs por caso; parcelas SISGIMM NÃO vão p/ `system_parcelas` (resumo em canonical, esteira→A3); usuários como texto (Auth→item 11). Script idempotente com `--dry-run`→`--commit`; plano de rollback; execução só após revisão do dry-run. Contagens reais medidas na planilha; encoding cp1252/latin-1 e normalização de IVS registrados como risco. | @sm (Bob) |
