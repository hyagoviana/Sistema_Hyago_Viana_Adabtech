# 📊 Levantamento de Entrega — Projetos 1 e 2 (pós-virada arquitetural)

> **Data:** 2026-06-08 · **Orquestração:** Orion (aios-master)
> **Base:** ata `reuniao-cliente-2026-06-05-virada-arquitetural.md` + PRD Master + PRD Projeto 1 (FIES) + PRD Projeto 2 (Controladoria) + **estado real do código** (`sistema-hv/`).
> **Status:** documento de diagnóstico. **Nenhuma alteração de código foi feita.** Serve para decidir o replanejamento e validar pendências com o cliente.

---

## 0. Definição de escopo — o que são "Projeto 1 e 2"

Há **dois significados** nos documentos do projeto. Este levantamento adota a **leitura da ata** (confirmada com o owner em 2026-06-08):

| | "Projeto 1" | "Projeto 2" | "Projeto 3" |
|---|---|---|---|
| **Leitura da ata (ADOTADA)** | Nova estrutura **operacional** (Tipos de Serviço + pipelines dinâmicas + documentos/ZapSign) | **Módulo Financeiro** (Termo de Acerto/cálculo, acerto parcial, cobrança) | Controladoria / **Pró-Juris** (judicial) |
| Numeração dos PRDs (`docs/prd/`) | Plataforma FIES inteira | Controladoria Jurídica | Peticionamento |

> ⚠️ Atenção ao ler os PRDs antigos: o **PRD Projeto 2** em `docs/prd/02-controladoria-juridica.md` é a **Controladoria** (parte 3 na ata), **não** o módulo financeiro. O conteúdo financeiro está dentro do **PRD Projeto 1** (§9–11), mas a ata o **destacou** como entrega separada (parte 2).

---

## 1. A virada da reunião, em uma frase

> "A gente tava fazendo o **caso depende do cliente**; agora o **Tipo de Serviço** vira entidade de 1ª classe (pipeline própria + modelos próprios), o documento passa a ser **gerado no sistema** e enviado ao ZapSign **por API**, e o cliente nasce **manual**."

Isso **invalida três pilares hardcoded** do sistema atual:
1. `case_type` como CHECK fixo;
2. `macrostatus_op` / `macrostatus_fin` como CHECK fixo (colunas do Kanban);
3. o fluxo de entrada "recebe documento assinado por e-mail do ZapSign → OCR".

É, na prática, uma **reconstrução da espinha dorsal de dados** (caso ↔ cliente ↔ tipo de serviço), reconhecida na própria call.

---

## 2. Como o sistema está HOJE (estado real do código)

**Stack:** TanStack Start (React 19 + Vite) · Supabase (Postgres + RLS) · Google Drive (service account) · Vercel · single-tenant · 17 migrations · 59 rotas.

### 2.1 O que já funciona de verdade ✅

**Banco (`supabase/migrations/`)**
- `system_clients` — CRUD PF/PJ, `drive_folder_id/url/sync_*`, `professional_data` (jsonb), soft-delete LGPD.
- `system_cases` — caso vinculado a cliente (`client_id` NOT NULL).
- `system_client_documents` — documentos **do cliente** (Drive + metadado: `drive_file_id`, `sha256`, `mime_type`, `size_bytes`).
- `system_case_tasks` / `system_case_deadlines` / `system_case_communications` — dossiê 360º.
- `system_users` (1 papel/usuário, 9 papéis) + `system_consent_records` (LGPD) + `system_audit_log` (trigger cobre app **e** n8n).
- Trigger de **bifurcação automática**: ao mover `macrostatus_op` para `IMPLANTADO`/`IMPLANTACAO_PARCIAL` com `macrostatus_fin = NAO_APLICAVEL`, seta `macrostatus_fin = ELABORANDO` (`20260523000007_fin_bifurcacao.sql`).

**Backend / UI**
- Padrão consistente: `*-service.ts` (server-only) → `createServerFn` (`src/rpc/`) → hooks TanStack Query com **optimistic update**.
- **`KanbanBoard.tsx` é GENÉRICO** — recebe `columns` por props + drag-and-drop (`@dnd-kit`). Hoje é alimentado pelas constantes fixas de `src/lib/cases/constants.ts`.
- Clientes, Casos (2 Kanbans op/fin), Documentos do cliente (upload/download Drive), Dossiê — **reais** (sem mocks).
- RBAC (`src/lib/rbac.ts`) + RLS organization-scoped.

