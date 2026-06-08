# 🧪 QA Review — Plano de Sprints S12–S18 (Fechamento dos Projetos 1 e 2)

> **Revisor:** @qa Quinn (Test Architect) · **Coordenação:** Orion · **Data:** 2026-06-08

## Veredito: **APROVADO COM RESSALVAS**
Sequenciamento correto e maduro; dual-write convivendo com o CHECK fixo é a jogada certa. Motores de risco já provados fim-a-fim. "Com ressalvas" porque S13–S18 existem só como sumário (sem ACs Given/When/Then como o S12), e os pontos que quebram em produção não têm AC testável. **S12 pode iniciar já**; S13+ após materializar ACs e fechar G-01..G-08.

## Gaps de testabilidade (BLOCKERs)
- **G-01** Regressão da migração ausente → baseline pré-migração (Kanban op/fin + bifurcação + auditoria) idêntico após dual-write. Falha bloqueia S14.
- **G-02** Integridade da migração sem critério → 0 órfãos; 100% dos enums fixos mapeados (nenhum estado sem destino); script idempotente (2× = mesmo estado).
- **G-03** Numeração concorrente → 5 inserts paralelos = números únicos sequenciais.
- **G-04** Dupla bifurcação → auto + botão = 1 evento, 1 Termo (idempotente).
- **G-05** Imutabilidade do Termo → trigger `BEFORE UPDATE/DELETE` lança exceção em status APROVADO/APRESENTADO/ACEITO; teste pgTAP via `service_role`; hash do PDF servido == `snapshot.pdf_hash`.
- **G-06** Segregação → teste NEGATIVO (elaborador tenta conferir → bloqueado) + positivo (outro consegue); override admin gera audit.
- **G-07** Cadeia de certificação → PDF baixado do webhook == bytes originais do ZapSign (hash idêntico, sem re-encode).
- **G-08** Doc obrigatório vazio → bloqueia envio; placeholder "em branco" permitido.
- **G-09** Materializar S13–S18 no formato do S12.

## Casos P0 (anexar ao DoD — bloqueiam release)
1. Regressão pós-migração idêntica (G-01)
2. Integridade migração: 0 órfãos + idempotente (G-02)
3. Imutabilidade Termo via service_role → exceção (G-05)
4. Segregação elaborador≠conferidor: negativo passa (G-06)
5. PDF assinado = original por hash (G-07)
6. Numeração concorrente: 5 paralelos únicos (G-03)
7. Dupla bifurcação idempotente: 1 evento/1 Termo (G-04)

## P1 (fecham antes do gate do sprint)
8. Webhook ZapSign idempotente sob 5 chamadas paralelas (1 efeito + 4 skip 200, nenhum 500)
9. Cálculo §9.2: truncamento + bordas (resto =R$99 incorpora / =R$100 cria parcela / =0 não cria; saldo_depois>antes clampa 0). 30 casos reais + bordas matemáticas
10. Doc obrigatório vazio bloqueia envio (G-08)
11. Auditoria: 1 linha por ação consequente (gerar doc, enviar ZapSign, aprovar Termo, bifurcar, migrar)

## DoD — transversais faltando
- **LGPD:** `system_case_documents`/`system_document_templates` em retenção/soft-delete; Termo+PDF contam como dado do titular (export).
- **Auditoria:** lista exaustiva de ações auditáveis dos novos módulos.
- **RBAC:** matriz de visibilidade vira AC de RLS antes de S14/S17 (hoje pendência §6.7).

## Ajustes por sprint (resumo)
- **S13** sprint de maior risco: baseline de regressão + ≥99%/órfãos-zero/idempotência + **plano de rollback testado em staging**.
- **S14** paridade visual/funcional com Kanban atual; tipo sem etapas não quebra; remover/reordenar etapa com casos parados (AC).
- **S15** drop irreversível: AC pós-drop + rollback documentado; corrigir bug `org_id` do n8n.
- **S16** decidir "manter os dois modos de bifurcação?" antes de codar; badge acerto parcial testado.
- **S17** mais sensível: tabela de 7 critérios com 1 teste negativo por critério; SLA de fila de aprovação manual.
- **S18** adapter de cobrança com fallback manual; régua n8n com fallback texto simples.
