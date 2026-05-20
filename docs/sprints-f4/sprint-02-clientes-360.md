# Sprint 2 — Clientes (CRUD + Ficha 360°)

> **Versão:** 1.0 · **Status:** Pendente (depende de Sprint 1 verde)
> **Estimativa:** 9 dias úteis · **Épico PRD 1:** 2 — Cliente unificado (PF/PJ)

---

## Objetivo

Tornar a entidade **Cliente** plenamente operável: criar, editar, soft-delete/restore, listar com busca fuzzy, e abrir a **Ficha 360°** com 5 abas (Casos, Documentos, Timeline, Financeiro, Comunicação). Validações Zod ponta-a-ponta, alertas no cabeçalho calculados em tempo real, e a partir daqui Hyago já consegue cadastrar um cliente real e voltar a ele depois — primeiro entregável de valor visível.

---

## Stories cobertas (PRD 1 §6)

| Story PRD | Título | Estimativa |
|---|---|---|
| **2.1** | CRUD de Cliente | 3d |
| **2.2** | Ficha Cliente 360° (5 abas) | 4d |
| **2.3** | Alertas no cabeçalho | 2d |

---

## Telas Lovable tocadas

- `clientes.index.tsx` — lista com busca, paginação, criação
- `clientes.$id.tsx` — Ficha 360° (5 abas)

---

## Entregas-chave

- CRUD completo com Zod (CPF/CNPJ válido, e-mail, telefone BR)
- Lista com busca trigram (`pg_trgm`) sobre `full_name`, `cpf`, `email`, `phone`
- Soft-delete + restore (admin)
- Ficha 360°: cabeçalho com identificação + ações rápidas (links Drive, Conta Azul, ChatGuru — placeholders até Sprint 5/9)
- Aba Casos: lista com 2 rastros lado a lado (preview; Pipeline real vem nos Sprints 3-4)
- Aba Documentos: lista cross-casos do cliente (preview; upload vem no Sprint 5)
- Aba Timeline: feed de eventos consolidado (read-only)
- Aba Financeiro: parcelas + snapshots (read-only)
- Aba Comunicação: timeline mensagens (placeholder; integração ChatGuru vem no Sprint 9)
- Alertas calculados via Postgres function `compute_client_alerts(client_id)`: inadimplente, docs pendentes, hold ativo, contrato pós-2018, multi-casos
- Realtime: lista de clientes atualiza ao receber INSERT/UPDATE
- Sync básico com Google Drive: criar pasta `Clientes/{Nome-CPF}/` ao criar cliente (Drive completo vem no Sprint 5)

---

## Riscos principais

| # | Risco | Mitigação |
|---|---|---|
| **S2-R1** | Validação de CPF/CNPJ tem casos extremos (ex: CPFs antigos) | Usar lib `cpf-cnpj-validator`; teste com 50 casos reais do Hyago |
| **S2-R2** | Busca fuzzy lenta em prod com 2500 clientes | Índice GIN trigram + paginação obrigatória; limite 50/página |
| **S2-R3** | Aba Casos com dois rastros lado a lado depende do Pipeline (Sprint 3) | Renderizar com dado real do banco; visual já está no Lovable |
| **S2-R4** | Realtime gera N+1 queries | Subscription apenas para `clients`; React Query invalida com debounce 500ms |
| **S2-R5** | Soft-delete em prod sem CONFIRM dialog vira pegadinha | Dialog shadcn obrigatório com nome do cliente digitado para confirmar |

---

## Definition of Done (além do global)

- [ ] 3 stories com ACs cumpridos
- [ ] Smoke E2E: cria cliente PF + edita + lista + abre ficha + soft-delete + restore
- [ ] axe-core zero violations nas 2 rotas
- [ ] RLS testada: usuário de outra org não vê os clientes
- [ ] Performance: lista com 2500 mocks < 300ms p95

---

## Próximo sprint

[**Sprint 3 — Casos + Pipeline Operacional**](./sprint-03-casos-pipeline-op.md)

---

> _— @pm John, sob coordenação do Orion 🎯_
