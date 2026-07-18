# Reforma 2026-07 — Índice de Stories

> Stories de execução da reforma **TEMA→CASO→TIPO + Módulos + Permissões**.
> Base: `docs/reforma-tema-caso-modulos-2026-07-18.md` (documento-mestre).
> Criadas pelo @sm · Validadas por @qa (Quinn) e @architect (Winston) · Correções v0.2 aplicadas.
> **Veredito da validação:** cobertura **100%** das melhorias (reunião E1–E9 + bugs Hyago B1–B5/A1–A3/D1–D4) · PASS-com-ressalvas, ressalvas corrigidas.

## Progresso de execução

| Story | Status | Notas |
|-------|--------|-------|
| **R3-01** | ✅ **Concluída** (dev+qa+architect OK) | Migration `20260718000001` **APLICADA no banco** (2026-07-18). Testes 18/18, regressão-zero. Sem commit. |
| **R4-01** | ✅ **Concluída** (dev+qa+architect+correção) | Gate de $ na ficha do cliente via `permissaoEfetiva`. Só front. Sem commit. |
| **R4-02** | ✅ **Concluída** (dev+qa+architect) | Gate de $ no bloco `finBifurcated` da ficha do caso (TermoPanel+AsaasCobrancasPanel). Só front. Sem commit. |
| **R4-03** | ✅ **Concluída** (dev+qa+architect) | `requireModule` server-side (papel+overrides via `permissaoEfetiva`) nos RPCs financeiro/asaas/contaazul (view/edit) + guard do dashboard. Crons (contaazul+asaas) confirmados seguros (chamam service, não RPC). **Base pronta p/ R3-03.** |
| **R4-04** | ✅ **Concluída** (dev+qa+architect) | Agregação por cliente robustecida (edge órfã) + endpoint leve `getClientPaymentStatus` (`requireAuth`, só `{emDia}`, sem $) → selo "Em dia/Devendo" para não-financeiro. MIX/PLA não existe na modelagem → pendência do owner (3 perguntas). |
| **R4-05** | ✅ **Concluída** (dev+qa+architect) | `NovaCobrancaDialog` extraído e reusado; "Nova cobrança" no painel do cliente (gate `edit` + seletor de caso, caso∈cliente garantido no servidor). **✅ ÉPICO R4 FECHADO.** |

**🎉 Épico R4 (Financeiro) COMPLETO** (R4-01→R4-05): $ só admin/financeiro na UI **e** no servidor (`requireModule`); painel do cliente agrega tudo; selo Em dia/Devendo p/ áreas; cobrança só no painel do cliente.

| **R1-01** | ✅ **Concluída** (auditoria; validação combinada OK) | Lifecycle Lead/Cliente **por caso** auditado: 0 violações das 3 invariantes (5 LEAD/4 CLIENTE), regras E1 alinhadas, views sem duplicação (1 pessoa já é lead+cliente). Matriz de estados em `docs/reforma-2026-07/R1-01-matriz-estados.md`. Sem mudança de código. |

| **R1-02** | ✅ **Concluída** (auditoria; validação combinada OK) | Bug B3: **sem dado incoerente** — os 3 casos flagados são clientes legítimos (doc combinado "Contrato e procuração" assinado, `doc_kind='procuracao'` do S9-12; regra `webhook.ts:158` qualquer-doc-assinado⇒CLIENTE). NÃO criou migration (rebaixaria clientes reais). A percepção "lead E cliente" do Hyago é **UX do roster** (aba Leads = lista-mestra) → resolvida em **R1-03**. |

| **R1-03** | ✅ **Concluída** (dev+qa) | Aba de casos do cliente particionada em seções por lifecycle (Efetivados/Aguardando assinatura/Perdidos), client-side, sem query nova. Função `partitionCasesByLifecycle` exportada (reuso em R1-04). *UX: confirmar com Hyago a ordem dos grupos (hoje Efetivados primeiro).* |

**R1-04/R1-05 adiados** (dependem de R2 — entram junto do TEMA). Prosseguindo por **R5 (bugs do Hyago)** por decisão do dono.

