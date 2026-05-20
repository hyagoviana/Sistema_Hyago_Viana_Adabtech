# Sprint 10 — Migração dos 2.500 casos + Hardening

> **Versão:** 1.0 · **Status:** Pendente
> **Estimativa:** 10 dias úteis · **Épico PRD 1:** 10 — Migração

---

## Objetivo

Trazer **todo o histórico vivo do escritório** para dentro do sistema: ~2.500 casos FIES espalhados em Excel + Trello + Drive informal. Script de importação versionado, modo dry-run obrigatório, mapeamento explícito Trello-coluna → macrostatus canônico, dashboard de status com lista de erros (link para original), aprovação humana de amostra antes do commit definitivo. Em paralelo, **hardening**: corrigir bugs descobertos nos sprints 2-9, melhorar performance crítica, fechar gaps de segurança identificados na auditoria RLS.

Migração em **staging** primeiro (toda a importação roda aqui), prod só no Sprint 11.

---

## Stories cobertas (PRD 1 §6)

| Story PRD | Título | Estimativa |
|---|---|---|
| **10.1** | Script de importação Excel | 4d |
| **10.2** | Validação de migração (painel) | 3d |
| **(hardening)** | Bugs P0/P1 + performance + segurança | 3d |

---

## Telas Lovable tocadas

- Nova seção em `configuracoes.tsx` ou nova rota interna admin (`/admin/migracao` — confirmar com Hyago se cria ou reusa)
- Aproveitar componentes shadcn de tabela + progress + dialog para painel de migração

---

## Entregas-chave

### Script de importação (Story 10.1)
- `scripts/migrate-fies.ts` — Node TS
- Lê Excel via `xlsx` ou `exceljs`
- Para cada linha:
  1. `upsertClient` (CPF como chave; se existe, atualiza dados)
  2. `createCase` (tipo inferido a partir de coluna "Tipo" ou heurística)
  3. `mapStatusFromTrello(trello_column) → macrostatus_operacional` (tabela de mapeamento explícita)
  4. Se houver Termo histórico: cria `termo_acerto_snapshots` com status APROVADO_JURIDICO marcado como "migrado"
  5. Se houver parcelas pagas: cria `parcelas` com status PAGA + data de pagamento
  6. Cria eventos sintéticos em `case_events` (ex: "Migrado em {data} a partir de Excel linha {N}")
- Logs em `migration_log` (tabela criada Sprint 1)
- Modo `--dry-run` (não persiste, só valida + log)
- Modo `--batch-size=N` (default 50)
- Modo `--source=excel:/data/FIES.xlsx`
- Reentrância: roda 2x sem duplicar (idempotente por `source + source_row`)
- Tabela de mapeamento Trello→canônico documentada em `docs/migration/trello-mapping.md` (validar com Hyago)

### Validação (Story 10.2)
- Tela `/admin/migracao` (ou seção em configuracoes):
  - Cards de status por batch (total, IMPORTED, SKIPPED, ERROR)
  - Tabela de erros com filtro por motivo + link para Excel original (linha)
  - Tabela de warnings (importou mas com ressalva)
  - Botão "Aprovar amostra" (admin vê 20 random casos importados e confirma)
  - Botão "Reverter batch" (apenas admin; só funciona em staging)
- Dashboard mostra cobertura: % casos com CPF válido, % com Termo, % com status mapeado

### Hardening (3d)
- Triagem de bugs P0/P1 acumulados (registros Linear/GitHub Issues criados nos sprints 2-9)
- Performance: queries lentas detectadas via `pg_stat_statements`
- Segurança: re-rodar audit-rls; verificar Storage RLS; revisar Edge Functions com input sanitização
- Lighthouse global: meta 90+ Performance em rotas principais

---

## Riscos principais

| # | Risco | Mitigação |
|---|---|---|
| **S10-R1** | Excel tem dados inconsistentes (CPF inválido, datas em formatos misturados) | Validação rígida + log; linha com erro vira SKIPPED com motivo |
| **S10-R2** | Mapeamento Trello→canônico errado (status migra para coluna errada) | Mapeamento documentado + validado com Hyago ANTES do batch final; dry-run revela divergências |
| **S10-R3** | Drive tem ~30GB para indexar | Decisão de escopo: importar referência (path Drive) sem replicar bytes; documentar em ADR-009 |
| **S10-R4** | Migração trava por timeout (2500 casos × N operações) | Batch 50; pode rodar overnight; idempotente |
| **S10-R5** | Termos históricos sem dados completos | Snapshot "migrado" tem flag `dados_incompletos = true`; FIN revisa antes de usar |
| **S10-R6** | Hardening descobre bug crítico sem tempo de corrigir | Buffer 3d; bugs P0 bloqueiam Sprint 11; P2+ vão para backlog |

---

## Definition of Done (além do global)

- [ ] 2 stories PRD com ACs cumpridos + bloco hardening
- [ ] Dry-run da migração em staging com 100% das 2.500 linhas
- [ ] >= 95% das linhas IMPORTED (5% ERROR aceitável documentado)
- [ ] Hyago aprovou amostra de 20 casos importados (validação visual)
- [ ] Audit-RLS re-executado: zero vazamento
- [ ] Bugs P0/P1 do backlog zerados
- [ ] ADR-009 (estratégia Drive na migração) registrado
- [ ] Documento `docs/migration/runbook.md` com passo-a-passo para executar em prod

---

## Próximo sprint

[**Sprint 11 — Dashboards + Cutover Produção**](./sprint-11-dashboards-cutover.md)

---

> _— @pm John, sob coordenação do Orion 🎯_
