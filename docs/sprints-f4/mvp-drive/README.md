# MVP-Drive — Sprints enxutas para costurar Clientes + Arquivos + Google Drive

> **Recorte focado** dos Sprints F4 v1.1 para entregar o **MVP funcional** do sistema:
> 1. CRUD de Clientes (banco real, sem mock)
> 2. Upload / Download / Exclusão de arquivos
> 3. Storage no Google Drive via Service Account (Supabase guarda apenas metadado)

| | |
|---|---|
| **Criado em** | 2026-05-21 |
| **Versão atual** | 1.0 (revisada → migrar para v1.1) |
| **Autor** | Orion (aios-master) |
| **Aprovação PO** | Hyago Viana (pendente decisões — ver `_review-summary.md`) |
| **Status** | 🟡 **Em revisão** — 8 BLOCKERs identificados pelas reviews Architect/PM/QA |
| **Próxima ação** | Resolver BLOCKERs → emitir v1.1 → kickoff Sprint MVP-1 |

---

## 🎯 Visão Geral

| Sprint | Duração | Objetivo | Entrega principal |
|---|---|---|---|
| **MVP-1** | 3-4 dias | Fundação Supabase + helper Google Drive | Schema migrado, Drive acessível, smoke test verde |
| **MVP-2** | 3-4 dias | CRUD Clientes funcional | Listagem real, add/edit/soft-delete, pasta auto-criada no Drive |
| **MVP-3** | 4-5 dias | Upload e download de arquivos | Anexar arquivos a clientes, gerenciar via UI |
| **TOTAL** | **~12 dias úteis** | | MVP completo costurando UI ↔ Supabase ↔ Drive |

---

## ✅ Escopo Incluído

- Tabelas `clients`, `client_documents`, `audit_log`
- Service Account Drive (já configurada — `hv-drive@hv-sistema.iam.gserviceaccount.com`)
- RLS básica (organization-scoped)
- UI Lovable intocada — apenas conectada a dados reais
- Soft-delete LGPD-ready (coluna `deleted_at`)
- Validação Zod (CPF/CNPJ, e-mail, telefone BR)
- Auto-criação de pasta no Drive ao criar cliente

## ❌ Escopo Excluído (fica pra fases seguintes do F4)

| Feature | Sprint F4 destino |
|---|---|
| OCR de documentos | F4-05 (Documentos) |
| Geração DOCX/PDF (Declaração COVID, DGM) | F4-05, F4-08 |
| Sync bidirecional Drive (leitura de pasta externa) | F4-05 |
| Casos / processos / pipeline operacional | F4-03 |
| Pipeline financeira (15 colunas + views) | F4-04 |
| n8n / ZapSign / WhatsApp / Conta Azul | F4-06, F4-09 |
| Hardening LGPD completo (consent_records) | F4-01 (parte) |
| Multi-org real (uma única org no MVP) | F4-10 |

---

## 🔗 Dependências Externas (PENDENTE)

| Item | Responsável | Bloqueia |
|---|---|---|
| Criar pasta-raiz no Drive | Hyago | Sprint MVP-1 |
| Compartilhar pasta com SA `hv-drive@hv-sistema...` como **Editor** | Hyago | Sprint MVP-1 |
| Preencher `GOOGLE_DRIVE_ROOT_FOLDER_ID` no `.env.local` | Hyago | Sprint MVP-1 |
| Decidir: Shared Drive vs My Drive (recomendação no ADR-04) | Architect + Hyago | Sprint MVP-1 |
| ⚠️ **Rotacionar private key** (vazou no chat anterior) | Hyago | Antes do deploy de produção |

---

## 📁 Estrutura dos Documentos

```
docs/sprints-f4/mvp-drive/
├── README.md                          ← este arquivo (índice)
├── _adr-mvp-drive.md                  ← Decisões arquiteturais (8 ADRs)
├── sprint-mvp-01-foundation.md        ← Sprint 1: Schema + Drive helper
├── sprint-mvp-02-crud-clientes.md     ← Sprint 2: CRUD Clientes
├── sprint-mvp-03-upload-arquivos.md   ← Sprint 3: Upload/Download
├── _qa-test-plan.md                   ← Gates de QA por sprint
├── _review-architect.md               ← Revisão da Aria (8 issues, 3 BLOCKERs)
├── _review-pm.md                      ← Revisão do Tarek (12 issues, 2 BLOCKERs)
├── _review-qa.md                      ← Revisão da Quinn (18 cenários novos, 3 BLOCKERs)
└── _review-summary.md                 ← 🎯 Consolidação executiva — LEIA PRIMEIRO
```

---

## 🚀 Como Executar

### Pré-execução (Hyago + Orion)
1. ✅ Credenciais Supabase no `.env.local` (já feito)
2. ✅ Credenciais Google SA no `.env.local` (já feito)
3. ⏳ Hyago compartilha pasta-raiz Drive com SA → manda `ROOT_FOLDER_ID`
4. ⏳ Decisão Shared Drive vs My Drive (ADR-04)

### Execução
1. **Sprint MVP-1** — `@dev` implementa schema + helper Drive · `@qa` valida RLS · `@architect` revisa decisões
2. **Sprint MVP-2** — `@dev` conecta UI clientes ao Supabase · integra criação de pasta
3. **Sprint MVP-3** — `@dev` adiciona upload/download · `@qa` testa cenários de falha
4. **Deploy preview** — Vercel manual, conforme Hyago aprove

---

## ✓ Definição de Pronto (DoD) — Global

Toda story considera-se pronta quando:

- [ ] Código compila sem warnings TypeScript
- [ ] `npm run lint` passa
- [ ] Testes unitários ≥ 70% nos arquivos novos
- [ ] RLS validada (cliente A não vê dados do cliente B)
- [ ] Documentação atualizada no README do módulo
- [ ] PR aprovado por revisor
- [ ] **Layout Lovable intocado** (regra inviolável do projeto)

---

## 🔄 Como esse MVP se encaixa nos Sprints F4 originais

```
F4-S01 (17d, completo) ─┐
                        ├──► MVP-1 (3-4d) — fatia mínima da fundação
F4-S02 (9d, completo) ──┴──► MVP-2 (3-4d) — CRUD enxuto
F4-S05 (10d, completo) ────► MVP-3 (4-5d) — upload sem OCR

Após MVP-Drive, retomar Sprints F4 completos a partir de:
  - F4-S01 (resíduo): LGPD completa, observabilidade, VPS, spikes técnicos
  - F4-S02 (resíduo): Ficha 360°, alertas calculados, busca trigram
  - F4-S03: Casos + Pipeline Operacional
  - F4-S04: Pipeline Financeira
  - F4-S05 (resíduo): OCR, Drive bidi, geração DOCX
  - ... e assim por diante até F4-S11 (Go-live)
```

---

## 📞 Stakeholders

| Papel | Quem | Quando consultar |
|---|---|---|
| **PO** | Hyago Viana | Mudanças de escopo, validação de UX |
| **Orchestrator** | Orion (aios-master) | Coordenação geral, handoffs |
| **Architect** | Aria | Decisões técnicas, schema, ADRs |
| **PM** | Tarek | Quebra de stories, planejamento |
| **QA** | Quinn | Test plan, gates, cenários |
| **Dev** | (a definir) | Implementação |

---

— Orion, orquestrando o sistema 🎯