### Épico R5 — bugs do Hyago
| **R5-01** | ✅ **Concluída** (dev+qa) | Bug B1: lupa do roster só filtrava com "chip" de campo marcado. Agora termo sem chip faz match amplo (nome/CPF/e-mail/município/profissional/custom). Client-side, sem migration. |
| **R5-02** | ✅ **Concluída** (dev+qa) | Bug B2: `formatRg` truncava no 9º dígito (`slice(0,9)`). Agora preserva RGs mais longos (head mascarado + excedente); padrão comum e `X` intactos. Teste unitário `format.test.ts`. |

| **R5-03** | ✅ **Concluída** (dev+qa) | Bug B4: robustez do anexo — fallback de criar pasta do cliente no 409 (idempotente), sniff de MIME p/ doc/docx sem `.type` (anti-spoofing preservado), 424 em vez de 5xx + log, mensagem acionável no front. *AC-1 caminho-feliz a confirmar no Drive real do Hyago.* |

| **R5-04** | ✅ **Concluída** (dev+qa+architect) | Bug B5: `moveCaseToStageOp/Fin` blindados — guarda `deleted_at IS NULL` (evita 500 do `.single()` em caso soft-deletado, causa provável) + validação etapa∈`service_type_id` (422 legível) + resolução de `service_type_id` NULL espelhando o trigger. Sem migration; dual-write intacto. |

| **R5-05** | ✅ **Concluída** (dev+qa) | Bug A1: decisão do dono = **lista curada editável ampliada**. Listas centralizadas em `src/lib/br/instituicoes.ts` (92 faculdades + 64 hospitais, sem duplicatas), datalist com digitação livre. Sem tabela/migration. *Evolução futura aprovada: edição via UI (tabela `system_*`).* |

| **R5-06** | ✅ **Concluída** (dev+qa+architect) | Item A2: 4 campos FIES estruturados (Instituição {Caixa/BB}, Valor centavos, Situação {Ativo/Inativo/Liquidado}, Ano {≤2017 / 2018+}) via `FiesFields` (só casos FIES por `isCasoFies`), gravando em `canonical_fields` (reuso S2-07, sem migration). Autofill+busca herdados. Ressalva do arq. corrigida (filtrar chaves FIES do bloco livre). Defs migram p/ R2. |

| **R5-07** | ✅ **Concluída** (dev+qa) | Item A3: dialog "Elaborar Termo" agora tem % honorários e valor da parcela **editáveis**, pré-preenchidos de `getCaseHonorarios` (fallback 15%/R$500/10%); fluem ao snapshot e ao doc; `calcSignature` inclui os novos campos. Só UI, sem migration; imutabilidade preservada. |

| **R5-08** | ✅ **Concluída (código)** (dev+qa) | Itens D1-D4: autofill confirmado (placeholder sem fonte → vazio, nunca `<...>` literal) + aliases Unidade de Saúde/CBO/CNES resolvendo de `canonical_fields`. **Guia de revisão dos modelos** documentado na story. ⏳ **Pendente de operação/você:** editar os Google Docs modelo (trocar trechos fixos por `<...>`) + criar os campos do caso. |

**🎉 Épico R5 (bugs do Hyago) COMPLETO** (código): R5-01→R5-08 concluídas. Pendências que dependem de você/operação: revisar os modelos no Drive (R5-08), testar anexo no Drive real (R5-03 AC-1), definir MIX/PLA (R4-04).

### Épico R2 — TEMA/CASO/TIPO (estrutural)
| **R2-01** | ✅ **Concluída** (dev+architect; migration APLICADA) | Modelagem **aditiva** (Opção A): tabelas `system_temas` + `system_tema_frentes` (vazias), `tema_id` em service_types e cases + `frente_slug` (nullable, sem backfill). View recriada 41→43 colunas (extraída viva do banco). Regressão zero (11 casos intactos, 0 com tema). Trigger/dual-write/CHECKs intocados. RLS ok (app usa service_role). |

Nota: padrão real do repo = **todas** as tabelas `system_*` têm RLS habilitado mas o app acessa via `service_role` (bypassa RLS) — a afirmação anterior "R3-01 sem RLS" era imprecisa.

| **R2-06** | ✅ **Concluída (MVP)** (dev+qa+architect) | UI admin **criar TEMA + FRENTES** (construção manual): botão "Temas" no /pipeline → `TemasManagerDialog`. `tema-service.ts` + `rpc/temas.ts` (escrita **admin-only server-side** via `requireRole(['admin'])`; leitura `requireAuth`) + `useTemas.ts`. Guarda de exclusão 409 (tema/frente com casos ativos). Sem migration, sem tocar cases/trigger. **Diferido:** AC-3 vínculo de pastas por frente → R2-04; AC-4 seeding pipeline → R2-03 (ganchos TODO no código). |

