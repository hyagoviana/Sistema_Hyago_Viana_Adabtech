# Consolidação de Reviews — MVP-Drive v1.0 → v1.1

> Visão executiva das 3 revisões (Architect, PM, QA).
> Identifica BLOCKERs absolutos e direciona a v1.1 do plano.

**Data:** 2026-05-21 · **Revisores:** Aria, Tarek, Quinn · **Coordenação:** Orion

---

## 📊 Visão executiva

| Métrica | Total |
|---|---|
| Reviews realizadas | 3 (Architect + PM + QA) |
| **BLOCKERs identificados** | **8** |
| SHOULD-FIX | 21 |
| NICE-TO-HAVE | 15 |
| Cenários de teste novos propostos | 18 |
| Decisão | **v1.1 do plano necessária** antes do kickoff |

---

## 🚫 BLOCKERs absolutos — endereçar ANTES do Sprint MVP-1

Os 8 BLOCKERs abaixo são **gates de entrada** do MVP-Drive. Sem eles resolvidos, `@dev` não inicia.

| # | ID | Bloqueio | Responsável | Esforço |
|---|---|---|---|---|
| 1 | **A1** | Declarar runtime Node nas API routes (criar ADR-MVP-09) | Aria + Dev | 30min |
| 2 | **A2** | UNIQUE partial em `cpf_cnpj WHERE deleted_at IS NULL` | Aria | 10min (editar SQL) |
| 3 | **A3** | Documentar SA membership no Shared Drive | Aria + Hyago | 1h (docs + comunicação) |
| 4 | **P1** | Definir quem implementa (dev humano / Claude / combo) | Hyago | 0 — decisão |
| 5 | **P2** | Combinar daily 15min Hyago + dev | Hyago + Tarek | 0 — combinar |
| 6 | **Q1** | Adicionar categoria SEC ao test plan (6 cenários) | Quinn | 2h |
| 7 | **Q2** | Reforçar SEC-04 (IDOR) como gate obrigatório | Quinn | 30min |
| 8 | **Q3** | Criar `0001_init.rollback.sql` + gates MIG | Aria + Quinn | 2h |

**Esforço total estimado:** ~6h de trabalho + decisões do Hyago.

**Recomendação:** Bloco de 1 dia (não dia útil cheio — pode ser meio período + comunicação com Hyago) para resolver tudo.

---

## ⚠️ SHOULD-FIX — durante a sprint (não bloqueia início)

Resumo por categoria:

### Arquitetura (7)
- **A1** Adicionar UNIQUE em `drive_file_id`
- **A2** Índices em `audit_log`
- **A3** Limitar `drive_sync_error` (VARCHAR 2000 ou JSONB)
- **A4** Policy explícita de INSERT em `audit_log`
- **A5** Auditar via TRIGGER (postergado pra F4-S01)
- **A6** Documentar limite payload Vercel
- **A7** Mover hashing pro browser

### Planejamento (6)
- **P1** Re-rotular Story 2.1 como tarefa técnica
- **P2** Mesclar Stories 2.5 + 2.6
- **P3** Quebrar Story 3.4 em 3.4a + 3.4b
- **P4** Documentar cerimônias
- **P5** Diagrama de dependências
- **P6** Aplicar buffer 20% nas estimativas

### QA (8)
- **Q1** Cenários de concorrência (CON-01 a 03)
- **Q2** Cenários de migração (MIG-03 a 04)
- **Q3** Observability gates (OBS-01 a 03)
- **Q4** Hot path (HP-01)
- **Q5** Rate limit (RATE-01 a 02)
- **Q6** I18N (acentos, emoji)
- **Q7** Mime sniffing por magic bytes
- **Q8** Script cleanup-drive.ts

---

## 💡 NICE-TO-HAVE — backlog (pós-MVP)

| Categoria | Itens |
|---|---|
| Arch | Tags em clients, /health endpoint, MV de dashboards, resumable upload |
| PM | Burndown chart, demo vídeo, template PR padrão |
| QA | Playwright E2E, chaos test, mutation test, Storybook, Lighthouse CI |

---

## 🔄 Plano de execução das correções (BLOCKERs)