### 2.2 O nó: o que está HARDCODED (`20260523000004_cases.sql` + `constants.ts`)

```
case_type      CHECK fixo: FIES_ESF, FIES_DGM, COVID, MAIS_MEDICOS, RESIDENCIA, CFM_CRM
macrostatus_op CHECK fixo (10): ONBOARDING, ANALISE, CONFERENCIA, PRONTO_AJUIZAR,
               EM_ANDAMENTO, AGUARDANDO_DECISAO, IMPLANTADO, IMPLANTACAO_PARCIAL,
               ENCERRADO, CANCELADO
macrostatus_fin CHECK fixo (12): NAO_APLICAVEL, ELABORANDO, APROVACAO, AGUARDANDO_ATIVACAO,
               ATIVO, QUITANDO, QUITADO, INADIMPLENTE, PARCIAL, RENEGOCIADO, SUSPENSO, CANCELADO
```

### 2.3 O que NÃO existe (relevante para a virada) ❌

- ❌ `system_service_types` (Tipo de Serviço como entidade)
- ❌ `system_pipeline_stages` (etapas configuráveis op/fin)
- ❌ `system_document_templates` + motor de geração de documentos
- ❌ `system_case_documents` (documentos **dentro do caso** — hoje só há docs do cliente)
- ❌ Colunas de pasta Drive em `system_cases`
- ❌ Integração **ZapSign por API** (rotas `/casos/$id/termo*` são **stubs** vazios)
- ❌ Geração via Google Docs (DOCX/PDF)
- n8n: fluxo "cria leads" por **e-mail/ZapSign** (JSON na raiz do repo, **não** versionado no app), com bug de `org_id`.

---

## 3. Projeto 1 (operacional) — o que precisa mudar e o que falta

### 🔴 3.1 Banco — reconstrução da espinha (maior esforço)

| Mudança | Hoje | Precisa |
|---|---|---|
| Tipo de Serviço | CHECK fixo `case_type` | **`system_service_types`** (nome, slug, ativo, ordem) + `system_cases.service_type_id` (FK) |
| Etapas de pipeline | CHECK fixo `macrostatus_op` | **`system_pipeline_stages`** (`service_type_id`, `kind: 'op'\|'fin'`, ordem, label, cor) — editável |
| Estado do caso | texto-enum | `system_cases.stage_id` (FK → etapa) substitui `macrostatus_op/fin` |
| Pasta Drive do caso | não existe | `drive_folder_id/url/sync_*` em `system_cases` |
| Docs do caso | não existe | **`system_case_documents`** (espelho de `system_client_documents` + `case_id` + `numero`) + view + RLS |
| Numeração de doc | não existe | sequência/coluna em `system_case_documents` (casa com retorno do ZapSign) |
| Migração | — | converter casos de teste: `case_type`→`service_type_id`, estado fixo→`stage_id` |

### 🟡 3.2 UI — Pipeline Operacional

- **Tela de seleção de Tipo de Serviço** (cards FIES/COVID/Mais Médicos…) **antes** do Kanban — **nova**.
- Kanban renderiza **colunas dinâmicas** (de `system_pipeline_stages`) em vez do enum fixo. ✅ **Reaproveita `KanbanBoard.tsx`** — só troca a fonte das colunas (constante → query).
- **Editor de etapas** (criar/renomear/remover/reordenar) para admin/dono do processo — **novo**.

### 🔴 3.3 Documentos + ZapSign — módulo 100% novo

- **Motor de modelos**: Google Docs base, placeholders `<campo>`, formulário dinâmico (auto-preenchido + obrigatório + em branco), flag `vai_para_zapsign` por modelo.
- **Geração** via Google Docs API: copiar modelo → substituir placeholders → exportar **DOCX** (edição) + **PDF** (final).
- Botão **"Enviar para ZapSign"** via API (criar documento, gerar link, acompanhar status).
- Webhook **"documento assinado"** → **baixar o PDF original assinado** (⚠️ **não copiar** — preserva cadeia de certificação digital) → lançar na pasta do caso.
- **Aba "Documentos" dentro do caso** (`src/routes/casos.$id.tsx`).