| **R2-03** | ✅ **Concluída** (dev+qa+architect; migration APLICADA) | **Design travado (Opção 1):** cada TEMA ⇔ 1 **service_type interno espelho** — `createTema` chama `createServiceType` (semeia etapas op/fin/comercial) + vincula `tema_id`; motor/trigger **intocados**. `deleteTema` soft-deleta o service_type interno (guarda 409 cobre casos via motor). Migration aditiva `frente_slug` em `system_pipeline_stages` (exibição-only, C2 eliminado na raiz). Roda **sem a lista do cliente**. 11 casos intactos. Design em `docs/reforma-2026-07/R2-03-design-pipeline-tema.md`. |

**Próximo no R2:** R2-04 (pastas/modelos por frente = `frente_slug` em `system_service_type_folders`) → R2-05 (criar caso escolhe tema+frente + case_code) → R2-07 (campos por tema), R2-08 (Kanban+Lista). R2-02 (backfill/fusão dos legados) **espera a lista do cliente**. R1-04/R1-05 entram aqui.
> ⚠️ Follow-ups não-bloqueantes (R2-03): (1) `uniqueServiceTypeSlug` filtra `deleted_at IS NULL` mas a UNIQUE de service_types é FULL → slug de service_type soft-deletado colide no INSERT (fail-safe: reverte o tema, msg genérica) — endurecer o check. (2) falha só no UPDATE de link deixa service_type órfão ativo sem `tema_id`. (3) Double-audit (insert manual + trigger) = limpeza futura.
> 🧹 **Dívida técnica sinalizada pelo QA:** ~22 erros de typecheck pré-existentes (types de `system_case_checklist_item_assignees`/`system_stage_checklist_def_assignees` não regenerados + `service_type_id` nullable) — merecem uma story de saneamento (`npm run db:types`). Não introduzidos pela reforma.
> ⚠️ **Pré-condição p/ R2-03 (do Arquiteto):** se R2 tornar as etapas op globais/sentinela (como fin/comercial), a guarda de R5-04 (`loadStageForServiceType` por `service_type_id`) **e** o trigger `system_fn_sync_stage_ids` devem ser revistos JUNTOS. Enquanto etapas op forem por `service_type_id`, ambos são consistentes.
> Cleanup opcional pendente: unificar `PROVIDER_BADGE` (ClientFinanceiroSection) com `PROVIDER_LABELS`; remover `INADIMPLENTE` morto no predicado do selo (R4-04).

**Pendência do owner (R4-04):** definir se "MIX/PLA" existe (o quê / de qual campo / obrigatório?) — hoje só há forma de pagamento `PARCELADO`/`A_VISTA`.

> **Trabalho agora direto na `main`** (decisão do dono 2026-07-18 — sistema em construção, não em produção). Sem push automático.

### 🔑 Decisão do dono (2026-07-18) — régua do módulo financeiro
Permissões **por aba/módulo**, 3 níveis: **não ver / visualizar / editar**. Módulo **financeiro**: base = **só admin + financeiro**; todos os outros papéis (incl. advogados) = `none` por padrão, liberados só via **override por usuário** (`system_user_module_perms`). Aplicado em `ROLE_MODULE_ACCESS` (rbac.ts) — 1ª aba com régua de negócio própria (mais restrita que o NAV). Vale para TODO o R4.

### Notas da validação R3-01 (aplicar nas stories consumidoras)
- **[R3-04, ALTA]** NÃO usar `permissaoEfetiva(...,'sistema','view')` como gate de `/permissoes` — o módulo `sistema` dá `view` a todos (rota representativa `/configuracoes`). Usar `sistema:edit` ou `role==='admin'`.
- **[R3-02, MÉDIA]** Criar açúcar `useMyPerms()`/`can$(module,action)` que já combine `role` + overrides com fallback `?? {}`, evitando call-sites frágeis.
- **[R3-06, MÉDIA]** Invalidar `queryKey:["my-module-perms"]` ao editar overrides; sempre setar `access` explícito no insert (coluna tem `DEFAULT 'view'`).

## Épicos (40 stories)

