# Sprint 11 — Dashboards + Cutover Produção (Go-Live)

> **Versão:** 1.0 · **Status:** Pendente
> **Estimativa:** 10 dias úteis · **Épico PRD 1:** 11 — Dashboards + DoD §17 (go-live)

---

## Objetivo

**Fechar o Projeto 1** com chave de ouro: dashboards Op + Fin + Admin operando sobre dados reais migrados, smoke E2E final em 10 fluxos críticos, migração definitiva em produção (janela de manutenção combinada com Hyago), treinamento da equipe (4h documentado), e oficialização do go-live. Ao fim, Excel + Trello podem ser arquivados — o sistema é o "single source of truth" do escritório.

Os dashboards são deixados para o final porque só fazem sentido com dados reais migrados (sem migração = sem cohorts = sem funil real).

---

## Stories cobertas (PRD 1 §6)

| Story PRD | Título | Estimativa |
|---|---|---|
| **11.1** | Dashboard Operacional | 2d |
| **11.2** | Dashboard Financeiro | 2d |
| **11.3** | Dashboard Admin (Consolidado) | 2d |
| **(cutover)** | Migração prod + treinamento + go-live | 4d |

---

## Telas Lovable tocadas

- `dashboards.index.tsx` (landing)
- `dashboards.operacional.tsx`
- `dashboards.financeiro.tsx`
- `dashboards.admin.tsx`
- `dashboards.comercial.tsx`, `dashboards.marketing.tsx`, `dashboards.whatsapp.tsx` — placeholders deixados para Projetos 4/5/6 (fora deste PRD)

---

## Entregas-chave

### Materialized Views + pg_cron
- `mv_dashboard_operacional` (PRD §16.1) — refresh nightly 3h
- `mv_dashboard_financeiro` — funnel financeiro, receita prevista vs realizada, inadimplência por idade
- `mv_dashboard_admin` — matriz Op × Fin heatmap, cohort implantações por mês, performance por tipo, top municípios
- Refresh CONCURRENTLY para não bloquear leitura

### Dashboard Operacional (Story 11.1)
- Funnel: ONBOARDING → ENCERRADO_OP com taxa de conversão entre fases
- DGM por município: mapa Brasil (lib `react-simple-maps` + dados IBGE)
- Taxa de judicialização global + por tipo
- Tempo médio por fase (boxplot ou bar)
- Filtros: período (preset + custom), tipo_caso, advogado responsável
- Export PDF/Excel (lib `xlsx` + `pdfkit`)

### Dashboard Financeiro (Story 11.2)
- Funnel financeiro: NAO_APLICAVEL → QUITADO
- Receita prevista (parcelas pendentes) vs realizada (parcelas pagas) — gráfico mensal
- Inadimplência por idade: 1-30d, 31-60d, >60d
- Tempo médio aceite Termo (do APRESENTANDO até TERMO_ACEITO)
- Taxa aprovação automática vs reversão (métrica do Sprint 8)

### Dashboard Admin (Story 11.3)
- Matriz Op × Fin (heatmap): linhas = macrostatus_op, colunas = macrostatus_fin, células = count
- Cohort de implantações por mês de origem (tabela ou heatmap)
- Performance por tipo_caso (taxa sucesso, ticket médio honorários, tempo médio)
- Top municípios por sucesso (DGM ranking — leitura de `case_municipios_inteligencia` do Sprint 7)
- Alertas de saúde do sistema: scrapers falhando, integrações com erro, taxa reversão Termo

### Cutover Prod (4d)
- **Dia 1-2:** Janela de manutenção combinada (provavelmente sábado madrugada — confirmar)
  - Backup completo Supabase prod (snapshot)
  - Aplicar todas as migrations em prod (já testadas em staging desde Sprint 1)
  - Migrar dados: rodar `scripts/migrate-fies.ts` em prod com `--source=excel:/data/FIES.xlsx`
  - Validação: contar registros, smoke test dos 10 fluxos críticos em prod
  - Switch DNS / deploy Cloudflare prod
- **Dia 3:** Treinamento equipe (4h)
  - Sessão 1 (2h): equipe ADM/OPE — Cliente, Caso, Pipeline, Documentos, Portal
  - Sessão 2 (2h): equipe FIN/JUR — Termo, Aprovação, Cobrança, Renegociação
  - Material: vídeos curtos + cheat sheet + runbook
- **Dia 4:** Suporte pós go-live
  - Plantão dev/PM em modo "war room" 24h
  - Triagem rápida de bugs descobertos
  - Coleta de feedback estruturada

### Definition of Done global (PRD 1 §17) — checklist final
- [ ] Todas stories críticas (épicos 1-10) com ACs aprovados
- [ ] 50+ casos migrados em staging com 0 erros (amostra validada)
- [ ] 2500 casos migrados em prod (lote final)
- [ ] Pipelines Op + Fin operando com dados reais
- [ ] Portal em produção com 10+ clientes ativos (Hyago seleciona piloto)
- [ ] Integrações ZapSign + Drive + Conta Azul + Asaas + ChatGuru + SEI + Gmail funcionais
- [ ] Termo gerado, aprovado, aceito e parcelas geradas em fluxo E2E real
- [ ] Auditoria completa em todas ações sensíveis
- [ ] LGPD: export + soft-delete funcionais
- [ ] Dashboards Op + Fin + Admin com dados reais
- [ ] E2E Playwright em 10 fluxos críticos passando
- [ ] Onboarding equipe (4h treinamento concluído)
- [ ] Documentação operacional publicada

---

## Riscos principais

| # | Risco | Mitigação |
|---|---|---|
| **S11-R1** | Migração prod quebra com dados que dry-run não previu | Snapshot pré-cutover; rollback documentado em runbook; janela > 4h prevista |
| **S11-R2** | Cutover na janela escolhida coincide com volume alto | Combinar com Hyago: sábado madrugada padrão; evitar fim de mês (cobrança) |
| **S11-R3** | Equipe resiste à mudança (Excel é zona de conforto) | Co-existência 2 sem (continuam atualizando Excel + sistema); arquivamento gradual |
| **S11-R4** | Bug crítico descoberto no dia 1 pós go-live | Plantão war room; rollback parcial possível (volta para Excel em casos críticos) |
| **S11-R5** | Dashboards lentos com 2500 casos reais | Materialized views + index; testar performance em staging com volume real |
| **S11-R6** | Hyago ou equipe não disponíveis para treinamento | Agendar com 30d antecedência; gravação obrigatória para reposição |

---

## Definition of Done (além do global)

- [ ] 3 stories de dashboards + bloco cutover
- [ ] Smoke E2E 10 fluxos críticos passando em prod
- [ ] Treinamento gravado e arquivado
- [ ] Runbook de operação publicado (`docs/operations/runbook.md`)
- [ ] Status page interna (até `dashboards.admin.tsx` mostra saúde scrapers/integrações)
- [ ] Hyago assina termo "Projeto 1 concluído"

---

## Após o Projeto 1

- **Próximo PRD:** Projeto 2 (integração Projuris bidirecional)
- **Programa contínuo:** monitoramento 60d das métricas chave (auto-aprovação, reversão, SLA, performance)
- **Backlog:** features adiadas (Mais Médicos detalhado, Residência detalhada, etc.) entram em iterações futuras

---

> _Plano F4 completo. Pronto para validação multi-agente e sign-off do Hyago._
> _— @pm John, sob coordenação do Orion 🎯_