### 🟢 3.4 Cliente + n8n

- Cliente **manual** (ponto zero): CRUD já existe; desacoplar do gatilho ZapSign e ajustar campos do painel (lista vem da Patrícia).
- n8n de e-mail vira **secundário** (mantém porta opcional); corrigir `org_id`.

---

## 4. Projeto 2 (financeiro) — o que precisa mudar e o que falta

> A ata pediu deixar o financeiro **"um pouquinho parado agora"** → é o **segundo** bloco.

- Pipeline financeira com **colunas dinâmicas/editáveis** (mesma mecânica do operacional — `kind='fin'`).
- **Bifurcação por botão** explícito ("Caso ganho → Enviar para o financeiro"); hoje é **automática via trigger**. *(decisão em aberto: manter os dois?)*
- **Marcação "acerto parcial / judicial"** que **acompanha o caso** mesmo após ir ao financeiro (campo/flag em `system_cases` + badge no card/ficha) — **nova**.
- **Calculadora de honorários + Termo de Acerto** (snapshots imutáveis, conferência segregada elaborador≠conferidor, aprovação híbrida auto/manual) — hoje **stub**. Já especificado no PRD 1 §9–11; a ata o move para a parte 2.
- Parcelas + cobrança (Conta Azul/Asaas via n8n) — **futuro dentro da parte 2**.

---

## 5. Aproveitável × Retrabalho

| ✅ Aproveita (sobrevive à virada) | 🔁 Retrabalho |
|---|---|
| `KanbanBoard.tsx` genérico + drag-drop | `case_type` fixo → entidade configurável |
| Padrão service/rpc/hooks + optimistic update | `macrostatus_op/fin` fixos → etapas dinâmicas (`stage_id`) |
| CRUD clientes + Drive + auditoria | Trigger de bifurcação automática → vira botão |
| Dossiê (tarefas/prazos/comunicações) | n8n de onboarding por e-mail → vira secundário |
| RBAC + LGPD base | (nada se perde — é evolução de schema + migração) |

**Conclusão:** UI e padrão de código sobrevivem bem. O **retrabalho pesado é de banco + migração**, exatamente como reconhecido na call. O Kanban genérico já estava preparado para colunas dinâmicas — foi o melhor investimento da Fase 1.

---

## 6. Bloqueadores e pendências (validar com Hyago/Patrícia ANTES de codar)

1. **API do ZapSign liberada na conta do Hyago?** (custo/contratação?) — **bloqueia o Projeto 1, Fase D**.
2. **Campos finais do painel do cliente** — Patrícia envia "como criam cliente hoje" (nome, CPF, e-mail, telefone, endereço, CRM, OAB, vínculo institucional, especialidade, profissão…).
3. **Modelos de documento** — conjunto inicial por tipo de serviço; quais campos são obrigatórios / em branco. Patrícia envia declarações; contratos vêm de outra pessoa.
4. **Etapas de cada Tipo de Serviço** — FIES como molde (~50%); mapear **COVID** (o mais complexo) e os demais.
5. **Bifurcação financeira** — botão explícito, automática (atual), ou os dois?
6. **Formato da marcação "acerto parcial"** — onde aparece (card, ficha, financeiro).
7. **Matriz de visibilidade RBAC** — quem (papel) vê/edita cada pipeline e tela.
8. **Migração de dados existentes** — casos de teste (Maria de Jesus, João Pedro, Jerusa…): `case_type` fixo → `service_type_id`; estado fixo → `stage_id`.

---

## 7. Faseamento recomendado (alinhado à ata §7)

### Projeto 1 (agora) — "montar a nova estrutura primeiro"

- **Fase A — Nova espinha dorsal de dados** *(prioridade máxima)*
  `system_service_types` + `system_pipeline_stages` (op/fin) + `service_type_id`/`stage_id` no caso + migração dos dados de teste.
- **Fase B — Pipeline operacional dinâmica**
  Seleção de tipo de serviço → Kanban com colunas dinâmicas (reaproveita `KanbanBoard.tsx` + drag-drop) + editor de etapas.