| Épico | Bloco | Stories | Tema |
|-------|-------|---------|------|
| **R1** | B1 | R1-01…R1-05 (5) | Modelo Pessoa/Lead/Cliente por caso |
| **R2** | B2 | R2-01…R2-08 (8) | Camada TEMA→CASO→TIPO (o mais sensível) |
| **R3** | B3 | R3-01…R3-06 (6) | Permissões por módulo (ver/editar/não ver) + reorg |
| **R4** | B4 | R4-01…R4-05 (5) | Desacoplar Financeiro ($ só admin/financeiro) |
| **R5** | B5 | R5-01…R5-08 (8) | Bugs e ajustes do Hyago |
| **R6** | B6 | R6-01…R6-04 (4) | Controladoria + ProIuris + tarefas (DESIGN) |
| **R7** | B7 | R7-01…R7-02 (2) | Inteligência / dashboards / IA (DESIGN) |
| **R8** | B8 | R8-01…R8-02 (2) | Inadimplência: relatório + tema (DESIGN) |

## Ordem de execução (Sequência Segura §7 do doc-mestre)

```
1. R3-01  (infra permissaoEfetiva — regressão zero, base de tudo)
2. R4     (desacoplar $, usando ponte can() até R3 completar)
3. R1     (lead/cliente — ajustes sobre lifecycle existente)   ─┐ podem ir
4. R5     (bugs Hyago — quick wins independentes)              ─┘ em paralelo
5. R2     (TEMA/CASO/TIPO — faseado 5a→5e, só após fundação estável)
   R2-01 → R2-02 → R2-03 → R2-04 → R2-05 → (R2-06, R2-07, R2-08)
6. R6 / R7 / R8  (quando as pendências do cliente chegarem)
```
Migrations: R3 usa faixa `20260718000001`; R2 usa `20260719000001+` (colisão corrigida em v0.2).

## Matriz de cruzamentos (validada pelo Arquiteto)

| Cruzamento | Como é tratado |
|-----------|----------------|
| **R4 → R3-01** | R4 usa `permissaoEfetiva('financeiro',…)`; ponte `can(role,'financeiro.manage')` + `requireRole` até R3 existir (`// TODO(R4/R3)`). |
| **R1-04 → R2** | Adaptador `getCaseTemaKey` opera com `case_type` hoje, troca p/ `tema_id` quando R2 chegar. Sem retrabalho de UI. |
| **R5-04 × R2-03** | Fix defensivo do move (valida etapa vs tipo + `deleted_at`) não toca `system_pipeline_stages`; segue válido após unificação. R5-04 antes, R2-03 depois. |
| **R5-06/A2 × R2-07** | R2-07 = estrutura de campos por tema/frente; R5-06 = campos FIES concretos. Ambos gravam em `canonical_fields`. Sem duplicação. |
| **R2/P4 × R3** | Criar tema/frente = admin (`config.manage` na UI + `requireRole` no RPC), com piso admin anti-escalonamento. |
| **R6/R8 × R3 + ProIuris/CA** | RBAC via `permissaoEfetiva`; bloqueados por API ProIuris/Conta Azul + regras + mockups. |

## Regras de ouro (em todas as stories de banco)
- NUNCA deletar `case_type`/`macrostatus_*` (dual-write `system_fn_sync_stage_ids`).
- Migration que toca `system_cases` → recriar `system_cases_active` (DROP+CREATE) + grants.
- NÃO recriar `trg_system_cases_bifurcacao`. Não remover CHECKs de lifecycle.
- Migrations via `npx tsx scripts/db-apply-pg.ts` + rollback. Prefixo `system_`.

## Decisões pendentes a travar antes de codar (destaques da validação)
- **R2-03:** escolher (a) patch das funções `avancar_*` com filtro de `frente_slug`, ou (b) "etapas condicionais viram comuns do tema". *(evita caso ESF parar em etapa DGM)*
- **R2-05 vs R2-08:** fronteira de escopo cravada (dados+filtro vs toggle+Lista) — ou fundir.

## Pendências do cliente (bloqueiam blocos)
1. Lista definitiva de **temas + frentes + campos** → R2-02+ (backfill).
2. Hierarquia TEMA/CASO/TIPO confirmada (MD do Dr. Thiago).
3. **Regras de distribuição** + **mockup** Controladoria → R6.
4. **API ProIuris** + **Conta Azul** (débito) → R6/R8.
5. Base de graduação/residência (A1) → R5-05.
