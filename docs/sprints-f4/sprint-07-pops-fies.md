# Sprint 7 — POPs FIES_COVID + FIES_ESF_DGM (fluxos operacionais)

> **Versão:** 1.0 · **Status:** Pendente
> **Estimativa:** 12 dias úteis · **Épicos PRD 1:** 6 (COVID) + 7 (ESF/DGM)

---

## Objetivo

Implementar os **dois fluxos operacionais de maior volume** ponta a ponta: COVID (sem TRIAGEM, fluxo direto a partir de DOCS_PENDENTES) e ESF/DGM (com geração + tracking de DGM, follow-up automatizado por município, e fallback `sem_exito_dgm`). Conecta scrapers SEI e CNES, Gmail monitor de respostas MS/FNDE, e protocolo Gov.br via n8n + Playwright. Este é o sprint mais denso por volume de integrações orquestradas — daí os 12 dias úteis.

ESF_PORTARIA e FIES_MILITAR são variações menores tratadas como subset deste sprint (sem story própria — reuso do mesmo motor).

---

## Stories cobertas (PRD 1 §6)

| Story PRD | Título | Estimativa |
|---|---|---|
| **6.1** | Fluxo COVID Fase 1 (DOCS_PENDENTES) — régua follow-up | 2d |
| **6.2** | QA Declaração COVID (checklist 7 itens) | 1d |
| **6.3** | Fluxo COVID Fase 2 (PRONTO_PROTOCOLO) — requerimento + gov.br | 3d |
| **6.4** | Fluxo COVID Fase 3 (ACOMPANHAMENTO_ADM) — SEI scraper + Gmail | 3d |
| **6.5** | Fluxo COVID Fase 4 (JUDICIAL_OPERACIONAL) — escalação Projuris | 1d |
| **6.6** | Fluxo COVID Fase 5 (IMPLANTADO → ENCERRADO_OP) | 1d |
| **7.x** | DGM particularidades (geração + follow-up D+7/D+15/D+30 + inteligência município) | 1d |

---

## Telas Lovable tocadas

- `casos.$id.tsx` — abas Visão, Timeline, Documentos
- `controladoria.prazos.tsx` — visualização de SLAs
- `controladoria.excecoes.tsx` — casos sem-êxito DGM
- `peticionamento.$id.tsx` — preview do requerimento gerado

---

## Entregas-chave

### Régua follow-up automática
- Cron Postgres (`pg_cron`) diário 6h: consulta casos em DOCS_PENDENTES por X dias e gera tarefas conforme PRD §6.1 (D+3, D+7, D+15)
- Alerta "Coleta Pausada" em D+15 sem resposta (atualiza badge no card do Pipeline)

### QA Declaração COVID (Story 6.2)
- Modal com checklist 7 itens (PRD §3.2)
- Status: APROVADA / APROVADA_COM_RESSALVA / REPROVADA
- Se reprovada: motivo obrigatório + ação sugerida (solicitar nova, mudar para CNES, cancelar inviável)
- Aprovada → habilita transição para PRONTO_PROTOCOLO

### Requerimento + Gov.br (Story 6.3)
- Edge Function `generate-requerimento`: merge dados em template DOCX → PDF
- QA jurídico do requerimento (checklist 8 itens)
- Botão "Protocolar" chama workflow n8n `wf-govbr-protocolo` (Playwright + Gov.br login compartilhado de Hyago)
- NUP retornado salvo em `cases.nup`
- Contingência: campo manual de input de NUP se Playwright falhar (audit_log marca origem)

### SEI scraper (Story 6.4)
- Workflow n8n `wf-sei-scraper` rodando diariamente às 6h
- Consulta cada `nup` ativo; persiste em `case_sei_tracking`
- 3 falhas consecutivas → status FALHANDO + alerta @admin
- UI mostra última consulta + última movimentação no dossiê

### Gmail monitor (Story 6.4)
- Workflow n8n `wf-gmail-monitor` polling 15min
- Inbox dedicada (`processos@hv.adv.br`) — Gmail API com OAuth
- Vincula e-mails ao caso por NUP (regex) ou CPF
- Cria `case_communications` + tarefa QA para JUR
- Classifica decisão (deferido/indeferido/exigência) via heurísticas simples + flag manual

### Escalação Judicial (Story 6.5)
- Botão "Escalar para Judicial" em ACOMPANHAMENTO_ADM
- Form: motivo + advogado_responsável_jur + Projuris ID (manual nesta versão; integração bidirecional fica para PRD 2)
- Caso transiciona para JUDICIAL_OPERACIONAL; `flag_judicial_operacional = TRUE` permanente

### IMPLANTADO → ENCERRADO_OP (Story 6.6)
- Tela de "Confirmar implantação": OPE faz upload da planilha banco (Excel) ou input manual de %
- Sistema calcula % real abatido vs solicitado
- Classifica `resultado_caso` (TOTAL / PARCIAL / INSUCESSO)
- Trigger bifurca para ELABORANDO_TERMO automaticamente (já implementado Sprint 1, validado Sprint 4)

### DGM (Story 7)
- Geração DGM (já no Sprint 5; aqui amarra ao fluxo)
- Tracking `dgm_retorno_status`: PENDENTE → ASSINADA / RECUSADA / INDISPONIVEL
- Follow-up D+7/D+15/D+30 via pg_cron
- Flag `sem_exito_dgm` se 30d sem retorno + JUR confirma plano B
- Acumulador `case_municipios_inteligencia` recalculado nightly: taxa de sucesso por município, último caso com sucesso, responsáveis destacados
- UI no dossiê mostra "Aparecida de Goiânia: 75% DGM assinadas, última em 08/2025 por Dr. Fulano"
- Sugestão de plano B quando taxa < 50% (badge "Considerar judicializar mais cedo")

### CNES scraper (mensal)
- Workflow n8n `wf-cnes-scraper` mensal
- Detecta desligamento → flag `case_cnes_sync.alertou_desligamento` + tarefa OPE

---

## Riscos principais

| # | Risco | Mitigação |
|---|---|---|
| **S7-R1** | Gov.br muda layout e Playwright quebra | Adapter isolado; alertas em 3 falhas consecutivas; contingência manual sempre disponível |
| **S7-R2** | SEI scraping cai em CAPTCHA | n8n com solver (2captcha) opcional; fallback manual |
| **S7-R3** | Gmail OAuth expira | Refresh token + alerta @admin se expira; renovação manual |
| **S7-R4** | Heurística de classificação de decisão MS erra | JUR sempre revisa; classificação automática é apenas hint |
| **S7-R5** | Acumulador município com dados ruins polui inteligência | Recalcular do zero nightly; admin pode resetar org-scoped |
| **S7-R6** | Régua follow-up gera spam de tarefas | Dedup: 1 tarefa ativa por caso/tipo; reabre se anterior fechada |

---

## Definition of Done (além do global)

- [ ] 7 stories com ACs cumpridos
- [ ] Smoke E2E COVID completo: cliente novo (ZapSign Sprint 6) → fase 1 → fase 2 (Gov.br stub) → fase 3 (SEI mock) → IMPLANTADO → bifurcação
- [ ] Smoke E2E DGM: gera DGM → tracking → follow-up D+7 disparado em ambiente de teste com clock manipulado
- [ ] 3 workflows n8n versionados em `n8n/workflows/*.json`
- [ ] Inteligência município calculada para org HV com >5 casos histórico

---

## Próximo sprint

[**Sprint 8 — Termo de Acerto + Aprovação Híbrida**](./sprint-08-termo-acerto.md)

---

> _— @pm John, sob coordenação do Orion 🎯_