- **Fase C — Documentos do caso + pastas no Drive**
  Pasta de caso, `system_case_documents`, aba "Documentos" no caso.
- **Fase D — Modelos + geração (Google Docs) + ZapSign por API**
  Templates por serviço, formulário dinâmico, geração DOCX/PDF, botão ZapSign, retorno do assinado para a pasta do caso. *(depende do bloqueador #1)*

### Projeto 2 (depois)
Pipeline financeira dinâmica + bifurcação por botão + acerto parcial + calculadora/Termo de Acerto + cobrança (n8n).

### Futuro (parte 3+)
Controladoria / Pró-Juris (judicial); alertas de não-assinado; demais módulos (CRM, Marketing, WhatsApp).

---

## 8. Definição de "pronto" para a entrega dos Projetos 1 e 2

**Projeto 1 pronto quando:**
- [ ] Admin cria/edita Tipos de Serviço e suas etapas (op) sem tocar em código.
- [ ] Pipeline operacional abre por Tipo de Serviço, com colunas dinâmicas e drag-drop persistindo.
- [ ] Cliente criado manualmente; caso vinculado ao cliente + tipo de serviço; pasta no Drive criada.
- [ ] Documento gerado de um modelo (auto-preenchido), exportado em DOCX/PDF, vinculado ao caso.
- [ ] (se ZapSign liberado) "Enviar para ZapSign" → assinatura → PDF assinado original lançado na pasta do caso.
- [ ] Casos de teste migrados para o novo modelo sem perda.

**Projeto 2 pronto quando:**
- [ ] Pipeline financeira dinâmica + "Enviar para o financeiro" por botão.
- [ ] Marcação "acerto parcial/judicial" acompanha o caso e fica visível.
- [ ] Termo de Acerto: cálculo automático + conferência segregada + aprovação + PDF.

---

## 9. Decisão técnica — motor de documentos (2026-06-08)

**Decisão (owner):** o motor de geração + edição de documentos será **Google Docs** (não OnlyOffice/Collabora self-host, não lib local). Requisito: **edição visual completa (tipo Word)** dentro do app antes do envio ao ZapSign.

**Modelo de auth (ponto crítico):**
- **1 OAuth2 de conta-sistema** (refresh token offline) autentica **o backend** — copiar template, preencher placeholders, exportar PDF, enviar ao ZapSign.
- O **editor embutido (iframe Google Docs) NÃO usa esse token** — ele depende da sessão Google do navegador. Como o owner **não quer login por usuário**, os docs gerados ficam **"qualquer pessoa com o link pode editar"** (link exposto só dentro do app com RBAC). Google Doc link-editável **permite edição anônima** → a equipe edita com fidelidade total sem logar.

**Fluxo Fase D:**
1. Template = Google Doc por Tipo de Serviço (importado do Word 1× e revisado), placeholders `<campo>`.
2. Gerar: `Drive.files.copy` + `Docs.batchUpdate(replaceAllText)` (auto + formulário).
3. Editar: iframe embutido (fallback "Abrir no editor" em nova aba + botão "Concluí a edição").
4. Finalizar: `Drive.files.export` → PDF (+DOCX); trava o doc; grava em `system_case_documents` com numeração.
5. ZapSign: flag `vai_para_zapsign` → API → webhook "assinado" → baixa PDF **original** → pasta do caso.

**Gotchas:** (a) iframe do Google pode ser bloqueado (X-Frame) → "nova aba" é o plano robusto; (b) usar **OAuth2 user** (conta-sistema), não a service account atual, como dono dos docs; (c) auditoria de edição é responsabilidade do **app** (edição é anônima no Google); (d) conversão Word→GDoc só no cadastro do template (1×), lossless depois.

**Custo:** grátis (cotas Drive/Docs). **Roda no Vercel** (tudo via API, sem servidor extra).

---

*Documento gerado por Orion (aios-master) a partir da ata, dos PRDs e do estado real do código. Próximo passo sugerido: validar os bloqueadores (§6) com Hyago/Patrícia e, em paralelo, desenhar a Fase A (migrations da nova espinha).*