### Bloco 1 — Documentação (2-3h)

```
[ ] 1. Editar _adr-mvp-drive.md:
       - Criar ADR-MVP-09 (Runtime Node)
       - Criar ADR-MVP-10 (Plano Vercel)
       - Adicionar nota no ADR-MVP-04 sobre membership

[ ] 2. Editar sprint-mvp-01-foundation.md:
       - Story 1.1: trocar CONSTRAINT por UNIQUE INDEX partial
       - Adicionar export `runtime = 'nodejs'` aos exemplos
       - Adicionar criação de _rollback.sql

[ ] 3. Editar README.md:
       - Adicionar instrução Shared Drive membership
       - Documentar cerimônias (daily, kickoff, review, retro)
       - Atualizar estimativas com buffer 20%

[ ] 4. Editar _qa-test-plan.md:
       - Adicionar 18 cenários novos (SEC, DATA, CON, MIG, OBS)
       - Reforçar SEC-04 como gate
       - Adicionar passos 16-19 ao E2E manual
```

### Bloco 2 — Decisões com Hyago (1h)

```
[ ] 5. Hyago confirma quem implementa
[ ] 6. Hyago confirma plano Vercel (Hobby / Pro)
[ ] 7. Hyago decide Shared Drive vs My Drive
[ ] 8. Combinar daily 15min
```

### Bloco 3 — Pendências externas do Hyago (assíncrono)

```
[ ] 9. Criar pasta Drive + compartilhar com SA (+ adicionar SA como Member do Shared Drive se aplicável)
[ ] 10. Preencher GOOGLE_DRIVE_ROOT_FOLDER_ID no .env.local
[ ] 11. Rotacionar private key (segurança — vazou no chat anterior)
```

---

## 📋 Approval matrix

Para liberar Sprint MVP-1 kickoff, precisamos das 3 assinaturas + Hyago:

| Papel | Aprovou? | Condição |
|---|---|---|
| Aria (Architect) | 🟡 | Após BLOCKERs A1-A3 resolvidos |
| Tarek (PM) | 🟡 | Após BLOCKERs P1-P2 resolvidos |
| Quinn (QA) | 🟡 | Após BLOCKERs Q1-Q3 resolvidos |
| Hyago (PO) | 🟡 | Após decisões pendentes |

**Quando os 4 ficam verdes, MVP-Drive entra em execução.**

---

## 🎯 Próxima ação (recomendada por Orion)

1. **Hyago revisa este sumário** (5min)
2. **Decisões pendentes** (Hyago + Orion, 30min de conversa)
3. **Orion aplica todas as correções de documentação** (2-3h em uma rodada)
4. **Reviews v1.1 finais** (Aria + Tarek + Quinn, 30min cada)
5. **Kickoff Sprint MVP-1** (30min, todos)

**Linha de chegada esperada:** Kickoff em 1-2 dias úteis (depende da disponibilidade do Hyago para as decisões).

---

## 🔗 Documentos referenciados

- [`_review-architect.md`](./_review-architect.md) — Aria, 8 issues técnicos
- [`_review-pm.md`](./_review-pm.md) — Tarek, 12 issues de planejamento
- [`_review-qa.md`](./_review-qa.md) — Quinn, 18 cenários novos + 11 issues
- [`README.md`](./README.md) — Índice do MVP-Drive
- [`_adr-mvp-drive.md`](./_adr-mvp-drive.md) — Decisões arquiteturais (v1.0, vira v1.1)
- [`sprint-mvp-01-foundation.md`](./sprint-mvp-01-foundation.md) — Sprint 1 (v1.0, vira v1.1)
- [`sprint-mvp-02-crud-clientes.md`](./sprint-mvp-02-crud-clientes.md) — Sprint 2 (v1.0, vira v1.1)
- [`sprint-mvp-03-upload-arquivos.md`](./sprint-mvp-03-upload-arquivos.md) — Sprint 3 (v1.0, vira v1.1)
- [`_qa-test-plan.md`](./_qa-test-plan.md) — Test plan (v1.0, vira v1.1)

---

— Consolidado por Orion 🎯 · Coordenado entre Aria, Tarek e Quinn
