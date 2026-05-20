# Sprint 3 — Casos + Pipeline Operacional

> **Versão:** 1.0 · **Status:** Pendente
> **Estimativa:** 10 dias úteis · **Épico PRD 1:** 3 (rastro operacional)

---

## Objetivo

Operacionalizar o **rastro operacional**: CRUD de Caso, Pipeline Op (10 colunas Kanban) com gates de transição validados, Ficha do Caso (estrutura 2 rastros lado a lado — rastro fin vem vazio até o Sprint 4), drag-drop bloqueando transições inválidas com feedback claro, realtime entre múltiplos usuários. Ao fim do sprint, Hyago consegue criar um caso real e movimentá-lo pelo funil operacional sem precisar editar banco direto.

---

## Stories cobertas (PRD 1 §6)

| Story PRD | Título | Estimativa |
|---|---|---|
| **3.1** | CRUD básico de Caso | 2d |
| **3.2** | Pipeline Operacional (Kanban) | 5d |
| **3.4** (parcial) | Ficha do caso (estrutura 2 rastros — apenas op) | 3d |

---

## Telas Lovable tocadas

- `casos.index.tsx` — landing
- `casos.lista.tsx` — Kanban + Lista (toggle)
- `casos.$id.tsx` — Ficha com 2 rastros e abas

---

## Entregas-chave

### CRUD Caso (Story 3.1)
- Criar caso vinculado a cliente; `case_code` gerado via trigger
- Atribuir responsáveis por rastro (`responsavel_operacional_id`, `responsavel_financeiro_id`, `responsavel_juridico_id`)
- Editar campos + flags (`flag_judicial_operacional`, `flag_risco`, `contrato_pos_2018`)
- Soft-delete + cancelamento com motivo (motivo em audit_log)

### Pipeline Op (Story 3.2)
- 10 colunas (ONBOARDING → ENCERRADO_OPERACIONAL + CANCELADO)
- Drag-drop com **gate validation** server-side: chama Edge Function `validate_transition(case_id, from, to)` que retorna lista de bloqueios humanizada
- Card mostra: case_code, tipo, origem, município, próxima ação, responsável (avatar), dias-em-estado com semáforo (verde <15d, amarelo 15-30d, vermelho >30d)
- Filtros: tipo_caso, banco, UF, advogado responsável, SLA estourado, origem
- Toggle Kanban ↔ Lista (componente shadcn já existe no Lovable)
- Densidade: confortável / padrão / compacto (persistir no localStorage)
- Realtime: subscription em `cases` filtrada por org; UPDATE move card na tela de outros users
- Override admin: dialog com motivo obrigatório → audit_log

### Ficha Caso parcial (Story 3.4 parcial)
- Cabeçalho com badges (tipo, origem, banco), alertas, ações rápidas
- Bloco operacional: macrostatus + dias-em-estado + SLA + próxima ação + responsável + histórico (lê de `case_events`)
- Bloco financeiro: stub "Aguardando bifurcação" (real no Sprint 4)
- Abas: Visão (ativa), Docs / Timeline / Financeiro / Comunicação / Auditoria (placeholders que lêem read-only se houver dado)

---

## Riscos principais

| # | Risco | Mitigação |
|---|---|---|
| **S3-R1** | Gate validation no client diverge do server | Single source of truth: Edge Function; client apenas chama e mostra |
| **S3-R2** | Drag-drop com latência ruim no Realtime | Optimistic update local + rollback em erro; reconcile com snapshot Supabase |
| **S3-R3** | 2500 casos × 10 colunas trava render | Virtualização (lib `@tanstack/react-virtual`) por coluna; lazy load 20 por scroll |
| **S3-R4** | Histórico de transições muito longo em casos antigos | Paginação cursor-based em `case_events` (20 por scroll) |
| **S3-R5** | Override admin vira backdoor | RLS força role admin; UI esconde botão para outros; audit_log obrigatório |

---

## Definition of Done (além do global)

- [ ] 3 stories com ACs cumpridos (3.4 marcada como parcial)
- [ ] Smoke E2E: cria caso → arrasta entre colunas válidas → tenta inválida (bloqueio) → override admin (com motivo)
- [ ] Realtime testado com 2 navegadores simultâneos
- [ ] Performance: pipeline com 2500 casos renderiza < 500ms p95
- [ ] RLS: advogado_associado vê apenas casos atribuídos

---

## Próximo sprint

[**Sprint 4 — Pipeline Financeira + Views**](./sprint-04-pipeline-financeira.md)

---

> _— @pm John, sob coordenação do Orion 🎯_
