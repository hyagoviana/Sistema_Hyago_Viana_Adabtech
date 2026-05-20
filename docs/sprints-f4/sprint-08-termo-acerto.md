# Sprint 8 — Termo de Acerto + Aprovação Jurídica Híbrida

> **Versão:** 1.0 · **Status:** Pendente
> **Estimativa:** 9 dias úteis · **Épico PRD 1:** 8 (parcial — elaboração até aprovação)

---

## Objetivo

Construir o **artefato central de monetização** do escritório: o Termo de Acerto. Wizard de elaboração com cálculos automáticos (saldo antes/depois, parcelas pagas no processo, valor efetivo, honorários, parcelamento, à vista), conferência cruzada com segregação imposta por RLS+CHECK (elaborador ≠ conferidor), aprovação jurídica **híbrida** (automática se TODOS os critérios PRD §11 satisfeitos, manual caso contrário), snapshot imutável v1, geração de PDF com hash SHA-256. Apresentação ao cliente, aceite e geração de cobrança ficam para o Sprint 9.

---

## Stories cobertas (PRD 1 §6)

| Story PRD | Título | Estimativa |
|---|---|---|
| **8.1** | Elaboração do Termo (wizard + cálculos) | 4d |
| **8.2** | Conferência do Termo (segregação) | 2d |
| **8.3** | Aprovação Jurídica Híbrida | 3d |

---

## Telas Lovable tocadas

- `casos.$id.termo.tsx` — visualização do Termo
- `casos.$id.termo.elaborar.tsx` — wizard de elaboração
- `controladoria.decisoes.tsx` — fila de aprovações manuais JUR

---

## Entregas-chave

### Wizard de Elaboração (Story 8.1)
- Passos: 1) Dados financeiros (saldos pré/pós, parcelas processo) → 2) Configurações honorários (%, valor parcela, desconto à vista) → 3) Cláusulas especiais (opcional) → 4) Revisão → 5) Salvar como v1
- Cálculos automáticos (PRD §9.2):
  - `valor_efetivo = max(0, saldo_antes − saldo_depois − parcelas_pagas_processo)` (truncado)
  - `valor_total = floor(valor_efetivo × percentual / 100)`
  - `qtd_parcelas = floor(valor_total / valor_parcela)`
  - Regra do resto < R$100: incorpora à última; >= R$100: cria parcela extra
  - `valor_avista = valor_total × (1 − desconto_avista/100)` (padrão 10%)
- Auto-detecção dos 3 cenários de suspensão FIES (`client.fies_data.suspension_active`) pré-preenche
- Auto-classificação `tipo_termo = PARCIAL | COMPLEMENTAR` (PRD §9.4)
- FIN ajusta manualmente se necessário (override registrado em audit_log)
- Salva como snapshot v1 (status RASCUNHO em `termo_acerto_snapshots`)
- Validações Zod estritas (sem NaN, sem valor negativo, etc.)

### Conferência (Story 8.2)
- Tela de "Termos para conferir" lista snapshots EM_CONFERENCIA
- Outro FIN abre (RLS impede `elaborador_id = conferidor_id` — query em loader já filtra)
- Checklist visual 8 itens (PRD 1 §8.2)
- Botão "Aprovar conferência" → status APROVACAO_JURIDICA
- Botão "Reprovar" → volta para ELABORANDO_TERMO + motivo + tarefa de revisão para elaborador
- Migration adiciona CHECK `elaborador_id != conferidor_id` na tabela `termo_acerto_snapshots`

### Aprovação Jurídica Híbrida (Story 8.3)
- Edge Function `evaluate-termo-approval`: avalia 7 critérios PRD §11.1
  - `tipo_termo = PARCIAL`
  - `percentual_honorarios = 15.00`
  - `clausula_especial IS NULL`
  - Procuração válida APROVADO
  - `case.flag_risco = false`
  - Valor honorários R$1.000–R$20.000 (configurável org)
  - `case.flag_judicial_operacional` consistente
- Se TODOS true → aprovação automática em <1min; badge "Auto-aprovado" no evento timeline; `aprovacao_automatica=true` + critérios JSON em `termo_acerto_snapshots.aprovacao_metadata`
- Se algum false → tarefa criada para JUR titular (responsável_juridico_id do caso ou JUR padrão da org); aparece no Painel "Hoje" com prioridade ALTA
- Tela JUR: mostra snapshot v1 + critérios que falharam + recomendação do sistema
- JUR aprova ou reprova (com motivo em audit_log)
- Aprovado → status COMUNICANDO_ABATIMENTO (próximo sprint pega)

### PDF imutável + Hash
- Edge Function `render-termo-pdf` gera PDF a partir do snapshot v1 (template DOCX → PDF)
- Hash SHA-256 calculado e salvo em `termo_acerto_snapshots.pdf_hash`
- PDF imutável: após aprovação, qualquer edição cria v2 com `supersedes = v1.id`; v1 fica SUBSTITUIDO

### Métricas de saúde
- View `mv_aprovacao_metrics` (refresh nightly):
  - Taxa de auto-aprovação (meta 70-85%)
  - Taxa de reversão (meta ≤10%)
- Dashboard inicial em `dashboards.admin.tsx` (placeholder; consolidação no Sprint 11)

---

## Riscos principais

| # | Risco | Mitigação |
|---|---|---|
| **S8-R1** | Cálculos com truncamento divergem do que FIN faz manualmente | Espelhar fórmulas PRD §9.2 literalmente; teste unit com 30 casos reais validados por Hyago |
| **S8-R2** | Aprovação automática aprova caso que JUR queria revisar | Critérios conservadores; métrica de reversão monitorada; reverter para 100% manual se reversão > 15% em 30d |
| **S8-R3** | Snapshot mutável quebra integridade | Tabela só permite INSERT após status APROVADO; UPDATE bloqueado por RLS |
| **S8-R4** | PDF gerado diferente em ambientes (fonte ausente) | Container Docker com fontes pinadas; teste de hash em CI |
| **S8-R5** | Elaborador burla conferência criando outra conta | RLS + audit log + onboarding de novos users tem aprovação admin |

---

## Definition of Done (além do global)

- [ ] 3 stories com ACs cumpridos
- [ ] Smoke E2E: elaborar v1 → conferir (outro user) → aprovação automática
- [ ] Smoke E2E: elaborar v1 com cláusula especial → aprovação manual
- [ ] Teste de imutabilidade: tentar UPDATE em snapshot APROVADO retorna erro
- [ ] PDF determinístico: gerar 2x mesmo input → mesmo hash

---

## Próximo sprint

[**Sprint 9 — Cobrança + Conta Azul/Asaas + Portal V2**](./sprint-09-cobranca-portal.md)

---

> _— @pm John, sob coordenação do Orion 🎯_
